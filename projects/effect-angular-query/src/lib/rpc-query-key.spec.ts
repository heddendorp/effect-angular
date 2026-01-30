import { createRpcQueryKey } from './rpc-query-key';

describe('createRpcQueryKey', () => {
  it('returns path segments with empty metadata when no input is provided', () => {
    const key = createRpcQueryKey(['rpc', 'profile']);

    expect(key).toEqual([['rpc', 'profile'], {}]);
  });

  it('includes input in metadata when provided', () => {
    const key = createRpcQueryKey(['rpc', 'profile'], { input: { id: '42' } });

    expect(key).toEqual([['rpc', 'profile'], { input: { id: '42' } }]);
  });

  it('prepends keyPrefix when provided as a string', () => {
    const key = createRpcQueryKey(['rpc', 'profile'], { keyPrefix: 'app' });

    expect(key).toEqual([['app', 'rpc', 'profile'], {}]);
  });

  it('prepends keyPrefix when provided as segments', () => {
    const key = createRpcQueryKey(['rpc', 'profile'], { keyPrefix: ['app', 'v1'] });

    expect(key).toEqual([['app', 'v1', 'rpc', 'profile'], {}]);
  });

  it('passes through metadata type when provided', () => {
    const key = createRpcQueryKey(['rpc', 'profile'], { type: 'query' });

    expect(key).toEqual([['rpc', 'profile'], { type: 'query' }]);
  });
});
