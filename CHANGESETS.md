# Change Files and Release Notes

Every user-facing pull request must include one new Markdown file under `.changeset/`. Change
files placed elsewhere are not release inputs and will be ignored by Knope.

Change files use frontmatter with `package: change-type` pairs followed by a concise Markdown
summary. The package keys are the unscoped package identifiers from `knope.toml`:

- `effect-platform-angular`
- `effect-angular-query`

Valid change types are `patch`, `minor`, and `major`. Use `patch` for backward-compatible fixes,
`minor` for backward-compatible features, and `major` for breaking changes. Breaking change files
must include actionable migration instructions.

Example:

```md
---
effect-platform-angular: patch
effect-angular-query: major
---

### Changed

- Preserve request cancellation when a query is disposed.

### Migration

- For breaking changes, include explicit old -> new API mappings and required setup changes.
```

## Generated changelogs

Knope maintains one changelog per published package:

- `projects/effect-platform-angular/CHANGELOG.md`
- `projects/effect-angular-query/CHANGELOG.md`

Do not hand-edit generated release sections in a feature pull request. Knope consumes the active
`.changeset/*.md` files, removes them on the release branch, bumps only the affected package
manifests, and prepends the generated entries to the corresponding package changelogs. GitHub
releases use the same change-file content.

## Validation

Run the project-specific tests:

```bash
bun run ng test effect-platform-angular --watch=false
bun run ng test effect-angular-query --watch=false
```

Build and verify both npm tarballs:

```bash
bun run pack:check
```

The package check builds both libraries, performs npm pack dry-runs, verifies package metadata and
license artifacts, and installs the resulting tarballs in an isolated consumer fixture.

## Automated dependency updates

Verified Dependabot updates are eligible for squash auto-merge when every updated dependency is a
stable three-part SemVer patch or minor update, the pull request changes only approved dependency
files, and the required `quality` check passes on the final head. Major updates, prerelease versions
(including Effect betas), incomplete metadata, unsigned commits, and unexpected file changes remain
manual.

When an eligible update affects a published package's tested runtime or peer dependencies, the
automation adds a package-scoped `patch` change file before CI runs on the final head. Development
tooling and GitHub Actions updates do not create package release entries because they do not change
the published package contract.

## Release flow

1. Merge user-facing changes, each with a file under `.changeset/`.
2. Wait for Knope Bot to create or refresh the `knope/release` pull request.
3. Review the generated versions, package changelogs, migration notes, and validation checks.
4. Merge `knope/release`.
5. Verify the package-specific GitHub releases and npm versions.
