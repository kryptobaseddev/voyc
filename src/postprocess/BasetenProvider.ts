/**
 * @task T013
 * @epic T001
 * @why Baseten LLaMA post-processing provider per REQ-012
 * @what Baseten-hosted LLaMA implementation for smart formatting
 */

// GJS-style imports
import Soup from 'gi://Soup?version=3.0';
import GLib from 'gi://GLib?version=2.0';

import {
  PostProcessor,
  ProcessContext,
  ProcessResult,
  BasetenConfig,
  PostProcessAuthError,
  PostProcessNetworkError,
  PostProcessRateLimitError,
  PostProcessError,
} from './PostProcessor.js';

import { Logger } from '../logging/Logger.js';

/**
 * Baseten API response structure
 * @task T013
 * @epic T001
 * @why Type for API response parsing
 * @what Expected response structure from Baseten
 */
interface BasetenResponse {
  /** Generated text output */
  text?: string;
  /** Response content (OpenAI-compatible format) */
  choices?: Array<{
    message?: {
      content?: string;
    };
    text?: string;
  }>;
  /** Usage statistics */
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  /** Model used */
  model?: string;
}

/**
 * Baseten LLaMA Post-Processor Provider
 * Implements smart formatting and corrections via Baseten-hosted LLaMA
 * Per SPEC-REQ-012: Default post-processing provider
 * Per SPEC-REQ-017: Target latency <250ms
 * 
 * @task T013
 * @epic T001
 * @why Primary post-processing with LLaMA for formatting
 * @what Baseten API client for text post-processing
 */
export class BasetenProvider implements PostProcessor {
  readonly name = 'baseten';
  readonly displayName = 'Baseten LLaMA';

  private _apiKey: string;
  private _endpoint: string;
  private _defaultModel: string;
  private _temperature: number;
  private _maxTokens: number;
  private _timeout: number;
  private _logger: Logger;
  private _session: any;

  /**
   * Default system prompt for formatting
   * Optimized for low latency while maintaining quality
   * @task T013
   * @epic T001
   * @why Consistent formatting behavior
   * @what Default prompt for text formatting
   */
  private static readonly DEFAULT_PROMPT = `You are a text formatting assistant. Your task is to improve the formatting of transcribed speech while preserving the original meaning.

Rules:
1. Add proper punctuation (periods, commas, question marks)
2. Capitalize sentences and proper nouns
3. Fix obvious transcription errors (homophones, similar-sounding words)
4. Preserve the original wording unless clearly incorrect
5. Do NOT add explanations or commentary
6. Do NOT change the meaning or intent
7. Keep responses concise for speed

Input is raw speech-to-text output. Output only the formatted text.`;

  /**
   * Create Baseten provider instance
   * 
   * @task T013
   * @epic T001
   * @why Initialize provider with configuration per REQ-012
   * @what Sets up Baseten API client with keys and endpoint
   * @param {BasetenConfig} config - Provider configuration
   * @param {Logger} logger - Logger instance
   */
  constructor(config: BasetenConfig, logger: Logger) {
    this._apiKey = config.apiKey;
    // Baseten endpoints are deployment-specific
    this._endpoint = config.endpoint || '';
    this._defaultModel = config.defaultModel || 'llama-3.1-8b';
    this._temperature = config.temperature ?? 0.1;
    this._maxTokens = config.maxTokens ?? 1024;
    this._timeout = config.timeout ?? 30;
    this._logger = logger.child('baseten');

    // Create HTTP session
    this._session = new Soup.Session();
    this._session.set_timeout(this._timeout);

    this._logger.debug('Baseten provider initialized', {
      endpoint: this._endpoint ? '[configured]' : '[not set]',
      model: this._defaultModel,
      hasApiKey: this._apiKey.length > 0,
    });
  }

