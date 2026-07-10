import type { QueryFilters } from '@tanstack/angular-query-experimental';

import { createRpcQueryKey } from './rpc-query-key';
import type { RpcKeyPrefix } from './rpc-query-key';

export type RpcPathKey = readonly [readonly string[]];

export type RpcPathOptions = {
  readonly keyPrefix?: RpcKeyPrefix;
};

export type RpcQueryFilterOptions = RpcPathOptions & {
  /** Match only this procedure path while still accepting every input key for it. */
  readonly exact?: boolean;
};

const hasExactPath = (queryKey: readonly unknown[], path: readonly string[]): boolean => {
  const candidate = queryKey[0];
  return (
    Array.isArray(candidate) &&
    candidate.length === path.length &&
    candidate.every((segment, index) => segment === path[index])
  );
};

export const createRpcPathKey = (
  pathSegments: readonly string[],
  options: RpcPathOptions = {},
): RpcPathKey => {
  const key = createRpcQueryKey(pathSegments, { keyPrefix: options.keyPrefix });
  return [key[0]];
};

export const createRpcQueryFilter = (
  pathSegments: readonly string[],
  options: RpcQueryFilterOptions = {},
): QueryFilters<RpcPathKey> => {
  const queryKey = createRpcPathKey(pathSegments, { keyPrefix: options.keyPrefix });
  const filter: QueryFilters<RpcPathKey> = {
    queryKey,
  };

  if (options.exact) {
    filter.predicate = (query) => hasExactPath(query.queryKey, queryKey[0]);
  }

  return filter;
};
