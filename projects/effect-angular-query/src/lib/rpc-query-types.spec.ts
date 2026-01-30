import type { CreateQueryOptions, QueryFunction } from '@tanstack/angular-query-experimental';

import type { RpcQueryFn, RpcQueryKey, RpcQueryOptions } from './rpc-query-types';

describe('rpc query types', () => {
  it('aligns query options with TanStack CreateQueryOptions', () => {
    type SampleKey = RpcQueryKey<{ id: string }>;

    const options: RpcQueryOptions<string, Error, string, SampleKey> = {
      queryKey: [['users', 'detail'], { input: { id: '1' }, type: 'query' }],
      queryFn: async () => 'ok',
    };

    const assigned: CreateQueryOptions<string, Error, string, SampleKey> = options;

    expect(assigned.queryKey).toBe(options.queryKey);
  });

  it('exposes query functions compatible with TanStack QueryFunction', () => {
    type SampleKey = RpcQueryKey<{ id: string }>;

    const queryFn: RpcQueryFn<number, SampleKey> = async () => 42;
    const assigned: QueryFunction<number, SampleKey> = queryFn;

    expect(typeof assigned).toBe('function');
  });
});
