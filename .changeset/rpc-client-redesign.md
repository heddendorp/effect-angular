---
effect-angular-query: major
---

Redesign the RPC integration around a single injectable client factory that auto-exposes query and mutation helpers for procedures, adds typed mutation utilities, and includes direct call helpers with explicit stream-procedure errors.

### Version bump

- `@heddendorp/effect-angular-query`: **major** (expected `0.0.x` -> `0.1.0`)

### Changed

- Replace query-only provider/service setup with `createEffectRpcAngularClient(...)`.
- Add explicit procedure markers (`asRpcQuery`, `asRpcMutation`) to control generated helper surfaces.
- Add generated mutation helpers (`mutationKey`, `mutationFn`, `mutationOptions`) next to query helpers.
- Keep typed expected errors as a union of schema errors and `RpcClientError`.
- Throw explicit runtime errors for stream procedures in this integration surface.

### Migration

1. Replace provider registration:
   - Old: `provideEffectRpcQueryClient({ ... })`
   - New: `const AppRpc = createEffectRpcAngularClient({ ... });` and register `AppRpc.providers`.
2. Replace service injection:
   - Old: `inject(EffectRpcQueryClient)` + `helpersFor(AppRpcs)`
   - New: `AppRpc.injectClient()`
3. Replace procedure access:
   - Old: `helpers.users.get.queryOptions(...)`
   - New: `AppRpc.injectClient().users.get.queryOptions(...)`
4. Move defaults:
   - Old: `defaults`
   - New: `queryDefaults` and `mutationDefaults`
5. Mark mutations:
   - Wrap mutation procedures with `asRpcMutation(...)` to expose mutation helpers.
6. Update mutation call sites:
   - Use `injectMutation(() => rpc.<path>.mutationOptions())`.
