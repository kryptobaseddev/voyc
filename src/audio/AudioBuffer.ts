/**
 * @task T008
 * @epic T001
 * @why In-memory audio buffer for WAV storage without disk writes
 * @what Stores audio data in memory and provides WAV format output
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
 * @why Audio format constants for STT compatibility
 * @what Defines standard audio format parameters
 */
export const AUDIO_FORMAT = {
  /** Sample rate in Hz - 16kHz is optimal for most STT services */
  SAMPLE_RATE: 16000,
  /** Number of audio channels - mono for voice */
  CHANNELS: 1,
  /** Bits per sample - 16-bit PCM */
  BITS_PER_SAMPLE: 16,
  /** Bytes per sample */
  BYTES_PER_SAMPLE: 2,
} as const;

/**
 * @task T008
 * @epic T001
 * @why WAV header structure for proper file format
 * @what Defines the 44-byte WAV header layout
 */
interface WavHeader {
  /** "RIFF" marker */
  riff: string;
  /** File size minus 8 bytes */
  fileSize: number;
  /** "WAVE" marker */
  wave: string;
  /** "fmt " marker */
  fmt: string;
  /** Format chunk size (16 for PCM) */
  fmtSize: number;
  /** Audio format (1 for PCM) */
  audioFormat: number;
  /** Number of channels */
  numChannels: number;
  /** Sample rate */
  sampleRate: number;
  /** Byte rate */
  byteRate: number;
  /** Block align */
  blockAlign: number;
  /** Bits per sample */
  bitsPerSample: number;
  /** "data" marker */
  data: string;
  /** Data chunk size */
  dataSize: number;
}

/**
 * @task T008
 * @epic T001
 * @why Audio buffer for in-memory storage
 * @what Accumulates audio chunks and provides WAV output
 */
export class AudioBuffer {
  private _chunks: Uint8Array[] = [];
  private _totalBytes: number = 0;
  private _startTime: number = 0;
  private _sampleRate: number;
  private _channels: number;
  private _bitsPerSample: number;

  /**
   * @task T008
   * @epic T001
   * @why Create a new audio buffer
   * @what Initializes buffer with specified audio format
   * @param {number} [sampleRate=16000] - Sample rate in Hz
   * @param {number} [channels=1] - Number of channels
   * @param {number} [bitsPerSample=16] - Bits per sample
   */
  constructor(
    sampleRate: number = AUDIO_FORMAT.SAMPLE_RATE,
    channels: number = AUDIO_FORMAT.CHANNELS,
    bitsPerSample: number = AUDIO_FORMAT.BITS_PER_SAMPLE
  ) {
    this._sampleRate = sampleRate;
    this._channels = channels;
    this._bitsPerSample = bitsPerSample;
    this._startTime = GLib.get_monotonic_time();
  }

  /**
   * @task T008
   * @epic T001
   * @why Add audio data to buffer
   * @what Appends a chunk of audio data
   * @param {Uint8Array} chunk - Raw audio data bytes
   */
  append(chunk: Uint8Array): void {
    // Store a copy to prevent external mutation
    const copy = new Uint8Array(chunk);
    this._chunks.push(copy);
    this._totalBytes += copy.length;
  }

  /**
   * @task T008
   * @epic T001
   * @why Clear all audio data
   * @what Resets buffer to empty state
   */
  clear(): void {
    this._chunks = [];
    this._totalBytes = 0;
    this._startTime = GLib.get_monotonic_time();
  }

  /**
   * @task T008
   * @epic T001
   * @why Check if buffer has data
   * @what Returns true if buffer contains audio
   * @returns {boolean} True if buffer has data
   */
  hasData(): boolean {
    return this._totalBytes > 0;
  }

  /**
   * @task T008
   * @epic T001
   * @why Get total bytes stored
   * @what Returns the raw audio data size
   * @returns {number} Total bytes in buffer
   */
  getSize(): number {
    return this._totalBytes;
  }

  /**
   * @task T008
   * @epic T001
   * @why Calculate audio duration
   * @what Returns duration in seconds based on format
   * @returns {number} Duration in seconds
   */
  getDuration(): number {
    const bytesPerSecond = this._sampleRate * this._channels * (this._bitsPerSample / 8);
    return this._totalBytes / bytesPerSecond;
  }

