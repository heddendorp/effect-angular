// Keep the request payload separate from the caller's mutable input. Do not feed the
// canonical cache key back into Effect: a schema can distinguish a Date from a string.
export function snapshotQueryInput<T>(input: T): T {
  return copy(input, new WeakMap()) as T;
}

function copy(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);

  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value) || prototype === Object.prototype || prototype === null) {
    const result: object = Array.isArray(value)
      ? new Array(value.length)
      : Object.create(prototype);
    seen.set(value, result);
    for (const key of Reflect.ownKeys(value)) {
      if (Object.prototype.propertyIsEnumerable.call(value, key)) {
        Object.defineProperty(result, key, {
          value: copy(Reflect.get(value, key), seen),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
    }
    return result;
  }
  if (value instanceof Map) {
    const result = new Map<unknown, unknown>();
    seen.set(value, result);
    for (const [key, entry] of value) result.set(copy(key, seen), copy(entry, seen));
    return result;
  }
  if (value instanceof Set) {
    const result = new Set<unknown>();
    seen.set(value, result);
    for (const entry of value) result.add(copy(entry, seen));
    return result;
  }
  if (value instanceof URL) return new URL(value.href);
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) {
    const result = new RegExp(value.source, value.flags);
    result.lastIndex = value.lastIndex;
    return result;
  }
  if (value instanceof ArrayBuffer) return value.slice(0);
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice();
    // All standard typed arrays and DataView accept a backing ArrayBuffer.
    const View = prototype.constructor as new (buffer: ArrayBuffer) => ArrayBufferView;
    return new View(bytes.buffer);
  }
  // Custom instances may use private fields. Their encoder defines query identity.
  return value;
}
