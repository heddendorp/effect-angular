import { TestBed } from '@angular/core/testing';
import { QueryClient } from '@tanstack/angular-query-experimental';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import { Rpc, RpcClient, RpcClientError, RpcGroup, RpcMiddleware } from 'effect/unstable/rpc';

import {
  asRpcMutation,
  asRpcQuery,
  createEffectRpcAngularClient,
  type RpcProcedureError,
} from './effect-rpc-query-client';

const createRpcClientError = (message: string): RpcClientError.RpcClientError =>
  new RpcClientError.RpcClientError({
    reason: new RpcClientError.RpcClientDefect({ message, cause: undefined }),
  });

const createProtocolLayer = (
  send: RpcClient.Protocol['Service']['send'] = () =>
    Effect.fail(createRpcClientError('Test transport failure')),
) =>
  Layer.effect(
    RpcClient.Protocol,
    RpcClient.Protocol.make(() =>
      Effect.succeed({
        send,
        supportsAck: false,
        supportsTransferables: false,
      }),
    ),
  );

class AuditMiddleware extends RpcMiddleware.Service<AuditMiddleware>()(
  'effect-angular-query/test/AuditMiddleware',
) {}

const ComposedMutation = asRpcMutation(
  Rpc.make('save', {
    payload: Schema.Struct({ id: Schema.String }),
    success: Schema.Struct({ ok: Schema.Boolean }),
  }),
)
  .middleware(AuditMiddleware)
  .prefix('admin.');

const ReclassifiedQuery = asRpcQuery(
  asRpcMutation(
    Rpc.make('reclassified', {
      payload: Schema.Struct({ id: Schema.String }),
      success: Schema.Struct({ name: Schema.String }),
    }),
  ),
).middleware(AuditMiddleware);

class ComposedRpcsBase extends RpcGroup.make(ComposedMutation, ReclassifiedQuery) {}
class ComposedRpcs extends ComposedRpcsBase.middleware(AuditMiddleware).prefix('v1.') {}

const LifecyclePing = asRpcQuery(
  Rpc.make('lifecycle.ping', {
    payload: Schema.Struct({ id: Schema.String }),
    success: Schema.Struct({ ok: Schema.Boolean }),
  }),
);
class LifecycleRpcs extends RpcGroup.make(LifecyclePing) {}

class CustomPayload {
  constructor(readonly id: string) {}
}

const CustomPayloadQuery = asRpcQuery(
  Rpc.make('custom.lookup', {
    payload: Schema.instanceOf(CustomPayload),
    success: Schema.String,
  }),
);
class CustomPayloadRpcs extends RpcGroup.make(CustomPayloadQuery) {}

class RequiredClientError extends Schema.TaggedErrorClass<RequiredClientError>()(
  'RequiredClientError',
  { message: Schema.String },
) {}

class RequiredClientMiddleware extends RpcMiddleware.Service<
  RequiredClientMiddleware,
  { readonly clientError: RequiredClientError }
>()('effect-angular-query/test/RequiredClientMiddleware', { requiredForClient: true }) {}

const SecuredPing = asRpcQuery(
  Rpc.make('secure.ping', {
    payload: Schema.Struct({ id: Schema.String }),
    success: Schema.Struct({ ok: Schema.Boolean }),
  }).middleware(RequiredClientMiddleware),
);
class SecuredRpcs extends RpcGroup.make(SecuredPing) {}

class CodecService extends Context.Service<
  CodecService,
  { readonly encodingObserved: () => void }
>()('effect-angular-query/test/CodecService') {}

const ServicePayload = Schema.Struct({ id: Schema.String }).pipe(
  Schema.middlewareEncoding((effect) =>
    Effect.gen(function* () {
      const codec = yield* CodecService;
      codec.encodingObserved();
      return yield* effect;
    }),
  ),
);

const ServiceSuccess = Schema.Struct({ ok: Schema.Boolean }).pipe(
  Schema.middlewareDecoding((effect) =>
    Effect.gen(function* () {
      yield* CodecService;
      return yield* effect;
    }),
  ),
);

const ServicePing = asRpcQuery(
  Rpc.make('service.ping', {
    payload: ServicePayload,
    success: ServiceSuccess,
  }),
);
class ServiceRpcs extends RpcGroup.make(ServicePing) {}

