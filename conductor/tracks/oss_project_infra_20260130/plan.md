# Plan: OSS project scaffolding + Knope release flow

## Phase 1: Documentation & Community Baseline
- [x] Task: Review existing repo context for README accuracy [29d0c77]
    - [x] Inspect root `package.json` and workspace layout for package list
    - [x] Confirm current install/dev/test commands from tooling
- [x] Task: Draft and add root README [8068283]
    - [x] Write overview and goals aligned with `conductor/product.md`
    - [x] Add quickstart/setup using Bun + Angular workspace
    - [x] Document key packages in the monorepo
- [x] Task: Add community/health files [9bb3ce4]
    - [x] Add MIT LICENSE
    - [x] Add CODE_OF_CONDUCT
    - [x] Add CONTRIBUTING
    - [x] Add SECURITY
- [~] Task: Conductor - User Manual Verification 'Phase 1: Documentation & Community Baseline' (Protocol in workflow.md)

## Phase 2: Knope Release Automation
- [x] Task: Define Knope release workflow for this repo [7a4c4fa]
    - [x] Capture change-file strategy (location, format, expectations)
    - [x] Map bot flow details (release PR branch, trigger conditions)
- [x] Task: Add Knope configuration [6a73e3e]
    - [x] Create Knope config files per bot workflow
    - [x] Configure change-file behavior and release rules
- [x] Task: Add GitHub Actions workflows for Knope bot flow [ad02cd8]
    - [x] Add workflow(s) required by Knope bot
    - [x] Ensure permissions and branch targets align with bot flow
- [x] Task: Validate automation setup [77ccd51]
    - [x] Sanity-check workflow YAML and config files
    - [x] Document expected release flow in README or CONTRIBUTING
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Knope Release Automation' (Protocol in workflow.md)

## Phase 3: Dependency Automation
- [ ] Task: Add Dependabot configuration
    - [ ] Define ecosystems (npm/bun) and update schedule
    - [ ] Set update policies for workspace layout
- [ ] Task: Validate Dependabot config
    - [ ] Verify file structure and paths are correct
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Dependency Automation' (Protocol in workflow.md)
