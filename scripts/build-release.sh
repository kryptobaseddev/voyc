#!/bin/bash
# Voyc Release Build Script
#
# This script builds Voyc for production with properly embedded frontend assets.
#
# Requirements solved:
# 1. Uses clean environment to avoid shell hook conflicts (gettext, etc.)
# 2. Sets RUST_MIN_STACK to prevent LLVM SIGSEGV during LTO compilation
# 3. Uses 'tauri build' instead of 'cargo build' for proper asset embedding
#
# Usage:
#   ./scripts/build-release.sh           # Build all targets (deb, rpm, appimage)
#   ./scripts/build-release.sh --deb     # Build only .deb package
#   ./scripts/build-release.sh --rpm     # Build only .rpm package
#   ./scripts/build-release.sh --binary  # Build only the binary (no bundling)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse arguments
BUNDLE_TARGET=""
case "${1:-}" in
    --deb)
        BUNDLE_TARGET="--bundles deb"
        ;;
    --rpm)
        BUNDLE_TARGET="--bundles rpm"
        ;;
    --appimage)
        BUNDLE_TARGET="--bundles appimage"
        ;;
    --binary)
        BUNDLE_TARGET="--no-bundle"
        ;;
    *)
        BUNDLE_TARGET=""  # Build all
        ;;
esac

log_info "Starting Voyc release build..."
log_info "Project root: $PROJECT_ROOT"

# Check for required tools
if [[ ! -f "$HOME/.bun/bin/bun" ]]; then
    log_error "Bun not found at ~/.bun/bin/bun"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    log_error "Cargo not found. Install Rust toolchain."
    exit 1
fi

# Build using clean environment to avoid shell hook issues
# Key environment variables:
# - RUST_MIN_STACK: Prevents LLVM SIGSEGV during LTO compilation
# - Clean PATH: Avoids gettext and other problematic shell hooks

log_info "Building with clean environment..."

cd "$PROJECT_ROOT"

env -i \
    HOME="$HOME" \
    PATH="/usr/bin:/bin:$HOME/.bun/bin:$HOME/.cargo/bin" \
    TERM="${TERM:-xterm}" \
    XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}" \
    XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}" \
    RUST_MIN_STACK=16777216 \
    bash -c "cd '$PROJECT_ROOT' && $HOME/.bun/bin/bun run tauri build $BUNDLE_TARGET"

BUILD_STATUS=$?

if [[ $BUILD_STATUS -eq 0 ]]; then
    log_info "Build completed successfully!"

    # Show what was built
    echo ""
    log_info "Build artifacts:"

    BINARY="$PROJECT_ROOT/src-tauri/target/release/voyc"
    if [[ -f "$BINARY" ]]; then
        SIZE=$(du -h "$BINARY" | cut -f1)
        echo "  Binary: $BINARY ($SIZE)"
    fi

    DEB="$PROJECT_ROOT/src-tauri/target/release/bundle/deb"
    if [[ -d "$DEB" ]]; then
        for pkg in "$DEB"/*.deb; do
            if [[ -f "$pkg" ]]; then
                SIZE=$(du -h "$pkg" | cut -f1)
                echo "  DEB: $pkg ($SIZE)"
            fi
        done
    fi

    RPM="$PROJECT_ROOT/src-tauri/target/release/bundle/rpm"
    if [[ -d "$RPM" ]]; then
        for pkg in "$RPM"/*.rpm; do
            if [[ -f "$pkg" ]]; then
                SIZE=$(du -h "$pkg" | cut -f1)
                echo "  RPM: $pkg ($SIZE)"
            fi
        done
    fi

    APPIMAGE="$PROJECT_ROOT/src-tauri/target/release/bundle/appimage"
    if [[ -d "$APPIMAGE" ]]; then
        for pkg in "$APPIMAGE"/*.AppImage; do
            if [[ -f "$pkg" ]]; then
                SIZE=$(du -h "$pkg" | cut -f1)
                echo "  AppImage: $pkg ($SIZE)"
            fi
        done
    fi

    echo ""
    log_info "To run the binary directly: $BINARY"
else
    log_error "Build failed with exit code $BUILD_STATUS"
    echo ""
    log_warn "If the build fails with SIGSEGV, try:"
    log_warn "  1. Clean the build: cargo clean -p voyc"
    log_warn "  2. Increase stack: export RUST_MIN_STACK=33554432"
    log_warn "  3. Retry the build"
    exit $BUILD_STATUS
fi
