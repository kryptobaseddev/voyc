# Voice Dictation App Specification v1.0.0

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document
are to be interpreted as described in RFC 2119.

---

## Overview

This specification defines the architecture, behavior, and compliance criteria
for a desktop voice dictation application that captures audio, performs
speech-to-text using ElevenLabs as the primary provider (batch STT via Scribe v2
by default, with optional realtime Scribe v2 Realtime), and applies multi-LLM
post-processing (including a Baseten-hosted LLaMA pipeline) before safely
injecting text into focused applications.

---

## Definitions

| Term | Definition |
|------|------------|
| App | The Voice Dictation desktop application described in this spec. |
| STT | Speech-to-text service that converts audio to text. |
| Provider | A configurable external service used for STT or post-processing. |
| Injection | The act of delivering text into the active application in a Wayland-safe manner. |
| Portal Hotkey | A global hotkey registered via xdg-desktop-portal. |
| Baseten LLaMA | A post-processing LLaMA model hosted on Baseten. |
| VAD | Voice activity detection options used for streaming STT. |

---

## Architecture Decisions

1. The App MUST be implemented with TypeScript using GJS and GTK4 for UI.
2. Audio capture MUST use PipeWire for device access and routing.
3. Text injection MUST be Wayland-safe (portal or input-method based) and MUST NOT
   rely on Wayland-unsafe tools (e.g., X11-only event injection).
4. Global hotkeys MUST be registered through a portal (xdg-desktop-portal).
5. The App MUST provide a tray UI for status, controls, and settings access.

---

## Requirements

### Core Application

**REQ-001**: The App MUST provide a start/stop dictation control via tray UI.
- Rationale: Enable quick access without opening a full window.
- Verification: Tray shows a start/stop control that toggles dictation state.

**REQ-002**: The App MUST expose configuration for provider selection, API keys,
and endpoints for STT and post-processing.
- Rationale: Allow switching providers and environments.
- Verification: Configuration file or UI includes provider settings and keys.

**REQ-003**: The App MUST persist configuration locally and MUST NOT transmit
configuration data to third parties except the selected providers.
- Rationale: Protect sensitive keys and settings.
- Verification: Config stored locally; network traces show no extra uploads.

### Audio Capture

**REQ-004**: The App MUST capture microphone audio via PipeWire.
- Rationale: PipeWire is required for modern Linux audio routing.
- Verification: Audio capture works with PipeWire active and without Pulse-only APIs.

**REQ-005**: The App MUST support configurable audio device selection.
- Rationale: Users may have multiple input devices.
- Verification: UI/config lists devices and switches the capture source.

### STT Provider (ElevenLabs Primary)

**REQ-006**: ElevenLabs MUST be the default STT provider, and batch STT using
Scribe v2 MUST be the default transcription mode.
- Rationale: Establish a primary provider and a consistent default workflow.
- Verification: Fresh config defaults to ElevenLabs with Scribe v2 batch mode.

**REQ-007**: The App MUST call the ElevenLabs REST STT endpoint at base URL
`https://api.elevenlabs.io/v1` using `POST /v1/speech-to-text` with
`multipart/form-data`.
- Rationale: Required API interface for non-streaming STT.
- Verification: HTTP request matches method, URL, and content type.

**REQ-008**: The App MUST authenticate ElevenLabs requests with the
`xi-api-key` header.
- Rationale: Required by ElevenLabs authentication model.
- Verification: Requests include the header and succeed with a valid key.

**REQ-009**: The App MUST support ElevenLabs streaming STT over WebSocket at
`wss://api.elevenlabs.io/v1/speech-to-text/realtime` and MUST allow configuration
of `audio_format` and VAD options. Realtime STT MUST be OPTIONAL and marked
experimental, and when enabled MUST default to Scribe v2 Realtime.
- Rationale: Enable low-latency streaming with explicit experimental status.
- Verification: WebSocket connects to the endpoint, accepts options, and is
  labeled experimental with Scribe v2 Realtime as the default model.

