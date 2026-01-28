# Product Definition

## Overview
Effect Angular provides Angular libraries that integrate Effect Platform and Effect RPC with Angular. The initial focus is two integrations:
1) An Effect-based HTTP client built on Angular HttpClient.
2) An Effect RPC client integrated with TanStack Query for Angular.

## Audience
Open-source Angular developers who want Effect-first integrations.

## Goals
- Native Angular feel in APIs and usage patterns (prioritize Angular conventions over React-inspired patterns).
- Minimal connection and boilerplate; closely follow existing integrations where they align with Angular norms.
- Strong type safety with Effect-first semantics.
- Interoperability with Angular HttpClient and TanStack Query defaults.

## Scope (v1)
- Effect Platform HTTP client integration using Angular HttpClient.
- Effect RPC client integration with TanStack Query for Angular.
- Typed library APIs with minimal usage examples.
- Documentation: quickstart and integration guides.
- Tests that verify expected behavior.

## Non-goals (v1)
- Additional integrations beyond the two above.
- Advanced caching or persistence beyond TanStack defaults.
- Dedicated SSR optimizations; rely on Angular HttpClient behavior.

## Compatibility
- Angular 21+.
