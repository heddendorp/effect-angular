import {
  EnvironmentProviders,
  InjectionToken,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { HttpClient as EffectHttpClient } from 'effect/unstable/http';
import { RpcClient, RpcSerialization } from 'effect/unstable/rpc';

import { EFFECT_HTTP_CLIENT } from './effect-http-client';

export type EffectRpcHttpLayerOptions = {
  readonly url: string | (() => string);
  readonly serializationLayer?: Layer.Layer<RpcSerialization.RpcSerialization, never, never>;
};

export class UnsupportedRpcSerializationError extends Data.TaggedError(
  'UnsupportedRpcSerializationError',
)<{
  readonly contentType: string;
}> {
  override get message(): string {
    return `Framed RPC serialization (${this.contentType}) is not supported by Angular HttpClient`;
  }
}

export const EFFECT_RPC_PROTOCOL_HTTP_LAYER: InjectionToken<
  Layer.Layer<RpcClient.Protocol, UnsupportedRpcSerializationError, never>
> = new InjectionToken<Layer.Layer<RpcClient.Protocol, UnsupportedRpcSerializationError, never>>(
  'EFFECT_RPC_PROTOCOL_HTTP_LAYER',
);

const requireUnframedSerialization = (
  serializationLayer: Layer.Layer<RpcSerialization.RpcSerialization, never, never>,
): Layer.Layer<RpcSerialization.RpcSerialization, UnsupportedRpcSerializationError, never> =>
  Layer.effect(
    RpcSerialization.RpcSerialization,
    Effect.gen(function* () {
      const serialization = yield* RpcSerialization.RpcSerialization;
      if (serialization.includesFraming) {
        return yield* new UnsupportedRpcSerializationError({
          contentType: serialization.contentType,
        });
      }
      return serialization;
    }),
  ).pipe(Layer.provide(serializationLayer));

export const provideEffectRpcProtocolHttpLayer = (
  options: EffectRpcHttpLayerOptions,
): EnvironmentProviders =>
  makeEnvironmentProviders([
    {
      provide: EFFECT_RPC_PROTOCOL_HTTP_LAYER,
      useFactory: (): Layer.Layer<RpcClient.Protocol, UnsupportedRpcSerializationError, never> => {
        const client = inject(EFFECT_HTTP_CLIENT);
        const serializationLayer = options.serializationLayer ?? RpcSerialization.layerJson;
        const url = typeof options.url === 'function' ? options.url() : options.url;

        return RpcClient.layerProtocolHttp({ url }).pipe(
          Layer.provide(
            Layer.mergeAll(
              requireUnframedSerialization(serializationLayer),
              Layer.succeed(EffectHttpClient.HttpClient, client),
            ),
          ),
        );
      },
    },
  ]);
