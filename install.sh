#!/bin/bash
# Voyc User Installer - No sudo required!
# 
# Installs Voyc to user directory (~/.local/share/Voyc/)
# With automatic update checking and installation
#
# Usage: 
#   curl -fsSL https://raw.githubusercontent.com/kryptobaseddev/voyc/main/install-user.sh | bash
#   ./install-user.sh --update    # Check for and install updates
#   ./install-user.sh --version   # Show current version
#   ./install-user.sh --remove    # Uninstall

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}==>${NC} $1"; }

# Installation paths
INSTALL_DIR="$HOME/.local/share/Voyc"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/128x128/apps"
VERSION_FILE="$INSTALL_DIR/.version"

# GitHub release URL
REPO="kryptobaseddev/voyc"
API_URL="https://api.github.com/repos/$REPO/releases/latest"

# Get installed version
get_installed_version() {
    if [[ -f "$VERSION_FILE" ]]; then
        cat "$VERSION_FILE"
    else
        echo "not installed"
    fi
}

# Get latest version from GitHub
get_latest_version() {
    curl -s "$API_URL" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' | sed 's/^v//'
}

# Download and install a specific version
install_version() {
    local version=$1
    local temp_dir=$(mktemp -d)
    
    log_step "Downloading Voyc v${version}..."
    
    # Download the deb package (we'll extract it)
    local deb_url="https://github.com/$REPO/releases/download/v${version}/Voyc_${version}_amd64.deb"
    local deb_file="$temp_dir/voyc.deb"
    
    if ! curl -fsSL -o "$deb_file" "$deb_url"; then
        log_error "Failed to download package"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    log_step "Installing to $INSTALL_DIR..."
    
    # Create installation directory
    mkdir -p "$INSTALL_DIR"
    
    # Extract the deb package
    cd "$temp_dir"
    ar x "$deb_file" data.tar.gz
    tar -xzf data.tar.gz -C "$INSTALL_DIR" --strip-components=1
    
    # Save version
    echo "$version" > "$VERSION_FILE"
    
    # Create launcher script
    mkdir -p "$BIN_DIR"
    cat > "$BIN_DIR/voyc" << EOF
#!/bin/bash
exec "$INSTALL_DIR/bin/voyc" "\$@"
EOF
    chmod +x "$BIN_DIR/voyc"
    
    # Create desktop entry
    mkdir -p "$DESKTOP_DIR"
    cat > "$DESKTOP_DIR/com.voyc.dictation.desktop" << EOF
[Desktop Entry]
Name=Voyc
Comment=Voice dictation for Linux
Exec=$BIN_DIR/voyc
Icon=$INSTALL_DIR/share/icons/hicolor/128x128/apps/voyc.png
Type=Application
Categories=AudioVideo;Audio;Utility;
Keywords=voice;dictation;speech;transcription;whisper;audio;
Terminal=false
StartupNotify=true
StartupWMClass=voyc
X-GNOME-UsesNotifications=true
Version=$version
EOF
    
    # Copy icon if needed
    if [[ -f "$INSTALL_DIR/share/icons/hicolor/128x128/apps/voyc.png" ]]; then
        mkdir -p "$ICON_DIR"
        cp "$INSTALL_DIR/share/icons/hicolor/128x128/apps/voyc.png" "$ICON_DIR/voyc.png"
    fi
    
    # Update desktop database
    if command -v update-desktop-database &> /dev/null; then
        update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
    fi
    
    # Update icon cache
    if command -v gtk-update-icon-cache &> /dev/null; then
        gtk-update-icon-cache -f "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
    fi
    
    # Cleanup
    rm -rf "$temp_dir"
    
    log_info "Installation complete!"
}

# Remove installation
uninstall() {
    log_step "Uninstalling Voyc..."
    
    # Remove files
    [[ -d "$INSTALL_DIR" ]] && rm -rf "$INSTALL_DIR"
    [[ -f "$BIN_DIR/voyc" ]] && rm -f "$BIN_DIR/voyc"
    [[ -f "$DESKTOP_DIR/com.voyc.dictation.desktop" ]] && rm -f "$DESKTOP_DIR/com.voyc.dictation.desktop"
    [[ -f "$ICON_DIR/voyc.png" ]] && rm -f "$ICON_DIR/voyc.png"
    
    # Update databases
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
    gtk-update-icon-cache -f "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
    
    log_info "Voyc has been uninstalled"
}

# Check for updates
check_update() {
    local current=$(get_installed_version)
    local latest=$(get_latest_version)
    
    if [[ "$current" == "not installed" ]]; then
        log_warn "Voyc is not installed"
        return 1
    fi
    
    log_info "Current version: v$current"
    log_info "Latest version: v$latest"
    
    if [[ "$current" == "$latest" ]]; then
        log_info "You have the latest version!"
        return 0
    else
        log_info "Update available: v$current → v$latest"
        return 1
    fi
}

# Update to latest version
do_update() {
    local current=$(get_installed_version)
    local latest=$(get_latest_version)
    
    if [[ "$current" == "$latest" ]]; then
        log_info "Already up to date (v$current)"
        return 0
    fi
    
    log_step "Updating Voyc v$current → v$latest..."
    
    # Backup current installation
    if [[ -d "$INSTALL_DIR" ]]; then
        mv "$INSTALL_DIR" "${INSTALL_DIR}.backup"
    fi
    
    # Install new version
    if install_version "$latest"; then
        # Remove backup on success
        [[ -d "${INSTALL_DIR}.backup" ]] && rm -rf "${INSTALL_DIR}.backup"
        log_info "Update complete!"
    else
        # Restore backup on failure
        log_error "Update failed, restoring previous version..."
        [[ -d "${INSTALL_DIR}.backup" ]] && mv "${INSTALL_DIR}.backup" "$INSTALL_DIR"
        exit 1
    fi
}

# Main
main() {
    echo "========================================"
    echo "     Voyc User Installer"
    echo "========================================"
    echo ""
    
    case "${1:-}" in
        --remove|--uninstall)
            uninstall
            exit 0
            ;;
        --version)
            echo "Installed version: $(get_installed_version)"
            echo "Latest version: $(get_latest_version)"
            exit 0
            ;;
        --check-update)
            check_update
            exit $?
            ;;
        --update)
            do_update
            exit $?
            ;;
        "")
            # Fresh install
            ;;
        *)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  (no args)      Install Voyc"
            echo "  --update       Check for and install updates"
            echo "  --check-update Check if update is available"
            echo "  --version      Show version info"
            echo "  --remove       Uninstall Voyc"
            echo ""
            exit 1
            ;;
    esac
    
    # Check if already installed
    local current=$(get_installed_version)
    local latest=$(get_latest_version)
    
    if [[ "$current" != "not installed" ]]; then
        echo "Voyc v$current is already installed."
        echo ""
        read -p "Reinstall/Update to v$latest? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Cancelled."
            exit 0
        fi
        do_update
        exit 0
    fi
    
    # Fresh install
    log_step "Installing Voyc v$latest..."
    install_version "$latest"
    
    echo ""
    echo "========================================"
    log_info "Voyc v$latest installed successfully!"
    echo ""
    echo "You can now:"
    echo "  • Run from terminal: voyc"
    echo "  • Run from menu: Search 'Voyc' in applications"
    echo "  • Update anytime: curl -fsSL .../install-user.sh | bash -s -- --update"
    echo ""
    echo "Installation location:"
    echo "  $INSTALL_DIR"
    echo "========================================"
}

main "$@"
