## Voyc – Product Requirements Document (PRD)

### 1. Overview

Voyc is a fast, minimal, GNOME-native voice dictation app for Linux Wayland.
You toggle dictation via hotkey or tray button, speak, and text appears in the currently focused app.
Accuracy and speed matter more than formatting.

Primary platform: Fedora 43 GNOME on Wayland, with macOS/Windows planned
Tech stack: Tauri (Rust backend + React frontend)

---

### 2. Goals

* Near-perfect transcription accuracy
* Sub-second perceived latency from stop speaking to text insertion
* Native GNOME UX that feels first-party
* One codebase for Linux, Windows, and macOS (via Tauri)
* Ship v1 in hours, not weeks
* Offline mode via local Whisper

Non-goals for v1:

* Advanced punctuation rules
* Inline correction UI

---

### 3. Core User Flow

1. Voyc auto-starts on login and sits in tray
2. User presses global hotkey or clicks tray button
3. Tray icon switches to “Listening”
4. User speaks
5. Silence detected or user toggles off
6. Audio sent to STT
7. Text injected into focused app
8. Tray returns to idle

---

### 4. Functional Requirements

#### 4.1 Global Hotkeys

* Implement via `org.freedesktop.portal.GlobalShortcuts`
* Required shortcuts:

  * Toggle Dictation
  * Paste as Terminal (Ctrl+Shift+V path)
* Hotkeys must be configurable via settings UI
* Must work on GNOME Wayland without shell hacks

#### 4.2 Tray Application

* GTK4 AppIndicator style tray icon
* States:

  * Idle
  * Listening
  * Processing
* Tray menu:

  * Toggle dictation
  * Open settings
  * Quit

#### 4.3 Audio Capture

* Use cpal (Rust, cross-platform audio library)
* Record from system default microphone
* Capture to memory buffer
* Format: WAV 16-bit PCM, mono
* No disk writes in v1
* Note: On Linux, cpal uses PipeWire/PulseAudio backend automatically

#### 4.4 Silence Detection

* Configurable silence timeout

  * Options: 30s, 60s, Disabled
* Simple RMS threshold based detection
* Silence stops recording automatically

#### 4.5 Speech-to-Text

Primary provider:

* Local Whisper via whisper-rs (offline, privacy-first)

Secondary/fallback providers:

* ElevenLabs STT (cloud)
* OpenAI Speech-to-Text (cloud)

Provider abstraction:

```
transcribe(audioBuffer): Promise<string>
```

Model selection UI for local Whisper:

* tiny (fastest, lower accuracy)
* base
* small
* medium (slowest, highest accuracy)

API keys for cloud providers stored in user config, never hardcoded

#### 4.6 Text Injection

Wayland-safe method only

Primary path:

1. Copy text to clipboard
2. Detect target context
3. Inject paste shortcut

Paste logic:

* Default apps: Ctrl+V
* Terminal apps: Ctrl+Shift+V

Terminal detection:

* Active window class and known terminal list
* Manual override hotkey for terminal paste

Injection tool:

* `ydotool` via uinput

#### 4.7 Settings UI

Single GTK4 window, minimal design

Settings:

* API key input
* Hotkey picker
* Silence timeout selector
* Autostart on login toggle
* STT provider selector (hidden advanced toggle)

---

### 5. UX and UI Requirements

* Clean GNOME HIG-aligned UI
* No clutter
* One settings window only
* Clear visual listening indicator
* Zero modal dialogs during dictation

---

### 6. Configuration System

* Store config in XDG config directory
* Format: JSON
* Fields:

  * apiKey
  * provider
  * silenceTimeout
  * autostart
  * hotkeys
* Config loaded at startup
* Live reload for most settings

---

### 7. Autostart

* Implement via XDG autostart desktop entry
* Enabled by default
* Toggleable in settings

---

### 8. Error Handling

* Mic unavailable: tray error state
* API failure: non-blocking toast notification
* Injection failure: fallback to clipboard only

No blocking dialogs during dictation

---

### 9. Architecture

#### 9.1 High-Level Modules

* `ui/`

  * Tray
  * Settings window
* `hotkeys/`

  * Portal bindings
* `audio/`

  * Mic capture
  * Silence detection
* `stt/`

  * OpenAI provider
  * ElevenLabs provider
* `inject/`

  * Clipboard
  * ydotool integration
* `config/`

  * Load, save, validate
* `startup/`

  * Autostart handling

#### 9.2 Tech Stack

* Tauri 2.x (application framework)
* Rust (backend)
* React + TypeScript (frontend)
* whisper-rs (local speech-to-text)
* cpal (cross-platform audio capture)
* Specta (TypeScript IPC bindings)
* ydotool (Linux text injection)

---

### 10. Security and Privacy

* No audio saved to disk
* API keys stored locally only
* No telemetry in v1

---

### 11. Packaging Strategy

Phase 1:

* Run from source

Phase 2:

* Flatpak for GNOME ecosystems

Phase 3:

* AppImage for distro-agnostic install

---

### 12. Roadmap

Post-v1 features:

* Smart punctuation
* User dictionary
* Inline correction menu
* Per-app paste profiles
* Windows and macOS ports

---

### 13. Success Metrics

* Dictation start to text insertion under 2 seconds average
* STT accuracy comparable to Whisper Flow
* Zero crashes in continuous daily use
* Hotkey reliability on Wayland above 99 percent

---

### 14. Codename and Identity

App name: **Voyc**
Positioning: Fast, invisible voice input for developers and power users
