/**
 * @task T011
 * @epic T001
 * @why ElevenLabs REST STT provider implementation per REQ-007, REQ-008
 * @what ElevenLabs Scribe v2 batch transcription via REST API
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

/**
 * ElevenLabs REST API response
 * @task T011
 * @epic T001
 * @why Type for API response parsing
 * @what Expected response structure from ElevenLabs
 */
interface ElevenLabsResponse {
  /** Transcribed text */
  text: string;
  /** Language code (optional) */
  language_code?: string;
  /** Language probability (optional) */
  language_probability?: number;
  /** Word-level timestamps (optional) */
  words?: Array<{
    word: string;
    start_time: number;
    end_time: number;
  }>;
}

/**
 * ElevenLabs STT Provider
 * Implements batch transcription via REST API
 * Per SPEC-REQ-007 and REQ-008
 * 
 * @task T011
 * @epic T001
 * @why Primary STT provider with ElevenLabs Scribe v2
 * @what REST API client for speech-to-text
 */
export class ElevenLabsProvider implements SttProvider {
  readonly name = 'elevenlabs';
  readonly supportsStreaming = false; // Will be true in T012

  private _apiKey: string;
  private _endpoint: string;
  private _defaultModel: string;
  private _logger: Logger;
  private _session: any;

  /**
   * Create ElevenLabs provider instance
   * 
   * @task T011
   * @epic T001
   * @why Initialize provider with configuration
   * @what Sets up API client with keys and endpoint
   * @param {ElevenLabsConfig} config - Provider configuration
   * @param {Logger} logger - Logger instance
   */
  constructor(config: ElevenLabsConfig, logger: Logger) {
    this._apiKey = config.apiKey;
    this._endpoint = config.endpoint || 'https://api.elevenlabs.io/v1';
    this._defaultModel = config.defaultModel || 'scribe_v2';
    this._logger = logger.child('elevenlabs');

    // Create HTTP session
    this._session = new Soup.Session();
    this._session.set_timeout(30); // 30 second timeout

    this._logger.debug('ElevenLabs provider initialized', {
      endpoint: this._endpoint,
      model: this._defaultModel,
      hasApiKey: this._apiKey.length > 0,
    });
  }

