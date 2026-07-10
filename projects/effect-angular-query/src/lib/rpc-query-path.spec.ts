import { QueryClient } from '@tanstack/angular-query-experimental';

import { createRpcQueryKey } from './rpc-query-key';
import { createRpcPathKey, createRpcQueryFilter } from './rpc-query-path';

describe('RPC query path helpers', () => {
  it('builds a partial path key that matches all inputs below a subtree', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(createRpcQueryKey(['users', 'get'], { input: { id: '1' } }), 'Ada');
    queryClient.setQueryData(createRpcQueryKey(['users', 'get'], { input: { id: '2' } }), 'Grace');
    queryClient.setQueryData(createRpcQueryKey(['users', 'list']), ['Ada', 'Grace']);

    expect(queryClient.getQueryCache().findAll(createRpcQueryFilter(['users']))).toHaveLength(3);
    expect(
      queryClient.getQueryCache().findAll(createRpcQueryFilter(['users', 'get'])),
    ).toHaveLength(2);
  });

  it('matches an exact procedure path without requiring input metadata', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(createRpcQueryKey(['users', 'get'], { input: { id: '1' } }), 'Ada');
    queryClient.setQueryData(createRpcQueryKey(['users', 'get'], { input: { id: '2' } }), 'Grace');
    queryClient.setQueryData(createRpcQueryKey(['users', 'get', 'permissions']), ['read']);

    const filter = createRpcQueryFilter(['users', 'get'], { exact: true });

    expect(filter.exact).toBeUndefined();
    expect(filter.predicate).toEqual(expect.any(Function));
    expect(queryClient.getQueryCache().findAll(filter)).toHaveLength(2);
    expect(
      queryClient.getQueryCache().findAll(createRpcQueryFilter(['users'], { exact: true })),
    ).toHaveLength(0);
  });

  it('includes key prefixes in partial and exact path matching', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      createRpcQueryKey(['users', 'get'], { keyPrefix: ['app', 'v1'], input: { id: '1' } }),
      'Ada',
    );
    queryClient.setQueryData(
      createRpcQueryKey(['users', 'get'], { keyPrefix: ['other'], input: { id: '1' } }),
      'Grace',
    );

    const options = { keyPrefix: ['app', 'v1'] } as const;

    expect(createRpcPathKey(['users', 'get'], options)).toEqual([['app', 'v1', 'users', 'get']]);
    expect(
      queryClient
        .getQueryCache()
        .findAll(createRpcQueryFilter(['users', 'get'], { ...options, exact: true })),
    ).toHaveLength(1);
  });
});
