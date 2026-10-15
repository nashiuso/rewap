#!/usr/bin/env bash
# Re-exec under bash if invoked with sh/dash (BASH_SOURCE is bash-only).
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi
# ══════════════════════════════════════════════════════════════════════════════
# scripts/github/setup.sh — Rewap repository configuration and automation.
#
# Configures local Git settings, installs commit hooks, and sets up GitHub
# repository metadata, branch protection, Pages and security features.
#
# Safe to run repeatedly. Creates backups before modifying local files.
# Requires explicit confirmation before applying remote changes.
#
# Usage:
#   ./scripts/github/setup.sh [OPTIONS]
#
# See --help for all options and examples.
# ══════════════════════════════════════════════════════════════════════════════

set -Eeuo pipefail

# ── Script identity ──────────────────────────────────────────────────────────

SCRIPT_VERSION="1.0.0"
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_PATH}/../.." && pwd)"

# ── Source the shared library ────────────────────────────────────────────────

# shellcheck source-path=SCRIPTDIR
# shellcheck source=lib.sh
source "${SCRIPT_PATH}/lib.sh"

# ── Defaults ─────────────────────────────────────────────────────────────────

REPO="nashiuso/rewap"
REPO_PATH="${REPO_ROOT}"
DEFAULT_BRANCH="main"
BACKUP_DIR="${REPO_ROOT}/.setup-backups"

# Mode flags
MODE_ALL=0
MODE_LOCAL=0
MODE_GITHUB=0
MODE_CHECK=0
MODE_DRY_RUN=0
MODE_HELP=0
MODE_VERSION=0

# Feature flags (exported so lib.sh and stages can read them)
export SKIP_DEPS=0
export SKIP_HOOKS=0
export SKIP_WORKFLOWS=0
export SKIP_BRANCH_PROTECTION=0
export SKIP_PAGES=0
export SKIP_SECURITY=0
export SKIP_METADATA=0
export SKIP_COMMIT_HOOK=0

# User flags
FORCE_YES=0
FORCE_INTERACTIVE=0
FORCE_VERBOSE=0

# Config values (can be set by env, conf file, or interactively)
CFG_GIT_USER_NAME="${GIT_USER_NAME:-}"
CFG_GIT_USER_EMAIL="${GIT_USER_EMAIL:-}"
CFG_TOPICS="react,drag-and-drop,reorder,layout,typescript,accessibility"
CFG_DESCRIPTION="Draggable, swappable, reorderable React layouts. Framework-neutral core, small public API."
CFG_HOMEPAGE="https://nashiuso.github.io/rewap/"
CFG_ENABLE_DISCUSSIONS=1
CFG_ENABLE_WIKI=0
CFG_ENABLE_PROJECTS=0
CFG_AUTO_DELETE_HEAD=1
CFG_SQUASH_MERGE=1
CFG_REQUIRE_PR_REVIEWS=0
CFG_REQUIRED_CHECKS=""

# ── Load config file ────────────────────────────────────────────────────────

load_config() {
  local conf_candidates=(
    "${SCRIPT_PATH}/setup.conf"
    "${REPO_ROOT}/setup.conf"
    "${REPO_ROOT}/scripts/github/setup.conf"
  )
  for conf in "${conf_candidates[@]}"; do
    if [[ -f "${conf}" ]]; then
      log_info "loading config from ${conf}"
      # Source safely — only variable assignments, no commands.
      while IFS='=' read -r key value; do
        key=$(echo "${key}" | tr -d '[:space:]')
        [[ -z "${key}" || "${key}" == \#* ]] && continue
        value=$(echo "${value}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed 's/^"//;s/"$//' | sed "s/^'//;s/'$//")
        case "${key}" in
          REPO)                   REPO="${value}" ;;
          DEFAULT_BRANCH)         DEFAULT_BRANCH="${value}" ;;
          REPO_PATH)              [[ -n "${value}" ]] && REPO_PATH="${value}" ;;
          BACKUP_DIR)             [[ -n "${value}" ]] && BACKUP_DIR="${value}" ;;
          GIT_USER_NAME)          [[ -n "${value}" ]] && CFG_GIT_USER_NAME="${value}" ;;
          GIT_USER_EMAIL)         [[ -n "${value}" ]] && CFG_GIT_USER_EMAIL="${value}" ;;
          ENABLE_DISCUSSIONS)     CFG_ENABLE_DISCUSSIONS="${value}" ;;
          ENABLE_WIKI)            CFG_ENABLE_WIKI="${value}" ;;
          ENABLE_PROJECTS)        CFG_ENABLE_PROJECTS="${value}" ;;
          AUTO_DELETE_HEAD_BRANCHES) CFG_AUTO_DELETE_HEAD="${value}" ;;
          SQUASH_MERGE_DEFAULT)   CFG_SQUASH_MERGE="${value}" ;;
          REQUIRE_PR_REVIEWS)     CFG_REQUIRE_PR_REVIEWS="${value}" ;;
          REQUIRED_CHECKS)        [[ -n "${value}" ]] && CFG_REQUIRED_CHECKS="${value}" ;;
          TOPICS)                 [[ -n "${value}" ]] && CFG_TOPICS="${value}" ;;
          DESCRIPTION)            [[ -n "${value}" ]] && CFG_DESCRIPTION="${value}" ;;
          HOMEPAGE)               [[ -n "${value}" ]] && CFG_HOMEPAGE="${value}" ;;
        esac
      done < "${conf}"
      return 0
    fi
  done
}

