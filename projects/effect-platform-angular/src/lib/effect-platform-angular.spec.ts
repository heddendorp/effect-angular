import {
  HttpClient,
  HttpRequest,
  provideHttpClient,
  withInterceptors,
  withXhr,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { InjectionToken, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import * as Exit from 'effect/Exit';
import * as Option from 'effect/Option';
import * as Stream from 'effect/Stream';
import * as Effect from 'effect/Effect';
import {
  Headers,
  HttpBody,
  HttpClient as EffectHttpClient,
  HttpClientError,
  HttpClientRequest,
} from 'effect/unstable/http';
import { EMPTY } from 'rxjs';

import { EFFECT_HTTP_CLIENT, provideEffectHttpClient } from './effect-http-client';
import { BufferedRequestBodyTooLargeError, createAngularHttpClient } from './http-client-adapter';

describe('Effect HTTP client provider', () => {
  it('registers the Effect HttpClient adapter via Angular DI', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideEffectHttpClient()],
    });

    const client = TestBed.inject(EFFECT_HTTP_CLIENT);

    expect(client).toBeTruthy();
    expect(typeof client.execute).toBe('function');
  });

  it('exposes an adapter instance from Angular HttpClient', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr())],
    });

    const httpClient = TestBed.inject(HttpClient);
    const adapter = createAngularHttpClient(httpClient);
    const request = HttpClientRequest.get('https://example.test');

    const exit = await Effect.runPromiseExit(adapter.execute(request));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Exit.findErrorOption(exit);

      expect(Option.isSome(failure)).toBe(true);
      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(HttpClientError.HttpClientError);
        expect(failure.value.reason).toBeInstanceOf(HttpClientError.TransportError);
      }
    }
  });

  it('resolves the public adapter options inside Angular injection context', async () => {
    const SSR_ORIGIN = new InjectionToken<string>('SSR_ORIGIN');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        { provide: SSR_ORIGIN, useValue: 'https://ssr.example.test/' },
        provideEffectHttpClient({
          baseUrl: () => inject(SSR_ORIGIN),
          maxBufferedRequestBodyBytes: 3,
        }),
      ],
    });
    const client = TestBed.inject(EFFECT_HTTP_CLIENT);
    const controller = TestBed.inject(HttpTestingController);
    const request = HttpClientRequest.post('/configured', {
      body: HttpBody.stream(Stream.fromIterable([new Uint8Array([1, 2, 3])])),
    });

    const responsePromise = Effect.runPromise(client.execute(request));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const testRequest = controller.expectOne('https://ssr.example.test/configured');

    expect(Array.from(new Uint8Array(testRequest.request.body as ArrayBuffer))).toEqual([1, 2, 3]);
    testRequest.flush(new ArrayBuffer(0));
    await responsePromise;
    controller.verify();
  });
});

