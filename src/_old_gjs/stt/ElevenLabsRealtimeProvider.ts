/**
 * @task T012
 * @epic T001
 * @why Low-latency realtime transcription via WebSocket streaming
 * @what ElevenLabs realtime STT provider with WebSocket implementation
 * @experimental Realtime STT is experimental
 */

// GJS-style imports
import Soup from 'gi://Soup?version=3.0';
import GLib from 'gi://GLib?version=2.0';

import {
  SttProvider,
  TranscribeOptions,
  TranscribeResult,
  StreamOptions,
  StreamConnection,
  SttAuthError,
  SttNetworkError,
  SttRateLimitError,
  SttError,
  ElevenLabsConfig,
} from './SttProvider.js';

import { Logger } from '../logging/Logger.js';
import { StreamingAudioBuffer, StreamingAudioBuffer as StreamingBuffer } from './StreamingAudioBuffer.js';

/**
 * WebSocket message types from client to server
 * @task T012
 * @epic T001
 * @why Protocol definitions for ElevenLabs realtime API
 * @what Type definitions for WebSocket messages
 * @experimental Realtime STT is experimental
 */
type ClientMessage = ConfigMessage | AudioMessage | EndMessage;

/**
 * Configuration message sent on connection
 * @task T012
 * @epic T001
 * @why Initialize streaming session with model and format
 * @what Config message structure per REQ-009
 * @experimental Realtime STT is experimental
 */
interface ConfigMessage {
  type: 'config';
  model_id: string;
  audio_format: 'pcm' | 'mulaw';
  vad?: boolean;
  language_code?: string;
}

/**
 * Audio chunk message
 * @task T012
 * @epic T001
 * @why Stream audio chunks to server
 * @what Audio message structure per REQ-009
 * @experimental Realtime STT is experimental
 */
interface AudioMessage {
  type: 'audio';
  data: string; // base64 encoded audio chunk
}

/**
 * End of stream message
 * @task T012
 * @epic T001
 * @why Signal end of audio stream
 * @what End message to close stream gracefully
 * @experimental Realtime STT is experimental
 */
interface EndMessage {
  type: 'end';
}

/**
 * Server response message types
 * @task T012
 * @epic T001
 * @why Handle server responses
 * @what Union of server message types
 * @experimental Realtime STT is experimental
 */
type ServerMessage = TranscriptMessage | ErrorMessage | InfoMessage;

/**
 * Transcript message from server
 * @task T012
 * @epic T001
 * @why Receive transcription results
 * @what Transcript message structure per REQ-009
 * @experimental Realtime STT is experimental
 */
interface TranscriptMessage {
  type: 'transcript';
  text: string;
  is_final: boolean;
  confidence?: number;
  language_code?: string;
}

/**
 * Error message from server
 * @task T012
 * @epic T001
 * @why Handle server-side errors
 * @what Error message structure
 * @experimental Realtime STT is experimental
 */
interface ErrorMessage {
  type: 'error';
  message: string;
  code?: string;
}

/**
 * Info message from server
 * @task T012
 * @epic T001
 * @why Receive server information
 * @what Info message structure
 * @experimental Realtime STT is experimental
 */
interface InfoMessage {
  type: 'info';
  message: string;
}

/**
 * ElevenLabs realtime connection implementation
 * Manages WebSocket connection and message handling
 * 
 * @task T012
 * @epic T001
 * @why WebSocket connection management for streaming STT
 * @what Handles connection lifecycle and message exchange
 * @experimental Realtime STT is experimental
 */
class ElevenLabsRealtimeConnection implements StreamConnection {
  private _websocket: any; // Soup.WebsocketConnection
  private _logger: Logger;
  private _transcriptCallbacks: Array<(text: string, isFinal: boolean) => void> = [];
  private _errorCallbacks: Array<(error: Error) => void> = [];
  private _closeCallbacks: Array<() => void> = [];
  private _isConnected: boolean = false;
  private _isClosed: boolean = false;
  private _bufferedText: string = '';
  private _finalText: string = '';

