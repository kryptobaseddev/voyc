# T016: Logging, Metrics, and Privacy Guards Implementation

## Summary

Implemented comprehensive logging, latency metrics, and privacy protection systems for Voyc as specified in REQ-016 through REQ-020.

## Files Created

### 1. src/logging/Logger.ts
- **Logger class**: Structured JSON logging to stderr (systemd journal compatible)
- **Log levels**: ERROR, WARN, INFO, DEBUG with configurable minimum level
- **Redaction**: Automatic redaction of API keys in log messages and context
- **Component hierarchy**: Child loggers for sub-component identification
- **Key features**:
  - ISO 8601 timestamps
  - Structured JSON output
  - API key pattern detection (ElevenLabs, OpenAI, generic)
  - Sensitive key detection (api_key, password, secret, etc.)

### 2. src/logging/metrics.ts
- **MetricsTracker class**: Latency tracking for dictation lifecycle
- **Timestamps tracked** (per REQ-016):
  - `captureStart`: Recording started
  - `sttComplete`: STT finished
  - `postProcessComplete`: Post-processing finished
  - `injectionComplete`: Text injected
- **Threshold configuration** (per REQ-017):
  - Baseten post-processing: <250ms default target
  - Total latency: 2000ms default
  - STT latency: 1500ms default
- **Alert system**: Configurable callbacks for threshold violations
- **GLib integration**: Uses `GLib.get_monotonic_time()` for microsecond precision

### 3. src/privacy/redaction.ts
- **String redaction**: `redactString()` with configurable patterns
- **Object redaction**: `redactObject()` for deep redaction
- **Transcript redaction**: `redactTranscript()` - returns placeholder by default
- **Header redaction**: `redactHeaders()` for HTTP headers
- **Built-in patterns**:
  - API keys (ElevenLabs, OpenAI, generic)
  - Bearer tokens
  - Personal data (email, phone, SSN, credit card)
- **API key masking**: `maskApiKey()` for UI display

### 4. src/privacy/policy.ts
- **Provider data policies**: Data handling for ElevenLabs, OpenAI, Baseten
- **Privacy settings**: User-configurable privacy options
- **Policy display**: Formatted privacy summaries for UI
- **Compliance info**: GDPR status, retention policies, processing locations
- **Default settings** (per REQ-019, REQ-020):
  - `storeAudioLocally`: false
  - `logTranscripts`: false
  - `enableTelemetry`: false

### 5. src/logging/index.ts
Module exports for logging and metrics.

### 6. src/privacy/index.ts
Module exports for privacy and redaction.

## Config Schema Updates (src/config/schema.ts)

Added new configuration fields:

```typescript
// Logging
logLevel: 'error' | 'warn' | 'info' | 'debug'

// Privacy
storeAudioLocally: boolean  // REQ-019
audioRetentionDays: number  // REQ-019

// Metrics (REQ-017)
latencyThresholds: {
    basetenPostProcessMs: number  // default: 250
    totalLatencyMs: number        // default: 2000
    sttLatencyMs: number          // default: 1500
}
enableLatencyAlerts: boolean
```

## ConfigManager Updates (src/config/Config.ts)

Added setter methods:
- `setStoreAudioLocally(enabled)`
- `setAudioRetentionDays(days)`
- `setLogLevel(level)`
- `setEnableLatencyAlerts(enabled)`
- `setLatencyThresholds(thresholds)`

## Requirements Compliance

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| REQ-016 | ✅ | Timestamps tracked for all 4 stages in MetricsTracker |
| REQ-017 | ✅ | Configurable thresholds with 250ms Baseten default |
| REQ-018 | ✅ | Provider policies with data handling transparency |
| REQ-019 | ✅ | `storeAudioLocally` default false, opt-in only |
| REQ-020 | ✅ | `logTranscripts` default false, API key redaction |

## Integration Notes

### Using the Logger
```typescript
import { Logger, LogLevel } from './logging/index.js';

const logger = new Logger({ minLevel: LogLevel.INFO, component: 'my-module' });
logger.info('Message', { context: 'data' });  // API keys auto-redacted
```

### Using Metrics
```typescript
import { createMetricsTracker } from './logging/index.js';

const metrics = createMetricsTracker(logger);
metrics.startSession('session-123');
// ... after STT ...
metrics.recordSttComplete('session-123');
// ... complete ...
const latencies = metrics.completeSession('session-123');
```

### Privacy Redaction
```typescript
import { redactTranscript, maskApiKey } from './privacy/index.js';

const safe = redactTranscript(userText, config.logTranscripts);
const masked = maskApiKey(apiKey);  // "sk_12...34"
```

## JSDoc Provenance Tags

All files include proper provenance tags:
```typescript
/**
 * @task T016
 * @epic T001
 * @why Reason for existence
 * @what What the code does
 */
```
