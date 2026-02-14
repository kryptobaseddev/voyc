#!/bin/bash
# Voyc Linux Installer Script
# 
# This script installs Voyc voice dictation app on Linux systems
# Supports: Debian/Ubuntu (.deb), Fedora/RHEL (.rpm), and AppImage
#
# Usage: curl -fsSL https://raw.githubusercontent.com/kryptobaseddev/voyc/main/install.sh | bash

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

# Get latest release version
get_latest_version() {
    curl -s "https://api.github.com/repos/kryptobaseddev/voyc/releases/latest" | 
    grep '"tag_name":' | 
    sed -E 's/.*"([^"]+)".*/\1/' | 
    sed 's/^v//'
}

# Detect distro
 detect_distro() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        echo "$ID"
    elif command -v lsb_release &> /dev/null; then
        lsb_release -is | tr '[:upper:]' '[:lower:]'
    else
        echo "unknown"
    fi
}

# Install from .deb
install_deb() {
    local version=$1
    local deb_file="Voyc_${version}_amd64.deb"
    local url="https://github.com/kryptobaseddev/voyc/releases/download/v${version}/${deb_file}"
    
    log_step "Downloading Voyc v${version} (.deb)..."
    
    local temp_dir=$(mktemp -d)
    cd "$temp_dir"
    
    if ! curl -fsSL -o "$deb_file" "$url"; then
        log_error "Failed to download package"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    log_step "Installing Voyc..."
    if command -v sudo &> /dev/null; then
        sudo dpkg -i "$deb_file" || sudo apt-get install -f -y
    else
        log_error "sudo is required for installation"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    rm -rf "$temp_dir"
    
    log_info "Installation complete!"
}

# Install from .rpm
install_rpm() {
    local version=$1
    local rpm_file="Voyc-${version}-1.x86_64.rpm"
    local url="https://github.com/kryptobaseddev/voyc/releases/download/v${version}/${rpm_file}"
    
    log_step "Downloading Voyc v${version} (.rpm)..."
    
    local temp_dir=$(mktemp -d)
    cd "$temp_dir"
    
    if ! curl -fsSL -o "$rpm_file" "$url"; then
        log_error "Failed to download package"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    log_step "Installing Voyc..."
    if command -v sudo &> /dev/null; then
        if command -v dnf &> /dev/null; then
            sudo dnf install -y "$rpm_file"
        elif command -v yum &> /dev/null; then
            sudo yum install -y "$rpm_file"
        else
            sudo rpm -i "$rpm_file"
        fi
    else
        log_error "sudo is required for installation"
        rm -rf "$temp_dir"
        exit 1
    fi
    
    rm -rf "$temp_dir"
    
    log_info "Installation complete!"
}

# Install from AppImage
install_appimage() {
    local version=$1
    local appimage_file="Voyc_${version}_amd64.AppImage"
    local url="https://github.com/kryptobaseddev/voyc/releases/download/v${version}/${appimage_file}"
    
    log_step "Downloading Voyc v${version} (AppImage)..."
    
    local install_dir="$HOME/.local/bin"
    local desktop_dir="$HOME/.local/share/applications"
    local icon_dir="$HOME/.local/share/icons/hicolor/256x256/apps"
    
    mkdir -p "$install_dir" "$desktop_dir" "$icon_dir"
    
    if ! curl -fsSL -o "$install_dir/voyc" "$url"; then
        log_error "Failed to download AppImage"
        exit 1
    fi
    
    chmod +x "$install_dir/voyc"
    
    # Create desktop entry
    log_step "Creating desktop entry..."
    
    cat > "$desktop_dir/voyc.desktop" << EOF
[Desktop Entry]
Name=Voyc
Comment=Voice dictation for Linux
Exec=$install_dir/voyc
Icon=voyc
Type=Application
Categories=Utility;AudioVideo;
Terminal=false
StartupNotify=true
StartupWMClass=Voyc
EOF
    
    # Download icon if not exists
    if [[ ! -f "$icon_dir/voyc.png" ]]; then
        curl -fsSL -o "$icon_dir/voyc.png" \
            "https://raw.githubusercontent.com/kryptobaseddev/voyc/main/icons/256x256.png" 2>/dev/null || true
    fi
    
    # Update desktop database
    if command -v update-desktop-database &> /dev/null; then
        update-desktop-database "$desktop_dir" 2>/dev/null || true
    fi
    
    # Add to PATH if needed
    if [[ ":$PATH:" != *":$install_dir:"* ]]; then
        log_warn "Adding $install_dir to PATH..."
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
        export PATH="$install_dir:$PATH"
    fi
    
    log_info "Installation complete!"
}

# Main
main() {
    echo "========================================"
    echo "  Voyc Voice Dictation Installer"
    echo "========================================"
    echo ""
    
    # Get latest version
    log_step "Checking for latest version..."
    local version
    version=$(get_latest_version)
    
    if [[ -z "$version" ]]; then
        log_warn "Could not determine latest version, using default"
        version="1.1.0"
    fi
    
    log_info "Latest version: v${version}"
    echo ""
    
    # Detect distro
    local distro
    distro=$(detect_distro)
    log_info "Detected distribution: $distro"
    echo ""
    
    # Install based on distro
    case "$distro" in
        ubuntu|debian|linuxmint|pop|elementary|zorin)
            install_deb "$version"
            ;;
        fedora|rhel|centos|rocky|almalinux)
            install_rpm "$version"
            ;;
        *)
            log_warn "Unknown distribution, using AppImage"
            install_appimage "$version"
            ;;
    esac
    
    echo ""
    echo "========================================"
    log_info "Voyc v${version} installed successfully!"
    echo ""
    echo "Usage:"
    echo "  Launch from applications menu, or run: voyc"
    echo ""
    echo "Getting started:"
    echo "  1. Launch Voyc from your applications menu"
    echo "  2. Click 'In-App Dictation' in the sidebar"
    echo "  3. Click 'Record' and start speaking"
    echo "  4. Click 'Stop & Transcribe' when done"
    echo "  5. Copy your text to clipboard!"
    echo ""
    echo "Need help? Visit: https://github.com/kryptobaseddev/voyc"
    echo "========================================"
}

main "$@"
