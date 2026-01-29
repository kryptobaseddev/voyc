#!/bin/bash
# Run Voyc AppImage without FUSE requirement
#
# This script uses --appimage-extract-and-run to bypass FUSE requirements
# on systems that don't have fuse-libs installed.
#
# Usage:
#   ./scripts/run-appimage.sh [args...]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

APPIMAGE="$PROJECT_ROOT/src-tauri/target/release/bundle/appimage/Voyc_1.0.0_amd64.AppImage"

if [[ ! -f "$APPIMAGE" ]]; then
    echo "Error: AppImage not found at $APPIMAGE"
    echo ""
    echo "Build the AppImage first:"
    echo "  bun run build:release"
    echo ""
    echo "Or build only the AppImage:"
    echo "  bun run tauri build --bundles appimage"
    exit 1
fi

# Run AppImage with extract-and-run to bypass FUSE requirement
exec "$APPIMAGE" --appimage-extract-and-run "$@"
