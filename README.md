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

JSR targets:

- `@heddendorp/effect-platform-angular`
- `@heddendorp/effect-angular-query`

Install from JSR:

```bash
bunx jsr add @heddendorp/effect-platform-angular @heddendorp/effect-angular-query
```

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

## Release Workflow

This repository uses Knope with GitHub Actions for release automation.

- Change files live in `.changeset/` and are the source for release notes.
- Each change file uses frontmatter + summary markdown, for example:
  ```md
  ---
  effect-platform-angular: patch
  effect-angular-query: minor
  ---

  ### Changed
  - Describe user-facing impact.
  ```
- Knope Bot updates/creates the `knope/release` pull request from `.changeset` files.
- Merging `knope/release` into `main` triggers the `Release` workflow, which runs tests/builds and publishes both libraries to JSR.

Required repository secrets:

- `RELEASE_PAT` (recommended): Personal access token with `contents:write` and `pull-requests:write`.
  The workflows fall back to `GITHUB_TOKEN`, but `RELEASE_PAT` is recommended for reliable branch/PR operations.

Manual first release bootstrap:

1. Add at least one change file in `.changeset/`.
2. Wait for Knope Bot to create/update the `knope/release` PR.
3. Merge the generated `knope/release` pull request.
4. Confirm the `Release` workflow succeeds, both JSR publishes pass, and a GitHub release is created.
