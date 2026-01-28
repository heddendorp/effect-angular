# Implementation Plan

## Phase 1: Library Entry Points and DI
- [x] Task: Define the Angular provider API for the Effect HTTP client adapter (c7a9fc2)
    - [ ] Write failing tests for provider registration and injection via TestBed
    - [ ] Implement provider functions/tokens that bind Angular HttpClient to the Effect adapter
    - [ ] Update `public-api.ts` and remove the scaffolded component exports
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Library Entry Points and DI' (Protocol in workflow.md)

## Phase 2: HttpClient Adapter Behavior
- [ ] Task: Map Effect HTTP requests to Angular HttpClient options
    - [ ] Write failing tests for method, headers, query params, and body mapping
    - [ ] Implement request translation logic using Angular HttpClient
- [ ] Task: Map Angular HttpClient responses and errors to Effect HTTP response types
    - [ ] Write failing tests for status, headers, body parsing, and error handling
    - [ ] Implement response conversion and error mapping
- [ ] Task: Support cancellation and abort semantics
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