**REQ-010**: The App MUST allow alternate STT providers to be configured and
selected at runtime, including OpenAI STT.
- Rationale: Provider flexibility and redundancy.
- Verification: Switching provider changes the active STT backend and OpenAI is
  an available option.

### Post-Processing (Multi-LLM)

**REQ-011**: The App MUST send raw STT output through a post-processing pipeline
before injection unless the user disables it, and the pipeline MUST apply smart
formatting and context-aware edits.
- Rationale: Improve punctuation, capitalization, and corrections beyond raw STT.
- Verification: Output differs from raw STT and includes formatting edits.

**REQ-012**: The default post-processing model MUST be a Baseten-hosted LLaMA
pipeline, and the App MUST allow configuration of its endpoint and API key.
- Rationale: Establish a primary LLM pipeline while enabling environment changes.
- Verification: Default config targets Baseten LLaMA and can be overridden.

**REQ-013**: The App MUST support additional post-processing providers and
allow configurable ordering (single model or multi-stage chain).
- Rationale: Enable multi-LLM workflows and experimentation.
- Verification: Config defines provider order and the pipeline executes in order.

### Injection and Hotkeys

**REQ-014**: The App MUST inject text using a Wayland-safe mechanism (portal or
input-method service) and MUST NOT require X11-only tools.
- Rationale: Ensure compatibility with Wayland sessions.
- Verification: Injection works on Wayland without X11 helpers.

**REQ-015**: The App MUST register global hotkeys through xdg-desktop-portal.
- Rationale: Required for Wayland-safe global shortcuts.
- Verification: Hotkeys are managed by the portal and function system-wide.

### Latency and Observability

**REQ-016**: The App MUST record timestamps for capture start, STT completion,
post-processing completion, and injection completion.
- Rationale: Provide end-to-end latency visibility.
- Verification: Logs/metrics include the timestamps for each stage.

**REQ-017**: The App MUST expose configurable latency thresholds and MUST report
when thresholds are exceeded. The default post-processing target for Baseten
requests MUST be <250ms.
- Rationale: Allow tuning for responsiveness and a clear Baseten latency target.
- Verification: Threshold config exists, Baseten target is <250ms by default,
  and alerts/logs fire when exceeded.

### Privacy and Data Handling

**REQ-018**: The App MUST provide a user-visible data handling policy that
states which providers receive audio/text and what retention settings apply.
- Rationale: Transparency for privacy decisions.
- Verification: UI or documentation shows current provider data handling.

**REQ-019**: The App MUST NOT store raw audio by default and MUST provide an
explicit opt-in toggle for any audio retention.
- Rationale: Minimize sensitive data storage.
- Verification: No audio files stored unless opt-in enabled.

**REQ-020**: The App MUST support redaction of sensitive data in logs and MUST
avoid logging raw audio or full transcripts by default.
- Rationale: Reduce exposure of sensitive content.
- Verification: Logs redact or omit sensitive fields by default.

---

## Constraints

| ID | Constraint | Enforcement |
|----|------------|-------------|
| CON-001 | UI framework MUST be GTK4 via GJS in TypeScript. | Build tooling and runtime selection enforce framework usage. |
| CON-002 | Audio capture MUST use PipeWire APIs. | Capture module uses PipeWire; alternative capture paths rejected. |
| CON-003 | Injection MUST be Wayland-safe and MUST NOT depend on X11-only tools. | CI/QA checks on Wayland; injection backend restricted. |
| CON-004 | Global hotkeys MUST be registered via xdg-desktop-portal. | Hotkey module only exposes portal registration. |
| CON-005 | Tray UI MUST exist for primary controls and status. | Release checklist requires tray UI functionality. |

---

## Compliance

An implementation is compliant if it satisfies all of the following:
1. All requirements REQ-001 through REQ-020 are implemented and verified.
2. All constraints CON-001 through CON-005 are enforced.
3. ElevenLabs STT defaults and API details are implemented as specified.
4. Baseten LLaMA post-processing is supported and configurable, alongside
   additional providers.
5. Latency and privacy requirements are implemented and documented.

Non-compliant implementations SHOULD provide remediation plans and MUST NOT be
released as production builds.
