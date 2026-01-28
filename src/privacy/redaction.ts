/**
 * @task T016
 * @epic T001
 * @why Sensitive data redaction for privacy protection per REQ-020
 * @what Redaction utilities for API keys, transcripts, and personal data
 */

/**
 * Redaction options
 * @task T016
 * @epic T001
 * @why Configurable redaction behavior
 * @what Options for redaction functions
 */
export interface RedactionOptions {
    /** Whether to redact API keys (default: true) */
    redactApiKeys?: boolean;
    /** Whether to redact transcripts (default: true) */
    redactTranscripts?: boolean;
    /** Whether to redact personal data like emails (default: true) */
    redactPersonalData?: boolean;
    /** Custom patterns to redact */
    customPatterns?: RedactionPattern[];
    /** Replacement string (default: [REDACTED]) */
    replacement?: string;
}

/**
 * Redaction pattern definition
 * @task T016
 * @epic T001
 * @why Extensible redaction patterns
 * @what Defines a pattern and its replacement
 */
export interface RedactionPattern {
    /** Pattern name for identification */
    name: string;
    /** RegExp to match sensitive data */
    pattern: RegExp;
    /** Replacement string or function */
    replacement?: string | ((match: string) => string);
}

/**
 * Default replacement string
 * @task T016
 * @epic T001
 * @why Consistent redaction appearance
 * @what Default string to replace sensitive data
 */
export const DEFAULT_REPLACEMENT = '[REDACTED]';

/**
 * Built-in API key patterns
 * @task T016
 * @epic T001
 * @why Common API key format detection
 * @what Patterns for major API providers
 */
export const API_KEY_PATTERNS: RedactionPattern[] = [
    {
        name: 'elevenlabs-api-key',
        pattern: /\bsk_[a-f0-9]{32}\b/gi,
        replacement: '[ELEVENLABS_KEY]',
    },
    {
        name: 'openai-api-key',
        pattern: /\bsk-[a-zA-Z0-9]{32,}\b/g,
        replacement: '[OPENAI_KEY]',
    },
    {
        name: 'generic-api-key',
        pattern: /\b(?:api[_-]?key|apikey|api_token)\s*[:=]\s*["']?[a-zA-Z0-9_-]{16,}["']?/gi,
        replacement: '[API_KEY]',
    },
    {
        name: 'bearer-token',
        pattern: /\bBearer\s+[a-zA-Z0-9_-]+\.?[a-zA-Z0-9_-]*\.?[a-zA-Z0-9_-]*/gi,
        replacement: '[BEARER_TOKEN]',
    },
    {
        name: 'auth-header',
        pattern: /\bAuthorization:\s*[^\s\n]+/gi,
        replacement: '[AUTH_HEADER]',
    },
];

/**
 * Built-in personal data patterns
 * @task T016
 * @epic T001
 * @why PII detection and redaction
 * @what Patterns for common personal data
 */
export const PERSONAL_DATA_PATTERNS: RedactionPattern[] = [
    {
        name: 'email',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        replacement: (match: string) => {
            const [local, domain] = match.split('@');
            return `${local.slice(0, 2)}***@${domain}`;
        },
    },
    {
        name: 'phone-number',
        pattern: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
        replacement: '[PHONE]',
    },
    {
        name: 'ssn',
        pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
        replacement: '[SSN]',
    },
    {
        name: 'credit-card',
        pattern: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g,
        replacement: (match: string) => {
            const digits = match.replace(/\D/g, '');
            return `****-****-****-${digits.slice(-4)}`;
        },
    },
];

/**
 * Redact sensitive data from a string
 * 
 * @task T016
 * @epic T001
 * @why Privacy protection in logs per REQ-020
 * @what Applies redaction patterns to string content
 * @param {string} content - Content to redact
 * @param {RedactionOptions} [options={}] - Redaction options
 * @returns {string} Redacted content
 */
export function redactString(content: string, options: RedactionOptions = {}): string {
    const {
        redactApiKeys = true,
        redactPersonalData = true,
        customPatterns = [],
        replacement = DEFAULT_REPLACEMENT,
    } = options;

    let result = content;
    const patterns: RedactionPattern[] = [...customPatterns];

    if (redactApiKeys) {
        patterns.push(...API_KEY_PATTERNS);
    }

    if (redactPersonalData) {
        patterns.push(...PERSONAL_DATA_PATTERNS);
    }

    for (const { pattern, replacement: patternReplacement } of patterns) {
        const repl = patternReplacement ?? replacement;
        result = result.replace(pattern, repl as string);
    }

    return result;
}

/**
 * Redact sensitive data from an object
 * Recursively processes all string values
 * 
 * @task T016
 * @epic T001
 * @why Deep redaction of complex objects
 * @what Recursively redacts all strings in an object
 * @param {unknown} data - Data to redact
 * @param {RedactionOptions} [options={}] - Redaction options
 * @returns {unknown} Redacted data
 */
export function redactObject(data: unknown, options: RedactionOptions = {}): unknown {
    if (data === null || data === undefined) {
        return data;
    }

    if (typeof data === 'string') {
        return redactString(data, options);
    }

    if (typeof data === 'number' || typeof data === 'boolean') {
        return data;
    }

    if (Array.isArray(data)) {
        return data.map(item => redactObject(item, options));
    }

    if (typeof data === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
            // Check if key indicates sensitive data that should be fully redacted
            if (shouldRedactKey(key, options)) {
                result[key] = redactValue(value, options.replacement);
            } else {
                result[key] = redactObject(value, options);
            }
        }
        return result;
    }

    return data;
}

