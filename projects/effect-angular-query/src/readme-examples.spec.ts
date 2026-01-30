import { InjectionToken, inject, signal, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectQuery, provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import * as RpcClient from '@effect/rpc/RpcClient';
import * as RpcGroup from '@effect/rpc/RpcGroup';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

import {
  EffectRpcQueryClient,
  provideEffectRpcQueryClient,
  type RpcQueryHelpers,
} from './lib/effect-rpc-query-client';
import { AppRpcs } from './testing/rpc-contracts';

const createRpcLayer = () =>
  Layer.effect(
    RpcClient.Protocol,
    RpcClient.Protocol.make(() =>
      Effect.succeed({
        send: () => Effect.succeed(undefined),
        supportsAck: false,
        supportsTransferables: false,
      }),
    ),
  );

const configureBaseProviders = (extraProviders: Provider[] = []) => {
  TestBed.configureTestingModule({
    providers: [
      provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
      provideEffectRpcQueryClient({
        group: AppRpcs,
        rpcLayer: createRpcLayer(),
        keyPrefix: 'app',
        defaults: { staleTime: 10_000 },
      }),
      ...extraProviders,
    ],
  });
};

describe('README examples', () => {
  it('creates injectable helpers once and reuses them', () => {
    const APP_QUERY_HELPERS = new InjectionToken<RpcQueryHelpers<RpcGroup.Rpcs<typeof AppRpcs>>>(
      'APP_QUERY_HELPERS',
    );

    const provideAppQueryHelpers = () => ({
      provide: APP_QUERY_HELPERS,
      useFactory: () => inject(EffectRpcQueryClient).helpersFor(AppRpcs),
    });

    configureBaseProviders([provideAppQueryHelpers()]);

    const helpers = TestBed.runInInjectionContext(() => inject(APP_QUERY_HELPERS));

    expect(helpers.users.get.queryKey({ id: '1' })).toEqual([
      ['app', 'users', 'get'],
      { input: { id: '1' } },
    ]);
  });

  it('uses helpers with injectQuery', () => {
    configureBaseProviders();

    const query = TestBed.runInInjectionContext(() => {
      const rpcQueryClient = inject(EffectRpcQueryClient);
      const helpers = rpcQueryClient.helpersFor(AppRpcs);
      const userId = signal('1');

      return injectQuery(() =>
        helpers.users.get.queryOptions(
          { id: userId() },
          { overrides: { staleTime: 10_000 } },
        ),
      );
    });

    expect(query).toBeTruthy();
    expect(typeof query.isPending).toBe('function');
  });

  it('builds query keys and path filters as documented', () => {
    configureBaseProviders();

    const rpcQueryClient = TestBed.inject(EffectRpcQueryClient);
    const helpers = rpcQueryClient.helpersFor(AppRpcs);

    expect(helpers.users.get.queryKey({ id: '1' })).toEqual([
      ['app', 'users', 'get'],
      { input: { id: '1' } },
    ]);

    expect(rpcQueryClient.queryFilter(['users'], { exact: false })).toEqual({
      queryKey: [['app', 'users']],
      exact: false,
    });
  });
});
