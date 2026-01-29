#!/bin/bash
# Voyc Release Script
#
# Performs a complete release: bump version, update changelog, commit, tag, and optionally build.
#
# Usage:
#   ./scripts/release.sh <major|minor|patch> [options]
#
# Options:
#   --dry-run     Show what would happen without making changes
#   --no-build    Skip building packages
#   --no-tag      Skip creating git tag
#   --push        Push to remote after release
#
# Examples:
#   ./scripts/release.sh patch                    # Patch release (1.0.0 -> 1.0.1)
#   ./scripts/release.sh minor --push             # Minor release and push
#   ./scripts/release.sh major --dry-run          # Preview major release

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_dry() { echo -e "${BLUE}[DRY-RUN]${NC} $1"; }
log_step() { echo -e "${GREEN}==>${NC} $1"; }

# Default options
DRY_RUN=false
DO_BUILD=true
DO_TAG=true
DO_PUSH=false
BUMP_TYPE=""

usage() {
    cat << EOF
Voyc Release Script

Usage: $0 <major|minor|patch> [options]

Commands:
  major    Bump major version (x.0.0) - breaking changes
  minor    Bump minor version (0.x.0) - new features
  patch    Bump patch version (0.0.x) - bug fixes

Options:
  --dry-run    Preview changes without modifying anything
  --no-build   Skip building release packages
  --no-tag     Skip creating git tag
  --push       Push commits and tags to remote

Examples:
  $0 patch                  # Bug fix release
  $0 minor --push           # Feature release and push
  $0 major --dry-run        # Preview breaking change release
EOF
    exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        major|minor|patch)
            BUMP_TYPE="$1"
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-build)
            DO_BUILD=false
            shift
            ;;
        --no-tag)
            DO_TAG=false
            shift
            ;;
        --push)
            DO_PUSH=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            log_error "Unknown argument: $1"
            usage
            ;;
    esac
done

if [[ -z "$BUMP_TYPE" ]]; then
    usage
fi

# Preflight checks
log_step "Running preflight checks..."

# Check for uncommitted changes
if [[ -n "$(git status --porcelain)" ]]; then
    log_error "Working directory has uncommitted changes. Please commit or stash first."
    git status --short
    exit 1
fi

# Check we're on main branch (warning only)
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" ]]; then
    log_warn "Not on main/master branch (current: $CURRENT_BRANCH)"
    read -p "Continue anyway? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Get current version
CURRENT_VERSION=$(cat "$PROJECT_ROOT/VERSION" | tr -d '[:space:]')
log_info "Current version: $CURRENT_VERSION"

# Calculate new version
IFS='.' read -r MAJOR MINOR PATCH <<< "${CURRENT_VERSION%%-*}"
case "$BUMP_TYPE" in
    major) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
    minor) NEW_VERSION="$MAJOR.$((MINOR + 1)).0" ;;
    patch) NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))" ;;
esac

log_info "New version: $NEW_VERSION"
echo ""

if $DRY_RUN; then
    log_dry "=== DRY RUN MODE - No changes will be made ==="
    echo ""
fi

# Step 1: Bump version
log_step "Step 1/5: Bumping version..."
if $DRY_RUN; then
    "$SCRIPT_DIR/bump-version.sh" "$BUMP_TYPE" --dry-run
else
    "$SCRIPT_DIR/bump-version.sh" "$BUMP_TYPE"
fi
echo ""

# Step 2: Generate changelog
log_step "Step 2/5: Updating changelog..."
CHANGELOG_FILE="$PROJECT_ROOT/CHANGELOG.md"

if $DRY_RUN; then
    log_dry "Would prepend to CHANGELOG.md:"
    echo "---"
    "$SCRIPT_DIR/generate-changelog.sh" --version "$NEW_VERSION"
    echo "---"
else
    # Generate new changelog entry
    CHANGELOG_ENTRY=$("$SCRIPT_DIR/generate-changelog.sh" --version "$NEW_VERSION")

    if [[ -f "$CHANGELOG_FILE" ]]; then
        # Prepend to existing changelog (after header)
        TEMP_FILE=$(mktemp)
        {
            head -n 12 "$CHANGELOG_FILE"
            echo ""
            echo "$CHANGELOG_ENTRY"
            tail -n +13 "$CHANGELOG_FILE"
        } > "$TEMP_FILE"
        mv "$TEMP_FILE" "$CHANGELOG_FILE"
    else
        # Create new changelog
        cat > "$CHANGELOG_FILE" << EOF
# Changelog

All notable changes to Voyc will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

$CHANGELOG_ENTRY
EOF
    fi
    log_info "Updated CHANGELOG.md"
fi
echo ""

# Step 3: Commit changes
log_step "Step 3/5: Committing changes..."
if $DRY_RUN; then
    log_dry "Would commit with message: chore(release): v$NEW_VERSION"
else
    git add VERSION package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml CHANGELOG.md
    git commit -m "chore(release): v$NEW_VERSION"
    log_info "Created release commit"
fi
echo ""

# Step 4: Create tag
if $DO_TAG; then
    log_step "Step 4/5: Creating git tag..."
    if $DRY_RUN; then
        log_dry "Would create tag: v$NEW_VERSION"
    else
        git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"
        log_info "Created tag v$NEW_VERSION"
    fi
else
    log_step "Step 4/5: Skipping tag (--no-tag)"
fi
echo ""

# Step 5: Build
if $DO_BUILD; then
    log_step "Step 5/5: Building release packages..."
    if $DRY_RUN; then
        log_dry "Would run: ./scripts/build-release.sh"
    else
        "$SCRIPT_DIR/build-release.sh"
    fi
else
    log_step "Step 5/5: Skipping build (--no-build)"
fi
echo ""

# Optional: Push
if $DO_PUSH; then
    log_step "Pushing to remote..."
    if $DRY_RUN; then
        log_dry "Would run: git push && git push --tags"
    else
        git push
        git push --tags
        log_info "Pushed to remote"
    fi
fi

# Summary
echo ""
echo "========================================"
if $DRY_RUN; then
    log_info "Dry run complete. No changes were made."
else
    log_info "Release v$NEW_VERSION complete!"
    echo ""
    echo "Summary:"
    echo "  - Version: $CURRENT_VERSION -> $NEW_VERSION"
    echo "  - Changelog: Updated"
    echo "  - Commit: $(git rev-parse --short HEAD)"
    if $DO_TAG; then
        echo "  - Tag: v$NEW_VERSION"
    fi
    if $DO_BUILD; then
        echo "  - Build: Complete"
    fi
    echo ""
    if ! $DO_PUSH; then
        log_info "Next steps:"
        echo "  - Review: git log -1 && git show v$NEW_VERSION"
        echo "  - Push: git push && git push --tags"
        echo "  - GitHub: Create release at https://github.com/kryptobaseddev/voyc/releases"
    fi
fi
echo "========================================"
