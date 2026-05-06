import { TestBed } from '@angular/core/testing';
import * as Effect from 'effect/Effect';
import * as FileSystem from 'effect/FileSystem';
import * as Layer from 'effect/Layer';
import * as Path from 'effect/Path';
import * as Schema from 'effect/Schema';
import { Etag, FetchHttpClient, HttpPlatform, HttpRouter } from 'effect/unstable/http';
import { Rpc, RpcClient, RpcGroup, RpcSerialization, RpcServer } from 'effect/unstable/rpc';

import { createEffectRpcAngularClient } from './effect-rpc-query-client';

const EventList = Rpc.make('events.eventList', {
  payload: Schema.Struct({ limit: Schema.Number }),
  success: Schema.Struct({ total: Schema.Number }),
});

class AppRpcs extends RpcGroup.make(EventList) {}

const AppRpcsLive = AppRpcs.toLayer(
  Effect.succeed({
    'events.eventList': ({ limit }) => Effect.succeed({ total: limit + 1 }),
  }),
);

const parseRequestTag = (bodyText: string): string | undefined => {
  try {
    const parsed = JSON.parse(bodyText) as
      | { _tag?: string; tag?: string }
      | Array<{ _tag?: string; tag?: string }>;
    const messages = Array.isArray(parsed) ? parsed : [parsed];
    const requestMessage = messages.find((message) => message?._tag === 'Request');
    return requestMessage?.tag;
  } catch {
    return undefined;
  }
};

describe('Effect RPC Angular client integration with RpcServer', () => {
  it('calls a real RPC HTTP server with dotted tags', async () => {
    const fileSystemLayer = FileSystem.layerNoop({});
    const httpPlatformLayer = HttpPlatform.layer.pipe(Layer.provide(fileSystemLayer));

    const webHandler = HttpRouter.toWebHandler(
      RpcServer.layerHttp({ group: AppRpcs, path: '/rpc', protocol: 'http' }).pipe(
        Layer.provideMerge(
          Layer.mergeAll(
            AppRpcsLive,
            RpcSerialization.layerJson,
            Path.layer,
            fileSystemLayer,
            Etag.layer,
            httpPlatformLayer,
          ),
        ),
      ),
      { disableLogger: true },
    );
    let observedTag: string | undefined;

    const fetchFromRpcServer: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      observedTag = parseRequestTag(await request.clone().text());
      return webHandler.handler(request);
    };

    const rpcLayer = RpcClient.layerProtocolHttp({ url: 'http://rpc.test/rpc' }).pipe(
      Layer.provideMerge([
        RpcSerialization.layerJson,
        FetchHttpClient.layer.pipe(
          Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetchFromRpcServer)),
        ),
      ]),
    );

    const rpcClient = createEffectRpcAngularClient({
      group: AppRpcs,
      rpcLayer,
    });

    TestBed.configureTestingModule({ providers: [rpcClient.providers] });

    const client = TestBed.runInInjectionContext(() => rpcClient.injectClient());
    const result = await client.events.eventList.call({ limit: 2 });

    expect(result).toEqual({ total: 3 });
    expect(observedTag).toBe('events.eventList');

    await webHandler.dispose();
  });
});
