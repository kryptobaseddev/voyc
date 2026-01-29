# Modern Voice Dictation App Architectures: Research Report (2025+)

**Date**: 2026-01-28
**Status**: Complete
**Context**: Voyc is a GJS/GTK4-based voice dictation app for Linux. This research informs modernization decisions.

---

## Executive Summary

The voice dictation landscape has matured significantly since 2022, with Whisper variants becoming the dominant open-source solution. For a Linux-native app like Voyc, the optimal path forward involves:

1. **STT Engine**: whisper.cpp or faster-whisper with quantized models
2. **Framework**: Tauri 2.0 (Rust + WebView) for cross-platform or stay with GTK4 for GNOME-native
3. **Audio Capture**: cpal (Rust) or direct PipeWire integration
4. **Architecture**: Streaming with VAD preprocessing, local-first with optional cloud fallback

---

## 1. Local STT Options

### Whisper Variant Comparison

| Variant | Language | GPU Support | Best For | Key Trade-off |
|---------|----------|-------------|----------|---------------|
| **whisper.cpp** | C/C++ | CUDA, Metal, OpenVINO | Embedded, deterministic builds | Timestamp accuracy (-300-800ms drift) |
| **faster-whisper** | Python/C++ | CUDA, MPS | Production with precise timestamps | Requires CTranslate2 runtime |
| **whisper-rs** | Rust | Via whisper.cpp | Rust integration | Bindings to whisper.cpp |
| **Distil-Whisper** | Python | CUDA | English-only, speed-critical | English only |
| **Whisper Turbo** | Python | CUDA | Multilingual, balanced | Larger than distilled |

**Recommendation for Voyc**: **whisper.cpp** for its deterministic memory behavior, pure C/C++ implementation, and proven stability on Linux. One case study noted uptime improved from 62% to 99.8% after switching from faster-whisper to whisper.cpp due to OOM issues.

### Quantization Options

whisper.cpp supports GGML quantization modes:
- **Q4_0, Q4_1, Q4_2**: Smallest size, fastest inference
- **Q5_0, Q5_1**: Better accuracy than Q4
- **Q8_0**: Best accuracy among quantized, larger than Q4/Q5
- **F16**: Full precision baseline

**Note**: On Apple Metal, quantized models can paradoxically be slower than non-quantized due to backend optimizations. Test on target hardware.

### GPU Acceleration

| Platform | Backend | Notes |
|----------|---------|-------|
| NVIDIA | CUDA | Partial support in whisper.cpp v1.4.0+ |
| Apple Silicon | Metal/ANE | Core ML encoder = 3x speedup vs CPU |
| Intel | OpenVINO | x86 CPUs and Intel GPUs |
| AMD | ROCm | Community support, less mature |

### Real-time vs Batch

| Mode | Latency | Accuracy | Use Case |
|------|---------|----------|----------|
| **Streaming** | 150-500ms | -3-7% WER | Live dictation, captions |
| **Batch** | 1-5s | Baseline | Transcription, offline |

**Key Insight**: Streaming ASR loses 3% WER without formatting, 6-7% with formatting. A 95% accurate system at 300ms often provides better UX than 98% accurate at 2 seconds.

---

## 2. App Framework Comparison

### Memory & Performance Benchmarks

| Framework | Idle Memory | App Size | Startup | Best For |
|-----------|-------------|----------|---------|----------|
| **Tauri 2.0** | 30-50 MB | ~2.5 MB | <0.5s | Performance-critical, cross-platform |
| **Electron** | 200-300 MB | ~85 MB | 1-2s | Rapid development, JS ecosystem |
| **GTK4 (Native)** | 20-40 MB | ~1-5 MB | <0.3s | GNOME-native, Linux-only |
| **Qt** | 50-100 MB | ~20-50 MB | <0.5s | Cross-platform native |
| **Flutter** | 40-80 MB | ~10-20 MB | <1s | Mobile + desktop unified |

### Framework Deep Dive

#### Tauri 2.0 (Recommended for Cross-Platform)
- **Pros**: Rust backend for memory safety, native WebView (no bundled Chromium), 35% YoY adoption growth, mobile support in 2024+
- **Cons**: WebView fragmentation across platforms (SVG/PDF bugs on macOS), Rust learning curve
- **Voice App Fit**: Excellent. Rust backend can directly integrate whisper.cpp via whisper-rs

#### GTK4 (Current Voyc Stack)
- **Pros**: True GNOME integration, smallest footprint, best Wayland support
- **Cons**: Linux-only in practice, GJS debugging challenges, limited ecosystem
- **Voice App Fit**: Good for Linux-only. Consider for GNOME-native positioning.

#### Electron
- **Pros**: Mature ecosystem, fastest development, Discord uses it for voice
- **Cons**: Memory hog, large bundles, security concerns
- **Voice App Fit**: Acceptable but suboptimal for resource-constrained scenarios

