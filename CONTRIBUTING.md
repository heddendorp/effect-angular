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
- `projects/effect-angular-query`: Effect RPC injectable client with TanStack Query/Mutation helpers

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
- Include a change file under `.changeset/` for user-facing changes. Root-level Markdown files are
  not release inputs.
- Use changeset frontmatter with package and change type, for example:

  ```md
  ---
  effect-platform-angular: patch
  effect-angular-query: major
  ---

  ### Changed

  - Explain user-visible impact.

  ### Migration

  - For breaking changes, include exact old -> new API replacements and setup steps.
  ```

## Releases

Release automation is managed by Knope and GitHub Actions. See [CHANGESETS.md](CHANGESETS.md) for
the complete change-file format and validation commands.

### Prerequisites

- Configure npm trusted publishing (OIDC) for:
  - `@heddendorp/effect-platform-angular`
  - `@heddendorp/effect-angular-query`
    linked to the `heddendorp/effect-angular` release workflow.

### Standard release flow

1. Merge user-facing PRs with change files under `.changeset/`.
2. Wait for Knope Bot to create/update the `knope/release` pull request.
3. Review the generated versions and the package-specific changelogs:
   - `projects/effect-platform-angular/CHANGELOG.md`
   - `projects/effect-angular-query/CHANGELOG.md`
4. Confirm release-readiness checks pass, then merge `knope/release`.
5. Verify the **Release** workflow succeeds and npm publishes:
   - `@heddendorp/effect-platform-angular`
   - `@heddendorp/effect-angular-query`
6. Confirm both package versions and package-specific GitHub releases are visible.

## Reporting Bugs

Security vulnerabilities and private conduct concerns must use the private reporting channels in
[SECURITY.md](SECURITY.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), respectively.

Open a GitHub issue with:

- Reproduction steps
- Expected behavior
- Actual behavior
- Environment details (Node, Bun, Angular versions)