  /**
   * Process text through Baseten LLaMA
   * Per SPEC-REQ-012: Default post-processing
   * Per SPEC-REQ-017: Target latency <250ms
   * 
   * @task T013
   * @epic T001
   * @why Smart formatting via LLaMA
   * @what Sends text to Baseten API and returns formatted result
   * @param {string} text - Raw text to process
   * @param {ProcessContext} [context] - Optional processing context
   * @returns {Promise<ProcessResult>} Processed result with latency
   * @throws {PostProcessAuthError} If API key is invalid
   * @throws {PostProcessNetworkError} If request fails
   * @throws {PostProcessRateLimitError} If rate limited
   */
  async process(text: string, context?: ProcessContext): Promise<ProcessResult> {
    const startTime = GLib.get_monotonic_time();

    // Validate configuration
    if (!this._apiKey || this._apiKey.length === 0) {
      throw new PostProcessAuthError('baseten', 'API key not configured');
    }

    if (!this._endpoint || this._endpoint.length === 0) {
      throw new PostProcessError('Baseten endpoint not configured. Please set your deployment URL.');
    }

    // Validate input
    if (!text || text.length === 0) {
      return {
        text: '',
        latency: 0,
        modified: false,
      };
    }

    this._logger.debug('Starting post-processing', {
      textLength: text.length,
      model: this._defaultModel,
      hasContext: !!context,
    });

    try {
      // Build request
      const requestBody = this._buildRequest(text, context);
      
      // Create request
      const message = Soup.Message.new('POST', this._endpoint);

      if (!message) {
        throw new PostProcessNetworkError('baseten', 'Failed to create HTTP message');
      }

      // Set headers
      message.request_headers.append('Authorization', `Api-Key ${this._apiKey}`);
      message.request_headers.append('Content-Type', 'application/json');
      message.request_headers.append('Accept', 'application/json');

      // Set request body
      const bodyJson = JSON.stringify(requestBody);
      const bodyBytes = new TextEncoder().encode(bodyJson);
      message.set_request_body_from_bytes(
        'application/json',
        GLib.Bytes.new(bodyBytes)
      );

      // Send request
      const response = await this._sendRequest(message);

      // Calculate latency
      const endTime = GLib.get_monotonic_time();
      const latencyMs = (endTime - startTime) / 1000; // Convert us to ms

      // Parse response
      const result = this._parseResponse(response, latencyMs);

      // Log latency for monitoring REQ-017
      this._logger.debug('Post-processing completed', {
        latencyMs,
        textLength: text.length,
        resultLength: result.text.length,
        tokensUsed: result.tokensUsed,
        modified: result.modified,
      });

      // Warn if latency exceeds target (REQ-017: <250ms)
      if (latencyMs > 250) {
        this._logger.warn('Baseten latency exceeded target', {
          latencyMs,
          targetMs: 250,
        });
      }

      return result;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof PostProcessError) {
        throw error;
      }

      // Wrap unknown errors
      this._logger.error('Post-processing failed', {
        error: (error as Error).message,
      });
      throw new PostProcessError(`Post-processing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Build API request body
   * 
   * @task T013
   * @epic T001
   * @why Construct proper API request
   * @what Creates request body with messages and parameters
   * @param {string} text - Input text
   * @param {ProcessContext} [context] - Processing context
   * @returns {object} Request body object
   */
  private _buildRequest(text: string, context?: ProcessContext): object {
    // Build user prompt with context
    let userPrompt = text;
    
    if (context?.targetApp === 'terminal') {
      userPrompt = `[Terminal input] ${text}`;
    } else if (context?.isCommand) {
      userPrompt = `[Command] ${text}`;
    }

    // OpenAI-compatible chat completion format
    return {
      model: this._defaultModel,
      messages: [
        {
          role: 'system',
          content: BasetenProvider.DEFAULT_PROMPT,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: this._temperature,
      max_tokens: this._maxTokens,
      stream: false,
    };
  }

  /**
   * Send HTTP request and handle response
   * 
   * @task T013
   * @epic T001
   * @why Handle HTTP communication with error handling
   * @what Sends request and processes response
   * @param {Soup.Message} message - HTTP message
   * @returns {Promise<string>} Response body
   * @throws {PostProcessAuthError} On 401
   * @throws {PostProcessRateLimitError} On 429
   * @throws {PostProcessNetworkError} On other HTTP errors
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
              reject(new PostProcessAuthError('baseten', 'Invalid API key'));
            } else if (statusCode === 429) {
              // Try to extract retry-after header
              const retryAfter = message.response_headers.get_one('retry-after');
              reject(new PostProcessRateLimitError(
                'baseten',
                retryAfter ? parseInt(retryAfter, 10) : undefined
              ));
            } else if (statusCode >= 500) {
              reject(new PostProcessNetworkError('baseten', `Server error: ${statusCode}`));
            } else if (statusCode >= 400) {
              // Try to parse error message
              let errorDetail = '';
              try {
                const errorJson = JSON.parse(responseBody);
                errorDetail = errorJson.error?.message || errorJson.message || responseBody;
              } catch {
                errorDetail = responseBody;
              }
              reject(new PostProcessError(`Request failed: ${statusCode} - ${errorDetail}`));
            } else {
              reject(new PostProcessNetworkError('baseten', `Unexpected status: ${statusCode}`));
            }
          } catch (e) {
            reject(new PostProcessNetworkError('baseten', (e as Error).message));
          }
        }
      );
    });
  }

  /**
   * Parse API response into ProcessResult
   * 
   * @task T013
   * @epic T001
   * @why Convert API response to standard format
   * @what Extracts text and metadata from response
   * @param {string} responseBody - Raw response
   * @param {number} latency - Request latency in ms
   * @returns {ProcessResult} Parsed result
   * @throws {PostProcessError} If response parsing fails
   */
  private _parseResponse(responseBody: string, latency: number): ProcessResult {
    try {
      const parsed: BasetenResponse = JSON.parse(responseBody);

      // Extract text from response (handle different formats)
      let processedText = '';
      
      if (parsed.choices && parsed.choices.length > 0) {
        // OpenAI-compatible format
        const choice = parsed.choices[0];
        processedText = choice.message?.content || choice.text || '';
      } else if (parsed.text) {
        // Direct text format
        processedText = parsed.text;
      }

      // Trim whitespace
      processedText = processedText.trim();

      return {
        text: processedText,
        latency,
        tokensUsed: parsed.usage?.total_tokens,
        model: parsed.model || this._defaultModel,
        modified: processedText.length > 0,
      };
    } catch (e) {
      this._logger.error('Failed to parse response', {
        error: (e as Error).message,
        response: responseBody.substring(0, 200),
      });
      throw new PostProcessError(`Failed to parse response: ${(e as Error).message}`);
    }
  }

  /**
   * Check if provider is properly configured
   * 
   * @task T013
   * @epic T001
   * @why Validate provider readiness
   * @returns {boolean} True if API key and endpoint are set
   */
  isConfigured(): boolean {
    return this._apiKey.length > 0 && this._endpoint.length > 0;
  }

  /**
   * Update API key at runtime
   * 
   * @task T013
   * @epic T001
   * @why Allow key updates without recreating provider
   * @param {string} apiKey - New API key
   */
  setApiKey(apiKey: string): void {
    this._apiKey = apiKey;
    this._logger.debug('API key updated');
  }

  /**
   * Update endpoint at runtime
   * 
   * @task T013
   * @epic T001
   * @why Allow endpoint updates without recreating provider
   * @param {string} endpoint - New endpoint URL
   */
  setEndpoint(endpoint: string): void {
    this._endpoint = endpoint;
    this._logger.debug('Endpoint updated', { endpoint });
  }

  /**
   * Dispose of resources
   * 
   * @task T013
   * @epic T001
   * @why Clean up HTTP session
   */
  dispose(): void {
    this._session.abort();
    this._logger.debug('Provider disposed');
  }
}

/**
 * Create Baseten provider factory function
 * 
 * @task T013
 * @epic T001
 * @why Convenient factory for creating provider
 * @what Creates BasetenProvider with config
 * @param {BasetenConfig} config - Provider configuration
 * @param {Logger} logger - Logger instance
 * @returns {BasetenProvider} Configured provider
 */
export function createBasetenProvider(
  config: BasetenConfig,
  logger: Logger
): BasetenProvider {
  return new BasetenProvider(config, logger);
}