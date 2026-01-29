# Voyc Tauri Migration - Epic Decomposition

**Date**: 2026-01-28
**Epic**: Voyc v1.0.0 Tauri Migration
**Status**: Planning Complete

---

## Executive Summary

Migration of Voyc from GJS/GTK4 to Tauri (Rust + React) with local-first STT. This is a **brownfield migration** - we are COPYING proven code from the Handy reference implementation at `/mnt/projects/handy`, not recreating from scratch.

**Source Reference**: `/mnt/projects/handy` (Tauri 2.9.1, Rust, React)
**Target**: `/mnt/projects/voyc` (new Tauri structure)

---

## Wave Structure

```
Wave 0: Foundation (No dependencies)
├── E001: Scaffold Tauri Project Structure
└── E002: Copy & Adapt Audio Toolkit from Handy

Wave 1: Core Backend (Depends on Wave 0)
├── T001: Port AudioManager from Handy
├── T002: Port TranscriptionManager (STT)
├── T003: Port ModelManager
└── T004: Implement Tauri Commands Layer

Wave 2: Frontend Foundation (Depends on Wave 1)
├── T005: React App Shell & Routing
├── T006: Zustand Settings Store
├── T007: Specta Bindings Integration
└── T008: Tray & Overlay Windows

Wave 3: Feature Integration (Depends on Wave 2)
├── T009: Onboarding Flow
├── T010: Settings UI
├── T011: Recording Overlay
└── T012: Cloud STT Fallback

Wave 4: Polish & Packaging (Depends on Wave 3)
├── T013: Linux Packaging (AppImage, deb)
├── T014: Autostart Integration
└── T015: Final QA & Compliance Check
```

---

## Epic Details

### E001: Scaffold Tauri Project Structure

**Wave**: 0 (No dependencies)
**Size**: medium
**Phase**: setup

**Description**: Initialize Tauri 2.x project structure in Voyc, copying configuration from Handy.

**Files to Copy from Handy**:
- `src-tauri/Cargo.toml` (adapt dependencies)
- `src-tauri/tauri.conf.json` (rename to voyc)
- `src-tauri/capabilities/` (permission manifests)
- `package.json` (frontend deps)
- `vite.config.ts`
- `tailwind.config.js`
- `tsconfig.json`

**Acceptance Criteria**:
- [ ] `cargo tauri dev` starts without errors
- [ ] React frontend renders in WebView
- [ ] Specta generates `bindings.ts`

---

### E002: Copy & Adapt Audio Toolkit from Handy

**Wave**: 0 (No dependencies)
**Size**: medium
**Phase**: setup

**Description**: Copy Handy's audio_toolkit module with cpal + VAD.

**Files to Copy**:
- `src-tauri/src/audio_toolkit/` (entire directory)
  - `audio/device.rs` - Device enumeration
  - `audio/recorder.rs` - cpal stream handling
  - `audio/resampler.rs` - rubato integration
  - `vad/silero.rs` - Silero VAD
  - `vad/smoothed.rs` - VAD smoothing

**Adaptations Required**:
- Update module paths for Voyc namespace
- Remove Handy-specific features (clamshell detection optional)

**Acceptance Criteria**:
- [ ] Audio capture compiles
- [ ] VAD filters silence correctly
- [ ] Device enumeration works on Linux

---

### T001: Port AudioManager from Handy

**Wave**: 1 (Depends on E001, E002)
**Size**: medium
**Phase**: core

**Description**: Port Handy's AudioRecordingManager to Voyc.

**Files to Copy**:
- `src-tauri/src/managers/audio.rs`
- `src-tauri/src/audio_feedback.rs`

**Key Components**:
- Recording state machine (Idle/Recording)
- Microphone mode (AlwaysOn/OnDemand)
- Platform-specific muting (Linux: wpctl/pactl/amixer)
- Audio visualizer for spectrum display

**Acceptance Criteria**:
- [ ] Start/stop recording works
- [ ] Audio data captured to buffer
- [ ] Spectrum levels emitted to frontend

---

### T002: Port TranscriptionManager (STT)

**Wave**: 1 (Depends on E001, E002)
**Size**: large
**Phase**: core

**Description**: Port STT engine supporting local Whisper + cloud fallback.

**Files to Copy**:
- `src-tauri/src/managers/transcription.rs`
- `src-tauri/src/llm_client.rs` (for cloud APIs)

**Key Components**:
- transcribe-rs integration (Whisper, Parakeet, Moonshine)
- Local model loading with progress events
- Idle model unloading (configurable timeout)
- Cloud fallback when confidence < 85%

**Cloud Providers to Support**:
- ElevenLabs (xi-api-key header)
- OpenAI Whisper API

**Acceptance Criteria**:
- [ ] Local Whisper transcription works
- [ ] Model loading shows progress
- [ ] Cloud fallback triggers on low confidence
- [ ] Idle unloading functions

