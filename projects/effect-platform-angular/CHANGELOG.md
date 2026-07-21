# effect-platform-angular changelog

This file records the release history for `@heddendorp/effect-platform-angular`.
Knope generates new entries from change files in `.changeset/`.

## 0.1.0 (2026-07-21)

### Breaking Changes

#### Changed

- Require Angular 22.0.6 or newer within the Angular 22 release line and Effect 4.0.0-beta.97.

#### Migration

- Upgrade applications to Angular 22.0.6 and TypeScript 6.0.3, use a supported Node.js release, and install `effect@4.0.0-beta.97` before updating either package.

#### Changed

- Preserve binary stream request bodies, cap buffered uploads at a configurable 16 MiB by default, report upload-limit failures as non-retryable encoding errors, support an explicit SSR base URL with typed invalid-URL failures, and fail bodyless or prematurely completed Angular responses without hanging.
- Reject framed RPC serializers with `UnsupportedRpcSerializationError` because Angular `HttpClient` cannot progressively deliver those responses.

#### Migration

- Set `maxBufferedRequestBodyBytes` when calling `provideEffectHttpClient(...)` if an application intentionally sends larger buffered uploads, or use a streaming-capable transport.
- Configure `baseUrl` for relative URLs during SSR.
- Use unframed JSON RPC serialization with the Angular HTTP adapter; move framed or streaming RPC procedures to a streaming-capable protocol.

### Fixes

- Include MIT license metadata and the full license text in both npm packages.

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

## 0.0.9 (2026-05-06)

### Features

- Migrate the Angular integrations to Effect v4 beta. Consumers should use `effect` v4
  unstable HTTP/RPC imports instead of the old `@effect/platform` and `@effect/rpc` packages.

## 0.0.8 (2026-02-20)

### Fixes

- Fix HttpClient adapter request body encoding for Effect `HttpBody.Uint8Array`: JSON content is
  now sent as text for `application/json`, while non-JSON bytes are sent as `ArrayBuffer` to
  preserve binary semantics.

## 0.0.7 (2026-02-14)

### Fixes

- Add Angular DI providers for Effect `Layer` tokens: `EFFECT_HTTP_CLIENT_LAYER` and
  `EFFECT_RPC_PROTOCOL_HTTP_LAYER`, including an Angular-HttpClient-backed RPC protocol layer
  helper and README usage/order docs.

## 0.0.6 (2026-02-11)

### Fixes

- Trigger a new release for both packages after release workflow publish-guard updates.

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

- Map Angular HttpClient responses to Effect responses.
- Map Effect requests to Angular HttpClient requests.
- Add the Effect HttpClient provider.

### Fixes

- Install dependencies before package dry-runs in the prepare workflow.
- Align Knope configuration with the required pull request body.
- Install Knope from the `knope/v0.22.2` release.
