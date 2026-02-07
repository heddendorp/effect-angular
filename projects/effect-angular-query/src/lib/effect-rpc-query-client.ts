import { EnvironmentProviders, InjectionToken, Injectable, inject, makeEnvironmentProviders } from '@angular/core';
import type {
  CreateQueryOptions,
  DefaultError,
  QueryFilters,
} from '@tanstack/angular-query-experimental';
import type * as Rpc from '@effect/rpc/Rpc';
import * as RpcClient from '@effect/rpc/RpcClient';
import type { RpcClientError } from '@effect/rpc/RpcClientError';
import type * as RpcGroup from '@effect/rpc/RpcGroup';
import * as Effect from 'effect/Effect';
import type * as Layer from 'effect/Layer';

import { createRpcQueryKey } from './rpc-query-key';
import type { RpcKeyPrefix } from './rpc-query-key';
import { createRpcQueryOptions } from './rpc-query-options';
import type { RpcQueryOptionsOverrides } from './rpc-query-options';
import { createRpcPathKey, createRpcQueryFilter } from './rpc-query-path';
import type { RpcPathKey, RpcPathOptions, RpcQueryFilterOptions } from './rpc-query-path';
import type { RpcQueryFn, RpcQueryKey, RpcQueryKeyType } from './rpc-query-types';

export type EffectRpcQueryClientDefaults = RpcQueryOptionsOverrides<
  unknown,
  DefaultError,
  unknown,
  RpcQueryKey<unknown>
>;

export type EffectRpcQueryClientConfigInput<Rpcs extends Rpc.Any> = {
  readonly group: RpcGroup.RpcGroup<Rpcs>;
  readonly rpcLayer: Layer.Layer<RpcClient.Protocol, never, never>;
  readonly keyPrefix?: RpcKeyPrefix;
  readonly defaults?: EffectRpcQueryClientDefaults;
};

export type EffectRpcQueryClientConfig<Rpcs extends Rpc.Any> = {
  readonly group: RpcGroup.RpcGroup<Rpcs>;
  readonly rpcLayer: Layer.Layer<RpcClient.Protocol, never, never>;
  readonly keyPrefix?: RpcKeyPrefix;
  readonly defaults: EffectRpcQueryClientDefaults;
};

type RpcQueryHelperFor<RpcType extends Rpc.Any> = RpcQueryHelper<
  Rpc.PayloadConstructor<RpcType>,
  Rpc.Success<RpcType>,
  Rpc.ErrorExit<RpcType> | RpcClientError
>;

type RpcTag<Rpcs extends Rpc.Any> = Rpc.Tag<Rpcs>;

type RpcPrefix<Tag extends string> = Tag extends `${infer Prefix}.${string}` ? Prefix : never;

type RpcPrefixes<Rpcs extends Rpc.Any> = RpcPrefix<RpcTag<Rpcs>>;

type RpcPrefixed<Rpcs extends Rpc.Any, Prefix extends string> = Extract<
  Rpcs,
  { readonly _tag: `${Prefix}.${string}` }
>;

type RpcNonPrefixed<Rpcs extends Rpc.Any> = Exclude<
  Rpcs,
  { readonly _tag: `${string}.${string}` }
>;

export type RpcQueryKeyOverrides = {
  readonly keyPrefix?: RpcKeyPrefix;
  readonly type?: RpcQueryKeyType;
};

export type RpcQueryOptionsInput<TInput, TQueryFnData, TError, TData> = {
  readonly overrides?: RpcQueryOptionsOverrides<TQueryFnData, TError, TData, RpcQueryKey<TInput>>;
  readonly keyPrefix?: RpcKeyPrefix;
  readonly type?: RpcQueryKeyType;
};

export type RpcQueryHelper<TInput, TQueryFnData, TError> = {
  readonly queryKey: (input: TInput, options?: RpcQueryKeyOverrides) => RpcQueryKey<TInput>;
  readonly queryFn: (input: TInput) => RpcQueryFn<TQueryFnData, RpcQueryKey<TInput>>;
  readonly queryOptions: (
    input: TInput,
    options?: RpcQueryOptionsInput<TInput, TQueryFnData, TError, TQueryFnData>,
  ) => CreateQueryOptions<TQueryFnData, TError, TQueryFnData, RpcQueryKey<TInput>>;
};

type RpcQueryHelpersFrom<Rpcs extends Rpc.Any, Prefix extends string> = {
  readonly [Current in Rpcs as Current['_tag'] extends `${Prefix}.${infer Method}`
    ? Method
    : Current['_tag']]: RpcQueryHelperFor<Current>;
};

export type RpcQueryHelpers<Rpcs extends Rpc.Any> = RpcQueryHelpersFrom<
  RpcNonPrefixed<Rpcs>,
  ''
