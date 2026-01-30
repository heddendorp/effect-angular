# Effect Angular Query

Angular helpers for building TanStack Query `injectQuery` options from Effect RPC procedures.

## Installation

```bash
npm install effect-angular-query @tanstack/angular-query-experimental @effect/rpc effect
```

Requires Angular 21+.

## Setup

1) Provide TanStack Query (this package does not configure it):

```ts
import { ApplicationConfig } from '@angular/core';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';

export const appConfig: ApplicationConfig = {
  providers: [provideTanStackQuery(new QueryClient())],
};
```

2) Provide the Effect RPC query client helpers:

```ts
import { ApplicationConfig } from '@angular/core';
import * as Rpc from '@effect/rpc/Rpc';
import * as RpcClient from '@effect/rpc/RpcClient';
import * as RpcGroup from '@effect/rpc/RpcGroup';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';

import { provideEffectRpcQueryClient } from 'effect-angular-query';

const GetUser = Rpc.make('users.get', {
  payload: Schema.Struct({ id: Schema.String }),
  success: Schema.Struct({ name: Schema.String }),
});

class AppRpcs extends RpcGroup.make(GetUser) {}

// Provide the Layer<RpcClient.Protocol, never, never> from your RPC transport setup.
const rpcLayer: Layer.Layer<RpcClient.Protocol, never, never> = createRpcLayer();

export const appConfig: ApplicationConfig = {
  providers: [
    provideEffectRpcQueryClient({
      group: AppRpcs,
      rpcLayer,
      keyPrefix: 'app',
      defaults: { staleTime: 10_000 },
    }),
  ],
};
```

`keyPrefix` and `defaults` are optional. Defaults are merged with per-call overrides.

## Sharing RPC contracts

Keep your RPC contract (schemas + `RpcGroup`) in a small shared package. The server imports it to
register handlers, while the client imports the same contract to type its helpers. This avoids
shipping server implementation code to the client while still sharing the RPC types.

```ts
// packages/rpc-contracts/src/index.ts
import * as Rpc from '@effect/rpc/Rpc';
import * as RpcGroup from '@effect/rpc/RpcGroup';
import * as Schema from 'effect/Schema';

export const GetUser = Rpc.make('users.get', {
  payload: Schema.Struct({ id: Schema.String }),
  success: Schema.Struct({ name: Schema.String }),
});

export class AppRpcs extends RpcGroup.make(GetUser) {}
```

```ts
// client package
import { AppRpcs } from '@acme/rpc-contracts';

provideEffectRpcQueryClient({
  group: AppRpcs,
  rpcLayer,
});
```

If you need to reference server-only types, use `import type` so they are erased from the client
bundle.

## Injectable helpers

If you want to avoid re-creating helpers in multiple components, provide them once and inject the
ready-to-use object.

```ts
import { InjectionToken, inject } from '@angular/core';

import * as RpcGroup from '@effect/rpc/RpcGroup';

import { EffectRpcQueryClient, RpcQueryHelpers } from 'effect-angular-query';

export const APP_QUERY_HELPERS = new InjectionToken<
  RpcQueryHelpers<RpcGroup.Rpcs<typeof AppRpcs>>
>(
  'APP_QUERY_HELPERS',
);

export const provideAppQueryHelpers = () => ({
  provide: APP_QUERY_HELPERS,
  useFactory: () => inject(EffectRpcQueryClient).helpersFor(AppRpcs),
});
```

```ts
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { injectQuery } from '@tanstack/angular-query-experimental';

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
  `,
})
export class UserDetailsComponent {
  private readonly helpers = inject(APP_QUERY_HELPERS);

  readonly userQuery = injectQuery(() =>
    this.helpers.users.get.queryOptions({ id: '1' }),
  );
}
```

## Usage with `injectQuery`

```ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { injectQuery } from '@tanstack/angular-query-experimental';

import { EffectRpcQueryClient } from 'effect-angular-query';

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
  `,
})
export class UserDetailsComponent {
  private readonly rpcQueryClient = inject(EffectRpcQueryClient);
  private readonly helpers = this.rpcQueryClient.helpersFor(AppRpcs);

  readonly userId = signal('1');

  readonly userQuery = injectQuery(() =>
    this.helpers.users.get.queryOptions(
      { id: this.userId() },
      { overrides: { staleTime: 10_000 } },
    ),
  );
}
```

You can also access the `queryKey` and `queryFn` helpers directly:

```ts
const queryKey = helpers.users.get.queryKey({ id: '1' });
const queryFn = helpers.users.get.queryFn({ id: '1' });
```

## Query key shape

The default query key shape matches the RPC path segments and includes input metadata:

```ts
helpers.users.get.queryKey({ id: '1' });
// => [['users', 'get'], { input: { id: '1' } }]
```

If `keyPrefix` is configured, it is prepended:

```ts
// keyPrefix: 'app'
helpers.users.get.queryKey({ id: '1' });
// => [['app', 'users', 'get'], { input: { id: '1' } }]
```

## Path helpers

Use path-level helpers to invalidate or refetch a subtree of queries:

```ts
import { inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { EffectRpcQueryClient } from 'effect-angular-query';

const rpcQueryClient = inject(EffectRpcQueryClient);
const queryClient = inject(QueryClient);

const filter = rpcQueryClient.queryFilter(['users'], { exact: false });
queryClient.invalidateQueries(filter);
```

## API reference

- `provideEffectRpcQueryClient` - registers the RPC query helper configuration.
- `EffectRpcQueryClient` - exposes per-procedure helpers and path helpers.
- `createRpcQueryKey` - build a query key from path segments and input.
- `createRpcQueryOptions` - build TanStack Query options with RPC metadata.
- `createRpcPathKey` / `createRpcQueryFilter` - path-level invalidation helpers.
- `RpcQueryKey`, `RpcQueryOptions`, `RpcQueryFn`, `RpcQueryHelpers` - helper types for typing custom wrappers.
