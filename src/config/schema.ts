/**
 * @task T007
 * @epic T001
 * @why Configuration schema and type definitions for Voyc
 * @what Defines Config interface, defaults, and validation
 */

/**
 * Supported STT providers
 * @task T007
 * @epic T001
 * @why Type-safe provider selection
 * @what Union type of supported providers
 */
export type Provider = 'elevenlabs' | 'elevenlabs-realtime' | 'openai' | 'baseten';

/**
 * Silence timeout options in seconds
 * 0 means disabled
 * @task T007
 * @epic T001
 * @why Valid silence timeout values
 * @what Union type of allowed timeout values
 */
export type SilenceTimeout = 0 | 30 | 60;

/**
 * Hotkey configuration
 * @task T007
 * @epic T001
 * @why Configurable keyboard shortcuts
 * @what Defines hotkey strings for actions
 */
export interface Hotkeys {
    /** Hotkey for toggling dictation on/off */
    toggleDictation: string;
    /** Hotkey for pasting in terminal mode */
    pasteAsTerminal: string;
}

/**
 * Log level options
 * @task T016
 * @epic T001
 * @why Configurable logging verbosity per T016
 * @what Available log levels for the application
 */
export type LogLevelConfig = 'error' | 'warn' | 'info' | 'debug';

/**
 * Latency threshold configuration
 * @task T016
 * @epic T001
 * @why Configurable latency alerts per REQ-017
 * @what Threshold values for latency monitoring
 */
export interface LatencyThresholds {
    /** Baseten post-processing target in ms (default: 250ms per REQ-017) */
    basetenPostProcessMs: number;
    /** Total dictation latency warning threshold in ms */
    totalLatencyMs: number;
    /** STT latency warning threshold in ms */
    sttLatencyMs: number;
}

/**
 * Main configuration interface
 * Defines all user-configurable settings
 * 
 * @task T007
 * @epic T001
 * @why Complete configuration schema for the application
 * @what All settings for providers, audio, hotkeys, privacy, and logging
 */
export interface Config {
    /** Selected STT provider */
    provider: Provider;
    
    // ElevenLabs settings
    /** ElevenLabs API key */
    elevenlabsApiKey: string;
    /** ElevenLabs API endpoint */
    elevenlabsEndpoint: string;
    
    // OpenAI settings
    /** OpenAI API key */
    openaiApiKey: string;
    /** OpenAI API endpoint */
    openaiEndpoint: string;
    
    // Baseten settings
    /** Baseten API key */
    basetenApiKey: string;
    /** Baseten API endpoint */
    basetenEndpoint: string;
    
    // App settings
    /** Silence timeout in seconds (0 = disabled) */
    silenceTimeout: SilenceTimeout;
    /** Whether to autostart on login */
    autostart: boolean;
    
    // Hotkeys
    /** Hotkey configuration */
    hotkeys: Hotkeys;
    
    // Audio
    /** Audio device ID (null = default) */
    audioDevice: string | null;
    
    // Privacy
    /** Enable LLM post-processing */
    enablePostProcessing: boolean;
    /** Log transcripts to file (default: false per REQ-020) */
    logTranscripts: boolean;
    /** Store raw audio locally (default: false per REQ-019) */
    storeAudioLocally: boolean;
    /** Audio retention period in days (0 = no retention) */
    audioRetentionDays: number;
    
    // Logging
    /** Minimum log level (default: info) */
    logLevel: LogLevelConfig;
    
    // Metrics
    /** Latency threshold configuration */
    latencyThresholds: LatencyThresholds;
    /** Enable latency threshold alerts */
    enableLatencyAlerts: boolean;
}

/**
 * Default configuration values
 * Used when creating new config or missing fields
 * 
 * @task T007
 * @epic T001
 * @why Sensible defaults for first-run experience
 * @what Default values for all config fields
 */
