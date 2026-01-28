/**
 * @task T013
 * @epic T001
 * @why Multi-stage post-processing pipeline per REQ-011, REQ-013
 * @what Pipeline orchestrator for chaining multiple post-processors
 */

// GJS-style imports
import GLib from 'gi://GLib?version=2.0';

import {
  PostProcessor,
  ProcessContext,
  ProcessResult,
  PipelineStage,
  PostProcessError,
} from './PostProcessor.js';

import { Logger } from '../logging/Logger.js';
import { Config } from '../config/schema.js';
import { BasetenProvider } from './BasetenProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';

/**
 * Pipeline stage result with metadata
 * @task T013
 * @epic T001
 * @why Track per-stage results and latency
 * @what Extended result with stage information
 */
export interface PipelineStageResult extends ProcessResult {
  /** Stage name */
  stageName: string;
  /** Provider name */
  provider: string;
  /** Whether this stage was executed */
  executed: boolean;
  /** Error message if stage failed */
  error?: string;
}

/**
 * Pipeline execution result
 * @task T013
 * @epic T001
 * @why Complete pipeline execution summary
 * @what All stage results and aggregate metrics
 */
export interface PipelineResult {
  /** Final processed text */
  text: string;
  /** Total pipeline latency in milliseconds */
  totalLatency: number;
  /** Individual stage results */
  stages: PipelineStageResult[];
  /** Whether any processing occurred */
  processed: boolean;
  /** Whether any stage failed */
  hasErrors: boolean;
  /** Total tokens used across all stages */
  totalTokensUsed?: number;
}

/**
 * Pipeline configuration
 * @task T013
 * @epic T001
 * @why Configuration for pipeline behavior
 * @what Pipeline settings and stage definitions
 */
export interface PipelineConfig {
  /** Whether post-processing is enabled globally */
  enabled: boolean;
  /** Stage configurations in execution order */
  stages: PipelineStage[];
  /** Whether to continue on stage failure */
  continueOnError: boolean;
  /** Maximum total latency in ms (0 = no limit) */
  maxTotalLatencyMs: number;
}

/**
 * Stage execution metrics for latency tracking
 * @task T013
 * @epic T001
 * @why Per-stage latency monitoring per REQ-017
 * @what Tracks timing for each pipeline stage
 */
interface StageMetrics {
  stageName: string;
  startTime: number;
  endTime?: number;
  latencyMs?: number;
}

/**
 * Multi-stage Post-Processing Pipeline
 * Orchestrates multiple post-processors in a configurable chain
 * Per SPEC-REQ-011, REQ-013, REQ-017
 * 
 * @task T013
 * @epic T001
 * @why Chain multiple LLM providers for progressive refinement
 * @what Pipeline that executes stages in order with latency tracking
 */
export class PostProcessPipeline {
  private _logger: Logger;
  private _config: PipelineConfig;
  private _providers: Map<string, PostProcessor> = new Map();
  private _metrics: StageMetrics[] = [];

  /**
   * Create a new post-processing pipeline
   * 
   * @task T013
   * @epic T001
   * @why Initialize pipeline with configuration
   * @what Sets up pipeline with stages and providers
   * @param {PipelineConfig} config - Pipeline configuration
   * @param {Logger} logger - Logger instance
   */
  constructor(config: PipelineConfig, logger: Logger) {
    this._config = config;
    this._logger = logger.child('pipeline');

    this._logger.debug('Pipeline initialized', {
      enabled: config.enabled,
      stageCount: config.stages.length,
      continueOnError: config.continueOnError,
    });
  }

  /**
   * Register a post-processor for use in the pipeline
   * 
   * @task T013
   * @epic T001
   * @why Provider registration for stage execution
   * @what Adds a provider to the pipeline's provider map
   * @param {string} name - Provider identifier
   * @param {PostProcessor} provider - Post-processor instance
   */
  registerProvider(name: string, provider: PostProcessor): void {
    this._providers.set(name, provider);
    this._logger.debug('Provider registered', { name, type: provider.displayName });
  }