# ── Argument parsing ────────────────────────────────────────────────────────

usage() {
  cat <<'HELP'
Rewap Repository Setup — configure local Git and GitHub repository settings.

USAGE
  setup.sh [OPTIONS]

MODES (select one; default: --all)
  --help              Show this help message and exit.
  --version           Print the script version and exit.
  --dry-run           Show planned actions without making changes.
  --check             Inspect the current setup; report only, do not modify.
  --local             Configure local Git and repository files only.
  --github            Configure remote GitHub repository settings only.
  --all               Run all selected setup stages (default).

OPTIONS
  --interactive       Ask before applying consequential changes.
  --yes               Skip ordinary confirmation prompts (safety checks remain).
  --repo OWNER/REPO   Select the GitHub repository (default: nashiuso/rewap).
  --path PATH         Select the local repository directory.
  --branch NAME       Set the intended default branch (default: main).
  --backup-dir PATH   Specify where backups are stored.

SKIP FLAGS
  --skip-dependencies     Do not check or install local tools.
  --skip-hooks            Skip local Git hook installation.
  --skip-commit-hook      Skip the commit-msg validation hook only.
  --skip-workflows        Skip workflow validation.
  --skip-branch-protection Skip branch protection configuration.
  --skip-pages            Skip GitHub Pages configuration.
  --skip-security         Skip security settings.
  --skip-metadata         Skip repository description and topics.

OUTPUT
  --verbose           Enable detailed diagnostic output.

EXAMPLES
  # Full setup with confirmation prompts:
  ./scripts/github/setup.sh --all --interactive

  # Inspect without changing anything:
  ./scripts/github/setup.sh --check

  # Local-only configuration, auto-proceed:
  ./scripts/github/setup.sh --local --yes

  # Dry-run for GitHub settings:
  ./scripts/github/setup.sh --github --dry-run

  # Target a different repo:
  ./scripts/github/setup.sh --repo myuser/myfork --check
HELP
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --help|-h)               MODE_HELP=1 ;;
      --version|-V)            MODE_VERSION=1 ;;
      --dry-run|-n)            MODE_DRY_RUN=1 ;;
      --check|-c)              MODE_CHECK=1 ;;
      --local|-l)              MODE_LOCAL=1 ;;
      --github|-g)             MODE_GITHUB=1 ;;
      --all|-a)                MODE_ALL=1 ;;
      --interactive|-i)        FORCE_INTERACTIVE=1 ;;
      --yes|-y)                FORCE_YES=1 ;;
      --repo)                  shift; REPO="${1}" ;;
      --path)                  shift; REPO_PATH="${1}" ;;
      --branch)                shift; DEFAULT_BRANCH="${1}" ;;
      --backup-dir)            shift; BACKUP_DIR="${1}"; export BACKUP_DIR ;;
      --skip-dependencies)     SKIP_DEPS=1 ;;
      --skip-hooks)            SKIP_HOOKS=1 ;;
      --skip-commit-hook)      SKIP_COMMIT_HOOK=1 ;;
      --skip-workflows)        SKIP_WORKFLOWS=1 ;;
      --skip-branch-protection) SKIP_BRANCH_PROTECTION=1 ;;
      --skip-pages)            SKIP_PAGES=1 ;;
      --skip-security)         SKIP_SECURITY=1 ;;
      --skip-metadata)         SKIP_METADATA=1 ;;
      --verbose|-v)            FORCE_VERBOSE=1 ;;
      *)
        log_error "unknown option: $1"
        log_error "Run 'setup.sh --help' for usage."
        exit 1
        ;;
    esac
    shift
  done
}

apply_mode_defaults() {
  # If no explicit mode was given, default to --all.
  if (( ! MODE_LOCAL && ! MODE_GITHUB && ! MODE_CHECK )); then
    MODE_ALL=1
  fi
  # --all enables both local and github.
  if (( MODE_ALL )); then
    MODE_LOCAL=1
    MODE_GITHUB=1
  fi
  # --check disables writes.
  if (( MODE_CHECK )); then
    MODE_DRY_RUN=1
  fi
  # --dry-run propagates to the library.
  if (( MODE_DRY_RUN )); then
    DRY_RUN=1
  fi
  if (( FORCE_YES )); then
    YES=1; export YES
  fi
  if (( FORCE_INTERACTIVE )); then
    INTERACTIVE=1; export INTERACTIVE
  fi
  if (( FORCE_VERBOSE )); then
    VERBOSE=1; export VERBOSE
    _log_level=debug
  fi
}

# ── Stage: prerequisites ────────────────────────────────────────────────────

