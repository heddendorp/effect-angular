# Implementation Plan

## Phase 1: Library Entry Points and DI [checkpoint: 1aeb891]
- [x] Task: Define the Angular provider API for the Effect HTTP client adapter (c7a9fc2)
    - [ ] Write failing tests for provider registration and injection via TestBed
    - [ ] Implement provider functions/tokens that bind Angular HttpClient to the Effect adapter
    - [ ] Update `public-api.ts` and remove the scaffolded component exports
- [x] Task: Conductor - User Manual Verification 'Phase 1: Library Entry Points and DI' (Protocol in workflow.md) (510c129)

## Phase 2: HttpClient Adapter Behavior
- [x] Task: Map Effect HTTP requests to Angular HttpClient options (ddb6da3)
    - [ ] Write failing tests for method, headers, query params, and body mapping
    - [ ] Implement request translation logic using Angular HttpClient
- [x] Task: Map Angular HttpClient responses and errors to Effect HTTP response types (3cf504b)
    - [ ] Write failing tests for status, headers, body parsing, and error handling
    - [ ] Implement response conversion and error mapping
- [x] Task: Support cancellation and abort semantics (7811fc1)
    - [ ] Write failing tests that cancel an Effect request and assert HttpClient abort
    - [ ] Implement cancellation bridging for in-flight requests
- [ ] Task: Conductor - User Manual Verification 'Phase 2: HttpClient Adapter Behavior' (Protocol in workflow.md)

## Phase 3: Documentation and Readiness
- [ ] Task: Document Angular usage and minimal Effect RPC example
    - [ ] Draft quickstart and concepts sections for the adapter
    - [ ] Add a minimal documented Effect RPC usage example for Angular apps
- [ ] Task: Validate build and public API surface
    - [ ] Add or adjust tests that cover the exported API surface
    - [ ] Confirm the package builds cleanly with the new exports
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Documentation and Readiness' (Protocol in workflow.md)