  /**
   * Process text through the pipeline
   * Executes enabled stages in order, tracking latency per stage
   * Per SPEC-REQ-011, REQ-013, REQ-017
   * 
   * @task T013
   * @epic T001
   * @why Execute multi-stage post-processing chain
   * @what Processes text through each enabled stage sequentially
   * @param {string} text - Raw text to process
   * @param {ProcessContext} [context] - Optional processing context
   * @returns {Promise<PipelineResult>} Complete pipeline result
   */
  async process(text: string, context?: ProcessContext): Promise<PipelineResult> {
    const pipelineStartTime = GLib.get_monotonic_time();
    this._metrics = [];

    // If pipeline is disabled, return text unchanged
    if (!this._config.enabled) {
      this._logger.debug('Pipeline disabled, returning original text');
      return {
        text,
        totalLatency: 0,
        stages: [],
        processed: false,
        hasErrors: false,
      };
    }

    // If no text, return early
    if (!text || text.length === 0) {
      return {
        text: '',
        totalLatency: 0,
        stages: [],
        processed: false,
        hasErrors: false,
      };
    }

    this._logger.debug('Starting pipeline execution', {
      textLength: text.length,
      stageCount: this._config.stages.length,
    });

    const stageResults: PipelineStageResult[] = [];
    let currentText = text;
    let hasErrors = false;
    let totalTokensUsed = 0;

    // Execute each stage in order
    for (const stage of this._config.stages) {
      const result = await this._executeStage(stage, currentText, context);
      stageResults.push(result);

      if (result.error) {
        hasErrors = true;
        if (!this._config.continueOnError) {
          this._logger.warn('Pipeline stopping due to stage error', {
            stage: stage.name,
            error: result.error,
          });
          break;
        }
      } else if (result.executed) {
        // Update text for next stage
        currentText = result.text;
        if (result.tokensUsed) {
          totalTokensUsed += result.tokensUsed;
        }
      }

      // Check max latency if configured
      const currentElapsedMs = (GLib.get_monotonic_time() - pipelineStartTime) / 1000;
      if (this._config.maxTotalLatencyMs > 0 && 
          currentElapsedMs > this._config.maxTotalLatencyMs) {
        this._logger.warn('Pipeline exceeded max latency, stopping', {
          elapsedMs: currentElapsedMs,
          maxMs: this._config.maxTotalLatencyMs,
        });
        break;
      }
    }

    // Calculate total latency
    const pipelineEndTime = GLib.get_monotonic_time();
    const totalLatency = (pipelineEndTime - pipelineStartTime) / 1000;

    this._logger.debug('Pipeline execution completed', {
      totalLatency,
      stageCount: stageResults.length,
      hasErrors,
      totalTokensUsed,
    });

    return {
      text: currentText,
      totalLatency,
      stages: stageResults,
      processed: stageResults.some(s => s.executed),
      hasErrors,
      totalTokensUsed: totalTokensUsed > 0 ? totalTokensUsed : undefined,
    };
  }