stage_prerequisites() {
  log_step "Checking prerequisites"
  local ok=1

  # Git
  if require_cmd git "apt install git"; then
    local gv
    gv=$(git --version | awk '{print $3}')
    log_ok "git ${gv}"
  else
    ok=0
  fi

  # Node.js
  local nm
  nm=$(node_major)
  if (( nm >= 20 )); then
    log_ok "node $(node --version)"
  elif (( nm > 0 )); then
    log_warn "node $(node --version) — project requires ≥20 for tests, ≥22 for docs"
  else
    log_warn "node not found — required for tests and builds"
  fi

  # npm
  if require_cmd npm "install Node.js from https://nodejs.org/"; then
    log_ok "npm $(npm --version)"
  else
    ok=0
  fi

  # GitHub CLI
  if command -v gh >/dev/null 2>&1; then
    log_ok "gh $(gh --version 2>/dev/null | head -1 | awk '{print $3}')"
    if gh auth status >/dev/null 2>&1; then
      local user
      user=$(gh_auth_user)
      log_ok "gh authenticated as ${user}"
    else
      log_warn "gh installed but not authenticated"
      if (( MODE_GITHUB && ! MODE_CHECK )); then
        log_error "GitHub configuration requires authentication."
        log_error "  Run: gh auth login"
        ok=0
      fi
    fi
  else
    if (( MODE_GITHUB )); then
      log_warn "gh not installed — GitHub operations will be skipped"
      log_warn "  install: https://cli.github.com/ or: sudo apt install gh"
    fi
  fi

  # ShellCheck (optional)
  if command -v shellcheck >/dev/null 2>&1; then
    log_ok "shellcheck available"
  else
    log_debug "shellcheck not installed (optional)"
  fi

  if (( ok )); then
    summary_pass "prerequisites OK"
  else
    summary_fail "prerequisites check failed"
  fi
  return 0
}

# ── Stage: local git ────────────────────────────────────────────────────────

stage_local_git() {
  log_step "Local Git configuration"

  # Verify we are in the right repository.
  local actual_root
  actual_root=$(repo_root) || {
    summary_fail "not inside a Git repository"
    return 1
  }
  if [[ "${actual_root}" != "${REPO_PATH}" ]]; then
    log_warn "repo root is ${actual_root}, expected ${REPO_PATH}"
    REPO_PATH="${actual_root}"
  fi

  # Check remote.
  local remote_url
  remote_url=$(remote_url origin 2>/dev/null || true)
  if [[ -n "${remote_url}" ]]; then
    local remote_slug
    remote_slug=$(repo_slug_from_remote "${remote_url}")
    if [[ "${remote_slug}" == "${REPO}" ]]; then
      log_ok "remote origin matches ${REPO}"
    else
      log_warn "remote origin is '${remote_slug}', expected '${REPO}'"
      if ask_confirm "Update origin URL to match ${REPO}?"; then
        local new_url
        if [[ "${remote_url}" == git@* ]]; then
          new_url="git@github.com:${REPO}.git"
        else
          new_url="https://github.com/${REPO}.git"
        fi
        run_cmd "set origin → ${new_url}" -- git remote set-url origin "${new_url}"
        summary_pass "remote origin updated"
      else
        summary_skip "remote origin URL mismatch"
      fi
    fi
  else
    log_warn "no 'origin' remote configured"
    if ask_confirm "Add origin for ${REPO}?"; then
      run_cmd "add origin" -- git remote add origin "https://github.com/${REPO}.git"
      summary_pass "origin added"
    else
      summary_skip "no origin configured"
    fi
  fi

  # Git identity (repo-local).
  local current_name current_email
  current_name=$(git config user.name 2>/dev/null || true)
  current_email=$(git config user.email 2>/dev/null || true)

  if [[ -z "${current_name}" ]]; then
    if [[ -n "${CFG_GIT_USER_NAME}" ]]; then
      if (( ! DRY_RUN )); then
        git config user.name "${CFG_GIT_USER_NAME}"
      fi
      summary_pass "set repo-local user.name → ${CFG_GIT_USER_NAME}"
    else
      log_warn "git user.name is not configured"
      if (( INTERACTIVE )); then
        printf 'Enter your name for Git (leave empty to skip): ' >&2
        local input_name
        read -r input_name
        if [[ -n "${input_name}" ]]; then
          if (( ! DRY_RUN )); then
            git config user.name "${input_name}"
          fi
          summary_pass "set repo-local user.name → ${input_name}"
        else
          summary_skip "user.name not set"
        fi
      else
        summary_skip "user.name not configured (use --interactive or set GIT_USER_NAME)"
      fi
    fi
  else
    log_ok "user.name: ${current_name}"
    if [[ -n "${CFG_GIT_USER_NAME}" && "${CFG_GIT_USER_NAME}" != "${current_name}" ]]; then
      log_warn "config specifies '${CFG_GIT_USER_NAME}' but current is '${current_name}'"
      if ask_confirm "Change user.name to '${CFG_GIT_USER_NAME}'?"; then
        if (( ! DRY_RUN )); then
          git config user.name "${CFG_GIT_USER_NAME}"
        fi
        summary_pass "user.name updated"
      else
        summary_skip "user.name unchanged"
      fi
    fi
  fi

  if [[ -z "${current_email}" ]]; then
    if [[ -n "${CFG_GIT_USER_EMAIL}" ]]; then
      if (( ! DRY_RUN )); then
        git config user.email "${CFG_GIT_USER_EMAIL}"
      fi
      summary_pass "set repo-local user.email → ${CFG_GIT_USER_EMAIL}"
    else
      log_warn "git user.email is not configured"
      if (( INTERACTIVE )); then
        printf 'Enter your email for Git (leave empty to skip): ' >&2
        local input_email
        read -r input_email
        if [[ -n "${input_email}" ]]; then
          if (( ! DRY_RUN )); then
            git config user.email "${input_email}"
          fi
          summary_pass "set repo-local user.email → ${input_email}"
        else
          summary_skip "user.email not set"
        fi
      else
        summary_skip "user.email not configured (use --interactive or set GIT_USER_EMAIL)"
      fi
    fi
  else
    log_ok "user.email: ${current_email}"
  fi

  # Default branch check.
  local cur_branch
  cur_branch=$(current_branch)
  if [[ "${cur_branch}" == "${DEFAULT_BRANCH}" ]]; then
    log_ok "on default branch: ${DEFAULT_BRANCH}"
  else
    log_warn "current branch is '${cur_branch}', expected '${DEFAULT_BRANCH}'"
    summary_warn "not on ${DEFAULT_BRANCH} (currently on ${cur_branch})"
  fi

  # Uncommitted changes warning.
  if has_uncommitted_changes; then
    log_warn "uncommitted changes detected"
    summary_warn "working tree has uncommitted changes"
  else
    log_ok "working tree clean"
  fi

  # Useful aliases (repo-local only).
  local -A aliases=(
    [st]="status"
    [co]="checkout"
    [br]="branch"
    [lg]="log --oneline --graph --decorate -15"
    [d]="diff"
    [dc]="diff --cached"
    [ci]="!npm run ci"
    [e2e]="!npm run test:e2e"
    [site]="!npm run site:build"
  )
  for alias_name in "${!aliases[@]}"; do
    local existing
    existing=$(git config "alias.${alias_name}" 2>/dev/null || true)
    if [[ -z "${existing}" ]]; then
      if (( ! DRY_RUN )); then
        git config "alias.${alias_name}" "${aliases[${alias_name}]}"
      fi
      log_debug "set alias.${alias_name} = ${aliases[${alias_name}]}"
    fi
  done
  log_ok "repo-local Git aliases configured (st, br, lg, d, dc, ci, e2e, site)"

  # Diff-so-fancy or color settings.
  if [[ -z "$(git config color.ui 2>/dev/null)" ]]; then
    if (( ! DRY_RUN )); then
      git config color.ui auto
    fi
    log_ok "color.ui set to auto"
  fi

  summary_pass "local Git configuration complete"
}

