# Application Legitimization & Release Engineering Research

## Summary

Research into Flatpak and AppImage release pipelines for 2026 confirms distinct trade-offs: Flatpak offers security/sandboxing and centralized updates (Flathub), while AppImage provides maximum portability and "no-install" distribution. Modern GTK4/GJS apps can be packaged for both. For versioning, in-app checks using GitHub Releases API are standard for AppImages, while Flatpaks rely on their runtime/repo updates.

## Findings

### 1. Flatpak Manifest Strategy (GTK4 + GJS)
- **Runtime**: `org.gnome.Platform` version `46` (forward-looking for 2026).
- **SDK**: `org.gnome.Sdk` version `46`.
- **Permissions**: Requires specific `finish-args` for Wayland, audio (PipeWire), and network.
  - `--socket=wayland`
  - `--socket=fallback-x11`
  - `--socket=pipewire` (Modern replacement for pulseaudio)
  - `--share=network`
  - `--device=dri` (Hardware acceleration)
- **Build System**: `meson` is standard, but `simple` build type works for pure JS apps if we manually install files to `/app`.

### 2. AppImage Configuration
- **Tooling**: `appimage-builder` is the preferred tool.
- **Config**: `AppImageBuilder.yml` defines dependencies (apt), script execution, and metadata.
- **Dependencies**: Must explicitly list `gjs`, `libgtk-4-1`, `libadwaita-1-0`, `libgirepository-1.0-1`.
- **Runtime**: Requires setting `GIO_MODULE_DIR` and `XDG_DATA_DIRS` in `AppRun` script.

### 3. Update Mechanisms
- **Flatpak**: Updates managed by the user's package manager (e.g., GNOME Software) via Flathub repo. No in-app check needed/recommended.
- **AppImage**: Self-updating via `AppImageUpdate` (zsync) or simple in-app check against GitHub Releases API.
- **Protocol**: RCSD-IVTR suggests a unified "Check for Updates" UI that adapts based on the running context (e.g., "Managed by Flatpak" vs "Download available").

### 4. Git & Versioning
- **Repo**: Standard `.git` with semantic versioning tags (`v1.0.0`).
- **Release**: GitHub Actions can build both artifacts on tag push.

## Recommendations

1.  **Dual Release Strategy**: Support both formats to cover all user bases (Secure/Managed vs Portable).
2.  **Flatpak Manifest**: Create `com.voyc.app.json` using the `simple` build type to copy our `dist/` and `src/` files.
3.  **AppImage Builder**: Create `AppImageBuilder.yml` targeting standard Ubuntu LTS base for compatibility.
4.  **Update Logic**: Implement a `UpdateChecker` class in `src/utils/` that:
    - Detects if running as Flatpak (check `/.flatpak-info`).
    - If Flatpak: Show "Updates managed by system".
    - If AppImage/Local: Query GitHub Releases API for newer tag.

## Sources

- [Flatpak Docs: GJS/GTK4](https://docs.flatpak.org/en/latest/guides.html)
- [AppImageBuilder Docs](https://appimage-builder.readthedocs.io/)
- [Electron Builder Comparison](https://www.electron.build/configuration/linux)

## Linked Tasks

- Epic: T020
- Task: T022
