/**
 * @task T008
 * @epic T001
 * @why PipeWire audio capture using GStreamer
 * @what Captures microphone audio with silence detection for STT
 */

declare const imports: {
  gi: {
    versions: { [key: string]: string };
    Gst: typeof import('@girs/gst-1.0').Gst;
    GLib: typeof import('@girs/glib-2.0').GLib;
    GObject: typeof import('@girs/gobject-2.0').GObject;
  };
  audio: {
    AudioBuffer: any;
    SilenceDetector: any;
  };
};

// GStreamer version for GJS
imports.gi.versions.Gst = '1.0';

const { Gst, GLib, GObject } = imports.gi;

/**
 * @task T008
 * @epic T001
 * @why Capture state enumeration
 * @what Tracks current recording state
 */
export type CaptureState = 'idle' | 'starting' | 'recording' | 'stopping' | 'error';

/**
 * @task T008
 * @epic T001
 * @why Capture configuration options
 * @what Defines parameters for audio capture
 */
export interface CaptureConfig {
  /** Audio device (null = default) */
  device: string | null;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Number of channels */
  channels: number;
  /** Silence timeout in seconds (0 = disabled) */
  silenceTimeout: number;
  /** RMS threshold in dB */
  silenceThresholdDb: number;
}

/**
 * @task T008
 * @epic T001
 * @why Default capture configuration
 * @what STT-optimized defaults
 */
export const DEFAULT_CAPTURE_CONFIG: CaptureConfig = {
  device: null,
  sampleRate: 16000,
  channels: 1,
  silenceTimeout: 30,
  silenceThresholdDb: -40,
};

/**
 * @task T008
 * @epic T001
 * @why Event callback types
 * @what Function signatures for capture events
 */
export type CaptureStartedCallback = () => void;
export type CaptureStoppedCallback = (reason: 'manual' | 'silence' | 'error') => void;
export type CaptureErrorCallback = (error: Error) => void;
export type DataAvailableCallback = (data: Uint8Array) => void;
export type SilenceDetectedCallback = (duration: number) => void;
export type LevelCallback = (rmsDb: number, isSilent: boolean) => void;

/**
 * @task T008
 * @epic T001
 * @why PipeWire audio capture manager
 * @what GStreamer-based capture with silence detection
 */
export class PipeWireCapture extends GObject.Object {
  private _config: CaptureConfig;
  private _state: CaptureState = 'idle';
  private _pipeline: any | null = null;
  private _audioBuffer: any | null = null;
  private _silenceDetector: any | null = null;
  private _appsink: any | null = null;
  private _busWatchId: number | null = null;

  // Callbacks
  private _onStarted: CaptureStartedCallback | null = null;
  private _onStopped: CaptureStoppedCallback | null = null;
  private _onError: CaptureErrorCallback | null = null;
  private _onDataAvailable: DataAvailableCallback | null = null;
  private _onSilenceDetected: SilenceDetectedCallback | null = null;
  private _onLevel: LevelCallback | null = null;

  // Static GObject registration
  static {
    GObject.registerClass({
      GTypeName: 'PipeWireCapture',
      Signals: {
        'started': {
          param_types: [],
          return_type: GObject.TYPE_NONE,
        },
        'stopped': {
          param_types: [GObject.TYPE_STRING],
          return_type: GObject.TYPE_NONE,
        },
        'error': {
          param_types: [GObject.TYPE_STRING],
          return_type: GObject.TYPE_NONE,
        },
        'silence-detected': {
          param_types: [GObject.TYPE_DOUBLE],
          return_type: GObject.TYPE_NONE,
        },
        'data-available': {
          param_types: [GObject.TYPE_POINTER],
          return_type: GObject.TYPE_NONE,
        },
        'level': {
          param_types: [GObject.TYPE_DOUBLE, GObject.TYPE_BOOLEAN],
          return_type: GObject.TYPE_NONE,
        },
      },
    }, PipeWireCapture as any);
  }

