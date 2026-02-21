import {
  EnvironmentProviders,
  InjectionToken,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import type {
  CreateMutationOptions,
  CreateQueryOptions,
  DefaultError,
  QueryFilters,
} from '@tanstack/angular-query-experimental';
import type * as Rpc from '@effect/rpc/Rpc';
import * as RpcClient from '@effect/rpc/RpcClient';
import type * as RpcClientError from '@effect/rpc/RpcClientError';
import type * as RpcGroup from '@effect/rpc/RpcGroup';
import * as RpcSchema from '@effect/rpc/RpcSchema';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import type * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';

import { createRpcMutationOptions } from './rpc-mutation-options';
import type { RpcMutationOptionsOverrides } from './rpc-mutation-options';
import { createRpcQueryKey } from './rpc-query-key';
import type { RpcKeyPrefix } from './rpc-query-key';
import { createRpcQueryOptions } from './rpc-query-options';
import type { RpcQueryOptionsOverrides } from './rpc-query-options';
import { createRpcPathKey, createRpcQueryFilter } from './rpc-query-path';
import type { RpcPathKey, RpcPathOptions, RpcQueryFilterOptions } from './rpc-query-path';
import type {
  RpcMutationFn,
  RpcMutationKey,
  RpcQueryFn,
  RpcQueryKey,
  RpcQueryKeyType,
} from './rpc-query-types';

export type RpcProcedureKind = 'query' | 'mutation';

const RPC_PROCEDURE_KIND_ANNOTATION = Context.GenericTag<{ readonly kind: RpcProcedureKind }>(
  'effect-angular/RpcProcedureKind',
);

declare const RPC_PROCEDURE_KIND_BRAND: unique symbol;

type RpcProcedureBrand<Kind extends RpcProcedureKind> = {
  readonly [RPC_PROCEDURE_KIND_BRAND]?: Kind;
};

type RpcMarkable = Rpc.Any &
  Rpc.AnyWithProps & {
    readonly annotate: <Identifier, Service>(
      tag: Context.Tag<Identifier, Service>,
      value: Service,
    ) => unknown;
  };

export type RpcQueryProcedure<Current extends Rpc.Any> = Current & RpcProcedureBrand<'query'>;
export type RpcMutationProcedure<Current extends Rpc.Any> = Current & RpcProcedureBrand<'mutation'>;

type RpcProcedureKindOf<Current extends Rpc.Any> =
  Current extends RpcProcedureBrand<infer Kind> ? Kind : 'query';

export const asRpcQuery = <Current extends RpcMarkable>(rpc: Current): RpcQueryProcedure<Current> =>
  rpc.annotate(RPC_PROCEDURE_KIND_ANNOTATION, {
    kind: 'query',
  } as const) as RpcQueryProcedure<Current>;

export const asRpcMutation = <Current extends RpcMarkable>(
  rpc: Current,
): RpcMutationProcedure<Current> =>
  rpc.annotate(RPC_PROCEDURE_KIND_ANNOTATION, {
    kind: 'mutation',
  } as const) as RpcMutationProcedure<Current>;

export type EffectRpcAngularClientQueryDefaults = RpcQueryOptionsOverrides<
  unknown,
  DefaultError,
  unknown,
  RpcQueryKey<unknown>
>;

export type EffectRpcAngularClientMutationDefaults = RpcMutationOptionsOverrides<
  unknown,
  DefaultError,
  unknown,
  unknown
>;

export type EffectRpcAngularClientConfigInput<Rpcs extends Rpc.Any> = {
  readonly group: RpcGroup.RpcGroup<Rpcs>;
  readonly rpcLayer: Layer.Layer<RpcClient.Protocol, never, never>;
  readonly keyPrefix?: RpcKeyPrefix;
  readonly queryDefaults?: EffectRpcAngularClientQueryDefaults;
  readonly mutationDefaults?: EffectRpcAngularClientMutationDefaults;
};

export type EffectRpcAngularClientConfig<Rpcs extends Rpc.Any> = {
  readonly group: RpcGroup.RpcGroup<Rpcs>;
  readonly rpcLayer: Layer.Layer<RpcClient.Protocol, never, never>;
  readonly keyPrefix?: RpcKeyPrefix;
  readonly queryDefaults: EffectRpcAngularClientQueryDefaults;
  readonly mutationDefaults: EffectRpcAngularClientMutationDefaults;
};

export const createEffectRpcAngularClientConfig = <Rpcs extends Rpc.Any>(
  config: EffectRpcAngularClientConfigInput<Rpcs>,
): EffectRpcAngularClientConfig<Rpcs> => ({
  ...config,
  queryDefaults: config.queryDefaults ?? {},
  mutationDefaults: config.mutationDefaults ?? {},
});

type UnionToIntersection<Current> = (
  Current extends unknown ? (arg: Current) => void : never
) extends (arg: infer Intersection) => void
  ? Intersection
  : never;

export type RpcProcedureError<Current extends Rpc.Any> =
  | Rpc.ErrorExit<Current>
  | RpcClientError.RpcClientError;

export type RpcQueryKeyOverrides = {
  readonly keyPrefix?: RpcKeyPrefix;
};

export type RpcQueryOptionsInput<TInput, TQueryFnData, TError, TData> = {
  readonly overrides?: RpcQueryOptionsOverrides<TQueryFnData, TError, TData, RpcQueryKey<TInput>>;
  readonly keyPrefix?: RpcKeyPrefix;
};

export type RpcMutationKeyOverrides = {
  readonly keyPrefix?: RpcKeyPrefix;
};

export type RpcMutationOptionsInput<TQueryFnData, TError, TVariables, TOnMutateResult> = {
  readonly overrides?: RpcMutationOptionsOverrides<
    TQueryFnData,
    TError,
    TVariables,
    TOnMutateResult
  >;
  readonly keyPrefix?: RpcKeyPrefix;
};

type RpcProcedureBaseHelper<Current extends Rpc.Any> = {
  readonly call: (input: Rpc.PayloadConstructor<Current>) => Promise<Rpc.SuccessExit<Current>>;
  readonly callEffect: (
    input: Rpc.PayloadConstructor<Current>,
  ) => Effect.Effect<Rpc.SuccessExit<Current>, RpcProcedureError<Current>, never>;
};

type RpcQueryProcedureHelper<Current extends Rpc.Any> = RpcProcedureBaseHelper<Current> & {
  readonly queryKey: (
    input: Rpc.PayloadConstructor<Current>,
    options?: RpcQueryKeyOverrides,
  ) => RpcQueryKey<Rpc.PayloadConstructor<Current>>;
  readonly queryFn: (
    input: Rpc.PayloadConstructor<Current>,
  ) => RpcQueryFn<Rpc.SuccessExit<Current>, RpcQueryKey<Rpc.PayloadConstructor<Current>>>;
  readonly queryOptions: (
    input: Rpc.PayloadConstructor<Current>,
    options?: RpcQueryOptionsInput<
      Rpc.PayloadConstructor<Current>,
      Rpc.SuccessExit<Current>,
      RpcProcedureError<Current>,
      Rpc.SuccessExit<Current>
    >,
  ) => CreateQueryOptions<
    Rpc.SuccessExit<Current>,
    RpcProcedureError<Current>,
    Rpc.SuccessExit<Current>,
    RpcQueryKey<Rpc.PayloadConstructor<Current>>
  >;
};

type RpcMutationProcedureHelper<Current extends Rpc.Any> = RpcProcedureBaseHelper<Current> & {
  readonly mutationKey: (options?: RpcMutationKeyOverrides) => RpcMutationKey;
  readonly mutationFn: () => RpcMutationFn<
    Rpc.SuccessExit<Current>,
    Rpc.PayloadConstructor<Current>,
    RpcProcedureError<Current>,
    unknown
  >;
  readonly mutationOptions: <TOnMutateResult = unknown>(
    options?: RpcMutationOptionsInput<
      Rpc.SuccessExit<Current>,
      RpcProcedureError<Current>,
      Rpc.PayloadConstructor<Current>,
      TOnMutateResult
    >,
  ) => CreateMutationOptions<
    Rpc.SuccessExit<Current>,
    RpcProcedureError<Current>,
    Rpc.PayloadConstructor<Current>,
    TOnMutateResult
  >;
};

type RpcProcedureHelperFor<Current extends Rpc.Any> =
  RpcProcedureKindOf<Current> extends 'mutation'
    ? RpcMutationProcedureHelper<Current>
    : RpcQueryProcedureHelper<Current>;

type RpcNestedHelpersFromTag<Tag extends string, Helper> = Tag extends `${infer Head}.${infer Tail}`
  ? { readonly [Current in Head]: RpcNestedHelpersFromTag<Tail, Helper> }
  : { readonly [Current in Tag]: Helper };

type RpcNestedHelpersFrom<Rpcs extends Rpc.Any> = UnionToIntersection<
  Rpcs extends Rpc.Any ? RpcNestedHelpersFromTag<Rpcs['_tag'], RpcProcedureHelperFor<Rpcs>> : never
>;

export type EffectRpcAngularClient<Rpcs extends Rpc.Any> = RpcNestedHelpersFrom<Rpcs> & {
  readonly pathKey: (pathSegments: readonly string[], options?: RpcPathOptions) => RpcPathKey;
  readonly queryFilter: (
    pathSegments: readonly string[],
    options?: RpcQueryFilterOptions,
  ) => QueryFilters<RpcPathKey>;
};

export type EffectRpcAngularClientFactory<Rpcs extends Rpc.Any> = {
  readonly token: InjectionToken<EffectRpcAngularClient<Rpcs>>;
  readonly providers: EnvironmentProviders;
  readonly injectClient: () => EffectRpcAngularClient<Rpcs>;
};

const getPathSegments = (tag: string): readonly string[] => tag.split('.');

const resolveKeyPrefix = (
  base: RpcKeyPrefix | undefined,
  override: RpcKeyPrefix | undefined,
): RpcKeyPrefix | undefined => override ?? base;

const getProcedureKind = (rpc: Rpc.AnyWithProps): RpcProcedureKind => {
  const maybeKind = Context.getOption(rpc.annotations, RPC_PROCEDURE_KIND_ANNOTATION);

  if (Option.isSome(maybeKind) && maybeKind.value.kind === 'mutation') {
    return 'mutation';
  }

  return 'query';
};

const createStreamUnsupportedError = (tag: string): Error =>
  new Error(
    `RPC procedure "${tag}" returns a Stream and is not supported by this integration. ` +
      'Use a stream-specific integration path for this procedure.',
  );

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;

const assignNestedHelper = (
  root: Record<string, unknown>,
  pathSegments: readonly string[],
  helper: unknown,
): void => {
  if (pathSegments.length === 0) {
    return;
  }

  if (
    pathSegments.length === 1 &&
    (pathSegments[0] === 'pathKey' || pathSegments[0] === 'queryFilter')
  ) {
    throw new Error(
      `RPC procedure "${pathSegments[0]}" conflicts with a reserved root helper name in EffectRpcAngularClient.`,
    );
  }

  let cursor = root;

  for (let index = 0; index < pathSegments.length - 1; index += 1) {
    const segment = pathSegments[index]!;
    const existing = cursor[segment];

    if (existing === undefined) {
      const next: Record<string, unknown> = {};
      cursor[segment] = next;
      cursor = next;
      continue;
    }

    const existingContainer = asRecord(existing);
    if (!existingContainer) {
      throw new Error(
        `RPC procedure path "${pathSegments.join('.')}" conflicts with an existing non-object helper segment "${segment}".`,
      );
    }

    cursor = existingContainer;
  }

  const leaf = pathSegments[pathSegments.length - 1]!;
  cursor[leaf] = helper;
};

const createProcedureHelper = <Rpcs extends Rpc.Any, Current extends Rpcs>(
  config: EffectRpcAngularClientConfig<Rpcs>,
  group: RpcGroup.RpcGroup<Rpcs>,
  tag: string,
  rpc: Rpc.AnyWithProps,
): RpcProcedureHelperFor<Current> => {
  const pathSegments = getPathSegments(tag);
  const procedureKind = getProcedureKind(rpc);
  const streamUnsupportedError = RpcSchema.isStreamSchema(rpc.successSchema)
    ? createStreamUnsupportedError(tag)
    : undefined;

  const throwIfStreamProcedure = (): void => {
    if (streamUnsupportedError) {
      throw streamUnsupportedError;
    }
  };

  const callEffect = (input: Rpc.PayloadConstructor<Current>) => {
    throwIfStreamProcedure();

    const program = Effect.flatMap(RpcClient.make(group, { flatten: true }), (client) =>
      client(tag as Rpc.Tag<Current>, input),
    ).pipe(Effect.provide(config.rpcLayer), Effect.scoped);

    return program as Effect.Effect<Rpc.SuccessExit<Current>, RpcProcedureError<Current>, never>;
  };

  const call = (input: Rpc.PayloadConstructor<Current>) => Effect.runPromise(callEffect(input));

  const base: RpcProcedureBaseHelper<Current> = { call, callEffect };

  if (procedureKind === 'mutation') {
    const mutationKey = (options?: RpcMutationKeyOverrides) =>
      createRpcQueryKey(pathSegments, {
        keyPrefix: resolveKeyPrefix(config.keyPrefix, options?.keyPrefix),
        type: 'mutation',
      }) as RpcMutationKey;

    const mutationFn = () => async (input: Rpc.PayloadConstructor<Current>) => call(input);

    const mutationOptions = <TOnMutateResult = unknown>(
      options: RpcMutationOptionsInput<
        Rpc.SuccessExit<Current>,
        RpcProcedureError<Current>,
        Rpc.PayloadConstructor<Current>,
        TOnMutateResult
      > = {},
    ) =>
      createRpcMutationOptions({
        pathSegments,
        keyPrefix: resolveKeyPrefix(config.keyPrefix, options.keyPrefix),
        mutationFn: mutationFn() as RpcMutationFn<
          Rpc.SuccessExit<Current>,
          Rpc.PayloadConstructor<Current>,
          RpcProcedureError<Current>,
          TOnMutateResult
        >,
        defaults: config.mutationDefaults as RpcMutationOptionsOverrides<
          Rpc.SuccessExit<Current>,
          RpcProcedureError<Current>,
          Rpc.PayloadConstructor<Current>,
          TOnMutateResult
        >,
        overrides: options.overrides,
      });

    return {
      ...base,
      mutationKey,
      mutationFn,
      mutationOptions,
    } as unknown as RpcProcedureHelperFor<Current>;
  }

  const queryKey = (input: Rpc.PayloadConstructor<Current>, options?: RpcQueryKeyOverrides) =>
    createRpcQueryKey(pathSegments, {
      input,
      keyPrefix: resolveKeyPrefix(config.keyPrefix, options?.keyPrefix),
      type: 'query' satisfies RpcQueryKeyType,
    });

  const queryFn = (input: Rpc.PayloadConstructor<Current>) => () => call(input);

  const queryOptions = (
    input: Rpc.PayloadConstructor<Current>,
    options: RpcQueryOptionsInput<
      Rpc.PayloadConstructor<Current>,
      Rpc.SuccessExit<Current>,
      RpcProcedureError<Current>,
      Rpc.SuccessExit<Current>
    > = {},
  ) =>
    createRpcQueryOptions({
      pathSegments,
      input,
      keyPrefix: resolveKeyPrefix(config.keyPrefix, options.keyPrefix),
      type: 'query',
      queryFn: queryFn(input),
      defaults: config.queryDefaults as RpcQueryOptionsOverrides<
        Rpc.SuccessExit<Current>,
        RpcProcedureError<Current>,
        Rpc.SuccessExit<Current>,
        RpcQueryKey<Rpc.PayloadConstructor<Current>>
      >,
      overrides: options.overrides,
    });

  return {
    ...base,
    queryKey,
    queryFn,
    queryOptions,
  } as unknown as RpcProcedureHelperFor<Current>;
};

const createEffectRpcAngularClientInstance = <Rpcs extends Rpc.Any>(
  config: EffectRpcAngularClientConfig<Rpcs>,
): EffectRpcAngularClient<Rpcs> => {
  const root: Record<string, unknown> = {
    pathKey: (pathSegments: readonly string[], options: RpcPathOptions = {}) =>
      createRpcPathKey(pathSegments, {
        keyPrefix: options.keyPrefix ?? config.keyPrefix,
      }),
    queryFilter: (pathSegments: readonly string[], options: RpcQueryFilterOptions = {}) =>
      createRpcQueryFilter(pathSegments, {
        keyPrefix: options.keyPrefix ?? config.keyPrefix,
        exact: options.exact,
      }),
  };

  for (const [tag, rpc] of config.group.requests.entries()) {
    const helper = createProcedureHelper<Rpcs, Rpcs>(
      config,
      config.group,
      tag,
      rpc as unknown as Rpc.AnyWithProps,
    );
    assignNestedHelper(root, getPathSegments(tag), helper);
  }

  return root as EffectRpcAngularClient<Rpcs>;
};

export const createEffectRpcAngularClient = <Rpcs extends Rpc.Any>(
  input: EffectRpcAngularClientConfigInput<Rpcs>,
): EffectRpcAngularClientFactory<Rpcs> => {
  const config = createEffectRpcAngularClientConfig(input);
  const token = new InjectionToken<EffectRpcAngularClient<Rpcs>>('EFFECT_RPC_ANGULAR_CLIENT');

  const providers = makeEnvironmentProviders([
    {
      provide: token,
      useFactory: () => createEffectRpcAngularClientInstance(config),
    },
  ]);

  const injectClient = () => inject(token);

  return { token, providers, injectClient };
};
