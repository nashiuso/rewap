#!/usr/bin/env bash
# Sets non-destructive repository metadata on github.com/nashiuso/rewap using
# the GitHub CLI. Does NOT touch branch protection, Pages source, or secrets —
# see docs/maintainers/github.md section 3 for those (deliberately manual).
#
# Requires: `gh` installed and `gh auth login` already run with an account
# that has admin access to the repository. This script changes real settings
# on the real repository — read it before running it.
set -euo pipefail

REPO="nashiuso/rewap"

if ! command -v gh >/dev/null 2>&1; then
  echo "error: GitHub CLI ('gh') is not installed. See https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "error: not logged in. Run 'gh auth login' first." >&2
  exit 1
fi

echo "This will update settings on github.com/${REPO}. Continue? [y/N]"
read -r confirm
if [[ "${confirm}" != "y" && "${confirm}" != "Y" ]]; then
  echo "Aborted, nothing changed."
  exit 0
fi

echo "Setting description..."
gh repo edit "${REPO}" \
  --description "Draggable, swappable, reorderable React layouts. Framework-neutral core, small public API."

echo "Setting homepage..."
gh repo edit "${REPO}" --homepage "https://nashiuso.github.io/rewap/"

echo "Setting topics..."
gh repo edit "${REPO}" \
  --add-topic react \
  --add-topic drag-and-drop \
  --add-topic reorder \
  --add-topic layout \
  --add-topic typescript \
  --add-topic accessibility

echo "Enabling Issues and Discussions..."
gh repo edit "${REPO}" --enable-issues --enable-discussions

cat <<'EOF'

Done. Not touched by this script, do these by hand (docs/maintainers/github.md
section 3 has the exact steps):
  - Branch protection on main
  - Pages source (Settings -> Pages -> Build and deployment -> Source -> GitHub Actions)
  - NPM_TOKEN secret, only if/when you intend to use release.yml
EOF
