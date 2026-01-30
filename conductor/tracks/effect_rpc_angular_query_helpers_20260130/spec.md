# Specification

## Overview
Build an Angular-native integration between the Effect RPC client and TanStack Query's `@tanstack/angular-query-experimental` package that provides helper APIs to generate the `queryKey`, `queryFn`, and `queryOptions` required by `injectQuery`, using defaults from the RPC client configuration. The integration should be minimal and focused on wrapping as little as possible, while still offering a simple setup for consumers.

## Functional Requirements
1. Provide an Angular-injectable helper service that exposes per-procedure helpers for:
   - `queryKey`
   - `queryFn`
   - `queryOptions` composed from client defaults
2. The helper service must be constructed from an Effect RPC client configuration and expose per-call overrides that merge with defaults.
3. Default `queryKey` shape must be structured as:
   - `[pathSegments, { input?, type? }]`
   - Optional `keyPrefix` support that prepends a namespace when configured.
4. The helpers must target `injectQuery` usage in `@tanstack/angular-query-experimental` and return options compatible with `injectQuery`.
5. Attach metadata on options (e.g., `rpc: { path }`) for traceability/debugging.
6. Provide path-level helpers (e.g., `pathKey`/`queryFilter`) to support invalidation across a route subtree.

## Non-Functional Requirements
- Minimal setup: no automatic TanStack Query client wiring; consumers handle their own Query client setup.
- Maintain Angular-native ergonomics (injectable service, idiomatic APIs).
- Strong typing for procedure inputs/outputs and query options.
- Must align with Angular 21+ and project TypeScript strictness.

## Acceptance Criteria
- Consumers can inject a service and call `<procedure>.queryOptions(input, overrides)` to get a fully-typed object usable with `injectQuery`.
- `queryKey` and `queryFn` are available per procedure and derived from the RPC client config.
- `queryKey` is structured by path segments and input and supports an optional `keyPrefix`.
- Options include attached `rpc` metadata with the procedure path.
- Path-level helpers (`pathKey`/`queryFilter`) are available for invalidating related queries.
- Overrides merge cleanly with client defaults for each call.
- No infinite query helpers are included in this track.

## Out of Scope
- Infinite query helpers and pagination helpers.
- Automatic TanStack Query client provisioning or global configuration.
- Mutations or subscriptions (only `injectQuery` helpers are in scope).
- Additional integrations beyond Effect RPC + TanStack Query angular-query-experimental.
