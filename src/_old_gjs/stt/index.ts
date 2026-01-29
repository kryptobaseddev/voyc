/**
 * @task T011
 * @epic T001
 * @why STT module exports
 * @what Central export point for all STT functionality
 */

// Provider interface and types
export {
  // Core interfaces
  type SttProvider,
  type TranscribeOptions,
  type TranscribeResult,
  type StreamOptions,
  type StreamConnection,
  type ProviderConfig,
  type ElevenLabsConfig,
  type OpenAIConfig,
  
  // Error classes
  SttError,
  SttAuthError,
  SttNetworkError,
  SttRateLimitError,
} from './SttProvider.js';

// ElevenLabs provider
export {
  ElevenLabsProvider,
  createElevenLabsProvider,
} from './ElevenLabsProvider.js';

// ElevenLabs realtime provider (T012)
export {
  ElevenLabsRealtimeProvider,
  createElevenLabsRealtimeProvider,
} from './ElevenLabsRealtimeProvider.js';

// OpenAI provider
export {
  OpenAIProvider,
  createOpenAIProvider,
} from './OpenAIProvider.js';

// Provider factory
export {
  ProviderFactory,
  createProviderFactory,
  createProviderFromConfig,
  type ProviderType,
  type ProviderFactoryConfig,
} from './ProviderFactory.js';

// Streaming audio buffer (T012)
export {
  StreamingAudioBuffer,
  createStreamingBuffer,
  calculateChunkSize,
  DEFAULT_CHUNK_SIZE,
  STREAMING_AUDIO_FORMAT,
  type ChunkCallback,
} from './StreamingAudioBuffer.js';

/**
 * @task T011
 * @epic T001
 * @why Default model constants
 * @what Provider-specific default models per spec
 */
export const DEFAULT_MODELS = {
  /** ElevenLabs default: Scribe v2 per REQ-006 */
  ELEVENLABS: 'scribe_v2',
  /** ElevenLabs realtime default: Scribe v2 Realtime per REQ-009 */
  ELEVENLABS_REALTIME: 'scribe_v2_realtime',
  /** OpenAI default: Whisper-1 per REQ-010 */
  OPENAI: 'whisper-1',
} as const;

/**
 * @task T011
 * @epic T001
 * @why Provider endpoint constants
 * @what Default API endpoints
 */
export const DEFAULT_ENDPOINTS = {
  /** ElevenLabs API base URL per REQ-007 */
  ELEVENLABS: 'https://api.elevenlabs.io/v1',
  /** OpenAI API base URL per REQ-010 */
  OPENAI: 'https://api.openai.com/v1',
} as const;

/**
 * @task T011
 * @epic T001
 * @why Supported audio formats
 * @what Audio format requirements for STT
 */
export const SUPPORTED_AUDIO_FORMATS = {
  /** WAV format - recommended for best compatibility */
  WAV: {
    mimeType: 'audio/wav',
    extensions: ['.wav'],
    recommended: true,
  },
  /** MP3 format - supported by most providers */
  MP3: {
    mimeType: 'audio/mpeg',
    extensions: ['.mp3'],
    recommended: false,
  },
  /** MP4/M4A format */
  MP4: {
    mimeType: 'audio/mp4',
    extensions: ['.mp4', '.m4a'],
    recommended: false,
  },
  /** OGG format */
  OGG: {
    mimeType: 'audio/ogg',
    extensions: ['.ogg', '.oga'],
    recommended: false,
  },
  /** WebM format */
  WEBM: {
    mimeType: 'audio/webm',
    extensions: ['.webm'],
    recommended: false,
  },
  /** FLAC format */
  FLAC: {
    mimeType: 'audio/flac',
    extensions: ['.flac'],
    recommended: false,
  },
} as const;

/**
 * @task T011
 * @epic T001
 * @why Provider capabilities
 * @what Feature support matrix for providers
 */
