# Implementation Plan

## Phase 1: Core query key + options utilities [checkpoint: fb14a19]
- [x] Task: Review `injectQuery` expectations in `@tanstack/angular-query-experimental` and confirm the options shape (4923c25)
    - [x] Inspect types for `injectQuery` and `queryOptions` (if available)
    - [x] Define adapter types for query options and queryFn compatibility
- [x] Task: Implement query key helpers (path segments + input + optional keyPrefix) (b16bda6)
    - [x] Write failing tests for `queryKey` shape (path segments, input, keyPrefix)
    - [x] Implement query key builder and helper types
    - [x] Refactor/cleanup and rerun tests
- [x] Task: Implement query options factory (queryFn + metadata + overrides) (e785f29)
    - [x] Write failing tests for `queryOptions` output (queryKey, queryFn, metadata, override merge)
    - [x] Implement query options factory and `rpc` metadata attachment
    - [x] Refactor/cleanup and rerun tests
- [x] Task: Conductor - User Manual Verification 'Phase 1: Core query key + options utilities' (Protocol in workflow.md) (49b0ef6)

## Phase 2: Angular integration + typed helpers [checkpoint: 61b2348]
- [x] Task: Create Angular DI config and injectable helper service (c72c9e1)
    - [x] Write failing tests for DI setup and config defaults
    - [x] Implement tokens/config and injectable service
    - [x] Refactor/cleanup and rerun tests
- [x] Task: Build per-procedure helpers + path-level invalidation utilities (3247bbc)
    - [x] Write failing tests for per-procedure `queryKey`/`queryFn`/`queryOptions`
    - [x] Write failing tests for `pathKey`/`queryFilter` helpers
    - [x] Implement typed proxy helpers for procedures and path-level utilities
    - [x] Refactor/cleanup and rerun tests
- [x] Task: Replace placeholder component and update public API exports (d3a87b8)
    - [x] Write failing tests for new public API exports
    - [x] Remove placeholder component and export new APIs
    - [x] Refactor/cleanup and rerun tests
- [x] Task: Conductor - User Manual Verification 'Phase 2: Angular integration + typed helpers' (Protocol in workflow.md) (906548e)

## Phase 3: Packaging + docs
- [x] Task: Update package dependencies/peerDependencies for TanStack Angular Query (0d42e9e)
    - [x] Write failing test or validation for updated public API surface
    - [x] Update `package.json`/`ng-package.json` as needed and rerun tests
- [x] Task: Add README usage examples and API docs (eadd96b)
    - [x] Document minimal setup and `injectQuery` usage with overrides
    - [x] Document query key shape, keyPrefix option, and path helpers
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Packaging + docs' (Protocol in workflow.md)
