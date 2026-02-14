import { HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import * as Rpc from '@effect/rpc/Rpc';
import * as RpcClient from '@effect/rpc/RpcClient';
import * as RpcGroup from '@effect/rpc/RpcGroup';
import * as Schema from 'effect/Schema';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';

import {
  EFFECT_HTTP_CLIENT_LAYER,
  provideEffectHttpClient,
  provideEffectHttpClientLayer,
} from './effect-http-client';
import {
  EFFECT_RPC_PROTOCOL_HTTP_LAYER,
  provideEffectRpcProtocolHttpLayer,
} from './effect-rpc-protocol-http-layer';

const textDecoder = new TextDecoder();

const encodeText = (value: string): ArrayBuffer => {
  const buffer = new ArrayBuffer(value.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < value.length; i += 1) {
    view[i] = value.charCodeAt(i);
  }
  return buffer;
};

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

const Ping = Rpc.make('Ping', {
  payload: Schema.Struct({ message: Schema.String }),
  success: Schema.Struct({ reply: Schema.String }),
});

class AppRpcs extends RpcGroup.make(Ping) {}

describe('Effect RPC protocol HTTP layer provider', () => {
  it('registers EFFECT_HTTP_CLIENT_LAYER via Angular DI', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideEffectHttpClient(), provideEffectHttpClientLayer()],
    });

    const layer = TestBed.inject(EFFECT_HTTP_CLIENT_LAYER);

    expect(layer).toBeTruthy();
  });

  it('registers EFFECT_RPC_PROTOCOL_HTTP_LAYER via Angular DI', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideEffectHttpClient(),
        provideEffectRpcProtocolHttpLayer({ url: '/rpc' }),
      ],
    });

    const layer = TestBed.inject(EFFECT_RPC_PROTOCOL_HTTP_LAYER);

    expect(layer).toBeTruthy();
  });

  it('routes RPC protocol HTTP requests through Angular HttpClient', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideEffectHttpClient(),
        provideEffectRpcProtocolHttpLayer({ url: '/rpc' }),
      ],
    });

    const controller = TestBed.inject(HttpTestingController);
    const layer = TestBed.inject(EFFECT_RPC_PROTOCOL_HTTP_LAYER);

    const responsePromise = Effect.runPromise(
      Effect.flatMap(RpcClient.make(AppRpcs), (client) => client.Ping({ message: 'ping' })).pipe(
        Effect.provide(layer),
        Effect.scoped,
      ),
    );

    const request = await waitForRequest(
      controller,
      (httpRequest) => httpRequest.url.endsWith('/rpc') && httpRequest.method === 'POST',
    );

    const decodedBody = JSON.parse(decodeBody(request.request.body)) as
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
    const exitPayload = Schema.encodeSync(Rpc.exitSchema(Ping))(Exit.succeed({ reply: 'pong' }));

    request.flush(
      encodeText(
        JSON.stringify([
          { _tag: 'Exit', requestId: requestMessages[0]?.id, exit: exitPayload },
        ]),
      ),
      {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      },
    );

    expect(await responsePromise).toEqual({ reply: 'pong' });
    controller.verify();
  });
});
