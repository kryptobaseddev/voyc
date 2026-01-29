# Voyc Crash Investigation Handoff

**Date**: 2026-01-29
**Issue**: App crashes immediately on startup, causes system lag

---

## Symptoms

1. App opens briefly then crashes
2. System becomes slow/laggy when app starts
3. Possible memory leak

## Last Known Good State

The app was initializing successfully (logs showed):
- ModelManager initialized
- TranscriptionManager initialized
- AudioRecordingManager initialized
- HotkeyManager initialized
- DictationController initialized
- System tray initialized
- Recording overlay created
- "Application setup complete"

Then crashes after displaying the window.

## Recent Changes That May Cause Issue

1. **Overlay window changes** (`src-tauri/src/overlay.rs`):
   - Removed `always_on_top(true)` from builder
   - Added `set_always_on_top(true)` at show time
   - Added 100ms Wayland delay

2. **New settings fields** (`src-tauri/src/settings.rs`):
   - `vad_threshold: f32`
   - `post_process_enabled: bool`
   - `post_process_api_key: String`
   - `post_process_provider: String`

3. **Latency metrics** (`src-tauri/src/dictation.rs`):
   - Added `LatencyMetrics` struct
   - Added `Instant` timing throughout `stop_dictation`

4. **Frontend changes**:
   - New tabs: History, Debug, Privacy, About
   - New components: PushToTalkToggle, VadThresholdSlider, PostProcessingSettings
   - Updated AppSettings interface in settingsStore.ts

## Likely Culprits

1. **Memory leak in overlay creation** - The overlay might be recreating or not properly managing WebView resources

2. **Settings store mismatch** - TypeScript AppSettings may not match Rust AppSettings, causing serialization issues

3. **Infinite loop in React components** - New components may have useEffect loops

4. **Model manager resource exhaustion** - Whisper model loading may be consuming too much memory

## Debug Commands for Next Session

```bash
# Run with debug output
RUST_LOG=debug /mnt/projects/voyc/src-tauri/target/release/voyc 2>&1 | tee voyc-debug.log

# Run with memory tracking
valgrind --leak-check=full /mnt/projects/voyc/src-tauri/target/release/voyc

# Check for core dumps
coredumpctl list | tail -5

# Monitor memory while running
watch -n 1 'ps aux | grep voyc'
```

## Files to Investigate

| File | Reason |
|------|--------|
| `src-tauri/src/overlay.rs` | Window creation changes |
| `src-tauri/src/lib.rs:260-270` | Overlay creation timing |
| `src-tauri/src/managers/model.rs` | Model loading memory |
| `src/stores/settingsStore.ts` | AppSettings interface |
| `src/components/settings/*.tsx` | New components with useEffect |

## Git Status

- 97 files changed (NOT committed)
- No remote configured
- Code should NOT be committed until crash is fixed

## Resume Commands

```bash
# Check for crashes
coredumpctl list | grep voyc

# Run with backtrace
RUST_BACKTRACE=1 /mnt/projects/voyc/src-tauri/target/release/voyc

# Build debug version for better stack traces
cargo build --manifest-path src-tauri/Cargo.toml
./src-tauri/target/debug/voyc
```
