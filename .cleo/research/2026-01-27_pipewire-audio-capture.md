# PipeWire Audio Capture Research - T008

**Date**: 2026-01-27  
**Task**: T008 - PipeWire audio capture module  
**Epic**: T001 - Build application from claudedocs/prd.md

## Summary

Implemented PipeWire-based audio capture with silence detection for voice dictation in the Voyc application. The module uses GStreamer via GIR bindings to capture audio from the default microphone, stores it in-memory as WAV 16-bit PCM mono at 16kHz, and provides RMS-based silence detection.

## Implementation Details

### Files Created

1. **`src/audio/AudioBuffer.ts`** (9KB)
   - In-memory audio buffer for WAV storage
   - Supports 16-bit PCM mono at 16kHz (STT-optimized)
   - Methods: `append()`, `clear()`, `toWav()`, `toBase64()`, `toBlobData()`
   - Calculates duration and provides format information
   - No disk writes - all data stored in memory

2. **`src/audio/SilenceDetector.ts`** (11KB)
   - RMS (Root Mean Square) threshold-based silence detection
   - Configurable threshold (default: -40dB)
   - Configurable timeout (0, 30s, 60s, or disabled)
   - Events: `silence-start`, `silence-end`, `silence-timeout`, `level`
   - Minimum consecutive silent frames before triggering (prevents false positives)

3. **`src/audio/PipeWireCapture.ts`** (16KB)
   - GStreamer-based audio capture using `pipewiresrc`
   - Pipeline: `pipewiresrc → audioconvert → audioresample → wavenc → appsink`
   - GObject-based with signals: `started`, `stopped`, `error`, `silence-detected`, `data-available`, `level`
   - Integrates SilenceDetector for automatic stop on silence timeout
   - States: `idle`, `starting`, `recording`, `stopping`, `error`

4. **`src/audio/index.ts`** (6KB)
   - Central export point for all audio functionality
   - Factory functions: `createAudioCapture()`, `createSTTBuffer()`, `createSilenceDetector()`
   - Error classes: `AudioError`, `CaptureInitError`, `DeviceUnavailableError`, `PipelineError`
   - Utility functions: `isAudioAvailable()`, `dbToLinear()`, `linearToDb()`

### Audio Format

- **Container**: WAV
- **Codec**: PCM 16-bit (S16LE)
- **Sample Rate**: 16000 Hz
- **Channels**: Mono (1)
- **Storage**: In-memory only (no disk writes per PRD Section 10)

### GStreamer Pipeline

```
pipewiresrc [device=XXX] !
  audioconvert !
  audioresample !
  audio/x-raw,format=S16LE,rate=16000,channels=1 !
  wavenc !
  appsink name=sink
```

### Silence Detection Algorithm

1. Calculate RMS for each audio frame: `rms = sqrt(sum(samples²) / count)`
2. Convert to dB: `db = 20 * log10(rms / 32768)`
3. Compare against threshold (default -40dB)
4. Require minimum consecutive silent frames (prevents spurious triggers)
5. Start timeout timer when silence detected
6. Emit `silence-timeout` and stop recording when timeout exceeded

### Dependencies Added

- `@girs/gst-1.0`: TypeScript types for GStreamer 1.0

### Package.json Updates

- Updated `generate:types` script to include `Gst-1.0`
- Added `@girs/gst-1.0` to dependencies

## Compliance with Requirements

### PRD Section 4.3 (Audio Capture)
- ✅ Uses PipeWire via GJS (GStreamer pipewiresrc)
- ✅ Records from system default microphone
- ✅ Captures to memory buffer (no disk writes)
- ✅ Format: WAV 16-bit PCM, mono

### PRD Section 4.4 (Silence Detection)
- ✅ Configurable silence timeout (0, 30s, 60s)
- ✅ Simple RMS threshold-based detection
- ✅ Silence stops recording automatically

### Spec REQ-004 (PipeWire Capture)
- ✅ Captures microphone audio via PipeWire
- ✅ Uses PipeWire APIs (pipewiresrc element)

### Spec REQ-005 (Audio Device Selection)
- ✅ Supports configurable audio device selection
- ✅ Null device uses system default

### Spec CON-002 (PipeWire APIs)
- ✅ Capture module uses PipeWire via GStreamer

## Provenance Tags

All code includes JSDoc provenance tags:
```typescript
/**
 * @task T008
 * @epic T001
 * @why [Reason for the code]
 * @what [What the code does]
 */
```

## Integration Notes

### Usage Example

```typescript
// Create capture instance
const capture = new PipeWireCapture({
  device: null,              // Use default microphone
  silenceTimeout: 30,        // Stop after 30s of silence
  silenceThresholdDb: -40,   // -40dB threshold
});

// Set up event handlers
capture.onStarted(() => {
  console.log('Recording started');
});

capture.onStopped((reason) => {
  console.log(`Recording stopped: ${reason}`);
  const wavData = capture.getWavData();
  // Send to STT service...
});

capture.onSilenceDetected((duration) => {
  console.log(`Silence detected after ${duration}s`);
});

// Start recording
capture.start();

// Stop manually (optional)
// capture.stop();
```

### GObject Signals

The `PipeWireCapture` class emits GObject signals for integration with GTK UI:
- `started`: Recording has begun
- `stopped` (reason: string): Recording stopped (manual, silence, error)
- `error` (message: string): Error occurred
- `silence-detected` (duration: number): Silence timeout triggered
- `data-available` (data: pointer): New audio data available
- `level` (rmsDb: number, isSilent: boolean): Audio level update

## Testing Considerations

1. **Audio Availability**: Use `isAudioAvailable()` to check system readiness
2. **Device Selection**: Pass specific PipeWire device ID or null for default
3. **Silence Tuning**: Adjust threshold based on environment noise levels
4. **Memory Usage**: Monitor buffer size for long recordings

## Build Status

The audio module compiles successfully with no TypeScript errors. The remaining build errors in the project are pre-existing issues in other modules (hotkeys, config, ui) that are not related to T008.

## File Statistics

- `src/audio/AudioBuffer.ts`: 352 lines
- `src/audio/SilenceDetector.ts`: 457 lines  
- `src/audio/PipeWireCapture.ts`: 644 lines
- `src/audio/index.ts`: 179 lines
- **Total**: 1,632 lines of TypeScript

## Future Enhancements

- Real-time VAD (Voice Activity Detection) for more accurate speech detection
- Audio preprocessing (noise reduction, normalization)
- Support for alternative capture backends (PulseAudio fallback)
- Streaming audio for real-time STT
