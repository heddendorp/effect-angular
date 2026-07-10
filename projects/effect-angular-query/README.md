# Effect Angular Query

Angular helpers for building an injectable Effect RPC client with auto-generated TanStack Query and Mutation options.

## Installation

```bash
npm install @heddendorp/effect-angular-query
```

```bash
bun add @heddendorp/effect-angular-query
```

Install required peers in your app:

```bash
bun add @tanstack/angular-query-experimental effect@4.0.0-beta.97
```

Requires Angular 22.x and Effect v4 beta (`effect 4.0.0-beta.97`).

## Setup

1. Provide TanStack Query:

```ts
import { ApplicationConfig } from '@angular/core';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';

export const appConfig: ApplicationConfig = {
  providers: [provideTanStackQuery(new QueryClient())],
};
```

2. Create and provide your RPC client once:

```ts
import { ApplicationConfig } from '@angular/core';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import { Rpc, RpcClient, RpcGroup } from 'effect/unstable/rpc';

import {
  asRpcMutation,
  asRpcQuery,
  createEffectRpcAngularClient,
} from '@heddendorp/effect-angular-query';

const GetUser = asRpcQuery(
  Rpc.make('users.get', {
    payload: Schema.Struct({ id: Schema.String }),
    success: Schema.Struct({ name: Schema.String }),
  }),
);

const UpdateUserName = asRpcMutation(
  Rpc.make('users.updateName', {
    payload: Schema.Struct({ id: Schema.String, name: Schema.String }),
    success: Schema.Struct({ ok: Schema.Boolean }),
  }),
);

class AppRpcs extends RpcGroup.make(GetUser, UpdateUserName) {}

const rpcLayer: Layer.Layer<RpcClient.Protocol, never, never> = createRpcLayer();

export const AppRpc = createEffectRpcAngularClient({
  group: AppRpcs,
  rpcLayer,
  keyPrefix: 'app',
  queryDefaults: { staleTime: 10_000 },
  mutationDefaults: { retry: 1 },
});

export const appConfig: ApplicationConfig = {
  providers: [AppRpc.providers],
};
```

Every procedure must be classified explicitly with `asRpcQuery(...)` or
`asRpcMutation(...)`. The marker survives procedure and group `middleware(...)` and `prefix(...)`
composition. Reapplying a marker replaces the previous intent.

The `rpcLayer` is the complete client layer for the group. For a basic contract it only needs to
provide `RpcClient.Protocol`. Contracts with required client middleware or schema encoding/decoding
services must merge those services into the same layer. The factory checks this at compile time and
preserves layer-construction and middleware-client errors in each procedure's error type.

## Sharing RPC contracts

Keep your RPC contract (schemas + `RpcGroup`) in a small shared package. The server imports it to
register handlers, while the client imports the same contract to type its helpers. This avoids
shipping server implementation code to the client while still sharing the RPC types.

## Usage with `injectQuery` and `injectMutation`

The injected client auto-exposes all procedures from your RPC group. New procedures become available
without creating extra services or manually wiring helper methods.

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { injectMutation, injectQuery, QueryClient } from '@tanstack/angular-query-experimental';