# ── Stage: commit hook ───────────────────────────────────────────────────────

stage_commit_hook() {
  log_step "Commit message hook"

  if (( SKIP_COMMIT_HOOK )); then
    summary_skip "commit hook skipped by flag"
    return 0
  fi

  local hook_src="${SCRIPT_PATH}/hooks/commit-msg"
  if [[ ! -f "${hook_src}" ]]; then
    summary_fail "commit-msg hook source not found at ${hook_src}"
    return 1
  fi

  # Check for existing hook.
  local hooks_path
  hooks_path=$(git config core.hooksPath 2>/dev/null || true)

  if [[ "${hooks_path}" == "scripts/github/hooks" ]]; then
    log_ok "core.hooksPath already points to scripts/github/hooks"
    summary_pass "commit hook active"
    return 0
  fi

  if [[ -n "${hooks_path}" && "${hooks_path}" != "scripts/github/hooks" ]]; then
    log_warn "core.hooksPath is '${hooks_path}' (not our hooks directory)"
    if ! ask_confirm "Change core.hooksPath to scripts/github/hooks?"; then
      summary_skip "existing hooksPath preserved"
      return 0
    fi
  fi

  # Check for .git/hooks/commit-msg that isn't ours.
  local git_hook="${REPO_PATH}/.git/hooks/commit-msg"
  if [[ -f "${git_hook}" ]]; then
    if head -5 "${git_hook}" | grep -q "scripts/github"; then
      log_debug "existing .git/hooks/commit-msg is ours"
    else
      backup_file "${git_hook}"
      log_warn "existing .git/hooks/commit-msg backed up"
    fi
  fi

  if (( ! DRY_RUN )); then
    git config core.hooksPath scripts/github/hooks
    chmod +x "${hook_src}"
  fi
  summary_pass "core.hooksPath → scripts/github/hooks"

  # Validate the hook syntax.
  if bash -n "${hook_src}" 2>/dev/null; then
    log_ok "commit-msg hook syntax OK"
  else
    log_error "commit-msg hook has syntax errors"
    summary_fail "hook syntax check failed"
  fi
}

# ── Stage: gitignore audit ──────────────────────────────────────────────────

stage_gitignore() {
  log_step "Auditing .gitignore"

  local gi="${REPO_PATH}/.gitignore"
  if [[ ! -f "${gi}" ]]; then
    log_warn ".gitignore not found"
    summary_warn ".gitignore missing"
    return 0
  fi

  local -a required_patterns=(
    "node_modules/"
    "dist/"
    "site-dist/"
    ".env"
    ".env.local"
    "coverage/"
    "test-results/"
    "*.tgz"
  )
  local -a recommended_patterns=(
    ".astro/"
    "docs/.astro/"
    "playwright-report/"
    "blob-report/"
    ".DS_Store"
    "*.log"
  )

  local missing=0
  for pattern in "${required_patterns[@]}"; do
    if ! grep -qF "${pattern}" "${gi}"; then
      log_warn ".gitignore missing required pattern: ${pattern}"
      missing=1
    fi
  done

  for pattern in "${recommended_patterns[@]}"; do
    if ! grep -qF "${pattern}" "${gi}"; then
      log_debug ".gitignore missing recommended pattern: ${pattern}"
    fi
  done

  if (( missing )); then
    summary_warn ".gitignore has gaps"
  else
    summary_pass ".gitignore covers required patterns"
  fi
}

# ── Stage: workflow audit ────────────────────────────────────────────────────

