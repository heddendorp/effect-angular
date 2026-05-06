import * as Schema from 'effect/Schema';
import { Rpc, RpcGroup } from 'effect/unstable/rpc';

import { asRpcMutation, asRpcQuery } from '../lib/effect-rpc-query-client';

export const GetUser = Rpc.make('users.get', {
  payload: Schema.Struct({ id: Schema.String }),
  success: Schema.Struct({ name: Schema.String }),
});

export const UpdateUserName = Rpc.make('users.updateName', {
  payload: Schema.Struct({ id: Schema.String, name: Schema.String }),
  success: Schema.Struct({ ok: Schema.Boolean }),
});

export class AppRpcs extends RpcGroup.make(asRpcQuery(GetUser), asRpcMutation(UpdateUserName)) {}
