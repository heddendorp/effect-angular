import { QueryClient } from '@tanstack/angular-query-experimental';

import {
  createRpcQueryOptions,
  type RpcDefinedQueryOptions,
  type RpcUndefinedQueryOptions,
} from './rpc-query-options';

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

  it('retains the queryFn data tag on the generated query key', () => {
    const options = createRpcQueryOptions({
      pathSegments: ['rpc', 'profile'],
      queryFn: async () => ({ name: 'Ada' }),
    });
    const queryClient = new QueryClient();
    const cached = queryClient.getQueryData(options.queryKey);

    expectTypeOf(cached).toEqualTypeOf<{ name: string } | undefined>();
    expect(cached).toBeUndefined();
  });

  it('infers selected data independently from queryFn data', () => {
    const options = createRpcQueryOptions({
      pathSegments: ['rpc', 'profile'],
      queryFn: async () => ({ name: 'Ada' }),
      overrides: {
        select: (profile) => profile.name,
      },
    });

    expectTypeOf(options).toMatchTypeOf<
      RpcUndefinedQueryOptions<unknown, { name: string }, Error, string>
    >();
    expect(options.select?.({ name: 'Grace' })).toBe('Grace');
  });

  it('retains defined initial-data typing with a select transform', () => {
    const options = createRpcQueryOptions({
      pathSegments: ['rpc', 'profile'],
      queryFn: async () => ({ name: 'Ada' }),
      overrides: {
        initialData: { name: 'Grace' },
        select: (profile) => profile.name,
      },
    });

    expectTypeOf(options).toMatchTypeOf<
      RpcDefinedQueryOptions<unknown, { name: string }, Error, string>
    >();
    expect(
      typeof options.initialData === 'function' ? options.initialData() : options.initialData,
    ).toEqual({ name: 'Grace' });
  });

  it('rejects initial data that does not match queryFn data', () => {
    createRpcQueryOptions({
      pathSegments: ['rpc', 'profile'],
      queryFn: async () => ({ name: 'Ada' }),
      overrides: {
        // @ts-expect-error Initial data is the raw queryFn shape, not the selected shape.
        initialData: 'Grace',
        select: (profile) => profile.name,
      },
    });
  });
});
