import { HttpClient as AngularHttpClient } from '@angular/common/http';
import { EnvironmentProviders, InjectionToken, inject, makeEnvironmentProviders } from '@angular/core';
import { HttpClient as EffectHttpClient } from '@effect/platform';
import * as Layer from 'effect/Layer';

import { createAngularHttpClient } from './http-client-adapter';

export const EFFECT_HTTP_CLIENT: InjectionToken<EffectHttpClient.HttpClient> =
  new InjectionToken<EffectHttpClient.HttpClient>('EFFECT_HTTP_CLIENT');

export const EFFECT_HTTP_CLIENT_LAYER: InjectionToken<
  Layer.Layer<EffectHttpClient.HttpClient, never, never>
> = new InjectionToken<Layer.Layer<EffectHttpClient.HttpClient, never, never>>(
  'EFFECT_HTTP_CLIENT_LAYER',
);

export const provideEffectHttpClient = (): EnvironmentProviders =>
  makeEnvironmentProviders([
    {
      provide: EFFECT_HTTP_CLIENT,
      useFactory: () => createAngularHttpClient(inject(AngularHttpClient)),
    },
  ]);

export const provideEffectHttpClientLayer = (): EnvironmentProviders =>
  makeEnvironmentProviders([
    {
      provide: EFFECT_HTTP_CLIENT_LAYER,
      useFactory: () => Layer.succeed(EffectHttpClient.HttpClient, inject(EFFECT_HTTP_CLIENT)),
    },
  ]);
