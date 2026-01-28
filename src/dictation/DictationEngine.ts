/**
 * @task T015
 * @epic T001
 * @why Orchestrate complete dictation flow from trigger to text injection
 * @what Main dictation engine coordinating all subsystems
 */

// GJS-style imports
imports.gi.versions.GObject = '2.0';
imports.gi.versions.GLib = '2.0';

const { GObject, GLib } = imports.gi;

import { DictationStateMachine, DictationState, TransitionReason } from './StateMachine.js';
import { ConfigManager } from '../config/Config.js';
import { PipeWireCapture } from '../audio/PipeWireCapture.js';
import { DictationHotkeys } from '../hotkeys/PortalHotkey.js';
import { TrayIndicator } from '../ui/TrayIndicator.js';
import { StatusIcon, TrayState } from '../ui/StatusIcon.js';
import { ProviderFactory } from '../stt/ProviderFactory.js';
import { SttProvider, TranscribeResult, SttError } from '../stt/SttProvider.js';
import { PostProcessPipeline, PipelineResult } from '../postprocess/Pipeline.js';
import { TextInjector, InjectionResult } from '../inject/TextInjector.js';
import { Logger, LogLevel } from '../logging/Logger.js';
import { MetricsTracker, LatencyMetrics } from '../logging/metrics.js';
import { LifecycleManager } from '../startup/Lifecycle.js';
import { ProcessContext } from '../postprocess/PostProcessor.js';

/**
 * Dictation engine configuration
 * @task T015
 * @epic T001
 * @why Configuration options for the engine
 * @what Settings for dictation behavior
 */
export interface DictationEngineConfig {
  /** Enable post-processing */
  enablePostProcessing: boolean;
  /** Enable automatic paste injection */
  enableInjection: boolean;
  /** Silence timeout in seconds */
  silenceTimeout: number;
}

/**
 * Dictation session data
 * @task T015
 * @epic T001
 * @why Track data for an active dictation session
 * @what Stores session-specific data
 */
interface DictationSession {
  /** Unique session ID */
  id: string;
  /** When the session started */
  startTime: number;
  /** Captured audio data */
  audioData: Uint8Array | null;
  /** Raw transcription result */
  rawTranscription: string | null;
  /** Processed text */
  processedText: string | null;
  /** Whether this is a terminal paste */
  isTerminalPaste: boolean;
}

/**
 * Dictation result
 * @task T015
 * @epic T001
 * @why Result of a completed dictation session
 * @what Complete result with text and metrics
 */
export interface DictationResult {
  /** Whether dictation succeeded */
  success: boolean;
  /** Final text (processed or raw) */
  text: string;
  /** Error message if failed */
  error?: string;
  /** Latency metrics */
  metrics?: LatencyMetrics;
  /** Whether text was injected */
  injected: boolean;
  /** Injection method used */
  injectionResult?: InjectionResult;
}

/**
 * Main dictation engine
 * Coordinates all modules for end-to-end dictation flow
 * Per SPEC-REQ-016: Full latency tracking
 * 
 * @task T015
 * @epic T001
 * @why Central orchestrator for all dictation functionality
 * @what Manages state, coordinates modules, handles errors
 */
export class DictationEngine extends GObject.Object {
  private _stateMachine: DictationStateMachine;
  private _configManager: ConfigManager;
  private _capture: PipeWireCapture;
  private _hotkeys: DictationHotkeys;
  private _tray: TrayIndicator;
  private _statusIcon: StatusIcon;
  private _providerFactory: ProviderFactory;
  private _pipeline: PostProcessPipeline;
  private _injector: TextInjector;
  private _logger: Logger;
  private _metrics: MetricsTracker;
  private _lifecycle: LifecycleManager;
  
  private _currentSession: DictationSession | null = null;
  private _engineConfig: DictationEngineConfig;
  private _isDisposed: boolean = false;

