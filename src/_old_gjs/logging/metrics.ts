/**
 * @task T016
 * @epic T001
 * @why Latency tracking and threshold alerting for performance observability
 * @what Metrics tracker with timestamps and configurable thresholds
 */

// GJS-style imports
imports.gi.versions.GLib = '2.0';

const { GLib } = imports.gi;

import { Logger, LogLevel } from './Logger.js';

/**
 * Dictation stage timestamps
 * Tracks the lifecycle of a dictation session
 * @task T016
 * @epic T001
 * @why End-to-end latency visibility per REQ-016
 * @what Defines all trackable timestamps in dictation flow
 */
export interface DictationTimestamps {
    /** When recording started (microseconds) */
    captureStart: number;
    /** When STT completed (microseconds) */
    sttComplete?: number;
    /** When post-processing completed (microseconds) */
    postProcessComplete?: number;
    /** When text was injected (microseconds) */
    injectionComplete?: number;
}

/**
 * Latency metrics for a completed dictation
 * @task T016
 * @epic T001
 * @why Calculated latency breakdown per stage
 * @what Computed latencies from timestamps
 */
export interface LatencyMetrics {
    /** Total time from capture start to injection (ms) */
    totalMs: number;
    /** STT processing time (ms) */
    sttMs: number;
    /** Post-processing time (ms) */
    postProcessMs: number;
    /** Injection time (ms) */
    injectionMs: number;
    /** Time from capture stop to STT completion (ms) */
    processingMs: number;
}

/**
 * Threshold configuration
 * @task T016
 * @epic T001
 * @why Configurable alerting per REQ-017
 * @what Defines thresholds for latency alerts
 */
export interface ThresholdConfig {
    /** Baseten post-processing target in ms (default: 250ms) */
    basetenPostProcessMs: number;
    /** Total dictation latency warning threshold (ms) */
    totalLatencyMs: number;
    /** STT latency warning threshold (ms) */
    sttLatencyMs: number;
}

/**
 * Default threshold configuration
 * Per SPEC-REQ-017: Baseten post-processing target <250ms
 * @task T016
 * @epic T001
 * @why Sensible defaults for latency alerts
 * @what Default threshold values
 */
export const DEFAULT_THRESHOLDS: ThresholdConfig = {
    basetenPostProcessMs: 250,  // REQ-017: Baseten target <250ms
    totalLatencyMs: 2000,       // 2 seconds total
    sttLatencyMs: 1500,         // 1.5 seconds for STT
};

/**
 * Threshold alert callback
 * @task T016
 * @epic T001
 * @why Allow custom handling of threshold violations
 * @what Function signature for alert handlers
 */
export type ThresholdAlertCallback = (
    thresholdName: string,
    actualMs: number,
    thresholdMs: number,
    context: Record<string, unknown>
) => void;

/**
 * Metrics tracker for latency monitoring
 * Tracks timestamps and reports threshold violations
 * 
 * @task T016
 * @epic T001
 * @why Performance observability and alerting per REQ-016/REQ-017
 * @what Tracks dictation lifecycle and alerts on threshold violations
 */
export class MetricsTracker {
    private _logger: Logger;
    private _thresholds: ThresholdConfig;
    private _activeSessions: Map<string, DictationTimestamps>;
    private _alertCallback?: ThresholdAlertCallback;
    private _alertEnabled: boolean;

    /**
     * Create a new MetricsTracker
     * 
     * @task T016
     * @epic T001
     * @why Initialize metrics tracking
     * @what Creates tracker with configurable thresholds
     * @param {Logger} logger - Logger instance
     * @param {Partial<ThresholdConfig>} [thresholds] - Custom thresholds
     * @param {ThresholdAlertCallback} [alertCallback] - Custom alert handler
     */
    constructor(
        logger: Logger,
        thresholds?: Partial<ThresholdConfig>,
        alertCallback?: ThresholdAlertCallback
    ) {
        this._logger = logger.child('metrics');
        this._thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
        this._activeSessions = new Map();
        this._alertCallback = alertCallback;
        this._alertEnabled = true;
    }

    /**
     * Get current thresholds
     * 
     * @task T016
     * @epic T001
     * @why Access current threshold configuration
     * @what Returns copy of threshold config
     * @returns {ThresholdConfig} Current thresholds
     */
    get thresholds(): ThresholdConfig {
        return { ...this._thresholds };
    }

