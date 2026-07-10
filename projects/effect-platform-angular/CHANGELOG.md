# effect-platform-angular changelog

This file records the release history for `@heddendorp/effect-platform-angular`.
Knope generates new entries from change files in `.changeset/`.

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