@Component({
  selector: 'app-user-details',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (userQuery.isPending()) {
      <p>Loading...</p>
    } @else if (userQuery.isError()) {
      <p>Failed to load.</p>
    } @else {
      <p>{{ userQuery.data()?.name }}</p>
    }

    <button type="button" (click)="save()">Save</button>
  `,
})
export class UserDetailsComponent {
  private readonly rpc = AppRpc.injectClient();
  private readonly queryClient = inject(QueryClient);

  readonly userQuery = injectQuery(() => this.rpc.users.get.queryOptions({ id: '1' }));

  readonly updateUser = injectMutation(() =>
    this.rpc.users.updateName.mutationOptions({
      overrides: {
        onSuccess: () => this.queryClient.invalidateQueries(this.rpc.queryFilter(['users'])),
      },
    }),
  );

  save(): void {
    this.updateUser.mutate({ id: '1', name: 'Ada' });
  }
}
```

## Direct procedure calls

Each generated procedure also exposes direct call helpers:

- `call(input, { signal? }): Promise<Success>`
- `callEffect(input): Effect<Success, Error, never>`

```ts
await AppRpc.injectClient().users.updateName.call({ id: '1', name: 'Ada' });
```

The underlying scoped protocol and RPC client are acquired once per Angular environment injector,
shared by every call, and released when that injector is destroyed.

## Query key and mutation helpers

### Query key

```ts
const rpc = AppRpc.injectClient();
const key = rpc.users.get.queryKey({ id: '1' });
// => [['app', 'users', 'get'], { input: { id: '1' }, type: 'query' }]
```

Inputs are converted to deterministic, JSON-safe key values. For custom class instances, pass a
synchronous encoder to `queryKey` and `queryOptions`:

```ts
class UserLookup {
  constructor(readonly id: string) {}
}

const input = new UserLookup('1');
const inputEncoder = (value: UserLookup) => ({ id: value.id });

rpc.users.get.queryKey(input, { inputEncoder });
rpc.users.get.queryOptions(input, { inputEncoder });
```

`Map` and `Set` inputs preserve insertion order, matching Effect's encoded RPC payloads. If a
procedure treats their order as insignificant, use `inputEncoder` to return an explicitly sorted
JSON representation.

TanStack's query `AbortSignal` is forwarded to Effect, so cancelled and pre-aborted queries interrupt
their RPC work. Per-procedure `select` transformations retain their selected data type. Factory-wide
defaults intentionally accept only options that do not depend on a particular procedure's data,
variables, or error type; put `select`, `initialData`, and typed callbacks in procedure overrides.

### mutationOptions and mutationKey

```ts
const rpc = AppRpc.injectClient();

const mutationOptions = rpc.users.updateName.mutationOptions();
const mutationKey = rpc.users.updateName.mutationKey();
```

## Typed expected errors

Expected errors are typed as the union of:

- your RPC schema error (`Rpc.ErrorExit<Procedure>`)
- required middleware client errors
- `RpcClientError` transport/protocol errors
- errors raised while acquiring `rpcLayer`
- `RpcStreamUnsupportedError` for unsupported stream procedures.

This typed error union is reflected in `queryOptions` and `mutationOptions` callback types.

## Path helpers

Use path-level helpers to invalidate or refetch a subtree of queries:

```ts
const rpc = AppRpc.injectClient();
const filter = rpc.queryFilter(['users'], { exact: false });
```

With `exact: true`, the filter matches that exact procedure path for every encoded input; with
`exact: false` (the default), it matches the full descendant subtree.

## API reference

- `createEffectRpcAngularClient` - creates a typed injectable client factory (`providers`, `token`, `injectClient`).
- `createEffectRpcAngularClientConfig` - normalizes config defaults.
- `asRpcMutation` / `asRpcQuery` - marks procedure intent for generated helper surfaces.
- `createRpcQueryOptions` - build TanStack query options with RPC metadata.
- `createRpcMutationOptions` - build TanStack mutation options with RPC metadata.
- `createRpcQueryKey` - build query keys from path segments and input.
- `createRpcPathKey` / `createRpcQueryFilter` - path-level invalidation helpers.

## Migration from the previous API

This release includes a **major version bump** for `@heddendorp/effect-angular-query`.

### Old -> new mappings

- `provideEffectRpcQueryClient(...)` -> `const AppRpc = createEffectRpcAngularClient(...); AppRpc.providers`
- `inject(EffectRpcQueryClient)` -> `AppRpc.injectClient()`
- `rpcQueryClient.helpersFor(AppRpcs)` -> auto-exposed methods directly on `AppRpc.injectClient()`
- `helpers.users.get.queryOptions(...)` -> `AppRpc.injectClient().users.get.queryOptions(...)`

### Migration steps

1. Replace old provider setup with `createEffectRpcAngularClient(...)` and register `AppRpc.providers`.
2. Replace `EffectRpcQueryClient` injection with `AppRpc.injectClient()`.
3. Mark every procedure with `asRpcQuery(...)` or `asRpcMutation(...)` so intent is explicit.
4. Move old `defaults` into `queryDefaults` (and optionally `mutationDefaults`).
5. Update mutation call sites to use `injectMutation(() => rpc.<path>.mutationOptions())`.

## Stream procedures

Stream procedures are not supported in this integration surface. `callEffect(...)` fails with a
typed `RpcStreamUnsupportedError`, and `call(...)` returns a rejected Promise. Neither method throws
synchronously.

## injectable client

The recommended pattern is to create and provide one client in app setup and reuse it by calling
`AppRpc.injectClient()` in components and services.
