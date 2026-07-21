# effect-angular-query changelog

This file records the release history for `@heddendorp/effect-angular-query`.
Knope generates new entries from change files in `.changeset/`.

## 0.2.0 (2026-07-21)

### Breaking Changes

#### Changed

- Require Angular 22.0.6 or newer within the Angular 22 release line and Effect 4.0.0-beta.97.

#### Migration

- Upgrade applications to Angular 22.0.6 and TypeScript 6.0.3, use a supported Node.js release, and install `effect@4.0.0-beta.97` before updating either package.

#### Changed

- Require every RPC procedure to use `asRpcQuery(...)` or `asRpcMutation(...)`, preserve that intent through fluent RPC/group composition including `setPayload(...)`, and reject hostile, reserved, or prefix-colliding tags before creating helpers.
- Require `rpcLayer` to provide the protocol, required client middleware, and schema services for the complete group; middleware and layer-acquisition failures now remain in procedure error types.
- Retain one scoped RPC client per Angular injector, preserve caller-local RPC headers and tracing context, forward TanStack cancellation, return typed stream failures, and restrict factory defaults to options that are safe across heterogeneous procedures.
- Canonically encode query inputs while preserving schema-visible `Map` and `Set` insertion order, preserve TanStack `DataTag` and `select` inference, and make `exact: true` filters match one procedure path across all of its inputs.

#### Migration

- Wrap every procedure explicitly with `asRpcQuery(...)` or `asRpcMutation(...)` before adding it to the group.
- Merge required client-middleware and schema-service layers into `rpcLayer`; handle its construction error in the generated procedure error union.
- Move `select`, `initialData`, and data/error-dependent callbacks from factory-wide defaults into each procedure's `queryOptions(...)` overrides.
- If an RPC input contains a custom class, pass a deterministic `inputEncoder` to `queryKey(...)` and `queryOptions(...)`.
- If a procedure treats `Map` or `Set` insertion order as insignificant, use `inputEncoder` to normalize it explicitly.

### Fixes

- Include MIT license metadata and the full license text in both npm packages.

#### Automated Dependabot dependency update for PR #36.

#### Updated dependencies

- @tanstack/angular-query-experimental: 5.100.9 -> 5.101.2

Update type: version-update:semver-minor

#### Automated Dependabot dependency update for PR #49.

#### Updated dependencies

- @angular/build: 22.0.6 -> 22.0.7
- @angular/cli: 22.0.6 -> 22.0.7
- @angular/common: 22.0.6 -> 22.0.7
- @angular/compiler: 22.0.6 -> 22.0.7
- @angular/compiler-cli: 22.0.6 -> 22.0.7
- @angular/core: 22.0.6 -> 22.0.7
- @angular/forms: 22.0.6 -> 22.0.7
- @angular/platform-browser: 22.0.6 -> 22.0.7
- @angular/router: 22.0.6 -> 22.0.7

Update type: version-update:semver-patch

#### Automated Dependabot dependency update for PR #50.

#### Updated dependencies

- @tanstack/angular-query-experimental: 5.101.2 -> 5.101.3

Update type: version-update:semver-patch

## 0.1.4 (2026-05-06)

### Features

- Migrate the Angular integrations to Effect v4 beta. Consumers should use `effect` v4
  unstable HTTP/RPC imports instead of the old `@effect/platform` and `@effect/rpc` packages.

## 0.1.3 (2026-02-21)

### Fixes

- Align generated client helper types with runtime nested path helpers for dotted RPC tags (for
  example, `client.finance.receipts.my`) instead of exposing flattened dotted keys under a single
  prefix property.

## 0.1.2 (2026-02-19)

### Fixes

- Switch RPC procedure execution to flat-tag invocation (`RpcClient.make(..., { flatten: true })`)
  and remove path-walk-based client member resolution so requests use explicit RPC tags.

## 0.1.1 (2026-02-11)

### Fixes

- Trigger a new release for both packages after release workflow publish-guard updates.

## 0.1.0 (2026-02-11)

### Breaking Changes

#### Redesign the RPC integration

Redesign the RPC integration around a single injectable client factory that automatically
exposes query and mutation helpers for procedures, adds typed mutation utilities, and includes
direct call helpers with explicit stream-procedure errors.

#### Changed

- Replace query-only provider/service setup with `createEffectRpcAngularClient(...)`.
- Add explicit procedure markers (`asRpcQuery`, `asRpcMutation`) to control generated helper
  surfaces.
- Add generated mutation helpers (`mutationKey`, `mutationFn`, `mutationOptions`) next to query
  helpers.
- Keep typed expected errors as a union of schema errors and `RpcClientError`.
- Throw explicit runtime errors for stream procedures in this integration surface.

#### Migration

1. Replace `provideEffectRpcQueryClient({ ... })` with
   `const AppRpc = createEffectRpcAngularClient({ ... })`, then register `AppRpc.providers`.
2. Replace `inject(EffectRpcQueryClient)` and `helpersFor(AppRpcs)` with `AppRpc.injectClient()`.
3. Replace `helpers.users.get.queryOptions(...)` with
   `AppRpc.injectClient().users.get.queryOptions(...)`.
4. Replace `defaults` with `queryDefaults` and `mutationDefaults`.
5. Wrap mutation procedures with `asRpcMutation(...)` to expose mutation helpers.
6. Use `injectMutation(() => rpc.<path>.mutationOptions())` at mutation call sites.

## 0.0.5 (2026-02-07)

### Fixes

- Small maintenance release to validate the automated release workflow.

## 0.0.4 (2026-02-07)

### Fixes

- Exclude the guidance file from Knope parsing.

### Changed

- Switched release publishing from JSR to npm with trusted publishing (OIDC).
- Updated package metadata for public scoped npm publishing and repository links.
- Aligned release validation and documentation with the Knope-based npm release flow.

## 0.0.3 (2026-02-07)

### Features

#### Added

- Initial open-source release pipeline with Knope and GitHub Actions.
- Community health documentation (license, code of conduct, contributing, and security).
- Root project documentation and package overview for the Effect Angular libraries.

## 0.0.2 (2026-02-07)

### Features

- Add typed helper access.
- Add query peer dependencies.
- Update public API exports.
- Add RPC query helpers.
- Add the RPC query client configuration.
- Add the RPC query options factory.
- Add the RPC query key builder.
- Add RPC query type adapters.

### Fixes

- Install dependencies before package dry-runs in the prepare workflow.
- Align Knope configuration with the required pull request body.
- Install Knope from the `knope/v0.22.2` release.
