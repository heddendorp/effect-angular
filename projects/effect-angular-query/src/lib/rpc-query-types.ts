import type {
  CreateQueryOptions,
  DefaultError,
  QueryFunction,
  QueryKey,
} from '@tanstack/angular-query-experimental';

export type RpcQueryKeyType = 'query' | 'path';

export type RpcQueryKeyMeta<TInput> = {
  readonly input?: TInput;
  readonly type?: RpcQueryKeyType;
};

export type RpcQueryKey<TInput = unknown> = readonly [readonly string[], RpcQueryKeyMeta<TInput>];

export type RpcQueryFn<TQueryFnData = unknown, TQueryKey extends QueryKey = QueryKey> = QueryFunction<
  TQueryFnData,
  TQueryKey
>;

export type RpcQueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = CreateQueryOptions<TQueryFnData, TError, TData, TQueryKey>;