/**
 * Redact a transcript for logging
 * Per REQ-020: Transcripts not logged by default
 * 
 * @task T016
 * @epic T001
 * @why Transcript privacy protection
 * @what Redacts or masks transcript content
 * @param {string} transcript - Raw transcript text
 * @param {boolean} [allowLogging=false] - Whether transcript logging is enabled
 * @returns {string} Redacted or placeholder transcript
 */
export function redactTranscript(transcript: string, allowLogging: boolean = false): string {
    if (!allowLogging) {
        return '[TRANSCRIPT_REDACTED]';
    }

    // If logging is allowed, still redact potential PII
    return redactString(transcript, {
        redactApiKeys: true,
        redactPersonalData: true,
        redactTranscripts: false,
    });
}

/**
 * Redact API keys from headers or config objects
 * 
 * @task T016
 * @epic T001
 * @why API key protection in all contexts
 * @what Specifically targets API key fields
 * @param {Record<string, unknown>} headers - Headers or config object
 * @returns {Record<string, unknown>} Redacted headers
 */
export function redactHeaders(headers: Record<string, unknown>): Record<string, unknown> {
    const sensitiveHeaders = [
        'authorization',
        'x-api-key',
        'xi-api-key',
        'api-key',
        'x-auth-token',
    ];

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(headers)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveHeaders.includes(lowerKey)) {
            result[key] = redactValue(value, DEFAULT_REPLACEMENT);
        } else if (typeof value === 'string') {
            result[key] = redactString(value, { redactApiKeys: true });
        } else {
            result[key] = value;
        }
    }
    return result;
}

/**
 * Check if a key indicates sensitive data
 * 
 * @task T016
 * @epic T001
 * @why Identify sensitive field names
 * @what Returns true for keys that should be fully redacted
 * @param {string} key - Object key to check
 * @param {RedactionOptions} [options={}] - Redaction options
 * @returns {boolean} True if key indicates sensitive data
 */
function shouldRedactKey(key: string, options: RedactionOptions = {}): boolean {
    const { redactApiKeys = true, redactTranscripts = true } = options;

    const sensitivePatterns = [
        { pattern: /api[_-]?key/i, enabled: redactApiKeys },
        { pattern: /apikey/i, enabled: redactApiKeys },
        { pattern: /auth[_-]?token/i, enabled: redactApiKeys },
        { pattern: /password/i, enabled: redactApiKeys },
        { pattern: /secret/i, enabled: redactApiKeys },
        { pattern: /transcript/i, enabled: redactTranscripts },
        { pattern: /raw[_-]?audio/i, enabled: true },
        { pattern: /audio[_-]?data/i, enabled: true },
    ];

    return sensitivePatterns.some(
        ({ pattern, enabled }) => enabled && pattern.test(key)
    );
}

/**
 * Redact a value based on its type
 * 
 * @task T016
 * @epic T001
 * @why Generic value redaction
 * @what Returns redacted representation of value
 * @param {unknown} value - Value to redact
 * @param {string} [replacement] - Custom replacement string
 * @returns {unknown} Redacted value
 */
function redactValue(value: unknown, replacement?: string): unknown {
    const repl = replacement ?? DEFAULT_REPLACEMENT;

    if (typeof value === 'string') {
        if (value.length === 0) {
            return '';
        }
        // Show first/last 4 chars for long strings, mask middle
        if (value.length > 12) {
            return `${value.slice(0, 4)}...${value.slice(-4)}`;
        }
        return repl;
    }

    if (typeof value === 'number') {
        return 0;
    }

    return repl;
}

/**
 * Create a redacted log entry
 * Convenience function for common logging scenario
 * 
 * @task T016
 * @epic T001
 * @why Easy redaction for log context
 * @what Redacts all sensitive data in a context object
 * @param {Record<string, unknown>} context - Log context
 * @param {boolean} [logTranscripts=false] - Whether to allow transcript logging
 * @returns {Record<string, unknown>} Redacted context
 */
export function createRedactedContext(
    context: Record<string, unknown>,
    logTranscripts: boolean = false
): Record<string, unknown> {
    return redactObject(context, {
        redactApiKeys: true,
        redactPersonalData: true,
        redactTranscripts: !logTranscripts,
    }) as Record<string, unknown>;
}

/**
 * Mask an API key for display
 * Shows only first/last few characters
 * 
 * @task T016
 * @epic T001
 * @why Safe API key display in UI
 * @what Masks API key with ellipsis
 * @param {string} apiKey - API key to mask
 * @param {number} [visibleChars=4] - Number of chars to show at each end
 * @returns {string} Masked API key
 */
export function maskApiKey(apiKey: string, visibleChars: number = 4): string {
    if (!apiKey || apiKey.length <= visibleChars * 2) {
        return '****';
    }
    const start = apiKey.slice(0, visibleChars);
    const end = apiKey.slice(-visibleChars);
    return `${start}...${end}`;
}
