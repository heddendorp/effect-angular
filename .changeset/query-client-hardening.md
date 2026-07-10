---
effect-angular-query: major
---

### Changed

- Require every RPC procedure to use `asRpcQuery(...)` or `asRpcMutation(...)`, preserve that intent through fluent RPC/group composition including `setPayload(...)`, and reject hostile, reserved, or prefix-colliding tags before creating helpers.
- Require `rpcLayer` to provide the protocol, required client middleware, and schema services for the complete group; middleware and layer-acquisition failures now remain in procedure error types.
- Retain one scoped RPC client per Angular injector, preserve caller-local RPC headers and tracing context, forward TanStack cancellation, return typed stream failures, and restrict factory defaults to options that are safe across heterogeneous procedures.
- Canonically encode query inputs while preserving schema-visible `Map` and `Set` insertion order, preserve TanStack `DataTag` and `select` inference, and make `exact: true` filters match one procedure path across all of its inputs.

### Migration

- Wrap every procedure explicitly with `asRpcQuery(...)` or `asRpcMutation(...)` before adding it to the group.
- Merge required client-middleware and schema-service layers into `rpcLayer`; handle its construction error in the generated procedure error union.
- Move `select`, `initialData`, and data/error-dependent callbacks from factory-wide defaults into each procedure's `queryOptions(...)` overrides.
- If an RPC input contains a custom class, pass a deterministic `inputEncoder` to `queryKey(...)` and `queryOptions(...)`.
- If a procedure treats `Map` or `Set` insertion order as insignificant, use `inputEncoder` to normalize it explicitly.
