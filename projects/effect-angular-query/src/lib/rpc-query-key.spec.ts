import { hashKey } from '@tanstack/angular-query-experimental';

import { createRpcQueryKey, RpcQueryKeyEncodingError } from './rpc-query-key';

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

  it('preserves ordinary JSON-safe input shapes', () => {
    const input = {
      active: true,
      filters: ['admin', null, 3],
      user: { id: '42' },
    };

    expect(createRpcQueryKey(['rpc', 'profile'], { input })).toEqual([
      ['rpc', 'profile'],
      { input },
    ]);
  });

  it('produces hashable, distinct keys for bigint values', () => {
    const first = createRpcQueryKey(['rpc', 'balance'], { input: { accountId: 1n } });
    const second = createRpcQueryKey(['rpc', 'balance'], { input: { accountId: 2n } });

    expect(() => hashKey(first)).not.toThrow();
    expect(hashKey(first)).not.toBe(hashKey(second));
  });

  it('sorts Map entries canonically while distinguishing different maps', () => {
    const tenantA = createRpcQueryKey(['rpc', 'tenant'], {
      input: new Map([
        ['region', 'eu'],
        ['tenant', 'a'],
      ]),
    });
    const tenantAReordered = createRpcQueryKey(['rpc', 'tenant'], {
      input: new Map([
        ['tenant', 'a'],
        ['region', 'eu'],
      ]),
    });
    const tenantB = createRpcQueryKey(['rpc', 'tenant'], {
      input: new Map([
        ['region', 'eu'],
        ['tenant', 'b'],
      ]),
    });

    expect(hashKey(tenantAReordered)).toBe(hashKey(tenantA));
    expect(hashKey(tenantB)).not.toBe(hashKey(tenantA));
  });

  it('keeps special runtime values distinct from JSON lookalikes', () => {
    const keys = [
      createRpcQueryKey(['rpc', 'value'], { input: 1 }),
      createRpcQueryKey(['rpc', 'value'], { input: '1' }),
      createRpcQueryKey(['rpc', 'value'], { input: 1n }),
      createRpcQueryKey(['rpc', 'value'], { input: -0 }),
      createRpcQueryKey(['rpc', 'value'], { input: 0 }),
      createRpcQueryKey(['rpc', 'value'], { input: Number.NaN }),
      createRpcQueryKey(['rpc', 'value'], { input: Number.POSITIVE_INFINITY }),
      createRpcQueryKey(['rpc', 'value'], { input: Number.NEGATIVE_INFINITY }),
      createRpcQueryKey(['rpc', 'value'], { input: { value: undefined } }),
      createRpcQueryKey(['rpc', 'value'], { input: new Date('2026-01-02T03:04:05.000Z') }),
      createRpcQueryKey(['rpc', 'value'], { input: new Date(Number.NaN) }),
      createRpcQueryKey(['rpc', 'value'], { input: '2026-01-02T03:04:05.000Z' }),
      createRpcQueryKey(['rpc', 'value'], { input: new URL('https://example.com/path') }),
      createRpcQueryKey(['rpc', 'value'], { input: 'https://example.com/path' }),
      createRpcQueryKey(['rpc', 'value'], { input: /profile/gi }),
      createRpcQueryKey(['rpc', 'value'], { input: { source: 'profile', flags: 'gi' } }),
      createRpcQueryKey(['rpc', 'value'], { input: new Set(['a']) }),
      createRpcQueryKey(['rpc', 'value'], { input: ['a'] }),
      createRpcQueryKey(['rpc', 'value'], { input: new ArrayBuffer(2) }),
      createRpcQueryKey(['rpc', 'value'], { input: new Uint8Array([1, 2]) }),
      createRpcQueryKey(['rpc', 'value'], { input: { 0: 1, 1: 2 } }),
      createRpcQueryKey(['rpc', 'value'], {
        input: { __effectAngularQueryKeyValue: ['v1', 'bigint', '1'] },
      }),
    ];

    expect(new Set(keys.map(hashKey))).toHaveLength(keys.length);
  });

  it('distinguishes sparse arrays and null-prototype records', () => {
    const sparse = Array.from({ length: 2 });
    delete sparse[0];
    const explicitUndefined = [undefined, undefined];
    const nullPrototype = Object.assign(Object.create(null) as Record<string, unknown>, {
      id: '42',
    });

    expect(hashKey(createRpcQueryKey(['rpc'], { input: sparse }))).not.toBe(
      hashKey(createRpcQueryKey(['rpc'], { input: explicitUndefined })),
    );
    expect(createRpcQueryKey(['rpc'], { input: nullPrototype })).toEqual([
      ['rpc'],
      { input: { id: '42' } },
    ]);
  });

  it('rejects circular input with a typed, path-aware error', () => {
    const input: { self?: unknown } = {};
    input.self = input;

    expect(() => createRpcQueryKey(['rpc', 'circular'], { input })).toThrowError(
      expect.objectContaining({
        name: 'RpcQueryKeyEncodingError',
        reason: 'circular-value',
        path: '$."self"',
      }) as RpcQueryKeyEncodingError,
    );
  });

  it('reports numeric paths for circular array entries', () => {
    const input: unknown[] = [];
    input.push(input);

    expect(() => createRpcQueryKey(['rpc', 'circular'], { input })).toThrowError(
      expect.objectContaining({ path: '$[0]' }) as RpcQueryKeyEncodingError,
    );
  });

  it('supports custom values only through an explicit deterministic encoder', () => {
    class AccountId {
      constructor(readonly value: string) {}
    }

    const input = new AccountId('account-1');

    expect(() => createRpcQueryKey(['rpc', 'account'], { input })).toThrowError(
      /provide inputEncoder/,
    );

    const key = createRpcQueryKey(['rpc', 'account'], {
      input,
      inputEncoder: (accountId) => ({ accountId: accountId.value }),
    });

    expect(key).toEqual([['rpc', 'account'], { input: { accountId: 'account-1' } }]);
  });

  it('rejects functions, symbols, and symbol-keyed objects', () => {
    expect(() => createRpcQueryKey(['rpc'], { input: () => 'value' })).toThrowError(
      /values of type function/,
    );
    expect(() => createRpcQueryKey(['rpc'], { input: Symbol('value') })).toThrowError(
      /values of type symbol/,
    );

    const symbolKey = Symbol('private');
    expect(() => createRpcQueryKey(['rpc'], { input: { [symbolKey]: 'value' } })).toThrowError(
      /symbol-keyed properties/,
    );

    const unnamedInstance = Object.create({ constructor: undefined }) as object;
    expect(() => createRpcQueryKey(['rpc'], { input: unnamedInstance })).toThrowError(
      /instances of unknown/,
    );
  });

  it('canonically sorts equal Set values', () => {
    const first = { id: '1' };
    const second = { id: '1' };

    expect(() =>
      hashKey(createRpcQueryKey(['rpc'], { input: new Set([first, second]) })),
    ).not.toThrow();
  });
});
