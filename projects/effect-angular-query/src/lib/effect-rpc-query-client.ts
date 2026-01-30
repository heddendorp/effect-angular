import { EnvironmentProviders, InjectionToken, Injectable, inject, makeEnvironmentProviders } from '@angular/core';
import type { DefaultError } from '@tanstack/angular-query-experimental';
import type * as Rpc from '@effect/rpc/Rpc';
import type * as RpcClient from '@effect/rpc/RpcClient';
import type * as RpcGroup from '@effect/rpc/RpcGroup';
import type * as Layer from 'effect/Layer';

import type { RpcKeyPrefix } from './rpc-query-key';
import type { RpcQueryOptionsOverrides } from './rpc-query-options';
import type { RpcQueryKey } from './rpc-query-types';

export type EffectRpcQueryClientDefaults = RpcQueryOptionsOverrides<
  unknown,
  DefaultError,
  unknown,
  RpcQueryKey<unknown>
>;

export type EffectRpcQueryClientConfigInput<Rpcs extends Rpc.Any> = {
  readonly group: RpcGroup.RpcGroup<Rpcs>;
  readonly rpcLayer: Layer.Layer<RpcClient.Protocol, never, unknown>;
  readonly keyPrefix?: RpcKeyPrefix;
  readonly defaults?: EffectRpcQueryClientDefaults;
};

export type EffectRpcQueryClientConfig<Rpcs extends Rpc.Any> = {
  readonly group: RpcGroup.RpcGroup<Rpcs>;
  readonly rpcLayer: Layer.Layer<RpcClient.Protocol, never, unknown>;
  readonly keyPrefix?: RpcKeyPrefix;
  readonly defaults: EffectRpcQueryClientDefaults;
};

export const EFFECT_RPC_QUERY_CLIENT_CONFIG =
  new InjectionToken<EffectRpcQueryClientConfig<Rpc.Any>>('EFFECT_RPC_QUERY_CLIENT_CONFIG');

/**
 * Normalizes the query client config with default values.
 */
export const createEffectRpcQueryClientConfig = <Rpcs extends Rpc.Any>(
  config: EffectRpcQueryClientConfigInput<Rpcs>,
): EffectRpcQueryClientConfig<Rpcs> => {
  const defaults: EffectRpcQueryClientDefaults = config.defaults ?? {};

  return {
    ...config,
    defaults,
  };
};

/**
 * Registers the Effect RPC query client configuration.
 */
export const provideEffectRpcQueryClient = <Rpcs extends Rpc.Any>(
  config: EffectRpcQueryClientConfigInput<Rpcs>,
): EnvironmentProviders =>
  makeEnvironmentProviders([
    {
      provide: EFFECT_RPC_QUERY_CLIENT_CONFIG,
      useValue: createEffectRpcQueryClientConfig(config),
    },
  ]);

/**
 * Injectable entry point for RPC query helpers.
 */
@Injectable({ providedIn: 'root' })
export class EffectRpcQueryClient {
  readonly config = inject(EFFECT_RPC_QUERY_CLIENT_CONFIG);
}
