# Effect Angular

Effect Angular provides Angular-first integrations for Effect Platform and Effect RPC.

## Overview

This workspace currently ships two Angular libraries:

- `effect-platform-angular`: Adapter that bridges Effect Platform `HttpClient` to Angular `HttpClient`.
- `effect-angular-query`: Injectable Effect RPC client with auto-generated TanStack Query and Mutation helpers.

## Goals

- Keep APIs idiomatic to Angular applications.
- Preserve strong Effect and TypeScript type-safety.
- Minimize setup overhead for HTTP and RPC usage in Angular.

## Requirements

- Node.js `^22.22.3`, `^24.15.0`, or `>=26.0.0`
- Bun `1.3.14`
- Angular `22.x` (`>=22.0.6`)
- Effect `4.0.0-beta.97`

## Quickstart

Install dependencies:

```bash
bun install
```

Build the workspace:

```bash
bun run build
```

Run project-specific tests:

```bash
bun run ng test effect-platform-angular --watch=false
bun run ng test effect-angular-query --watch=false
```

## Packages

| Package                   | Purpose                                                             | Path                               |
| ------------------------- | ------------------------------------------------------------------- | ---------------------------------- |
| `effect-platform-angular` | Angular `HttpClient` adapter for Effect Platform HTTP/RPC transport | `projects/effect-platform-angular` |
| `effect-angular-query`    | Effect RPC client + TanStack Angular Query/Mutation helper layer    | `projects/effect-angular-query`    |

npm packages:

- `@heddendorp/effect-platform-angular`
- `@heddendorp/effect-angular-query`

Install from npm:

```bash
bun add @heddendorp/effect-platform-angular @heddendorp/effect-angular-query
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
  effect-angular-query: major
  ---

  ### Changed

  - Describe user-facing impact.

  ### Migration

  - For breaking changes, list explicit old -> new API replacements.
  ```

- Knope Bot updates/creates the `knope/release` pull request from `.changeset` files.
- Knope Bot updates the package-specific changelogs under `projects/*/CHANGELOG.md` from those
  change files; there is no hand-maintained root changelog.
- Merging `knope/release` into `main` triggers the `Release` workflow, which runs tests/builds and publishes both libraries to npm.

Required npm setup:

- Configure both npm packages (`@heddendorp/effect-platform-angular`, `@heddendorp/effect-angular-query`) as trusted publishers linked to this GitHub repository/workflow (OIDC).

Standard release checklist:

1. Add at least one change file in `.changeset/`.
2. Wait for Knope Bot to create/update the `knope/release` PR.
3. Review generated versions, changelogs, migration notes, and validation checks.
4. Merge the generated `knope/release` pull request.
5. Confirm the `Release` workflow succeeds and both npm packages publish successfully.
