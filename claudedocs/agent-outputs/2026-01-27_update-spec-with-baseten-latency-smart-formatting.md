# Update spec with Baseten latency + smart formatting

## Summary

Updated the Voice Dictation App spec to clarify default batch STT (Scribe v2), optional realtime mode, OpenAI STT support, and Baseten post-processing latency targets. Added smart formatting and context-aware edit requirements in post-processing while preserving existing RFC2119 numbering.

## Deliverables

### Updated VOICE_DICTATION_APP spec

Refined STT defaults, realtime experimental status, OpenAI provider support, post-processing formatting expectations, and Baseten latency target requirements.

**Files affected:**
- docs/specs/VOICE_DICTATION_APP.md

## Acceptance Criteria Verification

| Criterion | Status | Notes |
|-----------|--------|-------|
| Spec includes latency target (<250ms) and Baseten details | PASS | REQ-017 adds Baseten <250ms target; REQ-012 retains Baseten LLaMA details. |
| Spec includes smart formatting/context-aware edit requirements | PASS | REQ-011 now requires smart formatting and context-aware edits. |
| Spec states batch STT default (Scribe v2) | PASS | REQ-006 sets default to batch Scribe v2. |
| realtime optional/experimental | PASS | REQ-009 marks realtime OPTIONAL and experimental, defaulting to Scribe v2 Realtime. |
| Spec documents OpenAI STT provider support | PASS | REQ-010 explicitly includes OpenAI STT as a selectable provider. |

## Implementation Notes

Modified existing requirement text to incorporate new defaults and targets without renumbering, keeping the RFC2119 structure intact. Latency target was added to REQ-017 to tie the <250ms requirement directly to Baseten post-processing.

## Linked Tasks

- Epic: T001
- Task: T019
- Dependencies: T004
