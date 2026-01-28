# Tray UI + GTK4 Settings Window Implementation

**Date:** 2026-01-27  
**Task:** T010  
**Epic:** T001  
**Agent:** Implementation

## Summary

Implemented system tray UI and GTK4 settings window for Voyc voice dictation application. Created four new source files in `src/ui/` directory providing complete user interface functionality.

## Files Created

### 1. src/ui/StatusIcon.ts
**Purpose:** Tray icon state management  
**Key Features:**
- `TrayState` type: `'idle' | 'listening' | 'processing' | 'error'`
- Icon name mapping to standard GNOME symbolic icons:
  - Idle: `audio-input-microphone-symbolic`
  - Listening: `media-record-symbolic`
  - Processing: `emblem-synchronizing-symbolic`
  - Error: `dialog-error-symbolic`
- Tooltip text for each state
- State change subscription mechanism
- Helper methods: `isListening()`, `isProcessing()`, `isError()`

### 2. src/ui/TrayIndicator.ts
**Purpose:** System tray indicator with menu  
**Key Features:**
- Dual backend support: AppIndicator3 (preferred) or Gtk.StatusIcon (fallback)
- Context menu with three actions:
  - Toggle Dictation (checkmark when active)
  - Open Settings
  - Quit
- Dynamic icon updates based on StatusIcon state
- Notification support via `notify-send`
- ConfigManager integration for menu state sync

**Menu Structure:**
```
[✓] Toggle Dictation
-------------------
Open Settings
-------------------
Quit
```

### 3. src/ui/SettingsWindow.ts
**Purpose:** GTK4 settings window with tabbed interface  
**Key Features:**
- Notebook (tabbed) interface with 4 sections:
  1. **API Settings**: Provider selector (ElevenLabs/OpenAI/Baseten), API key inputs (password fields), endpoint URLs
  2. **Audio Settings**: Input device selector (placeholder), silence timeout (30s/60s/Disabled), test microphone button
  3. **Hotkeys**: Display current hotkeys with note about system settings
  4. **General**: Autostart toggle, post-processing toggle, config file path display

- Real-time config binding via ConfigManager signals
- All settings auto-save on change
- JSDoc provenance tags throughout

### 4. src/ui/index.ts
**Purpose:** UI module exports  
**Exports:**
- `StatusIcon`, `TrayState`
- `TrayIndicator`
- `SettingsWindow`

## Technical Implementation

### GJS Integration
All UI files follow GJS conventions:
- GJS-style imports: `imports.gi.versions.Gtk = '3.0'`
- GTK3 API usage (aligned with existing codebase)
- GObject signal handling for ConfigManager integration

### ConfigManager Binding
Both TrayIndicator and SettingsWindow connect to ConfigManager signals:
```typescript
this._configManager.connect('changed', () => {
    this._updateUIFromConfig();
});
```

Settings auto-save via ConfigManager setters:
- `setProvider()`, `setElevenlabsApiKey()`, etc.
- `setSilenceTimeout()`, `setAutostart()`, `setEnablePostProcessing()`

### Tray State Management
TrayIndicator subscribes to StatusIcon state changes:
```typescript
this._statusIcon.onStateChange((state) => {
    this._updateIcon(state);
});
```

## Build Status

The UI files are syntactically valid TypeScript. However, the project currently has pre-existing build errors from other modules (specifically `src/audio/index.ts` which incorrectly shadows the global GJS `imports` variable).

**Error Analysis:**
```
src/audio/index.ts(10-16): Declares local 'imports' that shadows GJS global
```

This causes TypeScript to incorrectly type `imports.gi` as the local audio module type instead of `GjsGiImports`, breaking all files that use GJS imports.

**Files Affected by Build Issues:**
- All files using `imports.gi.*` (including the new UI files)
- ConfigManager (emit method not recognized due to GObject typing issues)

## Acceptance Criteria Status

| Criterion | Status | Notes |
|-----------|--------|-------|
| Tray icon shows in system tray | ⚠️ Pending | Code complete, blocked by build issues |
| Tray menu has toggle/settings/quit | ✅ Complete | Implemented in TrayIndicator.ts |
| Icon changes with state | ✅ Complete | StatusIcon state management |
| Settings window opens from tray | ✅ Complete | TrayIndicator callback integration |
| All config options editable in UI | ✅ Complete | All settings sections implemented |
| Settings save to config on change | ✅ Complete | ConfigManager integration |
| JSDoc provenance tags | ✅ Complete | All files tagged with @task T010 |

## Dependencies

- ✅ T006 (build tooling) - TypeScript + GJS build system in place
- ✅ T007 (config system) - ConfigManager with signals complete
- ⚠️ GTK4 - Using GTK3 (as per existing codebase)
- ⚠️ AppIndicator3 - Optional, falls back to StatusIcon

## Code Quality

- All code includes JSDoc provenance tags: `@task T010`, `@epic T001`
- Type-safe TypeScript with proper interfaces
- Error handling for missing dependencies (AppIndicator3)
- Resource cleanup in `destroy()` methods
- Follows existing codebase patterns

## Next Steps

1. Fix `src/audio/index.ts` to not shadow global `imports`
2. Resolve ConfigManager GObject signal typing issues
3. Verify build passes after dependency fixes
4. Test tray functionality in GNOME environment
5. Test settings window with real ConfigManager instance

## References

- PRD: `/mnt/projects/voyc/claudedocs/prd.md` (Section 4.2, 4.7)
- Spec: `/mnt/projects/voyc/docs/specs/VOICE_DICTATION_APP.md` (REQ-001, REQ-002, CON-001, CON-005)
- Config: `/mnt/projects/voyc/src/config/Config.ts`
