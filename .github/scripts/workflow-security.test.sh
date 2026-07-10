#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
workflow_dir="${repo_root}/.github/workflows"
release="${workflow_dir}/release.yml"
prepare="${workflow_dir}/prepare_release_pr.yml"
dependabot="${workflow_dir}/dependabot-add-changeset.yml"
dependabot_automerge="${workflow_dir}/dependabot-automerge.yml"
dependabot_config="${repo_root}/.github/dependabot.yml"
ci="${workflow_dir}/ci.yml"

fail() {
  echo "workflow security regression test failed: $*" >&2
  exit 1
}

require_text() {
  local file="$1"
  local text="$2"
  grep -Fq -- "${text}" "${file}" || fail "${file} is missing: ${text}"
}

while IFS= read -r use_line; do
  action="${use_line#*uses: }"
  if [[ ! "${action}" =~ ^[^[:space:]]+@[0-9a-f]{40}([[:space:]]+#[[:space:]].*)?$ ]]; then
    fail "third-party action is not pinned to a full commit SHA: ${action}"
  fi
done < <(grep -RhE '^[[:space:]]+uses:' "${workflow_dir}")

while IFS= read -r workflow; do
  checkout_count="$(grep -c 'uses: actions/checkout@' "${workflow}" || true)"
  persist_false_count="$(grep -c 'persist-credentials: false' "${workflow}" || true)"
  if [[ "${checkout_count}" -ne "${persist_false_count}" ]]; then
    fail "every checkout in ${workflow} must disable persisted credentials"
  fi
done < <(find "${workflow_dir}" -type f -name '*.yml' -print)

if grep -RqE '^[[:space:]]+token:' "${workflow_dir}"; then
  fail 'checkout credentials must not be overridden'
fi

if grep -Rq 'RELEASE_PAT' "${workflow_dir}"; then
  fail 'RELEASE_PAT must not be exposed to validation or publishing workflows'
fi

if grep -q 'workflow_dispatch' "${release}"; then
  fail 'publishing must not support arbitrary manual refs'
fi

require_text "${release}" "github.event.pull_request.merged == true"
require_text "${release}" "github.event.pull_request.base.ref == 'main'"
require_text "${release}" "github.event.pull_request.head.ref == 'knope/release'"
require_text "${release}" 'github.event.pull_request.head.repo.full_name == github.repository'
require_text "${release}" "ref: \${{ github.event.pull_request.merge_commit_sha }}"

id_token_files="$(grep -Rl 'id-token: write' "${workflow_dir}" || true)"
if [[ "${id_token_files}" != "${release}" ]]; then
  fail 'OIDC permission must exist only in release.yml'
fi

if grep -q 'id-token:' "${prepare}"; then
  fail 'read-only release validation must not request OIDC'
fi

if grep -q 'DEPENDABOT_PUSH_TOKEN' "${dependabot}"; then
  fail 'Dependabot classifier must not receive a write token'
fi
if grep -q 'skip-verification:' "${dependabot}"; then
  fail 'Dependabot metadata verification must remain enabled'
fi
require_text "${dependabot}" 'pull_request_target:'
require_text "${dependabot}" 'github.event.sender.id == 49699333'
require_text "${dependabot}" 'github.event.pull_request.user.id == 49699333'
require_text "${dependabot}" 'github.event.pull_request.head.repo.full_name == github.repository'
require_text "${dependabot}" 'ref: ${{ github.event.pull_request.base.sha }}'
require_text "${dependabot}" 'cancel-in-progress: false'
if grep -q 'target-branch:' "${dependabot_config}"; then
  fail 'Dependabot must keep the default target branch implicit for correct metadata directories'
fi
require_text "${dependabot_config}" "- 'repos/effect/**'"

push_step_line="$(grep -n -- '- name: Commit generated changeset' "${dependabot_automerge}" | cut -d: -f1 || true)"
if [[ -z "${push_step_line}" ]]; then
  fail 'Dependabot push step is missing'
fi
if head -n "$((push_step_line - 1))" "${dependabot_automerge}" | grep -q 'DEPENDABOT_PUSH_TOKEN'; then
  fail 'Dependabot write token is exposed before the final push step'
fi
if grep -q -- '--admin' "${dependabot_automerge}"; then
  fail 'Dependabot auto-merge must never bypass branch rules'
fi
if grep -q 'uses:' "${dependabot_automerge}"; then
  fail 'Privileged Dependabot mutation must use only trusted runner tools'
fi
require_text "${dependabot_automerge}" 'workflow_run:'
require_text "${dependabot_automerge}" 'Classify Dependabot Updates'
require_text "${dependabot_automerge}" "github.event.workflow_run.event == 'pull_request_target'"
require_text "${dependabot_automerge}" 'GH_TOKEN: ${{ secrets.DEPENDABOT_PUSH_TOKEN }}'
push_token_count="$(grep -Fc 'GH_TOKEN: ${{ secrets.DEPENDABOT_PUSH_TOKEN }}' "${dependabot_automerge}")"
if [[ "${push_token_count}" -ne 2 ]]; then
  fail 'Dependabot write token must be limited to the changeset and auto-merge steps'
fi
require_text "${dependabot_automerge}" '[dependabot skip]'
require_text "${dependabot_automerge}" 'force: false'
require_text "${dependabot_automerge}" 'for _ in {1..15}; do'
require_text "${dependabot_automerge}" 'Pull request head changed unexpectedly after the ref update.'
require_text "${dependabot_automerge}" 'Timed out waiting for the pull request head to reflect the generated changeset.'
require_text "${dependabot_automerge}" 'GH_TOKEN: ${{ github.token }}'
require_text "${dependabot_automerge}" 'gh pr review'
require_text "${dependabot_automerge}" 'strict_required_status_checks_policy == true'
require_text "${dependabot_automerge}" '.context == "quality"'
require_text "${dependabot_automerge}" '.parameters.require_last_push_approval == true'
require_text "${dependabot_automerge}" '- name: Enable squash auto-merge'
require_text "${dependabot_automerge}" '--match-head-commit "${FINAL_SHA}"'
require_text "${dependabot_automerge}" '--auto'
require_text "${dependabot_automerge}" '--squash'
require_text "${dependabot_automerge}" 'cancel-in-progress: false'

for command in audit:ci format:check lint effect:diagnostics test:coverage build pack:check; do
  require_text "${ci}" "bun run ${command}"
  require_text "${release}" "bun run ${command}"
done

require_text "${ci}" 'pull_request:'
require_text "${ci}" 'push:'

echo 'Workflow security regression tests passed.'
