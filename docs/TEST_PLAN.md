# Voyc Test Plan

**Task**: T018  
**Epic**: T001  
**Date**: 2026-01-27

---

## Overview

This document outlines the testing strategy for Voyc, a voice dictation application for Linux Wayland.

## Test Levels

### 1. Unit Tests

Individual module testing with mocked dependencies.

| Module | Test File | Coverage |
|--------|-----------|----------|
| Config | `tests/config.test.ts` | ✅ Complete |
| Paths | `tests/config.test.ts` | ✅ Complete |
| Schema | `tests/config.test.ts` | ✅ Complete |

### 2. Integration Tests

Module interaction testing.

| Integration | Test File | Status |
|-------------|-----------|--------|
| Config + Paths | `tests/smoke/config.test.ts` | ✅ Ready |
| Audio + Silence | Manual | ⏳ Requires hardware |
| STT + PostProcess | Manual | ⏳ Requires API keys |
| Full Dictation | Manual | ⏳ End-to-end |

### 3. System Tests

End-to-end scenarios.

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Basic Dictation | 1. Press hotkey<br>2. Speak<br>3. Wait for silence | Text appears in focused window |
| Manual Stop | 1. Press hotkey<br>2. Speak<br>3. Press hotkey again | Text appears in focused window |
| Terminal Paste | 1. Focus terminal<br>2. Dictate | Text pasted with Ctrl+Shift+V |
| Settings Change | 1. Open settings<br>2. Change provider<br>3. Dictate | New provider used |

### 4. Performance Tests

Latency benchmarks per REQ-016, REQ-017.

| Metric | Target | Measurement |
|--------|--------|-------------|
| Capture to STT | <2s | `sttComplete - captureStart` |
| Baseten Post-Process | <250ms | `postProcessComplete - sttComplete` |
| Total Latency | <3s | `injectionComplete - captureStart` |

### 5. Compliance Tests

Verification of specification requirements.

| REQ | Description | Test Method |
|-----|-------------|-------------|
| REQ-001 | Tray start/stop | Visual verification |
| REQ-002 | Provider configuration | Config UI test |
| REQ-003 | Local config only | File system check |
| REQ-004 | PipeWire capture | Audio device test |
| REQ-005 | Device selection | Settings UI test |
| REQ-006 | ElevenLabs default | Default config check |
| REQ-007 | REST endpoint | Network trace |
| REQ-008 | xi-api-key header | Network trace |
| REQ-009 | WebSocket realtime | Network connection |
| REQ-010 | OpenAI provider | Provider switch test |
| REQ-011 | Post-processing | Output comparison |
| REQ-012 | Baseten default | Default config check |
| REQ-013 | Multi-stage chain | Pipeline config test |
| REQ-014 | Wayland-safe injection | Wayland session test |
| REQ-015 | Portal hotkeys | Hotkey registration |
| REQ-016 | Latency timestamps | Log verification |
| REQ-017 | Threshold alerts | Alert trigger test |
| REQ-018 | Data policy | UI verification |
| REQ-019 | No audio storage | File system check |
| REQ-020 | Log redaction | Log content check |

---

## Smoke Tests

Automated smoke tests for CI/CD.

### Build Smoke Tests

```bash
npm run build
```

**Verifies:**
- TypeScript compiles without errors
- All modules resolve
- No type errors

### Config Smoke Tests

```bash
npm test
```

**Verifies:**
- Config loads/saves
- XDG paths work
- Schema validation works

### Integration Smoke Tests

```bash
./tests/run-smoke-tests.sh
```

**Verifies:**
- DictationEngine initializes
- State machine works
- Module connections established

---

## Test Execution

### Prerequisites

```bash
# Install dependencies
npm install

# Generate types
npm run generate:types

# Build project
npm run build
```

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- tests/config.test.ts

# Smoke tests only
./tests/run-smoke-tests.sh
```

---

## Success Criteria

Per PRD Section 13:

1. **Dictation start to text insertion under 2 seconds average**
   - Measure: `injectionComplete - captureStart`
   - Target: <2000ms

2. **STT accuracy comparable to Whisper Flow**
   - Measure: Word Error Rate (WER)
   - Method: Compare against reference transcripts

3. **Zero crashes in continuous daily use**
   - Measure: Crash-free sessions
   - Target: 100% over 7 days

4. **Hotkey reliability on Wayland above 99 percent**
   - Measure: Hotkey response rate
   - Target: >99% over 100 activations

---

## Manual Testing Checklist

- [ ] Install on fresh Fedora 43 GNOME
- [ ] Configure API keys
- [ ] Test basic dictation in text editor
- [ ] Test dictation in terminal
- [ ] Change provider (ElevenLabs ↔ OpenAI)
- [ ] Enable/disable post-processing
- [ ] Test autostart toggle
- [ ] Verify no audio files in ~/.cache/voyc
- [ ] Check logs for redacted API keys
- [ ] Test hotkey after screen lock/unlock

---

## JSDoc Provenance

```typescript
/**
 * @task T018
 * @epic T001
 * @why Verify application works correctly through comprehensive testing
 * @what Test plan and smoke tests for Voyc voice dictation app
 */
```
