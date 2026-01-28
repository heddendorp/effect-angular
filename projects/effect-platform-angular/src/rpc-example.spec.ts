import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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

describe('Effect RPC documentation example', () => {
  let adapter: EffectHttpClient.HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    adapter = createAngularHttpClient(TestBed.inject(HttpClient));
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controller.verify();
  });

  it('posts JSON to the RPC endpoint and parses the response', async () => {
    // Mirrors the README RPC example: send JSON over HttpClient and parse the JSON response.
    const requestPayload = [{ _tag: 'Request', id: 1, payload: { message: 'ping' } }];
    const requestBody = HttpBody.text(JSON.stringify(requestPayload), 'application/json');

    const responsePromise = Effect.runPromise(
      EffectHttpClient.post('/rpc', { body: requestBody }).pipe(
        Effect.provideService(EffectHttpClient.HttpClient, adapter),
        Effect.flatMap((response) => response.json),
      ),
    );

    const testRequest = controller.expectOne(
      (req) => req.url.endsWith('/rpc') && req.method === 'POST',
    );

    expect(testRequest.request.headers.get('content-type')).toBe('application/json');
    expect(testRequest.request.body).toBe(requestBody.body);

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
