import { TestBed } from '@angular/core/testing';
import {
  injectMutation,
  injectQuery,
  provideTanStackQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import * as RpcClient from '@effect/rpc/RpcClient';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

import { createEffectRpcAngularClient } from './lib/effect-rpc-query-client';
import { AppRpcs } from './testing/rpc-contracts';

const createRpcLayer = () =>
  Layer.effect(
    RpcClient.Protocol,
    RpcClient.Protocol.make(() =>
      Effect.succeed({
        send: () => Effect.succeed(undefined),
        supportsAck: false,
        supportsTransferables: false,
      }),
    ),
  );

const AppRpc = createEffectRpcAngularClient({
  group: AppRpcs,
  rpcLayer: createRpcLayer(),
  keyPrefix: 'app',
  queryDefaults: { staleTime: 10_000 },
  mutationDefaults: { retry: 1 },
});

describe('README examples', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
        AppRpc.providers,
      ],
    });
  });

  it('creates an injectable client once and reuses it', () => {
    const first = TestBed.runInInjectionContext(() => AppRpc.injectClient());
    const second = TestBed.runInInjectionContext(() => AppRpc.injectClient());

    expect(first).toBe(second);
    expect(first.users.get.queryKey({ id: '1' })).toEqual([
      ['app', 'users', 'get'],
      { input: { id: '1' }, type: 'query' },
    ]);
  });

  it('uses query and mutation helpers with injectQuery and injectMutation', () => {
    const states = TestBed.runInInjectionContext(() => {
      const rpc = AppRpc.injectClient();

      const userQuery = injectQuery(() => rpc.users.get.queryOptions({ id: '1' }));
      const updateUser = injectMutation(() => rpc.users.updateName.mutationOptions());

      return { userQuery, updateUser };
    });

    expect(typeof states.userQuery.isPending).toBe('function');
    expect(typeof states.updateUser.mutate).toBe('function');
  });

  it('builds path helpers and mutation keys as documented', () => {
    const rpc = TestBed.runInInjectionContext(() => AppRpc.injectClient());

    expect(rpc.pathKey(['users'])).toEqual([['app', 'users']]);
    expect(rpc.queryFilter(['users'], { exact: false })).toEqual({
      queryKey: [['app', 'users']],
      exact: false,
    });
    expect(rpc.users.updateName.mutationKey()).toEqual([
      ['app', 'users', 'updateName'],
      { type: 'mutation' },
    ]);
  });
});
