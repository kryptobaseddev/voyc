# Autostart and Background Lifecycle Implementation (T017)

**Date:** 2026-01-27  
**Task:** T017  
**Epic:** T001  

## Summary

Implemented XDG autostart management and background application lifecycle for Voyc voice dictation application. This includes desktop entry management, single instance enforcement via DBus, graceful shutdown handling, and integration with the existing configuration and UI systems.

## Implementation Details

### 1. Autostart.ts - XDG Autostart Management

**Location:** `src/startup/Autostart.ts`

Manages XDG autostart desktop entry creation and removal:

- **XDG Compliance:** Uses `~/.config/autostart/` directory per XDG Base Directory Specification
- **Desktop Entry Generation:** Creates valid `.desktop` files with proper Exec, Icon, and autostart metadata
- **State Management:** 
  - `isEnabled()` - Check if autostart is currently active
  - `enable()` - Create desktop entry
  - `disable()` - Remove desktop entry
  - `toggle()` - Switch between states
  - `syncWithConfig()` - Ensure desktop entry matches config preference
- **Path Detection:** Automatically detects installed vs development paths for Exec line
- **Icon Resolution:** Searches standard icon paths, falls back to icon name

**Key Features:**
- Handles `X-GNOME-Autostart-enabled` and `Hidden` keys for state checking
- Sets executable permissions on desktop entry (some DEs require this)
- Graceful fallbacks for development vs installed execution paths

### 2. Lifecycle.ts - Background Lifecycle Manager

**Location:** `src/startup/Lifecycle.ts`

Manages application lifecycle with single instance enforcement:

- **Single Instance Enforcement:** Uses DBus well-known name ownership (`com.voyc.App`)
- **DBus Interface:** Exposes methods for remote control:
  - `ShowSettings()` - Request settings window display
  - `ToggleDictation()` - Remote dictation toggle
  - `Quit()` - Graceful shutdown request
  - Properties: `Version`, `IsDictating`
- **Signal Handling:**
  - `SIGTERM` - Graceful shutdown
  - `SIGINT` (Ctrl+C) - Graceful shutdown
  - `SIGHUP` - Configuration reload
- **Lifecycle States:** `starting` → `running` → `background`/`foreground` → `shutting-down`
- **Background Mode Integration:** Works with TrayIndicator for minimize-to-tray functionality

**Key Features:**
- GObject-based with signals for state changes
- Remote instance communication (second instance can control first)
- Clean separation between lifecycle management and UI

### 3. voyc.desktop - Desktop Entry Template

**Location:** `voyc.desktop`

Template desktop entry file for reference and packaging:

```ini
[Desktop Entry]
Type=Application
Name=Voyc
Comment=Voice dictation for Linux
Exec=/usr/bin/gjs /path/to/dist/main.js
Icon=voyc
Terminal=false
X-GNOME-Autostart-enabled=true
StartupNotify=false
Categories=Utility;Audio;
Keywords=dictation;voice;speech;stt;
```

### 4. SettingsWindow Integration

**Updated:** `src/ui/SettingsWindow.ts`

- Added optional `Autostart` parameter to constructor
- Autostart toggle now syncs desktop entry with config preference
- When user toggles autostart, both config and desktop entry are updated

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Startup                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 LifecycleManager.init()                      │
│              (Attempt DBus name ownership)                   │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐      ┌─────────────────────────┐
│   Name Acquired         │      │   Name Already Owned    │
│   (First Instance)      │      │   (Another Running)     │
└─────────────────────────┘      └─────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐      ┌─────────────────────────┐
│  Continue Startup       │      │  Call Remote Method     │
│  - Setup signals        │      │  - ShowSettings()       │
│  - Create tray          │      │  OR                     │
│  - Enter main loop      │      │  - ToggleDictation()    │
└─────────────────────────┘      │  Then exit              │
                                 └─────────────────────────┘
```

## Integration Points

### With Config System (T007)
- `ConfigManager.autostart` boolean controls default behavior
- `Autostart.syncWithConfig()` ensures desktop entry matches config
- Settings UI toggle updates both config and desktop entry

### With Tray UI (T010)
- `LifecycleManager.setTrayIndicator()` connects lifecycle with tray
- Background mode minimizes to tray (state: `background`)
- Foreground mode restores window (state: `foreground`)

### With Main Application
- Second instance detection prevents multiple Voyc processes
- Remote commands allow single-instance behavior
- Graceful shutdown ensures cleanup

## Usage Examples

### Enable Autostart
```typescript
const autostart = new Autostart();
autostart.enable();  // Creates ~/.config/autostart/voyc.desktop
```

### Check Single Instance
```typescript
const lifecycle = new LifecycleManager(configManager, callbacks);
if (!lifecycle.init()) {
    // Another instance is running
    lifecycle.notifyShowSettings();
    System.exit(0);
}
```

### Handle Lifecycle Events
```typescript
const callbacks: LifecycleCallbacks = {
    onShowSettings: () => settingsWindow.show(),
    onToggleDictation: () => dictationManager.toggle(),
    onShutdown: () => {
        audioCapture.stop();
        trayIndicator.destroy();
    },
    onStateChange: (state) => {
        console.log(`State changed to: ${state}`);
    }
};
```

## Acceptance Criteria Status

| Criteria | Status | Notes |
|----------|--------|-------|
| Desktop entry created in XDG autostart dir | ✅ | `Autostart.enable()` creates entry |
| Autostart toggle in settings works | ✅ | SettingsWindow integrated with Autostart |
| Single instance enforced via DBus | ✅ | `LifecycleManager` uses DBus name ownership |
| Graceful shutdown on signals | ✅ | SIGTERM, SIGINT handlers implemented |
| Background mode minimizes to tray | ✅ | Lifecycle states + TrayIndicator integration |
| JSDoc provenance tags on all code | ✅ | All files have `@task T017` and `@epic T001` |

## Files Created/Modified

### New Files
- `src/startup/Autostart.ts` - XDG autostart management
- `src/startup/Lifecycle.ts` - Background lifecycle manager
- `src/startup/index.ts` - Module exports
- `voyc.desktop` - Desktop entry template

### Modified Files
- `src/ui/SettingsWindow.ts` - Integrated autostart toggle with desktop entry

## Dependencies

- **Gio** - File operations, DBus
- **GLib** - Paths, signal handling, process info
- **GObject** - Signal emission for lifecycle events
- **Config module (T007)** - Configuration persistence
- **UI module (T010)** - Tray indicator integration

## Notes

1. **DBus Availability:** Single instance enforcement requires a running DBus session. If DBus is unavailable, the application will start (fallback behavior).

2. **Desktop Entry Paths:** The Exec path is auto-detected but may need adjustment for specific installation methods (Flatpak, AppImage, etc.).

3. **Signal Handling:** Unix signals are handled via GLib's `UnixSignalSource`, which integrates with the main loop.

4. **Testing:** To test single instance, run the application twice. The second instance should trigger the first to show settings (or toggle dictation, depending on implementation).