    /**
     * Update thresholds
     * 
     * @task T016
     * @epic T001
     * @why Runtime threshold adjustment
     * @what Updates threshold values
     * @param {Partial<ThresholdConfig>} thresholds - New threshold values
     */
    updateThresholds(thresholds: Partial<ThresholdConfig>): void {
        this._thresholds = { ...this._thresholds, ...thresholds };
        this._logger.debug('Thresholds updated', { thresholds: this._thresholds });
    }

    /**
     * Enable or disable threshold alerts
     * 
     * @task T016
     * @epic T001
     * @why Toggle alerting without changing thresholds
     * @what Sets alert enabled state
     * @param {boolean} enabled - Whether to enable alerts
     */
    setAlertEnabled(enabled: boolean): void {
        this._alertEnabled = enabled;
    }

    /**
     * Start a new dictation session
     * Records captureStart timestamp
     * 
     * @task T016
     * @epic T001
     * @why Begin latency tracking per REQ-016
     * @what Creates new session with initial timestamp
     * @param {string} sessionId - Unique session identifier
     * @returns {number} Capture start timestamp (microseconds)
     */
    startSession(sessionId: string): number {
        const now = this._now();
        this._activeSessions.set(sessionId, {
            captureStart: now,
        });
        this._logger.debug('Session started', { sessionId, timestamp: now });
        return now;
    }

    /**
     * Record STT completion timestamp
     * 
     * @task T016
     * @epic T001
     * @why Track STT latency per REQ-016
     * @what Records sttComplete timestamp
     * @param {string} sessionId - Session identifier
     * @returns {number | null} Timestamp or null if session not found
     */
    recordSttComplete(sessionId: string): number | null {
        const session = this._activeSessions.get(sessionId);
        if (!session) {
            this._logger.warn('Cannot record STT complete: session not found', { sessionId });
            return null;
        }

        const now = this._now();
        session.sttComplete = now;

        // Check STT latency threshold
        const sttMs = (now - session.captureStart) / 1000;
        if (sttMs > this._thresholds.sttLatencyMs) {
            this._triggerAlert('sttLatency', sttMs, this._thresholds.sttLatencyMs, { sessionId });
        }

        this._logger.debug('STT complete recorded', { sessionId, sttMs });
        return now;
    }

    /**
     * Record post-processing completion timestamp
     * 
     * @task T016
     * @epic T001
     * @why Track post-processing latency per REQ-016/REQ-017
     * @what Records postProcessComplete timestamp
     * @param {string} sessionId - Session identifier
     * @param {boolean} [isBaseten=true] - Whether this is Baseten post-processing
     * @returns {number | null} Timestamp or null if session not found
     */
    recordPostProcessComplete(sessionId: string, isBaseten: boolean = true): number | null {
        const session = this._activeSessions.get(sessionId);
        if (!session) {
            this._logger.warn('Cannot record post-process complete: session not found', { sessionId });
            return null;
        }

        const now = this._now();
        session.postProcessComplete = now;

        // Check post-processing threshold (especially for Baseten per REQ-017)
        if (session.sttComplete) {
            const postProcessMs = (now - session.sttComplete) / 1000;
            
            if (isBaseten && postProcessMs > this._thresholds.basetenPostProcessMs) {
                this._triggerAlert(
                    'basetenPostProcess',
                    postProcessMs,
                    this._thresholds.basetenPostProcessMs,
                    { sessionId, provider: 'baseten' }
                );
            }

            this._logger.debug('Post-processing complete recorded', { 
                sessionId, 
                postProcessMs,
                isBaseten 
            });
        }

        return now;
    }

    /**
     * Record injection completion timestamp and finalize session
     * 
     * @task T016
     * @epic T001
     * @why Complete latency tracking per REQ-016
     * @what Records injectionComplete and calculates final metrics
     * @param {string} sessionId - Session identifier
     * @returns {LatencyMetrics | null} Final metrics or null if session not found
     */
    completeSession(sessionId: string): LatencyMetrics | null {
        const session = this._activeSessions.get(sessionId);
        if (!session) {
            this._logger.warn('Cannot complete session: session not found', { sessionId });
            return null;
        }

        const now = this._now();
        session.injectionComplete = now;

        const metrics = this._calculateMetrics(session);

        // Check total latency threshold
        if (metrics.totalMs > this._thresholds.totalLatencyMs) {
            this._triggerAlert('totalLatency', metrics.totalMs, this._thresholds.totalLatencyMs, { 
                sessionId,
                metrics 
            });
        }

        this._logger.info('Session completed', { 
            sessionId, 
            metrics,
            thresholds: this._thresholds 
        });

        // Clean up session
        this._activeSessions.delete(sessionId);

        return metrics;
    }

