import { InjectionToken } from '@angular/core';

import * as PublicApi from './public-api';

describe('effect-platform-angular public API', () => {
  it('exports the Effect HttpClient provider API', () => {
    expect(PublicApi.EFFECT_HTTP_CLIENT).toBeTruthy();
    expect(PublicApi.EFFECT_HTTP_CLIENT).toBeInstanceOf(InjectionToken);
    expect(PublicApi.EFFECT_HTTP_CLIENT_LAYER).toBeTruthy();
    expect(PublicApi.EFFECT_HTTP_CLIENT_LAYER).toBeInstanceOf(InjectionToken);
    expect(PublicApi.provideEffectHttpClient).toBeDefined();
    expect(PublicApi.provideEffectHttpClientLayer).toBeDefined();
  });

  it('exports the Effect RPC protocol layer provider API', () => {
    expect(PublicApi.EFFECT_RPC_PROTOCOL_HTTP_LAYER).toBeTruthy();
    expect(PublicApi.EFFECT_RPC_PROTOCOL_HTTP_LAYER).toBeInstanceOf(InjectionToken);
    expect(PublicApi.provideEffectRpcProtocolHttpLayer).toBeDefined();
  });
});
