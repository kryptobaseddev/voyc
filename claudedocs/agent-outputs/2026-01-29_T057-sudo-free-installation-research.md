# Sudo-Free Linux Installation Methods for Voyc (Tauri App)

**Task**: T057
**Date**: 2026-01-29
**Status**: complete

---

## Executive Summary

After researching Linux installation methods for Tauri apps, **AppImage with Tauri's built-in updater** is the recommended primary distribution method for Voyc. It provides the best balance of frictionless user experience, zero sudo requirement, and reliable auto-updates. Flatpak should be considered as a secondary distribution channel for users who prefer sandboxed applications.

---

## 1. Flatpak Packaging

### How It Works

Flatpak apps can be installed per-user without sudo using the `--user` flag:

```bash
# Add Flathub remote for user (one-time)
flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

# Install app without sudo
flatpak install --user flathub com.voyc.dictation

# Update without sudo
flatpak update --user com.voyc.dictation
```

**User installation location**: `~/.local/share/flatpak/`

### Manifest Format for Tauri Apps

A Flatpak manifest for a Tauri v2 app requires:

```yaml
app-id: com.voyc.dictation
runtime: org.gnome.Platform
runtime-version: '46'
sdk: org.gnome.Sdk
sdk-extensions:
  - org.freedesktop.Sdk.Extension.rust-stable
  - org.freedesktop.Sdk.Extension.node20

command: voyc

finish-args:
  - --socket=wayland
  - --socket=x11
  - --socket=pulseaudio
  - --share=network
  - --talk-name=org.freedesktop.Notifications
  - --talk-name=org.kde.StatusNotifierWatcher  # For tray icon
  - --own-name=com.voyc.dictation

modules:
  - name: voyc
    buildsystem: simple
    build-commands:
      # Build frontend
      - npm ci --offline
      - npm run build
      # Build Rust backend
      - cargo build --release
      # Install
      - install -Dm755 target/release/voyc /app/bin/voyc
      - install -Dm644 voyc.desktop /app/share/applications/com.voyc.dictation.desktop
      - install -Dm644 voyc.metainfo.xml /app/share/metainfo/com.voyc.dictation.metainfo.xml
    sources:
      - type: git
        url: https://github.com/kryptobaseddev/voyc
```

### Key Challenges for Tauri + Flatpak

1. **Tray Icon Issue**: Flatpak sandboxing breaks tray icons because Tauri stores them in `/tmp` which is sandboxed. Fix:
   ```rust
   let local_data_path = app_handle.path()
     .resolve("tray-icon", BaseDirectory::AppLocalData).unwrap();
   tray.set_temp_dir_path(Some(local_data_path));
   ```

2. **Path Resolution**: Flatpak uses `/app` prefix instead of `/usr`. Need custom path resolution.

3. **Offline Builds**: Flathub requires building from source with offline dependencies.

### Pros/Cons

| Pros | Cons |
|------|------|
| No sudo with `--user` | Complex manifest creation |
| Automatic updates via Flatpak | Larger download size (includes runtime) |
| Sandboxed security | Tray icon requires workaround |
| Wide distribution via Flathub | Flathub review process (1-2 weeks) |

---

## 2. AppImage (Recommended Primary Method)

### How Users Install and Run

AppImage requires **zero sudo** and **zero installation**:

```bash
# Download
wget https://github.com/kryptobaseddev/voyc/releases/latest/download/voyc_1.0.0_amd64.AppImage

# Make executable (one time)
chmod +x voyc_1.0.0_amd64.AppImage

# Run
./voyc_1.0.0_amd64.AppImage
```

Users typically store AppImages in:
- `~/Applications/`
- `~/AppImages/`
- `~/.local/bin/`

### Desktop Integration (Icons, Menu Entries) Without Sudo

#### Option A: AppImageLauncher (Recommended for Users)

