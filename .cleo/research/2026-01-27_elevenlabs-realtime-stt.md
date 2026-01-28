# ElevenLabs Realtime STT (WebSocket) Implementation - T012

**Date**: 2026-01-27  
**Task**: T012  
**Epic**: T001 (Build application from claudedocs/prd.md)  
**Status**: Complete

## Summary

Implemented ElevenLabs realtime STT via WebSocket for low-latency streaming transcription per SPEC-REQ-009. This is an **experimental** feature that provides streaming speech-to-text using the ElevenLabs Scribe v2 Realtime model.

## Files Created

### 1. `src/stt/StreamingAudioBuffer.ts`

Chunked audio buffer for streaming STT with the following features:

- **Purpose**: Accumulates PCM audio data and yields fixed-size chunks for WebSocket streaming
- **Chunk Size**: Default 100ms chunks (3200 bytes for 16kHz 16-bit mono PCM)
- **Key Methods**:
  - `append(data: Uint8Array)` - Add audio data, auto-emits chunks when ready
  - `flush()` - Emit remaining data as final chunk
  - `onChunk(callback)` - Register callback for chunk processing
  - `toBase64(data)` - Static method for base64 encoding

- **Configuration**:
  - Sample rate: 16kHz (configurable)
  - Channels: 1 (mono)
  - Bits per sample: 16
  - Chunk duration: 100ms (configurable)

### 2. `src/stt/ElevenLabsRealtimeProvider.ts`

WebSocket streaming STT provider implementing the `SttProvider` interface:

- **Endpoint**: `wss://api.elevenlabs.io/v1/speech-to-text/realtime`
- **Authentication**: `xi-api-key` query parameter
- **Default Model**: `scribe_v2_realtime`
- **Audio Formats**: PCM (default) or MULAW

**Key Components**:

1. **ElevenLabsRealtimeProvider Class**:
   - `connectStream(options?)` - Establish WebSocket connection
   - `setAudioFormat(format)` - Configure PCM or mulaw
   - `setVadEnabled(enabled)` - Enable/disable server-side VAD
   - `supportsStreaming = true`

2. **ElevenLabsRealtimeConnection Class** (implements `StreamConnection`):
   - `sendAudio(audioData)` - Send base64-encoded audio chunks
   - `endStream()` - Gracefully end the stream
   - `abort()` - Force close connection
   - `onTranscript(callback)` - Receive interim and final transcripts
   - `onError(callback)` - Handle errors
   - `onClose(callback)` - Handle connection close

**WebSocket Protocol**:

```typescript
// Client → Server
interface ConfigMessage {
  type: 'config';
  model_id: string;
  audio_format: 'pcm' | 'mulaw';
  vad?: boolean;
  language_code?: string;
}

interface AudioMessage {
  type: 'audio';
  data: string; // base64 encoded
}

// Server → Client
interface TranscriptMessage {
  type: 'transcript';
  text: string;
  is_final: boolean;
  confidence?: number;
}
```

## Files Modified

### 1. `src/stt/index.ts`

Added exports for:
- `ElevenLabsRealtimeProvider`, `createElevenLabsRealtimeProvider`
- `StreamingAudioBuffer`, `createStreamingBuffer`, `calculateChunkSize`, `DEFAULT_CHUNK_SIZE`, `STREAMING_AUDIO_FORMAT`
- `RealtimeSttConfig` interface
- `DEFAULT_REALTIME_CONFIG` constants
- Updated `PROVIDER_CAPABILITIES` with `elevenlabs_realtime` entry
- Updated `PROVIDER_METADATA` with experimental provider info
- Added `ELEVENLABS_REALTIME` to `DEFAULT_MODELS`

### 2. `src/stt/ProviderFactory.ts`

- Added `'elevenlabs-realtime'` to `ProviderType`
- Added `_createElevenLabsRealtimeProvider()` factory method
- Updated `getAvailableProviders()` to include realtime option
- Added `isExperimental(type)` helper method
- Added `getProviderCapabilities(type)` for feature detection
- Updated disposal logic to handle all provider types

### 3. `src/config/schema.ts`

- Added `'elevenlabs-realtime'` to `Provider` type
- Updated `isValidProvider()` to accept new provider
- Updated `hasValidApiKey()` to use ElevenLabs key for realtime
- Updated `getCurrentApiKey()` to return ElevenLabs key for realtime
- Updated `getCurrentEndpoint()` to return ElevenLabs endpoint for realtime

## Integration with Existing Code

The implementation follows the existing patterns established in T011:

1. **Error Handling**: Uses `SttError`, `SttAuthError`, `SttNetworkError`, `SttRateLimitError`
2. **Logging**: Uses the `Logger` class with component namespacing
3. **Configuration**: Integrates with existing config schema
4. **Provider Interface**: Implements `SttProvider` with `supportsStreaming = true`

## Usage Example

```typescript
import { createElevenLabsRealtimeProvider, createStreamingBuffer } from './stt/index.js';

// Create provider
const provider = createElevenLabsRealtimeProvider({
  apiKey: 'your-api-key',
  defaultModel: 'scribe_v2_realtime',
}, logger);

// Connect to streaming endpoint
const connection = await provider.connectStream({
  language: 'en',
});

// Set up transcript handler
connection.onTranscript((text, isFinal) => {
  if (isFinal) {
    console.log('Final:', text);
  } else {
    console.log('Interim:', text);
  }
});

// Create streaming buffer
const buffer = createStreamingBuffer(100); // 100ms chunks
buffer.onChunk((chunk, isFinal) => {
  connection.sendAudio(chunk);
});

// Stream audio from capture
audioCapture.onData((pcmData) => {
  buffer.append(pcmData);
});

// On silence/end
audioCapture.onSilence(() => {
  buffer.flush();
  connection.endStream();
});
```

## Experimental Status

Per SPEC-REQ-009, the realtime STT is marked as **experimental**:

- JSDoc `@experimental` tags on all related code
- Display name includes "(Experimental)"
- Separate capability entry in `PROVIDER_CAPABILITIES`
- May have different stability characteristics than batch API

## Testing Considerations

1. **WebSocket Connection**: Requires valid ElevenLabs API key
2. **Audio Format**: Must be 16kHz 16-bit mono PCM
3. **Chunk Size**: 100ms recommended for low latency
4. **Network**: Requires stable internet connection
5. **VAD**: Server-side VAD can be enabled/disabled

## Compliance

- ✅ REQ-009: WebSocket streaming at `wss://api.elevenlabs.io/v1/speech-to-text/realtime`
- ✅ REQ-009: Configurable `audio_format` (PCM/mulaw)
- ✅ REQ-009: Configurable VAD options
- ✅ REQ-009: Default model `scribe_v2_realtime`
- ✅ REQ-009: Marked as experimental
- ✅ JSDoc provenance tags on all code

## Dependencies

- GJS with Soup 3.0 (WebSocket support)
- GLib for timing and base64 encoding
- Existing T011 provider infrastructure
