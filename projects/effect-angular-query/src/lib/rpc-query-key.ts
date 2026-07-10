import type { Json, JsonObject } from 'effect/Schema';

import type { RpcQueryKey, RpcQueryKeyMeta, RpcQueryKeyType } from './rpc-query-types';

export type RpcKeyPrefix = string | readonly string[];

export type RpcQueryInputEncoder<TInput> = (input: TInput) => Json;

export type RpcQueryKeyOptions<TInput> = {
  readonly input?: TInput;
  /**
   * Overrides the built-in canonical encoder. The result must be deterministic JSON for values
   * that should share a cache entry.
   */
  readonly inputEncoder?: RpcQueryInputEncoder<TInput>;
  readonly keyPrefix?: RpcKeyPrefix;
  readonly type?: RpcQueryKeyType;
};

const KEY_VALUE_TAG = '__effectAngularQueryKeyValue';
const KEY_VALUE_VERSION = 'v1';

type EncodingFailureReason = 'circular-value' | 'unsupported-value';

/** Raised when an RPC input cannot be represented as a deterministic TanStack Query key. */
export class RpcQueryKeyEncodingError extends Error {
  override readonly name = 'RpcQueryKeyEncodingError';

  constructor(
    readonly reason: EncodingFailureReason,
    readonly path: string,
    message: string,
  ) {
    super(`Cannot encode RPC query input at ${path}: ${message}`);
  }
}

const tagged = (tag: string, ...values: readonly Json[]): JsonObject => ({
  [KEY_VALUE_TAG]: [KEY_VALUE_VERSION, tag, ...values],
});

const formatPath = (path: readonly (string | number)[]): string =>
  path.length === 0
    ? '$'
    : path.reduce<string>(
        (current, segment) =>
          typeof segment === 'number'
            ? `${current}[${segment}]`
            : `${current}.${JSON.stringify(segment)}`,
        '$',
      );

const compareCanonicalJson = (left: Json, right: Json): number => {
  const leftJson = JSON.stringify(left);
  const rightJson = JSON.stringify(right);
  return leftJson < rightJson ? -1 : leftJson > rightJson ? 1 : 0;
};

const isPlainObject = (value: object): boolean => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const canonicalize = (
  input: unknown,
  ancestors: WeakSet<object>,
  path: readonly (string | number)[],
): Json => {
  if (input === null || typeof input === 'string' || typeof input === 'boolean') {
    return input;
  }

  if (typeof input === 'number') {
    if (Number.isNaN(input)) {
      return tagged('number', 'NaN');
    }
    if (input === Number.POSITIVE_INFINITY) {
      return tagged('number', 'Infinity');
    }
    if (input === Number.NEGATIVE_INFINITY) {
      return tagged('number', '-Infinity');
    }
    if (Object.is(input, -0)) {
      return tagged('number', '-0');
    }
    return input;
  }

  if (typeof input === 'undefined') {
    return tagged('undefined');
  }

  if (typeof input === 'bigint') {
    return tagged('bigint', input.toString());
  }

  if (typeof input === 'function' || typeof input === 'symbol') {
    throw new RpcQueryKeyEncodingError(
      'unsupported-value',
      formatPath(path),
      `values of type ${typeof input} are not supported`,
    );
  }

  if (ancestors.has(input)) {
    throw new RpcQueryKeyEncodingError(
      'circular-value',
      formatPath(path),
      'circular references are not supported',
    );
  }

  ancestors.add(input);

  try {
    if (Array.isArray(input)) {
      return Array.from({ length: input.length }, (_, index) =>
        Object.hasOwn(input, index)
          ? canonicalize(input[index], ancestors, [...path, index])
          : tagged('array-hole'),
      );
    }

    if (input instanceof Date) {
      const time = input.getTime();
      return tagged('date', Number.isNaN(time) ? 'Invalid Date' : input.toISOString());
    }

    if (input instanceof URL) {
      return tagged('url', input.href);
    }

    if (input instanceof RegExp) {
      return tagged('regexp', input.source, input.flags);
    }

    if (input instanceof Map) {
      const entries = Array.from(input.entries(), ([key, value], index) => {
        const canonicalEntry: Json = [
          canonicalize(key, ancestors, [...path, `map-key-${index}`]),
          canonicalize(value, ancestors, [...path, `map-value-${index}`]),
        ];
        return canonicalEntry;
      }).sort(compareCanonicalJson);

      return tagged('map', entries);
    }

    if (input instanceof Set) {
      const values = Array.from(input.values(), (value, index) =>
        canonicalize(value, ancestors, [...path, `set-value-${index}`]),
      ).sort(compareCanonicalJson);

      return tagged('set', values);
    }

    if (input instanceof ArrayBuffer) {
      return tagged('bytes', 'ArrayBuffer', Array.from(new Uint8Array(input)));
    }

    if (ArrayBuffer.isView(input)) {
      const bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      return tagged('bytes', input.constructor.name, Array.from(bytes));
    }

    const symbolKeys = Object.getOwnPropertySymbols(input);
    if (symbolKeys.length > 0) {
      throw new RpcQueryKeyEncodingError(
        'unsupported-value',
        formatPath(path),
        'symbol-keyed properties are not supported',
      );
    }

    if (!isPlainObject(input)) {
      const constructorName = input.constructor?.name ?? 'unknown';
      throw new RpcQueryKeyEncodingError(
        'unsupported-value',
        formatPath(path),
        `instances of ${constructorName} are not supported; provide inputEncoder to encode this value`,
      );
    }

    const record = input as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => [key, canonicalize(record[key], ancestors, [...path, key])] as const);

    if (!Object.hasOwn(input, KEY_VALUE_TAG)) {
      return Object.fromEntries(entries) as JsonObject;
    }

    return tagged('escaped-object', entries);
  } finally {
    ancestors.delete(input);
  }
};

/**
 * Converts supported Effect/RPC payload values into deterministic, collision-resistant JSON.
 * Ordinary JSON objects and arrays retain their existing key shape.
 */
export const canonicalizeRpcQueryInput = (input: unknown): Json =>
  canonicalize(input, new WeakSet(), []);

const normalizeKeyPrefix = (keyPrefix?: RpcKeyPrefix): readonly string[] => {
  if (!keyPrefix) {
    return [];
  }
  return typeof keyPrefix === 'string' ? [keyPrefix] : keyPrefix;
};

const createMetadata = <TInput>(
  input: TInput | undefined,
  type: RpcQueryKeyType | undefined,
  inputEncoder: RpcQueryInputEncoder<TInput> | undefined,
): RpcQueryKeyMeta<TInput> => {
  return {
    ...(input !== undefined
      ? { input: canonicalizeRpcQueryInput(inputEncoder ? inputEncoder(input) : input) }
      : {}),
    ...(type !== undefined ? { type } : {}),
  };
};

/**
 * Builds a TanStack Query key for RPC procedures with optional input metadata.
 */
export const createRpcQueryKey = <TInput>(
  pathSegments: readonly string[],
  options: RpcQueryKeyOptions<TInput> = {},
): RpcQueryKey<TInput> => {
  const prefix = normalizeKeyPrefix(options.keyPrefix);
  const combined = prefix.length > 0 ? [...prefix, ...pathSegments] : [...pathSegments];

  return [combined, createMetadata(options.input, options.type, options.inputEncoder)];
};
