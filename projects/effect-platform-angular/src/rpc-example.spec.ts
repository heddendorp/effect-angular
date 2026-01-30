import { HttpClient, HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient as EffectHttpClient } from '@effect/platform';
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from '@effect/rpc';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';

import { createAngularHttpClient } from './lib/http-client-adapter';

// Angular's HttpClient test harness works with ArrayBuffer; keep encoding explicit.
const encodeText = (value: string): ArrayBuffer => {
  const buffer = new ArrayBuffer(value.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < value.length; i += 1) {
    view[i] = value.charCodeAt(i);
  }
  return buffer;
};

// Normalize request bodies that may be serialized as strings, buffers, or byte-like objects.
const toByteView = (value: unknown): Uint8Array | null => {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => String(Number(key)) === key)
      .sort(([a], [b]) => Number(a) - Number(b));
    if (entries.length > 0) {
      const bytes = new Uint8Array(entries.length);
      for (const [key, byte] of entries) {
        bytes[Number(key)] = Number(byte);
      }
      return bytes;
    }
  }
  return null;
};

// Decode the serialized request body so assertions stay stable across adapters.
const decodeBody = (body: unknown): string => {
  if (typeof body === 'string') {
    return body;
  }
  const bytes = toByteView(body);
  if (bytes) {
    return String.fromCharCode(...bytes);
  }
  return JSON.stringify(body);
};

const Ping = Rpc.make('Ping', {
  payload: Schema.Struct({ message: Schema.String }),
  success: Schema.Struct({ reply: Schema.String }),
});

class AppRpcs extends RpcGroup.make(Ping) {}

@Injectable({ providedIn: 'root' })
class RpcClientService {
  // Adapter is created once per service instance and provided to Effect at call time.
  private readonly adapter = createAngularHttpClient(inject(HttpClient));
  private readonly rpcLayer = RpcClient.layerProtocolHttp({ url: '/rpc' }).pipe(
    Layer.provide([
      RpcSerialization.layerJson,
      Layer.succeed(EffectHttpClient.HttpClient, this.adapter),
    ]),
  );

  // Promise boundary for Angular components: keep Effect internals inside the service.
  ping(message: string) {
    const program = Effect.gen(function* () {
      const client = yield* RpcClient.make(AppRpcs);
      return yield* client.Ping({ message });
    }).pipe(Effect.provide(this.rpcLayer), Effect.scoped);

    return Effect.runPromise(program);
  }
}

describe('Effect RPC documentation example', () => {
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), RpcClientService],
    });

    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Ensure no unexpected requests leak between test cases.
    controller.verify();
  });

  it('exposes a promise-returning RPC procedure via an Angular service', async () => {
    const service = TestBed.inject(RpcClientService);
    // The service returns a Promise so components can consume it without Effect APIs.
    const responsePromise = service.ping('ping');

    const testRequest = await (async () => {
      const match = (req: HttpRequest<unknown>) =>
        req.url.endsWith('/rpc') && req.method === 'POST';
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const matches = controller.match(match);
        if (matches.length > 0) {
          return matches[0];
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      return controller.expectOne(match);
    })();

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
