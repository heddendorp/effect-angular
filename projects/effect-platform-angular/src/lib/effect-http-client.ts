import { HttpClient as AngularHttpClient } from '@angular/common/http';
import {
  EnvironmentProviders,
  InjectionToken,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import * as Layer from 'effect/Layer';
import { HttpClient as EffectHttpClient } from 'effect/unstable/http';

import { createAngularHttpClient, type EffectHttpClientOptions } from './http-client-adapter';

export {
  BufferedRequestBodyTooLargeError,
  DEFAULT_MAX_BUFFERED_REQUEST_BODY_BYTES,
  type EffectHttpClientOptions,
} from './http-client-adapter';

export const EFFECT_HTTP_CLIENT: InjectionToken<EffectHttpClient.HttpClient> =
  new InjectionToken<EffectHttpClient.HttpClient>('EFFECT_HTTP_CLIENT');

export const EFFECT_HTTP_CLIENT_LAYER: InjectionToken<
  Layer.Layer<EffectHttpClient.HttpClient, never, never>
> = new InjectionToken<Layer.Layer<EffectHttpClient.HttpClient, never, never>>(
  'EFFECT_HTTP_CLIENT_LAYER',
);

export const provideEffectHttpClient = (
  options: EffectHttpClientOptions = {},
): EnvironmentProviders =>
  makeEnvironmentProviders([
    {
      provide: EFFECT_HTTP_CLIENT,
      useFactory: () => createAngularHttpClient(inject(AngularHttpClient), options),
    },
  ]);

export const provideEffectHttpClientLayer = (): EnvironmentProviders =>
  makeEnvironmentProviders([
    {
      provide: EFFECT_HTTP_CLIENT_LAYER,
      useFactory: () => Layer.succeed(EffectHttpClient.HttpClient, inject(EFFECT_HTTP_CLIENT)),
    },
  ]);
