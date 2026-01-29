/**
 * @task T008
 * @epic T001
 * @why RMS-based silence detection for automatic recording stop
 * @what Analyzes audio levels and detects silence periods
 */

declare const imports: {
  gi: {
    GLib: typeof import('@girs/glib-2.0').GLib;
  };
};

const { GLib } = imports.gi;

/**
 * @task T008
 * @epic T001
 * @why Silence detection configuration options
 * @what Defines parameters for silence detection
 */
export interface SilenceDetectorConfig {
  /** RMS threshold in dB (default: -40dB) */
  thresholdDb: number;
  /** Silence timeout in seconds (0 = disabled) */
  timeoutSeconds: number;
  /** Sample rate for duration calculations */
  sampleRate: number;
  /** Number of consecutive silent frames before triggering */
  minSilentFrames: number;
}

/**
 * @task T008
 * @epic T001
 * @why Default silence detection settings
 * @what Sensible defaults for voice dictation
 */
export const DEFAULT_SILENCE_CONFIG: SilenceDetectorConfig = {
  thresholdDb: -40,
  timeoutSeconds: 30,
  sampleRate: 16000,
  minSilentFrames: 10, // ~300ms at typical frame sizes
};

/**
 * @task T008
 * @epic T001
 * @why Silence detection state
 * @what Tracks current detection status
 */
export type SilenceState = 'silent' | 'speaking' | 'unknown';

/**
 * @task T008
 * @epic T001
 * @why Callback types for silence events
 * @what Function signatures for event handlers
 */
export type SilenceStartCallback = () => void;
export type SilenceEndCallback = () => void;
export type SilenceTimeoutCallback = () => void;
export type LevelCallback = (rmsDb: number, isSilent: boolean) => void;

/**
 * @task T008
 * @epic T001
 * @why RMS-based silence detector
 * @what Analyzes audio frames and detects silence periods
 */
export class SilenceDetector {
  private _config: SilenceDetectorConfig;
  private _state: SilenceState = 'unknown';
  private _consecutiveSilentFrames: number = 0;
  private _silenceStartTime: number = 0;
  private _timeoutId: number | null = null;
  private _isEnabled: boolean = true;

  // Callbacks
  private _onSilenceStart: SilenceStartCallback | null = null;
  private _onSilenceEnd: SilenceEndCallback | null = null;
  private _onSilenceTimeout: SilenceTimeoutCallback | null = null;
  private _onLevel: LevelCallback | null = null;

  /**
   * @task T008
   * @epic T001
   * @why Create silence detector
   * @what Initializes with configuration
   * @param {Partial<SilenceDetectorConfig>} [config] - Optional config overrides
   */
  constructor(config?: Partial<SilenceDetectorConfig>) {
    this._config = {
      ...DEFAULT_SILENCE_CONFIG,
      ...config,
    };
  }

  /**
   * @task T008
   * @epic T001
   * @why Update configuration
   * @what Changes detection parameters at runtime
   * @param {Partial<SilenceDetectorConfig>} config - Config changes
   */
  configure(config: Partial<SilenceDetectorConfig>): void {
    this._config = {
      ...this._config,
      ...config,
    };

    // Reset timeout if timeout changed
    if (config.timeoutSeconds !== undefined) {
      this._clearTimeout();
    }
  }

  /**
   * @task T008
   * @epic T001
   * @why Enable/disable detection
   * @what Controls whether detection is active
   * @param {boolean} enabled - Whether to enable
   */
  setEnabled(enabled: boolean): void {
    this._isEnabled = enabled;
    if (!enabled) {
      this._clearTimeout();
    }
  }

  /**
   * @task T008
   * @epic T001
   * @why Check if detection is enabled
   * @what Returns enabled state
   * @returns {boolean} True if enabled
   */
  isEnabled(): boolean {
    return this._isEnabled;
  }

  /**
   * @task T008
   * @epic T001
   * @why Set silence start callback
   * @what Called when silence period begins
   * @param {SilenceStartCallback} callback - Handler function
   */
  onSilenceStart(callback: SilenceStartCallback): void {
    this._onSilenceStart = callback;
  }

  /**
   * @task T008
   * @epic T001
   * @why Set silence end callback
   * @what Called when speech resumes after silence
   * @param {SilenceEndCallback} callback - Handler function
   */
  onSilenceEnd(callback: SilenceEndCallback): void {
    this._onSilenceEnd = callback;
  }

  /**
   * @task T008
   * @epic T001
   * @why Set silence timeout callback
   * @what Called when silence exceeds timeout
   * @param {SilenceTimeoutCallback} callback - Handler function
   */
  onSilenceTimeout(callback: SilenceTimeoutCallback): void {
    this._onSilenceTimeout = callback;
  }

  /**
   * @task T008
   * @epic T001
   * @why Set level monitoring callback
   * @what Called with every processed frame
   * @param {LevelCallback} callback - Handler function
   */
  onLevel(callback: LevelCallback): void {
    this._onLevel = callback;
  }

  /**
   * @task T008
   * @epic T001
   * @why Process audio frame for silence detection
   * @what Calculates RMS and updates silence state
   * @param {Uint8Array} frame - 16-bit PCM audio frame
   */
  processFrame(frame: Uint8Array): void {
    if (!this._isEnabled) {
      return;
    }

    const rmsDb = this._calculateRMS(frame);
    const isSilent = rmsDb < this._config.thresholdDb;

    // Notify level callback
    if (this._onLevel) {
      this._onLevel(rmsDb, isSilent);
    }

    if (isSilent) {
      this._handleSilentFrame();
    } else {
      this._handleSpeakingFrame();
    }
  }

