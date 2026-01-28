/**
 * @task T013
 * @epic T001
 * @why Post-processing module exports
 * @what Central export point for all post-processing functionality
 */

// Post-processor interface and types
export {
  // Core interfaces
  type PostProcessor,
  type ProcessContext,
  type ProcessResult,
  type PostProcessorConfig,
  type BasetenConfig,
  type OpenAIPostProcessConfig,
  type PipelineStage,
  
  // Error classes
  PostProcessError,
  PostProcessAuthError,
  PostProcessNetworkError,
  PostProcessRateLimitError,
} from './PostProcessor.js';

// Baseten provider
export {
  BasetenProvider,
  createBasetenProvider,
} from './BasetenProvider.js';

// OpenAI provider
export {
  OpenAIProvider,
  createOpenAIPostProcessProvider,
} from './OpenAIProvider.js';

// Pipeline
export {
  PostProcessPipeline,
  createPipeline,
  createPostProcessPipeline,
  createPipelineConfigFromAppConfig,
  type PipelineConfig,
  type PipelineResult,
  type PipelineStageResult,
} from './Pipeline.js';

/**
 * Default post-processor models
 * @task T013
 * @epic T001
 * @why Recommended models for each provider
 * @what Default model identifiers
 */
export const DEFAULT_MODELS = {
  /** Baseten default: LLaMA 3.1 8B for speed/quality balance */
  BASETEN: 'llama-3.1-8b',
  /** OpenAI default: GPT-4o mini for speed and cost */
  OPENAI: 'gpt-4o-mini',
  /** OpenAI alternative: GPT-4o for higher quality */
  OPENAI_PREMIUM: 'gpt-4o',
} as const;

/**
 * Default latency targets per SPEC-REQ-017
 * @task T013
 * @epic T001
 * @why Latency requirements for post-processing
 * @what Target latency values in milliseconds
 */
export const LATENCY_TARGETS = {
  /** Baseten LLaMA target: <250ms per REQ-017 */
  BASETEN_MS: 250,
  /** OpenAI GPT target: <500ms (more lenient) */
  OPENAI_MS: 500,
  /** Total post-processing target */
  TOTAL_MS: 1000,
} as const;

/**
 * Provider metadata for UI
 * @task T013
 * @epic T001
 * @why Display information for post-processors
 * @what Metadata for each supported provider
 */
export const PROVIDER_METADATA = {
  /** Baseten LLaMA metadata */
  baseten: {
    name: 'baseten',
    displayName: 'Baseten LLaMA',
    description: 'Fast local-style inference with LLaMA (default)',
    defaultModel: DEFAULT_MODELS.BASETEN,
    targetLatencyMs: LATENCY_TARGETS.BASETEN_MS,
    requiresEndpoint: true,
    website: 'https://baseten.co',
  },
  /** OpenAI GPT metadata */
  openai: {
    name: 'openai',
    displayName: 'OpenAI GPT',
    description: 'Reliable formatting with GPT models',
    defaultModel: DEFAULT_MODELS.OPENAI,
    targetLatencyMs: LATENCY_TARGETS.OPENAI_MS,
    requiresEndpoint: false,
    website: 'https://openai.com',
  },
} as const;

/**
 * Pipeline stage presets
 * Common pipeline configurations
 * @task T013
 * @epic T001
 * @why Predefined pipeline configurations
 * @what Common stage arrangements
 */
export const PIPELINE_PRESETS = {
  /** Single-stage Baseten formatting (default per REQ-012) */
  BASETEN_ONLY: [
    { name: 'format', provider: 'baseten' as const, enabled: true },
  ],
  /** Single-stage OpenAI formatting */
  OPENAI_ONLY: [
    { name: 'format', provider: 'openai' as const, enabled: true },
  ],
  /** Two-stage: Baseten format → OpenAI polish */
  BASETEN_THEN_OPENAI: [
    { name: 'format', provider: 'baseten' as const, enabled: true },
    { name: 'polish', provider: 'openai' as const, enabled: true },
  ],
  /** Two-stage: OpenAI format → Baseten refine (if Baseten faster for final pass) */
  OPENAI_THEN_BASETEN: [
    { name: 'format', provider: 'openai' as const, enabled: true },
    { name: 'refine', provider: 'baseten' as const, enabled: true },
  ],
} as const;

/**
 * Post-processing error types
 * @task T013
 * @epic T001
 * @why Error type exports
 * @what Error classes for type checking
 */

