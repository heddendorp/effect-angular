# Project Review — 2026-07-10

## Executive summary

At the review baseline, the workspace was compact, modern, and well tested on its main unary HTTP/RPC paths. The Angular 22 and Effect 4 beta upgrades built cleanly, and all 56 then-existing tests passed.

The review found no P0/critical product issues. It found 7 P1/high-priority issues, 18 P2/medium-priority issues, and 4 P3/low-priority issues. The most urgent work is to lock npm publishing to reviewed `main` releases, preserve required Effect RPC middleware and schema requirements in the public types, fix streamed request serialization, update the vulnerable Vitest browser toolchain, validate RPC tag trees before building helpers, and add CI for ordinary pull requests.

## Remediation status

The `codex/project-review-hardening` remediation addressed all 29 code, test, packaging, workflow,
and repository-control findings. GitHub's first `quality` check succeeded, and repository ruleset
`Protect main` (ID `18776227`) now requires that app-bound check on pull requests while blocking
direct pushes, branch deletion, and force pushes. Private vulnerability reporting is also enabled.

|   # | Status   | Resolution evidence                                                                                                                                                            |
| --: | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|   1 | Resolved | Publishing no longer supports manual refs and accepts only a merged, same-repository `knope/release` pull request commit.                                                      |
|   2 | Resolved | Stream request bodies are sent as `ArrayBuffer`; Angular `serializeBody()` wire bytes have regression coverage.                                                                |
|   3 | Resolved | The generated client requires protocol, client middleware, and schema services in `rpcLayer`, and preserves middleware/layer errors in public types.                           |
|   4 | Resolved | Procedure intent is carried by the payload-schema type through RPC and group composition; re-marking replacement is covered at compile time and runtime.                       |
|   5 | Resolved | A pre-materialization trie rejects prefix, reserved-name, empty-segment, and order-dependent tag collisions.                                                                   |
|   6 | Resolved | General `CI / quality` validates every pull-request head and `main` push; active ruleset `Protect main` requires the verified `quality` check from GitHub Actions app `15368`. |
|   7 | Resolved | Vitest packages are aligned at 4.1.10 and the high/critical `bun audit` gate passes without ignored advisories.                                                                |
|   8 | Resolved | Hostile tag segments are rejected and every generated namespace uses a null prototype.                                                                                         |
|   9 | Resolved | Query inputs use deterministic, type-aware canonical JSON with collision/crash regression tests and an `inputEncoder` escape hatch.                                            |
|  10 | Resolved | TanStack abort signals interrupt in-flight Effect/RPC work and pre-aborted signals never start transport work.                                                                 |
|  11 | Resolved | 204, 205, and 304 bodies normalize to `null`; response-conversion failures enter the typed transport error channel.                                                            |
|  12 | Resolved | Angular completion without a response now fails with a typed transport error instead of leaving an Effect pending.                                                             |
|  13 | Resolved | Query options delegate to TanStack overloads, retain `DataTag`/`select` inference, and restrict heterogeneous factory defaults.                                                |
|  14 | Resolved | One `ManagedRuntime` and scoped RPC client are retained per Angular injector and disposed exactly once by `DestroyRef`.                                                        |
|  15 | Resolved | The HTTP protocol uses `Layer.provide`; tests prove internal client and serialization services do not leak or override outer services.                                         |
|  16 | Resolved | Framed serializers fail layer construction with `UnsupportedRpcSerializationError`; buffered unary response support is explicit in documentation.                              |
|  17 | Resolved | An injectable/factory `baseUrl` resolves relative URLs during SSR after RPC URL preprocessing.                                                                                 |
|  18 | Resolved | Upload chunks are collected in linear time with one final allocation and a configurable finite 16 MiB default limit.                                                           |
|  19 | Resolved | Exact filters use a path predicate and match one procedure across every encoded input.                                                                                         |
|  20 | Resolved | Every workflow action is pinned to a verified full commit SHA; persisted credentials and early write-token exposure are regression-tested.                                     |
|  21 | Resolved | General CI covers every final head; tested Dependabot scoping skips dev tooling, maps affected packages, and parses `prevVersion`.                                             |
|  22 | Resolved | Broken app/Karma commands were replaced by explicit library build/test watches and matching VS Code tasks.                                                                     |
|  23 | Resolved | Knope 0.22.2 validates package-specific changelogs; the stale root changelog and dead smoke changeset were removed.                                                            |
|  24 | Resolved | `SECURITY.md` and the Code of Conduct use GitHub private reporting, which is enabled and verified for the repository.                                                          |
|  25 | Resolved | Every procedure must explicitly use `asRpcQuery(...)` or `asRpcMutation(...)`; unclassified procedures fail compile-time and runtime validation.                               |
|  26 | Resolved | Stream helpers return a typed failed Effect or rejected Promise and never throw synchronously.                                                                                 |
|  27 | Resolved | Both manifests declare MIT, both tarballs contain byte-identical `LICENSE` files, and the packed artifacts are asserted.                                                       |
|  28 | Resolved | Pinned formatting/linting, strict Effect diagnostics, coverage thresholds, artifact checks, and an isolated tarball consumer are CI/release gates.                             |
|  29 | Resolved | The adapter uses `Effect.void`; strict Effect diagnostics report zero messages.                                                                                                |

