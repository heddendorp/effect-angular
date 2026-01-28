import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injectable, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpBody, HttpClient as EffectHttpClient } from '@effect/platform';
import * as Effect from 'effect/Effect';

import { createAngularHttpClient } from './lib/http-client-adapter';

const encodeText = (value: string): ArrayBuffer => {
  const buffer = new ArrayBuffer(value.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < value.length; i += 1) {
    view[i] = value.charCodeAt(i);
  }
  return buffer;
};

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

@Injectable({ providedIn: 'root' })
class RpcClientService {
  private readonly adapter = createAngularHttpClient(inject(HttpClient));

  ping(message: string) {
    const requestPayload = [{ _tag: 'Request', id: 1, payload: { message } }];
    const requestBody = HttpBody.text(JSON.stringify(requestPayload), 'application/json');

    const program = EffectHttpClient.post('/rpc', { body: requestBody }).pipe(
      Effect.provideService(EffectHttpClient.HttpClient, this.adapter),
      Effect.flatMap((response) => response.json),
    );

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
    controller.verify();
  });

  it('exposes a promise-returning RPC procedure via an Angular service', async () => {
    const service = TestBed.inject(RpcClientService);
    const responsePromise = service.ping('ping');

    const testRequest = controller.expectOne(
      (req) => req.url.endsWith('/rpc') && req.method === 'POST',
    );

    expect(testRequest.request.headers.get('content-type')).toBe('application/json');
    expect(decodeBody(testRequest.request.body)).toBe(
      JSON.stringify([{ _tag: 'Request', id: 1, payload: { message: 'ping' } }]),
    );

    const responsePayload = [{ _tag: 'Response', id: 1, result: { reply: 'pong' } }];
    testRequest.flush(encodeText(JSON.stringify(responsePayload)), {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
    });

    const parsed = await responsePromise;

    expect(parsed).toEqual(responsePayload);
  });
});
