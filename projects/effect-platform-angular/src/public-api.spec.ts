import * as PublicApi from './public-api';

describe('effect-platform-angular public API', () => {
  it('exports the Effect HttpClient provider API', () => {
    expect(PublicApi.EFFECT_HTTP_CLIENT).toBeTruthy();
    expect(PublicApi.provideEffectHttpClient).toBeDefined();
  });
});