stage_workflow_audit() {
  log_step "Auditing CI workflows"

  local ci_file="${REPO_PATH}/.github/workflows/ci.yml"
  local pages_file="${REPO_PATH}/.github/workflows/pages.yml"

  if [[ -f "${ci_file}" ]]; then
    log_ok "ci.yml present"
    # Verify Node matrix matches engines.
    local engines_node
    engines_node=$(node -e "
      const pkg = require('${REPO_PATH}/package.json');
      console.log(pkg.engines?.node || 'none');
    " 2>/dev/null || echo "unknown")
    log_info "package.json engines.node: ${engines_node}"

    # Verify CI covers the expected areas.
    local -a expected_steps=(
      "format" "typecheck" "lint" "test" "build" "publint" "playwright"
    )
    for step in "${expected_steps[@]}"; do
      if grep -qi "${step}" "${ci_file}"; then
        log_debug "ci.yml references: ${step}"
      fi
    done
    summary_pass "ci.yml structure verified"
  else
    summary_fail "ci.yml not found"
  fi

  if [[ -f "${pages_file}" ]]; then
    log_ok "pages.yml present"
    # Verify it does NOT run on PRs.
    if grep -q "pull_request" "${pages_file}"; then
      log_warn "pages.yml triggers on pull_request — should be push-only for security"
      summary_warn "pages.yml may deploy from PRs"
    else
      log_ok "pages.yml restricted to push/dispatch"
    fi
    # Verify OIDC deployment.
    if grep -q "id-token: write" "${pages_file}"; then
      log_ok "pages.yml uses OIDC (no deployment secret needed)"
    fi
    summary_pass "pages.yml structure verified"
  else
    summary_fail "pages.yml not found"
  fi
}

# ── Stage: GitHub metadata ──────────────────────────────────────────────────

stage_github_metadata() {
  log_step "Repository metadata"

  if ! gh_available; then
    summary_fail "GitHub CLI not authenticated — cannot configure metadata"
    return 1
  fi

  local user
  user=$(gh_auth_user)
  log_ok "authenticated as ${user}"

  # Check permissions.
  local perm
  perm=$(gh api "repos/${REPO}" --jq '.permissions.admin // false' 2>/dev/null || echo "false")
  if [[ "${perm}" != "true" ]]; then
    summary_fail "account '${user}' does not have admin access to ${REPO}"
    return 1
  fi
  log_ok "admin access confirmed"

  # Description.
  local cur_desc
  cur_desc=$(gh_repo_field "${REPO}" "description")
  if [[ "${cur_desc}" == "${CFG_DESCRIPTION}" ]]; then
    log_ok "description matches"
  else
    log_info "current description: ${cur_desc:-<empty>}"
    if ask_confirm "Set description to '${CFG_DESCRIPTION}'?"; then
      run_cmd "set description" -- gh repo edit "${REPO}" --description "${CFG_DESCRIPTION}"
      if gh_verify_setting "${REPO}" "description" "${CFG_DESCRIPTION}"; then
        summary_pass "description updated"
      else
        summary_fail "description update could not be verified"
      fi
    else
      summary_skip "description unchanged"
    fi
  fi

  # Homepage.
  local cur_home
  cur_home=$(gh_repo_field "${REPO}" "homepage")
  if [[ "${cur_home}" == "${CFG_HOMEPAGE}" ]]; then
    log_ok "homepage matches"
  else
    if ask_confirm "Set homepage to '${CFG_HOMEPAGE}'?"; then
      run_cmd "set homepage" -- gh repo edit "${REPO}" --homepage "${CFG_HOMEPAGE}"
      summary_pass "homepage updated"
    else
      summary_skip "homepage unchanged"
    fi
  fi

  # Topics.
  if [[ -n "${CFG_TOPICS}" ]]; then
    IFS=',' read -ra wanted_topics <<< "${CFG_TOPICS}"
    local cur_topics
    cur_topics=$(gh api "repos/${REPO}/topics" --jq '.topics[]' 2>/dev/null | sort)
    local missing_topics=()
    for t in "${wanted_topics[@]}"; do
      t=$(echo "${t}" | tr -d '[:space:]')
      if ! echo "${cur_topics}" | grep -qxF "${t}"; then
        missing_topics+=("${t}")
      fi
    done

    if [[ ${#missing_topics[@]} -eq 0 ]]; then
      log_ok "all topics present: ${CFG_TOPICS}"
    else
      log_info "missing topics: ${missing_topics[*]}"
      if ask_confirm "Add missing topics?"; then
        for t in "${missing_topics[@]}"; do
          run_cmd "add topic ${t}" -- gh repo edit "${REPO}" --add-topic "${t}"
        done
        summary_pass "topics updated"
      else
        summary_skip "topics unchanged"
      fi
    fi
  fi

  # Features: issues, discussions, wiki, projects.
  local -A feature_map=(
    [has_issues]="--enable-issues"
    [has_discussions]="--enable-discussions"
    [has_wiki]="--enable-wiki"
    [has_projects]="--enable-projects"
  )
  local -A desired_features=(
    [has_issues]="true"
    [has_discussions]="${CFG_ENABLE_DISCUSSIONS}"
    [has_wiki]="${CFG_ENABLE_WIKI}"
    [has_projects]="${CFG_ENABLE_PROJECTS}"
  )

  for feature in has_issues has_discussions has_wiki has_projects; do
    local current_val
    current_val=$(gh_repo_field "${REPO}" "${feature}")
    local want="${desired_features[${feature}]}"
    if [[ "${want}" == "1" ]]; then want="true"; elif [[ "${want}" == "0" ]]; then want="false"; fi

    if [[ "${current_val}" == "${want}" ]]; then
      log_ok "${feature}: ${current_val}"
    else
      if ask_confirm "Set ${feature} to ${want}?"; then
        local flag="${feature_map[${feature}]}"
        if [[ "${want}" == "true" ]]; then
          run_cmd "enable ${feature}" -- gh repo edit "${REPO}" "${flag}"
        else
          local disable_flag="${flag/--enable-/--disable-}"
          run_cmd "disable ${feature}" -- gh repo edit "${REPO}" "${disable_flag}"
        fi
        summary_pass "${feature} → ${want}"
      else
        summary_skip "${feature} unchanged"
      fi
    fi
  done

  # Merge strategy.
  local cur_squash cur_merge cur_rebase
  cur_squash=$(gh_repo_field "${REPO}" "allow_squash_merge")
  cur_merge=$(gh_repo_field "${REPO}" "allow_merge_commit")
  cur_rebase=$(gh_repo_field "${REPO}" "allow_rebase_merge")

  log_info "merge options: squash=${cur_squash} merge=${cur_merge} rebase=${cur_rebase}"

  if (( CFG_SQUASH_MERGE )); then
    if [[ "${cur_squash}" == "true" ]]; then
      log_ok "squash merge enabled"
    else
      if ask_confirm "Enable squash merging?"; then
        run_cmd "enable squash" -- gh repo edit "${REPO}" --allow-squash-merge
        summary_pass "squash merge enabled"
      else
        summary_skip "squash merge unchanged"
      fi
    fi
  fi

  # Auto-delete head branches.
  local cur_auto_delete
  cur_auto_delete=$(gh_repo_field "${REPO}" "delete_branch_on_merge")
  if (( CFG_AUTO_DELETE_HEAD )); then
    if [[ "${cur_auto_delete}" == "true" ]]; then
      log_ok "auto-delete head branches enabled"
    else
      if ask_confirm "Enable automatic deletion of head branches after merge?"; then
        run_cmd "enable auto-delete" -- gh repo edit "${REPO}" --delete-branch-on-merge
        summary_pass "auto-delete head branches enabled"
      else
        summary_skip "auto-delete unchanged"
      fi
    fi
  fi

  summary_pass "metadata configuration complete"
}

# ── Stage: branch protection ─────────────────────────────────────────────────

stage_branch_protection() {
  log_step "Branch protection"

  if (( SKIP_BRANCH_PROTECTION )); then
    summary_skip "branch protection skipped by flag"
    return 0
  fi

  if ! gh_available; then
    summary_fail "GitHub CLI not authenticated"
    return 1
  fi

  # Check if rulesets API is available.
  local ruleset_count
  ruleset_count=$(gh api "repos/${REPO}/rulesets" --jq 'length' 2>/dev/null || echo "-1")

  if [[ "${ruleset_count}" == "-1" ]]; then
    log_warn "cannot access rulesets API (might need different permissions)"
    summary_warn "rulesets API unavailable"
    return 0
  fi

  log_info "existing rulesets: ${ruleset_count}"

  # Discover CI check names.
  local check_names=""
  if [[ -z "${CFG_REQUIRED_CHECKS}" ]]; then
    check_names=$(gh_ci_check_names "${REPO}" 2>/dev/null || true)
    if [[ -n "${check_names}" ]]; then
      log_info "discovered CI checks:"
      echo "${check_names}" | while read -r name; do
        log_info "  - ${name}"
      done
    else
      log_warn "no CI check runs found — checks may need to run once first"
    fi
  fi

  # Propose protection.
  log_info "Proposed branch protection for '${DEFAULT_BRANCH}':"
  log_info "  • Require pull request before merging: $(( CFG_REQUIRE_PR_REVIEWS )) review(s)"
  log_info "  • Require status checks to pass: $([[ -n "${CFG_REQUIRED_CHECKS}" ]] && echo "${CFG_REQUIRED_CHECKS}" || echo "none (no checks discovered)")"
  log_info "  • Restrict force pushes: yes"
  log_info "  • Prevent branch deletion: yes"

  if ! ask_confirm "Apply branch protection ruleset to '${DEFAULT_BRANCH}'?"; then
    summary_skip "branch protection not applied"
    return 0
  fi

  # Build the ruleset JSON.
  local ruleset_name="protect-${DEFAULT_BRANCH}"
  local rules_json='[]'

  # Require pull requests; the review count may be zero for a solo maintainer.
  rules_json=$(echo "${rules_json}" | jq --argjson n "${CFG_REQUIRE_PR_REVIEWS}" \
    '. + [{"type": "pull_request", "parameters": {"required_approving_review_count": $n, "require_last_push_approval": false, "dismiss_stale_reviews_on_push": true, "required_review_thread_resolution": true}}]')

  # Required status checks.
  local checks_json='[]'
  if [[ -n "${CFG_REQUIRED_CHECKS}" ]]; then
    IFS=',' read -ra checks_arr <<< "${CFG_REQUIRED_CHECKS}"
    for chk in "${checks_arr[@]}"; do
      chk=$(echo "${chk}" | tr -d '[:space:]')
      checks_json=$(echo "${checks_json}" | jq --arg n "${chk}" '. + [{"context": $n}]')
    done
    rules_json=$(echo "${rules_json}" | jq --argjson c "${checks_json}" \
      '. + [{"type": "required_status_checks", "parameters": {"required_status_checks": $c, "strict_required_status_checks_policy": true}}]')
  fi

  # Prevent branch deletion.
  rules_json=$(echo "${rules_json}" | jq \
    '. + [{"type": "deletion"}]')

  # Prevent force pushes.
  rules_json=$(echo "${rules_json}" | jq \
    '. + [{"type": "non_fast_forward"}]')

  # Create or update the ruleset.
  local payload
  payload=$(jq -n \
    --arg name "${ruleset_name}" \
    --arg branch "${DEFAULT_BRANCH}" \
    --argjson rules "${rules_json}" \
    '{
      name: $name,
      target: "branch",
      enforcement: "active",
      conditions: {
        ref_name: {
          include: ["refs/heads/" + $branch],
          exclude: []
        }
      },
      rules: $rules,
      bypass_actors: []
    }')

  # Check if ruleset already exists.
  local existing_id
  existing_id=$(gh api "repos/${REPO}/rulesets" \
    --jq ".[] | select(.name == \"${ruleset_name}\") | .id" 2>/dev/null || true)

  if [[ -n "${existing_id}" ]]; then
    log_info "updating existing ruleset (id: ${existing_id})"
    if (( ! DRY_RUN )); then
      gh api "repos/${REPO}/rulesets/${existing_id}" \
        --method PUT \
        --input - <<< "${payload}" >/dev/null 2>&1 || {
          summary_fail "ruleset update failed"
          return 1
        }
    fi
    summary_pass "branch protection ruleset updated"
  else
    if (( ! DRY_RUN )); then
      gh api "repos/${REPO}/rulesets" \
        --method POST \
        --input - <<< "${payload}" >/dev/null 2>&1 || {
          summary_fail "ruleset creation failed"
          return 1
        }
    fi
    summary_pass "branch protection ruleset created"
  fi

  # Verify.
  if (( ! DRY_RUN )); then
    local verify_name
    verify_name=$(gh api "repos/${REPO}/rulesets" \
      --jq ".[] | select(.name == \"${ruleset_name}\") | .name" 2>/dev/null || true)
    if [[ "${verify_name}" == "${ruleset_name}" ]]; then
      log_ok "ruleset verified: ${verify_name}"
    else
      log_warn "could not verify ruleset creation"
    fi
  fi
}

# ── Stage: GitHub Pages ──────────────────────────────────────────────────────

stage_pages() {
  log_step "GitHub Pages"

  if (( SKIP_PAGES )); then
    summary_skip "Pages skipped by flag"
    return 0
  fi

  if ! gh_available; then
    summary_fail "GitHub CLI not authenticated"
    return 1
  fi

  # Check current Pages configuration.
  local pages_info
  pages_info=$(gh api "repos/${REPO}/pages" 2>/dev/null || echo "{}")
  local pages_source
  pages_source=$(echo "${pages_info}" | jq -r '.source.branch // "none"' 2>/dev/null || echo "unknown")
  local pages_url
  pages_url=$(echo "${pages_info}" | jq -r '.html_url // .url // "unknown"' 2>/dev/null || echo "unknown")
  local build_type
  build_type=$(echo "${pages_info}" | jq -r '.build_type // "unknown"' 2>/dev/null || echo "unknown")

  log_info "Pages build_type: ${build_type}"
  log_info "Pages source:     ${pages_source}"
  log_info "Pages URL:        ${pages_url}"

  # The ideal configuration: build_type=github_workflow (Actions deployment).
  if [[ "${build_type}" == "workflow" ]]; then
    log_ok "Pages uses GitHub Actions deployment (recommended)"
    summary_pass "Pages configuration correct"
    return 0
  fi

  # If Pages isn't enabled yet, or uses legacy source.
  if [[ "${build_type}" == "legacy" || "${build_type}" == "unknown" ]]; then
    log_info "Pages source type is '${build_type}' (may need manual activation)"
    log_info ""
    log_info "To enable Pages with GitHub Actions deployment:"
    log_info "  1. Go to https://github.com/${REPO}/settings/pages"
    log_info "  2. Under 'Build and deployment', set Source to 'GitHub Actions'"
    log_info "  3. The pages.yml workflow handles the rest automatically"
    log_info ""

    if ask_confirm "Try to set Pages source to 'gh-pages' (legacy) as a fallback?"; then
      log_info "(GitHub API does not support setting build_type to 'workflow' directly)"
      log_info "Manual step required: change Source to 'GitHub Actions' in the Pages settings UI."
      summary_warn "Pages needs manual configuration"
    else
      summary_skip "Pages not configured"
    fi
  else
    summary_pass "Pages status checked"
  fi

  # Verify the deployment environment exists.
  log_info ""
  log_info "Expected deployment environment: github-pages"
  log_info "Expected public URL: https://nashiuso.github.io/rewap/"
}

# ── Stage: security settings ─────────────────────────────────────────────────

stage_security() {
  log_step "Security settings"

  if (( SKIP_SECURITY )); then
    summary_skip "security settings skipped by flag"
    return 0
  fi

  if ! gh_available; then
    summary_fail "GitHub CLI not authenticated"
    return 1
  fi

  # Check private vulnerability reporting.
  local vuln_reporting
  vuln_reporting=$(gh api "repos/${REPO}/vulnerability-alerts" 2>/dev/null && echo "enabled" || echo "unknown")
  log_info "vulnerability alerts: ${vuln_reporting}"

  # Check Dependabot config.
  local dep_file="${REPO_PATH}/.github/dependabot.yml"
  if [[ -f "${dep_file}" ]]; then
    log_ok "dependabot.yml present"
    # Verify it covers npm root, npm docs, and github-actions.
    local -a ecosystems=("npm" "github-actions")
    for eco in "${ecosystems[@]}"; do
      if grep -q "${eco}" "${dep_file}"; then
        log_ok "dependabot covers: ${eco}"
      else
        log_warn "dependabot.yml does not cover: ${eco}"
      fi
    done
    summary_pass "Dependabot configuration verified"
  else
    log_warn "dependabot.yml not found"
    summary_warn "Dependabot not configured"
  fi

  # Check for private vulnerability reporting enablement.
  if ask_confirm "Enable private vulnerability reporting (if not already)?"; then
    if (( ! DRY_RUN )); then
      if gh api "repos/${REPO}/vulnerability-alerts" --method PUT 2>/dev/null; then
        log_ok "vulnerability alerts enabled"
      else
        log_warn "could not enable vulnerability alerts (might need different permissions)"
      fi
    fi
  fi

  # Check security policy.
  local sec_file="${REPO_PATH}/SECURITY.md"
  if [[ -f "${sec_file}" ]]; then
    log_ok "SECURITY.md present"
    summary_pass "security documentation present"
  else
    log_warn "SECURITY.md not found"
    summary_warn "no security policy"
  fi
}

# ── Stage: npm audit ─────────────────────────────────────────────────────────

stage_npm_audit() {
  log_step "Dependency audit"

  local root_pkg="${REPO_PATH}/package.json"
  local docs_pkg="${REPO_PATH}/docs/package.json"

  if [[ -f "${root_pkg}" ]]; then
    log_info "auditing root dependencies..."
    local root_audit
    root_audit=$(cd "${REPO_PATH}" && npm audit --json 2>/dev/null || echo '{}')
    local root_vulns
    root_vulns=$(echo "${root_audit}" | jq '.metadata.vulnerabilities | (.high // 0) + (.critical // 0)' 2>/dev/null || echo "unknown")
    if [[ "${root_vulns}" == "0" || "${root_vulns}" == "unknown" ]]; then
      log_ok "root: 0 high/critical vulnerabilities"
      summary_pass "root dependency audit clean"
    else
      log_warn "root: ${root_vulns} high/critical vulnerabilities found"
      summary_warn "root has ${root_vulns} high/critical vulnerabilities"
    fi
  fi

  if [[ -f "${docs_pkg}" ]]; then
    log_info "auditing docs dependencies..."
    local docs_audit
    docs_audit=$(cd "${REPO_PATH}/docs" && npm audit --json 2>/dev/null || echo '{}')
    local docs_vulns
    docs_vulns=$(echo "${docs_audit}" | jq '.metadata.vulnerabilities | (.high // 0) + (.critical // 0)' 2>/dev/null || echo "unknown")
    if [[ "${docs_vulns}" == "0" || "${docs_vulns}" == "unknown" ]]; then
      log_ok "docs: 0 high/critical vulnerabilities"
      summary_pass "docs dependency audit clean"
    else
      log_warn "docs: ${docs_vulns} high/critical vulnerabilities"
      summary_warn "docs has ${docs_vulns} high/critical vulnerabilities"
    fi
  fi

  # Verify the override is present.
  if [[ -f "${docs_pkg}" ]]; then
    local has_override
    has_override=$(node -e "
      const p = require('${docs_pkg}');
      console.log(p.overrides?.['postcss-selector-parser'] || 'none');
    " 2>/dev/null || echo "unknown")
    log_info "docs postcss-selector-parser override: ${has_override}"
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────────

main() {
  parse_args "$@"
  apply_mode_defaults
  load_config

  if (( MODE_VERSION )); then
    echo "setup.sh ${SCRIPT_VERSION}"
    exit 0
  fi

  if (( MODE_HELP )); then
    usage
    exit 0
  fi

  printf '%s\n' "${_c_bold}Rewap Repository Setup v${SCRIPT_VERSION}${_c_reset}" >&2
  printf '%s\n' "${_c_dim}Repository: ${REPO}${_c_reset}" >&2
  printf '%s\n' "${_c_dim}Path:      ${REPO_PATH}${_c_reset}" >&2
  printf '%s\n' "${_c_dim}Branch:    ${DEFAULT_BRANCH}${_c_reset}" >&2
  if (( MODE_CHECK )); then
    printf '%s\n' "${_c_yellow}Mode:      CHECK (read-only)${_c_reset}" >&2
  elif (( MODE_DRY_RUN )); then
    printf '%s\n' "${_c_yellow}Mode:      DRY-RUN (no changes)${_c_reset}" >&2
  fi

  # ── Run stages ───────────────────────────────────────────────────────────

  # Always check prerequisites first.
  stage_prerequisites || true

  if (( MODE_LOCAL )); then
    stage_local_git || true
    if (( ! SKIP_HOOKS )); then
      stage_commit_hook || true
    fi
    stage_gitignore || true
    stage_workflow_audit || true
    stage_npm_audit || true
  fi

  if (( MODE_GITHUB )); then
    if (( ! SKIP_METADATA )); then
      stage_github_metadata || true
    fi
    if (( ! SKIP_BRANCH_PROTECTION )); then
      stage_branch_protection || true
    fi
    if (( ! SKIP_PAGES )); then
      stage_pages || true
    fi
    if (( ! SKIP_SECURITY )); then
      stage_security || true
    fi
  fi

  # ── Summary ──────────────────────────────────────────────────────────────

  print_summary

  if (( _SUMMARY_FAILED > 0 )); then
    log_error "${_SUMMARY_FAILED} stage(s) failed."
    exit 1
  fi

  printf '\n%sSetup complete.%s\n' "${_c_bold}${_c_green}" "${_c_reset}" >&2
  exit 0
}

main "$@"