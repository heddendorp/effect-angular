import * as PublicApi from './public-api';

describe('effect-angular-query public API', () => {
  it('exports the RPC client factory and classification helpers', () => {
    expect(PublicApi.createEffectRpcAngularClient).toBeTruthy();
    expect(PublicApi.createEffectRpcAngularClientConfig).toBeTruthy();
    expect(PublicApi.asRpcQuery).toBeTruthy();
    expect(PublicApi.asRpcMutation).toBeTruthy();
  });

  it('exports query and mutation utility helpers', () => {
    expect(PublicApi.createRpcQueryKey).toBeTruthy();
    expect(PublicApi.createRpcQueryOptions).toBeTruthy();
    expect(PublicApi.createRpcMutationOptions).toBeTruthy();
    expect(PublicApi.createRpcPathKey).toBeTruthy();
    expect(PublicApi.createRpcQueryFilter).toBeTruthy();
  });
});
