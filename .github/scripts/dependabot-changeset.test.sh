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
assert_output "${output}" 'reason=development_only_tooling'

repo="$(new_root_update tanstack)"
output="${temp_root}/tanstack-output"
run_scope "${repo}" tanstack direct:development \
  '[{"dependencyName":"@tanstack/angular-query-experimental","dependencyType":"direct:development"}]' "${output}"
assert_output "${output}" 'should_create=true'
assert_output "${output}" 'bump_platform=false'
assert_output "${output}" 'bump_query=true'
assert_output "${output}" 'reason=tanstack_dependency_group'

repo="$(new_root_update effect-dev)"
output="${temp_root}/effect-dev-output"
run_scope "${repo}" effect direct:development \
  '[{"dependencyName":"@effect/language-service","dependencyType":"direct:development"}]' "${output}"
assert_output "${output}" 'should_create=false'
assert_output "${output}" 'bump_platform=false'
assert_output "${output}" 'bump_query=false'
assert_output "${output}" 'reason=development_only'

repo="$(new_root_update angular)"
output="${temp_root}/angular-output"
run_scope "${repo}" angular direct:production \
  '[{"dependencyName":"@angular/core","dependencyType":"direct:production"}]' "${output}"
assert_output "${output}" 'should_create=true'
assert_output "${output}" 'bump_platform=true'
assert_output "${output}" 'bump_query=true'
assert_output "${output}" 'reason=angular_dependency_group'

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

echo 'Dependabot changeset regression tests passed.'