  /**
   * @task T008
   * @epic T001
   * @why Create capture instance
   * @what Initializes GStreamer and configures capture
   * @param {Partial<CaptureConfig>} [config] - Optional config overrides
   */
  constructor(config?: Partial<CaptureConfig>) {
    super();

    this._config = {
      ...DEFAULT_CAPTURE_CONFIG,
      ...config,
    };

    // Initialize GStreamer
    if (!Gst.is_initialized()) {
      Gst.init(null);
    }

    // Create audio buffer - loaded from GJS imports at runtime
    const AudioBufferClass = imports.audio.AudioBuffer.AudioBuffer;
    this._audioBuffer = new AudioBufferClass(
      this._config.sampleRate,
      this._config.channels,
      16
    );

    // Create silence detector - loaded from GJS imports at runtime
    const SilenceDetectorClass = imports.audio.SilenceDetector.SilenceDetector;
    this._silenceDetector = new SilenceDetectorClass({
      thresholdDb: this._config.silenceThresholdDb,
      timeoutSeconds: this._config.silenceTimeout,
      sampleRate: this._config.sampleRate,
    });

    // Connect silence detector callbacks
    this._silenceDetector.onSilenceTimeout(() => {
      this._handleSilenceTimeout();
    });

    this._silenceDetector.onLevel((rmsDb: number, isSilent: boolean) => {
      this.emit('level', rmsDb, isSilent);
      if (this._onLevel) {
        this._onLevel(rmsDb, isSilent);
      }
    });
  }

  /**
   * @task T008
   * @epic T001
   * @why Set capture started callback
   * @param {CaptureStartedCallback} callback - Handler function
   */
  onStarted(callback: CaptureStartedCallback): void {
    this._onStarted = callback;
  }

  /**
   * @task T008
   * @epic T001
   * @why Set capture stopped callback
   * @param {CaptureStoppedCallback} callback - Handler function
   */
  onStopped(callback: CaptureStoppedCallback): void {
    this._onStopped = callback;
  }

  /**
   * @task T008
   * @epic T001
   * @why Set capture error callback
   * @param {CaptureErrorCallback} callback - Handler function
   */
  onError(callback: CaptureErrorCallback): void {
    this._onError = callback;
  }

  /**
   * @task T008
   * @epic T001
   * @why Set data available callback
   * @param {DataAvailableCallback} callback - Handler function
   */
  onDataAvailable(callback: DataAvailableCallback): void {
    this._onDataAvailable = callback;
  }

  /**
   * @task T008
   * @epic T001
   * @why Set silence detected callback
   * @param {SilenceDetectedCallback} callback - Handler function
   */
  onSilenceDetected(callback: SilenceDetectedCallback): void {
    this._onSilenceDetected = callback;
  }

  /**
   * @task T008
   * @epic T001
   * @why Set audio level callback
   * @param {LevelCallback} callback - Handler function
   */
  onLevel(callback: LevelCallback): void {
    this._onLevel = callback;
  }

  /**
   * @task T008
   * @epic T001
   * @why Start audio capture
   * @what Creates pipeline and begins recording
   * @returns {boolean} True if started successfully
   */
  start(): boolean {
    if (this._state !== 'idle') {
      console.warn('Cannot start capture: already recording or starting');
      return false;
    }

    this._state = 'starting';

    try {
      // Build GStreamer pipeline
      // pipewiresrc → audioconvert → audioresample → capsfilter → wavenc → appsink
      const deviceStr = this._config.device ? ` device=${this._config.device}` : '';
      const pipelineStr = 
        `pipewiresrc${deviceStr} ! ` +
        `audioconvert ! ` +
        `audioresample ! ` +
        `audio/x-raw,format=S16LE,rate=${this._config.sampleRate},channels=${this._config.channels} ! ` +
        `wavenc ! ` +
        `appsink name=sink`;

      this._pipeline = Gst.parse_launch(pipelineStr);

      if (!this._pipeline) {
        throw new Error('Failed to create GStreamer pipeline');
      }

      // Get appsink element
      this._appsink = this._pipeline.get_by_name('sink');

      if (!this._appsink) {
        throw new Error('Failed to get appsink element');
      }

      // Configure appsink
      this._appsink.set_property('emit-signals', true);
      this._appsink.set_property('drop', false);
      this._appsink.set_property('max-buffers', 0);

      // Connect to new-sample signal
      this._appsink.connect('new-sample', () => {
        this._handleNewSample();
        return Gst.FlowReturn.OK;
      });

      // Set up bus message handling
      const bus = this._pipeline.get_bus();
      if (bus) {
        this._busWatchId = bus.add_watch(GLib.PRIORITY_DEFAULT, (bus: any, message: any) => {
          return this._handleBusMessage(message);
        });
      }

      // Start pipeline
      const ret = this._pipeline.set_state(Gst.State.PLAYING);
      if (ret === Gst.StateChangeReturn.FAILURE) {
        throw new Error('Failed to start pipeline');
      }

      this._state = 'recording';
      this._silenceDetector.reset();

      this.emit('started');
      if (this._onStarted) {
        this._onStarted();
      }

      return true;

    } catch (error) {
      this._state = 'error';
      const err = error instanceof Error ? error : new Error(String(error));
      
      this.emit('error', err.message);
      if (this._onError) {
        this._onError(err);
      }

      this._cleanup();
      return false;
    }
  }