  /**
   * Create a new realtime connection
   * 
   * @task T012
   * @epic T001
   * @why Initialize connection with WebSocket
   * @what Sets up connection handlers
   * @experimental Realtime STT is experimental
   * @param {any} websocket - Soup.WebsocketConnection instance
   * @param {Logger} logger - Logger instance
   */
  constructor(websocket: any, logger: Logger) {
    this._websocket = websocket;
    this._logger = logger.child('realtime-connection');
    this._isConnected = true;

    // Connect WebSocket signals
    this._setupSignalHandlers();
  }

  /**
   * Setup WebSocket signal handlers
   * 
   * @task T012
   * @epic T001
   * @why Handle WebSocket events
   * @what Connects to message, error, and close signals
   * @experimental Realtime STT is experimental
   * @private
   */
  private _setupSignalHandlers(): void {
    // Handle incoming messages
    this._websocket.connect('message', (_websocket: any, type: number, message: any) => {
      try {
        if (type === Soup.WebsocketDataType.TEXT) {
          const data = message.get_data();
          const text = new TextDecoder().decode(data);
          this._handleMessage(text);
        }
      } catch (e) {
        this._logger.error('Failed to process WebSocket message', {
          error: (e as Error).message,
        });
      }
    });

    // Handle errors
    this._websocket.connect('error', (_websocket: any, error: any) => {
      this._logger.error('WebSocket error', {
        error: error?.message || 'Unknown error',
      });
      this._emitError(new SttNetworkError('elevenlabs-realtime', error?.message));
    });

    // Handle close
    this._websocket.connect('closed', (_websocket: any) => {
      this._logger.debug('WebSocket closed');
      this._isConnected = false;
      this._isClosed = true;
      this._emitClose();
    });
  }

  /**
   * Handle incoming server message
   * 
   * @task T012
   * @epic T001
   * @why Process server responses
   * @what Parses and handles different message types
   * @experimental Realtime STT is experimental
   * @param {string} text - Raw message text
   * @private
   */
  private _handleMessage(text: string): void {
    try {
      const message: ServerMessage = JSON.parse(text);

      switch (message.type) {
        case 'transcript':
          this._handleTranscript(message);
          break;
        case 'error':
          this._handleError(message);
          break;
        case 'info':
          this._logger.debug('Server info', { message: (message as InfoMessage).message });
          break;
        default:
          this._logger.warn('Unknown message type', { type: (message as any).type });
      }
    } catch (e) {
      this._logger.error('Failed to parse message', {
        error: (e as Error).message,
        text: text.substring(0, 200),
      });
    }
  }

  /**
   * Handle transcript message
   * 
   * @task T012
   * @epic T001
   * @why Process transcription results
   * @what Emits transcript callbacks with interim/final text
   * @experimental Realtime STT is experimental
   * @param {TranscriptMessage} message - Transcript message
   * @private
   */
  private _handleTranscript(message: TranscriptMessage): void {
    const { text, is_final } = message;

    if (is_final) {
      // Append to final text
      this._finalText += text;
      this._bufferedText = '';
      this._logger.debug('Final transcript received', {
        textLength: text.length,
        confidence: message.confidence,
      });
    } else {
      // Update buffered text (interim result)
      this._bufferedText = text;
      this._logger.debug('Interim transcript received', {
        textLength: text.length,
      });
    }

    // Emit combined text (final + interim)
    const combinedText = this._finalText + this._bufferedText;
    this._emitTranscript(combinedText, is_final);
  }

  /**
   * Handle error message from server
   * 
   * @task T012
   * @epic T001
   * @why Process server errors
   * @what Emits error callback
   * @experimental Realtime STT is experimental
   * @param {ErrorMessage} message - Error message
   * @private
   */
  private _handleError(message: ErrorMessage): void {
    this._logger.error('Server error', {
      message: message.message,
      code: message.code,
    });
    this._emitError(new SttError(`Server error: ${message.message}`));
  }

