/**
 * @task T011
 * @epic T001
 * @why Provider factory for runtime selection per REQ-006, REQ-010
 * @what Factory for creating STT providers based on configuration
 */

import {
  SttProvider,
  ElevenLabsConfig,
  OpenAIConfig,
} from './SttProvider.js';

import { ElevenLabsProvider, createElevenLabsProvider } from './ElevenLabsProvider.js';
import { ElevenLabsRealtimeProvider, createElevenLabsRealtimeProvider } from './ElevenLabsRealtimeProvider.js';
import { OpenAIProvider, createOpenAIProvider } from './OpenAIProvider.js';
import { Logger } from '../logging/Logger.js';
import { Config } from '../config/schema.js';

/**
 * Provider type enumeration
 * @task T011
 * @epic T001
 * @why Type-safe provider selection
 * @what Enum of supported providers
 */
export type ProviderType = 'elevenlabs' | 'elevenlabs-realtime' | 'openai';

/**
 * Provider factory configuration
 * @task T011
 * @epic T001
 * @why Configuration for factory
 * @what Settings for provider creation
 */
export interface ProviderFactoryConfig {
  /** Logger instance */
  logger: Logger;
  /** Application configuration */
  config: Config;
}

/**
 * Provider factory class
 * Creates and manages STT provider instances
 * 
 * @task T011
 * @epic T001
 * @why Runtime provider selection per REQ-006, REQ-010
 * @what Factory for creating providers from config
 */
export class ProviderFactory {
  private _logger: Logger;
  private _config: Config;
  private _providers: Map<ProviderType, SttProvider> = new Map();
  private _currentProvider: SttProvider | null = null;

  /**
   * Create provider factory
   * 
   * @task T011
   * @epic T001
   * @why Initialize factory with configuration
   * @what Sets up factory with logger and config
   * @param {ProviderFactoryConfig} config - Factory configuration
   */
  constructor(config: ProviderFactoryConfig) {
    this._logger = config.logger.child('provider-factory');
    this._config = config.config;

    this._logger.debug('Provider factory initialized', {
      provider: this._config.provider,
    });
  }

  /**
   * Get the current provider based on configuration
   * Creates provider if not already cached
   * 
   * @task T011
   * @epic T001
   * @why Lazy provider initialization
   * @what Returns current provider, creating if needed
   * @returns {SttProvider} Current STT provider
   * @throws {Error} If provider type is unsupported or not configured
   */
  getCurrentProvider(): SttProvider {
    const providerType = this._config.provider as ProviderType;

    // Return cached provider if available and config hasn't changed
    if (this._currentProvider && this._providers.has(providerType)) {
      return this._currentProvider;
    }

    // Create new provider
    this._currentProvider = this.createProvider(providerType);
    this._providers.set(providerType, this._currentProvider);

    return this._currentProvider;
  }

  /**
   * Create a specific provider by type
   * 
   * @task T011
   * @epic T001
   * @why Create providers on demand
   * @what Instantiates provider with config
   * @param {ProviderType} type - Provider type
   * @returns {SttProvider} Created provider
   * @throws {Error} If provider type is unsupported
   */
  createProvider(type: ProviderType): SttProvider {
    this._logger.debug('Creating provider', { type });

    switch (type) {
      case 'elevenlabs':
        return this._createElevenLabsProvider();
      case 'elevenlabs-realtime':
        return this._createElevenLabsRealtimeProvider();
      case 'openai':
        return this._createOpenAIProvider();
      default:
        // Type guard - should not reach here with valid ProviderType
        throw new Error(`Unsupported provider type: ${type}`);
    }
  }

  /**
   * Create ElevenLabs provider
   * Per SPEC-REQ-006: ElevenLabs is default provider
   * 
   * @task T011
   * @epic T001
   * @why Factory method for ElevenLabs
   * @what Creates ElevenLabs provider from config
   * @returns {ElevenLabsProvider} Configured provider
   * @throws {Error} If API key not configured
   */
  private _createElevenLabsProvider(): ElevenLabsProvider {
    const config: ElevenLabsConfig = {
      apiKey: this._config.elevenlabsApiKey,
      endpoint: this._config.elevenlabsEndpoint,
      defaultModel: 'scribe_v2', // Per SPEC-REQ-006
    };

    if (!config.apiKey || config.apiKey.length === 0) {
      this._logger.warn('ElevenLabs API key not configured');
      // Still create provider - will throw on use
    }

    return createElevenLabsProvider(config, this._logger);
  }