## Scope and method

Reviewed:

- All first-party production TypeScript under `projects/`.
- Unit and integration tests, public entry points, type surfaces, package manifests, and generated package contents.
- Angular workspace, TypeScript, editor, Dependabot, release, and GitHub Actions configuration.
- User-facing documentation, contribution/release documentation, changeset handling, and community files.
- Current GitHub branch protection and open pull-request check results through the GitHub API.

Excluded from findings:

- `node_modules/` and generated `dist/` source.
- `repos/effect/`, which is vendored read-only reference material.
- Archived planning material under `conductor/archive/`, except where current top-level documentation points to it.

Validation included clean installs, both package builds, all tests, Effect language-service diagnostics, packed-artifact inspection, static review, and focused runtime/type reproductions for high-risk edge cases.

Priority meanings:

- P0: immediate compromise or data-loss risk.
- P1: high-impact correctness, security, or release-integrity defect.
- P2: material reliability, typing, performance, or workflow gap.
- P3: lower-risk quality, documentation, or packaging improvement.

## P1 — high priority

### 1. Manual release dispatch can publish an arbitrary branch

Evidence: `.github/workflows/release.yml:9`, `:17`, `:22`, `:60`, and `:81`.

`workflow_dispatch` accepts a caller-selected ref, the release condition accepts every manual dispatch, and `actions/checkout` checks out that selected ref before both packages publish with npm trusted-publishing OIDC. A collaborator with repository write access, or a compromised collaborator account, can therefore publish unreviewed code from a branch.

Recommendation: remove manual dispatch from the publishing workflow, or require a protected GitHub environment restricted to `main` and bind npm trusted publishing to that environment. Keep any manual validation workflow separate from the OIDC-enabled publish job.

References: [GitHub manual workflow behavior](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow), [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/).

### 2. Streamed request bodies are corrupted before Angular sends them

Evidence: `projects/effect-platform-angular/src/lib/http-client-adapter.ts:17-40` and `:70`.

The adapter collects an Effect stream into `Uint8Array` and passes that typed array directly to Angular. Angular's `HttpRequest.serializeBody()` treats this value as a JSON-serializable object; a byte payload `[1, 2, 3]` was reproduced on the wire as `{"0":1,"1":2,"2":3}`. Existing tests inspect the value before Angular serializes it, so they miss the corruption.

Recommendation: convert collected bytes to `ArrayBuffer`, as the non-stream `Uint8Array` branch already does, and add a regression test against Angular request serialization.