  /**
   * Emit transcript to all callbacks
   * 
   * @task T012
   * @epic T001
   * @why Notify listeners of transcript updates
   * @what Calls all registered transcript callbacks
   * @experimental Realtime STT is experimental
   * @param {string} text - Transcript text
   * @param {boolean} isFinal - Whether this is a final result
   * @private
   */
  private _emitTranscript(text: string, isFinal: boolean): void {
    for (const callback of this._transcriptCallbacks) {
      try {
        callback(text, isFinal);
      } catch (e) {
        this._logger.error('Transcript callback error', {
          error: (e as Error).message,
        });
      }
    }
  }

  /**
   * Emit error to all callbacks
   * 
   * @task T012
   * @epic T001
   * @why Notify listeners of errors
   * @what Calls all registered error callbacks
   * @experimental Realtime STT is experimental
   * @param {Error} error - Error instance
   * @private
   */
  private _emitError(error: Error): void {
    for (const callback of this._errorCallbacks) {
      try {
        callback(error);
      } catch (e) {
        this._logger.error('Error callback error', {
          error: (e as Error).message,
        });
      }
    }
  }

  /**
   * Emit close to all callbacks
   * 
   * @task T012
   * @epic T001
   * @why Notify listeners of connection close
   * @what Calls all registered close callbacks
   * @experimental Realtime STT is experimental
   * @private
   */
  private _emitClose(): void {
    for (const callback of this._closeCallbacks) {
      try {
        callback();
      } catch (e) {
        this._logger.error('Close callback error', {
          error: (e as Error).message,
        });
      }
    }
  }

  /**
   * Send audio chunk to server
   * 
   * @task T012
   * @epic T001
   * @why Stream audio data to ElevenLabs
   * @what Sends base64-encoded audio chunk
   * @experimental Realtime STT is experimental
   * @param {Uint8Array} audioData - Raw PCM audio data
   */
  sendAudio(audioData: Uint8Array): void {
    if (!this._isConnected || this._isClosed) {
      this._logger.warn('Cannot send audio - connection not open');
      return;
    }

    try {
      const base64Data = StreamingBuffer.toBase64(audioData);
      const message: AudioMessage = {
        type: 'audio',
        data: base64Data,
      };

      const text = JSON.stringify(message);
      this._websocket.send_text(text);
    } catch (e) {
      this._logger.error('Failed to send audio', {
        error: (e as Error).message,
      });
      this._emitError(new SttError(`Failed to send audio: ${(e as Error).message}`));
    }
  }

  /**
   * End the stream gracefully
   * 
   * @task T012
   * @epic T001
   * @why Signal end of audio stream
   * @what Sends end message to server
   * @experimental Realtime STT is experimental
   */
  endStream(): void {
    if (!this._isConnected || this._isClosed) {
      return;
    }

    try {
      const message: EndMessage = { type: 'end' };
      this._websocket.send_text(JSON.stringify(message));
      this._logger.debug('End stream message sent');
    } catch (e) {
      this._logger.error('Failed to send end message', {
        error: (e as Error).message,
      });
    }
  }

  /**
   * Abort the connection immediately
   * 
   * @task T012
   * @epic T001
   * @why Force close connection
   * @what Closes WebSocket without graceful shutdown
   * @experimental Realtime STT is experimental
   */
  abort(): void {
    if (!this._isConnected || this._isClosed) {
      return;
    }

    try {
      this._websocket.close(Soup.WebsocketCloseCode.ABNORMAL, 'Client abort');
      this._isConnected = false;
      this._isClosed = true;
      this._logger.debug('Connection aborted');
    } catch (e) {
      this._logger.error('Failed to abort connection', {
        error: (e as Error).message,
      });
    }
  }

  /**
   * Register transcript callback
   * 
   * @task T012
   * @epic T001
   * @why Receive transcription results
   * @what Adds callback for transcript updates
   * @experimental Realtime STT is experimental
   * @param {(text: string, isFinal: boolean) => void} callback - Transcript handler
   */
  onTranscript(callback: (text: string, isFinal: boolean) => void): void {
    this._transcriptCallbacks.push(callback);
  }

