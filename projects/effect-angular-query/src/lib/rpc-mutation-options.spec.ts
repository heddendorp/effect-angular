import { createRpcMutationOptions } from './rpc-mutation-options';

describe('createRpcMutationOptions', () => {
  it('builds mutation options with mutationKey and mutationFn', () => {
    const mutationFn = async (input: { id: string }) => input.id;

    const options = createRpcMutationOptions({
      pathSegments: ['users', 'update'],
      mutationFn,
    });

    expect(options.mutationKey).toEqual([['users', 'update'], { type: 'mutation' }]);
    expect(options.mutationFn).toBe(mutationFn);
  });

  it('attaches rpc metadata with the procedure path', () => {
    const options = createRpcMutationOptions({
      pathSegments: ['users', 'update'],
      mutationFn: async () => 'ok',
    });

    expect(options.meta).toMatchObject({ rpc: { path: ['users', 'update'] } });
  });

  it('merges defaults with overrides', () => {
    const options = createRpcMutationOptions({
      pathSegments: ['users', 'update'],
      mutationFn: async () => 'ok',
      defaults: {
        retry: 1,
        meta: { source: 'default' },
      },
      overrides: {
        retry: 2,
        meta: { source: 'override', tags: ['a'] },
      },
    });

    expect(options.retry).toBe(2);
    expect(options.meta).toMatchObject({
      source: 'override',
      tags: ['a'],
      rpc: { path: ['users', 'update'] },
    });
  });

  it('supports keyPrefix', () => {
    const options = createRpcMutationOptions({
      pathSegments: ['users', 'update'],
      keyPrefix: ['app', 'v1'],
      mutationFn: async () => 'ok',
    });

    expect(options.mutationKey).toEqual([['app', 'v1', 'users', 'update'], { type: 'mutation' }]);
  });
});
