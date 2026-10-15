#!/usr/bin/env bash
# scripts/github/lib.sh — Shared utilities for the setup system.
# Sourced by setup.sh and helper scripts; never executed directly.
#
# Provides: logging, confirmation, backup, GitHub API helpers,
#           Git helpers, prerequisite checking.

# Guard against double-sourcing.
[[ -n "${_REWAP_LIB_LOADED:-}" ]] && return 0
_REWAP_LIB_LOADED=1

# ── Colour and output ────────────────────────────────────────────────────────

if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
  _c_reset=$'\033[0m'
  _c_bold=$'\033[1m'
  _c_dim=$'\033[2m'
  _c_red=$'\033[31m'
  _c_green=$'\033[32m'
  _c_yellow=$'\033[33m'
  _c_blue=$'\033[34m'
  _c_cyan=$'\033[36m'
else
  _c_reset="" _c_bold="" _c_dim="" _c_red="" _c_green=""
  _c_yellow="" _c_blue="" _c_cyan=""
fi

# ── Logging ──────────────────────────────────────────────────────────────────

_log_level="${LOG_LEVEL:-info}"

_log_level_num() {
  case "$1" in
    debug) echo 0 ;;
    info)  echo 1 ;;
    warn)  echo 2 ;;
    error) echo 3 ;;
    *)     echo 1 ;;
  esac
}

_should_log() {
  local msg_level cur_level
  msg_level=$(_log_level_num "$1")
  cur_level=$(_log_level_num "${_log_level}")
  (( msg_level >= cur_level ))
}

log_debug() { _should_log debug && printf '%s[debug]%s %s\n' "${_c_dim}" "${_c_reset}" "$*" >&2 || true; }
log_info()  { _should_log info  && printf '%s[info]%s  %s\n' "${_c_green}" "${_c_reset}" "$*" >&2 || true; }
log_warn()  { _should_log warn  && printf '%s[warn]%s  %s\n' "${_c_yellow}" "${_c_reset}" "$*" >&2 || true; }
log_error() { _should_log error && printf '%s[error]%s %s\n' "${_c_red}" "${_c_reset}" "$*" >&2 || true; }
log_step()  { _should_log info  && printf '\n%s▸%s %s\n' "${_c_bold}${_c_blue}" "${_c_reset}" "$*" >&2 || true; }
log_ok()    { _should_log info  && printf '  %s✓%s %s\n' "${_c_green}" "${_c_reset}" "$*" >&2 || true; }
log_fail()  { _should_log error && printf '  %s✗%s %s\n' "${_c_red}" "${_c_reset}" "$*" >&2 || true; }
log_skip()  { _should_log info  && printf '  %s→%s skipped: %s\n' "${_c_dim}" "${_c_reset}" "$*" >&2 || true; }

# ── Summary tracking ─────────────────────────────────────────────────────────

_SUMMARY_PASSED=0
_SUMMARY_FAILED=0
_SUMMARY_SKIPPED=0
_SUMMARY_WARNINGS=0

summary_pass() { (( _SUMMARY_PASSED++ )) || true; log_ok "$@"; }
summary_fail() { (( _SUMMARY_FAILED++ )) || true; log_fail "$@"; }
summary_skip() { (( _SUMMARY_SKIPPED++ )) || true; log_skip "$@"; }
summary_warn() { (( _SUMMARY_WARNINGS++ )) || true; log_warn "$@"; }

print_summary() {
  printf '\n%s── Summary ──%s\n' "${_c_bold}" "${_c_reset}" >&2
  printf '  %s✓%s passed:   %d\n'   "${_c_green}" "${_c_reset}" "${_SUMMARY_PASSED}" >&2
  printf '  %s✗%s failed:   %d\n'   "${_c_red}"   "${_c_reset}" "${_SUMMARY_FAILED}" >&2
  printf '  %s→%s skipped:  %d\n'   "${_c_dim}"   "${_c_reset}" "${_SUMMARY_SKIPPED}" >&2
  printf '  %s!%s warnings: %d\n'   "${_c_yellow}" "${_c_reset}" "${_SUMMARY_WARNINGS}" >&2
}

# ── Global flags (set by setup.sh before calling lib functions) ──────────────

DRY_RUN="${DRY_RUN:-0}"
YES="${YES:-0}"
INTERACTIVE="${INTERACTIVE:-0}"
VERBOSE="${VERBOSE:-0}"

# ── Confirmation ─────────────────────────────────────────────────────────────

# ask_confirm MESSAGE
# Returns 0 if confirmed, 1 otherwise. Honours --yes and --interactive.
ask_confirm() {
  local msg="$1"
  if (( YES )); then return 0; fi
  if (( DRY_RUN )); then
    log_info "(dry-run) would ask: ${msg}"
    return 0
  fi
  if (( INTERACTIVE )); then
    printf '%s [y/N] ' "${msg}" >&2
    local reply
    read -r reply
    [[ "${reply}" =~ ^[Yy]$ ]]
  else
    # Non-interactive, not --yes: default to proceeding with informational log.
    log_info "auto-proceeding: ${msg}"
    return 0
  fi
}

# ── Dry-run wrapper ──────────────────────────────────────────────────────────