    /**
     * Cancel an active session without completing
     * 
     * @task T016
     * @epic T001
     * @why Clean up aborted dictations
     * @what Removes session from tracking
     * @param {string} sessionId - Session identifier
     * @param {string} [reason] - Cancellation reason
     */
    cancelSession(sessionId: string, reason?: string): void {
        if (this._activeSessions.has(sessionId)) {
            this._logger.debug('Session cancelled', { sessionId, reason });
            this._activeSessions.delete(sessionId);
        }
    }

    /**
     * Get active session count
     * 
     * @task T016
     * @epic T001
     * @why Monitor concurrent sessions
     * @what Returns number of active sessions
     * @returns {number} Active session count
     */
    getActiveSessionCount(): number {
        return this._activeSessions.size;
    }

    /**
     * Check if a session is active
     * 
     * @task T016
     * @epic T001
     * @why Verify session existence
     * @what Returns true if session is being tracked
     * @param {string} sessionId - Session identifier
     * @returns {boolean} True if session is active
     */
    isSessionActive(sessionId: string): boolean {
        return this._activeSessions.has(sessionId);
    }

    /**
     * Get current high-resolution timestamp
     * Uses GLib.get_monotonic_time() for microsecond precision
     * 
     * @task T016
     * @epic T001
     * @why Precise timing for latency measurement
     * @what Returns monotonic time in microseconds
     * @returns {number} Monotonic timestamp in microseconds
     */
    private _now(): number {
        return GLib.get_monotonic_time();
    }

    /**
     * Calculate latency metrics from timestamps
     * 
     * @task T016
     * @epic T001
     * @why Convert timestamps to millisecond latencies
     * @what Computes all latency values from session timestamps
     * @param {DictationTimestamps} session - Session timestamps
     * @returns {LatencyMetrics} Calculated latencies in milliseconds
     */
    private _calculateMetrics(session: DictationTimestamps): LatencyMetrics {
        const captureStart = session.captureStart;
        const sttComplete = session.sttComplete ?? captureStart;
        const postProcessComplete = session.postProcessComplete ?? sttComplete;
        const injectionComplete = session.injectionComplete ?? postProcessComplete;

        // Convert microseconds to milliseconds
        const totalMs = (injectionComplete - captureStart) / 1000;
        const sttMs = (sttComplete - captureStart) / 1000;
        const postProcessMs = (postProcessComplete - sttComplete) / 1000;
        const injectionMs = (injectionComplete - postProcessComplete) / 1000;
        const processingMs = (sttComplete - captureStart) / 1000;

        return {
            totalMs: Math.max(0, totalMs),
            sttMs: Math.max(0, sttMs),
            postProcessMs: Math.max(0, postProcessMs),
            injectionMs: Math.max(0, injectionMs),
            processingMs: Math.max(0, processingMs),
        };
    }

    /**
     * Trigger a threshold alert
     * 
     * @task T016
     * @epic T001
     * @why Alert on threshold violations per REQ-017
     * @what Logs alert and calls custom handler if set
     * @param {string} thresholdName - Name of threshold violated
     * @param {number} actualMs - Actual latency in ms
     * @param {number} thresholdMs - Threshold value in ms
     * @param {Record<string, unknown>} context - Additional context
     */
    private _triggerAlert(
        thresholdName: string,
        actualMs: number,
        thresholdMs: number,
        context: Record<string, unknown>
    ): void {
        if (!this._alertEnabled) {
            return;
        }

        this._logger.warn(`Threshold exceeded: ${thresholdName}`, {
            threshold: thresholdName,
            actualMs,
            thresholdMs,
            exceededBy: actualMs - thresholdMs,
            ...context,
        });

        if (this._alertCallback) {
            try {
                this._alertCallback(thresholdName, actualMs, thresholdMs, context);
            } catch (e) {
                this._logger.error('Alert callback failed', { 
                    error: (e as Error).message,
                    thresholdName 
                });
            }
        }
    }
}

/**
 * Create a metrics tracker from config
 * 
 * @task T016
 * @epic T001
 * @why Factory function for easy initialization
 * @what Creates MetricsTracker with config-derived settings
 * @param {Logger} logger - Logger instance
 * @param {Partial<ThresholdConfig>} [thresholds] - Optional custom thresholds
 * @returns {MetricsTracker} Configured metrics tracker
 */
export function createMetricsTracker(
    logger: Logger,
    thresholds?: Partial<ThresholdConfig>
): MetricsTracker {
    return new MetricsTracker(logger, thresholds);
}