#### Flutter 3.29+
- **Pros**: FFI revolution (100ns call overhead vs MethodChannel), cross-platform including mobile
- **Cons**: Dart learning curve, native audio still requires FFI bridges
- **Voice App Fit**: Good for unified mobile/desktop. sherpa_onnx package enables local STT with <200ms latency on Raspberry Pi 4.

---

## 3. Audio Capture Patterns

### Platform-Specific APIs

| Platform | API | Latency | Notes |
|----------|-----|---------|-------|
| **Linux** | PipeWire | <10ms | Modern replacement for PulseAudio/JACK |
| **Linux (legacy)** | ALSA/PulseAudio | 10-50ms | Fallback for older systems |
| **Windows** | WASAPI | <10ms (exclusive) | Shared mode adds latency |
| **macOS** | CoreAudio | <10ms | Requires FFI for advanced features |

### Streaming Architecture

```
Microphone → Ring Buffer → VAD → Whisper → Text
            (100-200ms chunks)    ↓
                          Skip silence
```

**Key Components**:
1. **Ring Buffer**: Lock-free SPSC (Single Producer, Single Consumer) for audio thread safety
2. **VAD (Voice Activity Detection)**: Silero-VAD processes 32ms chunks, reduces computation by 70-90%
3. **Chunked Processing**: 100-200ms micro-buffers enable sub-300ms end-to-end latency

### Rust Ring Buffer Libraries

| Library | Design | Use Case |
|---------|--------|----------|
| **direct_ring_buffer** | Lock-free SPSC, slice-based | Real-time audio (recommended) |
| **ringbuf** | General purpose | Most applications |
| **VecDeque** (std) | Growable | Variable-size needs |
| **BipBuffer** | Contiguous writes | Avoiding split writes |

**Best Practice**: Use `direct_ring_buffer` for audio - its slice-based operations enable bulk data movement with better cache locality.

### Cross-Platform Rust Audio

| Library | Level | Platforms | Use Case |
|---------|-------|-----------|----------|
| **cpal** | Low-level I/O | Linux, Windows, macOS, WASM | Direct PCM access |
| **rodio** | High-level playback | Same (built on cpal) | Audio file playback |
| **libpulse-binding** | PulseAudio | Linux | PipeWire/Pulse interop |

**Recommendation**: Use cpal for cross-platform capture. For Linux-only, direct PipeWire integration via `pipewire-rs` provides lower latency.

---

## 4. Hybrid Local+Cloud Architecture

### Decision Matrix

| Factor | Local | Cloud | Hybrid |
|--------|-------|-------|--------|
| **Privacy** | Full control | Data sent to servers | Configurable |
| **Latency** | Varies by hardware | Consistent (<300ms) | Best of both |
| **Accuracy** | Model-dependent | State-of-art | Adaptive |
| **Offline** | Yes | No | Graceful degradation |
| **Cost** | Hardware only | Per-minute pricing | Optimized |

### Recommended Hybrid Pattern

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                      │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ VAD Filter  │ →  │ Local STT   │ →  │ Quality     │  │
│  │ (Silero)    │    │ (Whisper)   │    │ Check       │  │
│  └─────────────┘    └─────────────┘    └──────┬──────┘  │
│                                               │         │
│                     ┌─────────────────────────┤         │
│                     ↓                         ↓         │
│              ┌─────────────┐          ┌─────────────┐   │
│              │ Confidence  │          │ Cloud STT   │   │
│              │ >= 0.85     │          │ (Fallback)  │   │
│              └──────┬──────┘          └──────┬──────┘   │
│                     ↓                        ↓          │
│              ┌──────────────────────────────────────┐   │
│              │           Final Transcript           │   │
│              └──────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Fallback Strategies

1. **Confidence-Based**: Local result < 0.85 confidence → cloud verification
2. **Complexity-Based**: Detected technical jargon/names → cloud for accuracy
3. **Timeout-Based**: Local processing > 2s → parallel cloud request
4. **User-Triggered**: Manual "enhance" button for cloud refinement

### Privacy Considerations

- **Local-first default**: Never send audio without explicit consent
- **Entity filtering**: Mask PII before cloud transmission (SpeechShield approach)
- **Retention policies**: Cloud providers vary - prefer zero-retention options
- **Federated learning**: Emerging pattern for improving models without raw data

---

## 5. Memory-Efficient Patterns

### Audio Buffer Strategies

```rust
// Anti-pattern: Full buffer copy
let audio_data = capture_full_audio(); // Allocates full recording
let transcript = transcribe(audio_data);

// Pattern: Streaming with ring buffer
let ring = RingBuffer::new(CHUNK_SIZE * 10); // Fixed memory
loop {
    let chunk = ring.read_chunk(CHUNK_SIZE);
    if vad.is_speech(&chunk) {
        transcriber.process_chunk(&chunk);
    }
    ring.advance(CHUNK_SIZE);
}
```

