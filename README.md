# Voyc

Fast, minimal voice dictation app for Linux (X11 and Wayland).

## Features

- **Multiple transcription models**: Whisper, Parakeet, and Moonshine support
- **Global hotkeys**: Native Wayland support via XDG Desktop Portal
- **System tray**: Quick access with status indicators
- **Clipboard integration**: Automatic copy of transcribed text
- **Cross-desktop support**: GNOME, KDE Plasma, and other Wayland compositors

## Installation

### Pre-built Packages

Download the latest release from [GitHub Releases](https://github.com/kryptobaseddev/voyc/releases):

- `.deb` for Debian/Ubuntu
- `.rpm` for Fedora/RHEL
- `.AppImage` for portable use (see [AppImage Note](#appimage-note) below)

### Local Installation (Recommended for AppImage)

For a fully integrated installation without requiring FUSE or sudo:

```bash
# Clone and build
git clone https://github.com/kryptobaseddev/voyc.git
cd voyc
bun install
bun run build:release

# Install locally (no sudo required)
./scripts/install-local.sh
```

This installs Voyc to `~/.local/share/Voyc/` with:
- Binary symlink at `~/.local/bin/voyc`
- Desktop entry in application menu
- Proper icon integration

To uninstall: `./scripts/install-local.sh --remove`

### AppImage Note

AppImages require FUSE to run directly. If you see an error like:

```
dlopen(): error loading libfuse.so.2
AppImages require FUSE to run.
```

You have three options:

1. **Install FUSE** (requires sudo):
   ```bash
   # Fedora
   sudo dnf install fuse-libs

   # Ubuntu/Debian
   sudo apt install fuse
   ```

2. **Use the local installer** (recommended, no sudo):
   ```bash
   ./scripts/install-local.sh
   ```

3. **Run with extract-and-run flag** (temporary, no installation):
   ```bash
   ./Voyc_1.0.0_amd64.AppImage --appimage-extract-and-run
   # Or use the wrapper script:
   ./scripts/run-appimage.sh
   ```

### Build from Source

#### Prerequisites

- [Bun](https://bun.sh) or Node.js 18+
- [Rust](https://rustup.rs) toolchain
- Linux development libraries:

**Fedora:**
```bash
sudo dnf install gtk3-devel webkit2gtk4.1-devel libappindicator-gtk3-devel
```

**Ubuntu/Debian:**
```bash
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev
```

#### Build

```bash
# Install dependencies
bun install

# Development mode
bun run tauri dev

# Production build (all packages)
bun run build:release

# Build specific package
bun run build:deb
bun run build:rpm
bun run build:binary
```

## Development

```bash
# Start development server with hot reload
bun run tauri dev

# Type checking
bun run build

# Linting
bun run lint
bun run lint:fix

# Formatting
bun run format
```

## Versioning and Releases

Voyc follows [Semantic Versioning](https://semver.org/). Version is tracked in:
- `VERSION` (single source of truth)
- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

### Version Management

```bash
# Bump version (dry-run to preview)
bun run version:patch --dry-run   # 1.0.0 -> 1.0.1
bun run version:minor --dry-run   # 1.0.0 -> 1.1.0
bun run version:major --dry-run   # 1.0.0 -> 2.0.0

# Generate changelog preview
bun run changelog
```

### Release Process

```bash
# Full release (bump, changelog, commit, tag, build)
./scripts/release.sh patch

# Quick release without build
bun run release:patch
bun run release:minor
bun run release:major

# Release with push
./scripts/release.sh minor --push

# Preview changes
./scripts/release.sh patch --dry-run
```

## Project Structure

```
voyc/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── stores/             # Zustand state management
│   └── App.tsx             # Main application
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # Tauri setup
│   │   ├── managers/       # Feature managers
│   │   └── commands/       # IPC commands
│   └── Cargo.toml
├── scripts/                # Build and release scripts
├── VERSION                 # Version source of truth
├── CHANGELOG.md            # Release history
└── package.json
```

## Tech Stack

- **Tauri 2.x**: Native app framework
- **React 18**: Frontend UI
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Styling
- **Rust**: Backend and system integration
- **transcribe-rs**: ML transcription models

## License

MIT