class ProtocolLayerError extends Schema.TaggedErrorClass<ProtocolLayerError>()(
  'ProtocolLayerError',
  { message: Schema.String },
) {}

describe('Effect RPC Angular client regressions', () => {
  it('preserves classification through RPC and RpcGroup composition and replaces old intent', () => {
    const factory = createEffectRpcAngularClient({
      group: ComposedRpcs,
      rpcLayer: createProtocolLayer(),
    });
    TestBed.configureTestingModule({ providers: [factory.providers] });
    const client = TestBed.runInInjectionContext(() => factory.injectClient());

    expect(typeof client.v1.admin.save.mutationOptions).toBe('function');
    expect('queryOptions' in client.v1.admin.save).toBe(false);
    expect(typeof client.v1.reclassified.queryOptions).toBe('function');
    expect('mutationOptions' in client.v1.reclassified).toBe(false);

    client.v1.admin.save.mutationOptions();
    client.v1.reclassified.queryOptions({ id: '1' });
    // @ts-expect-error mutation procedures do not expose query helpers
    expect(client.v1.admin.save.queryOptions).toBeUndefined();
    // @ts-expect-error re-marking replaces the old mutation classification
    expect(client.v1.reclassified.mutationOptions).toBeUndefined();
  });

  it('requires explicit procedure intent at compile time and validates it at runtime', () => {
    const Unclassified = Rpc.make('unsafe.deleteAll', {
      payload: Schema.Void,
      success: Schema.Void,
    });
    class UnclassifiedRpcs extends RpcGroup.make(Unclassified) {}

    expect(() =>
      createEffectRpcAngularClient({
        // @ts-expect-error every procedure must use asRpcQuery or asRpcMutation
        group: UnclassifiedRpcs,
        rpcLayer: createProtocolLayer(),
      }),
    ).toThrow(/has no explicit intent/);
  });

  it.each(['__proto__.polluted', 'safe.constructor.value', 'safe.prototype.value'])(
    'rejects prototype-polluting procedure path %s',
    (tag) => {
      const Hostile = asRpcQuery(Rpc.make(tag, { success: Schema.Void }));
      class HostileRpcs extends RpcGroup.make(Hostile) {}

      expect(() =>
        createEffectRpcAngularClient({
          group: HostileRpcs,
          rpcLayer: createProtocolLayer(),
        }),
      ).toThrow(/forbidden path segment/);
      expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
    },
  );

  it('rejects reserved helper and prefix collisions before materializing the client', () => {
    const Reserved = asRpcQuery(Rpc.make('pathKey.child', { success: Schema.Void }));
    class ReservedRpcs extends RpcGroup.make(Reserved) {}

    expect(() =>
      createEffectRpcAngularClient({
        group: ReservedRpcs,
        rpcLayer: createProtocolLayer(),
      }),
    ).toThrow(/reserved root helper/);

    const Parent = asRpcQuery(Rpc.make('finance.receipts', { success: Schema.Void }));
    const Child = asRpcQuery(Rpc.make('finance.receipts.mine', { success: Schema.Void }));
    class CollidingRpcs extends RpcGroup.make(Child, Parent) {}

    expect(() =>
      createEffectRpcAngularClient({
        group: CollidingRpcs,
        rpcLayer: createProtocolLayer(),
      }),
    ).toThrow(/one is a prefix of the other/);
  });

  it('accepts legitimate sibling paths and uses null-prototype namespaces', () => {
    const Mine = asRpcQuery(Rpc.make('finance.receipts.mine', { success: Schema.Void }));
    const Team = asRpcQuery(Rpc.make('finance.receipts.team', { success: Schema.Void }));
    class SiblingRpcs extends RpcGroup.make(Mine, Team) {}
    const factory = createEffectRpcAngularClient({
      group: SiblingRpcs,
      rpcLayer: createProtocolLayer(),
    });
    TestBed.configureTestingModule({ providers: [factory.providers] });
    const client = TestBed.runInInjectionContext(() => factory.injectClient());

    expect(Object.getPrototypeOf(client)).toBeNull();
    expect(Object.getPrototypeOf(client.finance)).toBeNull();
    expect(Object.getPrototypeOf(client.finance.receipts)).toBeNull();
    expect(typeof client.finance.receipts.mine.queryOptions).toBe('function');
    expect(typeof client.finance.receipts.team.queryOptions).toBe('function');
  });

  it('exposes a typed per-call encoder for custom payload query keys and options', () => {
    const factory = createEffectRpcAngularClient({
      group: CustomPayloadRpcs,
      rpcLayer: createProtocolLayer(),
    });
    TestBed.configureTestingModule({ providers: [factory.providers] });
    const client = TestBed.runInInjectionContext(() => factory.injectClient());
    const input = new CustomPayload('custom-1');
    const inputEncoder = (value: CustomPayload) => ({ id: value.id });

    expect(() => client.custom.lookup.queryKey(input)).toThrow(/provide inputEncoder/);
    expect(client.custom.lookup.queryKey(input, { inputEncoder })).toEqual([
      ['custom', 'lookup'],
      { input: { id: 'custom-1' }, type: 'query' },
    ]);
    expect(client.custom.lookup.queryOptions(input, { inputEncoder }).queryKey).toEqual([
      ['custom', 'lookup'],
      { input: { id: 'custom-1' }, type: 'query' },
    ]);
  });

  it('retains one scoped RPC client for the injector lifetime and releases it once', async () => {
    let acquisitions = 0;
    let releases = 0;
    const protocol = RpcClient.Protocol.make(() =>
      Effect.succeed({
        send: () => Effect.fail(createRpcClientError('Expected failure')),
        supportsAck: false,
        supportsTransferables: false,
      }),
    );
    const scopedProtocolLayer = Layer.effect(
      RpcClient.Protocol,
      Effect.acquireRelease(
        Effect.tap(protocol, () => Effect.sync(() => acquisitions++)),
        () => Effect.sync(() => releases++),
      ),
    );
    const factory = createEffectRpcAngularClient({
      group: LifecycleRpcs,
      rpcLayer: scopedProtocolLayer,
    });
    TestBed.configureTestingModule({ providers: [factory.providers] });
    const client = TestBed.runInInjectionContext(() => factory.injectClient());

    await expect(client.lifecycle.ping.call({ id: '1' })).rejects.toBeDefined();
    await expect(client.lifecycle.ping.call({ id: '2' })).rejects.toBeDefined();
    expect(acquisitions).toBe(1);
    expect(releases).toBe(0);

    TestBed.resetTestingModule();
    await vi.waitFor(() => expect(releases).toBe(1));
  });

  it('forwards in-flight and pre-aborted TanStack signals to the RPC fiber', async () => {
    let requests = 0;
    let interrupted = 0;
    const layer = createProtocolLayer((_clientId, request) => {
      if (request._tag !== 'Request') {
        return Effect.void;
      }
      requests += 1;
      return Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(() => interrupted++)));
    });
    const factory = createEffectRpcAngularClient({ group: LifecycleRpcs, rpcLayer: layer });
    TestBed.configureTestingModule({ providers: [factory.providers] });
    const client = TestBed.runInInjectionContext(() => factory.injectClient());

    const controller = new AbortController();
    const queryKey = client.lifecycle.ping.queryKey({ id: '1' });
    const queryPromise = client.lifecycle.ping.queryFn({ id: '1' })({
      client: new QueryClient(),
      queryKey,
      signal: controller.signal,
      meta: undefined,
    });
    await vi.waitFor(() => expect(requests).toBe(1));
    controller.abort();
    await expect(queryPromise).rejects.toBeDefined();
    await vi.waitFor(() => expect(interrupted).toBe(1));

    const preAborted = new AbortController();
    preAborted.abort();
    await expect(
      client.lifecycle.ping.queryFn({ id: '2' })({
        client: new QueryClient(),
        queryKey: client.lifecycle.ping.queryKey({ id: '2' }),
        signal: preAborted.signal,
        meta: undefined,
      }),
    ).rejects.toBeDefined();
    expect(requests).toBe(1);
  });

  it('requires and runs required client middleware while preserving its client error', async () => {
    const clientError = new RequiredClientError({ message: 'Missing client identity' });
    let transportRequests = 0;
    const protocolLayer = createProtocolLayer(() => {
      transportRequests += 1;
      return Effect.void;
    });
    const middlewareLayer = RpcMiddleware.layerClient(RequiredClientMiddleware, () =>
      Effect.fail(clientError),
    );

    const createWithoutRequiredMiddleware = () =>
      createEffectRpcAngularClient({
        group: SecuredRpcs,
        // @ts-expect-error required client middleware must be present in the complete RPC layer
        rpcLayer: createProtocolLayer(),
      });
    expect(createWithoutRequiredMiddleware).toBeTypeOf('function');

    const factory = createEffectRpcAngularClient({
      group: SecuredRpcs,
      rpcLayer: Layer.merge(protocolLayer, middlewareLayer),
    });
    TestBed.configureTestingModule({ providers: [factory.providers] });
    const client = TestBed.runInInjectionContext(() => factory.injectClient());
    const callEffect = client.secure.ping.callEffect({ id: '1' });
    expectTypeOf<RequiredClientError>().toMatchTypeOf<Effect.Error<typeof callEffect>>();

    await expect(Effect.runPromise(callEffect)).rejects.toBe(clientError);
    expect(transportRequests).toBe(0);
  });

  it('requires schema services in the complete layer and uses them for payload encoding', async () => {
    let encodings = 0;

    const createWithoutSchemaServices = () =>
      createEffectRpcAngularClient({
        group: ServiceRpcs,
        // @ts-expect-error payload encoding and success decoding services are required
        rpcLayer: createProtocolLayer(),
      });
    expect(createWithoutSchemaServices).toBeTypeOf('function');

    const factory = createEffectRpcAngularClient({
      group: ServiceRpcs,
      rpcLayer: Layer.merge(
        createProtocolLayer(),
        Layer.succeed(CodecService, { encodingObserved: () => encodings++ }),
      ),
    });
    TestBed.configureTestingModule({ providers: [factory.providers] });
    const client = TestBed.runInInjectionContext(() => factory.injectClient());

    await expect(client.service.ping.call({ id: '1' })).rejects.toBeDefined();
    expect(encodings).toBe(1);
  });

  it('preserves typed layer acquisition failures in callEffect', async () => {
    const layerError = new ProtocolLayerError({ message: 'Protocol unavailable' });
    const factory = createEffectRpcAngularClient({
      group: LifecycleRpcs,
      rpcLayer: Layer.effect(RpcClient.Protocol, Effect.fail(layerError)),
    });
    TestBed.configureTestingModule({ providers: [factory.providers] });
    const client = TestBed.runInInjectionContext(() => factory.injectClient());
    const callEffect = client.lifecycle.ping.callEffect({ id: '1' });

    expectTypeOf<ProtocolLayerError>().toMatchTypeOf<Effect.Error<typeof callEffect>>();
    expectTypeOf<Effect.Error<typeof callEffect>>().toEqualTypeOf<
      RpcProcedureError<typeof LifecyclePing, ProtocolLayerError>
    >();
    await expect(Effect.runPromise(callEffect)).rejects.toBe(layerError);
  });

  it('supports selected query data while rejecting heterogeneous unsafe defaults', () => {
    const factory = createEffectRpcAngularClient({
      group: LifecycleRpcs,
      rpcLayer: createProtocolLayer(),
      queryDefaults: { retry: 2, staleTime: 1_000 },
    });
    TestBed.configureTestingModule({ providers: [factory.providers] });
    const client = TestBed.runInInjectionContext(() => factory.injectClient());
    const options = client.lifecycle.ping.queryOptions(
      { id: '1' },
      { overrides: { select: (value) => (value.ok ? 'yes' : 'no') } },
    );

    expect(options.select?.({ ok: true })).toBe('yes');
    expectTypeOf(options.select).toMatchTypeOf<
      ((value: { readonly ok: boolean }) => string) | undefined
    >();

    const createWithErrorDependentDefaults = () =>
      createEffectRpcAngularClient({
        group: LifecycleRpcs,
        rpcLayer: createProtocolLayer(),
        queryDefaults: {
          // @ts-expect-error global defaults cannot depend on a heterogeneous procedure error
          retry: () => false,
        },
      });
    const createWithGlobalInitialData = () =>
      createEffectRpcAngularClient({
        group: LifecycleRpcs,
        rpcLayer: createProtocolLayer(),
        queryDefaults: {
          // @ts-expect-error initial data must be supplied per procedure
          initialData: { ok: true },
        },
      });
    expect(createWithErrorDependentDefaults).toBeTypeOf('function');
    expect(createWithGlobalInitialData).toBeTypeOf('function');
  });
});
