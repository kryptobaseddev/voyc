# Post-Processing Pipeline Implementation (T013)

**Date:** 2026-01-27  
**Task:** T013 - Post-processing pipeline (Baseten LLaMA + chain)  
**Epic:** T001 - Build application from claudedocs/prd.md

## Summary

Implemented a multi-LLM post-processing pipeline with Baseten LLaMA as the default provider, supporting configurable multi-stage chains with per-stage latency tracking.

## Implementation

### Files Created

1. **`src/postprocess/PostProcessor.ts`** - Core interface definitions
   - `PostProcessor` interface with `process()`, `isConfigured()`, `setApiKey()`, `dispose()` methods
   - `ProcessContext` for context-aware formatting (language, target app, isCommand)
   - `ProcessResult` with text, latency, tokensUsed, model, modified fields
   - Error classes: `PostProcessError`, `PostProcessAuthError`, `PostProcessNetworkError`, `PostProcessRateLimitError`
   - Configuration interfaces: `PostProcessorConfig`, `BasetenConfig`, `OpenAIPostProcessConfig`
   - `PipelineStage` interface for multi-stage configuration

2. **`src/postprocess/BasetenProvider.ts`** - Baseten LLaMA implementation
   - Implements `PostProcessor` interface
   - Uses OpenAI-compatible chat completion API format
   - Default system prompt optimized for fast formatting
   - Target latency: <250ms (per REQ-017)
   - Supports custom endpoints (Baseten is deployment-specific)
   - Authentication via `Api-Key` header
   - Default model: `llama-3.1-8b`
   - Temperature: 0.1 for deterministic formatting

3. **`src/postprocess/OpenAIProvider.ts`** - OpenAI GPT implementation
   - Implements `PostProcessor` interface
   - Uses OpenAI Chat Completions API
   - Default model: `gpt-4o-mini` for speed/cost balance
   - Alternative polish prompt available for advanced refinement
   - Temperature: 0.1 for consistent formatting
   - Standard Bearer token authentication

4. **`src/postprocess/Pipeline.ts`** - Multi-stage pipeline orchestrator
   - `PostProcessPipeline` class for chaining multiple processors
   - Per-stage latency tracking (REQ-017)
   - Configurable stage ordering (REQ-013)
   - Error handling with `continueOnError` option
   - Max total latency enforcement
   - `PipelineResult` with aggregate metrics
   - Factory function `createPipeline()` that auto-configures from app Config

5. **`src/postprocess/index.ts`** - Module exports
   - Exports all types, classes, and functions
   - Constants: `DEFAULT_MODELS`, `LATENCY_TARGETS`, `PROVIDER_METADATA`
   - Pipeline presets: `BASETEN_ONLY`, `OPENAI_ONLY`, `BASETEN_THEN_OPENAI`, `OPENAI_THEN_BASETEN`

## Architecture

### Provider Pattern

Following the STT provider pattern from T011:

```typescript
interface PostProcessor {
  readonly name: string;
  readonly displayName: string;
  process(text: string, context?: ProcessContext): Promise<ProcessResult>;
  isConfigured(): boolean;
  setApiKey(apiKey: string): void;
  dispose?(): void;
}
```

### Pipeline Flow

```
Raw STT Text → Stage 1 (Baseten) → Stage 2 (OpenAI) → Final Text
                    ↓                      ↓
               Latency: 180ms          Latency: 220ms
                    ↓                      ↓
               Tokens: 150             Tokens: 200
```

### Integration with Config

The pipeline auto-configures from the existing Config interface:

```typescript
// From src/config/schema.ts
interface Config {
  enablePostProcessing: boolean;  // Master toggle
  basetenApiKey: string;          // Baseten auth
  basetenEndpoint: string;        // Baseten deployment URL
  openaiApiKey: string;           // OpenAI auth
  openaiEndpoint: string;         // OpenAI base URL
  latencyThresholds: {
    basetenPostProcessMs: 250;    // REQ-017 target
    totalLatencyMs: 2000;
    sttLatencyMs: 1500;
  };
}
```

## Requirements Compliance

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| REQ-011 | ✅ | Pipeline supports smart formatting and context-aware edits |
| REQ-012 | ✅ | Baseten LLaMA is default when configured |
| REQ-013 | ✅ | Multi-stage chain support with configurable ordering |
| REQ-017 | ✅ | Per-stage latency tracking, <250ms Baseten target |

## Usage Example

```typescript
import { createPipeline } from './postprocess/index.js';

// Create pipeline from config
const pipeline = createPipeline(config, logger);

// Process text
const result = await pipeline.process(rawText, {
  language: 'en',
  targetApp: 'editor',
  isCommand: false,
});

console.log(`Processed in ${result.totalLatency}ms`);
console.log(`Stages: ${result.stages.map(s => `${s.stageName}: ${s.latency}ms`).join(', ')}`);
```

## Latency Targets

Per SPEC-REQ-017:
- **Baseten LLaMA**: <250ms (primary target)
- **OpenAI GPT**: <500ms (more lenient)
- **Total post-processing**: <1000ms

The pipeline logs warnings when targets are exceeded and supports configurable thresholds.

## Dependencies

- GJS/Soup 3.0 for HTTP requests
- GLib for timing
- Existing Logger from `src/logging/Logger.js`
- Existing Config from `src/config/schema.js`

## Future Enhancements

1. Streaming support for lower latency
2. Caching for repeated phrases
3. Per-app formatting profiles
4. Custom prompt editor
5. Offline fallback mode