### 3. Required RPC middleware, schema services, and errors are erased

Evidence: `projects/effect-angular-query/src/lib/effect-rpc-query-client.ts:87-100`, `:117-119`, `:144-149`, and `:314-324`.

The factory accepts only a `Layer<RpcClient.Protocol>`, omits client-middleware errors from `RpcProcedureError`, and force-casts the final Effect to `R = never`. Effect v4 RPC also requires procedure-specific client middleware and schema encode/decode services. Reproductions showed:

- A middleware marked `requiredForClient: true` was omitted while the request still reached transport.
- Payload encoding and success decoding failed at runtime with missing-service defects.
- A middleware `ClientError` occurred at runtime even though the public error type excluded it.

This is especially risky for auth, identity, correlation-header, and policy middleware.

Recommendation: infer and preserve `Rpc.MiddlewareClient<Rpcs>`, `Rpc.ServicesClient<Rpcs>`, layer errors/requirements, and middleware client errors. Remove the `R = never` assertion and require a complete client layer.

### 4. Normal RPC fluent composition loses mutation typing

Evidence: `projects/effect-angular-query/src/lib/effect-rpc-query-client.ts:41-71` and `:232-240`.

Procedure kind is represented in TypeScript by an external intersection brand while runtime classification uses an Effect annotation. Calling `asRpcMutation(Rpc.make(...)).middleware(Audit)` preserves the runtime annotation but loses the brand in the fluent return type. TypeScript then exposes query helpers while runtime exposes only mutation helpers.

Recommendation: use a persistent descriptor/config marker or branded fluent return types. Add compile-time and runtime regression tests for `.middleware`, `.prefix`, and other RPC combinators after classification.

### 5. Prefix-colliding RPC tags create order-dependent, type-unsound clients

Evidence: `projects/effect-angular-query/src/lib/effect-rpc-query-client.ts:251-293`.

The helper builder writes leaves directly into a partially built object tree. With `users.get` declared before `users`, the later leaf replaces the namespace and `client.users.get` disappears even though the generated TypeScript type still exposes it. Reversing declaration order changes the runtime shape. Tags can also collide with helper method names below the root.

Recommendation: validate all tags in a trie before materializing helpers. Either reject prefix/helper-name collisions with a clear factory error or define one deterministic representation that the type surface matches.

### 6. Ordinary pull requests have no test/build CI and `main` is unprotected

Evidence: `.github/workflows/dependabot-validate.yml:22-23`, `.github/workflows/prepare_release_pr.yml:18-19`, and the GitHub branch-protection API response on 2026-07-10.

The dependency workflow is actor-gated to Dependabot and release validation is gated to `knope/release`. Ordinary contributor pull requests can merge without any repository-owned build or test check. GitHub reports `main` as unprotected, and current open Dependabot pull requests show the validation jobs as skipped.

Recommendation: add one general `pull_request` and `push` CI workflow for frozen install, diagnostics, tests, builds, and pack validation. Require it through a `main` ruleset with reviewed pull requests and no direct pushes.

### 7. The checked-in Vitest browser toolchain has critical advisories

Evidence: `package.json:43-48`, `bun.lock`, `bun audit --json`, and `bun pm why @vitest/browser`.

The lockfile resolves `vitest`, `@vitest/browser`, `@vitest/browser-playwright`, and `@vitest/coverage-v8` to 4.1.5. The current Bun audit reports two critical `@vitest/browser` advisories: inline-script injection through `otelCarrier` and an exposed browser-mode API that can proxy CDP and overwrite configuration files. The current patched release is 4.1.10. Additional high/moderate findings are present in dev-only transitive CLI/test packages. The published libraries do not bundle this toolchain, so the immediate exposure is local/CI browser testing rather than downstream runtime code.

Recommendation: update the complete Vitest package set together to 4.1.10, refresh transitive dependencies, rerun the full test/build matrix, and add a high/critical dependency-audit gate. Do not expose Vitest browser mode outside loopback/trusted CI in the meantime.