export const PROVIDER_CAPABILITIES = {
  /** ElevenLabs capabilities */
  elevenlabs: {
    /** Supports batch transcription */
    batchTranscription: true,
    /** Supports streaming (T012) */
    streamingTranscription: true,
    /** Supports language detection */
    languageDetection: true,
    /** Supports word-level timestamps */
    wordTimestamps: true,
    /** Supports speaker diarization */
    speakerDiarization: false,
    /** Maximum file size in MB */
    maxFileSizeMb: 50,
    /** Maximum duration in minutes */
    maxDurationMinutes: 120,
  },
  /** ElevenLabs realtime capabilities - T012 */
  elevenlabs_realtime: {
    /** Supports batch transcription */
    batchTranscription: false,
    /** Supports streaming (T012) */
    streamingTranscription: true,
    /** Supports language detection */
    languageDetection: true,
    /** Supports word-level timestamps */
    wordTimestamps: false,
    /** Supports speaker diarization */
    speakerDiarization: false,
    /** Maximum file size in MB - N/A for streaming */
    maxFileSizeMb: 0,
    /** Maximum duration in minutes */
    maxDurationMinutes: 120,
  },
  /** OpenAI capabilities */
  openai: {
    /** Supports batch transcription */
    batchTranscription: true,
    /** Supports streaming */
    streamingTranscription: false,
    /** Supports language detection */
    languageDetection: true,
    /** Supports word-level timestamps */
    wordTimestamps: true,
    /** Supports speaker diarization */
    speakerDiarization: false,
    /** Maximum file size in MB */
    maxFileSizeMb: 25,
    /** Maximum duration in minutes */
    maxDurationMinutes: 120,
  },
} as const;

/**
 * @task T011
 * @epic T001
 * @why Provider metadata for UI
 * @what Display information for providers
 */
export const PROVIDER_METADATA = {
  /** ElevenLabs metadata */
  elevenlabs: {
    name: 'ElevenLabs',
    displayName: 'ElevenLabs Scribe',
    description: 'High-accuracy speech-to-text with Scribe v2',
    defaultModel: 'scribe_v2',
    website: 'https://elevenlabs.io',
    requiresApiKey: true,
    apiKeyUrl: 'https://elevenlabs.io/app/settings/api-keys',
  },
  /** ElevenLabs realtime metadata - T012 */
  elevenlabs_realtime: {
    name: 'ElevenLabs Realtime',
    displayName: 'ElevenLabs Scribe Realtime (Experimental)',
    description: 'Low-latency streaming speech-to-text with Scribe v2 Realtime (Experimental)',
    defaultModel: 'scribe_v2_realtime',
    website: 'https://elevenlabs.io',
    requiresApiKey: true,
    apiKeyUrl: 'https://elevenlabs.io/app/settings/api-keys',
    experimental: true,
  },
  /** OpenAI metadata */
  openai: {
    name: 'OpenAI',
    displayName: 'OpenAI Whisper',
    description: 'Reliable speech-to-text with Whisper',
    defaultModel: 'whisper-1',
    website: 'https://openai.com',
    requiresApiKey: true,
    apiKeyUrl: 'https://platform.openai.com/api-keys',
  },
} as const;

/**
 * @task T012
 * @epic T001
 * @why Realtime STT configuration options
 * @what Configuration interface for streaming STT
 * @experimental Realtime STT is experimental
 */
export interface RealtimeSttConfig {
  /** Audio format for streaming */
  audioFormat: 'pcm' | 'mulaw';
  /** Enable Voice Activity Detection */
  enableVad: boolean;
  /** VAD mode */
  vadMode: 'normal' | 'aggressive' | 'disabled';
  /** Chunk duration in milliseconds */
  chunkDurationMs: number;
  /** Silence threshold in milliseconds for auto-stop */
  silenceThresholdMs: number;
}

/**
 * @task T012
 * @epic T001
 * @why Default realtime STT configuration
 * @what Sensible defaults for streaming STT
 * @experimental Realtime STT is experimental
 */
export const DEFAULT_REALTIME_CONFIG: RealtimeSttConfig = {
  audioFormat: 'pcm',
  enableVad: true,
  vadMode: 'normal',
  chunkDurationMs: 100,
  silenceThresholdMs: 500,
} as const;

/**
 * @task T011
 * @epic T001
 * @why STT error types
 * @what Error classes for export
 */

