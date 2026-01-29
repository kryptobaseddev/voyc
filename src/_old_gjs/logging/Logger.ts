/**
 * @task T016
 * @epic T001
 * @why Structured logging with redaction for privacy and observability
 * @what Logger class with JSON output, log levels, and sensitive data redaction
 */

// GJS-style imports
import GLib from 'gi://GLib?version=2.0';

/**
 * Log levels in order of severity
 * @task T016
 * @epic T001
 * @why Standard log level hierarchy for filtering
 * @what Defines available log levels
 */
export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
}

/**
 * Log level names for output
 * @task T016
 * @epic T001
 * @why Human-readable level names in logs
 * @what Maps LogLevel to string representation
 */
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.DEBUG]: 'DEBUG',
};

/**
 * Log entry structure for JSON output
 * @task T016
 * @epic T001
 * @why Structured logging format for systemd journal parsing
 * @what Defines the shape of log entries
 */
export interface LogEntry {
    /** ISO 8601 timestamp */
    timestamp: string;
    /** Log level name */
    level: string;
    /** Log message */
    message: string;
    /** Optional context data (redacted) */
    context?: Record<string, unknown>;
    /** Component that emitted the log */
    component?: string;
}

/**
 * Logger options
 * @task T016
 * @epic T001
 * @why Configurable logger behavior
 * @what Options for logger initialization
 */
export interface LoggerOptions {
    /** Minimum log level to output */
    minLevel?: LogLevel;
    /** Component name for all logs */
    component?: string;
    /** Whether to include timestamps */
    includeTimestamp?: boolean;
    /** Custom redaction function */
    redactFn?: (data: unknown) => unknown;
}

/**
 * Structured logger with redaction support
 * Outputs JSON to stderr for systemd journal capture
 * 
 * @task T016
 * @epic T001
 * @why Privacy-aware structured logging for observability
 * @what Logger that redacts sensitive data and outputs structured JSON
 */
export class Logger {
    private _minLevel: LogLevel;
    private _component: string;
    private _includeTimestamp: boolean;
    private _redactFn: (data: unknown) => unknown;

    /**
     * Create a new Logger instance
     * 
     * @task T016
     * @epic T001
     * @why Initialize logger with configuration
     * @what Creates logger with specified options
     * @param {LoggerOptions} [options={}] - Logger configuration
     */
    constructor(options: LoggerOptions = {}) {
        this._minLevel = options.minLevel ?? LogLevel.INFO;
        this._component = options.component ?? 'voyc';
        this._includeTimestamp = options.includeTimestamp ?? true;
        this._redactFn = options.redactFn ?? this._defaultRedact.bind(this);
    }

    /**
     * Get the current minimum log level
     * 
     * @task T016
     * @epic T001
     * @why Check current log level
     * @what Returns minimum level that will be logged
     * @returns {LogLevel} Current minimum log level
     */
    get minLevel(): LogLevel {
        return this._minLevel;
    }

    /**
     * Set the minimum log level
     * 
     * @task T016
     * @epic T001
     * @why Runtime log level adjustment
     * @what Updates minimum level for filtering
     * @param {LogLevel} level - New minimum level
     */
    setMinLevel(level: LogLevel): void {
        this._minLevel = level;
    }

    /**
     * Get the component name
     * 
     * @task T016
     * @epic T001
     * @why Access component identifier
     * @what Returns component name used in logs
     * @returns {string} Component name
     */
    get component(): string {
        return this._component;
    }

    /**
     * Create a child logger with a sub-component
     * 
     * @task T016
     * @epic T001
     * @why Hierarchical component naming
     * @what Creates new logger with component prefix
     * @param {string} subComponent - Sub-component name
     * @returns {Logger} Child logger instance
     */
    child(subComponent: string): Logger {
        return new Logger({
            minLevel: this._minLevel,
            component: `${this._component}.${subComponent}`,
            includeTimestamp: this._includeTimestamp,
            redactFn: this._redactFn,
        });
    }

    /**
     * Log at ERROR level
     * 
     * @task T016
     * @epic T001
     * @why Error logging with context
     * @what Logs error message with optional context
     * @param {string} message - Error message
     * @param {Record<string, unknown>} [context] - Optional context
     */
    error(message: string, context?: Record<string, unknown>): void {
        this._log(LogLevel.ERROR, message, context);
    }

    /**
     * Log at WARN level
     * 
     * @task T016
     * @epic T001
     * @why Warning logging with context
     * @what Logs warning message with optional context
     * @param {string} message - Warning message
     * @param {Record<string, unknown>} [context] - Optional context
     */
    warn(message: string, context?: Record<string, unknown>): void {
        this._log(LogLevel.WARN, message, context);
    }

    /**
     * Log at INFO level
     * 
     * @task T016
     * @epic T001
     * @why Info logging with context
     * @what Logs info message with optional context
     * @param {string} message - Info message
     * @param {Record<string, unknown>} [context] - Optional context
     */
    info(message: string, context?: Record<string, unknown>): void {
        this._log(LogLevel.INFO, message, context);
    }

