import { HttpClient, HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import * as Cause from 'effect/Cause';
import * as Exit from 'effect/Exit';
import * as Option from 'effect/Option';
import * as Stream from 'effect/Stream';
import * as HttpBody from '@effect/platform/HttpBody';
import * as HttpClientError from '@effect/platform/HttpClientError';
import * as HttpClientRequest from '@effect/platform/HttpClientRequest';
import * as Effect from 'effect/Effect';

import { EFFECT_HTTP_CLIENT, provideEffectHttpClient } from './effect-http-client';
import { createAngularHttpClient } from './http-client-adapter';

describe('Effect HTTP client provider', () => {
  it('registers the Effect HttpClient adapter via Angular DI', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideEffectHttpClient()],
    });

    const client = TestBed.inject(EFFECT_HTTP_CLIENT);

    expect(client).toBeTruthy();
    expect(typeof client.execute).toBe('function');
  });

  it('exposes an adapter instance from Angular HttpClient', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });

    const httpClient = TestBed.inject(HttpClient);
    const adapter = createAngularHttpClient(httpClient);
    const request = HttpClientRequest.get('https://example.test');

    const exit = await Effect.runPromiseExit(adapter.execute(request));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);

      expect(Option.isSome(failure)).toBe(true);
      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(HttpClientError.RequestError);
      }
    }
  });
});

describe('Angular HttpClient adapter request mapping', () => {
  let adapter: ReturnType<typeof createAngularHttpClient>;
  let controller: HttpTestingController;
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
      providers: [provideHttpClient(), provideHttpClientTesting()],
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

  it('maps body payloads', async () => {
    const body = HttpBody.text('hello', 'text/plain');
    const request = HttpClientRequest.post('https://example.test/body', { body });

    const response = Effect.runPromise(adapter.execute(request));
    const testRequest = controller.expectOne((req) => req.url === 'https://example.test/body');

    expect(testRequest.request.body).toEqual(body.body);
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

  it('maps stream bodies', async () => {
    const payload = new Uint8Array([1, 2, 3]);
    const streamBody = HttpBody.stream(Stream.fromIterable([payload]), 'application/octet-stream');
    const request = HttpClientRequest.post('https://example.test/stream', { body: streamBody });

    const response = Effect.runPromise(adapter.execute(request));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const testRequest = controller.expectOne((req) => req.url === 'https://example.test/stream');

    expect(Array.from(testRequest.request.body as Uint8Array)).toEqual([1, 2, 3]);

    testRequest.flush(new ArrayBuffer(0));
    await response;
  });

  it('surfaces transport errors as request failures', async () => {
    const request = HttpClientRequest.get('https://example.test/error');
    const exitPromise = Effect.runPromiseExit(adapter.execute(request));
    const testRequest = controller.expectOne((req) => req.url === 'https://example.test/error');

    testRequest.error(new ProgressEvent('error'));

    const exit = await exitPromise;

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);

      expect(Option.isSome(failure)).toBe(true);
      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(HttpClientError.RequestError);
      }
    }
  });

  it('cancels in-flight requests when interrupted', async () => {
    const request = HttpClientRequest.get('https://example.test/cancel');
    const exitPromise = Effect.runPromiseExit(
      adapter.execute(request).pipe(Effect.timeout('1 millis')),
    );
    const testRequest = await waitForRequest((req) => req.url === 'https://example.test/cancel');

    await exitPromise;

    expect(testRequest.cancelled).toBe(true);
  });
});
