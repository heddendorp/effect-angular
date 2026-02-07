import { HttpClient as AngularHttpClient } from '@angular/common/http';
import { EnvironmentProviders, InjectionToken, inject, makeEnvironmentProviders } from '@angular/core';
import type { HttpClient as EffectHttpClient } from '@effect/platform';

import { createAngularHttpClient } from './http-client-adapter';

export const EFFECT_HTTP_CLIENT: InjectionToken<EffectHttpClient.HttpClient> =
  new InjectionToken<EffectHttpClient.HttpClient>('EFFECT_HTTP_CLIENT');

export const provideEffectHttpClient = (): EnvironmentProviders =>
  makeEnvironmentProviders([
    {
      provide: EFFECT_HTTP_CLIENT,
      useFactory: () => createAngularHttpClient(inject(AngularHttpClient)),
    },
  ]);