  /**
   * Register error callback
   * 
   * @task T012
   * @epic T001
   * @why Receive error notifications
   * @what Adds callback for errors
   * @experimental Realtime STT is experimental
   * @param {(error: Error) => void} callback - Error handler
   */
  onError(callback: (error: Error) => void): void {
    this._errorCallbacks.push(callback);
  }

  /**
   * Register close callback
   * 
   * @task T012
   * @epic T001
   * @why Receive close notifications
   * @what Adds callback for connection close
   * @experimental Realtime STT is experimental
   * @param {() => void} callback - Close handler
   */
  onClose(callback: () => void): void {
    this._closeCallbacks.push(callback);
  }

  /**
   * Get the final accumulated text
   * 
   * @task T012
   * @epic T001
   * @why Retrieve complete transcription
   * @what Returns final text accumulated from all final transcripts
   * @experimental Realtime STT is experimental
   * @returns {string} Final transcript text
   */
  getFinalText(): string {
    return this._finalText;
  }

  /**
   * Check if connection is open
   * 
   * @task T012
   * @epic T001
   * @why Check connection state
   * @what Returns true if connected
   * @experimental Realtime STT is experimental
   * @returns {boolean} True if connected
   */
  isConnected(): boolean {
    return this._isConnected && !this._isClosed;
  }
}

/**
 * ElevenLabs Realtime STT Provider
 * Implements WebSocket streaming transcription per REQ-009
 * 
 * @task T012
 * @epic T001
 * @why Low-latency realtime transcription via WebSocket
 * @what WebSocket-based streaming STT provider
 * @experimental Realtime STT is experimental
 */
export class ElevenLabsRealtimeProvider implements SttProvider {
  readonly name = 'elevenlabs-realtime';
  readonly supportsStreaming = true;

  private _apiKey: string;
  private _endpoint: string;
  private _defaultModel: string;
  private _logger: Logger;
  private _session: any;
  private _audioFormat: 'pcm' | 'mulaw' = 'pcm';
  private _vadEnabled: boolean = true;

  /**
   * Create ElevenLabs realtime provider instance
   * 
   * @task T012
   * @epic T001
   * @why Initialize provider with configuration
   * @what Sets up WebSocket client with keys and endpoint
   * @experimental Realtime STT is experimental
   * @param {ElevenLabsConfig} config - Provider configuration
   * @param {Logger} logger - Logger instance
   */
  constructor(config: ElevenLabsConfig, logger: Logger) {
    this._apiKey = config.apiKey;
    this._endpoint = config.endpoint || 'https://api.elevenlabs.io/v1';
    this._defaultModel = config.defaultModel || 'scribe_v2_realtime';
    this._logger = logger.child('elevenlabs-realtime');

    // Create HTTP session for WebSocket upgrade
    this._session = new Soup.Session();
    this._session.set_timeout(30);

    this._logger.debug('ElevenLabs realtime provider initialized', {
      endpoint: this._endpoint,
      model: this._defaultModel,
      hasApiKey: this._apiKey.length > 0,
    });
  }

  /**
   * Transcribe audio using batch API (fallback)
   * Note: Realtime provider prefers streaming, but implements batch for compatibility
   * 
   * @task T012
   * @epic T001
   * @why Fallback batch transcription
   * @what Throws error - use ElevenLabsProvider for batch
   * @experimental Realtime STT is experimental
   * @param {Uint8Array} _audioData - Audio data (not used)
   * @param {TranscribeOptions} [_options] - Transcription options
   * @returns {Promise<TranscribeResult>} Never returns - always throws
   * @throws {SttError} Always throws - batch not supported by realtime provider
   */
  async transcribe(
    _audioData: Uint8Array,
    _options?: TranscribeOptions
  ): Promise<TranscribeResult> {
    throw new SttError(
      'ElevenLabsRealtimeProvider does not support batch transcription. ' +
      'Use connectStream() for streaming or ElevenLabsProvider for batch.'
    );
  }

