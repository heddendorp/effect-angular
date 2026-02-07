# Plan: OSS project scaffolding + Knope release flow

## Phase 1: Documentation & Community Baseline
- [x] Task: Review existing repo context for README accuracy [29d0c77]
    - [x] Inspect root `package.json` and workspace layout for package list
    - [x] Confirm current install/dev/test commands from tooling
- [ ] Task: Draft and add root README
    - [ ] Write overview and goals aligned with `conductor/product.md`
    - [ ] Add quickstart/setup using Bun + Angular workspace
    - [ ] Document key packages in the monorepo
- [ ] Task: Add community/health files
    - [ ] Add MIT LICENSE
    - [ ] Add CODE_OF_CONDUCT
    - [ ] Add CONTRIBUTING
    - [ ] Add SECURITY
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Documentation & Community Baseline' (Protocol in workflow.md)

## Phase 2: Knope Release Automation
- [ ] Task: Define Knope release workflow for this repo
    - [ ] Capture change-file strategy (location, format, expectations)
    - [ ] Map bot flow details (release PR branch, trigger conditions)
- [ ] Task: Add Knope configuration
    - [ ] Create Knope config files per bot workflow
    - [ ] Configure change-file behavior and release rules
- [ ] Task: Add GitHub Actions workflows for Knope bot flow
    - [ ] Add workflow(s) required by Knope bot
    - [ ] Ensure permissions and branch targets align with bot flow
- [ ] Task: Validate automation setup
    - [ ] Sanity-check workflow YAML and config files
    - [ ] Document expected release flow in README or CONTRIBUTING
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Knope Release Automation' (Protocol in workflow.md)

## Phase 3: Dependency Automation
- [ ] Task: Add Dependabot configuration
    - [ ] Define ecosystems (npm/bun) and update schedule
    - [ ] Set update policies for workspace layout
- [ ] Task: Validate Dependabot config
    - [ ] Verify file structure and paths are correct
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Dependency Automation' (Protocol in workflow.md)
