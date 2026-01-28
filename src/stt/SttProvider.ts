/**
 * @task T011
 * @epic T001
 * @why Abstract STT providers for flexibility, ElevenLabs as primary
 * @what STT provider interface with ElevenLabs REST and OpenAI implementations
 */

/**
 * Transcription options
 * @task T011
 * @epic T001
 * @why Configure transcription behavior per request
 * @what Options for language, model, and format
 */
export interface TranscribeOptions {
  /** Language code (e.g., 'en', 'es', 'fr') - auto-detect if not specified */
  language?: string;
  /** Model ID to use - provider-specific */
  modelId?: string;
  /** Audio duration in seconds (for latency calculation) */
  duration?: number;
}

/**
 * Transcription result
 * @task T011
 * @epic T001
 * @why Standard result format across all providers
 * @what Text output with metadata and latency tracking
 */
export interface TranscribeResult {
  /** Transcribed text */
  text: string;
  /** Confidence score (0-1) if available */
  confidence?: number;
  /** Detected language code */
  language?: string;
  /** Audio duration in seconds */
  duration: number;
  /** Latency in milliseconds */
  latency: number;
}

/**
 * Stream options for streaming STT
 * @task T011
 * @epic T001
 * @why Configure streaming behavior for T012
 * @what Options for streaming transcription
 */
export interface StreamOptions {
  /** Language code */
  language?: string;
  /** Model ID for streaming */
  modelId?: string;
  /** VAD (Voice Activity Detection) options */
  vadOptions?: {
    /** VAD mode */
    mode?: 'normal' | 'aggressive' | 'disabled';
    /** Silence threshold in ms */
    silenceThresholdMs?: number;
  };
}

/**
 * Stream connection interface
 * @task T011
 * @epic T001
 * @why Abstraction for streaming connections
 * @what Methods for sending audio and receiving transcripts
 */
export interface StreamConnection {
  /** Send audio chunk */
  sendAudio(audioData: Uint8Array): void;
  /** End the stream */
  endStream(): void;
  /** Abort the connection */
  abort(): void;
  /** Register transcript callback */
  onTranscript(callback: (text: string, isFinal: boolean) => void): void;
  /** Register error callback */
  onError(callback: (error: Error) => void): void;
  /** Register close callback */
  onClose(callback: () => void): void;
}

/**
 * STT Provider error types
 * @task T011
 * @epic T001
 * @why Specific error types for different failure modes
 * @what Error classes for STT failures
 */
export class SttError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SttError';
  }
}

/**
 * Authentication error
 * @task T011
 * @epic T001
 * @why Handle API key issues specifically
 * @what Thrown when authentication fails
 */
export class SttAuthError extends SttError {
  constructor(provider: string, details?: string) {
    super(`${provider} authentication failed${details ? ': ' + details : ''}`);
    this.name = 'SttAuthError';
  }
}

/**
 * Network error
 * @task T011
 * @epic T001
 * @why Handle network/connectivity issues
 * @what Thrown when network request fails
 */
export class SttNetworkError extends SttError {
  constructor(provider: string, details?: string) {
    super(`${provider} network error${details ? ': ' + details : ''}`);
    this.name = 'SttNetworkError';
  }
}

/**
 * Rate limit error
 * @task T011
 * @epic T001
 * @why Handle rate limiting specifically
 * @what Thrown when rate limit is exceeded
 */
export class SttRateLimitError extends SttError {
  /** Retry after seconds if known */
  retryAfter?: number;

  constructor(provider: string, retryAfter?: number) {
    super(`${provider} rate limit exceeded${retryAfter ? `, retry after ${retryAfter}s` : ''}`);
    this.name = 'SttRateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * STT Provider interface
 * Abstract interface for all STT providers
 * 
 * @task T011
 * @epic T001
 * @why Abstract STT providers for flexibility
 * @what Common interface for all transcription providers
 */
export interface SttProvider {
  /** Provider name */
  readonly name: string;
  /** Whether provider supports streaming (for T012) */
  readonly supportsStreaming: boolean;

  /**
   * Transcribe audio data to text
   * 
   * @task T011
   * @epic T001
   * @why Core transcription functionality
   * @what Sends audio to provider API and returns text
   * @param {Uint8Array} audioData - Raw audio data (typically WAV format)
   * @param {TranscribeOptions} [options] - Transcription options
   * @returns {Promise<TranscribeResult>} Transcription result with metadata
   * @throws {SttAuthError} If authentication fails
   * @throws {SttNetworkError} If network request fails
   * @throws {SttRateLimitError} If rate limit exceeded
   * @throws {SttError} For other transcription errors
   */
  transcribe(audioData: Uint8Array, options?: TranscribeOptions): Promise<TranscribeResult>;

  /**
   * Connect to streaming STT endpoint
   * Optional - only for providers that support streaming
   * 
   * @task T011
   * @epic T001
   * @why Streaming transcription for lower latency (T012)
   * @what Establishes streaming connection for real-time transcription
   * @param {StreamOptions} [options] - Stream configuration
   * @returns {Promise<StreamConnection>} Stream connection handle
   * @throws {SttError} If streaming not supported or connection fails
   */
  connectStream?(options?: StreamOptions): Promise<StreamConnection>;
}

/**
 * Provider configuration
 * @task T011
 * @epic T001
 * @why Configuration for provider instances
 * @what API keys and endpoints for providers
 */
export interface ProviderConfig {
  /** API key for the provider */
  apiKey: string;
  /** API endpoint URL (optional, uses default if not provided) */
  endpoint?: string;
  /** Default model ID (optional) */
  defaultModel?: string;
}

/**
 * ElevenLabs-specific configuration
 * @task T011
 * @epic T001
 * @why ElevenLabs-specific options
 * @what Configuration specific to ElevenLabs provider
 */
export interface ElevenLabsConfig extends ProviderConfig {
  /** Default model - defaults to scribe_v2 */
  defaultModel?: 'scribe_v2' | 'scribe_v1' | string;
}

/**
 * OpenAI-specific configuration
 * @task T011
 * @epic T001
 * @why OpenAI-specific options
 * @what Configuration specific to OpenAI provider
 */
export interface OpenAIConfig extends ProviderConfig {
  /** Default model - defaults to whisper-1 */
  defaultModel?: 'whisper-1' | string;
  /** Response format */
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  /** Temperature for sampling (0-1) */
  temperature?: number;
}
