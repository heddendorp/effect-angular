import type { RpcQueryKey, RpcQueryKeyMeta, RpcQueryKeyType } from './rpc-query-types';

export type RpcKeyPrefix = string | readonly string[];

export type RpcQueryKeyOptions<TInput> = {
  readonly input?: TInput;
  readonly keyPrefix?: RpcKeyPrefix;
  readonly type?: RpcQueryKeyType;
};

const normalizeKeyPrefix = (keyPrefix?: RpcKeyPrefix): readonly string[] => {
  if (!keyPrefix) {
    return [];
  }
  return typeof keyPrefix === 'string' ? [keyPrefix] : keyPrefix;
};

const createMetadata = <TInput>(
  input: TInput | undefined,
  type: RpcQueryKeyType | undefined,
): RpcQueryKeyMeta<TInput> => {
  return {
    ...(input !== undefined ? { input } : {}),
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

  return [combined, createMetadata(options.input, options.type)];
};
