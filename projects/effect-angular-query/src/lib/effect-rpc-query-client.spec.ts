import { TestBed } from '@angular/core/testing';
import { Rpc, RpcClient, RpcGroup } from '@effect/rpc';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

import {
  EFFECT_RPC_QUERY_CLIENT_CONFIG,
  EffectRpcQueryClient,
  provideEffectRpcQueryClient,
} from './effect-rpc-query-client';

const Ping = Rpc.make('Ping');
class AppRpcs extends RpcGroup.make(Ping) {}

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

describe('EffectRpcQueryClient DI', () => {
  it('fills config defaults when omitted', () => {
    TestBed.configureTestingModule({
      providers: [
        provideEffectRpcQueryClient({
          group: AppRpcs,
          rpcLayer: createRpcLayer(),
        }),
      ],
    });

    const client = TestBed.inject(EffectRpcQueryClient);

    expect(client.config.defaults).toEqual({});
  });

  it('exposes configured values through the config token', () => {
    const rpcLayer = createRpcLayer();

    TestBed.configureTestingModule({
      providers: [
        provideEffectRpcQueryClient({
          group: AppRpcs,
          rpcLayer,
          keyPrefix: 'app',
          defaults: { staleTime: 5000 },
        }),
      ],
    });

    const config = TestBed.inject(EFFECT_RPC_QUERY_CLIENT_CONFIG);

    expect(config.keyPrefix).toBe('app');
    expect(config.defaults.staleTime).toBe(5000);
    expect(config.rpcLayer).toBe(rpcLayer);
  });
});