When users run an AppImage, AppImageLauncher prompts to:
- Move it to `~/Applications/`
- Create desktop entry in `~/.local/share/applications/`
- Extract icons to `~/.local/share/icons/`

This is fully automatic and user-controlled.

#### Option B: Voyc Self-Integration on First Run

The app can integrate itself on first run:

```rust
fn integrate_desktop() -> Result<()> {
    let home = std::env::var("HOME")?;
    let appimage_path = std::env::var("APPIMAGE")?;

    // Create desktop entry
    let desktop_content = format!(r#"[Desktop Entry]
Type=Application
Name=Voyc
Comment=Voice dictation for Linux
Exec={}
Icon=voyc
Terminal=false
Categories=Audio;AudioVideo;Utility;
StartupWMClass=voyc
"#, appimage_path);

    let desktop_path = format!("{}/.local/share/applications/voyc.desktop", home);
    std::fs::write(&desktop_path, desktop_content)?;

    // Copy icon
    let icon_dir = format!("{}/.local/share/icons/hicolor/128x128/apps", home);
    std::fs::create_dir_all(&icon_dir)?;
    // Extract and copy icon...

    Ok(())
}
```

#### Option C: Manual Integration

```bash
# Create desktop entry
cat > ~/.local/share/applications/voyc.desktop << EOF
[Desktop Entry]
Type=Application
Name=Voyc
Comment=Voice dictation for Linux
Exec=$HOME/Applications/voyc.AppImage
Icon=voyc
Terminal=false
Categories=Audio;AudioVideo;Utility;
EOF

# Copy icon (extract from AppImage first)
./voyc.AppImage --appimage-extract usr/share/icons
cp squashfs-root/usr/share/icons/hicolor/128x128/apps/voyc.png ~/.local/share/icons/hicolor/128x128/apps/
```

### Pros/Cons

| Pros | Cons |
|------|------|
| Zero sudo required | Desktop integration not automatic |
| Single file distribution | Larger file size (~100MB with webkit) |
| Works on all distros | Some distros don't auto-integrate |
| Tauri has native AppImage support | User must make executable |
| Can self-update | Perceived as "less official" by some users |

---

## 3. User-Local Installation (~/.local/)

### Traditional tar.gz Extraction

```bash
# Download and extract
wget https://github.com/kryptobaseddev/voyc/releases/latest/download/voyc-linux-x64.tar.gz
tar -xzf voyc-linux-x64.tar.gz -C ~/.local/opt/

# Create symlink in PATH
ln -s ~/.local/opt/voyc/voyc ~/.local/bin/voyc

# Create desktop entry
cp ~/.local/opt/voyc/voyc.desktop ~/.local/share/applications/
```

### Installation Paths (No Sudo)

| Purpose | User Path | System Path (requires sudo) |
|---------|-----------|----------------------------|
| Binaries | `~/.local/bin/` | `/usr/local/bin/` |
| Applications | `~/.local/opt/` | `/opt/` |
| Desktop entries | `~/.local/share/applications/` | `/usr/share/applications/` |
| Icons | `~/.local/share/icons/` | `/usr/share/icons/` |
| Data | `~/.local/share/voyc/` | `/var/lib/voyc/` |

### Pros/Cons

| Pros | Cons |
|------|------|
| Full control over installation | Manual process |
| Familiar to power users | No auto-updates |
| Lightweight | Multiple files to manage |

---

## 4. Auto-Update Mechanisms Without Sudo

### Tauri's Built-in Updater (Already Configured in Voyc)

Voyc already has the updater plugin configured:

```json
// tauri.conf.json
"plugins": {
  "updater": {
    "pubkey": "...",
    "endpoints": [
      "https://github.com/kryptobaseddev/voyc/releases/latest/download/latest.json"
    ]
  }
}
```

**How it works on Linux (AppImage)**:

1. App checks endpoint for new version
2. Downloads `voyc.AppImage.tar.gz`
3. Verifies cryptographic signature
4. Extracts new AppImage
5. **Replaces current executable in-place** (same directory)
6. User restarts app to use new version

