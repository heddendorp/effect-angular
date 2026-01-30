# Track Specification: Start effect-platform-angular with HttpClient, including a minimal documented Effect RPC usage example

## Context
The goal is to establish the `effect-platform-angular` package as the Angular-native HTTP client integration for Effect Platform. It should build on Angular's `HttpClient`, follow Angular conventions, and align with the API patterns in `effect-platform-browser`. This integration is the foundation for using Effect RPC in Angular applications, with a minimal documented example to validate the intended usage.

## Goals
- Provide a DI-friendly, Angular-idiomatic entry point for Effect Platform HTTP client usage.
- Map Effect Platform HTTP requests to Angular `HttpClient` calls with strong typing.
- Align API naming and behavior with `effect-platform-browser` where it fits Angular norms.
- Keep the setup minimal so Angular apps can adopt it with little boilerplate.

## Non-goals
- Additional integrations beyond the HTTP client adapter.
- Advanced caching or persistence features beyond Angular defaults.
- Dedicated SSR-specific optimizations.

## Requirements
### Functional
- Provide Angular providers and tokens to register the Effect HTTP client adapter.
- Translate request method, headers, query params, and body from Effect request types to `HttpClient` options.
- Convert `HttpClient` responses and errors to Effect HTTP response types consistently.
- Support request cancellation/abort semantics compatible with Effect.

### Documentation
- Add a quickstart and concepts section for using the adapter in Angular apps.
- Include a minimal documented Effect RPC usage example showing the intended path in Angular.

### Quality
- Unit tests cover request mapping, response mapping, and cancellation behavior.
- Type safety is preserved across all public APIs.

## Deliverables
- Updated `effect-platform-angular` library code and public API exports.
- Unit tests for the adapter behavior.
- Documentation updates for Angular usage.

## Acceptance Criteria
- `effect-platform-angular` builds successfully and exports the intended provider API.
- Tests verify request/response translation and cancellation behavior.
- Documentation demonstrates how Angular apps can use the adapter as the HTTP client foundation for Effect RPC, with a minimal example.