---

### T003: Port ModelManager

**Wave**: 1 (Depends on E001)
**Size**: medium
**Phase**: core

**Description**: Port model download and management.

**Files to Copy**:
- `src-tauri/src/managers/model.rs`

**Key Components**:
- Model registry (tiny, base, small, medium)
- Streamed download with progress
- Model directory management (~/.config/voyc/models/)
- Partial download resume

**Acceptance Criteria**:
- [ ] Model list populates
- [ ] Download shows progress
- [ ] Models stored correctly
- [ ] Resume partial downloads

---

### T004: Implement Tauri Commands Layer

**Wave**: 1 (Depends on E001, T001, T002, T003)
**Size**: medium
**Phase**: core

**Description**: Create Tauri command exports with Specta bindings.

**Files to Copy/Adapt**:
- `src-tauri/src/commands/` (entire directory)
- `src-tauri/src/lib.rs` (command exports)

**Command Categories**:
- Audio: `get_available_microphones`, `set_selected_microphone`, `start_recording`, `stop_recording`
- Models: `get_available_models`, `download_model`, `set_active_model`, `unload_model`
- Transcription: `get_model_load_status`, `transcribe`
- Settings: `get_settings`, `update_setting`

**Acceptance Criteria**:
- [ ] All commands exported via Specta
- [ ] `bindings.ts` generated correctly
- [ ] Commands callable from React

---

### T005: React App Shell & Routing

**Wave**: 2 (Depends on T004)
**Size**: medium
**Phase**: core

**Description**: Set up React frontend structure.

**Files to Copy**:
- `src/App.tsx`
- `src/main.tsx`
- `src/App.css`
- `src/components/ui/` (shadcn components)

**Structure**:
```
src/
├── App.tsx (main routing)
├── components/
│   ├── ui/ (shadcn primitives)
│   ├── settings/
│   └── onboarding/
├── stores/
└── hooks/
```

**Acceptance Criteria**:
- [ ] App renders without errors
- [ ] Basic routing works
- [ ] Tailwind styles apply

---

### T006: Zustand Settings Store

**Wave**: 2 (Depends on T004)
**Size**: medium
**Phase**: core

**Description**: Port Zustand state management.

**Files to Copy**:
- `src/stores/settingsStore.ts`
- `src/stores/modelStore.ts`

**Store Features**:
- Settings sync with Rust backend
- Audio device state
- Model download progress
- Recording state

**Acceptance Criteria**:
- [ ] Settings persist to backend
- [ ] UI reflects backend state
- [ ] Real-time updates work

---

### T007: Specta Bindings Integration

**Wave**: 2 (Depends on T004)
**Size**: small
**Phase**: core

**Description**: Integrate auto-generated TypeScript bindings.

**Files**:
- `src/bindings.ts` (auto-generated)
- Type imports in components

**Acceptance Criteria**:
- [ ] All Rust types available in TypeScript
- [ ] Command invocations type-safe
- [ ] Event listeners typed

---

### T008: Tray & Overlay Windows

**Wave**: 2 (Depends on T005, T006)
**Size**: medium
**Phase**: core

**Description**: Implement system tray and recording overlay.

**Files to Copy**:
- `src/overlay/` (recording overlay)
- Tray setup in `src-tauri/src/lib.rs`

**Tray States**:
- Idle (gray microphone)
- Listening (red microphone)
- Processing (spinner)

**Overlay Features**:
- Floating window showing recording state
- Audio spectrum visualization
- Configurable position

**Acceptance Criteria**:
- [ ] Tray icon shows correct state
- [ ] Tray menu functional
- [ ] Overlay appears during recording

---

### T009: Onboarding Flow

**Wave**: 3 (Depends on T005, T006, T007)
**Size**: medium
**Phase**: core

**Description**: First-run setup wizard.

**Files to Copy**:
- `src/components/onboarding/`

**Steps**:
1. Accessibility permissions (if needed)
2. Model selection/download
3. API key entry (for cloud fallback)
4. Done

**Acceptance Criteria**:
- [ ] Onboarding shows on first run
- [ ] Model download works
- [ ] API keys stored securely

---

### T010: Settings UI

**Wave**: 3 (Depends on T005, T006, T007)
**Size**: medium
**Phase**: core

**Description**: Settings panel implementation.

**Files to Copy**:
- `src/components/settings/`
- `src/components/Sidebar.tsx`

**Settings Sections**:
- Audio (device selection, VAD threshold)
- STT (provider, model, cloud fallback threshold)
- Hotkeys (toggle dictation, terminal paste)
- General (autostart, update check)

**Acceptance Criteria**:
- [ ] All settings accessible
- [ ] Changes persist immediately
- [ ] Hotkey picker works

---

### T011: Recording Overlay

**Wave**: 3 (Depends on T008)
**Size**: small
**Phase**: core

**Description**: Polish recording overlay UI.

