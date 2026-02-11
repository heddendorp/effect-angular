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
bun add @effect/platform effect
```

### Register the adapter

```ts
import { provideHttpClient } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideEffectHttpClient } from '@heddendorp/effect-platform-angular';

import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient(), provideEffectHttpClient()],
});
```

### Use the adapter in a service

```ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@effect/platform';
import * as Effect from 'effect/Effect';
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
- Request mapping: `HttpBody` values become Angular request bodies; stream bodies are buffered into a `Uint8Array`.
- Response mapping: non-2xx HTTP responses are returned as `HttpClientResponse` values, while transport failures map to `HttpClientError.RequestError`.
- Cancellation: canceling an Effect fiber aborts the underlying HttpClient subscription.
- DI + Effect: inject `EFFECT_HTTP_CLIENT` and provide it to Effect with `Effect.provideService(HttpClient.HttpClient, client)`.

## Effect RPC (minimal example)

This example shows the intended path for using Effect RPC over HTTP with Angular. It assumes you have a server exposing the Effect RPC HTTP protocol at `/rpc` and that `@effect/rpc` is installed in your app. The Angular service is the boundary where you stop Effect-style handling and return Promises to components, so components can inject the client and call procedures directly.

If you also want auto-generated TanStack Query + Mutation helpers with one injectable client, use `@heddendorp/effect-angular-query` on top of this transport layer.

```ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@effect/platform';
import { Rpc, RpcClient, RpcClientError, RpcGroup, RpcSerialization } from '@effect/rpc';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import { EFFECT_HTTP_CLIENT } from '@heddendorp/effect-platform-angular';

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
  layer: Layer.Layer<RpcClient.Protocol, never, never>,
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
  private readonly httpClient = inject(EFFECT_HTTP_CLIENT);
  private readonly rpcLayer = RpcClient.layerProtocolHttp({ url: '/rpc' }).pipe(
    Layer.provide([
      RpcSerialization.layerJson,
      Layer.succeed(HttpClient.HttpClient, this.httpClient),
    ]),
  );

  readonly Ping: AppRpcPromiseClient['Ping'];

  constructor() {
    const promiseClient = createPromiseClient(this.rpcLayer);
    this.Ping = promiseClient.Ping;
  }
}
```

## API reference

### Providers

- `provideEffectHttpClient(): EnvironmentProviders` - registers the Angular HttpClient adapter.
- `EFFECT_HTTP_CLIENT: InjectionToken<HttpClient.HttpClient>` - the adapter instance to inject and provide to Effect.

## Compatibility

- Angular 21.x (peer dependency range currently `^21.1.0`)
- `@effect/platform` 0.94+
- `effect` 3.19+