> & {
  readonly [Prefix in RpcPrefixes<Rpcs>]: RpcQueryHelpersFrom<RpcPrefixed<Rpcs, Prefix>, Prefix>;
};

export const EFFECT_RPC_QUERY_CLIENT_CONFIG: InjectionToken<EffectRpcQueryClientConfig<Rpc.Any>> =
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

const getPathSegments = (tag: string): readonly string[] => tag.split('.');

const resolveKeyPrefix = (
  base: RpcKeyPrefix | undefined,
  overrides: RpcQueryKeyOverrides | undefined,
): RpcKeyPrefix | undefined => overrides?.keyPrefix ?? base;

const createRpcQueryHelpers = <Rpcs extends Rpc.Any>(
  config: EffectRpcQueryClientConfig<Rpcs>,
  group: RpcGroup.RpcGroup<Rpcs>,
): RpcQueryHelpers<Rpcs> => {
  const helpers = new Map<string, RpcQueryHelper<unknown, unknown, DefaultError>>();

  const createHelper = (tag: string): RpcQueryHelper<unknown, unknown, DefaultError> => {
    const pathSegments = getPathSegments(tag);

    const queryKey = (input: unknown, overrides?: RpcQueryKeyOverrides) =>
      createRpcQueryKey(pathSegments, {
        input,
        keyPrefix: resolveKeyPrefix(config.keyPrefix, overrides),
        type: overrides?.type,
      });

    const queryFn = (input: unknown) => {
      const run = () => {
        const program = Effect.flatMap(RpcClient.make(group), (client) => {
          const dotIndex = tag.indexOf('.');
          const root = client as Record<string, unknown>;
          const target =
            dotIndex === -1
              ? root
              : (root[tag.slice(0, dotIndex)] as Record<string, unknown>);
          const key = dotIndex === -1 ? tag : tag.slice(dotIndex + 1);
          // RPC client shape is derived from tag prefixes at runtime.
          const call = target[key] as (payload: unknown) => Effect.Effect<unknown, unknown, unknown>;
          return call(input);
        }).pipe(Effect.provide(config.rpcLayer), Effect.scoped);

        // Rpc middleware requirements are resolved by the configured layer.
        return Effect.runPromise(program as Effect.Effect<unknown, unknown, never>);
      };

      return () => run();
    };

    const queryOptions = (
      input: unknown,
      options: RpcQueryOptionsInput<unknown, unknown, DefaultError, unknown> = {},
    ) =>
      createRpcQueryOptions({
        pathSegments,
        input,
        keyPrefix: resolveKeyPrefix(config.keyPrefix, options),
        type: options.type,
        queryFn: queryFn(input),
        defaults: config.defaults,
        overrides: options.overrides,
      });

    return { queryKey, queryFn, queryOptions };
  };

  const getHelper = (tag: string) => {
    const existing = helpers.get(tag);
    if (existing) {
      return existing;
    }
    const helper = createHelper(tag);
    helpers.set(tag, helper);
    return helper;
  };

  const root: Record<string, unknown> = {};

  for (const tag of group.requests.keys()) {
    const helper = getHelper(tag);
    const dotIndex = tag.indexOf('.');
    if (dotIndex === -1) {
      root[tag] = helper;
      continue;
    }

    const prefix = tag.slice(0, dotIndex);
    const method = tag.slice(dotIndex + 1);
    const existing = root[prefix];
    const container =
      existing && typeof existing === 'object' ? (existing as Record<string, unknown>) : {};
    container[method] = helper;
    root[prefix] = container;
  }

  return root as RpcQueryHelpers<Rpcs>;
};

/**
 * Injectable entry point for RPC query helpers.
 */
@Injectable({ providedIn: 'root' })
export class EffectRpcQueryClient {
  readonly config: EffectRpcQueryClientConfig<Rpc.Any> = inject(EFFECT_RPC_QUERY_CLIENT_CONFIG);

  helpersFor<Rpcs extends Rpc.Any>(group: RpcGroup.RpcGroup<Rpcs>): RpcQueryHelpers<Rpcs> {
    // Config is bound to the same RPC group at runtime via DI.
    const config = this.config as unknown as EffectRpcQueryClientConfig<Rpcs>;
    return createRpcQueryHelpers(config, group);
  }

  pathKey(pathSegments: readonly string[], options: RpcPathOptions = {}): RpcPathKey {
    return createRpcPathKey(pathSegments, {
      keyPrefix: options.keyPrefix ?? this.config.keyPrefix,
    });
  }

  queryFilter(
    pathSegments: readonly string[],
    options: RpcQueryFilterOptions = {},
  ): QueryFilters<RpcPathKey> {
    return createRpcQueryFilter(pathSegments, {
      keyPrefix: options.keyPrefix ?? this.config.keyPrefix,
      exact: options.exact,
    });
  }
}
