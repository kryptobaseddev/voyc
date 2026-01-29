/**
 * @task T012
 * @epic T001
 * @why Chunked audio buffer for streaming STT with configurable chunk size
 * @what Accumulates audio data and yields chunks for WebSocket streaming
 * @experimental Realtime STT is experimental
 */

// GJS-style imports
declare const imports: {
  gi: {
    GLib: typeof import('@girs/glib-2.0').GLib;
  };
};

const { GLib } = imports.gi;

/**
 * Audio format constants for streaming
 * @task T012
 * @epic T001
 * @why Standard format for ElevenLabs realtime STT
 * @what Defines PCM audio format parameters
 * @experimental Realtime STT is experimental
 */
export const STREAMING_AUDIO_FORMAT = {
  /** Sample rate in Hz - 16kHz is optimal for STT */
  SAMPLE_RATE: 16000,
  /** Number of audio channels - mono for voice */
  CHANNELS: 1,
  /** Bits per sample - 16-bit PCM */
  BITS_PER_SAMPLE: 16,
  /** Bytes per sample */
  BYTES_PER_SAMPLE: 2,
  /** Milliseconds of audio per chunk (100ms is a good balance) */
  CHUNK_DURATION_MS: 100,
} as const;

/**
 * Calculate bytes per chunk based on duration
 * @task T012
 * @epic T001
 * @why Determine chunk size for streaming
 * @what Calculates bytes needed for specified duration
 * @experimental Realtime STT is experimental
 * @param {number} durationMs - Duration in milliseconds
 * @returns {number} Bytes per chunk
 */
export function calculateChunkSize(durationMs: number): number {
  const bytesPerSecond = 
    STREAMING_AUDIO_FORMAT.SAMPLE_RATE * 
    STREAMING_AUDIO_FORMAT.CHANNELS * 
    STREAMING_AUDIO_FORMAT.BYTES_PER_SAMPLE;
  return Math.floor((bytesPerSecond * durationMs) / 1000);
}

/**
 * Default chunk size in bytes (100ms of 16kHz 16-bit mono PCM)
 * @task T012
 * @epic T001
 * @why Standard chunk size for streaming
 * @experimental Realtime STT is experimental
 */
export const DEFAULT_CHUNK_SIZE = calculateChunkSize(STREAMING_AUDIO_FORMAT.CHUNK_DURATION_MS);

/**
 * Chunk callback type for streaming
 * @task T012
 * @epic T001
 * @why Callback signature for chunk processing
 * @what Function type for handling audio chunks
 * @experimental Realtime STT is experimental
 */
export type ChunkCallback = (chunk: Uint8Array, isFinal: boolean) => void;

/**
 * Streaming audio buffer for realtime STT
 * Accumulates audio chunks and provides streaming interface
 * 
 * @task T012
 * @epic T001
 * @why Buffer audio for chunked streaming to WebSocket
 * @what Accumulates PCM audio and yields fixed-size chunks
 * @experimental Realtime STT is experimental
 */
export class StreamingAudioBuffer {
  private _accumulator: Uint8Array = new Uint8Array(0);
  private _chunkSize: number;
  private _chunkCallback: ChunkCallback | null = null;
  private _totalBytes: number = 0;
  private _chunksSent: number = 0;
  private _startTime: number;
  private _sampleRate: number;
  private _channels: number;
  private _bitsPerSample: number;

  /**
   * Create a new streaming audio buffer
   * 
   * @task T012
   * @epic T001
   * @why Initialize buffer with specified format and chunk size
   * @what Sets up buffer for streaming audio accumulation
   * @experimental Realtime STT is experimental
   * @param {number} [chunkSize] - Size of each chunk in bytes (default: 3200 for 100ms)
   * @param {number} [sampleRate=16000] - Sample rate in Hz
   * @param {number} [channels=1] - Number of channels
   * @param {number} [bitsPerSample=16] - Bits per sample
   */
  constructor(
    chunkSize: number = DEFAULT_CHUNK_SIZE,
    sampleRate: number = STREAMING_AUDIO_FORMAT.SAMPLE_RATE,
    channels: number = STREAMING_AUDIO_FORMAT.CHANNELS,
    bitsPerSample: number = STREAMING_AUDIO_FORMAT.BITS_PER_SAMPLE
  ) {
    this._chunkSize = chunkSize;
    this._sampleRate = sampleRate;
    this._channels = channels;
    this._bitsPerSample = bitsPerSample;
    this._startTime = GLib.get_monotonic_time();
  }

