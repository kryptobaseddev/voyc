/**
 * @task T008
 * @epic T001
 * @why Audio module exports
 * @what Central export point for all audio functionality
 */

// Re-export from AudioBuffer
export {
  AudioBuffer,
  AUDIO_FORMAT,
  createSTTBuffer,
} from './AudioBuffer.js';

// Re-export from SilenceDetector
export {
  SilenceDetector,
  DEFAULT_SILENCE_CONFIG,
  createSilenceDetector,
  dbToLinear,
  linearToDb,
} from './SilenceDetector.js';

// Re-export from PipeWireCapture
export {
  PipeWireCapture,
  createCapture,
  DEFAULT_CAPTURE_CONFIG,
} from './PipeWireCapture.js';

// Re-export types
export type {
  CaptureState,
  CaptureConfig,
  CaptureStartedCallback,
  CaptureStoppedCallback,
  CaptureErrorCallback,
  DataAvailableCallback,
  SilenceDetectedCallback,
  LevelCallback,
} from './PipeWireCapture.js';

export type {
  SilenceDetectorConfig,
  SilenceState,
  SilenceStartCallback,
  SilenceEndCallback,
  SilenceTimeoutCallback,
} from './SilenceDetector.js';

/**
 * @task T008
 * @epic T001
 * @why Audio format constants
 * @what Standard format for STT compatibility
 */
export const STT_AUDIO_FORMAT = {
  /** Sample rate: 16kHz is optimal for most STT services */
  sampleRate: 16000,
  /** Mono channel for voice */
  channels: 1,
  /** 16-bit PCM */
  bitsPerSample: 16,
  /** WAV container format */
  container: 'wav' as const,
};

/**
 * @task T008
 * @epic T001
 * @why Silence timeout options
 * @what Valid timeout values per PRD
 */
export const SILENCE_TIMEOUT_OPTIONS = [
  { value: 0, label: 'Disabled' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '60 seconds' },
] as const;

/**
 * @task T008
 * @epic T001
 * @why Default silence threshold options
 * @what Common threshold values in dB
 */
export const SILENCE_THRESHOLD_OPTIONS = [
  { value: -50, label: 'Quiet (-50 dB)' },
  { value: -40, label: 'Normal (-40 dB)' },
  { value: -30, label: 'Loud (-30 dB)' },
] as const;

/**
 * @task T008
 * @epic T001
 * @why Audio error types
 * @what Specific error classes for audio failures
 */
export class AudioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioError';
  }
}

/**
 * @task T008
 * @epic T001
 * @why Capture initialization error
 * @what Thrown when audio capture fails to start
 */
export class CaptureInitError extends AudioError {
  constructor(details?: string) {
    super(`Failed to initialize audio capture${details ? ': ' + details : ''}`);
    this.name = 'CaptureInitError';
  }
}

/**
 * @task T008
 * @epic T001
 * @why Device unavailable error
 * @what Thrown when microphone is not available
 */
export class DeviceUnavailableError extends AudioError {
  constructor(device?: string) {
    super(`Microphone unavailable${device ? `: ${device}` : ''}`);
    this.name = 'DeviceUnavailableError';
  }
}

/**
 * @task T008
 * @epic T001
 * @why Pipeline error
 * @what Thrown when GStreamer pipeline fails
 */
export class PipelineError extends AudioError {
  constructor(message: string) {
    super(`Pipeline error: ${message}`);
    this.name = 'PipelineError';
  }
}

declare const imports: {
  gi: {
    versions: { [key: string]: string };
    Gst: typeof import('@girs/gst-1.0').Gst;
  };
};

/**
 * @task T008
 * @epic T001
 * @why Check audio system availability
 * @what Probes for PipeWire/GStreamer availability
 * @returns {boolean} True if audio system is available
 */
export function isAudioAvailable(): boolean {
  try {
    // Check if GStreamer is available
    imports.gi.versions.Gst = '1.0';
    const { Gst } = imports.gi;
    
    if (!Gst.is_initialized()) {
      Gst.init(null);
    }

    // Try to create a simple pipeline to verify functionality
    const testPipeline = Gst.parse_launch('pipewiresrc ! fakesink');
    if (testPipeline) {
      testPipeline.set_state(Gst.State.NULL);
      return true;
    }

    return false;
  } catch (e) {
    return false;
  }
}
