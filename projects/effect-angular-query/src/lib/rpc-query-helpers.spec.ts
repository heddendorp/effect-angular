import { TestBed } from '@angular/core/testing';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { Rpc, RpcClient, RpcClientError, RpcGroup } from '@effect/rpc';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';

import { EffectRpcQueryClient, provideEffectRpcQueryClient } from './effect-rpc-query-client';

const GetUser = Rpc.make('users.get', {
  payload: Schema.Struct({ id: Schema.String }),
  success: Schema.Struct({ name: Schema.String }),
});

class AppRpcs extends RpcGroup.make(GetUser) {}

const createFailingRpcLayer = (error: RpcClientError.RpcClientError) =>
  Layer.effect(
    RpcClient.Protocol,
    RpcClient.Protocol.make(() =>
      Effect.succeed({
        send: () => Effect.fail(error),
        supportsAck: false,
        supportsTransferables: false,
      }),
    ),
  );

describe('EffectRpcQueryClient helpers', () => {
  it('builds per-procedure query keys and options', () => {
    TestBed.configureTestingModule({
      providers: [
        provideEffectRpcQueryClient({
          group: AppRpcs,
          rpcLayer: createFailingRpcLayer(
            new RpcClientError.RpcClientError({
              reason: 'Protocol',
              message: 'Not used',
            }),
          ),
          keyPrefix: 'app',
          defaults: { staleTime: 5000 },
        }),
      ],
    });

    const client = TestBed.inject(EffectRpcQueryClient);
    const helpers = client.helpersFor(AppRpcs);

    const key = helpers.users.get.queryKey({ id: '1' });
    expect(key).toEqual([['app', 'users', 'get'], { input: { id: '1' } }]);

    const options = helpers.users.get.queryOptions({ id: '1' }, { overrides: { retry: 2 } });
    expect(options.queryKey).toEqual([['app', 'users', 'get'], { input: { id: '1' } }]);
    expect(options.retry).toBe(2);
    expect(options.staleTime).toBe(5000);
    expect(options.meta).toMatchObject({ rpc: { path: ['users', 'get'] } });
  });

  it('executes queryFn through the rpc layer', async () => {
    const error = new RpcClientError.RpcClientError({
      reason: 'Protocol',
      message: 'Test failure',
    });

    TestBed.configureTestingModule({
      providers: [
        provideEffectRpcQueryClient({
          group: AppRpcs,
          rpcLayer: createFailingRpcLayer(error),
        }),
      ],
    });

    const client = TestBed.inject(EffectRpcQueryClient);
    const helpers = client.helpersFor(AppRpcs);
    const queryFn = helpers.users.get.queryFn({ id: '1' });
    const queryKey = helpers.users.get.queryKey({ id: '1' });
    const context = {
      client: new QueryClient(),
      queryKey,
      signal: new AbortController().signal,
      meta: undefined,
    };

    await expect(queryFn(context)).rejects.toMatchObject({ message: 'Test failure' });
  });

  it('builds path helpers for subtree invalidation', () => {
    TestBed.configureTestingModule({
      providers: [
        provideEffectRpcQueryClient({
          group: AppRpcs,
          rpcLayer: createFailingRpcLayer(
            new RpcClientError.RpcClientError({
              reason: 'Protocol',
              message: 'Not used',
            }),
          ),
          keyPrefix: ['app', 'v1'],
        }),
      ],
    });

    const client = TestBed.inject(EffectRpcQueryClient);

    expect(client.pathKey(['users'])).toEqual([['app', 'v1', 'users']]);
    expect(client.queryFilter(['users'])).toEqual({ queryKey: [['app', 'v1', 'users']] });
  });
});
