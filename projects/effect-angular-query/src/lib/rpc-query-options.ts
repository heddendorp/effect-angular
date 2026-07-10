import {
  queryOptions,
  type CreateQueryOptions,
  type DataTag,
  type DefaultError,
  type DefinedInitialDataOptions,
  type InitialDataFunction,
  type NonUndefinedGuard,
  type UndefinedInitialDataOptions,
} from '@tanstack/angular-query-experimental';

import { createRpcQueryKey } from './rpc-query-key';
import type { RpcKeyPrefix, RpcQueryInputEncoder } from './rpc-query-key';
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
  readonly inputEncoder?: RpcQueryInputEncoder<TInput>;
  readonly keyPrefix?: RpcKeyPrefix;
  readonly type?: RpcQueryKeyType;
  readonly queryFn: RpcQueryFn<TQueryFnData, RpcQueryKey<TInput>>;
  readonly defaults?: RpcQueryOptionsOverrides<TQueryFnData, TError, TData, RpcQueryKey<TInput>>;
  readonly overrides?: RpcQueryOptionsOverrides<TQueryFnData, TError, TData, RpcQueryKey<TInput>>;
};

export type RpcDefinedQueryOptionsOverrides<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends RpcQueryKey<unknown>,
> = Omit<RpcQueryOptionsOverrides<TQueryFnData, TError, TData, TQueryKey>, 'initialData'> & {
  readonly initialData: NonUndefinedGuard<TQueryFnData> | (() => NonUndefinedGuard<TQueryFnData>);
};

export type RpcUndefinedQueryOptionsOverrides<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends RpcQueryKey<unknown>,
> = Omit<RpcQueryOptionsOverrides<TQueryFnData, TError, TData, TQueryKey>, 'initialData'> & {
  readonly initialData?:
    | undefined
    | InitialDataFunction<NonUndefinedGuard<TQueryFnData>>
    | NonUndefinedGuard<TQueryFnData>;
};

type RpcQueryOptionsOverridesWithoutInitialData<
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends RpcQueryKey<unknown>,
> = Omit<RpcQueryOptionsOverrides<TQueryFnData, TError, TData, TQueryKey>, 'initialData'> & {
  readonly initialData?: never;
};

export type RpcTaggedQueryKey<TInput, TQueryFnData, TError> = DataTag<
  RpcQueryKey<TInput>,
  TQueryFnData,
  TError
>;

export type RpcDefinedQueryOptions<TInput, TQueryFnData, TError, TData> = DefinedInitialDataOptions<
  TQueryFnData,
  TError,
  TData,
  RpcQueryKey<TInput>
> & {
  readonly queryKey: RpcTaggedQueryKey<TInput, TQueryFnData, TError>;
};

export type RpcUndefinedQueryOptions<TInput, TQueryFnData, TError, TData> =
  UndefinedInitialDataOptions<TQueryFnData, TError, TData, RpcQueryKey<TInput>> & {
    readonly queryKey: RpcTaggedQueryKey<TInput, TQueryFnData, TError>;
  };

type RpcDefinedOverridesConfig<TInput, TQueryFnData, TError, TData> = Omit<
  RpcQueryOptionsConfig<TInput, TQueryFnData, TError, TData>,
  'overrides'
> & {
  readonly overrides: RpcDefinedQueryOptionsOverrides<
    TQueryFnData,
    TError,
    TData,
    RpcQueryKey<TInput>
  >;
};

type RpcDefinedDefaultsConfig<TInput, TQueryFnData, TError, TData> = Omit<
  RpcQueryOptionsConfig<TInput, TQueryFnData, TError, TData>,
  'defaults' | 'overrides'
> & {
  readonly defaults: RpcDefinedQueryOptionsOverrides<
    TQueryFnData,
    TError,
    TData,
    RpcQueryKey<TInput>
  >;
  readonly overrides?: RpcQueryOptionsOverridesWithoutInitialData<
    TQueryFnData,
    TError,
    TData,
    RpcQueryKey<TInput>
  >;
};

type RpcUndefinedConfig<TInput, TQueryFnData, TError, TData> = Omit<
  RpcQueryOptionsConfig<TInput, TQueryFnData, TError, TData>,
  'overrides'
> & {
  readonly overrides?: RpcUndefinedQueryOptionsOverrides<
    TQueryFnData,
    TError,
    TData,
    RpcQueryKey<TInput>
  >;
};

/**
 * Builds TanStack Query options for an RPC procedure, merging defaults and overrides.
 */
export function createRpcQueryOptions<
  TInput,
  TQueryFnData,
  TError = DefaultError,
  TData = TQueryFnData,
>(
  config: RpcDefinedOverridesConfig<TInput, TQueryFnData, TError, TData>,
): RpcDefinedQueryOptions<TInput, TQueryFnData, TError, TData>;
export function createRpcQueryOptions<
  TInput,
  TQueryFnData,
  TError = DefaultError,
  TData = TQueryFnData,
>(
  config: RpcDefinedDefaultsConfig<TInput, TQueryFnData, TError, TData>,
): RpcDefinedQueryOptions<TInput, TQueryFnData, TError, TData>;
export function createRpcQueryOptions<
  TInput,
  TQueryFnData,
  TError = DefaultError,
  TData = TQueryFnData,
>(
  config: RpcUndefinedConfig<TInput, TQueryFnData, TError, TData>,
): RpcUndefinedQueryOptions<TInput, TQueryFnData, TError, TData>;
export function createRpcQueryOptions<TInput, TQueryFnData, TError, TData>(
  config: RpcQueryOptionsConfig<TInput, TQueryFnData, TError, TData>,
):
  | RpcDefinedQueryOptions<TInput, TQueryFnData, TError, TData>
  | RpcUndefinedQueryOptions<TInput, TQueryFnData, TError, TData>;
export function createRpcQueryOptions<TInput, TQueryFnData, TError, TData>(
  config: RpcQueryOptionsConfig<TInput, TQueryFnData, TError, TData>,
):
  | RpcDefinedQueryOptions<TInput, TQueryFnData, TError, TData>
  | RpcUndefinedQueryOptions<TInput, TQueryFnData, TError, TData> {
  const meta: RpcQueryMetaEnvelope & Record<string, unknown> = {
    ...(config.defaults?.meta ?? {}),
    ...(config.overrides?.meta ?? {}),
    rpc: { path: [...config.pathSegments] },
  };

  const options = {
    ...config.defaults,
    ...config.overrides,
    queryKey: createRpcQueryKey(config.pathSegments, {
      input: config.input,
      inputEncoder: config.inputEncoder,
      keyPrefix: config.keyPrefix,
      type: config.type,
    }),
    queryFn: config.queryFn,
    meta,
  };

  if (options.initialData !== undefined) {
    return queryOptions(
      options as DefinedInitialDataOptions<TQueryFnData, TError, TData, RpcQueryKey<TInput>>,
    );
  }

  return queryOptions(
    options as UndefinedInitialDataOptions<TQueryFnData, TError, TData, RpcQueryKey<TInput>>,
  );
}