  /**
   * Transcribe audio using ElevenLabs REST API
   * Per SPEC-REQ-007: POST /v1/speech-to-text with multipart/form-data
   * Per SPEC-REQ-008: xi-api-key header authentication
   * 
   * @task T011
   * @epic T001
   * @why Batch transcription via ElevenLabs Scribe
   * @what Sends WAV audio to API and returns transcription
   * @param {Uint8Array} audioData - Audio data (WAV format recommended)
   * @param {TranscribeOptions} [options] - Transcription options
   * @returns {Promise<TranscribeResult>} Transcription result
   * @throws {SttAuthError} If API key is invalid
   * @throws {SttNetworkError} If request fails
   * @throws {SttRateLimitError} If rate limited
   */
  async transcribe(
    audioData: Uint8Array,
    options?: TranscribeOptions
  ): Promise<TranscribeResult> {
    const startTime = GLib.get_monotonic_time();

    // Validate API key
    if (!this._apiKey || this._apiKey.length === 0) {
      throw new SttAuthError('elevenlabs', 'API key not configured');
    }

    // Validate audio data
    if (!audioData || audioData.length === 0) {
      throw new SttError('No audio data provided');
    }

    const modelId = options?.modelId || this._defaultModel;
    const duration = options?.duration || this._estimateDuration(audioData);

    this._logger.debug('Starting transcription', {
      modelId,
      audioBytes: audioData.length,
      duration,
    });

    try {
      // Build multipart form data
      const multipart = this._buildMultipartForm(audioData, modelId, options);

      // Create request
      const url = `${this._endpoint}/speech-to-text`;
      const message = Soup.Message.new('POST', url);

      if (!message) {
        throw new SttNetworkError('elevenlabs', 'Failed to create HTTP message');
      }

      // Set headers per SPEC-REQ-008
      message.request_headers.append('xi-api-key', this._apiKey);
      message.request_headers.append('Accept', 'application/json');

      // Set multipart body
      // Note: In GJS/Soup 3.0, we need to manually build multipart
      const body = this._createMultipartBody(audioData, modelId, options);
      message.set_request_body_from_bytes(
        'multipart/form-data; boundary=' + body.boundary,
        body.data
      );

      // Send request
      const response = await this._sendRequest(message);

      // Calculate latency
      const endTime = GLib.get_monotonic_time();
      const latencyMs = (endTime - startTime) / 1000; // Convert us to ms

      // Parse response
      const result = this._parseResponse(response, duration, latencyMs);

      this._logger.debug('Transcription completed', {
        latencyMs,
        textLength: result.text.length,
        language: result.language,
      });

      return result;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof SttError) {
        throw error;
      }

      // Wrap unknown errors
      this._logger.error('Transcription failed', {
        error: (error as Error).message,
      });
      throw new SttError(`Transcription failed: ${(error as Error).message}`);
    }
  }

  /**
   * Build multipart form data structure
   * 
   * @task T011
   * @epic T001
   * @why Construct multipart/form-data per SPEC-REQ-007
   * @what Creates form data with audio file and model_id
   * @param {Uint8Array} audioData - Audio data
   * @param {string} modelId - Model ID
   * @param {TranscribeOptions} [options] - Additional options
   * @returns {object} Multipart form structure
   */
  private _buildMultipartForm(
    audioData: Uint8Array,
    modelId: string,
    options?: TranscribeOptions
  ): { audio: Uint8Array; model_id: string; language?: string } {
    return {
      audio: audioData,
      model_id: modelId,
      ...(options?.language && { language: options.language }),
    };
  }

  /**
   * Create multipart/form-data body for HTTP request
   * 
   * @task T011
   * @epic T001
   * @why Manual multipart construction for GJS/Soup
   * @what Builds proper multipart body with boundary
   * @param {Uint8Array} audioData - Audio data
   * @param {string} modelId - Model ID
   * @param {TranscribeOptions} [options] - Additional options
   * @returns {{ data: GLib.Bytes; boundary: string }} Body data and boundary
   */
  private _createMultipartBody(
    audioData: Uint8Array,
    modelId: string,
    options?: TranscribeOptions
  ): { data: any; boundary: string } {
    const boundary = `----FormBoundary${GLib.random_int()}`;
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];

    // Add model_id field
    chunks.push(encoder.encode(`--${boundary}\r\n`));
    chunks.push(encoder.encode('Content-Disposition: form-data; name="model_id"\r\n\r\n'));
    chunks.push(encoder.encode(`${modelId}\r\n`));

    // Add language field if specified
    if (options?.language) {
      chunks.push(encoder.encode(`--${boundary}\r\n`));
      chunks.push(encoder.encode('Content-Disposition: form-data; name="language_code"\r\n\r\n'));
      chunks.push(encoder.encode(`${options.language}\r\n`));
    }

    // Add audio file
    chunks.push(encoder.encode(`--${boundary}\r\n`));
    chunks.push(encoder.encode('Content-Disposition: form-data; name="audio"; filename="audio.wav"\r\n'));
    chunks.push(encoder.encode('Content-Type: audio/wav\r\n\r\n'));
    chunks.push(audioData);
    chunks.push(encoder.encode('\r\n'));

    // End boundary
    chunks.push(encoder.encode(`--${boundary}--\r\n`));

    // Concatenate all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return {
      data: GLib.Bytes.new(result),
      boundary,
    };
  }

  /**
   * Send HTTP request and handle response
   * 
   * @task T011
   * @epic T001
   * @why Handle HTTP communication with error handling
   * @what Sends request and processes response with retries
   * @param {Soup.Message} message - HTTP message
   * @returns {Promise<string>} Response body
   * @throws {SttAuthError} On 401
   * @throws {SttRateLimitError} On 429
   * @throws {SttNetworkError} On other HTTP errors
   */
  private _sendRequest(message: any): Promise<string> {
    return new Promise((resolve, reject) => {
      let responseBody = '';

      // Connect to response signal
      this._session.send_and_read_async(
        message,
        GLib.PRIORITY_DEFAULT,
        null, // cancellable
        (source: any, res: any) => {
          try {
            const bytes = this._session.send_and_read_finish(res);
            const statusCode = message.status_code;

            if (bytes) {
              const data = bytes.get_data();
              if (data) {
                responseBody = new TextDecoder().decode(data);
              }
            }

            // Handle response based on status code
            if (statusCode === 200) {
              resolve(responseBody);
            } else if (statusCode === 401) {
              reject(new SttAuthError('elevenlabs', 'Invalid API key'));
            } else if (statusCode === 429) {
              // Try to extract retry-after header
              const retryAfter = message.response_headers.get_one('retry-after');
              reject(new SttRateLimitError(
                'elevenlabs',
                retryAfter ? parseInt(retryAfter, 10) : undefined
              ));
            } else if (statusCode >= 500) {
              reject(new SttNetworkError('elevenlabs', `Server error: ${statusCode}`));
            } else if (statusCode >= 400) {
              reject(new SttError(`Request failed: ${statusCode} - ${responseBody}`));
            } else {
              reject(new SttNetworkError('elevenlabs', `Unexpected status: ${statusCode}`));
            }
          } catch (e) {
            reject(new SttNetworkError('elevenlabs', (e as Error).message));
          }
        }
      );
    });
  }

  /**
   * Parse API response into TranscribeResult
   * 
   * @task T011
   * @epic T001
   * @why Convert API response to standard format
   * @what Extracts text and metadata from response
   * @param {string} responseBody - Raw response
   * @param {number} duration - Audio duration
   * @param {number} latency - Request latency
   * @returns {TranscribeResult} Parsed result
   * @throws {SttError} If response parsing fails
   */
  private _parseResponse(
    responseBody: string,
    duration: number,
    latency: number
  ): TranscribeResult {
    try {
      const parsed: ElevenLabsResponse = JSON.parse(responseBody);

      return {
        text: parsed.text || '',
        confidence: parsed.language_probability,
        language: parsed.language_code,
        duration,
        latency,
      };
    } catch (e) {
      this._logger.error('Failed to parse response', {
        error: (e as Error).message,
        response: responseBody.substring(0, 200),
      });
      throw new SttError(`Failed to parse response: ${(e as Error).message}`);
    }
  }

  /**
   * Estimate audio duration from data size
   * Assumes 16kHz, 16-bit, mono WAV
   * 
   * @task T011
   * @epic T001
   * @why Calculate duration when not provided
   * @what Estimates duration based on audio format
   * @param {Uint8Array} audioData - Audio data
   * @returns {number} Estimated duration in seconds
   */
  private _estimateDuration(audioData: Uint8Array): number {
    // Standard format: 16kHz, 16-bit, mono = 32000 bytes/second
    const bytesPerSecond = 16000 * 2 * 1; // sampleRate * bytesPerSample * channels

    // Subtract WAV header if present (44 bytes)
    const dataSize = audioData.length > 44 ? audioData.length - 44 : audioData.length;

    return dataSize / bytesPerSecond;
  }

  /**
   * Update API key at runtime
   * 
   * @task T011
   * @epic T001
   * @why Allow key updates without recreating provider
   * @what Updates the API key
   * @param {string} apiKey - New API key
   */
  setApiKey(apiKey: string): void {
    this._apiKey = apiKey;
    this._logger.debug('API key updated');
  }

  /**
   * Dispose of resources
   * 
   * @task T011
   * @epic T001
   * @why Clean up HTTP session
   * @what Aborts pending requests and cleans up
   */
  dispose(): void {
    this._session.abort();
    this._logger.debug('Provider disposed');
  }
}

/**
 * Create ElevenLabs provider factory function
 * 
 * @task T011
 * @epic T001
 * @why Convenient factory for creating provider
 * @what Creates ElevenLabsProvider with config
 * @param {ElevenLabsConfig} config - Provider configuration
 * @param {Logger} logger - Logger instance
 * @returns {ElevenLabsProvider} Configured provider
 */
export function createElevenLabsProvider(
  config: ElevenLabsConfig,
  logger: Logger
): ElevenLabsProvider {
  return new ElevenLabsProvider(config, logger);
}