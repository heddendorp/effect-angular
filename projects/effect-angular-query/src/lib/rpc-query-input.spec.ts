import { snapshotQueryInput } from './rpc-query-input';

describe('query request snapshots', () => {
  it('isolates nested mutable values and preserves types and ordering', () => {
    const date = new Date(1);
    const url = new URL('https://example.test/path');
    const bytes = Uint8Array.of(0, 12, 13, 0);
    const sparse = [1];
    sparse[2] = 3;
    const input = {
      map: new Map([['group', new Set([date, url])]]),
      pattern: /test/g,
      bytes: bytes.subarray(1, 3),
      buffer: bytes.buffer,
      array: sparse,
    };
    const snapshot = snapshotQueryInput(input);
    bytes.fill(0);
    date.setTime(20);
    url.pathname = '/changed';
    input.map.clear();
    expect([...snapshot.map.get('group')!]).toEqual([
      new Date(1),
      new URL('https://example.test/path'),
    ]);
    expect(snapshot.bytes).toEqual(Uint8Array.of(12, 13));
    expect(new Uint8Array(snapshot.buffer)).toEqual(Uint8Array.of(0, 12, 13, 0));
    expect(snapshot.pattern).toEqual(/test/g);
    expect(Object.hasOwn(snapshot.array, 1)).toBe(false);
  });
});
