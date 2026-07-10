#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
workflow_dir="${repo_root}/.github/workflows"
release="${workflow_dir}/release.yml"
prepare="${workflow_dir}/prepare_release_pr.yml"
dependabot="${workflow_dir}/dependabot-add-changeset.yml"
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

push_step_line="$(grep -n -- '- name: Commit and push changeset' "${dependabot}" | cut -d: -f1)"
if [[ -z "${push_step_line}" ]]; then
  fail 'Dependabot push step is missing'
fi
if head -n "$((push_step_line - 1))" "${dependabot}" | grep -q 'DEPENDABOT_PUSH_TOKEN'; then
  fail 'Dependabot write token is exposed before the final push step'
fi
if grep -q 'skip-verification:' "${dependabot}"; then
  fail 'Dependabot metadata verification must remain enabled'
fi
require_text "${dependabot}" 'github.event.sender.id == 49699333'
require_text "${dependabot}" 'github.event.pull_request.user.id == 49699333'

for command in audit:ci format:check lint effect:diagnostics test:coverage build pack:check; do
  require_text "${ci}" "bun run ${command}"
  require_text "${release}" "bun run ${command}"
done

require_text "${ci}" 'pull_request:'
require_text "${ci}" 'push:'

echo 'Workflow security regression tests passed.'
