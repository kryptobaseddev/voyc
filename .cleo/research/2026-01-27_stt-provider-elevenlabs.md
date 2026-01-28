# STT Provider Abstraction + ElevenLabs REST Implementation

**Date:** 2026-01-27  
**Task:** T011  
**Epic:** T001

## Summary

Implemented Speech-to-Text (STT) provider abstraction layer with ElevenLabs REST API as the primary provider and OpenAI as an alternative. The implementation follows the Voyc specification requirements (REQ-006, REQ-007, REQ-008, REQ-010) and integrates with the existing logging, metrics, and configuration systems.

## Files Created

### 1. `src/stt/SttProvider.ts`
- **Purpose:** Abstract STT provider interface and type definitions
- **Key Components:**
  - `SttProvider` interface with `transcribe()` and optional `connectStream()` methods
  - `TranscribeOptions` and `TranscribeResult` interfaces
  - `StreamOptions` and `StreamConnection` interfaces (for T012 streaming)
  - Error hierarchy: `SttError`, `SttAuthError`, `SttNetworkError`, `SttRateLimitError`
  - Provider configuration interfaces: `ProviderConfig`, `ElevenLabsConfig`, `OpenAIConfig`

### 2. `src/stt/ElevenLabsProvider.ts`
- **Purpose:** ElevenLabs REST API implementation per REQ-007, REQ-008
- **Key Features:**
  - Endpoint: `POST https://api.elevenlabs.io/v1/speech-to-text`
  - Auth: `xi-api-key` header per REQ-008
  - Content-Type: `multipart/form-data` per REQ-007
  - Default model: `scribe_v2` per REQ-006
  - Manual multipart form construction for GJS/Soup 3.0
  - Comprehensive error handling with specific error types
  - Latency tracking using `GLib.get_monotonic_time()`
  - JSDoc provenance tags on all methods

### 3. `src/stt/OpenAIProvider.ts`
- **Purpose:** OpenAI Whisper API implementation per REQ-010
- **Key Features:**
  - Endpoint: `POST https://api.openai.com/v1/audio/transcriptions`
  - Auth: `Authorization: Bearer {key}` header
  - Model: `whisper-1` default
  - Same error handling and latency tracking as ElevenLabs
  - Configurable response format and temperature

### 4. `src/stt/ProviderFactory.ts`
- **Purpose:** Runtime provider selection and management
- **Key Features:**
  - Factory pattern for provider creation
  - Provider caching with lifecycle management
  - Configuration updates without recreating providers
  - API key updates at runtime
  - Provider validation (`isConfigured()`)
  - Support for `elevenlabs` and `openai` providers

### 5. `src/stt/index.ts`
- **Purpose:** Module exports and constants
- **Exports:**
  - All provider classes and factory functions
  - Error classes
  - Constants: `DEFAULT_MODELS`, `DEFAULT_ENDPOINTS`, `SUPPORTED_AUDIO_FORMATS`
  - Provider capabilities matrix
  - Provider metadata for UI

## Technical Implementation Details

### GJS/Soup 3.0 HTTP Client

Both providers use Soup 3.0 for HTTP requests:
```typescript
imports.gi.versions.Soup = '3.0';
const { Soup, GLib } = imports.gi;

// Create session with timeout
this._session = new Soup.Session();
this._session.set_timeout(30);

// Async request with Promise wrapper
this._session.send_and_read_async(
  message,
  GLib.PRIORITY_DEFAULT,
  null,
  (source, res) => { /* callback */ }
);
```

### Multipart Form Construction

Manual multipart/form-data construction required for GJS:
```typescript
private _createMultipartBody(audioData, modelId, options): { data: GLib.Bytes; boundary: string } {
  const boundary = `----FormBoundary${GLib.random_int()}`;
  // Build chunks with proper headers and boundaries
  // Concatenate and return as GLib.Bytes
}
```

### Latency Tracking

Integrated with metrics system using monotonic time:
```typescript
const startTime = GLib.get_monotonic_time();
// ... perform transcription ...
const endTime = GLib.get_monotonic_time();
const latencyMs = (endTime - startTime) / 1000;
```

### Error Handling

Hierarchical error types for different failure modes:
- `SttAuthError`: Invalid API key (401)
- `SttRateLimitError`: Rate limit exceeded (429) with retry-after
- `SttNetworkError`: Network/server errors (5xx)
- `SttError`: General transcription errors

## Specification Compliance

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| REQ-006 | ✅ | ElevenLabs default, `scribe_v2` model |
| REQ-007 | ✅ | `POST /v1/speech-to-text`, `multipart/form-data` |
| REQ-008 | ✅ | `xi-api-key` header authentication |
| REQ-010 | ✅ | OpenAI provider with Whisper API |

## Integration Points

### Configuration (`src/config/schema.ts`)
- Uses existing `Provider` type (`'elevenlabs' | 'openai' | 'baseten'`)
- Reads API keys from config: `elevenlabsApiKey`, `openaiApiKey`
- Reads endpoints from config with defaults

### Logging (`src/logging/Logger.ts`)
- All providers accept `Logger` instance
- Uses child loggers: `logger.child('elevenlabs')`
- Redacts API keys automatically in logs

### Metrics (`src/logging/metrics.ts`)
- Latency tracking compatible with `MetricsTracker`
- Can be integrated with `recordSttComplete()` for threshold alerting

### Audio (`src/audio/AudioBuffer.ts`)
- Accepts `Uint8Array` audio data (WAV format)
- Duration estimation from audio size
- Compatible with `AudioBuffer.toWav()` output

## Usage Example

```typescript
import { createProviderFactory } from './stt/index.js';
import { Logger } from './logging/Logger.js';

const logger = new Logger({ component: 'voyc' });
const factory = createProviderFactory({ config, logger });

// Get current provider (based on config)
const provider = factory.getCurrentProvider();

// Transcribe audio from AudioBuffer
const audioData = audioBuffer.toWav();
const result = await provider.transcribe(audioData, {
  language: 'en',
});

console.log(`Transcribed: ${result.text}`);
console.log(`Latency: ${result.latency}ms`);
```

## Future Work (T012)

The interface already supports streaming for T012:
```typescript
interface SttProvider {
  readonly supportsStreaming: boolean;
  connectStream?(options: StreamOptions): Promise<StreamConnection>;
}
```

ElevenLabs streaming WebSocket implementation will add:
- `wss://api.elevenlabs.io/v1/speech-to-text/realtime`
- `supportsStreaming = true`
- Full `StreamConnection` implementation

## References

- PRD Section 4.5: Speech-to-Text
- Spec: `/mnt/projects/voyc/docs/specs/VOICE_DICTATION_APP.md` (REQ-006, REQ-007, REQ-008, REQ-010)
- ElevenLabs API Docs: https://elevenlabs.io/docs/api-reference/speech-to-text
- OpenAI API Docs: https://platform.openai.com/docs/api-reference/audio/createTranscription
