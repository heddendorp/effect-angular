# README Context Audit

Date: 2026-02-07

## Workspace and Packages
- Workspace root contains two library projects under `projects/`:
  - `projects/effect-platform-angular`
  - `projects/effect-angular-query`
- Root package metadata:
  - package: `effect-angular`
  - package manager: `bun@1.2.19`

## Tooling Commands
Validated from root `package.json` scripts:
- Install dependencies: `bun install`
- Start dev server: `bun run start` (Angular CLI serve)
- Build: `bun run build`
- Test: `bun run test`

## Key Runtime Dependencies
- `@effect/platform`
- `@angular/common`
- `@angular/core`
- `@angular/router`
- `effect`
- `rxjs`

## Key Dev Dependencies
- `@effect/rpc`
- `@tanstack/angular-query-experimental`
- `@angular/cli`
- `@angular/build`
- `ng-packagr`
- `vitest`
