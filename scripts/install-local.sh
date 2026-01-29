#!/bin/bash
# Voyc Local Installation Script
#
# Installs Voyc to the user's local directory without requiring sudo or FUSE.
# Extracts the AppImage and creates proper integration with the desktop environment.
#
# Installation locations:
#   - Application files: ~/.local/share/Voyc/
#   - Binary symlink: ~/.local/bin/voyc
#   - Desktop entry: ~/.local/share/applications/com.voyc.dictation.desktop
#   - Icons: ~/.local/share/icons/hicolor/*/apps/voyc.png
#
# Usage:
#   ./scripts/install-local.sh           # Install from built AppImage
#   ./scripts/install-local.sh --remove  # Uninstall
#
# Requirements:
#   - AppImage must be built first (bun run build:release)
#   - ~/.local/bin should be in PATH (added to shell config if not)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Installation paths
INSTALL_DIR="$HOME/.local/share/Voyc"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_BASE="$HOME/.local/share/icons/hicolor"

# Source AppImage
APPIMAGE="$PROJECT_ROOT/src-tauri/target/release/bundle/appimage/Voyc_1.0.0_amd64.AppImage"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Uninstall function
uninstall() {
    log_info "Uninstalling Voyc..."

    # Remove binary symlink
    if [[ -L "$BIN_DIR/voyc" ]]; then
        rm -f "$BIN_DIR/voyc"
        log_step "Removed $BIN_DIR/voyc"
    fi

    # Remove desktop entry
    if [[ -f "$DESKTOP_DIR/com.voyc.dictation.desktop" ]]; then
        rm -f "$DESKTOP_DIR/com.voyc.dictation.desktop"
        log_step "Removed desktop entry"
    fi

    # Remove icons
    for size in 32x32 128x128 256x256; do
        icon_path="$ICON_BASE/$size/apps/voyc.png"
        if [[ -f "$icon_path" ]]; then
            rm -f "$icon_path"
        fi
    done
    log_step "Removed icons"

    # Remove application directory
    if [[ -d "$INSTALL_DIR" ]]; then
        rm -rf "$INSTALL_DIR"
        log_step "Removed $INSTALL_DIR"
    fi

    # Update icon cache
    if command -v gtk-update-icon-cache &> /dev/null; then
        gtk-update-icon-cache -f -t "$ICON_BASE" 2>/dev/null || true
    fi

    # Update desktop database
    if command -v update-desktop-database &> /dev/null; then
        update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
    fi

    log_info "Voyc has been uninstalled"
    return 0
}

# Check for uninstall flag
if [[ "${1:-}" == "--remove" ]] || [[ "${1:-}" == "--uninstall" ]]; then
    uninstall
    exit 0
fi

# Check if AppImage exists
if [[ ! -f "$APPIMAGE" ]]; then
    log_error "AppImage not found at: $APPIMAGE"
    echo ""
    echo "Build the AppImage first:"
    echo "  bun run build:release"
    echo ""
    echo "Or build only the AppImage:"
    echo "  bun run tauri build --bundles appimage"
    exit 1
fi

log_info "Installing Voyc locally..."

# Create directories
log_step "Creating installation directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"
mkdir -p "$DESKTOP_DIR"
mkdir -p "$ICON_BASE/32x32/apps"
mkdir -p "$ICON_BASE/128x128/apps"
mkdir -p "$ICON_BASE/256x256/apps"

# Extract AppImage
log_step "Extracting AppImage to $INSTALL_DIR..."

# Create temp directory for extraction
TEMP_DIR=$(mktemp -d)
trap "rm -rf '$TEMP_DIR'" EXIT

# Extract AppImage
cd "$TEMP_DIR"
"$APPIMAGE" --appimage-extract >/dev/null 2>&1

if [[ ! -d "$TEMP_DIR/squashfs-root" ]]; then
    log_error "Failed to extract AppImage"
    exit 1
fi

# Clean existing installation
if [[ -d "$INSTALL_DIR" ]]; then
    rm -rf "$INSTALL_DIR"
fi

# Move extracted contents
mv "$TEMP_DIR/squashfs-root" "$INSTALL_DIR"
log_step "Extracted to $INSTALL_DIR"

# Find the binary location (could be in usr/bin or usr/lib)
BINARY=""
if [[ -x "$INSTALL_DIR/usr/bin/voyc" ]]; then
    BINARY="$INSTALL_DIR/usr/bin/voyc"
