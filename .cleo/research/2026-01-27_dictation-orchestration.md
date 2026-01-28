# Dictation Orchestration Implementation (T015)

**Date:** 2026-01-27  
**Task:** T015 - End-to-end dictation orchestration  
**Epic:** T001 - Build application from claudedocs/prd.md

## Summary

Implemented the main dictation orchestration layer that coordinates all modules into a complete user flow. This is the central integration point that wires together all prior tasks (T006-T014, T016, T017).

## Files Created

### 1. src/dictation/StateMachine.ts
- **Purpose:** Dictation state management with transition validation
- **States:** `IDLE → STARTING → LISTENING → PROCESSING → INJECTING → IDLE`
- **Error handling:** Error state with automatic recovery to idle
- **Features:**
  - Validated state transitions (prevents invalid state changes)
  - State history tracking (last 100 transitions)
  - GObject signal emission for state changes
  - Time-in-state tracking
  - Convenience methods: `start()`, `stop()`, `markCaptureStarted()`, etc.

### 2. src/dictation/DictationEngine.ts
- **Purpose:** Main orchestrator coordinating all subsystems
- **Responsibilities:**
  - Module coordination (audio, STT, post-process, inject)
  - State transition management
  - Error handling and recovery
  - Latency metrics tracking (REQ-016)
  - Signal emission for UI updates
- **Integration Points:**
  - ConfigManager (T007) - settings
  - PipeWireCapture (T008) - audio
  - PortalHotkeyManager (T009) - hotkeys
  - TrayIndicator (T010) - UI
  - SttProvider (T011/T012) - transcription
  - PostProcessPipeline (T013) - formatting
  - TextInjector (T014) - text delivery
  - Logger (T016) - logging
  - Lifecycle (T017) - startup/single-instance

### 3. src/dictation/index.ts
- **Purpose:** Module exports for dictation orchestration
- **Exports:** StateMachine, DictationEngine, and all related types

### 4. src/main.ts (updated)
- **Purpose:** Application entry point with full module initialization
- **Changes:**
  - Integrated all modules into VoycApp class
  - Single-instance enforcement via LifecycleManager
  - Proper initialization sequence
  - Settings window integration
  - Graceful shutdown handling

## User Flow Implementation

```
1. User presses hotkey (Super+V) or clicks tray
   → DictationEngine.toggleDictation()
   → StateMachine: idle → starting → listening
   → TrayIndicator: idle → listening icon

2. Audio capture starts (PipeWire)
   → PipeWireCapture.start()
   → GStreamer pipeline recording

3. User speaks
   → Audio buffered in memory
   → SilenceDetector monitors levels

4. Silence detected or user toggles off
   → PipeWireCapture.stop()
   → StateMachine: listening → stopping → processing

5. Audio sent to STT (ElevenLabs/OpenAI)
   → ProviderFactory.getCurrentProvider()
   → SttProvider.transcribe()
   → MetricsTracker.recordSttComplete()

6. Text post-processed (Baseten LLaMA)
   → PostProcessPipeline.process()
   → MetricsTracker.recordPostProcessComplete()
   → StateMachine: processing → injecting

7. Text injected into focused app
   → TextInjector.inject()
   → Clipboard copy + paste simulation
   → MetricsTracker.completeSession()
   → StateMachine: injecting → idle
   → TrayIndicator: processing → idle icon
```

## State Machine Transitions

| From | To | Trigger | Action |
|------|-----|---------|--------|
| idle | starting | user_toggle/hotkey | Begin dictation |
| starting | listening | capture_started | Capture active |
| listening | stopping | user_toggle/silence | Stop requested |
| listening | processing | silence_detected | Auto-stop |
| stopping | processing | capture_stopped | Begin STT |
| processing | injecting | stt_complete | Begin injection |
| injecting | idle | injection_complete | Complete |
| any | error | error | Error handling |
| error | idle | reset | Recovery |

## Error Handling Strategy

1. **Capture errors:** Transition to error state, show notification
2. **STT errors:** Log error, transition to error, show notification
3. **Post-processing errors:** Fall back to raw text, continue
4. **Injection errors:** Log error, transition to error
5. **All errors:** Return to idle state after handling

## Latency Tracking (REQ-016)

Metrics tracked per session:
- `captureStart` - When recording began
- `sttComplete` - When STT finished
- `postProcessComplete` - When post-processing finished
- `injectionComplete` - When text was injected

Calculated metrics:
- `totalMs` - End-to-end latency
- `sttMs` - STT processing time
- `postProcessMs` - Post-processing time
- `injectionMs` - Injection time
- `processingMs` - Total processing time

Threshold alerts (REQ-017):
- Baseten post-processing: <250ms target
- Total latency: 2 second warning
- STT latency: 1.5 second warning

## Provenance Tags

All code includes JSDoc provenance tags:
```typescript
/**
 * @task T015
 * @epic T001
 * @why [Reason for existence]
 * @what [What the code does]
 */
```

## Acceptance Criteria Status

- [x] Hotkey triggers dictation start/stop
- [x] Tray icon reflects current state
- [x] Audio captured and sent to STT
- [x] STT result post-processed
- [x] Text injected into focused window
- [x] Full latency tracked (REQ-016)
- [x] Errors handled without crashing
- [x] JSDoc provenance tags on all code

## Dependencies Satisfied

All prior tasks complete:
- T006: Build tooling ✓
- T007: Config system ✓
- T008: Audio capture ✓
- T009: Portal hotkeys ✓
- T010: Tray UI ✓
- T011/T012: STT providers ✓
- T013: Post-processing ✓
- T014: Text injection ✓
- T016: Logging/metrics ✓
- T017: Autostart/lifecycle ✓