  /**
   * Create ElevenLabs realtime provider
   * Per SPEC-REQ-009: ElevenLabs realtime streaming (experimental)
   * 
   * @task T012
   * @epic T001
   * @why Factory method for ElevenLabs realtime streaming
   * @what Creates ElevenLabsRealtimeProvider from config
   * @returns {ElevenLabsRealtimeProvider} Configured provider
   * @throws {Error} If API key not configured
   * @experimental Realtime STT is experimental
   */
  private _createElevenLabsRealtimeProvider(): ElevenLabsRealtimeProvider {
    const config: ElevenLabsConfig = {
      apiKey: this._config.elevenlabsApiKey,
      endpoint: this._config.elevenlabsEndpoint,
      defaultModel: 'scribe_v2_realtime', // Per SPEC-REQ-009
    };

    if (!config.apiKey || config.apiKey.length === 0) {
      this._logger.warn('ElevenLabs API key not configured for realtime');
      // Still create provider - will throw on use
    }

    this._logger.info('Creating ElevenLabs realtime provider (experimental)');
    return createElevenLabsRealtimeProvider(config, this._logger);
  }

  /**
   * Create OpenAI provider
   * Per SPEC-REQ-010: OpenAI as alternate provider
   * 
   * @task T011
   * @epic T001
   * @why Factory method for OpenAI
   * @what Creates OpenAI provider from config
   * @returns {OpenAIProvider} Configured provider
   * @throws {Error} If API key not configured
   */
  private _createOpenAIProvider(): OpenAIProvider {
    const config: OpenAIConfig = {
      apiKey: this._config.openaiApiKey,
      endpoint: this._config.openaiEndpoint,
      defaultModel: 'whisper-1', // Per SPEC-REQ-010
      responseFormat: 'json',
      temperature: 0,
    };

    if (!config.apiKey || config.apiKey.length === 0) {
      this._logger.warn('OpenAI API key not configured');
      // Still create provider - will throw on use
    }

    return createOpenAIProvider(config, this._logger);
  }

  /**
   * Update configuration and invalidate cached providers
   * 
   * @task T011
   * @epic T001
   * @why React to config changes
   * @what Updates config and clears provider cache
   * @param {Config} config - New configuration
   */
  updateConfig(config: Config): void {
    const oldProvider = this._config.provider;
    this._config = config;

    // If provider changed, clear current and dispose old
    if (oldProvider !== config.provider) {
      this._logger.debug('Provider changed, clearing cache', {
        from: oldProvider,
        to: config.provider,
      });

      // Dispose old provider if exists
      if (this._currentProvider) {
        if ('dispose' in this._currentProvider) {
          (this._currentProvider as ElevenLabsProvider | OpenAIProvider | ElevenLabsRealtimeProvider).dispose();
        }
        this._currentProvider = null;
      }

      // Clear all cached providers
      for (const [type, provider] of this._providers) {
        if ('dispose' in provider) {
          (provider as ElevenLabsProvider | OpenAIProvider | ElevenLabsRealtimeProvider).dispose();
        }
      }
      this._providers.clear();
    } else {
      // Same provider, update API keys if needed
      this._updateProviderKeys();
    }
  }

  /**
   * Update API keys on existing providers
   * 
   * @task T011
   * @epic T001
   * @why Update keys without recreating providers
   * @what Propagates key changes to cached providers
   */
  private _updateProviderKeys(): void {
    // Update ElevenLabs
    const elevenLabs = this._providers.get('elevenlabs') as ElevenLabsProvider | undefined;
    if (elevenLabs && this._config.elevenlabsApiKey !== elevenLabs['name']) {
      elevenLabs.setApiKey(this._config.elevenlabsApiKey);
    }

    // Update ElevenLabs Realtime
    const elevenLabsRealtime = this._providers.get('elevenlabs-realtime') as ElevenLabsRealtimeProvider | undefined;
    if (elevenLabsRealtime && this._config.elevenlabsApiKey !== elevenLabsRealtime['name']) {
      elevenLabsRealtime.setApiKey(this._config.elevenlabsApiKey);
    }

    // Update OpenAI
    const openai = this._providers.get('openai') as OpenAIProvider | undefined;
    if (openai && this._config.openaiApiKey !== openai['name']) {
      openai.setApiKey(this._config.openaiApiKey);
    }
  }