  // Static GObject registration
  static {
    GObject.registerClass({
      GTypeName: 'DictationEngine',
      Signals: {
        'dictation-started': {
          param_types: [GObject.TYPE_STRING],
          return_type: GObject.TYPE_NONE,
        },
        'dictation-stopped': {
          param_types: [GObject.TYPE_STRING],
          return_type: GObject.TYPE_NONE,
        },
        'dictation-complete': {
          param_types: [GObject.TYPE_STRING],
          return_type: GObject.TYPE_NONE,
        },
        'dictation-error': {
          param_types: [GObject.TYPE_STRING],
          return_type: GObject.TYPE_NONE,
        },
        'text-injected': {
          param_types: [GObject.TYPE_STRING],
          return_type: GObject.TYPE_NONE,
        },
      },
    }, DictationEngine as any);
  }

  /**
   * Create a new dictation engine
   * 
   * @task T015
   * @epic T001
   * @why Initialize engine with all dependencies
   * @param {ConfigManager} configManager - Configuration manager
   * @param {PipeWireCapture} capture - Audio capture module
   * @param {DictationHotkeys} hotkeys - Hotkey manager
   * @param {TrayIndicator} tray - Tray indicator
   * @param {StatusIcon} statusIcon - Status icon manager
   * @param {ProviderFactory} providerFactory - STT provider factory
   * @param {PostProcessPipeline} pipeline - Post-processing pipeline
   * @param {TextInjector} injector - Text injector
   * @param {Logger} logger - Logger instance
   * @param {MetricsTracker} metrics - Metrics tracker
   * @param {LifecycleManager} lifecycle - Lifecycle manager
   */
  constructor(
    configManager: ConfigManager,
    capture: PipeWireCapture,
    hotkeys: DictationHotkeys,
    tray: TrayIndicator,
    statusIcon: StatusIcon,
    providerFactory: ProviderFactory,
    pipeline: PostProcessPipeline,
    injector: TextInjector,
    logger: Logger,
    metrics: MetricsTracker,
    lifecycle: LifecycleManager
  ) {
    super();

    this._configManager = configManager;
    this._capture = capture;
    this._hotkeys = hotkeys;
    this._tray = tray;
    this._statusIcon = statusIcon;
    this._providerFactory = providerFactory;
    this._pipeline = pipeline;
    this._injector = injector;
    this._logger = logger.child('engine');
    this._metrics = metrics;
    this._lifecycle = lifecycle;

    // Create state machine
    this._stateMachine = new DictationStateMachine();

    // Initialize engine config from app config
    const config = configManager.config;
    this._engineConfig = {
      enablePostProcessing: config.enablePostProcessing,
      enableInjection: true,
      silenceTimeout: config.silenceTimeout,
    };

    // Set up state change handler
    this._stateMachine.onStateChange((transition) => {
      this._onStateChange(transition);
    });

    // Set up capture event handlers
    this._setupCaptureHandlers();

    this._logger.info('DictationEngine initialized');
  }