  /**
   * Execute a single pipeline stage
   * 
   * @task T013
   * @epic T001
   * @why Individual stage execution with error handling
   * @what Executes one stage and captures metrics
   * @param {PipelineStage} stage - Stage configuration
   * @param {string} text - Input text
   * @param {ProcessContext} [context] - Processing context
   * @returns {Promise<PipelineStageResult>} Stage result
   */
  private async _executeStage(
    stage: PipelineStage,
    text: string,
    context?: ProcessContext
  ): Promise<PipelineStageResult> {
    const stageStartTime = GLib.get_monotonic_time();

    // Record metrics
    const metrics: StageMetrics = {
      stageName: stage.name,
      startTime: stageStartTime,
    };
    this._metrics.push(metrics);

    // Skip if stage is disabled
    if (!stage.enabled) {
      this._logger.debug('Stage disabled, skipping', { stage: stage.name });
      return {
        text,
        latency: 0,
        modified: false,
        stageName: stage.name,
        provider: stage.provider,
        executed: false,
      };
    }

    // Get provider
    const provider = this._providers.get(stage.provider);
    if (!provider) {
      const error = `Provider not found: ${stage.provider}`;
      this._logger.error(error, { stage: stage.name });
      return {
        text,
        latency: 0,
        modified: false,
        stageName: stage.name,
        provider: stage.provider,
        executed: false,
        error,
      };
    }

    // Check if provider is configured
    if (!provider.isConfigured()) {
      const error = `Provider not configured: ${stage.provider}`;
      this._logger.warn(error, { stage: stage.name });
      return {
        text,
        latency: 0,
        modified: false,
        stageName: stage.name,
        provider: stage.provider,
        executed: false,
        error,
      };
    }

    try {
      this._logger.debug('Executing stage', { 
        stage: stage.name, 
        provider: stage.provider,
        textLength: text.length,
      });

      // Execute provider
      const result = await provider.process(text, context);

      // Update metrics
      const stageEndTime = GLib.get_monotonic_time();
      metrics.endTime = stageEndTime;
      metrics.latencyMs = result.latency;

      // Log latency for monitoring
      this._logger.debug('Stage completed', {
        stage: stage.name,
        latencyMs: result.latency,
        tokensUsed: result.tokensUsed,
      });

      return {
        ...result,
        stageName: stage.name,
        provider: stage.provider,
        executed: true,
      };
    } catch (error) {
      // Update metrics even on error
      const stageEndTime = GLib.get_monotonic_time();
      metrics.endTime = stageEndTime;
      metrics.latencyMs = (stageEndTime - stageStartTime) / 1000;

      const errorMessage = (error as Error).message;
      this._logger.error('Stage failed', {
        stage: stage.name,
        error: errorMessage,
        latencyMs: metrics.latencyMs,
      });

      return {
        text,
        latency: metrics.latencyMs || 0,
        modified: false,
        stageName: stage.name,
        provider: stage.provider,
        executed: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Update pipeline configuration
   * 
   * @task T013
   * @epic T001
   * @why Runtime configuration updates
   * @what Updates pipeline config without recreating
   * @param {PipelineConfig} config - New configuration
   */
  updateConfig(config: PipelineConfig): void {
    const wasEnabled = this._config.enabled;
    this._config = config;

    this._logger.debug('Pipeline config updated', {
      wasEnabled,
      nowEnabled: config.enabled,
      stageCount: config.stages.length,
    });
  }

  /**
   * Get current pipeline configuration
   * 
   * @task T013
   * @epic T001
   * @why Access current configuration
   * @returns {PipelineConfig} Current configuration
   */
  getConfig(): PipelineConfig {
    return { ...this._config };
  }

  /**
   * Get last execution metrics
   * 
   * @task T013
   * @epic T001
   * @why Access stage timing information
   * @returns {StageMetrics[]} Array of stage metrics
   */
  getLastMetrics(): StageMetrics[] {
    return [...this._metrics];
  }

  /**
   * Check if pipeline has any configured providers
   * 
   * @task T013
   * @epic T001
   * @why Validate pipeline readiness
   * @returns {boolean} True if at least one provider is registered
   */
  hasProviders(): boolean {
    return this._providers.size > 0;
  }

  /**
   * Get list of registered provider names
   * 
   * @task T013
   * @epic T001
   * @why Provider inventory
   * @returns {string[]} Array of provider names
   */
  getRegisteredProviders(): string[] {
    return Array.from(this._providers.keys());
  }

  /**
   * Dispose of all providers and clean up
   * 
   * @task T013
   * @epic T001
   * @why Clean up resources
   */
  dispose(): void {
    this._logger.debug('Disposing pipeline');

    for (const [name, provider] of this._providers) {
      if (provider.dispose) {
        try {
          provider.dispose();
        } catch (e) {
          this._logger.error('Error disposing provider', {
            name,
            error: (e as Error).message,
          });
        }
      }
    }
    this._providers.clear();
    this._metrics = [];
  }
}

/**
 * Create default pipeline configuration from app config
 * Per SPEC-REQ-012: Baseten LLaMA as default
 * 
 * @task T013
 * @epic T001
 * @why Generate pipeline config from app configuration
 * @what Creates PipelineConfig from Config
 * @param {Config} config - Application configuration
 * @returns {PipelineConfig} Pipeline configuration
 */
export function createPipelineConfigFromAppConfig(config: Config): PipelineConfig {
  const stages: PipelineStage[] = [];

  // Default stage: Baseten LLaMA (per REQ-012)
  if (config.basetenApiKey && config.basetenEndpoint) {
    stages.push({
      name: 'format',
      provider: 'baseten',
      enabled: true,
    });
  }

  // Optional second stage: OpenAI polish (if configured)
  if (config.openaiApiKey && stages.length > 0) {
    // Only add as second stage if Baseten is primary
    stages.push({
      name: 'polish',
      provider: 'openai',
      enabled: false, // Disabled by default, can be enabled in advanced settings
    });
  }

  // Fallback: OpenAI as primary if Baseten not configured
  if (stages.length === 0 && config.openaiApiKey) {
    stages.push({
      name: 'format',
      provider: 'openai',
      enabled: true,
    });
  }

  return {
    enabled: config.enablePostProcessing,
    stages,
    continueOnError: true,
    maxTotalLatencyMs: config.latencyThresholds.totalLatencyMs,
  };
}

/**
 * Create pipeline with providers from app config
 * 
 * @task T013
 * @epic T001
 * @why Factory for creating fully configured pipeline
 * @what Creates pipeline with registered providers
 * @param {Config} config - Application configuration
 * @param {Logger} logger - Logger instance
 * @returns {PostProcessPipeline} Configured pipeline
 */
export function createPipeline(config: Config, logger: Logger): PostProcessPipeline {
  const pipelineConfig = createPipelineConfigFromAppConfig(config);
  const pipeline = new PostProcessPipeline(pipelineConfig, logger);

  // Register Baseten provider if configured
  if (config.basetenApiKey && config.basetenEndpoint) {
    const basetenProvider = new BasetenProvider({
      apiKey: config.basetenApiKey,
      endpoint: config.basetenEndpoint,
    }, logger);
    pipeline.registerProvider('baseten', basetenProvider);
  }

  // Register OpenAI provider if configured
  if (config.openaiApiKey) {
    const openaiProvider = new OpenAIProvider({
      apiKey: config.openaiApiKey,
      endpoint: config.openaiEndpoint,
    }, logger);
    pipeline.registerProvider('openai', openaiProvider);
  }

  return pipeline;
}

/**
 * Create pipeline factory function
 * 
 * @task T013
 * @epic T001
 * @why Factory function for convenient pipeline creation
 * @param {PipelineConfig} config - Pipeline configuration
 * @param {Logger} logger - Logger instance
 * @returns {PostProcessPipeline} Configured pipeline
 */
export function createPostProcessPipeline(
  config: PipelineConfig,
  logger: Logger
): PostProcessPipeline {
  return new PostProcessPipeline(config, logger);
}