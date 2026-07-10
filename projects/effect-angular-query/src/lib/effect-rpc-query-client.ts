import {
  DestroyRef,
  EnvironmentProviders,
  InjectionToken,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import type { CreateMutationOptions, QueryFilters } from '@tanstack/angular-query-experimental';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import {
  Rpc,
  RpcClient,
  type RpcClientError,
  type RpcGroup,
  type RpcMiddleware,
  RpcSchema,
} from 'effect/unstable/rpc';

import { createRpcMutationOptions } from './rpc-mutation-options';
import type { RpcMutationOptionsOverrides } from './rpc-mutation-options';
import { createRpcQueryKey } from './rpc-query-key';
import type { RpcKeyPrefix, RpcQueryInputEncoder } from './rpc-query-key';
import { createRpcQueryOptions } from './rpc-query-options';
import type {
  RpcDefinedQueryOptions,
  RpcDefinedQueryOptionsOverrides,
  RpcQueryOptionsOverrides,
  RpcUndefinedQueryOptions,
  RpcUndefinedQueryOptionsOverrides,
} from './rpc-query-options';
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

const RPC_PROCEDURE_KIND_ANNOTATION = Context.Service<{ readonly kind: RpcProcedureKind }>(
  'effect-angular/RpcProcedureKind',
);

declare const RPC_PROCEDURE_KIND_SCHEMA_BRAND: unique symbol;

type RpcProcedurePayloadMarker<Kind extends RpcProcedureKind, Original extends Schema.Top> = {
  readonly [RPC_PROCEDURE_KIND_SCHEMA_BRAND]: {
    readonly kind: Kind;
    readonly original: Original;
  };
};

type OriginalRpcPayload<Payload extends Schema.Top> =
  Payload extends RpcProcedurePayloadMarker<RpcProcedureKind, infer Original> ? Original : Payload;

type MarkedRpcPayload<
  Payload extends Schema.Top,
  Kind extends RpcProcedureKind,
> = OriginalRpcPayload<Payload> & RpcProcedurePayloadMarker<Kind, OriginalRpcPayload<Payload>>;

type NormalizedRpcPayload<Payload extends Schema.Top | Schema.Struct.Fields> =
  Payload extends Schema.Struct.Fields ? Schema.Struct<Payload> : Payload;

interface MarkedRpcProcedure<
  Tag extends string,
  Payload extends Schema.Top,
  Success extends Schema.Top,
  RpcError extends Schema.Top,
  Middleware extends RpcMiddleware.AnyService,
  Requires,
  Kind extends RpcProcedureKind,
> extends Rpc.Rpc<Tag, MarkedRpcPayload<Payload, Kind>, Success, RpcError, Middleware, Requires> {
  readonly setSuccess: <NextSuccess extends Schema.Top>(
    schema: NextSuccess,
  ) => MarkedRpcProcedure<Tag, Payload, NextSuccess, RpcError, Middleware, Requires, Kind>;
  readonly setError: <NextError extends Schema.Top>(
    schema: NextError,
  ) => MarkedRpcProcedure<Tag, Payload, Success, NextError, Middleware, Requires, Kind>;
  setPayload<NextPayload extends Schema.Top | Schema.Struct.Fields>(
    schema: NextPayload,
  ): MarkedRpcProcedure<
    Tag,
    NormalizedRpcPayload<NextPayload>,
    Success,
    RpcError,
    Middleware,
    Requires,
    Kind
  >;
  setPayload<NextPayload extends Schema.Top | Schema.Struct.Fields>(
    schema: NextPayload,
  ): Rpc.Rpc<Tag, NormalizedRpcPayload<NextPayload>, Success, RpcError, Middleware, Requires>;
  readonly middleware: <NextMiddleware extends RpcMiddleware.AnyService>(
    middleware: NextMiddleware,
  ) => MarkedRpcProcedure<
    Tag,
    Payload,
    Success,
    RpcError,
    Middleware | NextMiddleware,
    RpcMiddleware.ApplyServices<NextMiddleware['Identifier'], Requires>,
    Kind
  >;
  readonly prefix: <const Prefix extends string>(
    prefix: Prefix,
  ) => MarkedRpcProcedure<
    `${Prefix}${Tag}`,
    Payload,
    Success,
    RpcError,
    Middleware,
    Requires,
    Kind
  >;
  readonly annotate: <Identifier, Service>(
    tag: Context.Key<Identifier, Service>,
    value: NoInfer<Service>,
  ) => MarkedRpcProcedure<Tag, Payload, Success, RpcError, Middleware, Requires, Kind>;
  readonly annotateMerge: <Identifier>(
    annotations: Context.Context<Identifier>,
  ) => MarkedRpcProcedure<Tag, Payload, Success, RpcError, Middleware, Requires, Kind>;
}

type MarkRpcProcedure<Current extends Rpc.Any, Kind extends RpcProcedureKind> =
  Current extends Rpc.Rpc<
    infer Tag,
    infer Payload,
    infer Success,
    infer RpcError,
    infer Middleware,
    infer Requires
  >
    ? MarkedRpcProcedure<
        Tag,
        OriginalRpcPayload<Payload>,
        Success,
        RpcError,
        Middleware,
        Requires,
        Kind
      >
    : never;

type RpcProcedureWithIntent = Rpc.Any & {
  readonly payloadSchema: Schema.Top & {
    readonly [RPC_PROCEDURE_KIND_SCHEMA_BRAND]: {
      readonly kind: RpcProcedureKind;
    };
  };
};

type RpcMarkable = Rpc.Any & {
  readonly annotate: <Identifier, Service>(
    tag: Context.Key<Identifier, Service>,
    value: Service,
  ) => unknown;
};

export type RpcQueryProcedure<Current extends Rpc.Any> = MarkRpcProcedure<Current, 'query'>;
export type RpcMutationProcedure<Current extends Rpc.Any> = MarkRpcProcedure<Current, 'mutation'>;

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

type NonFunction<Current> = Current extends (...args: infer _Args) => infer _Return
  ? never
  : Current;

type HeterogeneousQueryOptions = RpcQueryOptionsOverrides<
  unknown,
  unknown,
  unknown,
  RpcQueryKey<unknown>
>;

type SafeQueryDefaultKey =
  | 'enabled'
  | 'staleTime'
  | 'refetchInterval'
  | 'refetchIntervalInBackground'
  | 'refetchOnWindowFocus'
  | 'refetchOnReconnect'
  | 'refetchOnMount'
  | 'retryOnMount'
  | 'notifyOnChangeProps'
  | 'throwOnError'
  | 'retry'
  | 'retryDelay'
  | 'networkMode'
  | 'gcTime'
  | 'initialDataUpdatedAt'
  | 'structuralSharing'
  | 'meta'
  | 'experimental_prefetchInRender';

export type EffectRpcAngularClientQueryDefaults = {
  readonly [Key in SafeQueryDefaultKey]?: NonFunction<HeterogeneousQueryOptions[Key]>;
};

type HeterogeneousMutationOptions = RpcMutationOptionsOverrides<unknown, unknown, unknown, unknown>;

type SafeMutationDefaultKey =
  'retry' | 'retryDelay' | 'networkMode' | 'gcTime' | 'meta' | 'scope' | 'throwOnError';

export type EffectRpcAngularClientMutationDefaults = {
  readonly [Key in SafeMutationDefaultKey]?: NonFunction<HeterogeneousMutationOptions[Key]>;
};

export type EffectRpcAngularClientLayerServices<Rpcs extends Rpc.Any> =
  RpcClient.Protocol | Rpc.MiddlewareClient<Rpcs> | Rpc.ServicesClient<Rpcs>;

export type EffectRpcAngularClientConfigInput<
  Rpcs extends RpcProcedureWithIntent,
  LayerError = never,
> = {
  readonly group: RpcGroup.RpcGroup<Rpcs>;
  readonly rpcLayer: Layer.Layer<EffectRpcAngularClientLayerServices<Rpcs>, LayerError, never>;
  readonly keyPrefix?: RpcKeyPrefix;
  readonly queryDefaults?: EffectRpcAngularClientQueryDefaults;
  readonly mutationDefaults?: EffectRpcAngularClientMutationDefaults;
};

export type EffectRpcAngularClientConfig<
  Rpcs extends RpcProcedureWithIntent,
  LayerError = never,
> = {
  readonly group: RpcGroup.RpcGroup<Rpcs>;
  readonly rpcLayer: Layer.Layer<EffectRpcAngularClientLayerServices<Rpcs>, LayerError, never>;
  readonly keyPrefix?: RpcKeyPrefix;
  readonly queryDefaults: EffectRpcAngularClientQueryDefaults;
  readonly mutationDefaults: EffectRpcAngularClientMutationDefaults;
};

export const createEffectRpcAngularClientConfig = <
  Rpcs extends RpcProcedureWithIntent,
  LayerError = never,
>(
  config: EffectRpcAngularClientConfigInput<Rpcs, LayerError>,
): EffectRpcAngularClientConfig<Rpcs, LayerError> => ({
  ...config,
  queryDefaults: config.queryDefaults ?? {},
  mutationDefaults: config.mutationDefaults ?? {},
});

type UnionToIntersection<Current> = (
  Current extends unknown ? (arg: Current) => void : never
) extends (arg: infer Intersection) => void
  ? Intersection
  : never;

type RpcMiddlewareClientError<Current extends Rpc.Any> =
  Current extends Rpc.Rpc<
    infer _Tag,
    infer _Payload,
    infer _Success,
    infer _RpcError,
    infer Middleware,
    infer _Requires
  >
    ? Middleware['~ClientError']
    : never;

export class RpcStreamUnsupportedError extends Schema.TaggedErrorClass<RpcStreamUnsupportedError>()(
  'RpcStreamUnsupportedError',
  {
    procedureTag: Schema.String,
    message: Schema.String,
  },
) {}

export type RpcProcedureError<Current extends Rpc.Any, LayerError = never> =
  | Rpc.ErrorExit<Current>
  | RpcMiddlewareClientError<Current>
  | RpcClientError.RpcClientError
  | RpcStreamUnsupportedError
  | LayerError;

export type RpcCallOptions = {
  readonly signal?: AbortSignal;
};

export type RpcQueryKeyOverrides<TInput = unknown> = {
  readonly keyPrefix?: RpcKeyPrefix;
  readonly inputEncoder?: RpcQueryInputEncoder<TInput>;
};

export type RpcQueryOptionsInput<TInput, TQueryFnData, TError, TData> = {
  readonly overrides?: RpcUndefinedQueryOptionsOverrides<
    TQueryFnData,
    TError,
    TData,
    RpcQueryKey<TInput>
  >;
  readonly keyPrefix?: RpcKeyPrefix;
  readonly inputEncoder?: RpcQueryInputEncoder<TInput>;
};

export type RpcDefinedQueryOptionsInput<TInput, TQueryFnData, TError, TData> = {
  readonly overrides: RpcDefinedQueryOptionsOverrides<
    TQueryFnData,
    TError,
    TData,
    RpcQueryKey<TInput>
  >;
  readonly keyPrefix?: RpcKeyPrefix;
  readonly inputEncoder?: RpcQueryInputEncoder<TInput>;
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

type RpcProcedureBaseHelper<Current extends Rpc.Any, LayerError> = {
  readonly call: (
    input: Rpc.PayloadConstructor<Current>,
    options?: RpcCallOptions,
  ) => Promise<Rpc.SuccessExit<Current>>;
  readonly callEffect: (
    input: Rpc.PayloadConstructor<Current>,
  ) => Effect.Effect<Rpc.SuccessExit<Current>, RpcProcedureError<Current, LayerError>, never>;
};

type RpcQueryProcedureHelper<Current extends Rpc.Any, LayerError> = RpcProcedureBaseHelper<
  Current,
  LayerError
> & {
  readonly queryKey: (
    input: Rpc.PayloadConstructor<Current>,
    options?: RpcQueryKeyOverrides<Rpc.PayloadConstructor<Current>>,
  ) => RpcQueryKey<Rpc.PayloadConstructor<Current>>;
  readonly queryFn: (
    input: Rpc.PayloadConstructor<Current>,
  ) => RpcQueryFn<Rpc.SuccessExit<Current>, RpcQueryKey<Rpc.PayloadConstructor<Current>>>;
  readonly queryOptions: {
    <TData = Rpc.SuccessExit<Current>>(
      input: Rpc.PayloadConstructor<Current>,
      options: RpcDefinedQueryOptionsInput<
        Rpc.PayloadConstructor<Current>,
        Rpc.SuccessExit<Current>,
        RpcProcedureError<Current, LayerError>,
        TData
      >,
    ): RpcDefinedQueryOptions<
      Rpc.PayloadConstructor<Current>,
      Rpc.SuccessExit<Current>,
      RpcProcedureError<Current, LayerError>,
      TData
    >;
    <TData = Rpc.SuccessExit<Current>>(
      input: Rpc.PayloadConstructor<Current>,
      options?: RpcQueryOptionsInput<
        Rpc.PayloadConstructor<Current>,
        Rpc.SuccessExit<Current>,
        RpcProcedureError<Current, LayerError>,
        TData
      >,
    ): RpcUndefinedQueryOptions<
      Rpc.PayloadConstructor<Current>,
      Rpc.SuccessExit<Current>,
      RpcProcedureError<Current, LayerError>,
      TData
    >;
  };
};

type RpcMutationProcedureHelper<Current extends Rpc.Any, LayerError> = RpcProcedureBaseHelper<
  Current,
  LayerError
> & {
  readonly mutationKey: (options?: RpcMutationKeyOverrides) => RpcMutationKey;
  readonly mutationFn: () => RpcMutationFn<
    Rpc.SuccessExit<Current>,
    Rpc.PayloadConstructor<Current>,
    RpcProcedureError<Current, LayerError>,
    unknown
  >;
  readonly mutationOptions: <TOnMutateResult = unknown>(
    options?: RpcMutationOptionsInput<
      Rpc.SuccessExit<Current>,
      RpcProcedureError<Current, LayerError>,
      Rpc.PayloadConstructor<Current>,
      TOnMutateResult
    >,
  ) => CreateMutationOptions<
    Rpc.SuccessExit<Current>,
    RpcProcedureError<Current, LayerError>,
    Rpc.PayloadConstructor<Current>,
    TOnMutateResult
  >;
};

type RpcProcedureKindOf<Current extends Rpc.Any> = Current extends {
  readonly payloadSchema: {
    readonly [RPC_PROCEDURE_KIND_SCHEMA_BRAND]: { readonly kind: infer Kind };
  };
}
  ? Extract<Kind, RpcProcedureKind>
  : never;

type RpcProcedureHelperFor<Current extends Rpc.Any, LayerError> =
  RpcProcedureKindOf<Current> extends 'mutation'
    ? RpcMutationProcedureHelper<Current, LayerError>
    : RpcQueryProcedureHelper<Current, LayerError>;

type RpcNestedHelpersFromTag<Tag extends string, Helper> = Tag extends `${infer Head}.${infer Tail}`
  ? { readonly [Current in Head]: RpcNestedHelpersFromTag<Tail, Helper> }
  : { readonly [Current in Tag]: Helper };

type RpcNestedHelpersFrom<Rpcs extends Rpc.Any, LayerError> = UnionToIntersection<
  Rpcs extends Rpc.Any
    ? RpcNestedHelpersFromTag<Rpcs['_tag'], RpcProcedureHelperFor<Rpcs, LayerError>>
    : never
>;

export type EffectRpcAngularClient<Rpcs extends Rpc.Any, LayerError = never> = RpcNestedHelpersFrom<
  Rpcs,
  LayerError
> & {
  readonly pathKey: (pathSegments: readonly string[], options?: RpcPathOptions) => RpcPathKey;
  readonly queryFilter: (
    pathSegments: readonly string[],
    options?: RpcQueryFilterOptions,
  ) => QueryFilters<RpcPathKey>;
};

export type EffectRpcAngularClientFactory<
  Rpcs extends RpcProcedureWithIntent,
  LayerError = never,
> = {
  readonly token: InjectionToken<EffectRpcAngularClient<Rpcs, LayerError>>;
  readonly providers: EnvironmentProviders;
  readonly injectClient: () => EffectRpcAngularClient<Rpcs, LayerError>;
};

const getPathSegments = (tag: string): readonly string[] => tag.split('.');

const resolveKeyPrefix = (
  base: RpcKeyPrefix | undefined,
  override: RpcKeyPrefix | undefined,
): RpcKeyPrefix | undefined => override ?? base;

const getProcedureKind = (rpc: Rpc.AnyWithProps): RpcProcedureKind | undefined => {
  const maybeKind = Context.getOption(rpc.annotations, RPC_PROCEDURE_KIND_ANNOTATION);
  return Option.isSome(maybeKind) ? maybeKind.value.kind : undefined;
};

const createStreamUnsupportedError = (tag: string): RpcStreamUnsupportedError =>
  new RpcStreamUnsupportedError({
    procedureTag: tag,
    message:
      `RPC procedure "${tag}" returns a Stream and is not supported by this integration. ` +
      'Use a stream-specific integration path for this procedure.',
  });

const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const RESERVED_ROOT_HELPERS = new Set(['pathKey', 'queryFilter']);

type RpcPathTrieNode = {
  readonly children: Map<string, RpcPathTrieNode>;
  procedureTag?: string;
};

const makeTrieNode = (): RpcPathTrieNode => ({ children: new Map() });

const findProcedureTag = (node: RpcPathTrieNode): string | undefined => {
  if (node.procedureTag) {
    return node.procedureTag;
  }

  for (const child of node.children.values()) {
    const tag = findProcedureTag(child);
    if (tag) {
      return tag;
    }
  }

  return undefined;
};

const validateRpcGroup = <Rpcs extends Rpc.Any>(group: RpcGroup.RpcGroup<Rpcs>): void => {
  const trie = makeTrieNode();
  const entries = [...group.requests.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );

  for (const [tag, rpc] of entries) {
    if (!getProcedureKind(rpc as unknown as Rpc.AnyWithProps)) {
      throw new Error(
        `RPC procedure "${tag}" has no explicit intent. Wrap it with asRpcQuery(...) or asRpcMutation(...).`,
      );
    }

    const pathSegments = getPathSegments(tag);
    if (pathSegments.some((segment) => segment.length === 0)) {
      throw new Error(`RPC procedure "${tag}" contains an empty path segment.`);
    }

    if (RESERVED_ROOT_HELPERS.has(pathSegments[0]!)) {
      throw new Error(
        `RPC procedure "${tag}" conflicts with the reserved root helper "${pathSegments[0]}".`,
      );
    }

    for (const segment of pathSegments) {
      if (FORBIDDEN_PATH_SEGMENTS.has(segment)) {
        throw new Error(`RPC procedure "${tag}" contains forbidden path segment "${segment}".`);
      }
    }

    let cursor = trie;
    for (const segment of pathSegments) {
      if (cursor.procedureTag) {
        throw new Error(
          `RPC procedure tags "${cursor.procedureTag}" and "${tag}" conflict because one is a prefix of the other.`,
        );
      }

      let child = cursor.children.get(segment);
      if (!child) {
        child = makeTrieNode();
        cursor.children.set(segment, child);
      }
      cursor = child;
    }

    const descendantTag = findProcedureTag(cursor);
    if (descendantTag) {
      throw new Error(
        `RPC procedure tags "${tag}" and "${descendantTag}" conflict because one is a prefix of the other.`,
      );
    }
    cursor.procedureTag = tag;
  }
};

const makeNamespace = (): Record<string, unknown> => Object.create(null) as Record<string, unknown>;

const assignNestedHelper = (
  root: Record<string, unknown>,
  pathSegments: readonly string[],
  helper: unknown,
): void => {
  let cursor = root;

  for (let index = 0; index < pathSegments.length - 1; index += 1) {
    const segment = pathSegments[index]!;
    if (!Object.hasOwn(cursor, segment)) {
      cursor[segment] = makeNamespace();
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }

  cursor[pathSegments[pathSegments.length - 1]!] = helper;
};

type RpcProcedureExecutor<Rpcs extends Rpc.Any, LayerError> = <Current extends Rpcs>(
  tag: Rpc.Tag<Current>,
  input: Rpc.PayloadConstructor<Current>,
) => Effect.Effect<Rpc.SuccessExit<Current>, RpcProcedureError<Current, LayerError>, never>;

const createProcedureHelper = <
  Rpcs extends RpcProcedureWithIntent,
  Current extends Rpcs,
  LayerError,
>(
  config: EffectRpcAngularClientConfig<Rpcs, LayerError>,
  tag: Rpc.Tag<Current>,
  rpc: Rpc.AnyWithProps,
  execute: RpcProcedureExecutor<Rpcs, LayerError>,
): RpcProcedureHelperFor<Current, LayerError> => {
  const pathSegments = getPathSegments(tag);
  const procedureKind = getProcedureKind(rpc);
  const streamUnsupportedError = RpcSchema.isStreamSchema(rpc.successSchema)
    ? createStreamUnsupportedError(tag)
    : undefined;

  if (!procedureKind) {
    throw new Error(`RPC procedure "${tag}" has no explicit intent.`);
  }

  const callEffect = (
    input: Rpc.PayloadConstructor<Current>,
  ): Effect.Effect<Rpc.SuccessExit<Current>, RpcProcedureError<Current, LayerError>, never> =>
    streamUnsupportedError ? Effect.fail(streamUnsupportedError) : execute(tag, input);

  const call = (input: Rpc.PayloadConstructor<Current>, options?: RpcCallOptions) =>
    options?.signal?.aborted
      ? Effect.runPromise(Effect.interrupt, options)
      : Effect.runPromise(callEffect(input), options);

  const base: RpcProcedureBaseHelper<Current, LayerError> = { call, callEffect };

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
        RpcProcedureError<Current, LayerError>,
        Rpc.PayloadConstructor<Current>,
        TOnMutateResult
      > = {},
    ) =>
      createRpcMutationOptions({
        pathSegments,
        keyPrefix: resolveKeyPrefix(config.keyPrefix, options.keyPrefix),
        mutationFn: mutationFn(),
        defaults: config.mutationDefaults,
        overrides: options.overrides,
      });

    return {
      ...base,
      mutationKey,
      mutationFn,
      mutationOptions,
    } as RpcProcedureHelperFor<Current, LayerError>;
  }

  const queryKey = (
    input: Rpc.PayloadConstructor<Current>,
    options?: RpcQueryKeyOverrides<Rpc.PayloadConstructor<Current>>,
  ) =>
    createRpcQueryKey(pathSegments, {
      input,
      inputEncoder: options?.inputEncoder,
      keyPrefix: resolveKeyPrefix(config.keyPrefix, options?.keyPrefix),
      type: 'query' satisfies RpcQueryKeyType,
    });

  const queryFn =
    (
      input: Rpc.PayloadConstructor<Current>,
    ): ReturnType<RpcQueryProcedureHelper<Current, LayerError>['queryFn']> =>
    (context) =>
      call(input, { signal: context.signal });

  function queryOptions<TData = Rpc.SuccessExit<Current>>(
    input: Rpc.PayloadConstructor<Current>,
    options: RpcDefinedQueryOptionsInput<
      Rpc.PayloadConstructor<Current>,
      Rpc.SuccessExit<Current>,
      RpcProcedureError<Current, LayerError>,
      TData
    >,
  ): RpcDefinedQueryOptions<
    Rpc.PayloadConstructor<Current>,
    Rpc.SuccessExit<Current>,
    RpcProcedureError<Current, LayerError>,
    TData
  >;
  function queryOptions<TData = Rpc.SuccessExit<Current>>(
    input: Rpc.PayloadConstructor<Current>,
    options?: RpcQueryOptionsInput<
      Rpc.PayloadConstructor<Current>,
      Rpc.SuccessExit<Current>,
      RpcProcedureError<Current, LayerError>,
      TData
    >,
  ): RpcUndefinedQueryOptions<
    Rpc.PayloadConstructor<Current>,
    Rpc.SuccessExit<Current>,
    RpcProcedureError<Current, LayerError>,
    TData
  >;
  function queryOptions<TData = Rpc.SuccessExit<Current>>(
    input: Rpc.PayloadConstructor<Current>,
    options: {
      readonly overrides?: RpcQueryOptionsOverrides<
        Rpc.SuccessExit<Current>,
        RpcProcedureError<Current, LayerError>,
        TData,
        RpcQueryKey<Rpc.PayloadConstructor<Current>>
      >;
      readonly keyPrefix?: RpcKeyPrefix;
      readonly inputEncoder?: RpcQueryInputEncoder<Rpc.PayloadConstructor<Current>>;
    } = {},
  ):
    | RpcDefinedQueryOptions<
        Rpc.PayloadConstructor<Current>,
        Rpc.SuccessExit<Current>,
        RpcProcedureError<Current, LayerError>,
        TData
      >
    | RpcUndefinedQueryOptions<
        Rpc.PayloadConstructor<Current>,
        Rpc.SuccessExit<Current>,
        RpcProcedureError<Current, LayerError>,
        TData
      > {
    return createRpcQueryOptions({
      pathSegments,
      input,
      inputEncoder: options.inputEncoder,
      keyPrefix: resolveKeyPrefix(config.keyPrefix, options.keyPrefix),
      type: 'query',
      queryFn: queryFn(input),
      defaults: config.queryDefaults,
      overrides: options.overrides,
    });
  }

  return {
    ...base,
    queryKey,
    queryFn,
    queryOptions,
  } as RpcProcedureHelperFor<Current, LayerError>;
};

let rpcClientServiceId = 0;

const createEffectRpcAngularClientInstance = <Rpcs extends RpcProcedureWithIntent, LayerError>(
  config: EffectRpcAngularClientConfig<Rpcs, LayerError>,
  destroyRef: DestroyRef,
): EffectRpcAngularClient<Rpcs, LayerError> => {
  type FlatClient = RpcClient.RpcClient.Flat<Rpcs, RpcClientError.RpcClientError>;

  const ClientService = Context.Service<FlatClient>(
    `effect-angular/RpcClient/${rpcClientServiceId++}`,
  );
  const clientLayer = Layer.effect(
    ClientService,
    RpcClient.make(config.group, { flatten: true }),
  ).pipe(Layer.provideMerge(config.rpcLayer));
  const runtime = ManagedRuntime.make(clientLayer);

  let disposed = false;
  destroyRef.onDestroy(() => {
    if (!disposed) {
      disposed = true;
      void runtime.dispose();
    }
  });

  const execute: RpcProcedureExecutor<Rpcs, LayerError> = <Current extends Rpcs>(
    tag: Rpc.Tag<Current>,
    input: Rpc.PayloadConstructor<Current>,
  ) => {
    const program = Effect.flatMap(ClientService, (client) => {
      const unaryClient = client as RpcClient.RpcClient.Flat<
        Current,
        RpcClientError.RpcClientError
      >;
      return unaryClient(tag, input) as Effect.Effect<
        Rpc.SuccessExit<Current>,
        RpcProcedureError<Current>,
        Rpc.ServicesClient<Current>
      >;
    });

    return Effect.flatMap(runtime.contextEffect, (context) =>
      Effect.provideContext(program, context),
    );
  };

  const root = makeNamespace();
  root['pathKey'] = (pathSegments: readonly string[], options: RpcPathOptions = {}) =>
    createRpcPathKey(pathSegments, {
      keyPrefix: options.keyPrefix ?? config.keyPrefix,
    });
  root['queryFilter'] = (pathSegments: readonly string[], options: RpcQueryFilterOptions = {}) =>
    createRpcQueryFilter(pathSegments, {
      keyPrefix: options.keyPrefix ?? config.keyPrefix,
      exact: options.exact,
    });

  for (const [tag, rpc] of config.group.requests.entries()) {
    const helper = createProcedureHelper<Rpcs, Rpcs, LayerError>(
      config,
      tag as Rpc.Tag<Rpcs>,
      rpc as unknown as Rpc.AnyWithProps,
      execute,
    );
    assignNestedHelper(root, getPathSegments(tag), helper);
  }

  return root as EffectRpcAngularClient<Rpcs, LayerError>;
};

export const createEffectRpcAngularClient = <
  Rpcs extends RpcProcedureWithIntent,
  LayerError = never,
>(
  input: EffectRpcAngularClientConfigInput<Rpcs, LayerError>,
): EffectRpcAngularClientFactory<Rpcs, LayerError> => {
  const config = createEffectRpcAngularClientConfig(input);
  validateRpcGroup(config.group);

  const token = new InjectionToken<EffectRpcAngularClient<Rpcs, LayerError>>(
    'EFFECT_RPC_ANGULAR_CLIENT',
  );

  const providers = makeEnvironmentProviders([
    {
      provide: token,
      useFactory: () => createEffectRpcAngularClientInstance(config, inject(DestroyRef)),
    },
  ]);

  const injectClient = () => inject(token);

  return { token, providers, injectClient };
};