  /**
   * Initialize the engine
   * Sets up hotkey callbacks and prepares for dictation
   * 
   * @task T015
   * @epic T001
   * @why Prepare engine for operation
   * @returns {Promise<boolean>} True if initialization succeeded
   */
  async init(): Promise<boolean> {
    try {
      // Set up hotkey callbacks
      const hotkeySuccess = await this._hotkeys.init(
        () => this.toggleDictation(),
        () => this.pasteAsTerminal(),
        (error) => this._handleError('hotkey', error)
      );

      if (!hotkeySuccess) {
        this._logger.warn('Hotkey initialization failed, continuing without global hotkeys');
      }

      // Initialize tray
      const traySuccess = this._tray.init();
      if (!traySuccess) {
        this._logger.warn('Tray initialization failed');
      }

      // Configure capture with current settings
      this._updateCaptureConfig();

      this._logger.info('DictationEngine initialization complete');
      return true;

    } catch (error) {
      this._logger.error('Failed to initialize DictationEngine', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Toggle dictation on/off
   * Main entry point for user-triggered dictation
   * 
   * @task T015
   * @epic T001
   * @why User-triggered start/stop
   * @returns {boolean} True if toggle was processed
   */
  toggleDictation(): boolean {
    const state = this._stateMachine.currentState;

    this._logger.debug('Toggle dictation requested', { currentState: state });

    switch (state) {
      case 'idle':
      case 'error':
        return this.startDictation();
      case 'listening':
        return this.stopDictation('user_toggle');
      case 'starting':
      case 'stopping':
      case 'processing':
      case 'injecting':
        // Ignore toggle during transitional states
        this._logger.debug('Ignoring toggle during transitional state', { state });
        return false;
      default:
        return false;
    }
  }

  /**
   * Start dictation
   * Begins audio capture and enters listening state
   * 
   * @task T015
   * @epic T001
   * @why Begin dictation session
   * @returns {boolean} True if started successfully
   */
  startDictation(): boolean {
    if (!this._stateMachine.canStart()) {
      this._logger.warn('Cannot start dictation', { state: this._stateMachine.currentState });
      return false;
    }

    // Check if provider is configured
    if (!this._providerFactory.isConfigured()) {
      this._handleError('start', new Error('STT provider not configured'));
      this._tray.showNotification(
        'Voyc Configuration Required',
        'Please configure your API key in settings'
      );
      return false;
    }

    // Transition to starting
    if (!this._stateMachine.start('hotkey')) {
      return false;
    }

    // Create new session
    const sessionId = this._generateSessionId();
    this._currentSession = {
      id: sessionId,
      startTime: GLib.get_monotonic_time(),
      audioData: null,
      rawTranscription: null,
      processedText: null,
      isTerminalPaste: false,
    };

    // Start metrics tracking
    this._metrics.startSession(sessionId);

    // Reset capture
    this._capture.reset();

    // Start capture
    const captureStarted = this._capture.start();
    if (!captureStarted) {
      this._handleError('capture', new Error('Failed to start audio capture'));
      this._stateMachine.markError('Capture start failed');
      return false;
    }

    // Mark as listening
    this._stateMachine.markCaptureStarted();

    this._logger.info('Dictation started', { sessionId });
    this.emit('dictation-started', sessionId);

    return true;
  }

  /**
   * Stop dictation
   * Ends audio capture and begins processing
   * 
   * @task T015
   * @epic T001
   * @why End listening and begin processing
   * @param {TransitionReason} [reason='user_toggle'] - Reason for stopping
   * @returns {boolean} True if stopped successfully
   */
  stopDictation(reason: TransitionReason = 'user_toggle'): boolean {
    if (!this._stateMachine.canStop()) {
      this._logger.debug('Cannot stop dictation', { state: this._stateMachine.currentState });
      return false;
    }

    // Stop capture
    this._capture.stop();

    // Transition to stopping
    this._stateMachine.stop(reason);

    this._logger.info('Dictation stopped', { reason });
    this.emit('dictation-stopped', this._currentSession?.id || '');

    return true;
  }

  /**
   * Paste as terminal
   * Forces terminal paste mode for next injection
   * 
   * @task T015
   * @epic T001
   * @why User-triggered terminal paste
   * @returns {boolean} True if processed
   */
  pasteAsTerminal(): boolean {
    if (this._currentSession) {
      this._currentSession.isTerminalPaste = true;
    }
    
    // If we have processed text ready, inject with terminal mode
    if (this._currentSession?.processedText) {
      this._injectText(this._currentSession.processedText, true);
      return true;
    }

    return false;
  }

  /**
   * Abort current dictation
   * Cancels any in-progress dictation and returns to idle
   * 
   * @task T015
   * @epic T001
   * @why Emergency stop and cleanup
   */
  abort(): void {
    this._logger.warn('Dictation aborted');

    // Stop capture if running
    if (this._capture.isRecording()) {
      this._capture.stop();
    }

    // Cancel metrics session
    if (this._currentSession) {
      this._metrics.cancelSession(this._currentSession.id, 'aborted');
    }

    // Reset state
    this._currentSession = null;
    this._stateMachine.reset('abort');
  }

  /**
   * Get current state
   * 
   * @task T015
   * @epic T001
   * @why External state access
   * @returns {DictationState} Current dictation state
   */
  getState(): DictationState {
    return this._stateMachine.currentState;
  }

  /**
   * Check if currently listening
   * 
   * @task T015
   * @epic T001
   * @why Quick state check
   * @returns {boolean} True if listening
   */
  isListening(): boolean {
    return this._stateMachine.isListening();
  }

  /**
   * Check if currently processing
   * 
   * @task T015
   * @epic T001
   * @why Quick state check
   * @returns {boolean} True if processing
   */
  isProcessing(): boolean {
    return this._stateMachine.isProcessing();
  }

  /**
   * Get current session ID
   * 
   * @task T015
   * @epic T001
   * @why Session tracking
   * @returns {string | null} Current session ID or null
   */
  getCurrentSessionId(): string | null {
    return this._currentSession?.id || null;
  }

  /**
   * Update engine configuration
   * 
   * @task T015
   * @epic T001
   * @why Runtime configuration updates
   */
  updateConfig(): void {
    const config = this._configManager.config;
    
    this._engineConfig = {
      enablePostProcessing: config.enablePostProcessing,
      enableInjection: this._engineConfig.enableInjection,
      silenceTimeout: config.silenceTimeout,
    };

    this._updateCaptureConfig();
    
    // Update provider factory
    this._providerFactory.updateConfig(config);
    
    // Update log level
    const logLevelMap: Record<string, LogLevel> = {
      error: LogLevel.ERROR,
      warn: LogLevel.WARN,
      info: LogLevel.INFO,
      debug: LogLevel.DEBUG,
    };
    this._logger.setMinLevel(logLevelMap[config.logLevel] ?? LogLevel.INFO);

    this._logger.debug('Engine configuration updated');
  }

  /**
   * Dispose of the engine
   * Cleans up all resources
   * 
   * @task T015
   * @epic T001
   * @why Clean shutdown
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }

    this._logger.info('Disposing DictationEngine');

    // Abort any active dictation
    this.abort();

    // Dispose components
    this._stateMachine.dispose();
    this._capture.dispose();
    this._hotkeys.dispose();
    this._pipeline.dispose();

    this._isDisposed = true;
  }

  /**
   * Set up audio capture event handlers
   * 
   * @task T015
   * @epic T001
   * @why Connect capture events to engine logic
   * @private
   */
  private _setupCaptureHandlers(): void {
    // Handle capture stopped (silence or manual)
    this._capture.onStopped((reason) => {
      this._onCaptureStopped(reason);
    });

    // Handle capture errors
    this._capture.onError((error) => {
      this._handleError('capture', error);
    });

    // Handle silence detection
    this._capture.onSilenceDetected((duration) => {
      this._logger.debug('Silence detected', { duration });
      if (this._engineConfig.silenceTimeout > 0) {
        this.stopDictation('silence_detected');
      }
    });
  }

  /**
   * Handle capture stopped
   * Begins STT processing
   * 
   * @task T015
   * @epic T001
   * @param {'manual' | 'silence' | 'error'} reason - Why capture stopped
   * @private
   */
  private _onCaptureStopped(reason: 'manual' | 'silence' | 'error'): void {
    if (reason === 'error') {
      this._stateMachine.markError('Capture error');
      return;
    }

    // Get captured audio
    const audioData = this._capture.getWavData();
    
    if (!audioData || audioData.length === 0) {
      this._logger.warn('No audio data captured');
      this._stateMachine.reset('abort');
      return;
    }

    // Store audio data
    if (this._currentSession) {
      this._currentSession.audioData = audioData;
    }

    // Transition to processing
    this._stateMachine.markCaptureStopped(reason === 'silence' ? 'silence_detected' : 'user_toggle');

    // Begin STT
    this._processStt(audioData);
  }

  /**
   * Process audio with STT
   * 
   * @task T015
   * @epic T001
   * @param {Uint8Array} audioData - Audio data to transcribe
   * @private
   */
  private async _processStt(audioData: Uint8Array): Promise<void> {
    if (!this._currentSession) {
      this._logger.error('No active session for STT');
      this._stateMachine.markError('No active session');
      return;
    }

    const sessionId = this._currentSession.id;

    try {
      // Get current provider
      const provider = this._providerFactory.getCurrentProvider();

      this._logger.debug('Starting STT', { 
        sessionId, 
        provider: provider.name,
        audioSize: audioData.length,
      });

      // Transcribe
      const result = await provider.transcribe(audioData);

      // Record STT completion
      this._metrics.recordSttComplete(sessionId);

      this._logger.debug('STT complete', { 
        sessionId, 
        latency: result.latency,
        textLength: result.text.length,
      });

      // Store raw transcription
      this._currentSession.rawTranscription = result.text;

      // Check if text is empty
      if (!result.text || result.text.trim().length === 0) {
        this._logger.info('Empty transcription, skipping processing');
        this._stateMachine.reset('abort');
        return;
      }

      // Begin post-processing or injection
      if (this._engineConfig.enablePostProcessing) {
        this._stateMachine.transition('processing', 'stt_complete');
        await this._processPostProcess(result.text, result);
      } else {
        this._stateMachine.markSttComplete();
        await this._injectText(result.text, this._currentSession.isTerminalPaste);
      }

    } catch (error) {
      this._handleError('stt', error as Error);
      this._stateMachine.markError((error as Error).message);
    }
  }

  /**
   * Process text through post-processing pipeline
   * 
   * @task T015
   * @epic T001
   * @param {string} text - Raw text to process
   * @param {TranscribeResult} sttResult - STT result for context
   * @private
   */
  private async _processPostProcess(text: string, sttResult: TranscribeResult): Promise<void> {
    if (!this._currentSession) {
      return;
    }

    const sessionId = this._currentSession.id;

    try {
      // Build process context
      const context: ProcessContext = {
        language: sttResult.language,
        confidence: sttResult.confidence,
        audioDuration: sttResult.duration,
        targetApp: this._currentSession.isTerminalPaste ? 'terminal' : 'default',
      };

      this._logger.debug('Starting post-processing', { sessionId });

      // Process through pipeline
      const result = await this._pipeline.process(text, context);

      // Record post-processing completion
      const isBaseten = result.stages.some(s => s.provider === 'baseten' && s.executed);
      this._metrics.recordPostProcessComplete(sessionId, isBaseten);

      this._logger.debug('Post-processing complete', { 
        sessionId, 
        totalLatency: result.totalLatency,
        modified: result.processed,
      });

      // Use processed text or fall back to raw
      const finalText = result.processed ? result.text : text;
      this._currentSession.processedText = finalText;

      // Transition to injecting and inject
      this._stateMachine.markSttComplete();
      await this._injectText(finalText, this._currentSession.isTerminalPaste);

    } catch (error) {
      this._logger.error('Post-processing failed, using raw text', {
        sessionId,
        error: (error as Error).message,
      });

      // Fall back to raw text
      this._currentSession.processedText = text;
      this._stateMachine.markSttComplete();
      await this._injectText(text, this._currentSession.isTerminalPaste);
    }
  }

  /**
   * Inject text into focused application
   * 
   * @task T015
   * @epic T001
   * @param {string} text - Text to inject
   * @param {boolean} isTerminal - Whether to use terminal paste
   * @private
   */
  private async _injectText(text: string, isTerminal: boolean): Promise<void> {
    if (!this._currentSession) {
      return;
    }

    const sessionId = this._currentSession.id;

    try {
      this._logger.debug('Injecting text', { 
        sessionId, 
        textLength: text.length,
        isTerminal,
      });

      let injectionResult: InjectionResult;

      if (this._engineConfig.enableInjection) {
        injectionResult = await this._injector.inject(text);
      } else {
        // Just copy to clipboard
        await this._injector['clipboard'].setText(text);
        injectionResult = InjectionResult.CLIPBOARD_ONLY;
      }

      // Record injection completion
      const metrics = this._metrics.completeSession(sessionId);

      this._logger.info('Dictation complete', { 
        sessionId, 
        injectionResult,
        metrics,
      });

      // Show notification if clipboard-only
      if (injectionResult === InjectionResult.CLIPBOARD_ONLY) {
        this._tray.showNotification(
          'Voyc Dictation Complete',
          'Text copied to clipboard (paste manually)'
        );
      }

      // Emit completion
      this.emit('text-injected', text);
      this.emit('dictation-complete', sessionId);

      // Complete state machine
      this._stateMachine.markComplete();

      // Clean up session
      this._currentSession = null;

    } catch (error) {
      this._handleError('injection', error as Error);
      this._stateMachine.markError((error as Error).message);
    }
  }

  /**
   * Handle state changes
   * Updates UI to reflect new state
   * 
   * @task T015
   * @epic T001
   * @param {import('./StateMachine.js').StateTransition} transition - State transition
   * @private
   */
  private _onStateChange(transition: import('./StateMachine.js').StateTransition): void {
    const { from, to, reason } = transition;

    this._logger.debug('State changed', { from, to, reason });

    // Update tray icon
    const trayState = this._mapStateToTray(to);
    this._statusIcon.setState(trayState);

    // Update lifecycle dictation state
    this._lifecycle.setDictationState(to === 'listening');

    // Handle error state
    if (to === 'error') {
      this.emit('dictation-error', transition.error || 'Unknown error');
    }
  }

  /**
   * Map dictation state to tray state
   * 
   * @task T015
   * @epic T001
   * @param {DictationState} state - Dictation state
   * @returns {TrayState} Tray state
   * @private
   */
  private _mapStateToTray(state: DictationState): TrayState {
    switch (state) {
      case 'idle':
        return 'idle';
      case 'starting':
      case 'listening':
        return 'listening';
      case 'stopping':
      case 'processing':
      case 'injecting':
        return 'processing';
      case 'error':
        return 'error';
      default:
        return 'idle';
    }
  }

  /**
   * Handle errors
   * Logs error and updates state
   * 
   * @task T015
   * @epic T001
   * @param {string} source - Error source
   * @param {Error} error - Error object
   * @private
   */
  private _handleError(source: string, error: Error): void {
    this._logger.error(`Error in ${source}`, { 
      error: error.message,
      stack: error.stack,
    });

    // Show notification for user-facing errors
    if (source === 'stt' || source === 'start') {
      this._tray.showNotification(
        'Voyc Error',
        error.message
      );
    }

    // Emit error signal
    this.emit('dictation-error', error.message);
  }

  /**
   * Update capture configuration from current settings
   * 
   * @task T015
   * @epic T001
   * @private
   */
  private _updateCaptureConfig(): void {
    const config = this._configManager.config;
    
    this._capture.configure({
      device: config.audioDevice,
      silenceTimeout: config.silenceTimeout,
    });
  }

  /**
   * Generate unique session ID
   * 
   * @task T015
   * @epic T001
   * @returns {string} Unique session ID
   * @private
   */
  private _generateSessionId(): string {
    return `voyc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Create a new dictation engine
 * Factory function for convenience
 * 
 * @task T015
 * @epic T001
 * @param {ConfigManager} configManager - Configuration manager
 * @param {PipeWireCapture} capture - Audio capture module
 * @param {DictationHotkeys} hotkeys - Hotkey manager
 * @param {TrayIndicator} tray - Tray indicator
 * @param {StatusIcon} statusIcon - Status icon manager
 * @param {ProviderFactory} providerFactory - STT provider factory
 * @param {PostProcessPipeline} pipeline - Post-processing pipeline
 * @param {TextInjector} injector - Text injector
 * @param {Logger} logger - Logger instance
 * @param {MetricsTracker} metrics - Metrics tracker
 * @param {LifecycleManager} lifecycle - Lifecycle manager
 * @returns {DictationEngine} New dictation engine instance
 */
export function createDictationEngine(
  configManager: ConfigManager,
  capture: PipeWireCapture,
  hotkeys: DictationHotkeys,
  tray: TrayIndicator,
  statusIcon: StatusIcon,
  providerFactory: ProviderFactory,
  pipeline: PostProcessPipeline,
  injector: TextInjector,
  logger: Logger,
  metrics: MetricsTracker,
  lifecycle: LifecycleManager
): DictationEngine {
  return new DictationEngine(
    configManager,
    capture,
    hotkeys,
    tray,
    statusIcon,
    providerFactory,
    pipeline,
    injector,
    logger,
    metrics,
    lifecycle
  );
}
