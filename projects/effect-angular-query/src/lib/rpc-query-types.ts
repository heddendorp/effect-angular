import type {
  CreateMutationOptions,
  CreateQueryOptions,
  DefaultError,
  MutationKey,
  QueryFunction,
  QueryKey,
} from '@tanstack/angular-query-experimental';
import type { Json } from 'effect/Schema';

declare const RPC_QUERY_INPUT_TYPE: unique symbol;

export type RpcQueryKeyType = 'query' | 'path' | 'mutation';

export type RpcQueryKeyMeta<TInput> = {
  /** Canonical JSON used by TanStack Query's default key hasher. */
  readonly input?: Json;
  readonly type?: RpcQueryKeyType;
  /** Retains the procedure input type without placing the raw value in the key. */
  readonly [RPC_QUERY_INPUT_TYPE]?: TInput;
};

export type RpcQueryKey<TInput = unknown> = readonly [readonly string[], RpcQueryKeyMeta<TInput>];

export type RpcQueryFn<
  TQueryFnData = unknown,
  TQueryKey extends QueryKey = QueryKey,
> = QueryFunction<TQueryFnData, TQueryKey>;

export type RpcQueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = CreateQueryOptions<TQueryFnData, TError, TData, TQueryKey>;

export type RpcMutationKey = readonly [readonly string[], { readonly type: 'mutation' }];

export type RpcMutationFn<
  TData = unknown,
  TVariables = unknown,
  TError = DefaultError,
  TOnMutateResult = unknown,
> = NonNullable<CreateMutationOptions<TData, TError, TVariables, TOnMutateResult>['mutationFn']>;

export type RpcMutationOptions<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
> = CreateMutationOptions<TData, TError, TVariables, TOnMutateResult>;

export type RpcMutationKeyType = MutationKey;