  /**
   * @task T008
   * @epic T001
   * @why Stop audio capture
   * @what Stops pipeline and returns captured data
   * @returns {boolean} True if stopped successfully
   */
  stop(): boolean {
    if (this._state !== 'recording') {
      console.warn('Cannot stop capture: not recording');
      return false;
    }

    this._state = 'stopping';

    try {
      this._cleanup();

      this._state = 'idle';

      this.emit('stopped', 'manual');
      if (this._onStopped) {
        this._onStopped('manual');
      }

      return true;

    } catch (error) {
      this._state = 'error';
      const err = error instanceof Error ? error : new Error(String(error));
      
      this.emit('error', err.message);
      if (this._onError) {
        this._onError(err);
      }

      return false;
    }
  }

  /**
   * @task T008
   * @epic T001
   * @why Handle new sample from appsink
   * @what Processes audio buffer from GStreamer
   */
  private _handleNewSample(): void {
    if (!this._appsink || this._state !== 'recording') {
      return;
    }

    try {
      const sample = this._appsink.pull_sample();
      if (!sample) {
        return;
      }

      const buffer = sample.get_buffer();
      if (!buffer) {
        return;
      }

      // Map buffer to access data
      const mapInfo = buffer.map(Gst.MapFlags.READ);
      if (!mapInfo || !mapInfo.data) {
        return;
      }

      // Copy data from map
      const data = new Uint8Array(mapInfo.data);
      
      // Unmap buffer
      buffer.unmap(mapInfo);

      // Store in audio buffer
      this._audioBuffer.append(data);

      // Process for silence detection (skip WAV header if present)
      // For streaming detection, we need raw PCM, but wavenc adds headers
      // We'll process the data as-is and the detector will handle it
      this._silenceDetector.processFrame(data);

      // Emit data available
      this.emit('data-available', data);
      if (this._onDataAvailable) {
        this._onDataAvailable(data);
      }

    } catch (error) {
      console.error('Error handling new sample:', error);
    }
  }

  /**
   * @task T008
   * @epic T001
   * @why Handle GStreamer bus messages
   * @what Processes error and state change messages
   * @param {any} message - Gst.Message
   * @returns {boolean} Whether to continue watching
   */
  private _handleBusMessage(message: any): boolean {
    const msgType = message.type;

    switch (msgType) {
      case Gst.MessageType.ERROR: {
        const [error, debug] = message.parse_error();
        const errMsg = error ? error.message : 'Unknown GStreamer error';
        console.error('GStreamer error:', errMsg, debug);
        
        this._state = 'error';
        this.emit('error', errMsg);
        if (this._onError) {
          this._onError(new Error(errMsg));
        }
        break;
      }

      case Gst.MessageType.EOS:
        // End of stream - stop capture
        this.stop();
        break;

      case Gst.MessageType.STATE_CHANGED:
        // Handle state changes if needed
        break;
    }

    return true;
  }

