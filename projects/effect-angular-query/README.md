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
bun add @tanstack/angular-query-experimental @effect/rpc effect
```

Requires Angular 21.x (peer dependency range currently `^21.1.0`).

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
import * as Rpc from '@effect/rpc/Rpc';
import * as RpcClient from '@effect/rpc/RpcClient';
import * as RpcGroup from '@effect/rpc/RpcGroup';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';

import { asRpcMutation, createEffectRpcAngularClient } from '@heddendorp/effect-angular-query';

const GetUser = Rpc.make('users.get', {
  payload: Schema.Struct({ id: Schema.String }),
  success: Schema.Struct({ name: Schema.String }),
});

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

- `call(input): Promise<Success>`
- `callEffect(input): Effect<Success, Error, never>`

```ts
await AppRpc.injectClient().users.updateName.call({ id: '1', name: 'Ada' });
```

## Query key and mutation helpers

### Query key

```ts
const rpc = AppRpc.injectClient();
const key = rpc.users.get.queryKey({ id: '1' });
// => [['app', 'users', 'get'], { input: { id: '1' }, type: 'query' }]
```

### mutationOptions and mutationKey

```ts
const rpc = AppRpc.injectClient();

const mutationOptions = rpc.users.updateName.mutationOptions();
const mutationKey = rpc.users.updateName.mutationKey();
```

## Typed expected errors

Expected errors are typed as the union of:

- your RPC schema error (`Rpc.ErrorExit<Procedure>`)
- `RpcClientError` transport/protocol errors.

This typed error union is reflected in `queryOptions` and `mutationOptions` callback types.

## Path helpers

Use path-level helpers to invalidate or refetch a subtree of queries:

```ts
const rpc = AppRpc.injectClient();
const filter = rpc.queryFilter(['users'], { exact: false });
```

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
3. Mark mutation procedures with `asRpcMutation(...)` so mutation helpers are generated.
4. Move old `defaults` into `queryDefaults` (and optionally `mutationDefaults`).
5. Update mutation call sites to use `injectMutation(() => rpc.<path>.mutationOptions())`.

## Stream procedures

Stream procedures are not supported in this integration surface. Generated helpers throw an explicit
error for procedures that return `RpcSchema.Stream`.

## injectable client

The recommended pattern is to create and provide one client in app setup and reuse it by calling
`AppRpc.injectClient()` in components and services.