### Whisper Memory Optimization

| Technique | Memory Savings | Impact |
|-----------|---------------|--------|
| **Quantization (Q4)** | 70-75% | Slight accuracy loss |
| **Quantization (Q8)** | 50% | Minimal accuracy loss |
| **Streaming mode** | Constant vs linear | Required for real-time |
| **Model pruning** | 50%+ (Turbo) | Trained compensation |

### Rust Memory Safety Benefits

1. **No GC pauses**: Deterministic audio callback timing
2. **Zero-cost abstractions**: High-level code, low-level performance
3. **Ownership model**: Prevents buffer overflows and use-after-free
4. **Compile-time guarantees**: Catch memory issues before runtime

### Memory Budget Guidelines

| Component | Typical Memory | Notes |
|-----------|---------------|-------|
| App Shell (Tauri) | 30-50 MB | Includes WebView |
| whisper.cpp (small.en Q8) | 200-300 MB | Loaded on demand |
| whisper.cpp (large-v3 Q4) | 1-1.5 GB | For accuracy-critical |
| Audio Ring Buffer | 1-10 MB | Configurable |
| VAD Model (Silero) | 10-20 MB | Lightweight |

**Total for responsive dictation**: 250-400 MB with small/medium models

---

## Actionable Recommendations for Voyc

### Immediate (0-3 months)

1. **Integrate whisper.cpp via Rust bindings**
   - Use `whisper-rs` crate for Rust integration
   - Start with `small.en` Q8 model for English
   - Implement streaming mode with 200ms chunks

2. **Add VAD preprocessing**
   - Integrate Silero-VAD (32ms chunks)
   - Reduces processing load by 70-90% during silence
   - Improves hallucination resistance

3. **Modernize audio capture**
   - Replace GStreamer with direct PipeWire integration
   - Use lock-free ring buffer (direct_ring_buffer)
   - Target <10ms capture latency

### Medium-term (3-6 months)

4. **Evaluate framework migration**
   - **Option A**: Stay GTK4/GJS for GNOME-native positioning
   - **Option B**: Migrate to Tauri 2.0 for cross-platform reach
   - Decision factor: Target audience (Linux-only vs broader)

5. **Implement hybrid architecture**
   - Local-first with confidence-based cloud fallback
   - User-controlled privacy settings
   - Consider OpenAI Whisper API or Groq for cloud tier

6. **GPU acceleration**
   - Add CUDA support for NVIDIA users
   - Intel OpenVINO for integrated graphics
   - Graceful fallback to CPU

### Long-term (6-12 months)

7. **Advanced features**
   - Speaker diarization (WhisperX/Sortformer)
   - Custom vocabulary support
   - Real-time translation

8. **Mobile expansion** (if Tauri chosen)
   - Leverage Tauri 2.0 mobile support
   - Share core Rust logic across platforms

---

## Key Sources

- [Modal: Choosing Between Whisper Variants](https://modal.com/blog/choosing-whisper-variants)
- [Modal: Open Source STT Models](https://modal.com/blog/open-source-stt)
- [Tauri vs Electron Comparison (RaftLabs)](https://www.raftlabs.com/blog/tauri-vs-electron-pros-cons/)
- [Tauri vs Electron Real World (Levminer)](https://www.levminer.com/blog/tauri-vs-electron)
- [whisper.cpp GitHub](https://github.com/ggml-org/whisper.cpp)
- [faster-whisper GitHub](https://github.com/SYSTRAN/faster-whisper)
- [WhisperLiveKit GitHub](https://github.com/QuentinFuxa/WhisperLiveKit)
- [CPAL Rust Audio Library](https://github.com/RustAudio/cpal)
- [PipeWire Guide](https://github.com/mikeroyal/PipeWire-Guide)
- [direct_ring_buffer Rust Crate](https://lib.rs/crates/direct_ring_buffer)
- [Ferrous Systems: Lock-Free Ring Buffer](https://ferrous-systems.com/blog/lock-free-ring-buffer/)
- [Distil-Whisper GitHub](https://github.com/huggingface/distil-whisper)
- [Northflank: STT Model Benchmarks 2026](https://northflank.com/blog/best-open-source-speech-to-text-stt-model-in-2026-benchmarks)
- [MDPI: Edge STT Systems](https://www.mdpi.com/2078-2489/16/8/685)
- [AssemblyAI: Real-time STT APIs](https://www.assemblyai.com/blog/best-api-models-for-real-time-speech-recognition-and-transcription)
- [Flutter FFI Revolution](https://medium.com/@sharjeelakram110/the-quiet-revolution-ffi-is-flutters-new-superpower-a0719d0cde4b)
- [Tauri Voice Recognition Guide (Genspark)](https://www.genspark.ai/spark/implementing-voice-recognition-in-tauri-apps/d8646a80-717d-48a7-9968-9c1a40b6ecf4)
