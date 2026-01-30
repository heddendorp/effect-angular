import * as PublicApi from './public-api';

describe('effect-angular-query public API', () => {
  it('exports the RPC query client helpers', () => {
    expect(PublicApi.EffectRpcQueryClient).toBeTruthy();
    expect(PublicApi.EFFECT_RPC_QUERY_CLIENT_CONFIG).toBeTruthy();
    expect(PublicApi.provideEffectRpcQueryClient).toBeTruthy();
  });

  it('exports query key and options utilities', () => {
    expect(PublicApi.createRpcQueryKey).toBeTruthy();
    expect(PublicApi.createRpcQueryOptions).toBeTruthy();
    expect(PublicApi.createRpcPathKey).toBeTruthy();
    expect(PublicApi.createRpcQueryFilter).toBeTruthy();
  });
});