  /**
   * Check if current provider has valid API key
   * 
   * @task T011
   * @epic T001
   * @why Validate provider configuration
   * @what Returns true if provider is ready to use
   * @returns {boolean} True if configured
   */
  isConfigured(): boolean {
    switch (this._config.provider) {
      case 'elevenlabs':
      case 'elevenlabs-realtime':
        return this._config.elevenlabsApiKey.length > 0;
      case 'openai':
        return this._config.openaiApiKey.length > 0;
      default:
        return false;
    }
  }

  /**
   * Get current provider type
   * 
   * @task T011
   * @epic T001
   * @why Check which provider is active
   * @what Returns current provider type
   * @returns {ProviderType} Current provider
   */
  getCurrentProviderType(): ProviderType {
    return this._config.provider as ProviderType;
  }

  /**
   * List available provider types
   * 
   * @task T011
   * @epic T001
   * @why UI for provider selection
   * @what Returns all supported provider types
   * @returns {ProviderType[]} Available providers
   */
  getAvailableProviders(): ProviderType[] {
    return ['elevenlabs', 'elevenlabs-realtime', 'openai'];
  }

  /**
   * Get provider display name
   * 
   * @task T011
   * @epic T001
   * @why Human-readable provider names
   * @what Returns display name for provider type
   * @param {ProviderType} type - Provider type
   * @returns {string} Display name
   */
  getProviderDisplayName(type: ProviderType): string {
    switch (type) {
      case 'elevenlabs':
        return 'ElevenLabs (Scribe v2)';
      case 'elevenlabs-realtime':
        return 'ElevenLabs Realtime (Experimental)';
      case 'openai':
        return 'OpenAI (Whisper)';
      default:
        return type;
    }
  }

  /**
   * Check if provider is experimental
   * 
   * @task T012
   * @epic T001
   * @why Identify experimental providers
   * @what Returns true for experimental providers
   * @experimental Realtime STT is experimental
   * @param {ProviderType} type - Provider type
   * @returns {boolean} True if experimental
   */
  isExperimental(type: ProviderType): boolean {
    return type === 'elevenlabs-realtime';
  }

  /**
   * Get provider capabilities
   * 
   * @task T011
   * @epic T001
   * @why Check provider features
   * @what Returns capability info for provider
   * @param {ProviderType} type - Provider type
   * @returns {object} Provider capabilities
   */
  getProviderCapabilities(type: ProviderType): {
    batchTranscription: boolean;
    streamingTranscription: boolean;
    supportsStreaming: boolean;
  } {
    switch (type) {
      case 'elevenlabs':
        return {
          batchTranscription: true,
          streamingTranscription: false,
          supportsStreaming: false,
        };
      case 'elevenlabs-realtime':
        return {
          batchTranscription: false,
          streamingTranscription: true,
          supportsStreaming: true,
        };
      case 'openai':
        return {
          batchTranscription: true,
          streamingTranscription: false,
          supportsStreaming: false,
        };
      default:
        return {
          batchTranscription: false,
          streamingTranscription: false,
          supportsStreaming: false,
        };
    }
  }

  /**
   * Dispose of all providers and clean up
   * 
   * @task T011
   * @epic T001
   * @why Clean up resources
   * @what Disposes all cached providers
   */
  dispose(): void {
    this._logger.debug('Disposing provider factory');

    for (const [type, provider] of this._providers) {
      if ('dispose' in provider) {
        (provider as ElevenLabsProvider | OpenAIProvider | ElevenLabsRealtimeProvider).dispose();
      }
    }
    this._providers.clear();
    this._currentProvider = null;
  }
}

/**
 * Create provider factory
 * 
 * @task T011
 * @epic T001
 * @why Factory function for convenience
 * @what Creates ProviderFactory with config
 * @param {ProviderFactoryConfig} config - Factory configuration
 * @returns {ProviderFactory} Configured factory
 */
export function createProviderFactory(config: ProviderFactoryConfig): ProviderFactory {
  return new ProviderFactory(config);
}

/**
 * Quick provider creation for simple use cases
 * Creates provider directly without factory caching
 * 
 * @task T011
 * @epic T001
 * @why Simple provider creation
 * @what Creates provider from config without factory overhead
 * @param {Config} config - Application config
 * @param {Logger} logger - Logger instance
 * @returns {SttProvider} Configured provider
 * @throws {Error} If provider type unsupported
 */
export function createProviderFromConfig(
  config: Config,
  logger: Logger
): SttProvider {
  const factory = createProviderFactory({ config, logger });
  return factory.getCurrentProvider();
}