describe('Angular HttpClient adapter request mapping', () => {
  let adapter: ReturnType<typeof createAngularHttpClient>;
  let controller: HttpTestingController;
  // Helper to accommodate async Effect work before the HttpTestingController sees the request.
  const waitForRequest = async (
    matchFn: (req: HttpRequest<unknown>) => boolean,
  ): Promise<ReturnType<HttpTestingController['match']>[number]> => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const matches = controller.match(matchFn);
      if (matches.length > 0) {
        return matches[0];
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return controller.expectOne(matchFn);
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });

    adapter = createAngularHttpClient(TestBed.inject(HttpClient));
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controller.verify();
  });

  it('maps method and query params', async () => {
    const request = HttpClientRequest.get('https://example.test/api', {
      urlParams: { search: 'effect', page: 2 },
    });

    const response = Effect.runPromise(adapter.execute(request));
    const testRequest = controller.expectOne((req) => req.method === 'GET');
    const url = new URL(testRequest.request.urlWithParams);

    expect(url.pathname).toBe('/api');
    expect(url.searchParams.get('search')).toBe('effect');
    expect(url.searchParams.get('page')).toBe('2');

    testRequest.flush(new ArrayBuffer(0));
    await response;
  });

  it('maps headers', async () => {
    const request = HttpClientRequest.get('https://example.test/headers', {
      headers: { 'x-trace': 'trace-id', 'x-scope': 'adapter' },
    });

    const response = Effect.runPromise(adapter.execute(request));
    const testRequest = controller.expectOne((req) => req.url === 'https://example.test/headers');

    expect(testRequest.request.headers.get('x-trace')).toBe('trace-id');
    expect(testRequest.request.headers.get('x-scope')).toBe('adapter');

    testRequest.flush(new ArrayBuffer(0));
    await response;
  });

  it('maps response status and headers', async () => {
    const request = HttpClientRequest.get('https://example.test/status');
    const responsePromise = Effect.runPromise(adapter.execute(request));
    const testRequest = controller.expectOne((req) => req.url === 'https://example.test/status');

    testRequest.flush(new ArrayBuffer(0), {
      status: 201,
      statusText: 'Created',
      headers: { 'x-response': 'ok' },
    });

    const response = await responsePromise;
    const header = Headers.get(response.headers, 'x-response');

    expect(response.status).toBe(201);
    expect(Option.isSome(header)).toBe(true);
    if (Option.isSome(header)) {
      expect(header.value).toBe('ok');
    }
  });

  it('parses JSON response bodies', async () => {
    const request = HttpClientRequest.get('https://example.test/json');
    const responsePromise = Effect.runPromise(adapter.execute(request));
    const testRequest = controller.expectOne((req) => req.url === 'https://example.test/json');
    const payload = { ok: true };
    const bodyText = JSON.stringify(payload);
    const body = new ArrayBuffer(bodyText.length);
    const bodyView = new Uint8Array(body);
    for (let i = 0; i < bodyText.length; i += 1) {
      bodyView[i] = bodyText.charCodeAt(i);
    }

    testRequest.flush(body, {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
    });

    const response = await responsePromise;
    const parsed = await Effect.runPromise(response.json);

    expect(parsed).toEqual(payload);
  });

  it('maps body payloads', async () => {
    const body = HttpBody.text('hello', 'text/plain');
    const request = HttpClientRequest.post('https://example.test/body', { body });

    const response = Effect.runPromise(adapter.execute(request));
    const testRequest = controller.expectOne((req) => req.url === 'https://example.test/body');

    expect(testRequest.request.body).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(testRequest.request.body as ArrayBuffer))).toEqual(
      Array.from(body.body),
    );
    expect(testRequest.request.headers.get('content-type')).toBe('text/plain');

    testRequest.flush(new ArrayBuffer(0));
    await response;
  });

  it('maps raw bodies', async () => {
    const request = HttpClientRequest.post('https://example.test/raw', {
      body: HttpBody.raw({ ok: true }),
    });

    const response = Effect.runPromise(adapter.execute(request));
    const testRequest = controller.expectOne((req) => req.url === 'https://example.test/raw');

    expect(testRequest.request.body).toEqual({ ok: true });

    testRequest.flush(new ArrayBuffer(0));
    await response;
  });

  it('encodes JSON Uint8Array bodies as JSON text for Angular HttpClient', async () => {
    const jsonBody = Effect.runSync(HttpBody.json({ _tag: 'Ping' }));
    const request = HttpClientRequest.post('https://example.test/rpc', {
      body: jsonBody,
    });

    const response = Effect.runPromise(adapter.execute(request));
    const testRequest = controller.expectOne((req) => req.url === 'https://example.test/rpc');

    // Regression guard: must be string, not Uint8Array/object.
    expect(typeof testRequest.request.body).toBe('string');
    expect(testRequest.request.body).toBe('{"_tag":"Ping"}');

    testRequest.flush(new ArrayBuffer(0));
    await response;
  });

  it('keeps non-JSON Uint8Array payloads binary', async () => {
    const request = HttpClientRequest.post('https://example.test/bin', {
      body: HttpBody.uint8Array(new Uint8Array([1, 2, 3]), 'application/octet-stream'),
    });

    const response = Effect.runPromise(adapter.execute(request));
    const testRequest = controller.expectOne((req) => req.url === 'https://example.test/bin');

    expect(testRequest.request.body).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(testRequest.request.body as ArrayBuffer))).toEqual([1, 2, 3]);

    testRequest.flush(new ArrayBuffer(0));
    await response;
  });

  it('maps form data bodies', async () => {
    const formData = new FormData();
    formData.append('name', 'effect');
    const request = HttpClientRequest.post('https://example.test/form', {
      body: HttpBody.formData(formData),
    });

    const response = Effect.runPromise(adapter.execute(request));
    const testRequest = controller.expectOne((req) => req.url === 'https://example.test/form');

    expect(testRequest.request.body).toBe(formData);

    testRequest.flush(new ArrayBuffer(0));
    await response;
  });

  it('serializes stream bodies as binary instead of JSON objects', async () => {
    const payload = new Uint8Array([1, 2, 3]);
    const streamBody = HttpBody.stream(Stream.fromIterable([payload]), 'application/octet-stream');
    const request = HttpClientRequest.post('https://example.test/stream', { body: streamBody });

    const response = Effect.runPromise(adapter.execute(request));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const testRequest = controller.expectOne((req) => req.url === 'https://example.test/stream');

    expect(testRequest.request.body).toBeInstanceOf(ArrayBuffer);
    expect(testRequest.request.serializeBody()).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(testRequest.request.serializeBody() as ArrayBuffer))).toEqual([
      1, 2, 3,
    ]);

    testRequest.flush(new ArrayBuffer(0));
    await response;
  });

  it('skips zero-length stream chunks without copying or retaining them', async () => {
    const emptyChunk = new Uint8Array(0);
    Object.defineProperty(emptyChunk, 'slice', {
      value: () => {
        throw new Error('zero-length chunks must not be copied');
      },
    });
    const streamBody = HttpBody.stream(
      Stream.fromIterable([emptyChunk, emptyChunk, new Uint8Array([1, 2, 3])]),
      'application/octet-stream',
    );
    const request = HttpClientRequest.post('https://example.test/stream-empty-chunks', {
      body: streamBody,
    });

    const response = Effect.runPromise(adapter.execute(request));
    const testRequest = await waitForRequest(
      (req) => req.url === 'https://example.test/stream-empty-chunks',
    );

    expect(Array.from(new Uint8Array(testRequest.request.body as ArrayBuffer))).toEqual([1, 2, 3]);

    testRequest.flush(new ArrayBuffer(0));
    await response;
  });

  it('buffers a stream body at the configured byte limit', async () => {
    adapter = createAngularHttpClient(TestBed.inject(HttpClient), {
      maxBufferedRequestBodyBytes: 3,
    });
    const streamBody = HttpBody.stream(
      Stream.fromIterable([new Uint8Array([1]), new Uint8Array([2, 3])]),
      'application/octet-stream',
    );
    const request = HttpClientRequest.post('https://example.test/stream-limit', {
      body: streamBody,
    });

    const response = Effect.runPromise(adapter.execute(request));
    const testRequest = await waitForRequest(
      (req) => req.url === 'https://example.test/stream-limit',
    );

    expect(Array.from(new Uint8Array(testRequest.request.body as ArrayBuffer))).toEqual([1, 2, 3]);

    testRequest.flush(new ArrayBuffer(0));
    await response;
  });

  it('fails before sending when a stream body exceeds the configured byte limit', async () => {
    adapter = createAngularHttpClient(TestBed.inject(HttpClient), {
      maxBufferedRequestBodyBytes: 2,
    });
    const streamBody = HttpBody.stream(
      Stream.fromIterable([new Uint8Array([1, 2]), new Uint8Array([3])]),
      'application/octet-stream',
    );
    const request = HttpClientRequest.post('https://example.test/stream-too-large', {
      body: streamBody,
    });

    const exit = await Effect.runPromiseExit(adapter.execute(request));

    controller.expectNone('https://example.test/stream-too-large');
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Exit.findErrorOption(exit);
      expect(Option.isSome(failure)).toBe(true);
      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(HttpClientError.HttpClientError);
        expect(failure.value.reason).toBeInstanceOf(HttpClientError.EncodeError);
        expect(failure.value.reason.cause).toBeInstanceOf(BufferedRequestBodyTooLargeError);
      }
    }
  });

  it('does not retry a stream body that exceeds the configured byte limit', async () => {
    adapter = createAngularHttpClient(TestBed.inject(HttpClient), {
      maxBufferedRequestBodyBytes: 2,
    });
    let streamRuns = 0;
    const streamBody = HttpBody.stream(
      Stream.fromEffect(
        Effect.sync(() => {
          streamRuns += 1;
          return new Uint8Array([1, 2, 3]);
        }),
      ),
      'application/octet-stream',
    );
    const request = HttpClientRequest.post('https://example.test/stream-too-large-retry', {
      body: streamBody,
    });
    const retryingAdapter = adapter.pipe(
      EffectHttpClient.retryTransient({ retryOn: 'errors-only', times: 2 }),
    );

    const exit = await Effect.runPromiseExit(retryingAdapter.execute(request));

    controller.expectNone('https://example.test/stream-too-large-retry');
    expect(streamRuns).toBe(1);
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Exit.findErrorOption(exit);
      expect(Option.isSome(failure)).toBe(true);
      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(HttpClientError.HttpClientError);
        expect(failure.value.reason).toBeInstanceOf(HttpClientError.EncodeError);
        expect(failure.value.reason.cause).toBeInstanceOf(BufferedRequestBodyTooLargeError);
      }
    }
  });

  it.each([204, 205, 304])('normalizes a non-null body for status %i', async (status) => {
    const request = HttpClientRequest.get(`https://example.test/status-${status}`);
    const responsePromise = Effect.runPromise(adapter.execute(request));
    const testRequest = controller.expectOne(
      (req) => req.url === `https://example.test/status-${status}`,
    );

    testRequest.flush(new ArrayBuffer(0), {
      status,
      statusText: 'Bodyless',
    });

    const response = await responsePromise;

    expect(response.status).toBe(status);
    expect(await Effect.runPromise(response.arrayBuffer)).toEqual(new ArrayBuffer(0));
  });

  it('maps synchronous response adaptation failures to typed transport errors', async () => {
    const request = HttpClientRequest.get('https://example.test/invalid-fetch-status');
    const exitPromise = Effect.runPromiseExit(adapter.execute(request));
    const testRequest = controller.expectOne(
      (req) => req.url === 'https://example.test/invalid-fetch-status',
    );

    testRequest.flush(new ArrayBuffer(0), {
      status: 101,
      statusText: 'Switching Protocols',
    });

    const exit = await exitPromise;

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Exit.findErrorOption(exit);
      expect(Option.isSome(failure)).toBe(true);
      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(HttpClientError.HttpClientError);
        if (failure.value instanceof HttpClientError.HttpClientError) {
          expect(failure.value.reason).toBeInstanceOf(HttpClientError.TransportError);
        }
      }
    }
  });

  it('resolves relative URLs against an explicit SSR base URL', async () => {
    adapter = createAngularHttpClient(TestBed.inject(HttpClient), {
      baseUrl: 'https://ssr.example.test/app/',
    });
    const request = HttpClientRequest.get('/relative', {
      urlParams: { page: 2 },
    });

    const response = Effect.runPromise(adapter.execute(request));
    const testRequest = await waitForRequest(
      (req) => req.urlWithParams === 'https://ssr.example.test/relative?page=2',
    );

    testRequest.flush(new ArrayBuffer(0));
    await response;
  });

  it('maps malformed request URLs to InvalidUrlError when a base URL is configured', async () => {
    adapter = createAngularHttpClient(TestBed.inject(HttpClient), {
      baseUrl: 'https://ssr.example.test/app/',
    });
    const request = HttpClientRequest.get('http://[');

    const exit = await Effect.runPromiseExit(adapter.execute(request));

    expect(controller.match(() => true)).toHaveLength(0);
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Exit.findErrorOption(exit);
      expect(Option.isSome(failure)).toBe(true);
      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(HttpClientError.HttpClientError);
        expect(failure.value.reason).toBeInstanceOf(HttpClientError.InvalidUrlError);
      }
    }
  });

  it('surfaces transport errors as request failures', async () => {
    const request = HttpClientRequest.get('https://example.test/error');
    const exitPromise = Effect.runPromiseExit(adapter.execute(request));
    const testRequest = controller.expectOne((req) => req.url === 'https://example.test/error');

    testRequest.error(new ProgressEvent('error'));

    const exit = await exitPromise;

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Exit.findErrorOption(exit);

      expect(Option.isSome(failure)).toBe(true);
      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(HttpClientError.HttpClientError);
        expect(failure.value.reason).toBeInstanceOf(HttpClientError.TransportError);
      }
    }
  });

  it('maps status errors to Effect responses', async () => {
    const request = HttpClientRequest.get('https://example.test/status-error');
    const responsePromise = Effect.runPromise(adapter.execute(request));
    const testRequest = controller.expectOne(
      (req) => req.url === 'https://example.test/status-error',
    );

    testRequest.flush(new ArrayBuffer(0), {
      status: 500,
      statusText: 'Server Error',
      headers: { 'x-error': 'true' },
    });

    const response = await responsePromise;
    const header = Headers.get(response.headers, 'x-error');

    expect(response.status).toBe(500);
    expect(Option.isSome(header)).toBe(true);
    if (Option.isSome(header)) {
      expect(header.value).toBe('true');
    }
  });

  it('cancels in-flight requests when interrupted', async () => {
    const request = HttpClientRequest.get('https://example.test/cancel');
    const exitPromise = Effect.runPromiseExit(
      adapter.execute(request).pipe(Effect.timeout('1 millis')),
    );
    const testRequest = await waitForRequest((req) => req.url === 'https://example.test/cancel');

    const exit = await exitPromise;

    expect(Exit.isFailure(exit)).toBe(true);
    expect(testRequest.cancelled).toBe(true);
  });
});

describe('Angular HttpClient adapter completion handling', () => {
  it('fails when an interceptor completes without emitting a response', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([() => EMPTY]))],
    });
    const adapter = createAngularHttpClient(TestBed.inject(HttpClient));
    const request = HttpClientRequest.get('https://example.test/empty-completion');

    const exit = await Effect.runPromiseExit(
      adapter.execute(request).pipe(Effect.timeout('100 millis')),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Exit.findErrorOption(exit);
      expect(Option.isSome(failure)).toBe(true);
      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(HttpClientError.HttpClientError);
        if (failure.value instanceof HttpClientError.HttpClientError) {
          expect(failure.value.reason).toBeInstanceOf(HttpClientError.TransportError);
          if (failure.value.reason instanceof HttpClientError.TransportError) {
            expect(failure.value.reason.description).toContain(
              'completed without emitting a response',
            );
          }
        }
      }
    }
  });
});
