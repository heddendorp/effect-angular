#!/usr/bin/env bash

set -euo pipefail

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

sha256_file() {
  local file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${file}" | cut -d' ' -f1
  else
    shasum -a 256 "${file}" | cut -d' ' -f1
  fi
}

load_changed_files() {
  changed_files=()

  if [[ -n "${CHANGED_FILES_JSON_FILE:-}" ]]; then
    while IFS= read -r file; do
      changed_files+=("${file}")
    done < <(jq -r '.[].filename' "${CHANGED_FILES_JSON_FILE}")
    return
  fi

  require_env BASE_SHA
  require_env HEAD_SHA
  git cat-file -e "${BASE_SHA}^{commit}"
  git cat-file -e "${HEAD_SHA}^{commit}"

  while IFS= read -r file; do
    changed_files+=("${file}")
  done < <(git diff --name-only "${BASE_SHA}" "${HEAD_SHA}")
}

write_scope_outputs() {
  {
    echo "changeset_exists=${changeset_exists}"
    echo "should_create=${should_create}"
    echo "bump_platform=${bump_platform}"
    echo "bump_query=${bump_query}"
    echo "reason=${reason}"
  } >> "${GITHUB_OUTPUT}"
}

scope_changeset() {
  require_env GITHUB_OUTPUT
  load_changed_files

  local changeset_exists=false
  local platform_manifest_changed=false
  local query_manifest_changed=false
  local root_manifest_changed=false
  local bump_platform=false
  local bump_query=false
  local reason=not_applicable
  local should_create=false

  if [[ "${#changed_files[@]}" -eq 0 ]]; then
    reason=no_changed_files
    write_scope_outputs
    return
  fi

  local file
  for file in "${changed_files[@]}"; do
    if [[ "${file}" == .changeset/*.md ]]; then
      changeset_exists=true
    fi

    if [[ "${file}" == "projects/effect-platform-angular/package.json" ]]; then
      platform_manifest_changed=true
    fi

    if [[ "${file}" == "projects/effect-angular-query/package.json" ]]; then
      query_manifest_changed=true
    fi

    if [[ "${file}" == "package.json" || "${file}" == "bun.lock" ]]; then
      root_manifest_changed=true
    fi
  done

  if [[ "${PACKAGE_ECOSYSTEM:-}" != "bun" ]]; then
    reason=non_bun_pr
  elif [[ "${changeset_exists}" == "true" ]]; then
    reason=changeset_already_present
  elif [[ "${platform_manifest_changed}" == "true" || "${query_manifest_changed}" == "true" ]]; then
    bump_platform="${platform_manifest_changed}"
    bump_query="${query_manifest_changed}"
    reason=package_manifest_changes
  elif [[ "${root_manifest_changed}" == "true" ]]; then
    if jq -e 'type == "array" and length > 0' \
      <<< "${UPDATED_DEPENDENCIES_JSON:-}" >/dev/null; then
      if jq -e 'any(.[];
        (.dependencyType // "") != "indirect" and
        ((.dependencyName // "") | startswith("@tanstack/")))' \
        <<< "${UPDATED_DEPENDENCIES_JSON}" >/dev/null; then
        bump_query=true
      fi

      if jq -e 'any(.[];
        (.dependencyType // "") == "direct:production" and
        ((.dependencyName // "") as $name |
          $name == "effect" or $name == "rxjs" or $name == "tslib" or
          ($name | startswith("@angular/"))))' \
        <<< "${UPDATED_DEPENDENCIES_JSON}" >/dev/null; then
        bump_platform=true
        bump_query=true
      fi

      if [[ "${bump_platform}" == "true" || "${bump_query}" == "true" ]]; then
        reason=dependency_name_mapping
      else
        reason=no_releasable_dependency_changes
      fi
    else
      reason=missing_dependency_metadata
    fi
  else
    reason=no_releasable_manifest_changes
  fi

  if [[ "${bump_platform}" == "true" || "${bump_query}" == "true" ]]; then
    should_create=true
  fi

  write_scope_outputs
}

create_changeset() {
  require_env PR_NUMBER
  require_env GITHUB_OUTPUT

  local file="${OUTPUT_FILE:-.changeset/dependabot-pr-${PR_NUMBER}.md}"
  mkdir -p "$(dirname "${file}")"

  local dependency_lines=""
  if [[ -n "${UPDATED_DEPENDENCIES_JSON:-}" && "${UPDATED_DEPENDENCIES_JSON}" != "[]" ]]; then
    dependency_lines="$(jq -r '
      def first_nonempty($values):
        [$values[] | select(type == "string" and length > 0)] | .[0] // "unknown";
      .[] |
      "- \(.dependencyName // .dependency_name // .name // "unknown"): " +
      "\(first_nonempty([.prevVersion, .previousVersion, .previous_version, .from])) -> " +
      "\(first_nonempty([.newVersion, .new_version, .to]))"
    ' <<< "${UPDATED_DEPENDENCIES_JSON}")"
  fi

  if [[ -z "${dependency_lines}" ]]; then
    dependency_lines="- ${DEPENDENCY_NAMES:-unknown}: version details unavailable"
  fi

  {
    echo "---"
    if [[ "${BUMP_PLATFORM:-}" == "true" ]]; then
      echo "effect-platform-angular: patch"
    fi
    if [[ "${BUMP_QUERY:-}" == "true" ]]; then
      echo "effect-angular-query: patch"
    fi
    echo "---"
    echo
    echo "Automated Dependabot dependency update for PR #${PR_NUMBER}."
    echo
    echo "### Updated dependencies"
    echo "${dependency_lines}"
    echo
    echo "Update type: ${UPDATE_TYPE:-unknown}"
  } > "${file}"

  echo "file=${file}" >> "${GITHUB_OUTPUT}"
}

validate_snapshot() {
  require_env CHANGED_FILES_JSON_FILE
  require_env COMMIT_ATTESTATIONS_JSON_FILE
  require_env HEAD_SHA

  jq -e --arg head "${HEAD_SHA}" '
    type == "array" and length > 0 and
    .[-1].sha == $head and
    all(.[];
      .author.id == 49699333 and
      .commit.verification.verified == true)
  ' "${COMMIT_ATTESTATIONS_JSON_FILE}" >/dev/null || return 1

  jq -e '
    type == "array" and length > 0 and
    all(.[]; .status == "modified")
  ' "${CHANGED_FILES_JSON_FILE}" >/dev/null || return 1
}

validate_metadata() {
  require_env UPDATED_DEPENDENCIES_JSON_FILE
  require_env PACKAGE_ECOSYSTEM
  require_env UPDATE_TYPE

  case "${UPDATE_TYPE}" in
    version-update:semver-patch | version-update:semver-minor) ;;
    *) return 1 ;;
  esac

  jq -e --arg ecosystem "${PACKAGE_ECOSYSTEM}" --arg aggregate "${UPDATE_TYPE}" '
    def stable_version:
      type == "string" and
      test("^v?(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$");
    def version_parts:
      sub("^v"; "") | split(".") | map(tonumber) | . + [0, 0] | .[0:3];
    def semver_consistent:
      (.prevVersion | version_parts) as $previous |
      (.newVersion | version_parts) as $next |
      if .updateType == "version-update:semver-patch" then
        $previous[0] == $next[0] and
        $previous[1] == $next[1] and
        $next[2] > $previous[2]
      elif .updateType == "version-update:semver-minor" then
        $previous[0] == $next[0] and
        $next[1] > $previous[1]
      else
        false
      end;

    type == "array" and length > 0 and
    all(.[];
      (.dependencyName | type == "string" and length > 0) and
      (.dependencyType == "direct:production" or
       .dependencyType == "direct:development" or
       .dependencyType == "indirect") and
      (.updateType == "version-update:semver-patch" or
       .updateType == "version-update:semver-minor") and
      .packageEcosystem == $ecosystem and
      .targetBranch == "main" and
      .directory == "/" and
      .maintainerChanges == false and
      (.prevVersion | stable_version) and
      (.newVersion | stable_version) and
      semver_consistent) and
    (if any(.[]; .updateType == "version-update:semver-minor") then
       $aggregate == "version-update:semver-minor"
     else
       $aggregate == "version-update:semver-patch"
     end)
  ' "${UPDATED_DEPENDENCIES_JSON_FILE}" >/dev/null
}

validate_bun_files() {
  jq -e '
    all(.[].filename;
      . == "package.json" or
      . == "bun.lock" or
      . == "projects/effect-platform-angular/package.json" or
      . == "projects/effect-angular-query/package.json")
  ' "${CHANGED_FILES_JSON_FILE}" >/dev/null
}

validate_github_actions_files() {
  jq -e '
    all(.[];
      (.filename | test("^\\.github/workflows/[^/]+\\.ya?ml$")) and
      (.patch | type == "string" and length > 0) and
      (.additions | type == "number" and . > 0) and
      (.deletions | type == "number" and . > 0) and
      .changes == (.additions + .deletions))
  ' "${CHANGED_FILES_JSON_FILE}" >/dev/null || return 1

  local seen_actions
  local added_actions
  local deleted_actions
  local expected_actions
  local changed_line_count=0
  local added_line_count=0
  local deleted_line_count=0
  seen_actions="$(mktemp)"
  added_actions="$(mktemp)"
  deleted_actions="$(mktemp)"
  expected_actions="$(mktemp)"

  while IFS= read -r line; do
    case "${line}" in
      +++* | ---*) continue ;;
      +* | -*)
        changed_line_count=$((changed_line_count + 1))
        if [[ "${line}" == +* ]]; then
          added_line_count=$((added_line_count + 1))
        else
          deleted_line_count=$((deleted_line_count + 1))
        fi
        if [[ ! "${line}" =~ ^[+-][[:space:]]+uses:[[:space:]]+([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)@[0-9a-f]{40}([[:space:]]+#.*)?$ ]]; then
          rm -f "${seen_actions}" "${added_actions}" "${deleted_actions}" "${expected_actions}"
          return 1
        fi
        echo "${BASH_REMATCH[1]}" >> "${seen_actions}"
        if [[ "${line}" == +* ]]; then
          echo "${BASH_REMATCH[1]}" >> "${added_actions}"
        else
          echo "${BASH_REMATCH[1]}" >> "${deleted_actions}"
        fi
        ;;
    esac
  done < <(jq -r '.[].patch' "${CHANGED_FILES_JSON_FILE}")

  if [[ "${changed_line_count}" -eq 0 ]]; then
    rm -f "${seen_actions}" "${added_actions}" "${deleted_actions}" "${expected_actions}"
    return 1
  fi

  local expected_additions
  local expected_deletions
  expected_additions="$(jq '[.[].additions] | add' "${CHANGED_FILES_JSON_FILE}")"
  expected_deletions="$(jq '[.[].deletions] | add' "${CHANGED_FILES_JSON_FILE}")"
  if [[ "${added_line_count}" -ne "${expected_additions}" ||
        "${deleted_line_count}" -ne "${expected_deletions}" ||
        "${added_line_count}" -ne "${deleted_line_count}" ]]; then
    rm -f "${seen_actions}" "${added_actions}" "${deleted_actions}" "${expected_actions}"
    return 1
  fi

  sort -o "${added_actions}" "${added_actions}"
  sort -o "${deleted_actions}" "${deleted_actions}"
  if ! diff -q "${added_actions}" "${deleted_actions}" >/dev/null; then
    rm -f "${seen_actions}" "${added_actions}" "${deleted_actions}" "${expected_actions}"
    return 1
  fi

  jq -r '.[].dependencyName' "${UPDATED_DEPENDENCIES_JSON_FILE}" | sort -u > "${expected_actions}"
  sort -u -o "${seen_actions}" "${seen_actions}"

  if ! diff -q "${expected_actions}" "${seen_actions}" >/dev/null; then
    rm -f "${seen_actions}" "${added_actions}" "${deleted_actions}" "${expected_actions}"
    return 1
  fi

  rm -f "${seen_actions}" "${added_actions}" "${deleted_actions}" "${expected_actions}"
}

write_classification_outputs() {
  {
    echo "automerge_eligible=${automerge_eligible}"
    echo "reason=${classification_reason}"
    echo "should_create=${should_create:-false}"
    echo "bump_platform=${bump_platform:-false}"
    echo "bump_query=${bump_query:-false}"
  } >> "${GITHUB_OUTPUT}"
}

classify_update() {
  require_env PR_NUMBER
  require_env REPOSITORY
  require_env HEAD_SHA
  require_env HEAD_REF
  require_env BASE_SHA
  require_env PACKAGE_ECOSYSTEM
  require_env UPDATE_TYPE
  require_env UPDATED_DEPENDENCIES_JSON_FILE
  require_env ARTIFACT_DIR
  require_env GITHUB_OUTPUT

  local automerge_eligible=false
  local classification_reason=not_eligible
  local should_create=false
  local bump_platform=false
  local bump_query=false

  if ! validate_snapshot; then
    classification_reason=invalid_pr_snapshot
    write_classification_outputs
    return
  fi

  case "${PACKAGE_ECOSYSTEM}" in
    bun)
      if ! validate_bun_files; then
        classification_reason=unexpected_bun_files
        write_classification_outputs
        return
      fi
      ;;
    github-actions | github_actions)
      if ! validate_github_actions_files; then
        classification_reason=unexpected_github_actions_diff
        write_classification_outputs
        return
      fi
      ;;
    *)
      classification_reason=unsupported_ecosystem
      write_classification_outputs
      return
      ;;
  esac

  if ! validate_metadata; then
    classification_reason=major_prerelease_or_invalid_metadata
    write_classification_outputs
    return
  fi

  if [[ "${PACKAGE_ECOSYSTEM}" == "bun" ]] &&
    jq -e 'any(.[];
      .dependencyType == "direct:production" and
      ((.dependencyName // "") as $name |
        ($name == "effect" or $name == "rxjs" or $name == "tslib" or
         ($name | startswith("@angular/")) or
         ($name | startswith("@tanstack/"))) | not))' \
      "${UPDATED_DEPENDENCIES_JSON_FILE}" >/dev/null; then
    classification_reason=unmapped_production_dependency
    write_classification_outputs
    return
  fi

  local scope_output
  scope_output="$(mktemp)"
  export UPDATED_DEPENDENCIES_JSON
  UPDATED_DEPENDENCIES_JSON="$(< "${UPDATED_DEPENDENCIES_JSON_FILE}")"
  GITHUB_OUTPUT="${scope_output}" scope_changeset

  should_create="$(sed -n 's/^should_create=//p' "${scope_output}")"
  bump_platform="$(sed -n 's/^bump_platform=//p' "${scope_output}")"
  bump_query="$(sed -n 's/^bump_query=//p' "${scope_output}")"
  local scope_reason
  scope_reason="$(sed -n 's/^reason=//p' "${scope_output}")"
  rm -f "${scope_output}"

  automerge_eligible=true
  classification_reason=stable_minor_or_patch
  mkdir -p "${ARTIFACT_DIR}"

  local changeset_path=""
  local changeset_sha256=""
  if [[ "${should_create}" == "true" ]]; then
    local create_output
    create_output="$(mktemp)"
    OUTPUT_FILE="${ARTIFACT_DIR}/changeset.md" \
      BUMP_PLATFORM="${bump_platform}" \
      BUMP_QUERY="${bump_query}" \
      GITHUB_OUTPUT="${create_output}" \
      create_changeset
    rm -f "${create_output}"
    changeset_path=".changeset/dependabot-pr-${PR_NUMBER}.md"
    changeset_sha256="$(sha256_file "${ARTIFACT_DIR}/changeset.md")"
  fi

  jq -n \
    --argjson schema_version 1 \
    --arg repository "${REPOSITORY}" \
    --argjson pr_number "${PR_NUMBER}" \
    --arg head_sha "${HEAD_SHA}" \
    --arg head_ref "${HEAD_REF}" \
    --arg base_sha "${BASE_SHA}" \
    --arg package_ecosystem "${PACKAGE_ECOSYSTEM}" \
    --arg update_type "${UPDATE_TYPE}" \
    --argjson should_create_changeset "${should_create}" \
    --arg changeset_path "${changeset_path}" \
    --arg changeset_sha256 "${changeset_sha256}" \
    --argjson bump_platform "${bump_platform}" \
    --argjson bump_query "${bump_query}" \
    --arg scope_reason "${scope_reason}" \
    --slurpfile dependencies "${UPDATED_DEPENDENCIES_JSON_FILE}" \
    '{
      schema_version: $schema_version,
      repository: $repository,
      pr_number: $pr_number,
      head_sha: $head_sha,
      head_ref: $head_ref,
      base_sha: $base_sha,
      package_ecosystem: $package_ecosystem,
      update_type: $update_type,
      should_create_changeset: $should_create_changeset,
      changeset_path: $changeset_path,
      changeset_sha256: $changeset_sha256,
      bump_platform: $bump_platform,
      bump_query: $bump_query,
      scope_reason: $scope_reason,
      dependencies: $dependencies[0]
    }' > "${ARTIFACT_DIR}/policy.json"

  write_classification_outputs
}

case "${1:-}" in
  scope)
    scope_changeset
    ;;
  create)
    create_changeset
    ;;
  classify)
    classify_update
    ;;
  *)
    echo "Usage: $0 <scope|create|classify>" >&2
    exit 2
    ;;
esac
