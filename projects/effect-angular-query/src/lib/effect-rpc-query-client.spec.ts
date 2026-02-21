import { TestBed } from '@angular/core/testing';
import { Rpc, RpcClient, RpcGroup } from '@effect/rpc';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';

import {
  asRpcMutation,
  createEffectRpcAngularClient,
  createEffectRpcAngularClientConfig,
} from './effect-rpc-query-client';

const Ping = Rpc.make('Ping', {
  payload: Schema.Struct({ id: Schema.String }),
  success: Schema.Struct({ name: Schema.String }),
});
const Save = Rpc.make('save', {
  payload: Schema.Struct({ id: Schema.String, name: Schema.String }),
  success: Schema.Struct({ ok: Schema.Boolean }),
});
const FinanceReceiptsMy = Rpc.make('finance.receipts.my', {
  payload: Schema.Undefined,
  success: Schema.Struct({ total: Schema.Number }),
});

class AppRpcs extends RpcGroup.make(Ping, asRpcMutation(Save), FinanceReceiptsMy) {}

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

describe('Effect RPC Angular client DI', () => {
  it('fills config defaults when omitted', () => {
    const config = createEffectRpcAngularClientConfig({
      group: AppRpcs,
      rpcLayer: createRpcLayer(),
    });

    expect(config.queryDefaults).toEqual({});
    expect(config.mutationDefaults).toEqual({});
  });

  it('creates providers and injectClient for a typed singleton', () => {
    const rpcClient = createEffectRpcAngularClient({
      group: AppRpcs,
      rpcLayer: createRpcLayer(),
      keyPrefix: 'app',
      queryDefaults: { staleTime: 5000 },
      mutationDefaults: { retry: 1 },
    });

    TestBed.configureTestingModule({
      providers: [rpcClient.providers],
    });

    const first = TestBed.runInInjectionContext(() => rpcClient.injectClient());
    const second = TestBed.runInInjectionContext(() => rpcClient.injectClient());

    expect(first).toBe(second);
    expect(first.Ping.queryKey({ id: '1' })).toEqual([
      ['app', 'Ping'],
      { input: { id: '1' }, type: 'query' },
    ]);
    expect(first.save.mutationKey()).toEqual([['app', 'save'], { type: 'mutation' }]);
    const nestedOptions = first.finance.receipts.my.queryOptions(undefined);
    expect(nestedOptions.meta).toMatchObject({
      rpc: {
        path: ['finance', 'receipts', 'my'],
      },
    });
  });
});