export const DEFAULT_CONFIG: Config = {
    // Default to ElevenLabs as primary provider per SPEC-REQ-006
    provider: 'elevenlabs',
    
    // ElevenLabs defaults per SPEC-REQ-007
    elevenlabsApiKey: '',
    elevenlabsEndpoint: 'https://api.elevenlabs.io/v1',
    
    // OpenAI defaults
    openaiApiKey: '',
    openaiEndpoint: 'https://api.openai.com/v1',
    
    // Baseten defaults for LLaMA post-processing per SPEC-REQ-012
    basetenApiKey: '',
    basetenEndpoint: '',
    
    // App defaults
    silenceTimeout: 30,
    autostart: true,
    
    // Hotkey defaults - Ctrl+Alt+D for dictate, Ctrl+Alt+T for terminal paste
    // These are easier to reach than Super combos and less likely to conflict
    hotkeys: {
        toggleDictation: '<Primary><Alt>d',
        pasteAsTerminal: '<Primary><Alt>t',
    },
    
    // Audio defaults
    audioDevice: null,
    
    // Privacy defaults (REQ-019, REQ-020)
    enablePostProcessing: true,
    logTranscripts: false,
    storeAudioLocally: false,
    audioRetentionDays: 0,
    
    // Logging defaults (T016)
    logLevel: 'info',
    
    // Metrics defaults (REQ-017)
    latencyThresholds: {
        basetenPostProcessMs: 250,  // REQ-017: <250ms target
        totalLatencyMs: 2000,       // 2 second total
        sttLatencyMs: 1500,         // 1.5 second STT
    },
    enableLatencyAlerts: true,
};

/**
 * Validate a provider string
 * 
 * @task T007
 * @epic T001
 * @why Ensure provider value is valid
 * @what Type guard for Provider type
 * @param {string} value - Value to validate
 * @returns {boolean} True if valid provider
 */
export function isValidProvider(value: string): value is Provider {
    return ['elevenlabs', 'elevenlabs-realtime', 'openai', 'baseten'].includes(value);
}

/**
 * Validate silence timeout value
 * 
 * @task T007
 * @epic T001
 * @why Ensure timeout is one of allowed values
 * @what Type guard for SilenceTimeout type
 * @param {number} value - Value to validate
 * @returns {boolean} True if valid timeout
 */
export function isValidSilenceTimeout(value: number): value is SilenceTimeout {
    return [0, 30, 60].includes(value);
}

/**
 * Validate a partial config object
 * Returns validated config with defaults applied
 * 
 * @task T007
 * @epic T001
 * @why Validate and sanitize loaded config
 * @what Validates fields and applies defaults where needed
 * @param {Partial<Config>} partial - Partial config to validate
 * @returns {Config} Validated config with defaults
 */
