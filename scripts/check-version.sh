#!/bin/bash

# check-version.sh — fail-closed verification of the Diagramahub app version.
#
# Verifies that every file carrying the app version matches the expected
# <VERSION>. A release must not be merged while this script reports FAIL.
#
# Usage:
#   bash scripts/check-version.sh 0.6.2
#
# This script is the single source of truth for "where the version lives".
# Lockfiles (backend/poetry.lock, frontend/pnpm-lock.yaml) and historical
# changelog comments (e.g. frontend/src/utils/pdfGenerator.ts) are
# intentionally NOT checked. If a new file starts carrying the version,
# add it here AND to the release checklist in VERSIONING.md.

set -u

V="${1:-}"
fail=0
total=0

if ! printf '%s' "$V" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "Usage: bash scripts/check-version.sh <MAJOR.MINOR.PATCH>" >&2
    exit 2
fi

# Escaped form of the version for safe use in grep -E patterns.
VE=$(printf '%s' "$V" | sed 's/\./\\./g')

check() {
    # check <label> <grep-E pattern> <file>
    local label="$1" pattern="$2" file="$3"
    total=$((total + 1))
    if grep -qE "$pattern" "$file"; then
        printf 'PASS  %s\n' "$label"
    else
        printf 'FAIL  %s\n' "$label"
        fail=1
    fi
}

check_exists() {
    # check_exists <label> <path>
    local label="$1" path="$2"
    total=$((total + 1))
    if [ -f "$path" ]; then
        printf 'PASS  %s\n' "$label"
    else
        printf 'FAIL  %s\n' "$label"
        fail=1
    fi
}

cd "$(dirname "$0")/.."

echo "Checking version $V across the repository..."
echo

# Code & runtime
check 'frontend/package.json'       '"version": "'"$VE"'",'              frontend/package.json
check 'backend/pyproject.toml'      '^version = "'"$VE"'"$'              backend/pyproject.toml
check 'frontend/.env.template'      '^VITE_APP_VERSION='"$VE"'$'         frontend/.env.template
check 'backend/app/core/config.py'  '^    VERSION: str = "'"$VE"'"$'     backend/app/core/config.py

# Documentation
check 'AGENTS.md (header)'          '^- \*\*Current version\*\*: '"$VE"'$'   AGENTS.md
check 'AGENTS.md (Versioning section)' 'Current: \*\*'"$VE"'\*\*\.$'         AGENTS.md
check 'AGENTS.md (env example)'     '^VITE_APP_VERSION='"$VE"'$'         AGENTS.md
check 'VERSIONING.md'               '^Versión actual: \*\*'"$VE"'\*\*\.$' VERSIONING.md

# Release artifacts
check 'CHANGELOG.md'                '^## \['"$VE"'\] - [0-9]{4}-[0-9]{2}-[0-9]{2}$' CHANGELOG.md
check_exists "docs/es/release-notes/$V.md" "docs/es/release-notes/$V.md"
check_exists "docs/en/release-notes/$V.md" "docs/en/release-notes/$V.md"
check 'docs/es/release-notes/index.md' '\['"$VE"'\]\('"$VE"'\.md\)' docs/es/release-notes/index.md
check 'docs/en/release-notes/index.md' '\['"$VE"'\]\('"$VE"'\.md\)' docs/en/release-notes/index.md
check 'mkdocs.yml (es nav)'         '^[[:space:]]*- '"$VE"': es/release-notes/'"$VE"'\.md$' mkdocs.yml
check 'mkdocs.yml (en nav)'         '^[[:space:]]*- '"$VE"': en/release-notes/'"$VE"'\.md$' mkdocs.yml

echo
if [ "$fail" -eq 0 ]; then
    echo "OK: version $V is consistent across all $total checked files."
    exit 0
else
    echo "FAIL: version $V is not applied in every file listed above. Update them and re-run."
    exit 1
fi
