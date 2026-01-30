# Implementation Plan

## Phase 1: Library Entry Points and DI [checkpoint: 1aeb891]
- [x] Task: Define the Angular provider API for the Effect HTTP client adapter (c7a9fc2)
    - [ ] Write failing tests for provider registration and injection via TestBed
    - [ ] Implement provider functions/tokens that bind Angular HttpClient to the Effect adapter
    - [ ] Update `public-api.ts` and remove the scaffolded component exports
- [x] Task: Conductor - User Manual Verification 'Phase 1: Library Entry Points and DI' (Protocol in workflow.md) (510c129)

## Phase 2: HttpClient Adapter Behavior [checkpoint: e58d18d]
- [x] Task: Map Effect HTTP requests to Angular HttpClient options (ddb6da3)
    - [ ] Write failing tests for method, headers, query params, and body mapping
    - [ ] Implement request translation logic using Angular HttpClient
- [x] Task: Map Angular HttpClient responses and errors to Effect HTTP response types (3cf504b)
    - [ ] Write failing tests for status, headers, body parsing, and error handling
    - [ ] Implement response conversion and error mapping
- [x] Task: Support cancellation and abort semantics (7811fc1)
    - [ ] Write failing tests that cancel an Effect request and assert HttpClient abort
    - [ ] Implement cancellation bridging for in-flight requests
- [x] Task: Add clarifying code comments for new adapter and tests (49f2b4c)
- [x] Task: Consolidate Effect Platform imports (unify @effect/platform entries) (46f1122)
- [x] Task: Conductor - User Manual Verification 'Phase 2: HttpClient Adapter Behavior' (Protocol in workflow.md) (e58d18d)

## Phase 3: Documentation and Readiness
- [x] Task: Document Angular usage and minimal Effect RPC example (fbbd323)
    - [ ] Draft quickstart and concepts sections for the adapter
    - [ ] Add a minimal documented Effect RPC usage example for Angular apps
- [x] Task: Validate build and public API surface (2111f76)
    - [ ] Add or adjust tests that cover the exported API surface
    - [ ] Confirm the package builds cleanly with the new exports
- [x] Task: Add tests for the Effect RPC documentation example (fe4be95)
- [x] Task: Remove Node dependency from the RPC example test (0d3e5df)
- [x] Task: Refine RPC example DX with injectable service returning promises (f80c0a6)
- [x] Task: Use RpcClient procedures in the RPC example test (5ca78af)
- [x] Task: Simplify the RPC example test and expose a promise client directly (ca1088a)
- [x] Task: Simplify RPC example to expose promise procedures directly on the service (930382e)
- [x] Task: Conductor - User Manual Verification 'Phase 3: Documentation and Readiness' (Protocol in workflow.md) (befdcc1)