export function validateConfig(partial: Partial<Config>): Config {
    const config: Config = {
        ...DEFAULT_CONFIG,
    };
    
    // Validate provider
    if (partial.provider && isValidProvider(partial.provider)) {
        config.provider = partial.provider;
    }
    
    // Validate API keys and endpoints (strings only)
    if (typeof partial.elevenlabsApiKey === 'string') {
        config.elevenlabsApiKey = partial.elevenlabsApiKey;
    }
    if (typeof partial.elevenlabsEndpoint === 'string') {
        config.elevenlabsEndpoint = partial.elevenlabsEndpoint;
    }
    if (typeof partial.openaiApiKey === 'string') {
        config.openaiApiKey = partial.openaiApiKey;
    }
    if (typeof partial.openaiEndpoint === 'string') {
        config.openaiEndpoint = partial.openaiEndpoint;
    }
    if (typeof partial.basetenApiKey === 'string') {
        config.basetenApiKey = partial.basetenApiKey;
    }
    if (typeof partial.basetenEndpoint === 'string') {
        config.basetenEndpoint = partial.basetenEndpoint;
    }
    
    // Validate silence timeout
    if (typeof partial.silenceTimeout === 'number' && 
        isValidSilenceTimeout(partial.silenceTimeout)) {
        config.silenceTimeout = partial.silenceTimeout;
    }
    
    // Validate autostart
    if (typeof partial.autostart === 'boolean') {
        config.autostart = partial.autostart;
    }
    
    // Validate hotkeys
    if (partial.hotkeys && typeof partial.hotkeys === 'object') {
        if (typeof partial.hotkeys.toggleDictation === 'string') {
            config.hotkeys.toggleDictation = partial.hotkeys.toggleDictation;
        }
        if (typeof partial.hotkeys.pasteAsTerminal === 'string') {
            config.hotkeys.pasteAsTerminal = partial.hotkeys.pasteAsTerminal;
        }
    }
    
    // Validate audio device
    if (partial.audioDevice === null || typeof partial.audioDevice === 'string') {
        config.audioDevice = partial.audioDevice;
    }
    
    // Validate privacy settings
    if (typeof partial.enablePostProcessing === 'boolean') {
        config.enablePostProcessing = partial.enablePostProcessing;
    }
    if (typeof partial.logTranscripts === 'boolean') {
        config.logTranscripts = partial.logTranscripts;
    }
    if (typeof partial.storeAudioLocally === 'boolean') {
        config.storeAudioLocally = partial.storeAudioLocally;
    }
    if (typeof partial.audioRetentionDays === 'number' && partial.audioRetentionDays >= 0) {
        config.audioRetentionDays = partial.audioRetentionDays;
    }
    
    // Validate logging settings
    if (partial.logLevel && isValidLogLevel(partial.logLevel)) {
        config.logLevel = partial.logLevel;
    }
    
    // Validate metrics settings
    if (typeof partial.enableLatencyAlerts === 'boolean') {
        config.enableLatencyAlerts = partial.enableLatencyAlerts;
    }
    if (partial.latencyThresholds && typeof partial.latencyThresholds === 'object') {
        const thresholds = partial.latencyThresholds;
        if (typeof thresholds.basetenPostProcessMs === 'number' && thresholds.basetenPostProcessMs > 0) {
            config.latencyThresholds.basetenPostProcessMs = thresholds.basetenPostProcessMs;
        }
        if (typeof thresholds.totalLatencyMs === 'number' && thresholds.totalLatencyMs > 0) {
            config.latencyThresholds.totalLatencyMs = thresholds.totalLatencyMs;
        }
        if (typeof thresholds.sttLatencyMs === 'number' && thresholds.sttLatencyMs > 0) {
            config.latencyThresholds.sttLatencyMs = thresholds.sttLatencyMs;
        }
    }
    
    return config;
}

/**
 * Validate log level string
 * 
 * @task T016
 * @epic T001
 * @why Ensure log level is valid per T016
 * @what Type guard for LogLevelConfig
 * @param {string} value - Value to validate
 * @returns {boolean} True if valid log level
 */
export function isValidLogLevel(value: string): value is LogLevelConfig {
    return ['error', 'warn', 'info', 'debug'].includes(value);
}

/**
 * Check if config has valid API key for selected provider
 * 
 * @task T007
 * @epic T001
 * @why Verify provider is ready to use
 * @what Returns true if provider has non-empty API key
 * @param {Config} config - Config to check
 * @returns {boolean} True if provider has API key
 */
export function hasValidApiKey(config: Config): boolean {
    switch (config.provider) {
        case 'elevenlabs':
        case 'elevenlabs-realtime':
            return config.elevenlabsApiKey.length > 0;
        case 'openai':
            return config.openaiApiKey.length > 0;
        case 'baseten':
            return config.basetenApiKey.length > 0;
        default:
            return false;
    }
}

/**
 * Get the API key for the current provider
 * 
 * @task T007
 * @epic T001
 * @why Retrieve correct API key based on selected provider
 * @what Returns API key string for current provider
 * @param {Config} config - Config to read from
 * @returns {string} API key for current provider
 */
export function getCurrentApiKey(config: Config): string {
    switch (config.provider) {
        case 'elevenlabs':
        case 'elevenlabs-realtime':
            return config.elevenlabsApiKey;
        case 'openai':
            return config.openaiApiKey;
        case 'baseten':
            return config.basetenApiKey;
        default:
            return '';
    }
}

/**
 * Get the endpoint for the current provider
 * 
 * @task T007
 * @epic T001
 * @why Retrieve correct endpoint based on selected provider
 * @what Returns endpoint URL for current provider
 * @param {Config} config - Config to read from
 * @returns {string} Endpoint URL for current provider
 */
export function getCurrentEndpoint(config: Config): string {
    switch (config.provider) {
        case 'elevenlabs':
        case 'elevenlabs-realtime':
            return config.elevenlabsEndpoint;
        case 'openai':
            return config.openaiEndpoint;
        case 'baseten':
            return config.basetenEndpoint;
        default:
            return '';
    }
}
