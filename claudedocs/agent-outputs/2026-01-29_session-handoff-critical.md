# Voyc Session Handoff - CRITICAL ISSUES

**Date**: 2026-01-29
**Session**: Crash fix + Icons + Frontend bundling
**Status**: PARTIALLY COMPLETE - 2 CRITICAL ISSUES REMAIN

---

## Issues Fixed This Session

### 1. Wayland Crash (Gdk Error 71) - FIXED ✓
- **Root Cause**: WebKitGTK/NVIDIA explicit sync incompatibility
- **Fix**: Added `__NV_DISABLE_EXPLICIT_SYNC=1` in `src-tauri/src/main.rs`
- **Reference**: https://github.com/tauri-apps/tauri/issues/10702
- App no longer crashes on startup

### 2. Tray Icon States - PARTIALLY DONE
- Added new states: `Error`, `Off` to `TrayIconState` enum
- Copied icons to resources:
  - `tray_active.png` (happy face, green) - for Recording/Transcribing
  - `tray_idle.png` (bored face, yellow) - for Idle
  - `tray_error.png` (sad face, red) - for Error
  - `tray_off.png` (dead face, grey) - for Off
- Updated `get_icon_path()` and `update_tray_menu()` in `src-tauri/src/tray.rs`

---

## CRITICAL ISSUES REMAINING

### Issue 1: "Could not connect to localhost: Connection refused"
**Symptom**: App window shows this error instead of the UI
**Cause**: Frontend assets not being bundled into the binary
**Investigation Notes**:
- `cargo build --release` alone does NOT bundle frontend
- Need to use `tauri build` OR proper environment
- Shell has corrupt `gettext` hooks causing `tauri build` to fail
- Workaround: Build with clean env: `env -i HOME=/home/keatonhoskins PATH=/usr/bin:/bin:/home/keatonhoskins/.bun/bin:/home/keatonhoskins/.cargo/bin bash -c 'cd /mnt/projects/voyc && bun run build && cd src-tauri && cargo build --release'`

**HOWEVER**: Even after clean build, frontend still not loading. Need to investigate:
1. Check if `frontendDist` in tauri.conf.json is being read
2. Check if build.rs is embedding assets
3. May need to run `tauri build` (fix gettext issue first)

### Issue 2: Wrong Tray Icon (shows "hand" instead of custom icons)
**Symptom**: Tray shows old Handy icon, not new Voyc icons
**Cause**: Resources not being bundled/updated in binary
**Fix Needed**:
1. Ensure `resources/tray_*.png` files are in bundle
2. Check `tauri.conf.json` resources config
3. May need clean rebuild with `tauri build`

---

## Files Modified This Session

| File | Changes |
|------|---------|
| `src-tauri/src/main.rs` | Added NVIDIA explicit sync workaround |
| `src-tauri/src/overlay.rs` | Restored `always_on_top(true)` at build time |
| `src-tauri/src/lib.rs` | Removed unnecessary Wayland delay, added specta import |
| `src-tauri/src/tray.rs` | Added Error/Off states, updated icon paths |
| `src-tauri/src/managers/transcription.rs` | Removed unused import |
| `src-tauri/resources/` | Added tray_active.png, tray_idle.png, tray_error.png, tray_off.png |

---

## Build Commands

### Clean Build (recommended):
```bash
env -i HOME=/home/keatonhoskins PATH=/usr/bin:/bin:/home/keatonhoskins/.bun/bin:/home/keatonhoskins/.cargo/bin:/home/keatonhoskins/.local/bin TERM=xterm bash -c 'cd /mnt/projects/voyc && bun run build && cd src-tauri && cargo build --release'
```

### Install:
```bash
cp /mnt/projects/voyc/src-tauri/target/release/voyc ~/.local/bin/voyc
```

### Run with debug logs:
```bash
RUST_LOG=debug ~/.local/bin/voyc 2>&1 | tee /tmp/voyc-debug.log
```

---

## Future Tasks (NOT in CLEO yet - need to add)

1. **T041**: Fix frontend bundling - "Could not connect to localhost"
   - Priority: CRITICAL
   - Investigate why assets not embedded

2. **T042**: Fix tray icon not showing custom icons
   - Priority: HIGH
   - Ensure resources bundled properly

3. **T043**: Add transcribing icon spin animation
   - Priority: MEDIUM
   - Frontend concern - CSS animation on tray icon change event

4. **T044**: Implement Error/Off tray states with UI
   - Priority: LOW (future)
   - Error = red sad face, Off = grey dead face

---

## Debug Information

### App runs without crash ✓
```
[voyc_app_lib][INFO] Initializing managers...
[voyc_app_lib][INFO] ModelManager initialized
[voyc_app_lib][INFO] TranscriptionManager initialized
[voyc_app_lib][INFO] AudioRecordingManager initialized
[voyc_app_lib][INFO] HotkeyManager initialized
[voyc_app_lib][INFO] DictationController initialized
[voyc_app_lib][INFO] System tray initialized
[voyc_app_lib][INFO] Recording overlay created
[voyc_app_lib][INFO] Application setup complete
```

### Frontend Issue
Window shows: "Could not connect to localhost: Connection refused"
This means WebView is trying to load from devUrl (http://localhost:1420) instead of embedded assets.

---

## Research Documents Created

- `/mnt/projects/voyc/claudedocs/agent-outputs/2026-01-28_wayland-crash-research.md` - Crash root cause analysis
- `/mnt/projects/voyc/claudedocs/agent-outputs/2026-01-29_session-handoff-critical.md` - This document

---

## Next Session Priority

1. **FIRST**: Fix frontend bundling (without this, app is unusable)
2. **SECOND**: Fix tray icons
3. **THEN**: Address remaining polish items
