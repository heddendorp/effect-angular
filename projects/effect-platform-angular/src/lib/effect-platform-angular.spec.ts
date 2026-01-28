import { HttpClient, provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import * as Cause from 'effect/Cause';
import * as Exit from 'effect/Exit';
import * as Option from 'effect/Option';
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
