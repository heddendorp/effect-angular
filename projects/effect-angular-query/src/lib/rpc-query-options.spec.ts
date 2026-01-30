import { createRpcQueryOptions } from './rpc-query-options';

describe('createRpcQueryOptions', () => {
  it('builds query options with queryKey and queryFn', () => {
    const queryFn = async () => 'ok';

    const options = createRpcQueryOptions({
      pathSegments: ['rpc', 'profile'],
      queryFn,
    });

    expect(options.queryKey).toEqual([['rpc', 'profile'], {}]);
    expect(options.queryFn).toBe(queryFn);
  });

  it('attaches rpc metadata with the procedure path', () => {
    const options = createRpcQueryOptions({
      pathSegments: ['rpc', 'profile'],
      queryFn: async () => 'ok',
    });

    const meta = options.meta ?? {};

    expect(meta).toMatchObject({ rpc: { path: ['rpc', 'profile'] } });
  });

  it('merges defaults with overrides', () => {
    const queryFn = async () => 'ok';
    const options = createRpcQueryOptions({
      pathSegments: ['rpc', 'profile'],
      queryFn,
      defaults: {
        retry: 1,
        staleTime: 1000,
        meta: { source: 'default' },
      },
      overrides: {
        retry: 2,
        meta: { source: 'override', flags: ['a'] },
      },
    });

    expect(options.retry).toBe(2);
    expect(options.staleTime).toBe(1000);
    expect(options.meta).toMatchObject({
      source: 'override',
      flags: ['a'],
      rpc: { path: ['rpc', 'profile'] },
    });
  });

  it('supports keyPrefix and input metadata', () => {
    const options = createRpcQueryOptions({
      pathSegments: ['rpc', 'profile'],
      input: { id: '42' },
      keyPrefix: ['app', 'v1'],
      queryFn: async () => 'ok',
      type: 'query',
    });

    expect(options.queryKey).toEqual([
      ['app', 'v1', 'rpc', 'profile'],
      { input: { id: '42' }, type: 'query' },
    ]);
  });
});
