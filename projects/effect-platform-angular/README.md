# effect-platform-angular

Angular HttpClient adapter for Effect Platform. Use it to run Effect HttpClient requests with Angular's HttpClient and to power Effect RPC protocol layers in Angular apps.

## Quickstart

### Install

```bash
npm install @heddendorp/effect-platform-angular
```

```bash
bun add @heddendorp/effect-platform-angular
```

Install required peers in your app:

```bash
bun add effect@4.0.0-beta.97
```

### Register the adapter

```ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  provideEffectHttpClient,
  provideEffectRpcProtocolHttpLayer,
} from '@heddendorp/effect-platform-angular';

import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptors([/* app interceptors */])),
    provideEffectHttpClient({
      // Required for relative URLs during SSR; use your application's public origin.
      baseUrl: () => 'https://example.com',
    }),
    provideEffectRpcProtocolHttpLayer({ url: '/rpc' }),
  ],
});
```

Provider order matters: register `provideHttpClient(...)` first, then `provideEffectHttpClient()`, then `provideEffectRpcProtocolHttpLayer(...)`.

### Use the adapter in a service

```ts
import { inject, Injectable } from '@angular/core';
import * as Effect from 'effect/Effect';
import { HttpClient } from 'effect/unstable/http';
import { EFFECT_HTTP_CLIENT } from '@heddendorp/effect-platform-angular';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly httpClient = inject(EFFECT_HTTP_CLIENT);

  fetchProfile(id: string) {
    const request = HttpClient.get(`https://api.example.com/users/${id}`).pipe(
      Effect.provideService(HttpClient.HttpClient, this.httpClient),
      Effect.flatMap((response) => response.json),
    );

    return Effect.runPromise(request);
  }
}
```

## Concepts

- Adapter boundaries: `provideEffectHttpClient()` exposes an Effect HttpClient backed by Angular HttpClient.
- Layer boundaries: `provideEffectHttpClientLayer()` and `provideEffectRpcProtocolHttpLayer(...)` expose DI-provided Effect layers for direct `Layer` composition.
- Request mapping: `HttpBody` values become Angular request bodies. Stream bodies are buffered and sent as an `ArrayBuffer`, so Angular preserves their binary wire format.
- Response mapping: non-2xx HTTP responses are returned as `HttpClientResponse` values, while transport failures map to `HttpClientError.HttpClientError` with a `TransportError` reason.
- Cancellation: canceling an Effect fiber aborts the underlying HttpClient subscription.
- DI + Effect: inject `EFFECT_HTTP_CLIENT` and provide it to Effect with `Effect.provideService(HttpClient.HttpClient, client)`.

### SSR and relative URLs

Effect resolves a request URL before Angular interceptors run. Browsers supply an origin through `location`, but server-side rendering does not. Configure an absolute `baseUrl` when relative requests such as `/api` or `/rpc` can run during SSR:

```ts
provideEffectHttpClient({
  baseUrl: () => 'https://public.example.com',
});
```

The factory runs when Angular creates the adapter, inside Angular's injection context, so it may call `inject(...)` to read an application-specific origin token. The adapter never reads `location` to resolve this option. Absolute request URLs continue to work without `baseUrl`; relative SSR requests fail with Effect's typed `InvalidUrlError` when it is omitted.

### Streaming boundaries

Angular HttpClient does not expose progressive upload or download bodies through this adapter:

- Effect stream request bodies are fully buffered before Angular starts the request. Buffering is linear and limited to 16 MiB by default. Set `maxBufferedRequestBodyBytes` to another finite, non-negative safe integer when registering the adapter.
- Exceeding the limit fails before a request is sent with `HttpClientError.HttpClientError`. Its reason is the non-retryable `EncodeError`, and its cause is `BufferedRequestBodyTooLargeError` with `maxBytes` and `receivedBytes` fields.
- `HttpClientResponse.stream` is available for API compatibility, but its bytes arrive as a single buffered chunk only after Angular receives the complete response. It is not a progressive download stream.
- Framed RPC serializers and streaming RPC procedures are not supported over this Angular HTTP transport. Supplying a serializer whose `includesFraming` is `true` fails layer construction with `UnsupportedRpcSerializationError`. Use a socket transport or another progressively streaming Effect HttpClient for those procedures.

Migration: applications that previously supplied `RpcSerialization.layerNdjson`, MessagePack, or another framed serializer must move those RPCs to a progressively streaming transport. Applications with stream uploads larger than 16 MiB must either configure a deliberate larger finite limit or use a transport that supports progressive uploads.

## Effect RPC (minimal example)

This example shows the intended path for using Effect RPC over HTTP with Angular. It assumes you have a server exposing the Effect RPC HTTP protocol at `/rpc`. The Angular service is the boundary where you stop Effect-style handling and return Promises to components, so components can inject the client and call procedures directly.

If you also want auto-generated TanStack Query + Mutation helpers with one injectable client, use `@heddendorp/effect-angular-query` on top of this transport layer.

```ts
import { inject, Injectable } from '@angular/core';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import { Rpc, RpcClient, RpcClientError, RpcGroup } from 'effect/unstable/rpc';
import {
  EFFECT_RPC_PROTOCOL_HTTP_LAYER,
  UnsupportedRpcSerializationError,
} from '@heddendorp/effect-platform-angular';

