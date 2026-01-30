# effect-platform-angular

Angular HttpClient adapter for Effect Platform. Use it to run Effect HttpClient requests with Angular's HttpClient and to power Effect RPC protocol layers in Angular apps.

## Quickstart

### Install

```bash
npm install effect-platform-angular @effect/platform effect
```

```bash
bun add effect-platform-angular @effect/platform effect
```

### Register the adapter

```ts
import { provideHttpClient } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideEffectHttpClient } from 'effect-platform-angular';

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
import { EFFECT_HTTP_CLIENT } from 'effect-platform-angular';

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

This example shows the intended path for using Effect RPC over HTTP with Angular. It assumes you have a server exposing the Effect RPC HTTP protocol at `/rpc` and that `@effect/rpc` is installed in your app. The Angular service is the boundary where you stop Effect-style handling and return Promises to components.

```ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@effect/platform';
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from '@effect/rpc';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import { EFFECT_HTTP_CLIENT } from 'effect-platform-angular';

const Ping = Rpc.make('Ping', {
  payload: Schema.Struct({ message: Schema.String }),
  success: Schema.Struct({ reply: Schema.String }),
});

export class AppRpcs extends RpcGroup.make(Ping) {}

type PromiseClient = {
  Ping: (payload: { message: string }) => Promise<{ reply: string }>;
};

const createPromiseClient = (layer: Layer.Layer<unknown, unknown, unknown>): PromiseClient =>
  new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop !== 'string') {
          return undefined;
        }
        return (payload: { message: string }) => {
          const program = Effect.gen(function* () {
            const client = yield* RpcClient.make(AppRpcs);
            const method = client[prop as keyof typeof client];
            if (typeof method !== 'function') {
              return yield* Effect.dieMessage(`Unknown RPC method: ${prop}`);
            }
            return yield* method(payload);
          }).pipe(Effect.provide(layer), Effect.scoped);

          return Effect.runPromise(program);
        };
      },
    },
  ) as PromiseClient;

@Injectable({ providedIn: 'root' })
export class AppRpcClient {
  private readonly httpClient = inject(EFFECT_HTTP_CLIENT);
  private readonly rpcLayer = RpcClient.layerProtocolHttp({ url: '/rpc' }).pipe(
    Layer.provide([
      RpcSerialization.layerJson,
      Layer.succeed(HttpClient.HttpClient, this.httpClient),
    ]),
  );

  readonly client = createPromiseClient(this.rpcLayer);
}
```

## API reference

### Providers

- `provideEffectHttpClient(): EnvironmentProviders` - registers the Angular HttpClient adapter.
- `EFFECT_HTTP_CLIENT: InjectionToken<HttpClient.HttpClient>` - the adapter instance to inject and provide to Effect.

## Compatibility

- Angular 21+
- `@effect/platform` 0.94+
- `effect` 3.19+
