import { createRpcQueryKey } from './rpc-query-key';
import { snapshotQueryInput } from './rpc-query-input';

describe('query request snapshots', () => {
  it('preserves schema-visible hidden fields and aliases used by custom encoders', () => {
    const key = new Date(1);
    const input = { key, labels: new Map([[key, 'first']]) };
    const snapshot = snapshotQueryInput(input);
    expect(snapshot.key).not.toBe(key);
    expect(snapshot.labels.get(snapshot.key)).toBe('first');

    const hidden = Object.defineProperty({ id: 1 }, 'id', { enumerable: false });
    const captured = snapshotQueryInput(hidden);
    expect(captured.id).toBe(1);
    expect(Object.keys(captured)).toEqual([]);
    expect(createRpcQueryKey(['lookup'], { input: captured })[1].input).toEqual({ id: 1 });
  });

  it('preserves custom built-in subclasses for schema and encoder methods', () => {
    class LookupDate extends Date {
      readonly id = 'lookup';
    }
    class LookupList extends Array<string> {}
    const input = { date: new LookupDate(1), list: new LookupList('item') };
    const snapshot = snapshotQueryInput(input);
    expect(snapshot.date).toBe(input.date);
    expect(snapshot.date.id).toBe('lookup');
    expect(snapshot.list).toBe(input.list);
  });

  it('isolates nested mutable values and preserves types and ordering', () => {
    const date = new Date(1);
    const url = new URL('https://example.test/path');
    const bytes = Uint8Array.of(0, 12, 13, 0);
    const sparse = [1];
    sparse[2] = 3;
    const input = {
      view: new DataView(bytes.buffer, 1, 2),
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
    expect(snapshot.view.buffer).toBe(snapshot.buffer);
    expect(snapshot.view.byteOffset).toBe(1);
    expect(snapshot.view.byteLength).toBe(2);
    expect(snapshot.bytes.buffer).toBe(snapshot.buffer);
    expect(snapshot.bytes.byteOffset).toBe(1);
    expect(snapshot.bytes).toEqual(Uint8Array.of(12, 13));
    expect(new Uint8Array(snapshot.buffer)).toEqual(Uint8Array.of(0, 12, 13, 0));
    expect(snapshot.pattern).toEqual(/test/g);
    expect(Object.hasOwn(snapshot.array, 1)).toBe(false);
  });
});