  /**
   * Set the chunk callback for streaming
   * 
   * @task T012
   * @epic T001
   * @why Register callback to receive audio chunks
   * @what Sets the function called when chunks are ready
   * @experimental Realtime STT is experimental
   * @param {ChunkCallback} callback - Function to call with each chunk
   */
  onChunk(callback: ChunkCallback): void {
    this._chunkCallback = callback;
  }

  /**
   * Add audio data to the buffer
   * Automatically emits chunks when enough data is accumulated
   * 
   * @task T012
   * @epic T001
   * @why Accumulate audio and emit chunks for streaming
   * @what Appends data and emits complete chunks via callback
   * @experimental Realtime STT is experimental
   * @param {Uint8Array} data - Raw PCM audio data
   */
  append(data: Uint8Array): void {
    // Accumulate data
    const newAccumulator = new Uint8Array(this._accumulator.length + data.length);
    newAccumulator.set(this._accumulator);
    newAccumulator.set(data, this._accumulator.length);
    this._accumulator = newAccumulator;
    this._totalBytes += data.length;

    // Emit chunks while we have enough data
    this._emitChunks();
  }

  /**
   * Emit complete chunks from accumulator
   * 
   * @task T012
   * @epic T001
   * @why Process accumulated audio into fixed-size chunks
   * @what Extracts chunks and calls the callback
   * @experimental Realtime STT is experimental
   * @private
   */
  private _emitChunks(): void {
    if (!this._chunkCallback) {
      return;
    }

    while (this._accumulator.length >= this._chunkSize) {
      // Extract chunk
      const chunk = this._accumulator.slice(0, this._chunkSize);
      
      // Remove chunk from accumulator
      this._accumulator = this._accumulator.slice(this._chunkSize);
      
      // Increment counter
      this._chunksSent++;
      
      // Emit chunk (not final)
      this._chunkCallback(chunk, false);
    }
  }

  /**
   * Flush remaining data as final chunk
   * Call this when recording ends to send any remaining audio
   * 
   * @task T012
   * @epic T001
   * @why Send remaining audio when stream ends
   * @what Emits final chunk with remaining data
   * @experimental Realtime STT is experimental
   */
  flush(): void {
    if (!this._chunkCallback || this._accumulator.length === 0) {
      return;
    }

    // Emit remaining data as final chunk
    this._chunkCallback(new Uint8Array(this._accumulator), true);
    this._accumulator = new Uint8Array(0);
  }

  /**
   * Clear all buffered data
   * 
   * @task T012
   * @epic T001
   * @why Reset buffer for new recording session
   * @what Clears accumulator and resets counters
   * @experimental Realtime STT is experimental
   */
  clear(): void {
    this._accumulator = new Uint8Array(0);
    this._totalBytes = 0;
    this._chunksSent = 0;
    this._startTime = GLib.get_monotonic_time();
  }

  /**
   * Get total bytes buffered (including accumulator)
   * 
   * @task T012
   * @epic T001
   * @why Track total audio data processed
   * @what Returns total bytes received
   * @experimental Realtime STT is experimental
   * @returns {number} Total bytes
   */
  getTotalBytes(): number {
    return this._totalBytes;
  }

  /**
   * Get number of chunks sent
   * 
   * @task T012
   * @epic T001
   * @why Track streaming progress
   * @what Returns count of emitted chunks
   * @experimental Realtime STT is experimental
   * @returns {number} Number of chunks sent
   */
  getChunksSent(): number {
    return this._chunksSent;
  }

  /**
   * Get bytes pending in accumulator
   * 
   * @task T012
   * @epic T001
   * @why Check for unemitted audio data
   * @what Returns bytes waiting to be chunked
   * @experimental Realtime STT is experimental
   * @returns {number} Pending bytes
   */
  getPendingBytes(): number {
    return this._accumulator.length;
  }