  /**
   * @task T008
   * @epic T001
   * @why Handle silence timeout
   * @what Stops capture when silence exceeds timeout
   */
  private _handleSilenceTimeout(): void {
    if (this._state !== 'recording') {
      return;
    }

    const silenceDuration = this._silenceDetector.getSilenceDuration();

    this.emit('silence-detected', silenceDuration);
    if (this._onSilenceDetected) {
      this._onSilenceDetected(silenceDuration);
    }

    // Stop capture due to silence
    this._state = 'stopping';
    this._cleanup();
    this._state = 'idle';

    this.emit('stopped', 'silence');
    if (this._onStopped) {
      this._onStopped('silence');
    }
  }

  /**
   * @task T008
   * @epic T001
   * @why Clean up GStreamer resources
   * @what Stops pipeline and releases resources
   */
  private _cleanup(): void {
    // Remove bus watch
    if (this._busWatchId !== null) {
      GLib.source_remove(this._busWatchId);
      this._busWatchId = null;
    }

    // Stop pipeline
    if (this._pipeline) {
      this._pipeline.set_state(Gst.State.NULL);
      this._pipeline = null;
    }

    this._appsink = null;
  }

  /**
   * @task T008
   * @epic T001
   * @why Get current capture state
   * @returns {CaptureState} Current state
   */
  getState(): CaptureState {
    return this._state;
  }

  /**
   * @task T008
   * @epic T001
   * @why Check if currently recording
   * @returns {boolean} True if recording
   */
  isRecording(): boolean {
    return this._state === 'recording';
  }

  /**
   * @task T008
   * @epic T001
   * @why Get captured audio data
   * @what Returns complete WAV data
   * @returns {Uint8Array} WAV file data
   */
  getWavData(): Uint8Array {
    if (!this._audioBuffer) {
      return new Uint8Array(0);
    }
    return this._audioBuffer.toWav();
  }

  /**
   * @task T008
   * @epic T001
   * @why Get audio buffer for advanced use
   * @returns {any} AudioBuffer instance
   */
  getAudioBuffer(): any {
    return this._audioBuffer;
  }

  /**
   * @task T008
   * @epic T001
   * @why Get recording duration
   * @returns {number} Duration in seconds
   */
  getDuration(): number {
    if (!this._audioBuffer) {
      return 0;
    }
    return this._audioBuffer.getDuration();
  }

  /**
   * @task T008
   * @epic T001
   * @why Update configuration at runtime
   * @param {Partial<CaptureConfig>} config - Config changes
   */
  configure(config: Partial<CaptureConfig>): void {
    this._config = {
      ...this._config,
      ...config,
    };

    // Update silence detector if relevant config changed
    if (config.silenceTimeout !== undefined || config.silenceThresholdDb !== undefined) {
      this._silenceDetector.configure({
        timeoutSeconds: this._config.silenceTimeout,
        thresholdDb: this._config.silenceThresholdDb,
      });
    }
  }

  /**
   * @task T008
   * @epic T001
   * @why Reset capture state
   * @what Clears buffer and resets detector
   */
  reset(): void {
    if (this._audioBuffer) {
      this._audioBuffer.clear();
    }
    if (this._silenceDetector) {
      this._silenceDetector.reset();
    }
  }

  /**
   * @task T008
   * @epic T001
   * @why Clean up all resources
   * @what Disposes all components
   */
  dispose(): void {
    this.stop();

    if (this._silenceDetector) {
      this._silenceDetector.dispose();
    }

    this._audioBuffer = null;
    this._silenceDetector = null;

    this._onStarted = null;
    this._onStopped = null;
    this._onError = null;
    this._onDataAvailable = null;
    this._onSilenceDetected = null;
    this._onLevel = null;
  }
}

/**
 * @task T008
 * @epic T001
 * @why Create capture with config
 * @what Factory function for PipeWireCapture
 * @param {Partial<CaptureConfig>} [config] - Optional config
 * @returns {PipeWireCapture} Configured capture instance
 */
export function createCapture(config?: Partial<CaptureConfig>): PipeWireCapture {
  return new PipeWireCapture(config);
}