References: [GHSA-2h32-95rg-cppp](https://github.com/advisories/GHSA-2h32-95rg-cppp), [GHSA-g8mr-85jm-7xhm](https://github.com/advisories/GHSA-g8mr-85jm-7xhm).

## P2 — medium priority

### 8. RPC tags can pollute `Object.prototype`

Evidence: `projects/effect-angular-query/src/lib/effect-rpc-query-client.ts:225`, `:248-249`, `:269-293`, and `:418`.

Dynamic path traversal uses ordinary objects, reads inherited properties, and writes unvalidated segments. A procedure tagged `__proto__.polluted` adds its helper to `Object.prototype`. Tags are normally developer-controlled, so this is not a direct remote exploit, but it is an unsafe public factory boundary and can destabilize the application.

Recommendation: use null-prototype namespace objects, own-property checks, and reject `__proto__`, `prototype`, and `constructor` segments.

### 9. Raw Effect payloads can collide or crash in TanStack query hashing

Evidence: `projects/effect-angular-query/src/lib/rpc-query-key.ts:18-38` and `projects/effect-angular-query/src/lib/effect-rpc-query-client.ts:374-379`.

The raw constructor payload becomes part of the query key. Valid `bigint` payloads make TanStack's default JSON-based hash throw, while distinct `ReadonlyMap` payloads hash identically. A reproduction cached tenant A's value and returned it for tenant B without running tenant B's query function.

Recommendation: canonically encode payloads with the procedure's RPC schema, reject unsupported key values, or require a collision-resistant caller-supplied key encoder.

### 10. TanStack cancellation does not interrupt Effect/RPC work

Evidence: `projects/effect-angular-query/src/lib/effect-rpc-query-client.ts:327` and `:381`.

The generated query function ignores `QueryFunctionContext.signal`, and `Effect.runPromise` is called without `{ signal }`. Removing observers or aborting a TanStack query therefore leaves protocol work running. The current test supplies a signal but never aborts it.

Recommendation: accept the query context and pass its signal to `Effect.runPromise`. Test pre-aborted and in-flight cancellation.

### 11. Bodyless HTTP statuses can throw inside an RxJS callback and hang

Evidence: `projects/effect-platform-angular/src/lib/http-client-adapter.ts:89-101`, `:117`, and `:128`.

Angular can provide a non-null empty `ArrayBuffer` for 205 and 304 responses, but the Fetch `Response` constructor rejects bodies for null-body statuses. The conversion throws before `resume`, producing an unhandled RxJS error while the Effect remains pending.

Recommendation: normalize 204, 205, and 304 bodies to `null`, and catch synchronous response-adaptation failures into a typed `HttpClientError`.

### 12. Completion without an Angular response leaves the Effect pending

Evidence: `projects/effect-platform-angular/src/lib/http-client-adapter.ts:116-143`.

The subscription handles only `next` and `error`. An interceptor returning `EMPTY` completes legally without either event and leaves the Effect unresolved.

Recommendation: track whether a response was emitted and handle `complete` without `next` as a typed transport failure or cancellation.

### 13. Query defaults and `select` typing are unsound

Evidence: `projects/effect-angular-query/src/lib/effect-rpc-query-client.ts:73-85`, `:159-172`, `:357-362`, and `:398-403`.

Factory-wide defaults are typed with TanStack's `DefaultError` and then cast to each procedure's actual result/error. A global callback can safely compile `error.message` even for an RPC whose error is a string, and wrong-shaped `initialData`/`select` results compile. Conversely, per-procedure `TData` is fixed to the RPC success type, so a valid `select: user => user.name` is rejected.

Recommendation: limit global defaults to type-independent options or parameterize a safe common type, use `unknown` for heterogeneous errors, make `queryOptions` generic in selected data, and delegate through TanStack's `queryOptions()` overloads.

### 14. The RPC protocol layer and client are recreated for every call

Evidence: `projects/effect-angular-query/src/lib/effect-rpc-query-client.ts:314-327`.

Each helper call creates `RpcClient.make`, provides the layer, opens a scope, then immediately closes it. Two calls through the same injected Angular singleton acquired and released a scoped protocol twice. This prevents connection pooling and multiplexing for socket/scoped transports.

Recommendation: retain a managed client/runtime for the Angular environment and dispose it with `DestroyRef` or the environment injector.

### 15. The protocol layer exposes and can override internal services

Evidence: `projects/effect-platform-angular/src/lib/effect-rpc-protocol-http-layer.ts:25-35`.

`Layer.provideMerge` retains the injected HTTP client and serialization service in the output even though the public token claims to provide only `RpcClient.Protocol`. The hidden client can override a client intentionally provided outside the layer.

Recommendation: use `Layer.provide` so dependencies remain internal and the runtime output matches the injection-token type.

### 16. Framed/streaming RPC responses are fully buffered

Evidence: `projects/effect-platform-angular/src/lib/http-client-adapter.ts:104-117`.

The adapter requests `arraybuffer` and only emits after Angular's final `HttpResponse`. Finite framed responses lose progressive delivery, and open-ended streams never yield their first item.

Recommendation: implement a genuinely streaming transport, or explicitly reject/document framed serialization and streaming RPC as unsupported by this adapter.

### 17. Relative URLs fail before Angular during SSR

Evidence: `projects/effect-platform-angular/src/lib/http-client-adapter.ts:104-110` and the documented `/rpc` examples.

Effect normalizes the URL before invoking Angular. Without browser `globalThis.location`, a relative `/api` or `/rpc` URL fails with `InvalidUrl`, so Angular SSR interceptors never get a chance to add an origin.

Recommendation: provide an injectable base URL/origin or explicitly document and enforce browser-only support.

### 18. Stream upload buffering is quadratic and unbounded

Evidence: `projects/effect-platform-angular/src/lib/http-client-adapter.ts:17-40`.

Every chunk reallocates and recopies the full accumulated byte sequence. Large chunked uploads cause O(n²) copied bytes; infinite streams never issue a request.

Recommendation: collect chunks and total length, allocate once, enforce/document a size limit, and state that this adapter buffers request streams.

### 19. `exact: true` path filters cannot match generated query keys

Evidence: `projects/effect-angular-query/src/lib/rpc-query-path.ts:16-36`.

The path helper returns a one-element key `[[path]]`, while real query keys contain `[path, metadata]`. Partial matching works; exact matching always finds zero generated queries.

Recommendation: remove the option, accept a complete key/input for exact filtering, or use an explicit predicate that compares the path portion.

### 20. High-privilege workflows use mutable action tags

Evidence: `.github/workflows/release.yml:22-30`, `.github/workflows/prepare_release_pr.yml:23-43`, and `.github/workflows/dependabot-add-changeset.yml:33-45`.

Tag-pinned actions execute with npm OIDC, repository-write PATs, or Dependabot push credentials. A moved or compromised tag could alter published artifacts or exfiltrate a persisted token.

Recommendation: pin every third-party action to a reviewed full commit SHA, remove the release PAT from read-only validation, set `persist-credentials: false`, and expose write credentials only to the final push step.

### 21. Dependabot automation skips final heads and creates noisy releases

Evidence: `.github/workflows/dependabot-validate.yml:23`, `.github/workflows/dependabot-add-changeset.yml:94-116`, and `:155-158`.

The changeset workflow pushes with a PAT, so the resulting synchronize event is no longer authored by `dependabot[bot]` and validation is skipped. Any root manifest/lock update also bumps both libraries, including tooling-only and TanStack-only changes. Release-note parsing reads `previousVersion`, but Dependabot exposes `prevVersion`, producing `unknown` versions.

Recommendation: validate by pull-request author or, preferably, let general CI cover every head. Map dependency groups to affected packages, skip changesets for development-only updates, and parse `prevVersion` with non-empty fallbacks.

### 22. Checked-in development commands and launch tasks are broken

Evidence: `package.json:6-8`, `.vscode/launch.json:5-20`, and `.vscode/tasks.json`.

The workspace has only library targets, so `start` (`ng serve`) has no project to serve and `watch` does not select a library. The VS Code Chrome launch targets the broken start task and an obsolete Karma debug URL even though tests use Vitest.

Recommendation: remove stale application launch tasks, add explicit watch scripts per library, or add a maintained example application that provides real serve and browser-integration targets.

### 23. Release history and the smoke changeset are stale

Evidence: `CHANGELOG.md:1-27`, `knope.toml:1-10`, and `release-smoke-test.md:1-6`.

The root changelog promises all notable changes but stops at root version 0.0.2 while package versions are 0.0.9 and 0.1.4. Knope has no changelog configuration. `release-smoke-test.md` has changeset syntax but sits outside `.changeset/`, so it is dead release input.

Recommendation: configure per-package changelogs from changesets or remove the stale claim/file. Delete or deliberately move the smoke changeset into the active workflow.

### 24. The Code of Conduct reporting address does not resolve

Evidence: `CODE_OF_CONDUCT.md:46-50`; `effect-angular.dev` returned NXDOMAIN during review.

The only private reporting channel is therefore unusable.

Recommendation: replace it with a monitored address and add `SECURITY.md` with supported versions and private vulnerability-reporting instructions.

### 25. Unclassified state-changing RPCs default to replayable queries

Evidence: `projects/effect-angular-query/src/lib/effect-rpc-query-client.ts:232-240` and `:374-405`.

Every unannotated procedure defaults to a TanStack query. A mistakenly unannotated destructive RPC can then refetch on mount, reconnect, or focus and can be retried automatically.

Recommendation: require explicit procedure intent or default unannotated procedures to the mutation surface, which is not automatically executed.

Reference: [TanStack Query important defaults](https://tanstack.com/query/latest/docs/framework/angular/guides/important-defaults).

## P3 — low priority

### 26. Unsupported stream calls throw before returning their advertised abstraction

Evidence: `projects/effect-angular-query/src/lib/effect-rpc-query-client.ts:304-327`.

The stream guard throws synchronously before `callEffect` can return an Effect or `call` can return a Promise. Consumers cannot handle the failure through the documented Effect error channel or Promise rejection path.

Recommendation: exclude stream procedures from the generated type surface, reject them once during factory creation, or return a typed failed Effect/rejected Promise.

### 27. Published packages omit license metadata and the license file

Evidence: both `projects/*/package.json` and both `projects/*/ng-package.json` files.

Fresh `npm pack --dry-run --json` output contains only README, FESM, source map, package manifest, and declarations. Neither manifest has a `license` field and neither tarball contains the root MIT license.

Recommendation: add `"license": "MIT"`, copy the root `LICENSE` through each ng-packagr asset configuration, and assert the packed artifact contents.

### 28. Formatting, linting, coverage, and consumer checks are not reproducible gates

Evidence: `package.json:4-49` and `.github/workflows/prepare_release_pr.yml:48-65`.

Prettier configuration exists without a pinned Prettier dependency or script. There is no lint script, coverage threshold, language-service CI step, or temporary consumer fixture that installs the produced tarballs. Release readiness only performs pack dry-runs.

Recommendation: pin the chosen formatter/linter, add `format:check`, Effect diagnostics, coverage thresholds, and a small consumer smoke project that installs and imports both packed libraries.

### 29. Effect diagnostics report one style-level message

Evidence: `projects/effect-platform-angular/src/lib/http-client-adapter.ts:60`.

The Effect language service recommends `Effect.void` instead of `Effect.succeed(undefined)`. This is not a correctness issue.

Recommendation: adopt the idiom when the adapter is next modified.

## Strengths

- TypeScript strictness is strong; production source contains no `any` and only narrowly scoped casts.
- Angular DI usage is modern and functional, with small providers and focused modules.
- Public entry points are compact, packages declare `sideEffects: false`, and Angular packages compile in partial-Ivy mode.
- Common unary request bodies, headers, status handling, cancellation, RPC queries/mutations, public exports, documentation snippets, and a real RPC server round trip have regression coverage.
- The Effect dependency is now pinned honestly to the tested v4 beta rather than claiming compatibility with every future beta/stable v4 release.
- The checked-in changeset records the breaking Angular/Effect peer update and gives consumers migration steps.

## Remediation order completed

1. Lock the npm release job to reviewed `main` releases and add protected general CI.
2. Update the Vitest browser toolchain and establish a high/critical audit gate.
3. Fix streamed request serialization and the RPC middleware/service/error type erasure.
4. Validate RPC tags and procedure intent before creating the client surface.
5. Fix cancellation, null-body/completion hangs, and query-key canonicalization.
6. Correct layer lifecycle/composition and decide/document streaming and SSR support boundaries.
7. Harden action pinning and Dependabot automation.
8. Repair packaging/community metadata, developer commands, and repeatable quality gates.

## Baseline validation evidence

- `bun install --frozen-lockfile`: passed with Bun 1.3.14.
- Node.js validation runtime: 24.15.0, which is supported by Angular 22.
- Angular CLI/core: 22.0.6; TypeScript: 6.0.3; ng-packagr: 22.0.1.
- Effect: 4.0.0-beta.97.
- `bun run build`: both libraries passed.
- `CI=true bun run test -- --watch=false`: 17 files and 56 tests passed.
- Effect language-service diagnostics: 12 production files checked; 0 errors, 0 warnings, 1 style message.
- `npm pack --dry-run --json`: both packages packed successfully; missing license contents are recorded above.
- `bun audit --json`: not clean; two critical Vitest browser advisories plus dev-tool transitive advisories are recorded above.

## Post-remediation validation evidence

- `bun install --frozen-lockfile`: passed with Bun 1.3.14 on supported Node.js 24.15.0.
- Current npm releases verified on 2026-07-10: Angular CLI/core 22.0.6 and Effect's `beta` tag 4.0.0-beta.97; the project uses both.
- `bun run format:check` and `bun run lint`: passed, including Angular template/accessibility lint configuration and vendored-source exclusions.
- `bun run effect:diagnostics`: 31 of 31 files checked; 0 errors, 0 warnings, 0 messages.
- `bun run test:coverage`: 19 test files and 101 tests passed.
  - Platform: 94.30% statements, 82.25% branches, 94.73% functions, 94.21% lines.
  - Query: 97.13% statements, 95.03% branches, 100% functions, 96.96% lines.
- `bun run pack:check`: both production builds passed; both npm archives contain MIT metadata and byte-identical licenses; an isolated strict-peer consumer installed, typechecked public usage, and ran both archives.
- `bun run audit:ci`: passed with 0 critical and 0 high advisories and no ignored findings. Remaining advisories are dev-only, currently unfixable in-range transitive moderate/low findings.
- Knope 0.22.2 `--validate`: passed with both package-specific changelogs configured.
- Workflow security, Dependabot scoping, Bash syntax, ShellCheck, YAML, `actionlint`, and `zizmor --pedantic` checks: passed.
- GitHub [CI run 29098336988](https://github.com/heddendorp/effect-angular/actions/runs/29098336988): `quality` succeeded for the draft PR from GitHub Actions app ID 15368.
- GitHub ruleset `Protect main` (ID `18776227`): active; `main` reports protected and requires the strict app-bound `quality` check plus reviewed pull requests.
- GitHub private vulnerability reporting: enabled and verified through the repository API.
