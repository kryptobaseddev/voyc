# AppImage FUSE Requirement Research

**Task**: T060 - Fix AppImage FUSE requirement
**Date**: 2026-01-29
**Status**: complete

---

## Executive Summary

The `dlopen(): error loading libfuse.so.2` error occurs because modern Linux distributions (Ubuntu 22.04+, Fedora 42+) have deprecated FUSE 2 in favor of FUSE 3. AppImages traditionally require FUSE 2 to mount their internal filesystem. This research identifies **5 solutions** ranked by user impact and implementation complexity.

---

## Problem Analysis

### Root Cause
AppImages use FUSE (Filesystem in Userspace) to mount the embedded SquashFS filesystem. The AppImage runtime dynamically links against `libfuse.so.2`, which is:
- Not installed by default on Ubuntu 22.04+
- Renamed to `libfuse2t64` on Ubuntu 24.04+
- Available as `fuse-libs` package on Fedora (not `libfuse2`)
- Being deprecated across distributions in favor of FUSE 3

### User Environment
- **Fedora 43**: FUSE 2 available via `fuse-libs` package
- **Modern Distros**: Moving toward FUSE 3 only

---

## Solutions (Ranked by Recommendation)

### Solution 1: Provide Clear User Instructions (Quick Win)

**Implementation**: Update README and release notes with platform-specific instructions.

**For Fedora users:**
```bash
sudo dnf install fuse-libs
```

**For Ubuntu 22.04:**
```bash
sudo apt install libfuse2
```

**For Ubuntu 24.04+:**
```bash
sudo apt install libfuse2t64
```

**Pros**: Zero code changes, immediate solution
**Cons**: Requires user action, not seamless

---

### Solution 2: Wrapper Script with --appimage-extract-and-run

**Implementation**: Ship a wrapper script alongside the AppImage.

```bash
#!/bin/bash
# voyc-launcher.sh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APPIMAGE="$SCRIPT_DIR/voyc_1.0.0_amd64.AppImage"

if command -v fusermount &>/dev/null || [ -f /usr/lib64/libfuse.so.2 ]; then
    exec "$APPIMAGE" "$@"
else
    echo "FUSE not available, extracting AppImage..."
    exec "$APPIMAGE" --appimage-extract-and-run "$@"
fi
```

**Pros**: Works without FUSE, no user intervention
**Cons**: Slower startup (extracts to /tmp each time), uses more disk space temporarily

---

### Solution 3: Pre-Extracted AppImage Distribution

**Implementation**: Distribute the extracted AppImage as a tarball.

```bash
# Build process
./voyc.AppImage --appimage-extract
mv squashfs-root voyc-1.0.0
tar -czvf voyc-1.0.0-linux-x86_64.tar.gz voyc-1.0.0/
```

**User runs:**
```bash
tar -xzf voyc-1.0.0-linux-x86_64.tar.gz
./voyc-1.0.0/AppRun
```

**Pros**: No FUSE required, faster than extract-and-run
**Cons**: Larger download, loses single-file simplicity

---

### Solution 4: Add Flatpak Distribution (Best Long-Term)

**Implementation**: Create Flatpak manifest for Flathub distribution.

**Flatpak Manifest** (`com.voyc.dictation.yml`):
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
  - --share=ipc
  - --socket=wayland
  - --socket=fallback-x11
  - --socket=pulseaudio
  - --device=dri
  - --talk-name=org.freedesktop.Notifications
  - --talk-name=org.kde.StatusNotifierWatcher
  - --env=FLATPAK=1

modules:
  - name: voyc
    buildsystem: simple
    build-commands:
      # Build from source or extract .deb
      - install -Dm755 voyc /app/bin/voyc
      - install -Dm644 voyc.desktop /app/share/applications/com.voyc.dictation.desktop
      - install -Dm644 icon.png /app/share/icons/hicolor/128x128/apps/com.voyc.dictation.png
    sources:
      - type: archive
        url: https://github.com/kryptobaseddev/voyc/releases/download/v1.0.0/voyc_1.0.0_amd64.deb
        sha256: <SHA256_HASH>
```

**Tray Icon Fix** (required for Flatpak):
The tray icon must use `$XDG_DATA_HOME` instead of `/tmp` because Flatpak sandboxing makes `/tmp` paths inaccessible to the host.

**Pros**:
- Native on Fedora, no FUSE needed
- Automatic updates
- Sandboxed security
- Professional distribution channel

**Cons**:
- Significant implementation effort
- Flathub review process
- Need to handle Tauri resource paths (`/usr` -> `/app`)

---

### Solution 5: New Static Type2-Runtime (Future Option)

**Status**: Experimental, not recommended for production yet.

The AppImage project is developing a statically-linked runtime that eliminates the libfuse2 dependency entirely. Built with musl libc on Alpine Linux.

**Repository**: https://github.com/AppImage/type2-runtime

**Current Issues**:
- Breaks compatibility with AppImageLauncher
- Missing some advanced features (update info, digital signatures)
- Not yet widely adopted

**Tauri Integration**: Would require modifying the Tauri bundler or post-processing the AppImage to replace the runtime. Not straightforward.

---

## Tauri-Specific Considerations

### Current Configuration
The project already has AppImage configuration in `tauri.conf.json`:
```json
"appimage": {
  "bundleMediaFramework": true,
  "files": {}
}
```

### Static Linking Limitation
Full static linking of WebKit dependencies is not feasible with Tauri's current stack. The WebKit/GTK dependencies alone require ~400MB and cannot be statically linked.

### Alternative Bundle Targets
Tauri supports multiple Linux targets:
```json
"targets": ["deb", "rpm", "appimage"]
```

Consider adding documentation recommending `.deb` for Debian/Ubuntu users as a FUSE-free alternative.

---

## Recommended Implementation Plan

### Phase 1: Immediate (Low Effort)
1. Update README with FUSE installation instructions
2. Add installation instructions to GitHub release notes
3. Document `--appimage-extract-and-run` fallback

### Phase 2: Short-Term (Medium Effort)
4. Create wrapper script that auto-detects FUSE availability
5. Ship both AppImage and extracted tarball in releases
6. Add `.desktop` file integration instructions

### Phase 3: Long-Term (High Effort)
7. Implement Flatpak distribution
8. Submit to Flathub
9. Monitor type2-runtime development for future adoption

---

## Quick Fix for Current User

Tell the user to run:

**On Fedora:**
```bash
sudo dnf install fuse-libs
```

**Then the AppImage will work normally.**

Alternatively, they can bypass FUSE entirely:
```bash
./voyc_1.0.0_amd64.AppImage --appimage-extract-and-run
```

Or extract permanently:
```bash
./voyc_1.0.0_amd64.AppImage --appimage-extract
./squashfs-root/AppRun
```

---

## References

- [AppImage FUSE Troubleshooting](https://docs.appimage.org/user-guide/troubleshooting/fuse.html)
- [Tauri AppImage Documentation](https://v2.tauri.app/distribute/appimage/)
- [Type2-Runtime Repository](https://github.com/AppImage/type2-runtime)
- [Tauri Static Linking Discussion](https://github.com/tauri-apps/tauri/discussions/8367)
- [Flatpak Tauri Packaging Guide](https://vincent.jousse.org/blog/en/packaging-tauri-v2-flatpak-snapcraft-elm/)
- [Fedora FUSE Packages](https://packages.fedoraproject.org/pkgs/fuse/fuse-libs/index.html)
- [Ubuntu 24.04 AppImage Fix](https://itsfoss.com/cant-run-appimage-ubuntu/)
