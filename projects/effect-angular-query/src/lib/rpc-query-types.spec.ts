import type {
  CreateMutationOptions,
  CreateQueryOptions,
  QueryFunction,
} from '@tanstack/angular-query-experimental';

import type {
  RpcMutationFn,
  RpcMutationKey,
  RpcMutationOptions,
  RpcQueryFn,
  RpcQueryKey,
  RpcQueryOptions,
} from './rpc-query-types';

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

  it('aligns mutation options with TanStack CreateMutationOptions', () => {
    const mutationOptions: RpcMutationOptions<string, Error, { id: string }, { snapshot: string }> =
      {
        mutationKey: [['users', 'update'], { type: 'mutation' }],
        mutationFn: async () => 'ok',
      };

    const assigned: CreateMutationOptions<string, Error, { id: string }, { snapshot: string }> =
      mutationOptions;

    expect(assigned.mutationKey).toEqual([['users', 'update'], { type: 'mutation' }]);
  });

  it('exposes mutation keys and functions with the expected shape', () => {
    const key: RpcMutationKey = [['users', 'update'], { type: 'mutation' }];
    const mutationFn: RpcMutationFn<number, { id: string }, Error, unknown> = async () => 42;

    expect(key[1].type).toBe('mutation');
    expect(typeof mutationFn).toBe('function');
  });
});
