# Changelog

All notable changes to Voyc will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-01-29

Initial release of Voyc - Voice dictation for Linux.

### Added

- **hotkeys**: Native Wayland/GNOME global shortcuts support via XDG Desktop Portal (`bbea4545`)
- **build**: Production release build script with clean environment (`cfc41c8c`)
- **icons**: New Voyc branding with app icons (`8aa86ff6`)
- **core**: Full Tauri 2.x migration with React frontend (`8b6a727c`)
- **transcription**: Multiple model support (Whisper, Parakeet, Moonshine)
- **ui**: Modern React UI with settings, model management, and transcription controls
- **tray**: System tray integration with status icons
- **clipboard**: Automatic clipboard integration for transcribed text

### Fixed

- **rpm**: Post-install scriptlets for icon cache update (`8611cc01`)
- **updater**: GitHub releases endpoint configuration (`926708db`)
- **about**: Correct Voyc icon display (`3a68431a`)
- **hotkeys**: Comprehensive error logging and platform detection (`44791899`)
- **models**: Model store initialization on app startup (`f552b677`)
- **tray**: Icon display with conditional template mode (`64dc12f8`)
- **crash**: Wayland Gdk Error 71 on NVIDIA GPUs resolved (`39647e1d`)

### Documentation

- GNOME/Wayland global shortcuts research (`e7a95169`)
- Session research and handoff documentation (`3d1e2673`)

---

[1.0.0]: https://github.com/kryptobaseddev/voyc/releases/tag/v1.0.0
