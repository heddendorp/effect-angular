import type { CreateQueryOptions, DefaultError } from '@tanstack/angular-query-experimental';

import { createRpcQueryKey } from './rpc-query-key';
import type { RpcKeyPrefix } from './rpc-query-key';
import type { RpcQueryFn, RpcQueryKey, RpcQueryKeyType } from './rpc-query-types';

export type RpcQueryMeta = {
  readonly path: readonly string[];
};

export type RpcQueryMetaEnvelope = {
  readonly rpc: RpcQueryMeta;
};

export type RpcQueryOptionsOverrides<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends RpcQueryKey<unknown>,
> = Omit<CreateQueryOptions<TQueryFnData, TError, TData, TQueryKey>, 'queryKey' | 'queryFn'>;

export type RpcQueryOptionsConfig<TInput, TQueryFnData, TError, TData> = {
  readonly pathSegments: readonly string[];
  readonly input?: TInput;
  readonly keyPrefix?: RpcKeyPrefix;
  readonly type?: RpcQueryKeyType;
  readonly queryFn: RpcQueryFn<TQueryFnData, RpcQueryKey<TInput>>;
  readonly defaults?: RpcQueryOptionsOverrides<TQueryFnData, TError, TData, RpcQueryKey<TInput>>;
  readonly overrides?: RpcQueryOptionsOverrides<TQueryFnData, TError, TData, RpcQueryKey<TInput>>;
};

/**
 * Builds TanStack Query options for an RPC procedure, merging defaults and overrides.
 */
export const createRpcQueryOptions = <
  TInput,
  TQueryFnData,
  TError = DefaultError,
  TData = TQueryFnData,
>(
  config: RpcQueryOptionsConfig<TInput, TQueryFnData, TError, TData>,
): CreateQueryOptions<TQueryFnData, TError, TData, RpcQueryKey<TInput>> => {
  const meta: RpcQueryMetaEnvelope & Record<string, unknown> = {
    ...(config.defaults?.meta ?? {}),
    ...(config.overrides?.meta ?? {}),
    rpc: { path: [...config.pathSegments] },
  };

  return {
    ...config.defaults,
    ...config.overrides,
    queryKey: createRpcQueryKey(config.pathSegments, {
      input: config.input,
      keyPrefix: config.keyPrefix,
      type: config.type,
    }),
    queryFn: config.queryFn,
    meta,
  };
};
