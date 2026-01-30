import type { QueryFilters } from '@tanstack/angular-query-experimental';

import { createRpcQueryKey } from './rpc-query-key';
import type { RpcKeyPrefix } from './rpc-query-key';

export type RpcPathKey = readonly [readonly string[]];

export type RpcPathOptions = {
  readonly keyPrefix?: RpcKeyPrefix;
};

export type RpcQueryFilterOptions = RpcPathOptions & {
  readonly exact?: boolean;
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
  const filter: QueryFilters<RpcPathKey> = {
    queryKey: createRpcPathKey(pathSegments, { keyPrefix: options.keyPrefix }),
  };

  if (options.exact !== undefined) {
    filter.exact = options.exact;
  }

  return filter;
};
