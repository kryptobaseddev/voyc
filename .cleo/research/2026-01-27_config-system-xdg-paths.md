# Config System + XDG Paths + Provider Schema Research

**Date**: 2026-01-27  
**Task**: T007  
**Epic**: T001  

## Summary

Implemented a complete configuration system for Voyc with XDG-compliant paths, provider schema, and GObject signal-based change notifications.

## Implementation Details

### 1. XDG Path Utilities (`src/config/paths.ts`)

Uses GLib.get_user_config_dir() for GJS compatibility:
- `getConfigDir()`: Returns `$XDG_CONFIG_HOME/voyc`
- `getConfigFilePath()`: Returns path to `config.json`
- `getDataDir()`: Returns `$XDG_DATA_HOME/voyc`
- `getCacheDir()`: Returns `$XDG_CACHE_HOME/voyc`
- `ensureDir()`: Creates directories with proper permissions
- `fileExists()`: Checks file existence

### 2. Provider Schema (`src/config/schema.ts`)

Configuration interface supporting:
- **Providers**: `elevenlabs` (default), `openai`, `baseten`
- **API Keys**: Separate keys for each provider
- **Endpoints**: Configurable endpoints for each provider
- **App Settings**: silenceTimeout (0/30/60), autostart
- **Hotkeys**: toggleDictation, pasteAsTerminal
- **Audio**: Device selection (null = default)
- **Privacy**: enablePostProcessing, logTranscripts

Validation functions:
- `isValidProvider()`: Type guard for providers
- `isValidSilenceTimeout()`: Validates timeout values
- `validateConfig()`: Merges partial config with defaults
- `hasValidApiKey()`: Checks if selected provider has key
- `getCurrentApiKey()`: Returns key for active provider
- `getCurrentEndpoint()`: Returns endpoint for active provider

### 3. ConfigManager (`src/config/Config.ts`)

GObject-based class with signals:
- **Signals**: `changed`, `provider-changed`, `hotkeys-changed`
- **Methods**: load(), save(), scheduleSave(), update(), reset()
- **Setters**: Individual setters for each config property
- **Auto-save**: Deferred save with 500ms debounce

### 4. Module Exports (`src/config/index.ts`)

Clean barrel export for all config modules.

### 5. Tests (`tests/config.test.ts`)

Comprehensive test coverage:
- Path utilities (6 tests)
- Schema validation (14 tests)
- ConfigManager functionality (7 tests)
- Signal emission (3 tests)

**Total: 30 tests**

## Compliance

- ✓ XDG Base Directory Specification compliant
- ✓ GLib/GIO for file I/O
- ✓ GObject signals for change notification
- ✓ TypeScript with strict typing
- ✓ JSDoc provenance tags on all code
- ✓ ElevenLabs as default provider (REQ-006)
- ✓ API keys stored locally only (REQ-003)

## Files Created

1. `src/config/paths.ts` - XDG path utilities
2. `src/config/schema.ts` - Config interface and validation
3. `src/config/Config.ts` - ConfigManager class with signals
4. `src/config/index.ts` - Module exports
5. `tests/config.test.ts` - Test suite
6. `.cleo/research/2026-01-27_config-system-xdg-paths.md` - This document

## Acceptance Criteria Status

- [x] Config loads from XDG path on startup
- [x] Config saves to XDG path on changes
- [x] Default config created if missing
- [x] Provider schema validates API keys and endpoints
- [x] Config changes emit signals (GObject SignalEmitter)
- [x] JSDoc provenance tags on all code
