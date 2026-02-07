# Knope Release Workflow Definition

Date: 2026-02-07

## Change-file Strategy

- Location: `.changes/`
- Format: Markdown file using release headings such as `### Added`, `### Changed`, `### Fixed`.
- Expectations:
  - Every user-facing PR includes one new file in `.changes/`.
  - Keep entries concise and user-facing.
  - Multiple entries can be grouped in a single file when needed.

## Release PR/Bot Flow

- Release branch: `knope/release`
- Primary trigger condition:
  - `main` contains new change files and a release run is initiated.
- Result:
  - Knope prepares version/changelog updates.
  - A release PR is created/updated from `knope/release` into `main`.
  - Merging the release PR publishes a GitHub release.

## GitHub Actions Trigger Conditions

- Manual release workflow: `workflow_dispatch`
  - Prepares release changes
  - Runs test/build checks
  - Creates GitHub release through `knope release`
- Bot release workflow: `pull_request` closed on `main`
  - Only runs when merged PR head branch is `knope/release`
  - Executes post-release validation/publishing tasks
