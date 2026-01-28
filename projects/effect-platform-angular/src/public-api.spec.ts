import { InjectionToken } from '@angular/core';

import * as PublicApi from './public-api';

describe('effect-platform-angular public API', () => {
  it('exports the Effect HttpClient provider API', () => {
    expect(PublicApi.EFFECT_HTTP_CLIENT).toBeTruthy();
    expect(PublicApi.EFFECT_HTTP_CLIENT).toBeInstanceOf(InjectionToken);
    expect(PublicApi.provideEffectHttpClient).toBeDefined();
  });
});
