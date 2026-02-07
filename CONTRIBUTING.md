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

## Reporting Bugs

Open a GitHub issue with:

- Reproduction steps
- Expected behavior
- Actual behavior
- Environment details (Node, Bun, Angular versions)
