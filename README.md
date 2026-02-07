# Effect Angular

Effect Angular provides Angular-first integrations for Effect Platform and Effect RPC.

## Overview

This workspace currently ships two Angular libraries:

- `effect-platform-angular`: Adapter that bridges Effect Platform `HttpClient` to Angular `HttpClient`.
- `effect-angular-query`: Helpers that build TanStack Angular Query options from Effect RPC procedures.

## Goals

- Keep APIs idiomatic to Angular applications.
- Preserve strong Effect and TypeScript type-safety.
- Minimize setup overhead for HTTP and RPC usage in Angular.

## Requirements

- Node.js 22+ recommended
- Bun `1.2.x`
- Angular `21+`

## Quickstart

Install dependencies:

```bash
bun install
```

Build the workspace:

```bash
bun run build
```

Run tests:

```bash
bun run test -- --watch=false
```

## Packages

| Package | Purpose | Path |
| --- | --- | --- |
| `effect-platform-angular` | Angular `HttpClient` adapter for Effect Platform HTTP/RPC transport | `projects/effect-platform-angular` |
| `effect-angular-query` | Effect RPC to TanStack Angular Query helper layer | `projects/effect-angular-query` |

Package-specific docs:

- `projects/effect-platform-angular/README.md`
- `projects/effect-angular-query/README.md`

## Development Commands

Run a project-specific test target:

```bash
bun run ng test effect-platform-angular --watch=false
bun run ng test effect-angular-query --watch=false
```

Build a specific library:

```bash
bun run ng build effect-platform-angular
bun run ng build effect-angular-query
```