    /**
     * Log at DEBUG level
     * 
     * @task T016
     * @epic T001
     * @why Debug logging with context
     * @what Logs debug message with optional context
     * @param {string} message - Debug message
     * @param {Record<string, unknown>} [context] - Optional context
     */
    debug(message: string, context?: Record<string, unknown>): void {
        this._log(LogLevel.DEBUG, message, context);
    }

    /**
     * Check if a log level would be emitted
     * 
     * @task T016
     * @epic T001
     * @why Avoid expensive operations for filtered logs
     * @what Returns true if level >= minLevel
     * @param {LogLevel} level - Level to check
     * @returns {boolean} True if would be logged
     */
    isEnabled(level: LogLevel): boolean {
        return level <= this._minLevel;
    }

    /**
     * Internal log method
     * 
     * @task T016
     * @epic T001
     * @why Central logging logic with redaction
     * @what Creates log entry, redacts, and outputs to stderr
     * @param {LogLevel} level - Log level
     * @param {string} message - Log message
     * @param {Record<string, unknown>} [context] - Optional context
     */
    private _log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
        if (level > this._minLevel) {
            return;
        }

        const entry: LogEntry = {
            timestamp: this._includeTimestamp ? this._getTimestamp() : '',
            level: LOG_LEVEL_NAMES[level],
            message,
            component: this._component,
        };

        if (context && Object.keys(context).length > 0) {
            entry.context = this._redactFn(context) as Record<string, unknown>;
        }

        // Output structured JSON to stderr for systemd journal
        const json = JSON.stringify(entry);
        (GLib as any).printerr(`${json}\n`);
    }

    /**
     * Get ISO 8601 timestamp
     * 
     * @task T016
     * @epic T001
     * @why Standard timestamp format
     * @what Returns current time in ISO format
     * @returns {string} ISO 8601 timestamp
     */
    private _getTimestamp(): string {
        return new Date().toISOString();
    }

    /**
     * Default redaction function
     * Redacts API keys and sensitive fields
     * 
     * @task T016
     * @epic T001
     * @why Privacy protection in logs
     * @what Recursively redacts sensitive data
     * @param {unknown} data - Data to redact
     * @returns {unknown} Redacted data
     */
    private _defaultRedact(data: unknown): unknown {
        if (data === null || data === undefined) {
            return data;
        }

        if (typeof data === 'string') {
            return this._redactString(data);
        }

        if (Array.isArray(data)) {
            return data.map(item => this._defaultRedact(item));
        }

        if (typeof data === 'object') {
            const result: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(data)) {
                // Check if key indicates sensitive data
                if (this._isSensitiveKey(key)) {
                    result[key] = this._redactValue(value);
                } else {
                    result[key] = this._defaultRedact(value);
                }
            }
            return result;
        }

        return data;
    }

    /**
     * Check if a key indicates sensitive data
     * 
     * @task T016
     * @epic T001
     * @why Identify sensitive field names
     * @what Returns true for keys that should be redacted
     * @param {string} key - Object key to check
     * @returns {boolean} True if sensitive
     */
    private _isSensitiveKey(key: string): boolean {
        const sensitivePatterns = [
            /api[_-]?key/i,
            /apikey/i,
            /auth[_-]?token/i,
            /password/i,
            /secret/i,
            /private[_-]?key/i,
            /credential/i,
            /xi-api-key/i,  // ElevenLabs specific
            /authorization/i,
        ];
        return sensitivePatterns.some(pattern => pattern.test(key));
    }

    /**
     * Redact a string value
     * 
     * @task T016
     * @epic T001
     * @why Redact API keys in string values
     * @what Masks API key patterns in strings
     * @param {string} value - String to check
     * @returns {string} Redacted or original string
     */
    private _redactString(value: string): string {
        // Redact common API key patterns
        const apiKeyPatterns = [
            // ElevenLabs: sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
            /\bsk_[a-zA-Z0-9]{32,}\b/g,
            // OpenAI: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
            /\bsk-[a-zA-Z0-9]{32,}\b/g,
            // Generic API keys (hex or base64-like)
            /\b(?:api[_-]?key|apikey)\s*[:=]\s*["']?[a-zA-Z0-9_-]{16,}["']?/gi,
        ];

        let result = value;
        for (const pattern of apiKeyPatterns) {
            result = result.replace(pattern, '[REDACTED_API_KEY]');
        }
        return result;
    }

    /**
     * Redact a value based on its type
     * 
     * @task T016
     * @epic T001
     * @why Generic value redaction
     * @what Returns redacted representation of value
     * @param {unknown} value - Value to redact
     * @returns {unknown} Redacted value
     */
    private _redactValue(value: unknown): unknown {
        if (typeof value === 'string') {
            if (value.length === 0) {
                return '';
            }
            // Show first 4 chars if long enough, mask the rest
            if (value.length > 8) {
                return `${value.slice(0, 4)}...${value.slice(-4)}`;
            }
            return '[REDACTED]';
        }
        return '[REDACTED]';
    }
}

/**
 * Default logger instance
 * @task T016
 * @epic T001
 * @why Singleton logger for general use
 * @what Shared logger instance
 */
export const logger = new Logger();