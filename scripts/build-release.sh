#!/bin/bash
# Voyc Release Build Script
#
# This script builds Voyc for production with properly embedded frontend assets.
#
# Requirements solved:
# 1. Uses clean environment to avoid shell hook conflicts (gettext, etc.)
# 2. Sets RUST_MIN_STACK to prevent LLVM SIGSEGV during LTO compilation
# 3. Uses 'tauri build' instead of 'cargo build' for proper asset embedding
# 4. Handles AppImage creation on systems without FUSE support
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
BUILD_APPIMAGE_MANUALLY=false
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
        # For full builds, build deb/rpm via Tauri, then AppImage manually
        BUNDLE_TARGET="--bundles deb,rpm"
        BUILD_APPIMAGE_MANUALLY=true
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
# - FERROUS_FORGE_ENABLED=0: Disable code quality hooks during release build

log_info "Building with clean environment..."

cd "$PROJECT_ROOT"

env -i \
    HOME="$HOME" \
    PATH="/usr/bin:/bin:$HOME/.bun/bin:$HOME/.cargo/bin:$HOME/.local/bin" \
    TERM="${TERM:-xterm}" \
    XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}" \
    XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}" \
    RUST_MIN_STACK=16777216 \
    APPIMAGE_EXTRACT_AND_RUN=1 \
    FERROUS_FORGE_ENABLED=0 \
    bash -c "cd '$PROJECT_ROOT' && $HOME/.bun/bin/bun run tauri build $BUNDLE_TARGET"

BUILD_STATUS=$?

if [[ $BUILD_STATUS -ne 0 ]]; then
    log_error "Build failed with exit code $BUILD_STATUS"
    echo ""
    log_warn "If the build fails with SIGSEGV, try:"
    log_warn "  1. Clean the build: cargo clean -p voyc"
    log_warn "  2. Increase stack: export RUST_MIN_STACK=33554432"
    log_warn "  3. Retry the build"
    exit $BUILD_STATUS
fi

# Build AppImage manually if needed (for systems without FUSE)
if [[ "$BUILD_APPIMAGE_MANUALLY" == "true" ]]; then
    log_info "Building AppImage manually (FUSE workaround)..."

    APPIMAGE_DIR="$PROJECT_ROOT/src-tauri/target/release/bundle/appimage"
    APPDIR="$APPIMAGE_DIR/Voyc.AppDir"
    LINUXDEPLOY="$HOME/.cache/tauri/linuxdeploy-x86_64.AppImage"

    # Check if linuxdeploy is available (either as symlink to extracted version or AppImage)
    if [[ ! -x "$LINUXDEPLOY" ]]; then
        log_warn "linuxdeploy not found, attempting to use AppImage bundling from Tauri..."
        # Fall back to Tauri's AppImage bundling
        env -i \
            HOME="$HOME" \
            PATH="/usr/bin:/bin:$HOME/.bun/bin:$HOME/.cargo/bin:$HOME/.local/bin" \
            TERM="${TERM:-xterm}" \
            XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}" \
            XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}" \
            RUST_MIN_STACK=16777216 \
            APPIMAGE_EXTRACT_AND_RUN=1 \
            FERROUS_FORGE_ENABLED=0 \
            bash -c "cd '$PROJECT_ROOT' && $HOME/.bun/bin/bun run tauri build --bundles appimage" || true
    else
        # Create AppDir structure using Tauri's approach (reuse existing preparation)
        mkdir -p "$APPIMAGE_DIR"

        # Run Tauri's AppImage preparation (creates AppDir but fails at linuxdeploy)
        log_info "Preparing AppImage structure..."
        env -i \
            HOME="$HOME" \
            PATH="/usr/bin:/bin:$HOME/.bun/bin:$HOME/.cargo/bin:$HOME/.local/bin" \
            TERM="${TERM:-xterm}" \
            XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}" \
            XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}" \
            RUST_MIN_STACK=16777216 \
            APPIMAGE_EXTRACT_AND_RUN=1 \
            FERROUS_FORGE_ENABLED=0 \
            bash -c "cd '$PROJECT_ROOT' && $HOME/.bun/bin/bun run tauri build --bundles appimage" 2>&1 || true

        # Check if AppDir was created
        if [[ -d "$APPDIR" ]]; then
            log_info "Running linuxdeploy to create AppImage..."
            cd "$APPIMAGE_DIR"

            # Run linuxdeploy directly (using symlink to extracted version)
            "$LINUXDEPLOY" --appdir Voyc.AppDir --output appimage 2>&1 || {
                log_error "linuxdeploy failed to create AppImage"
                BUILD_APPIMAGE_MANUALLY=false
            }

            # Rename output to Tauri's expected format
            if [[ -f "$APPIMAGE_DIR/Voyc-x86_64.AppImage" ]]; then
                mv "$APPIMAGE_DIR/Voyc-x86_64.AppImage" "$APPIMAGE_DIR/Voyc_1.0.0_amd64.AppImage"
                log_info "AppImage created successfully"
            fi

            cd "$PROJECT_ROOT"
        else
            log_warn "AppDir not found, skipping AppImage creation"
        fi
    fi
fi

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