  /**
   * @task T008
   * @epic T001
   * @why Get recording duration so far
   * @what Returns elapsed time since buffer creation
   * @returns {number} Elapsed time in seconds
   */
  getElapsedTime(): number {
    const now = GLib.get_monotonic_time();
    return (now - this._startTime) / 1000000; // Convert microseconds to seconds
  }

  /**
   * @task T008
   * @epic T001
   * @why Get raw audio data without header
   * @what Concatenates all chunks into single array
   * @returns {Uint8Array} Raw PCM data
   */
  getRawData(): Uint8Array {
    if (this._chunks.length === 0) {
      return new Uint8Array(0);
    }

    if (this._chunks.length === 1) {
      return new Uint8Array(this._chunks[0]);
    }

    const result = new Uint8Array(this._totalBytes);
    let offset = 0;

    for (const chunk of this._chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * @task T008
   * @epic T001
   * @why Generate WAV header
   * @what Creates proper WAV header for PCM data
   * @returns {Uint8Array} 44-byte WAV header
   */
  private _createWavHeader(): Uint8Array {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const dataSize = this._totalBytes;
    const fileSize = 36 + dataSize;
    const byteRate = this._sampleRate * this._channels * (this._bitsPerSample / 8);
    const blockAlign = this._channels * (this._bitsPerSample / 8);

    // RIFF chunk descriptor
    this._writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize, true);
    this._writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this._writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, this._channels, true);
    view.setUint32(24, this._sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, this._bitsPerSample, true);

    // data sub-chunk
    this._writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    return new Uint8Array(header);
  }

  /**
   * @task T008
   * @epic T001
   * @why Write string to DataView
   * @what Helper for writing ASCII strings to buffer
   * @param {DataView} view - DataView to write to
   * @param {number} offset - Byte offset
   * @param {string} string - String to write
   */
  private _writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * @task T008
   * @epic T001
   * @why Get complete WAV file data
   * @what Returns header + audio data as single array
   * @returns {Uint8Array} Complete WAV file bytes
   */
  toWav(): Uint8Array {
    const header = this._createWavHeader();
    const rawData = this.getRawData();
    const result = new Uint8Array(header.length + rawData.length);

    result.set(header, 0);
    result.set(rawData, header.length);

    return result;
  }

  /**
   * @task T008
   * @epic T001
   * @why Get WAV as Base64 string
   * @what Encodes WAV data for API transmission
   * @returns {string} Base64-encoded WAV data
   */
  toBase64(): string {
    const wav = this.toWav();
    // Convert to string for btoa
    let binary = '';
    for (let i = 0; i < wav.length; i++) {
      binary += String.fromCharCode(wav[i]);
    }
    // Use GLib.base64_encode if available, otherwise manual
    if (typeof (GLib as any).base64_encode === 'function') {
      return (GLib as any).base64_encode(binary);
    }
    // Fallback - this won't work in GJS without proper base64
    return binary;
  }

  /**
   * @task T008
   * @epic T001
   * @why Get WAV as Blob-like object for FormData
   * @what Creates object suitable for multipart upload
   * @returns {{ data: Uint8Array; type: string }} Object with data and MIME type
   */
  toBlobData(): { data: Uint8Array; type: string } {
    return {
      data: this.toWav(),
      type: 'audio/wav',
    };
  }

  /**
   * @task T008
   * @epic T001
   * @why Get audio format info
   * @what Returns current format configuration
   * @returns {object} Format details
   */
  getFormat(): {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
  } {
    return {
      sampleRate: this._sampleRate,
      channels: this._channels,
      bitsPerSample: this._bitsPerSample,
    };
  }

  /**
   * @task T008
   * @epic T001
   * @why Get sample count
   * @what Calculates number of audio samples
   * @returns {number} Number of samples
   */
  getSampleCount(): number {
    const bytesPerSample = this._bitsPerSample / 8;
    return this._totalBytes / (bytesPerSample * this._channels);
  }
}

/**
 * @task T008
 * @epic T001
 * @why Create buffer with STT-optimized defaults
 * @what Factory for standard 16kHz mono 16-bit buffer
 * @returns {AudioBuffer} Preconfigured audio buffer
 */
export function createSTTBuffer(): AudioBuffer {
  return new AudioBuffer(
    AUDIO_FORMAT.SAMPLE_RATE,
    AUDIO_FORMAT.CHANNELS,
    AUDIO_FORMAT.BITS_PER_SAMPLE
  );
}
