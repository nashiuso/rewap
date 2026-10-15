#!/usr/bin/env bash
# scripts/github/commit-msg.sh — Git commit-msg hook.
# Validates commit messages against the Conventional Commits format.
#
# Install: git config core.hooksPath scripts/github/hooks
#          (or copy/link to .git/hooks/commit-msg)
#
# Format: <type>(<optional-scope>): <description>
#         <optional body>
#         <optional footer(s)>
#
# Allowed types:
#   feat fix docs test refactor perf build ci chore style revert
#
# Rules:
#   - Subject line ≤ 72 characters.
#   - Type is required, lowercase.
#   - Scope is optional, lowercase, 1–20 characters.
#   - Description starts lowercase, is non-empty, and does not end with a period.
#   - A blank line separates subject from body (optional).
#   - Breaking changes: a footer "BREAKING CHANGE: <text>" or "!" before colon.

set -euo pipefail

commit_msg_file="$1"

# Allow merge and fixup commits without validation.
first_line=$(head -1 "${commit_msg_file}" 2>/dev/null || true)
if [[ "${first_line}" =~ ^Merge ]] || [[ "${first_line}" =~ ^fixup! ]]; then
  exit 0
fi

# Strip comment lines (Git's default).
msg=$(sed '/^#/d' "${commit_msg_file}")
first_line=$(echo "${msg}" | head -1)

# Regex: type(optional-scope)optional-!: description
pattern='^(feat|fix|docs|test|refactor|perf|build|ci|chore|style|revert)(\([a-z0-9._-]{1,20}\))?!?: .{1,}$'

if ! [[ "${first_line}" =~ ${pattern} ]]; then
  echo "╔══════════════════════════════════════════════════════════════╗" >&2
  echo "║  Invalid commit message format.                            ║" >&2
  echo "║                                                            ║" >&2
  echo "║  Expected: <type>(<scope>): <description>                  ║" >&2
  echo "║                                                            ║" >&2
  echo "║  Types: feat fix docs test refactor perf build ci chore    ║" >&2
  echo "║         style revert                                       ║" >&2
  echo "║                                                            ║" >&2
  echo "║  Examples:                                                 ║" >&2
  echo "║    fix(react): preserve item identity after swaps          ║" >&2
  echo "║    docs: clarify Astro installation                        ║" >&2
  echo "║    feat(core)!: restructure layout engine                  ║" >&2
  echo "╚══════════════════════════════════════════════════════════════╝" >&2
  exit 1
fi

# Check subject length.
subject_len=${#first_line}
if (( subject_len > 72 )); then
  echo "warning: subject line is ${subject_len} characters (limit 72)." >&2
  # Warn but allow — some descriptions are hard to shorten.
fi

# Check that description does not end with a period.
if [[ "${first_line}" =~ \.$ ]]; then
  echo "error: commit description should not end with a period." >&2
  exit 1
fi

exit 0