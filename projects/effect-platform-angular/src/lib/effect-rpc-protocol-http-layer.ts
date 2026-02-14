import { EnvironmentProviders, InjectionToken, inject, makeEnvironmentProviders } from '@angular/core';
import { HttpClient as EffectHttpClient } from '@effect/platform';
import * as RpcClient from '@effect/rpc/RpcClient';
import * as RpcSerialization from '@effect/rpc/RpcSerialization';
import * as Layer from 'effect/Layer';

import { EFFECT_HTTP_CLIENT } from './effect-http-client';

export type EffectRpcHttpLayerOptions = {
  readonly url: string | (() => string);
  readonly serializationLayer?: Layer.Layer<RpcSerialization.RpcSerialization, never, never>;
};

export const EFFECT_RPC_PROTOCOL_HTTP_LAYER: InjectionToken<
  Layer.Layer<RpcClient.Protocol, never, never>
> = new InjectionToken<Layer.Layer<RpcClient.Protocol, never, never>>(
  'EFFECT_RPC_PROTOCOL_HTTP_LAYER',
);

export const provideEffectRpcProtocolHttpLayer = (
  options: EffectRpcHttpLayerOptions,
): EnvironmentProviders =>
  makeEnvironmentProviders([
    {
      provide: EFFECT_RPC_PROTOCOL_HTTP_LAYER,
      useFactory: (): Layer.Layer<RpcClient.Protocol, never, never> => {
        const client = inject(EFFECT_HTTP_CLIENT);
        const serializationLayer = options.serializationLayer ?? RpcSerialization.layerJson;
        const url = typeof options.url === 'function' ? options.url() : options.url;

        return RpcClient.layerProtocolHttp({ url }).pipe(
          Layer.provide([
            serializationLayer,
            Layer.succeed(EffectHttpClient.HttpClient, client),
          ]),
        );
      },
    },
  ]);
