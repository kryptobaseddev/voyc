/**
 * @task T011
 * @epic T001
 * @why OpenAI STT provider implementation per REQ-010
 * @what OpenAI Whisper API client for speech-to-text
 */

// GJS-style imports
import Soup from 'gi://Soup?version=3.0';
import GLib from 'gi://GLib?version=2.0';

import {
  SttProvider,
  TranscribeOptions,
  TranscribeResult,
  SttAuthError,
  SttNetworkError,
  SttRateLimitError,
  SttError,
  OpenAIConfig,
} from './SttProvider.js';

import { Logger } from '../logging/Logger.js';

/**
 * OpenAI Whisper API response
 * @task T011
 * @epic T001
 * @why Type for API response parsing
 * @what Expected response structure from OpenAI
 */
interface OpenAIResponse {
  /** Transcribed text */
  text: string;
  /** Task type */
  task?: string;
  /** Detected language */
  language?: string;
  /** Duration in seconds */
  duration?: number;
  /** Word-level data (verbose_json only) */
  words?: Array<{ 
    word: string;
    start: number;
    end: number;
  }>;
  /** Segment-level data (verbose_json only) */
  segments?: Array<{ 
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }>;
}

/**
 * OpenAI STT Provider
 * Implements Whisper transcription via REST API
 * Per SPEC-REQ-010
 * 
 * @task T011
 * @epic T001
 * @why Alternative STT provider using OpenAI Whisper
 * @what REST API client for Whisper speech-to-text
 */
export class OpenAIProvider implements SttProvider {
  readonly name = 'openai';
  readonly supportsStreaming = false;

  private _apiKey: string;
  private _endpoint: string;
  private _defaultModel: string;
  private _responseFormat: string;
  private _temperature: number;
  private _logger: Logger;
  private _session: any;

  /**
   * Create OpenAI provider instance
   * 
   * @task T011
   * @epic T001
   * @why Initialize provider with configuration
   * @what Sets up API client with keys and endpoint
   * @param {OpenAIConfig} config - Provider configuration
   * @param {Logger} logger - Logger instance
   */
  constructor(config: OpenAIConfig, logger: Logger) {
    this._apiKey = config.apiKey;
    this._endpoint = config.endpoint || 'https://api.openai.com/v1';
    this._defaultModel = config.defaultModel || 'whisper-1';
    this._responseFormat = config.responseFormat || 'json';
    this._temperature = config.temperature ?? 0;
    this._logger = logger.child('openai');

    // Create HTTP session
    this._session = new Soup.Session();
    this._session.set_timeout(30); // 30 second timeout

    this._logger.debug('OpenAI provider initialized', {
      endpoint: this._endpoint,
      model: this._defaultModel,
      hasApiKey: this._apiKey.length > 0,
    });
  }

  /**
   * Transcribe audio using OpenAI Whisper API
   * Per SPEC-REQ-010: POST /v1/audio/transcriptions
   * Auth: Authorization: Bearer {key}
   * Model: whisper-1
   * 
   * @task T011
   * @epic T001
   * @why Batch transcription via OpenAI Whisper
   * @what Sends audio to API and returns transcription
   * @param {Uint8Array} audioData - Audio data (WAV, MP3, MP4, etc.)
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
      throw new SttAuthError('openai', 'API key not configured');
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
      // Create request
      const url = `${this._endpoint}/audio/transcriptions`;
      const message = Soup.Message.new('POST', url);

      if (!message) {
        throw new SttNetworkError('openai', 'Failed to create HTTP message');
      }

      // Set headers per SPEC-REQ-010
      message.request_headers.append('Authorization', `Bearer ${this._apiKey}`);
      message.request_headers.append('Accept', 'application/json');

      // Build multipart body
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

    // Add model field
    chunks.push(encoder.encode(`--${boundary}\r\n`));
    chunks.push(encoder.encode('Content-Disposition: form-data; name="model"\r\n\r\n'));
    chunks.push(encoder.encode(`${modelId}\r\n`));

    // Add language field if specified
    if (options?.language) {
      chunks.push(encoder.encode(`--${boundary}\r\n`));
      chunks.push(encoder.encode('Content-Disposition: form-data; name="language"\r\n\r\n'));
      chunks.push(encoder.encode(`${options.language}\r\n`));
    }

    // Add response_format field
    chunks.push(encoder.encode(`--${boundary}\r\n`));
    chunks.push(encoder.encode('Content-Disposition: form-data; name="response_format"\r\n\r\n'));
    chunks.push(encoder.encode(`${this._responseFormat}\r\n`));

    // Add temperature field
    chunks.push(encoder.encode(`--${boundary}\r\n`));
    chunks.push(encoder.encode('Content-Disposition: form-data; name="temperature"\r\n\r\n'));
    chunks.push(encoder.encode(`${this._temperature}\r\n`));

    // Add audio file
    chunks.push(encoder.encode(`--${boundary}\r\n`));
    chunks.push(encoder.encode('Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n'));
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
   * @what Sends request and processes response
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
              reject(new SttAuthError('openai', 'Invalid API key'));
            } else if (statusCode === 429) {
              // Try to extract retry-after header
              const retryAfter = message.response_headers.get_one('retry-after');
              reject(new SttRateLimitError(
                'openai',
                retryAfter ? parseInt(retryAfter, 10) : undefined
              ));
            } else if (statusCode >= 500) {
              reject(new SttNetworkError('openai', `Server error: ${statusCode}`));
            } else if (statusCode >= 400) {
              // Try to parse error message from OpenAI
              let errorDetail = '';
              try {
                const errorJson = JSON.parse(responseBody);
                errorDetail = errorJson.error?.message || responseBody;
              } catch {
                errorDetail = responseBody;
              }
              reject(new SttError(`Request failed: ${statusCode} - ${errorDetail}`));
            } else {
              reject(new SttNetworkError('openai', `Unexpected status: ${statusCode}`));
            }
          } catch (e) {
            reject(new SttNetworkError('openai', (e as Error).message));
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
      const parsed: OpenAIResponse = JSON.parse(responseBody);

      return {
        text: parsed.text || '',
        language: parsed.language,
        duration: parsed.duration || duration,
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
   * Update response format
   * 
   * @task T011
   * @epic T001
   * @why Allow format changes at runtime
   * @what Updates the response format
   * @param {string} format - New format (json, text, srt, etc.)
   */
  setResponseFormat(format: string): void {
    this._responseFormat = format;
    this._logger.debug('Response format updated', { format });
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
 * Create OpenAI provider factory function
 * 
 * @task T011
 * @epic T001
 * @why Convenient factory for creating provider
 * @what Creates OpenAIProvider with config
 * @param {OpenAIConfig} config - Provider configuration
 * @param {Logger} logger - Logger instance
 * @returns {OpenAIProvider} Configured provider
 */
export function createOpenAIProvider(
  config: OpenAIConfig,
  logger: Logger
): OpenAIProvider {
  return new OpenAIProvider(config, logger);
}