const Ping = Rpc.make('Ping', {
  payload: Schema.Struct({ message: Schema.String }),
  success: Schema.Struct({ reply: Schema.String }),
});

export class AppRpcs extends RpcGroup.make(Ping) {}

type PromiseClient<T> = {
  -readonly [K in keyof T]: T[K] extends (
    ...args: infer Args
  ) => Effect.Effect<infer A, infer _E, infer _R>
    ? (...args: Args) => Promise<A>
    : never;
};

type RawClient = RpcClient.FromGroup<typeof AppRpcs, RpcClientError.RpcClientError>;
type AppRpcPromiseClient = PromiseClient<RawClient>;

const createPromiseClient = (
  layer: Layer.Layer<RpcClient.Protocol, UnsupportedRpcSerializationError, never>,
): AppRpcPromiseClient => {
  const runRpc = <A, E>(call: (client: RawClient) => Effect.Effect<A, E, never>): Promise<A> => {
    const program = Effect.flatMap(RpcClient.make(AppRpcs), call).pipe(
      Effect.provide(layer),
      Effect.scoped,
    );

    return Effect.runPromise(program);
  };

  const client = {} as AppRpcPromiseClient;
  const procedureKeys = Array.from(AppRpcs.requests.keys()) as Array<keyof RawClient>;
  for (const key of procedureKeys) {
    client[key] = ((...args: Parameters<RawClient[typeof key]>) =>
      runRpc((rpcClient) => rpcClient[key](...args))) as AppRpcPromiseClient[typeof key];
  }

  return client;
};

@Injectable({ providedIn: 'root' })
export class AppRpcClient implements AppRpcPromiseClient {
  private readonly rpcLayer = inject(EFFECT_RPC_PROTOCOL_HTTP_LAYER);

  readonly Ping: AppRpcPromiseClient['Ping'];

  constructor() {
    const promiseClient = createPromiseClient(this.rpcLayer);
    this.Ping = promiseClient.Ping;
  }
}
```

## API reference

### Providers

- `provideEffectHttpClient(options?: EffectHttpClientOptions): EnvironmentProviders` - registers the Angular HttpClient adapter.
- `EffectHttpClientOptions`:
  - `baseUrl?: string | URL | (() => string | URL)` - absolute base URL for resolving relative requests, especially during SSR.
  - `maxBufferedRequestBodyBytes?: number` - finite stream upload buffer limit; defaults to `DEFAULT_MAX_BUFFERED_REQUEST_BODY_BYTES` (16 MiB).
- `BufferedRequestBodyTooLargeError` - typed cause used when a stream upload exceeds its configured buffer limit.
- `EFFECT_HTTP_CLIENT: InjectionToken<HttpClient.HttpClient>` - the adapter instance to inject and provide to Effect.
- `provideEffectHttpClientLayer(): EnvironmentProviders` - registers a DI-provided `Layer.succeed(HttpClient.HttpClient, client)` layer.
- `EFFECT_HTTP_CLIENT_LAYER: InjectionToken<Layer.Layer<HttpClient.HttpClient, never, never>>` - Effect HttpClient layer token.
- `provideEffectRpcProtocolHttpLayer(options): EnvironmentProviders` - registers an RPC protocol HTTP transport layer that uses `EFFECT_HTTP_CLIENT`.
- `EFFECT_RPC_PROTOCOL_HTTP_LAYER: InjectionToken<Layer.Layer<RpcClient.Protocol, UnsupportedRpcSerializationError, never>>` - RPC protocol layer token.
- `UnsupportedRpcSerializationError` - layer-construction error returned for framed serializers, which require progressive response streaming.
- `EffectRpcHttpLayerOptions`:
  - `url: string | (() => string)` - endpoint URL (function form is resolved when Angular creates the layer).
  - `serializationLayer?: Layer.Layer<RpcSerialization.RpcSerialization, never, never>` - defaults to `RpcSerialization.layerJson`; the provided serializer must have `includesFraming: false`.

## Compatibility

- Angular 22.x (peer dependency range `^22.0.6`)
- Effect v4 beta (`effect 4.0.0-beta.97`)
