#!/bin/bash
# Voyc Version Bump Script
#
# Bumps version across all project files (VERSION, package.json, tauri.conf.json, Cargo.toml)
#
# Usage:
#   ./scripts/bump-version.sh <major|minor|patch> [--dry-run]
#   ./scripts/bump-version.sh set <version> [--dry-run]
#
# Examples:
#   ./scripts/bump-version.sh patch          # 1.0.0 -> 1.0.1
#   ./scripts/bump-version.sh minor          # 1.0.0 -> 1.1.0
#   ./scripts/bump-version.sh major          # 1.0.0 -> 2.0.0
#   ./scripts/bump-version.sh set 2.0.0-rc.1 # Set explicit version

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_dry() { echo -e "${BLUE}[DRY-RUN]${NC} $1"; }

# Files that contain version
VERSION_FILE="$PROJECT_ROOT/VERSION"
PACKAGE_JSON="$PROJECT_ROOT/package.json"
TAURI_CONF="$PROJECT_ROOT/src-tauri/tauri.conf.json"
CARGO_TOML="$PROJECT_ROOT/src-tauri/Cargo.toml"

DRY_RUN=false
BUMP_TYPE=""
NEW_VERSION=""

usage() {
    echo "Usage: $0 <major|minor|patch|set> [version] [--dry-run]"
    echo ""
    echo "Commands:"
    echo "  major      Bump major version (x.0.0)"
    echo "  minor      Bump minor version (0.x.0)"
    echo "  patch      Bump patch version (0.0.x)"
    echo "  set <ver>  Set explicit version"
    echo ""
    echo "Options:"
    echo "  --dry-run  Show what would change without modifying files"
    exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        major|minor|patch)
            BUMP_TYPE="$1"
            shift
            ;;
        set)
            BUMP_TYPE="set"
            shift
            if [[ $# -gt 0 && ! "$1" =~ ^-- ]]; then
                NEW_VERSION="$1"
                shift
            else
                log_error "Missing version argument for 'set'"
                usage
            fi
            ;;
        --dry-run)
            DRY_RUN=true
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

# Get current version from VERSION file
if [[ ! -f "$VERSION_FILE" ]]; then
    log_error "VERSION file not found at $VERSION_FILE"
    exit 1
fi

CURRENT_VERSION=$(cat "$VERSION_FILE" | tr -d '[:space:]')

# Validate current version format (semver)
if ! [[ "$CURRENT_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
    log_error "Invalid current version format: $CURRENT_VERSION"
    exit 1
fi

# Extract version components
IFS='.' read -r MAJOR MINOR PATCH <<< "${CURRENT_VERSION%%-*}"
PRERELEASE="${CURRENT_VERSION#*-}"
if [[ "$PRERELEASE" == "$CURRENT_VERSION" ]]; then
    PRERELEASE=""
fi

# Calculate new version
case "$BUMP_TYPE" in
    major)
        NEW_VERSION="$((MAJOR + 1)).0.0"
        ;;
    minor)
        NEW_VERSION="$MAJOR.$((MINOR + 1)).0"
        ;;
    patch)
        NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
        ;;
    set)
        # Already set from args
        if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
            log_error "Invalid version format: $NEW_VERSION (expected semver)"
            exit 1
        fi
        ;;
esac

echo ""
log_info "Version bump: $CURRENT_VERSION -> $NEW_VERSION"
echo ""

# Function to update a file
update_file() {
    local file="$1"
    local pattern="$2"
    local replacement="$3"
    local description="$4"

    if [[ ! -f "$file" ]]; then
        log_warn "File not found: $file"
        return
    fi

    if $DRY_RUN; then
        log_dry "Would update $description"
        log_dry "  File: $file"
        log_dry "  Pattern: $pattern"
        log_dry "  Replacement: $replacement"
    else
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "$pattern" "$file"
        else
            sed -i "$pattern" "$file"
        fi
        log_info "Updated $description"
    fi
}

# Update VERSION file
if $DRY_RUN; then
    log_dry "Would update VERSION file to: $NEW_VERSION"
else
    echo "$NEW_VERSION" > "$VERSION_FILE"
    log_info "Updated VERSION file"
fi

# Update package.json
update_file "$PACKAGE_JSON" \
    "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" \
    "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" \
    "package.json"

# Update tauri.conf.json
update_file "$TAURI_CONF" \
    "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" \
    "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" \
    "tauri.conf.json"

# Update Cargo.toml (version line near top)
update_file "$CARGO_TOML" \
    "s/^version = \"$CURRENT_VERSION\"/version = \"$NEW_VERSION\"/" \
    "s/^version = \"$CURRENT_VERSION\"/version = \"$NEW_VERSION\"/" \
    "Cargo.toml"

echo ""
if $DRY_RUN; then
    log_info "Dry run complete. No files were modified."
else
    log_info "Version bump complete!"
    echo ""
    log_info "Files updated:"
    echo "  - VERSION"
    echo "  - package.json"
    echo "  - src-tauri/tauri.conf.json"
    echo "  - src-tauri/Cargo.toml"
    echo ""
    log_info "Next steps:"
    echo "  1. Review changes: git diff"
    echo "  2. Run release: ./scripts/release.sh"
fi
