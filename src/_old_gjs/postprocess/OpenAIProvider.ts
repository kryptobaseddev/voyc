/**
 * @task T013
 * @epic T001
 * @why OpenAI GPT post-processing provider per REQ-013
 * @what OpenAI GPT implementation for text formatting and polish
 */

// GJS-style imports
import Soup from 'gi://Soup?version=3.0';
import GLib from 'gi://GLib?version=2.0';

import {
  PostProcessor,
  ProcessContext,
  ProcessResult,
  OpenAIPostProcessConfig,
  PostProcessAuthError,
  PostProcessNetworkError,
  PostProcessRateLimitError,
  PostProcessError,
} from './PostProcessor.js';

import { Logger } from '../logging/Logger.js';

/**
 * OpenAI API response structure
 * @task T013
 * @epic T001
 * @why Type for API response parsing
 * @what Expected response structure from OpenAI
 */
interface OpenAIResponse {
  /** Response ID */
  id?: string;
  /** Object type */
  object?: string;
  /** Creation timestamp */
  created?: number;
  /** Model used */
  model?: string;
  /** Response choices */
  choices: Array<{
    index?: number;
    message?: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
  /** Usage statistics */
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * OpenAI GPT Post-Processor Provider
 * Implements text formatting and polish via OpenAI GPT API
 * Per SPEC-REQ-013: Additional post-processing provider
 * 
 * @task T013
 * @epic T001
 * @why Alternative post-processing with GPT models
 * @what OpenAI API client for text post-processing
 */
export class OpenAIProvider implements PostProcessor {
  readonly name = 'openai';
  readonly displayName = 'OpenAI GPT';

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
   * Optimized for GPT models
   * @task T013
   * @epic T001
   * @why Consistent formatting behavior
   * @what Default prompt for text formatting with GPT
   */
  private static readonly DEFAULT_PROMPT = `You are a text formatting assistant. Improve the formatting of transcribed speech while preserving the original meaning.

Instructions:
1. Add proper punctuation (periods, commas, question marks, exclamation points)
2. Capitalize sentences and proper nouns correctly
3. Fix obvious transcription errors and homophones
4. Maintain the original tone and intent
5. Do NOT add explanations, commentary, or markdown
6. Do NOT expand or elaborate on the content
7. Output only the formatted text, nothing else

Input is raw speech-to-text. Output only the improved text.`;

  /**
   * Polish-focused system prompt
   * For more advanced text refinement
   * @task T013
   * @epic T001
   * @why Advanced formatting option
   * @what Enhanced prompt for text polish
   */
  private static readonly POLISH_PROMPT = `You are a writing assistant. Polish the transcribed text for clarity and professionalism while preserving the speaker's voice.

Instructions:
1. Fix grammar and punctuation
2. Improve sentence flow and clarity
3. Fix transcription errors
4. Maintain original meaning and tone
5. Make minimal changes - preserve the speaker's style
6. Do NOT add commentary or explanations
7. Output only the polished text

Input is raw speech-to-text. Output only the polished text.`;

  /**
   * Create OpenAI provider instance
   * 
   * @task T013
   * @epic T001
   * @why Initialize provider with configuration per REQ-013
   * @what Sets up OpenAI API client with keys and endpoint
   * @param {OpenAIPostProcessConfig} config - Provider configuration
   * @param {Logger} logger - Logger instance
   */
  constructor(config: OpenAIPostProcessConfig, logger: Logger) {
    this._apiKey = config.apiKey;
    this._endpoint = config.endpoint || 'https://api.openai.com/v1';
    // Default to gpt-4o-mini for speed and cost efficiency
    this._defaultModel = config.defaultModel || 'gpt-4o-mini';
    this._temperature = config.temperature ?? 0.1;
    this._maxTokens = config.maxTokens ?? 1024;
    this._timeout = config.timeout ?? 30;
    this._logger = logger.child('openai-postprocess');

    // Create HTTP session
    this._session = new Soup.Session();
    this._session.set_timeout(this._timeout);

    this._logger.debug('OpenAI post-process provider initialized', {
      endpoint: this._endpoint,
      model: this._defaultModel,
      hasApiKey: this._apiKey.length > 0,
    });
  }

  /**
   * Process text through OpenAI GPT
   * Per SPEC-REQ-013: Additional post-processing provider
   * 
   * @task T013
   * @epic T001
   * @why Smart formatting via GPT
   * @what Sends text to OpenAI API and returns formatted result
   * @param {string} text - Raw text to process
   * @param {ProcessContext} [context] - Optional processing context
   * @returns {Promise<ProcessResult>} Processed result with latency
   * @throws {PostProcessAuthError} If API key is invalid
   * @throws {PostProcessNetworkError} If request fails
   * @throws {PostProcessRateLimitError} If rate limited
   */
  async process(text: string, context?: ProcessContext): Promise<ProcessResult> {
    const startTime = GLib.get_monotonic_time();

    // Validate API key
    if (!this._apiKey || this._apiKey.length === 0) {
      throw new PostProcessAuthError('openai', 'API key not configured');
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
      const url = `${this._endpoint}/chat/completions`;
      const message = Soup.Message.new('POST', url);

      if (!message) {
        throw new PostProcessNetworkError('openai', 'Failed to create HTTP message');
      }

      // Set headers
      message.request_headers.append('Authorization', `Bearer ${this._apiKey}`);
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

      this._logger.debug('Post-processing completed', {
        latencyMs,
        textLength: text.length,
        resultLength: result.text.length,
        tokensUsed: result.tokensUsed,
        modified: result.modified,
      });

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
    // Select prompt based on context
    let systemPrompt = OpenAIProvider.DEFAULT_PROMPT;
    
    if (context?.targetApp === 'terminal' || context?.isCommand) {
      // Use default prompt for commands (minimal changes)
      systemPrompt = OpenAIProvider.DEFAULT_PROMPT;
    }

    // Build user content with context hints
    let userContent = text;
    
    if (context?.targetApp === 'terminal') {
      userContent = `Format this terminal command:\n${text}`;
    } else if (context?.isCommand) {
      userContent = `Format this command:\n${text}`;
    }

    return {
      model: this._defaultModel,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userContent,
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
              reject(new PostProcessAuthError('openai', 'Invalid API key'));
            } else if (statusCode === 429) {
              // Try to extract retry-after header
              const retryAfter = message.response_headers.get_one('retry-after');
              reject(new PostProcessRateLimitError(
                'openai',
                retryAfter ? parseInt(retryAfter, 10) : undefined
              ));
            } else if (statusCode >= 500) {
              reject(new PostProcessNetworkError('openai', `Server error: ${statusCode}`));
            } else if (statusCode >= 400) {
              // Try to parse error message from OpenAI
              let errorDetail = '';
              try {
                const errorJson = JSON.parse(responseBody);
                errorDetail = errorJson.error?.message || responseBody;
              } catch {
                errorDetail = responseBody;
              }
              reject(new PostProcessError(`Request failed: ${statusCode} - ${errorDetail}`));
            } else {
              reject(new PostProcessNetworkError('openai', `Unexpected status: ${statusCode}`));
            }
          } catch (e) {
            reject(new PostProcessNetworkError('openai', (e as Error).message));
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
      const parsed: OpenAIResponse = JSON.parse(responseBody);

      // Extract text from response
      let processedText = '';
      
      if (parsed.choices && parsed.choices.length > 0) {
        const choice = parsed.choices[0];
        processedText = choice.message?.content || '';
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
   * @returns {boolean} True if API key is set
   */
  isConfigured(): boolean {
    return this._apiKey.length > 0;
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
   * Update model at runtime
   * 
   * @task T013
   * @epic T001
   * @why Allow model changes without recreating provider
   * @param {string} model - New model name
   */
  setModel(model: string): void {
    this._defaultModel = model;
    this._logger.debug('Model updated', { model });
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
 * Create OpenAI provider factory function
 * 
 * @task T013
 * @epic T001
 * @why Convenient factory for creating provider
 * @what Creates OpenAIProvider with config
 * @param {OpenAIPostProcessConfig} config - Provider configuration
 * @param {Logger} logger - Logger instance
 * @returns {OpenAIProvider} Configured provider
 */
export function createOpenAIPostProcessProvider(
  config: OpenAIPostProcessConfig,
  logger: Logger
): OpenAIProvider {
  return new OpenAIProvider(config, logger);
}