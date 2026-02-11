import { TestBed } from '@angular/core/testing';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { Rpc, RpcClient, RpcClientError, RpcGroup, RpcSchema } from '@effect/rpc';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';

import { asRpcMutation, createEffectRpcAngularClient } from './effect-rpc-query-client';

const GetUser = Rpc.make('users.get', {
  payload: Schema.Struct({ id: Schema.String }),
  success: Schema.Struct({ name: Schema.String }),
});

const UpdateUserName = Rpc.make('users.updateName', {
  payload: Schema.Struct({ id: Schema.String, name: Schema.String }),
  success: Schema.Struct({ ok: Schema.Boolean }),
});

const UserEvents = Rpc.make('users.events', {
  payload: Schema.Struct({ id: Schema.String }),
  success: RpcSchema.Stream({ success: Schema.String, failure: Schema.Never }),
});

class AppRpcs extends RpcGroup.make(GetUser, asRpcMutation(UpdateUserName)) {}
class StreamRpcs extends RpcGroup.make(UserEvents) {}

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

describe('Effect RPC Angular client helpers', () => {
  it('builds query helpers and query options for query procedures', () => {
    const rpcClient = createEffectRpcAngularClient({
      group: AppRpcs,
      rpcLayer: createFailingRpcLayer(
        new RpcClientError.RpcClientError({ reason: 'Protocol', message: 'Not used' }),
      ),
      keyPrefix: 'app',
      queryDefaults: { staleTime: 5000 },
    });

    TestBed.configureTestingModule({ providers: [rpcClient.providers] });

    const client = TestBed.runInInjectionContext(() => rpcClient.injectClient());

    const key = client.users.get.queryKey({ id: '1' });
    expect(key).toEqual([['app', 'users', 'get'], { input: { id: '1' }, type: 'query' }]);

    const options = client.users.get.queryOptions({ id: '1' }, { overrides: { retry: 2 } });
    expect(options.queryKey).toEqual([
      ['app', 'users', 'get'],
      { input: { id: '1' }, type: 'query' },
    ]);
    expect(options.retry).toBe(2);
    expect(options.staleTime).toBe(5000);
    expect(options.meta).toMatchObject({ rpc: { path: ['users', 'get'] } });
  });

  it('builds mutation helpers and mutation options for mutation procedures', () => {
    const rpcClient = createEffectRpcAngularClient({
      group: AppRpcs,
      rpcLayer: createFailingRpcLayer(
        new RpcClientError.RpcClientError({ reason: 'Protocol', message: 'Not used' }),
      ),
      keyPrefix: ['app', 'v1'],
      mutationDefaults: { retry: 1 },
    });

    TestBed.configureTestingModule({ providers: [rpcClient.providers] });

    const client = TestBed.runInInjectionContext(() => rpcClient.injectClient());

    expect(client.users.updateName.mutationKey()).toEqual([
      ['app', 'v1', 'users', 'updateName'],
      { type: 'mutation' },
    ]);

    const options = client.users.updateName.mutationOptions({
      overrides: { retry: 2 },
    });

    expect(options.retry).toBe(2);
    expect(options.meta).toMatchObject({ rpc: { path: ['users', 'updateName'] } });
  });

  it('executes queryFn and mutationFn through the rpc layer', async () => {
    const error = new RpcClientError.RpcClientError({
      reason: 'Protocol',
      message: 'Test failure',
    });

    const rpcClient = createEffectRpcAngularClient({
      group: AppRpcs,
      rpcLayer: createFailingRpcLayer(error),
    });

    TestBed.configureTestingModule({ providers: [rpcClient.providers] });

    const client = TestBed.runInInjectionContext(() => rpcClient.injectClient());

    const queryFn = client.users.get.queryFn({ id: '1' });
    const queryKey = client.users.get.queryKey({ id: '1' });
    const queryContext = {
      client: new QueryClient(),
      queryKey,
      signal: new AbortController().signal,
      meta: undefined,
    };

    await expect(queryFn(queryContext)).rejects.toMatchObject({ message: 'Test failure' });

    const mutationFn = client.users.updateName.mutationFn();
    await expect(
      mutationFn({ id: '1', name: 'Ada' }, { client: new QueryClient(), meta: undefined }),
    ).rejects.toMatchObject({
      message: 'Test failure',
    });
  });

  it('builds path helpers for subtree invalidation', () => {
    const rpcClient = createEffectRpcAngularClient({
      group: AppRpcs,
      rpcLayer: createFailingRpcLayer(
        new RpcClientError.RpcClientError({ reason: 'Protocol', message: 'Not used' }),
      ),
      keyPrefix: ['app', 'v1'],
    });

    TestBed.configureTestingModule({ providers: [rpcClient.providers] });

    const client = TestBed.runInInjectionContext(() => rpcClient.injectClient());

    expect(client.pathKey(['users'])).toEqual([['app', 'v1', 'users']]);
    expect(client.queryFilter(['users'])).toEqual({ queryKey: [['app', 'v1', 'users']] });
  });

  it('throws explicit errors for stream procedures', () => {
    const rpcClient = createEffectRpcAngularClient({
      group: StreamRpcs,
      rpcLayer: createFailingRpcLayer(
        new RpcClientError.RpcClientError({ reason: 'Protocol', message: 'Not used' }),
      ),
    });

    TestBed.configureTestingModule({ providers: [rpcClient.providers] });

    const client = TestBed.runInInjectionContext(() => rpcClient.injectClient());

    expect(() => client.users.events.call({ id: '1' })).toThrow(/returns a Stream/);
  });
});