  /**
   * @task T008
   * @epic T001
   * @why Calculate RMS level in dB
   * @what Computes root mean square of audio frame
   * @param {Uint8Array} frame - 16-bit PCM data
   * @returns {number} RMS level in dB
   */
  private _calculateRMS(frame: Uint8Array): number {
    if (frame.length < 2) {
      return -Infinity;
    }

    // Convert bytes to 16-bit samples
    const samples = new Int16Array(frame.buffer, frame.byteOffset, frame.length / 2);
    
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      sumSquares += sample * sample;
    }

    const meanSquare = sumSquares / samples.length;
    const rms = Math.sqrt(meanSquare);

    // Convert to dB (full scale = 32768 for 16-bit)
    if (rms === 0) {
      return -Infinity;
    }

    const db = 20 * Math.log10(rms / 32768);
    return db;
  }

  /**
   * @task T008
   * @epic T001
   * @why Handle a silent frame
   * @what Updates state and manages timeout
   */
  private _handleSilentFrame(): void {
    this._consecutiveSilentFrames++;

    // Check if we've reached minimum silent frames threshold
    if (this._consecutiveSilentFrames >= this._config.minSilentFrames) {
      // Transition to silent state
      if (this._state !== 'silent') {
        this._state = 'silent';
        this._silenceStartTime = GLib.get_monotonic_time();

        if (this._onSilenceStart) {
          this._onSilenceStart();
        }

        // Start timeout if configured
        if (this._config.timeoutSeconds > 0) {
          this._startTimeout();
        }
      }
    }
  }

  /**
   * @task T008
   * @epic T001
   * @why Handle a speaking frame
   * @what Updates state and cancels timeout
   */
  private _handleSpeakingFrame(): void {
    this._consecutiveSilentFrames = 0;

    if (this._state === 'silent') {
      this._state = 'speaking';
      this._clearTimeout();

      if (this._onSilenceEnd) {
        this._onSilenceEnd();
      }
    } else if (this._state === 'unknown') {
      this._state = 'speaking';
    }
  }

  /**
   * @task T008
   * @epic T001
   * @why Start silence timeout timer
   * @what Schedules timeout callback
   */
  private _startTimeout(): void {
    this._clearTimeout();

    if (this._config.timeoutSeconds <= 0) {
      return;
    }

    this._timeoutId = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      this._config.timeoutSeconds * 1000,
      () => {
        if (this._onSilenceTimeout && this._state === 'silent') {
          this._onSilenceTimeout();
        }
        this._timeoutId = null;
        return GLib.SOURCE_REMOVE;
      }
    );
  }

  /**
   * @task T008
   * @epic T001
   * @why Clear timeout timer
   * @what Removes pending timeout
   */
  private _clearTimeout(): void {
    if (this._timeoutId !== null) {
      GLib.source_remove(this._timeoutId);
      this._timeoutId = null;
    }
  }

  /**
   * @task T008
   * @epic T001
   * @why Get current silence state
   * @what Returns current detection state
   * @returns {SilenceState} Current state
   */
  getState(): SilenceState {
    return this._state;
  }

  /**
   * @task T008
   * @epic T001
   * @why Check if currently silent
   * @what Convenience method for silence check
   * @returns {boolean} True if silent
   */
  isSilent(): boolean {
    return this._state === 'silent';
  }

  /**
   * @task T008
   * @epic T001
   * @why Get current configuration
   * @what Returns copy of config
   * @returns {SilenceDetectorConfig} Current config
   */
  getConfig(): SilenceDetectorConfig {
    return { ...this._config };
  }

  /**
   * @task T008
   * @epic T001
   * @why Get silence duration
   * @what Returns how long we've been silent
   * @returns {number} Silence duration in seconds
   */
  getSilenceDuration(): number {
    if (this._state !== 'silent' || this._silenceStartTime === 0) {
      return 0;
    }

    const now = GLib.get_monotonic_time();
    return (now - this._silenceStartTime) / 1000000;
  }

  /**
   * @task T008
   * @epic T001
   * @why Reset detector state
   * @what Clears state and timeouts
   */
  reset(): void {
    this._state = 'unknown';
    this._consecutiveSilentFrames = 0;
    this._silenceStartTime = 0;
    this._clearTimeout();
  }

  /**
   * @task T008
   * @epic T001
   * @why Clean up resources
   * @what Removes timers and callbacks
   */
  dispose(): void {
    this._clearTimeout();
    this._onSilenceStart = null;
    this._onSilenceEnd = null;
    this._onSilenceTimeout = null;
    this._onLevel = null;
  }
}

/**
 * @task T008
 * @epic T001
 * @why Convert dB threshold to linear amplitude
 * @what Helper for threshold conversions
 * @param {number} db - Decibel value
 * @returns {number} Linear amplitude (0-1)
 */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * @task T008
 * @epic T001
 * @why Convert linear amplitude to dB
 * @what Helper for amplitude conversions
 * @param {number} linear - Linear amplitude (0-1)
 * @returns {number} Decibel value
 */
export function linearToDb(linear: number): number {
  if (linear <= 0) {
    return -Infinity;
  }
  return 20 * Math.log10(linear);
}

/**
 * @task T008
 * @epic T001
 * @why Create detector from silence timeout config
 * @what Factory for common timeout values
 * @param {number} timeoutSeconds - Timeout (0, 30, or 60)
 * @param {number} [thresholdDb=-40] - Optional threshold override
 * @returns {SilenceDetector} Configured detector
 */
export function createSilenceDetector(
  timeoutSeconds: number = 30,
  thresholdDb: number = -40
): SilenceDetector {
  return new SilenceDetector({
    timeoutSeconds,
    thresholdDb,
  });
}