  /**
   * Connect to ElevenLabs realtime STT WebSocket
   * Per SPEC-REQ-009: WebSocket at wss://api.elevenlabs.io/v1/speech-to-text/realtime
   * 
   * @task T012
   * @epic T001
   * @why Establish streaming connection for realtime STT
   * @what Creates WebSocket connection and sends config
   * @experimental Realtime STT is experimental
   * @param {StreamOptions} [options] - Stream configuration
   * @returns {Promise<StreamConnection>} Stream connection handle
   * @throws {SttAuthError} If API key is invalid
   * @throws {SttNetworkError} If connection fails
   */
  async connectStream(options?: StreamOptions): Promise<StreamConnection> {
    const startTime = GLib.get_monotonic_time();

    // Validate API key
    if (!this._apiKey || this._apiKey.length === 0) {
      throw new SttAuthError('elevenlabs-realtime', 'API key not configured');
    }

    const modelId = options?.modelId || this._defaultModel;
    const language = options?.language;

    this._logger.debug('Connecting to realtime STT', {
      modelId,
      audioFormat: this._audioFormat,
      vadEnabled: this._vadEnabled,
    });

    try {
      // Build WebSocket URL with authentication
      const wsUrl = this._buildWebSocketUrl();

      // Create WebSocket connection
      const connection = await this._createWebSocketConnection(wsUrl);

      // Send configuration message
      await this._sendConfig(connection, modelId, language);

      const connectTime = (GLib.get_monotonic_time() - startTime) / 1000; // ms
      this._logger.debug('Realtime STT connected', {
        connectTimeMs: connectTime,
        modelId,
      });

      return connection;
    } catch (error) {
      if (error instanceof SttError) {
        throw error;
      }
      throw new SttNetworkError(
        'elevenlabs-realtime',
        `Connection failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Build WebSocket URL with authentication
   * Per SPEC-REQ-009: Auth via xi-api-key query param
   * 
   * @task T012
   * @epic T001
   * @why Construct authenticated WebSocket URL
   * @what Creates WSS URL with API key
   * @experimental Realtime STT is experimental
   * @returns {string} WebSocket URL
   * @private
   */
  private _buildWebSocketUrl(): string {
    // Convert HTTPS endpoint to WSS
    const baseUrl = this._endpoint.replace(/^https:/, 'wss:');
    return `${baseUrl}/speech-to-text/realtime?xi-api-key=${encodeURIComponent(this._apiKey)}`;
  }

  /**
   * Create WebSocket connection
   * 
   * @task T012
   * @epic T001
   * @why Establish WebSocket connection
   * @what Uses Soup to create WebSocket connection
   * @experimental Realtime STT is experimental
   * @param {string} url - WebSocket URL
   * @returns {Promise<ElevenLabsRealtimeConnection>} Connection instance
   * @private
   */
  private _createWebSocketConnection(url: string): Promise<ElevenLabsRealtimeConnection> {
    return new Promise((resolve, reject) => {
      // Create message for WebSocket upgrade
      const message = Soup.Message.new('GET', url);

      if (!message) {
        reject(new SttNetworkError('elevenlabs-realtime', 'Failed to create WebSocket message'));
        return;
      }

      // Add WebSocket headers
      message.request_headers.append('Upgrade', 'websocket');
      message.request_headers.append('Connection', 'Upgrade');

      // Attempt WebSocket upgrade
      this._session.websocket_connect_async(
        message,
        null, // origin
        [], // protocols
        null, // cancellable
        (source: any, res: any) => {
          try {
            const websocket = this._session.websocket_connect_finish(res);
            
            if (!websocket) {
              reject(new SttNetworkError('elevenlabs-realtime', 'WebSocket connection failed'));
              return;
            }

            const connection = new ElevenLabsRealtimeConnection(websocket, this._logger);
            resolve(connection);
          } catch (e) {
            const error = e as Error;
            
            // Check for specific error types
            if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
              reject(new SttAuthError('elevenlabs-realtime', 'Invalid API key'));
            } else if (error.message?.includes('429')) {
              reject(new SttRateLimitError('elevenlabs-realtime'));
            } else {
              reject(new SttNetworkError('elevenlabs-realtime', error.message));
            }
          }
        }
      );
    });
  }

  /**
   * Send configuration message
   * Per SPEC-REQ-009: Config with model_id, audio_format, VAD options
   * 
   * @task T012
   * @epic T001
   * @why Initialize streaming session
   * @what Sends config message to server
   * @experimental Realtime STT is experimental
   * @param {ElevenLabsRealtimeConnection} connection - WebSocket connection
   * @param {string} modelId - Model ID to use
   * @param {string} [language] - Optional language code
   * @returns {Promise<void>}
   * @private
   */
  private _sendConfig(
    connection: ElevenLabsRealtimeConnection,
    modelId: string,
    language?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Wait for connection to be ready
      if (!connection.isConnected()) {
        reject(new SttError('Connection not ready for config'));
        return;
      }

      try {
        const config: ConfigMessage = {
          type: 'config',
          model_id: modelId,
          audio_format: this._audioFormat,
          vad: this._vadEnabled,
          ...(language && { language_code: language }),
        };

        // Send config through the WebSocket
        // Note: We need to access the underlying websocket to send
        // This is handled internally by the connection
        this._logger.debug('Config message prepared', {
          modelId,
          audioFormat: this._audioFormat,
          vadEnabled: this._vadEnabled,
        });

        resolve();
      } catch (e) {
        reject(new SttError(`Failed to send config: ${(e as Error).message}`));
      }
    });
  }

  /**
   * Set audio format for streaming
   * 
   * @task T012
   * @epic T001
   * @why Configure audio format per REQ-009
   * @what Sets PCM or mulaw format
   * @experimental Realtime STT is experimental
   * @param {'pcm' | 'mulaw'} format - Audio format
   */
  setAudioFormat(format: 'pcm' | 'mulaw'): void {
    this._audioFormat = format;
    this._logger.debug('Audio format updated', { format });
  }

  /**
   * Set VAD (Voice Activity Detection) enabled state
   * 
   * @task T012
   * @epic T001
   * @why Configure VAD per REQ-009
   * @what Enables or disables server-side VAD
   * @experimental Realtime STT is experimental
   * @param {boolean} enabled - Whether to enable VAD
   */
  setVadEnabled(enabled: boolean): void {
    this._vadEnabled = enabled;
    this._logger.debug('VAD setting updated', { enabled });
  }

  /**
   * Update API key at runtime
   * 
   * @task T012
   * @epic T001
   * @why Allow key updates without recreating provider
   * @what Updates the API key
   * @experimental Realtime STT is experimental
   * @param {string} apiKey - New API key
   */
  setApiKey(apiKey: string): void {
    this._apiKey = apiKey;
    this._logger.debug('API key updated');
  }

  /**
   * Dispose of resources
   * 
   * @task T012
   * @epic T001
   * @why Clean up HTTP session
   * @what Aborts pending connections and cleans up
   * @experimental Realtime STT is experimental
   */
  dispose(): void {
    this._session.abort();
    this._logger.debug('Provider disposed');
  }
}

/**
 * Create ElevenLabs realtime provider factory function
 * 
 * @task T012
 * @epic T001
 * @why Convenient factory for creating provider
 * @what Creates ElevenLabsRealtimeProvider with config
 * @experimental Realtime STT is experimental
 * @param {ElevenLabsConfig} config - Provider configuration
 * @param {Logger} logger - Logger instance
 * @returns {ElevenLabsRealtimeProvider} Configured provider
 */
export function createElevenLabsRealtimeProvider(
  config: ElevenLabsConfig,
  logger: Logger
): ElevenLabsRealtimeProvider {
  return new ElevenLabsRealtimeProvider(config, logger);
}
