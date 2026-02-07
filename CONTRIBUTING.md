# Contributing

Thanks for your interest in contributing to Effect Angular.

## Development Setup

1. Install dependencies:
   ```bash
   bun install
   ```
2. Run tests:
   ```bash
   bun run test -- --watch=false
   ```
3. Build the workspace:
   ```bash
   bun run build
   ```

## Working on Packages

- `projects/effect-platform-angular`: Effect Platform integration with Angular HttpClient
- `projects/effect-angular-query`: Effect RPC query helper integration for TanStack Angular Query

Useful commands:

```bash
bun run ng test effect-platform-angular --watch=false
bun run ng test effect-angular-query --watch=false
bun run ng build effect-platform-angular
bun run ng build effect-angular-query
```

## Pull Requests

- Keep changes scoped and focused.
- Add or update tests when behavior changes.
- Update docs when API or workflows change.
- Use clear commit messages.
- Include a change file in `.changeset/` for user-facing changes.
- Use changeset frontmatter with package and change type, for example:
  ```md
  ---
  effect-platform-angular: patch
  effect-angular-query: minor
  ---

  ### Fixed
  - Explain user-visible impact.
  ```

## Releases

Release automation is managed by Knope and GitHub Actions.

### Prerequisites

- Configure a repository secret named `RELEASE_PAT` with:
  - `contents:write`
  - `pull-requests:write`
- Configure a repository secret named `NPM_TOKEN` with publish access to:
  - `@heddendorp/effect-platform-angular`
  - `@heddendorp/effect-angular-query`

### Standard release flow

1. Merge user-facing PRs with change files under `.changeset/`.
2. Wait for Knope Bot to create/update the `knope/release` pull request.
3. Review and merge the generated `knope/release` pull request.
4. Verify the **Release** workflow succeeds.
5. Confirm npm publishes for:
   - `@heddendorp/effect-platform-angular`
   - `@heddendorp/effect-angular-query`
6. Confirm both package versions are visible on npm.

### First release checklist

1. Ensure at least one change file exists in `.changeset/`.
2. Confirm `knope.toml` and workflow files are present.
3. Confirm `knope/release` pull request is present.
4. Merge `knope/release`.
5. Verify both npm package versions are published.

## Reporting Bugs

Open a GitHub issue with:

- Reproduction steps
- Expected behavior
- Actual behavior
- Environment details (Node, Bun, Angular versions)
