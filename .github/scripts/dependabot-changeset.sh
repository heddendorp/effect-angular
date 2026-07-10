#!/usr/bin/env bash

set -euo pipefail

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
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
  require_env BASE_SHA
  require_env HEAD_SHA
  require_env GITHUB_OUTPUT

  git cat-file -e "${BASE_SHA}^{commit}"
  git cat-file -e "${HEAD_SHA}^{commit}"

  local changed_files=()
  while IFS= read -r file; do
    changed_files+=("${file}")
  done < <(git diff --name-only "${BASE_SHA}" "${HEAD_SHA}")

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
    case "${DEPENDENCY_GROUP:-}" in
      tooling)
        reason=development_only_tooling
        ;;
      tanstack)
        bump_query=true
        reason=tanstack_dependency_group
        ;;
      angular|effect)
        if [[ "${DEPENDENCY_TYPE:-}" == "direct:development" ]]; then
          reason=development_only
        else
          bump_platform=true
          bump_query=true
          reason="${DEPENDENCY_GROUP}_dependency_group"
        fi
        ;;
      *)
        if [[ "${DEPENDENCY_TYPE:-}" == "direct:development" ]]; then
          reason=development_only
        else
          if jq -e 'type == "array" and length > 0' \
            <<< "${UPDATED_DEPENDENCIES_JSON:-}" >/dev/null; then
            if jq -e 'any(.[]; (.dependencyName // "") | startswith("@tanstack/"))' \
              <<< "${UPDATED_DEPENDENCIES_JSON}" >/dev/null; then
              bump_query=true
            fi

            if jq -e 'any(.[]; (.dependencyName // "") as $name |
              $name == "effect" or $name == "rxjs" or $name == "tslib" or
              ($name | startswith("@angular/")))' \
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
        fi
        ;;
    esac
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

  local file=".changeset/dependabot-pr-${PR_NUMBER}.md"
  mkdir -p .changeset

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

case "${1:-}" in
  scope)
    scope_changeset
    ;;
  create)
    create_changeset
    ;;
  *)
    echo "Usage: $0 <scope|create>" >&2
    exit 2
    ;;
esac