# run_cmd [DESCRIPTION] -- COMMAND [ARGS...]
# Splits on the first `--` argument. If DRY_RUN, logs the command; otherwise runs it.
run_cmd() {
  local desc=""
  local -a cmd=()
  local seen_separator=0
  for arg in "$@"; do
    if (( seen_separator )); then
      cmd+=("$arg")
    elif [[ "$arg" == "--" ]]; then
      seen_separator=1
    else
      desc="$arg"
    fi
  done
  if (( ! seen_separator )); then
    log_error "run_cmd: missing '--' separator"
    return 1
  fi
  if (( DRY_RUN )); then
    log_info "(dry-run) ${desc:-${cmd[*]}}"
    return 0
  fi
  if [[ -n "${desc}" ]]; then
    log_debug "running: ${desc}"
  fi
  "${cmd[@]}"
}

# ── Backups ──────────────────────────────────────────────────────────────────

BACKUP_DIR="${BACKUP_DIR:-./.setup-backups}"

ensure_backup_dir() {
  mkdir -p "${BACKUP_DIR}"
}

# backup_file PATH — copies to BACKUP_DIR with timestamp if file exists.
backup_file() {
  local src="$1"
  [[ -f "${src}" ]] || return 0
  ensure_backup_dir
  local ts
  ts=$(date +%Y%m%d-%H%M%S)
  local base
  base=$(basename "${src}")
  local dest="${BACKUP_DIR}/${base}.${ts}.bak"
  cp "${src}" "${dest}"
  log_debug "backed up ${src} → ${dest}"
}

# ── Git helpers ──────────────────────────────────────────────────────────────

# repo_root — prints the repository root or fails.
repo_root() {
  git rev-parse --show-toplevel 2>/dev/null
}

# current_branch — prints the current branch name.
current_branch() {
  git rev-parse --abbrev-ref HEAD 2>/dev/null
}

# remote_default_branch [REMOTE] — prints the default branch of the remote.
remote_default_branch() {
  local remote="${1:-origin}"
  git remote show "${remote}" 2>/dev/null \
    | sed -n 's/.*HEAD branch: //p' \
    | head -1
}

# remote_url [REMOTE] — prints the fetch URL.
remote_url() {
  git remote get-url "${1:-origin}" 2>/dev/null
}

# repo_slug_from_remote URL — extracts OWNER/REPO from a Git URL.
repo_slug_from_remote() {
  local url="$1"
  # SSH: git@github.com:owner/repo.git
  # HTTPS: https://github.com/owner/repo.git
  local slug
  slug="${url#git@github.com:}"
  slug="${slug#https://github.com/}"
  slug="${slug#ssh://git@github.com/}"
  slug="${slug%.git}"
  slug="${slug%/}"
  printf '%s' "${slug}"
}

# has_uncommitted_changes — returns 0 if there are staged or unstaged changes.
has_uncommitted_changes() {
  ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet 2>/dev/null
}

# ── GitHub CLI helpers ───────────────────────────────────────────────────────

# gh_available — returns 0 if gh is installed and authenticated.
gh_available() {
  command -v gh >/dev/null 2>&1 || return 1
  gh auth status >/dev/null 2>&1 || return 1
}

# gh_auth_user — prints the authenticated GitHub username.
gh_auth_user() {
  gh api user --jq '.login' 2>/dev/null
}

# gh_repo_field REPO FIELD — reads one field from the repository.
gh_repo_field() {
  local repo="$1" field="$2"
  gh api "repos/${repo}" --jq ".${field}" 2>/dev/null
}

# gh_repo_update REPO JSON_PAYLOAD — PATCHes the repository settings.
gh_repo_update() {
  local repo="$1" payload="$2"
  gh api "repos/${repo}" \
    --method PATCH \
    --input - <<< "${payload}"
}

# gh_verify_setting REPO FIELD EXPECTED — reads a setting and compares.
gh_verify_setting() {
  local repo="$1" field="$2" expected="$3"
  local actual
  actual=$(gh_repo_field "${repo}" "${field}")
  if [[ "${actual}" == "${expected}" ]]; then
    return 0
  else
    log_warn "repo ${field}: expected '${expected}', got '${actual}'"
    return 1
  fi
}

# ── Prerequisite checking ────────────────────────────────────────────────────

# require_cmd NAME [INSTALL_HINT]
require_cmd() {
  local name="$1"
  local hint="${2:-}"
  if command -v "${name}" >/dev/null 2>&1; then
    log_debug "found ${name}: $(command -v "${name}")"
    return 0
  fi
  log_error "${name} is not installed."
  if [[ -n "${hint}" ]]; then
    log_error "  install: ${hint}"
  fi
  return 1
}

# check_node_major — returns the Node.js major version or 0 if not installed.
node_major() {
  if command -v node >/dev/null 2>&1; then
    node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))' 2>/dev/null || echo 0
  else
    echo 0
  fi
}

# ── CI check-run discovery ──────────────────────────────────────────────────

# gh_ci_check_names REPO — lists recent check-run names for the default branch.
gh_ci_check_names() {
  local repo="$1"
  local sha
  sha=$(gh api "repos/${repo}/commits" --jq '.[0].sha' 2>/dev/null)
  [[ -n "${sha}" ]] || return 1
  gh api "repos/${repo}/commits/${sha}/check-runs" \
    --jq '.check_runs[].name' 2>/dev/null \
    | sort -u
}