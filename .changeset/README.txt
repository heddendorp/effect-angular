# Change Files

Every user-facing pull request should include one new `.md` file in `.changeset/`.

Change files must use frontmatter with `package: change-type` pairs, then a Markdown summary.

This repo currently has two releasable packages in `knope.toml`:
- `effect-platform-angular`
- `effect-angular-query`

Valid change types:
- `patch`
- `minor`
- `major`

Example:

```md
---
effect-platform-angular: minor
effect-angular-query: patch
---

### Added
- Initial public release of effect-platform-angular and effect-angular-query.
```