**Files**:
- `src/overlay/RecordingOverlay.tsx`
- `src/overlay/main.tsx`

**Features**:
- Recording indicator
- Audio spectrum bars
- Position configuration

**Acceptance Criteria**:
- [ ] Overlay shows during recording
- [ ] Spectrum animates with audio
- [ ] Position configurable

---

### T012: Cloud STT Fallback

**Wave**: 3 (Depends on T002, T006)
**Size**: medium
**Phase**: core

**Description**: Implement confidence-based cloud fallback.

**Logic**:
1. Local STT runs first
2. If confidence < threshold (default 85%), trigger cloud
3. Use cloud result if available

**Cloud Providers**:
- ElevenLabs (POST /v1/speech-to-text)
- OpenAI (POST /v1/audio/transcriptions)

**Acceptance Criteria**:
- [ ] Fallback triggers on low confidence
- [ ] Threshold configurable
- [ ] Both providers work

---

### T013: Linux Packaging

**Wave**: 4 (Depends on all Wave 3)
**Size**: medium
**Phase**: polish

**Description**: Create Linux distribution packages.

**Formats**:
- AppImage (distro-agnostic)
- .deb (Debian/Ubuntu)
- Flatpak (future)

**Files**:
- `AppImageBuilder.yml`
- `voyc.desktop`

**Acceptance Criteria**:
- [ ] AppImage runs on Fedora
- [ ] Desktop entry shows in app menu
- [ ] Icons display correctly

---

### T014: Autostart Integration

**Wave**: 4 (Depends on T013)
**Size**: small
**Phase**: polish

**Description**: XDG autostart integration.

**Implementation**:
- tauri-plugin-autostart
- Desktop entry in `~/.config/autostart/`

**Acceptance Criteria**:
- [ ] Toggle in settings works
- [ ] App starts on login when enabled
- [ ] No duplicate instances

---

### T015: Final QA & Compliance Check

**Wave**: 4 (Depends on all prior tasks)
**Size**: medium
**Phase**: polish

**Description**: Verify all REQ-001 through REQ-025 and CON-001 through CON-005.

**Checklist**:
- [ ] REQ-001: Tray start/stop control
- [ ] REQ-002: Provider configuration
- [ ] REQ-003: Local config persistence
- [ ] REQ-004: cpal audio capture
- [ ] REQ-005: Device selection
- [ ] REQ-006 through REQ-010: STT providers
- [ ] REQ-011 through REQ-013: Post-processing
- [ ] REQ-014-015: Wayland-safe injection + hotkeys
- [ ] REQ-016-017: Latency tracking
- [ ] REQ-018-020: Privacy requirements
- [ ] REQ-021-025: Local STT, VAD, cross-platform

**Acceptance Criteria**:
- [ ] All requirements verified
- [ ] All constraints enforced
- [ ] Ready for release

---

## Dependency Graph

```
E001 ─────┬───────────────────────────────────────┐
          │                                       │
E002 ─────┼──┬─ T001 ──┬─ T004 ──┬─ T005 ──┬─ T009 ──┬─ T013 ──┬─ T015
          │  │         │         │         │         │         │
          │  ├─ T002 ──┤         ├─ T006 ──┼─ T010 ──┤         │
          │  │         │         │         │         │         │
          │  └─ T003 ──┘         ├─ T007 ──┤         │         │
          │                      │         │         │         │
          └──────────────────────┴─ T008 ──┴─ T011 ──┤         │
                                           │         │         │
                                           └─ T012 ──┴─ T014 ──┘
```

---

## Key Files to Copy from Handy

| Handy Path | Voyc Path | Purpose |
|------------|-----------|---------|
| `src-tauri/Cargo.toml` | `src-tauri/Cargo.toml` | Rust dependencies |
| `src-tauri/src/audio_toolkit/` | `src-tauri/src/audio_toolkit/` | Audio + VAD |
| `src-tauri/src/managers/` | `src-tauri/src/managers/` | Core managers |
| `src-tauri/src/commands/` | `src-tauri/src/commands/` | Tauri IPC |
| `src/stores/` | `src/stores/` | Zustand state |
| `src/components/` | `src/components/` | React UI |
| `src/overlay/` | `src/overlay/` | Recording overlay |

---

## Estimated Scope

| Wave | Task Count | Complexity |
|------|------------|------------|
| Wave 0 | 2 epics | medium |
| Wave 1 | 4 tasks | large (core backend) |
| Wave 2 | 4 tasks | medium |
| Wave 3 | 4 tasks | medium |
| Wave 4 | 3 tasks | small-medium |

**Total**: 17 work items across 5 waves

---

## References

- PRD: `/mnt/projects/voyc/claudedocs/prd.md`
- Spec: `/mnt/projects/voyc/docs/specs/VOICE_DICTATION_APP.md`
- Handy Reference: `/mnt/projects/handy`