**Key point**: No sudo required because it only writes to the directory where the AppImage is located (user's home directory).

### Current Configuration Fix Needed

```json
// Current (disabled)
"createUpdaterArtifacts": false

// Should be:
"createUpdaterArtifacts": true  // or "v2" for modern format
```

### Update JSON Format

The `latest.json` file should contain:

```json
{
  "version": "1.1.0",
  "notes": "Bug fixes and improvements",
  "pub_date": "2026-01-29T00:00:00Z",
  "platforms": {
    "linux-x86_64": {
      "signature": "<content of voyc.AppImage.tar.gz.sig>",
      "url": "https://github.com/kryptobaseddev/voyc/releases/download/v1.1.0/voyc_1.1.0_amd64.AppImage.tar.gz"
    }
  }
}
```

### How Other Apps Handle This

| App | Method | Sudo Required? |
|-----|--------|----------------|
| VS Code (tar.gz) | Manual download | No (but no auto-update) |
| VS Code (deb/rpm) | Package manager | Yes |
| VS Code (Snap/Flatpak) | Store update | No |
| Discord | Flatpak/Snap or manual | Depends on method |
| Obsidian | AppImage self-update | No |
| Spotify | Snap/Flatpak | No |

---

## 5. Recommended Implementation for Voyc

### Primary: AppImage with Self-Update

**Why AppImage is best for Voyc:**

1. **Zero friction**: Download, chmod +x, run
2. **Zero sudo**: Everything in user space
3. **Auto-updates work**: Tauri updater replaces AppImage in-place
4. **Single file**: Easy to distribute, backup, remove
5. **Already supported**: Tauri builds AppImage by default

### Implementation Steps

#### Step 1: Enable Updater Artifacts

```json
// tauri.conf.json
"bundle": {
  "createUpdaterArtifacts": "v2",  // Enable modern updater format
  ...
}
```

#### Step 2: Implement Desktop Integration on First Run

```rust
// src-tauri/src/integration.rs
use std::env;
use std::fs;
use std::path::PathBuf;

pub fn setup_desktop_integration() -> anyhow::Result<bool> {
    // Only run for AppImage
    let appimage_path = match env::var("APPIMAGE") {
        Ok(path) => path,
        Err(_) => return Ok(false), // Not running as AppImage
    };

    let home = env::var("HOME")?;
    let desktop_dir = PathBuf::from(&home).join(".local/share/applications");
    let desktop_file = desktop_dir.join("voyc.desktop");

    // Check if already integrated
    if desktop_file.exists() {
        // Update Exec path in case AppImage moved
        update_desktop_entry(&desktop_file, &appimage_path)?;
        return Ok(true);
    }

    // First run - create integration
    fs::create_dir_all(&desktop_dir)?;

    let content = format!(r#"[Desktop Entry]
Version=1.0
Type=Application
Name=Voyc
GenericName=Voice Dictation
Comment=Voice dictation and transcription for Linux
Exec="{}"
Icon=voyc
Terminal=false
Categories=Audio;AudioVideo;Utility;Accessibility;
Keywords=voice;dictation;transcription;speech;whisper;
StartupWMClass=voyc
StartupNotify=true
"#, appimage_path);

    fs::write(&desktop_file, content)?;

    // Install icon
    install_icon(&home)?;

    Ok(true)
}

fn install_icon(home: &str) -> anyhow::Result<()> {
    let icon_dir = PathBuf::from(home)
        .join(".local/share/icons/hicolor/128x128/apps");
    fs::create_dir_all(&icon_dir)?;

    // Icon is bundled in resources
    let icon_data = include_bytes!("../icons/128x128.png");
    fs::write(icon_dir.join("voyc.png"), icon_data)?;

    Ok(())
}
```

#### Step 3: Add Self-Uninstall/Cleanup

```rust
pub fn remove_desktop_integration() -> anyhow::Result<()> {
    let home = env::var("HOME")?;

    // Remove desktop entry
    let desktop_file = PathBuf::from(&home)
        .join(".local/share/applications/voyc.desktop");
    if desktop_file.exists() {
        fs::remove_file(desktop_file)?;
    }

    // Remove icon
    let icon_file = PathBuf::from(&home)
        .join(".local/share/icons/hicolor/128x128/apps/voyc.png");
    if icon_file.exists() {
        fs::remove_file(icon_file)?;
    }

    Ok(())
}
```

#### Step 4: GitHub Actions for Release

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags:
      - 'v*'

jobs:
  build-linux:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev

      - name: Build AppImage
        run: |
          bun install
          bun run tauri build --bundles appimage

      - name: Sign update artifacts
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
        run: |
          # Tauri automatically signs when key is set

      - name: Generate latest.json
        run: |
          VERSION=${GITHUB_REF#refs/tags/v}
          SIGNATURE=$(cat target/release/bundle/appimage/*.sig)
          cat > latest.json << EOF
          {
            "version": "$VERSION",
            "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
            "platforms": {
              "linux-x86_64": {
                "signature": "$SIGNATURE",
                "url": "https://github.com/kryptobaseddev/voyc/releases/download/v$VERSION/voyc_${VERSION}_amd64.AppImage.tar.gz"
              }
            }
          }
          EOF

      - name: Upload Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            target/release/bundle/appimage/*.AppImage
            target/release/bundle/appimage/*.tar.gz
            target/release/bundle/appimage/*.sig
            latest.json
```

### Secondary: Flatpak (Flathub)

For users who prefer sandboxed apps, submit to Flathub:

1. Create `com.voyc.dictation.yml` manifest
2. Submit PR to [flathub/flathub](https://github.com/flathub/flathub)
3. Go through review process (1-2 weeks)

This provides:
- `flatpak install --user flathub com.voyc.dictation`
- Automatic updates via Flatpak
- No sudo required with `--user`

---

## 6. Comparison Matrix

| Feature | AppImage | Flatpak (--user) | tar.gz to ~/.local |
|---------|----------|------------------|-------------------|
| Sudo required | No | No | No |
| Auto-update | Yes (Tauri updater) | Yes (flatpak update) | No |
| Desktop integration | Semi-auto | Automatic | Manual |
| Single file | Yes | No (uses runtime) | No |
| Sandboxed | No | Yes | No |
| Distribution | GitHub releases | Flathub | GitHub releases |
| Implementation effort | Low (already works) | Medium (manifest) | Low |
| User friction | Very low | Low | Medium |

---

## 7. Final Recommendation

### Immediate (v1.0.0):

1. **Enable updater artifacts** in `tauri.conf.json`
2. **Add desktop self-integration** on first AppImage run
3. **Update GitHub Actions** to generate `latest.json`
4. **Document AppImage installation** in README

### Future (v1.1.0+):

1. **Submit to Flathub** for users who prefer sandboxed apps
2. **Consider AUR package** for Arch Linux users
3. **Add uninstall command** (`voyc --uninstall`) for clean removal

---

## References

- [Tauri Updater Plugin Documentation](https://v2.tauri.app/plugin/updater/)
- [Tauri AppImage Distribution](https://v2.tauri.app/distribute/appimage/)
- [AppImage Self-Update Documentation](https://docs.appimage.org/packaging-guide/optional/updates.html)
- [Flatpak User vs System Installation](https://docs.flathub.org/docs/for-users/user-vs-system-install)
- [XDG Desktop Entry Specification](https://wiki.archlinux.org/title/Desktop_entries)
- [Packaging Tauri v2 for Flatpak (Vincent Jousse)](https://vincent.jousse.org/blog/en/packaging-tauri-v2-flatpak-snapcraft-elm/)
- [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher)
- [Electron-Updater Linux Support](https://www.electron.build/auto-update.html)
