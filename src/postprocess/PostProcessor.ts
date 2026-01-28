/**
 * @task T013
 * @epic T001
 * @why Smart formatting and corrections beyond raw STT
 * @what Post-processor interface definitions for multi-LLM pipeline
 */

/**
 * Process context for post-processing
 * Provides additional context to help the LLM format appropriately
 * @task T013
 * @epic T001
 * @why Context-aware formatting per REQ-011
 * @what Context data for post-processing decisions
 */
export interface ProcessContext {
  /** Detected language code (e.g., 'en', 'es') */
  language?: string;
  /** Whether this appears to be a command vs dictation */
  isCommand?: boolean;
  /** Previous context text for continuity */
  previousText?: string;
  /** Target application type (terminal, editor, etc.) */
  targetApp?: 'terminal' | 'editor' | 'browser' | 'default';
  /** Audio duration in seconds */
  audioDuration?: number;
  /** Confidence score from STT (0-1) */
  confidence?: number;
}

/**
 * Post-processing result
 * Contains formatted text and metadata
 * @task T013
 * @epic T001
 * @why Standard result format across all post-processors
 * @what Formatted text with latency and usage metrics
 */
export interface ProcessResult {
  /** Formatted/processed text */
  text: string;
  /** Latency in milliseconds */
  latency: number;
  /** Tokens used (if available from provider) */
  tokensUsed?: number;
  /** Model name used for processing */
  model?: string;
  /** Whether any changes were made to the text */
  modified: boolean;
}

/**
 * Post-processor error types
 * @task T013
 * @epic T001
 * @why Specific error types for different failure modes
 * @what Error classes for post-processing failures
 */
export class PostProcessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostProcessError';
  }
}

/**
 * Authentication error
 * @task T013
 * @epic T001
 * @why Handle API key issues specifically
 * @what Thrown when authentication fails
 */
export class PostProcessAuthError extends PostProcessError {
  constructor(provider: string, details?: string) {
    super(`${provider} authentication failed${details ? ': ' + details : ''}`);
    this.name = 'PostProcessAuthError';
  }
}

/**
 * Network error
 * @task T013
 * @epic T001
 * @why Handle network/connectivity issues
 * @what Thrown when network request fails
 */
export class PostProcessNetworkError extends PostProcessError {
  constructor(provider: string, details?: string) {
    super(`${provider} network error${details ? ': ' + details : ''}`);
    this.name = 'PostProcessNetworkError';
  }
}

/**
 * Rate limit error
 * @task T013
 * @epic T001
 * @why Handle rate limiting specifically
 * @what Thrown when rate limit is exceeded
 */
export class PostProcessRateLimitError extends PostProcessError {
  /** Retry after seconds if known */
  retryAfter?: number;

  constructor(provider: string, retryAfter?: number) {
    super(`${provider} rate limit exceeded${retryAfter ? `, retry after ${retryAfter}s` : ''}`);
    this.name = 'PostProcessRateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Post-processor configuration
 * @task T013
 * @epic T001
 * @why Configuration for post-processor instances
 * @what API keys and endpoints for providers
 */
export interface PostProcessorConfig {
  /** API key for the provider */
  apiKey: string;
  /** API endpoint URL (optional, uses default if not provided) */
  endpoint?: string;
  /** Default model ID (optional) */
  defaultModel?: string;
  /** Request timeout in seconds (default: 30) */
  timeout?: number;
}

/**
 * Baseten-specific configuration
 * @task T013
 * @epic T001
 * @why Baseten-specific options per REQ-012
 * @what Configuration specific to Baseten LLaMA provider
 */
export interface BasetenConfig extends PostProcessorConfig {
  /** Default model - typically llama-3.x variant */
  defaultModel?: string;
  /** Temperature for sampling (0-1, default: 0.1 for deterministic formatting) */
  temperature?: number;
  /** Maximum tokens to generate (default: 1024) */
  maxTokens?: number;
}

/**
 * OpenAI-specific configuration for post-processing
 * @task T013
 * @epic T001
 * @why OpenAI-specific options for GPT post-processing
 * @what Configuration specific to OpenAI provider
 */
export interface OpenAIPostProcessConfig extends PostProcessorConfig {
  /** Default model - defaults to gpt-4o-mini for speed/cost */
  defaultModel?: string;
  /** Temperature for sampling (0-1, default: 0.1) */
  temperature?: number;
  /** Maximum tokens to generate (default: 1024) */
  maxTokens?: number;
}

/**
 * Post-processor stage configuration
 * Defines a single stage in the pipeline
 * @task T013
 * @epic T001
 * @why Pipeline stage definition per REQ-013
 * @what Configuration for a single processing stage
 */
export interface PipelineStage {
  /** Stage name/identifier */
  name: string;
  /** Provider type */
  provider: 'baseten' | 'openai';
  /** Whether this stage is enabled */
  enabled: boolean;
  /** Stage-specific configuration */
  config?: Partial<PostProcessorConfig>;
  /** Stage-specific prompt override */
  prompt?: string;
}

/**
 * Post-processor interface
 * Abstract interface for all post-processing providers
 * 
 * @task T013
 * @epic T001
 * @why Abstract post-processors for flexibility per REQ-011, REQ-013
 * @what Common interface for all text post-processing providers
 */
export interface PostProcessor {
  /** Provider name */
  readonly name: string;
  /** Provider display name */
  readonly displayName: string;

  /**
   * Process text through the post-processor
   * 
   * @task T013
   * @epic T001
   * @why Core post-processing functionality per REQ-011
   * @what Sends text to LLM for formatting and corrections
   * @param {string} text - Raw text to process
   * @param {ProcessContext} [context] - Optional processing context
   * @returns {Promise<ProcessResult>} Processed result with metadata
   * @throws {PostProcessAuthError} If authentication fails
   * @throws {PostProcessNetworkError} If network request fails
   * @throws {PostProcessRateLimitError} If rate limit exceeded
   * @throws {PostProcessError} For other processing errors
   */
  process(text: string, context?: ProcessContext): Promise<ProcessResult>;

  /**
   * Check if the provider is properly configured
   * 
   * @task T013
   * @epic T001
   * @why Validate provider readiness
   * @what Returns true if provider has valid API key
   * @returns {boolean} True if configured
   */
  isConfigured(): boolean;

  /**
   * Update API key at runtime
   * 
   * @task T013
   * @epic T001
   * @why Allow key updates without recreating provider
   * @param {string} apiKey - New API key
   */
  setApiKey(apiKey: string): void;

  /**
   * Dispose of resources
   * 
   * @task T013
   * @epic T001
   * @why Clean up resources
   */
  dispose?(): void;
}
