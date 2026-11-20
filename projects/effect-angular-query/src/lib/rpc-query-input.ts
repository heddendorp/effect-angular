// Keep the request payload separate from the caller's mutable input. Do not feed the
// canonical cache key back into Effect: a schema can distinguish a Date from a string.
export function snapshotQueryInput<T>(input: T): T {
  return copy(input, new WeakMap()) as T;
}

function copy(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);

  const prototype = Object.getPrototypeOf(value);
  if (prototype === Array.prototype || prototype === Object.prototype || prototype === null) {
    const result: object = Array.isArray(value)
      ? new Array(value.length)
      : Object.create(prototype);
    seen.set(value, result);
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === 'length') continue;
      Object.defineProperty(result, key, {
        value: copy(Reflect.get(value, key), seen),
        enumerable: Object.prototype.propertyIsEnumerable.call(value, key),
        writable: true,
        configurable: true,
      });
    }
    return result;
  }
  if (value instanceof Map && prototype === Map.prototype) {
    const result = new Map<unknown, unknown>();
    seen.set(value, result);
    for (const [key, entry] of value) result.set(copy(key, seen), copy(entry, seen));
    return result;
  }
  if (value instanceof Set && prototype === Set.prototype) {
    const result = new Set<unknown>();
    seen.set(value, result);
    for (const entry of value) result.add(copy(entry, seen));
    return result;
  }
  const result = copyLeaf(value, seen);
  seen.set(value, result);
  return result;
}

function copyLeaf(value: object, seen: WeakMap<object, unknown>): object {
  const prototype = Object.getPrototypeOf(value);
  if (value instanceof URL && prototype === URL.prototype) return new URL(value.href);
  if (value instanceof Date && prototype === Date.prototype) return new Date(value.getTime());
  if (value instanceof RegExp && prototype === RegExp.prototype) {
    const result = new RegExp(value.source, value.flags);
    result.lastIndex = value.lastIndex;
    return result;
  }
  if (value instanceof ArrayBuffer && prototype === ArrayBuffer.prototype) return value.slice(0);
  if (
    typeof SharedArrayBuffer !== 'undefined' &&
    value instanceof SharedArrayBuffer &&
    prototype === SharedArrayBuffer.prototype
  )
    return value.slice(0);
  if (ArrayBuffer.isView(value)) {
    if (prototype === DataView.prototype) {
      return new DataView(
        copy(value.buffer, seen) as ArrayBufferLike,
        value.byteOffset,
        value.byteLength,
      );
    }
    // The concrete typed-array prototypes share %TypedArray%.prototype.
    // Leave custom subclasses intact so their schema and encoder still recognize them.
    if (Object.getPrototypeOf(prototype) === Object.getPrototypeOf(Uint8Array.prototype)) {
      const View = prototype.constructor as {
        new (buffer: ArrayBufferLike, byteOffset: number, length: number): ArrayBufferView;
        readonly BYTES_PER_ELEMENT: number;
      };
      return new View(
        copy(value.buffer, seen) as ArrayBufferLike,
        value.byteOffset,
        value.byteLength / View.BYTES_PER_ELEMENT,
      );
    }
  }
  // Custom instances may use private fields. Their encoder defines query identity.
  return value;
}