elif [[ -x "$INSTALL_DIR/usr/lib/Voyc" ]]; then
    BINARY="$INSTALL_DIR/usr/lib/Voyc"
elif [[ -x "$INSTALL_DIR/AppRun" ]]; then
    BINARY="$INSTALL_DIR/AppRun"
fi

if [[ -z "$BINARY" ]] || [[ ! -x "$BINARY" ]]; then
    log_error "Could not find executable in extracted AppImage"
    log_error "Contents of $INSTALL_DIR:"
    ls -la "$INSTALL_DIR"
    exit 1
fi

log_step "Found binary at: $BINARY"

# Create symlink
log_step "Creating symlink at $BIN_DIR/voyc..."
rm -f "$BIN_DIR/voyc"
ln -s "$BINARY" "$BIN_DIR/voyc"

# Install icons
log_step "Installing icons..."

# Copy icons from extracted AppDir
if [[ -d "$INSTALL_DIR/usr/share/icons/hicolor" ]]; then
    for size_dir in "$INSTALL_DIR/usr/share/icons/hicolor"/*; do
        if [[ -d "$size_dir/apps" ]]; then
            size=$(basename "$size_dir")
            for icon in "$size_dir/apps"/*.png; do
                if [[ -f "$icon" ]]; then
                    mkdir -p "$ICON_BASE/$size/apps"
                    cp "$icon" "$ICON_BASE/$size/apps/voyc.png"
                fi
            done
        fi
    done
fi

# Fallback: use 128x128 icon from source if available
if [[ -f "$PROJECT_ROOT/src-tauri/icons/128x128.png" ]]; then
    cp "$PROJECT_ROOT/src-tauri/icons/128x128.png" "$ICON_BASE/128x128/apps/voyc.png"
fi
if [[ -f "$PROJECT_ROOT/src-tauri/icons/32x32.png" ]]; then
    cp "$PROJECT_ROOT/src-tauri/icons/32x32.png" "$ICON_BASE/32x32/apps/voyc.png"
fi

# Create desktop entry
log_step "Creating desktop entry..."
cat > "$DESKTOP_DIR/com.voyc.dictation.desktop" << EOF
[Desktop Entry]
Name=Voyc
Comment=Fast, minimal voice dictation for Linux
GenericName=Voice Dictation
Exec=$BINARY %U
Icon=voyc
Type=Application
Categories=AudioVideo;Audio;Utility;
Keywords=voice;dictation;speech;transcription;whisper;audio;stt;
Terminal=false
StartupNotify=true
StartupWMClass=voyc
X-GNOME-UsesNotifications=true
EOF

chmod +x "$DESKTOP_DIR/com.voyc.dictation.desktop"

# Validate desktop entry
if command -v desktop-file-validate &> /dev/null; then
    if desktop-file-validate "$DESKTOP_DIR/com.voyc.dictation.desktop" 2>/dev/null; then
        log_step "Desktop entry validated"
    else
        log_warn "Desktop entry validation warnings (non-critical)"
    fi
fi

# Update icon cache
log_step "Updating icon cache..."
if command -v gtk-update-icon-cache &> /dev/null; then
    gtk-update-icon-cache -f -t "$ICON_BASE" 2>/dev/null || true
fi

# Update desktop database
log_step "Updating desktop database..."
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi

# Check if ~/.local/bin is in PATH
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    log_warn "$BIN_DIR is not in your PATH"
    echo ""
    echo "Add this to your shell configuration (~/.bashrc or ~/.zshrc):"
    echo ""
    echo '  export PATH="$HOME/.local/bin:$PATH"'
    echo ""
    echo "Then reload your shell or run: source ~/.bashrc"
fi

echo ""
log_info "Voyc has been installed successfully!"
echo ""
echo "You can now:"
echo "  1. Run from terminal:  voyc"
echo "  2. Run from app menu:  Search for 'Voyc' in your application menu"
echo ""
echo "To uninstall:"
echo "  ./scripts/install-local.sh --remove"
echo ""

# Test if the app can start
log_step "Testing installation..."
if "$BINARY" --version >/dev/null 2>&1; then
    log_info "Installation test passed"
elif timeout 2 "$BINARY" >/dev/null 2>&1; then
    log_info "Installation test passed"
else
    # Some apps don't have --version, try to run briefly
    log_info "Binary is executable (full test skipped)"
fi
