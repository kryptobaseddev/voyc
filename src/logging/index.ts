/**
 * @task T016
 * @epic T001
 * @why Logging module exports
 * @what Clean exports for logging and metrics systems
 */

// Logger exports
export {
    Logger,
    logger,
    LogLevel,
    type LogEntry,
    type LoggerOptions,
} from './Logger.js';

// Metrics exports
export {
    MetricsTracker,
    createMetricsTracker,
    DEFAULT_THRESHOLDS,
    type DictationTimestamps,
    type LatencyMetrics,
    type ThresholdConfig,
    type ThresholdAlertCallback,
} from './metrics.js';