  /**
   * Get elapsed time since buffer creation
   * 
   * @task T012
   * @epic T001
   * @why Track recording duration
   * @what Returns elapsed time in seconds
   * @experimental Realtime STT is experimental
   * @returns {number} Elapsed time in seconds
   */
  getElapsedTime(): number {
    const now = GLib.get_monotonic_time();
    return (now - this._startTime) / 1000000; // Convert microseconds to seconds
  }

  /**
   * Get audio duration based on bytes processed
   * 
   * @task T012
   * @epic T001
   * @why Calculate audio duration from byte count
   * @what Returns duration in seconds
   * @experimental Realtime STT is experimental
   * @returns {number} Duration in seconds
   */
  getDuration(): number {
    const bytesPerSecond = this._sampleRate * this._channels * (this._bitsPerSample / 8);
    return this._totalBytes / bytesPerSecond;
  }

  /**
   * Get the chunk size
   * 
   * @task T012
   * @epic T001
   * @why Check configured chunk size
   * @what Returns chunk size in bytes
   * @experimental Realtime STT is experimental
   * @returns {number} Chunk size in bytes
   */
  getChunkSize(): number {
    return this._chunkSize;
  }

  /**
   * Get audio format info
   * 
   * @task T012
   * @epic T001
   * @why Check buffer format configuration
   * @what Returns format details
   * @experimental Realtime STT is experimental
   * @returns {object} Format details
   */
  getFormat(): {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    chunkSize: number;
    chunkDurationMs: number;
  } {
    const bytesPerSecond = this._sampleRate * this._channels * (this._bitsPerSample / 8);
    const chunkDurationMs = (this._chunkSize / bytesPerSecond) * 1000;
    
    return {
      sampleRate: this._sampleRate,
      channels: this._channels,
      bitsPerSample: this._bitsPerSample,
      chunkSize: this._chunkSize,
      chunkDurationMs,
    };
  }

  /**
   * Convert PCM data to base64 for WebSocket transmission
   * 
   * @task T012
   * @epic T001
   * @why Encode audio for JSON WebSocket messages
   * @what Returns base64-encoded audio data
   * @experimental Realtime STT is experimental
   * @param {Uint8Array} data - PCM audio data
   * @returns {string} Base64 encoded string
   */
  static toBase64(data: Uint8Array): string {
    // Convert Uint8Array to binary string
    let binary = '';
    const len = data.length;
    const chunkSize = 0x8000; // Process in chunks to avoid stack overflow
    
    for (let i = 0; i < len; i += chunkSize) {
      const chunk = data.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    // Use GLib base64 encode if available
    if (typeof (GLib as any).base64_encode === 'function') {
      return (GLib as any).base64_encode(binary);
    }
    
    // Manual base64 encoding fallback
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;
    
    while (i < len) {
      const a = data[i++];
      const b = i < len ? data[i++] : 0;
      const c = i < len ? data[i++] : 0;
      
      const bitmap = (a << 16) | (b << 8) | c;
      
      result += base64Chars.charAt((bitmap >> 18) & 63);
      result += base64Chars.charAt((bitmap >> 12) & 63);
      result += base64Chars.charAt((bitmap >> 6) & 63);
      result += base64Chars.charAt(bitmap & 63);
    }
    
    // Add padding
    const padding = len % 3;
    if (padding === 1) {
      result = result.slice(0, -2) + '==';
    } else if (padding === 2) {
      result = result.slice(0, -1) + '=';
    }
    
    return result;
  }
}

/**
 * Create a streaming audio buffer with default settings
 * 
 * @task T012
 * @epic T001
 * @why Factory for standard streaming buffer
 * @what Creates buffer optimized for ElevenLabs realtime STT
 * @experimental Realtime STT is experimental
 * @param {number} [chunkDurationMs=100] - Chunk duration in milliseconds
 * @returns {StreamingAudioBuffer} Configured streaming buffer
 */
export function createStreamingBuffer(chunkDurationMs: number = 100): StreamingAudioBuffer {
  const chunkSize = calculateChunkSize(chunkDurationMs);
  return new StreamingAudioBuffer(
    chunkSize,
    STREAMING_AUDIO_FORMAT.SAMPLE_RATE,
    STREAMING_AUDIO_FORMAT.CHANNELS,
    STREAMING_AUDIO_FORMAT.BITS_PER_SAMPLE
  );
}
