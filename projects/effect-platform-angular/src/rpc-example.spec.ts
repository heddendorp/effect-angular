import { HttpClient, HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient as EffectHttpClient } from '@effect/platform';
import { Rpc, RpcClient, RpcClientError, RpcGroup, RpcSerialization } from '@effect/rpc';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';

import { createAngularHttpClient } from './lib/http-client-adapter';

const textDecoder = new TextDecoder();

// Angular's HttpClient test harness works with ArrayBuffer; keep encoding explicit.
const encodeText = (value: string): ArrayBuffer => {
  const buffer = new ArrayBuffer(value.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < value.length; i += 1) {
    view[i] = value.charCodeAt(i);
  }
  return buffer;
};

// Normalize the serialized request body so assertions stay stable across adapters.
const decodeBody = (body: unknown): string => {
  if (typeof body === 'string') {
    return body;
  }
  if (body instanceof ArrayBuffer) {
    return textDecoder.decode(body);
  }
  if (ArrayBuffer.isView(body)) {
    return textDecoder.decode(body);
  }
  if (body && typeof body === 'object') {
    const entries = Object.entries(body as Record<string, unknown>)
      .filter(([key]) => String(Number(key)) === key)
      .sort(([a], [b]) => Number(a) - Number(b));
    if (entries.length > 0) {
      const bytes = new Uint8Array(entries.length);
      for (const [key, byte] of entries) {
        bytes[Number(key)] = Number(byte);
      }
      return textDecoder.decode(bytes);
    }
  }
  return JSON.stringify(body);
};

// Minimal unary RPC used by both the service and the test.
const Ping = Rpc.make('Ping', {
  payload: Schema.Struct({ message: Schema.String }),
  success: Schema.Struct({ reply: Schema.String }),
});

class AppRpcs extends RpcGroup.make(Ping) {}

// Map Effect-returning procedures to promise-returning call sites (unary only).
type PromiseClient<T> = {
  -readonly [K in keyof T]: T[K] extends (...args: infer Args) => Effect.Effect<infer A, infer _E, infer _R>
    ? (...args: Args) => Promise<A>
    : never;
};

type RawClient = RpcClient.FromGroup<typeof AppRpcs, RpcClientError.RpcClientError>;
type AppRpcPromiseClient = PromiseClient<RawClient>;

// HttpTestingController can register requests asynchronously; poll a few ticks.
const waitForRequest = async (
  controller: HttpTestingController,
  match: (req: HttpRequest<unknown>) => boolean,
) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const matches = controller.match(match);
    if (matches.length > 0) {
      return matches[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return controller.expectOne(match);
};

// Build a promise-based facade for unary RPC procedures in a single place.
const createPromiseClient = (
  layer: Layer.Layer<RpcClient.Protocol, never, never>,
): AppRpcPromiseClient => {
  const runRpc = <A, E>(call: (client: RawClient) => Effect.Effect<A, E, never>): Promise<A> => {
    const program = Effect.flatMap(RpcClient.make(AppRpcs), call).pipe(
      Effect.provide(layer),
      Effect.scoped,
    );

    return Effect.runPromise(program);
  };

  // Use RpcGroup metadata to expose the procedures without a Proxy.
  const client = {} as AppRpcPromiseClient;
  const procedureKeys = Array.from(AppRpcs.requests.keys()) as Array<keyof RawClient>;
  for (const key of procedureKeys) {
    client[key] = ((...args: Parameters<RawClient[typeof key]>) =>
      runRpc((rpcClient) => rpcClient[key](...args))) as AppRpcPromiseClient[typeof key];
  }

  return client;
};

@Injectable({ providedIn: 'root' })
class AppRpcClient implements AppRpcPromiseClient {
  // Adapter is created once per service instance and provided to Effect at call time.
  private readonly adapter = createAngularHttpClient(inject(HttpClient));
  private readonly rpcLayer: Layer.Layer<RpcClient.Protocol, never, never> =
    RpcClient.layerProtocolHttp({ url: '/rpc' }).pipe(
      Layer.provide([
        RpcSerialization.layerJson,
        Layer.succeed(EffectHttpClient.HttpClient, this.adapter),
      ]),
    );

  // Promise boundary for Angular components: expose procedures directly on the service.
  readonly Ping: AppRpcPromiseClient['Ping'];

  constructor() {
    const promiseClient = createPromiseClient(this.rpcLayer);
    this.Ping = promiseClient.Ping;
  }
}

describe('Effect RPC documentation example', () => {
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AppRpcClient],
    });

    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Ensure no unexpected requests leak between test cases.
    controller.verify();
  });

  it('exposes a promise-returning RPC procedure via an Angular service', async () => {
    const service = TestBed.inject(AppRpcClient);
    const responsePromise = service.Ping({ message: 'ping' });

    const testRequest = await waitForRequest(
      controller,
      (req) => req.url.endsWith('/rpc') && req.method === 'POST',
    );

    // Confirm the client sends JSON over the HTTP RPC protocol endpoint.
    expect(testRequest.request.headers.get('content-type')).toBe('application/json');
    const decodedBody = JSON.parse(decodeBody(testRequest.request.body)) as
      | {
          _tag: string;
          id: string;
          payload: { message: string };
        }
      | Array<{
          _tag: string;
          id: string;
          payload: { message: string };
        }>;
    const requestMessages = Array.isArray(decodedBody) ? decodedBody : [decodedBody];

    expect(requestMessages[0]?._tag).toBe('Request');
    expect(requestMessages[0]?.payload).toEqual({ message: 'ping' });

    const exitPayload = Schema.encodeSync(Rpc.exitSchema(Ping))(Exit.succeed({ reply: 'pong' }));
    const responsePayload = [{ _tag: 'Exit', requestId: requestMessages[0]?.id, exit: exitPayload }];
    // Simulate the RPC server returning a successful Exit; the client should resolve it.
    testRequest.flush(encodeText(JSON.stringify(responsePayload)), {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
    });

    const parsed = await responsePromise;

    expect(parsed).toEqual({ reply: 'pong' });
  });
});
