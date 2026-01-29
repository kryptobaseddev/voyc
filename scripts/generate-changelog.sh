#!/bin/bash
# Voyc Changelog Generator
#
# Generates changelog entries from conventional commits since the last tag.
# Output can be appended to CHANGELOG.md manually or via release.sh
#
# Usage:
#   ./scripts/generate-changelog.sh                    # Generate for next release
#   ./scripts/generate-changelog.sh --since v1.0.0    # Since specific tag
#   ./scripts/generate-changelog.sh --full            # Full history by tag

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SINCE_TAG=""
FULL_HISTORY=false
VERSION=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --since)
            SINCE_TAG="$2"
            shift 2
            ;;
        --full)
            FULL_HISTORY=true
            shift
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# Get version from VERSION file if not specified
if [[ -z "$VERSION" ]]; then
    if [[ -f "$PROJECT_ROOT/VERSION" ]]; then
        VERSION=$(cat "$PROJECT_ROOT/VERSION" | tr -d '[:space:]')
    else
        VERSION="Unreleased"
    fi
fi

# Get the commit range
if [[ -n "$SINCE_TAG" ]]; then
    RANGE="$SINCE_TAG..HEAD"
elif git describe --tags --abbrev=0 2>/dev/null; then
    LAST_TAG=$(git describe --tags --abbrev=0)
    RANGE="$LAST_TAG..HEAD"
else
    # No tags, get all commits
    RANGE=""
fi

# Function to extract commits by type
get_commits_by_type() {
    local type="$1"
    local range="$2"

    if [[ -n "$range" ]]; then
        git log "$range" --pretty=format:"%s|%h" 2>/dev/null | grep -E "^${type}(\(.+\))?:" || true
    else
        git log --pretty=format:"%s|%h" 2>/dev/null | grep -E "^${type}(\(.+\))?:" || true
    fi
}

# Function to format commit for changelog
format_commit() {
    local line="$1"
    local message="${line%|*}"
    local hash="${line#*|}"

    # Remove type prefix and extract scope
    local content=$(echo "$message" | sed -E 's/^[a-z]+(\([^)]+\))?:\s*//')
    local scope=$(echo "$message" | sed -nE 's/^[a-z]+\(([^)]+)\):.*/\1/p')

    # Capitalize first letter
    content="$(echo "${content:0:1}" | tr '[:lower:]' '[:upper:]')${content:1}"

    if [[ -n "$scope" ]]; then
        echo "- **$scope**: $content (\`$hash\`)"
    else
        echo "- $content (\`$hash\`)"
    fi
}

# Generate changelog section
generate_section() {
    local title="$1"
    local type="$2"
    local range="$3"

    local commits=$(get_commits_by_type "$type" "$range")

    if [[ -n "$commits" ]]; then
        echo ""
        echo "### $title"
        echo ""
        while IFS= read -r line; do
            if [[ -n "$line" ]]; then
                format_commit "$line"
            fi
        done <<< "$commits"
    fi
}

# Header
echo "## [$VERSION] - $(date +%Y-%m-%d)"

# Breaking changes (feat! or fix! or BREAKING CHANGE in body)
BREAKING=$(git log ${RANGE:-} --pretty=format:"%s|%h" 2>/dev/null | grep -E "^[a-z]+(\(.+\))?!:" || true)
if [[ -n "$BREAKING" ]]; then
    echo ""
    echo "### BREAKING CHANGES"
    echo ""
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            format_commit "$line"
        fi
    done <<< "$BREAKING"
fi

# Features
generate_section "Added" "feat" "$RANGE"

# Bug fixes
generate_section "Fixed" "fix" "$RANGE"

# Performance
generate_section "Performance" "perf" "$RANGE"

# Documentation
generate_section "Documentation" "docs" "$RANGE"

# Refactoring (usually internal, but good to track)
generate_section "Changed" "refactor" "$RANGE"

# Build/CI changes
BUILD_COMMITS=$(get_commits_by_type "build" "$RANGE")
CI_COMMITS=$(get_commits_by_type "ci" "$RANGE")
if [[ -n "$BUILD_COMMITS" || -n "$CI_COMMITS" ]]; then
    echo ""
    echo "### Build & CI"
    echo ""
    if [[ -n "$BUILD_COMMITS" ]]; then
        while IFS= read -r line; do
            [[ -n "$line" ]] && format_commit "$line"
        done <<< "$BUILD_COMMITS"
    fi
    if [[ -n "$CI_COMMITS" ]]; then
        while IFS= read -r line; do
            [[ -n "$line" ]] && format_commit "$line"
        done <<< "$CI_COMMITS"
    fi
fi

echo ""
