import { HttpClient as AngularHttpClient } from '@angular/common/http';
import * as EffectHttpClient from '@effect/platform/HttpClient';
import * as HttpClientError from '@effect/platform/HttpClientError';
import * as Effect from 'effect/Effect';

export const createAngularHttpClient = (httpClient: AngularHttpClient): EffectHttpClient.HttpClient =>
  EffectHttpClient.make((request) =>
    Effect.fail(
      new HttpClientError.RequestError({
        request,
        reason: 'Transport',
        description: 'Angular HttpClient adapter not implemented yet.',
      }),
    ),
  );
