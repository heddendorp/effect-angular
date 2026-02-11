import type { CreateMutationOptions, DefaultError } from '@tanstack/angular-query-experimental';

import { createRpcQueryKey } from './rpc-query-key';
import type { RpcKeyPrefix } from './rpc-query-key';
import type { RpcMutationFn, RpcMutationKey } from './rpc-query-types';

export type RpcMutationMeta = {
  readonly path: readonly string[];
};

export type RpcMutationMetaEnvelope = {
  readonly rpc: RpcMutationMeta;
};

export type RpcMutationOptionsOverrides<TData, TError, TVariables, TOnMutateResult> = Omit<
  CreateMutationOptions<TData, TError, TVariables, TOnMutateResult>,
  'mutationKey' | 'mutationFn'
>;

export type RpcMutationOptionsConfig<TData, TError, TVariables, TOnMutateResult> = {
  readonly pathSegments: readonly string[];
  readonly keyPrefix?: RpcKeyPrefix;
  readonly mutationFn: RpcMutationFn<TData, TVariables, TError, TOnMutateResult>;
  readonly defaults?: RpcMutationOptionsOverrides<TData, TError, TVariables, TOnMutateResult>;
  readonly overrides?: RpcMutationOptionsOverrides<TData, TError, TVariables, TOnMutateResult>;
};

/**
 * Builds TanStack Mutation options for an RPC procedure, merging defaults and overrides.
 */
export const createRpcMutationOptions = <
  TData,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
>(
  config: RpcMutationOptionsConfig<TData, TError, TVariables, TOnMutateResult>,
): CreateMutationOptions<TData, TError, TVariables, TOnMutateResult> => {
  const meta: RpcMutationMetaEnvelope & Record<string, unknown> = {
    ...(config.defaults?.meta ?? {}),
    ...(config.overrides?.meta ?? {}),
    rpc: { path: [...config.pathSegments] },
  };

  return {
    ...config.defaults,
    ...config.overrides,
    mutationKey: createRpcQueryKey(config.pathSegments, {
      keyPrefix: config.keyPrefix,
      type: 'mutation',
    }) as RpcMutationKey,
    mutationFn: config.mutationFn,
    meta,
  };
};
