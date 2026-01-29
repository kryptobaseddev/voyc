//! Cloud Speech-to-Text fallback module
//!
//! Provides fallback transcription via cloud providers (ElevenLabs, OpenAI)
//! when local transcription confidence is below threshold.

use log::{debug, info};
use reqwest::header::AUTHORIZATION;
use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use specta::Type;

/// Supported cloud STT providers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default, Type)]
#[serde(rename_all = "snake_case")]
pub enum CloudSttProvider {
    OpenAI,
    #[default]
    ElevenLabs,
}

impl CloudSttProvider {
    pub fn as_str(&self) -> &'static str {
        match self {
            CloudSttProvider::OpenAI => "openai",
            CloudSttProvider::ElevenLabs => "elevenlabs",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            CloudSttProvider::OpenAI => "OpenAI Whisper",
            CloudSttProvider::ElevenLabs => "ElevenLabs",
        }
    }
}

/// Configuration for cloud STT fallback
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSttConfig {
    /// Whether cloud fallback is enabled
    pub enabled: bool,
    /// The cloud provider to use
    pub provider: CloudSttProvider,
    /// API key for the selected provider
    pub api_key: String,
    /// Confidence threshold (0.0-1.0) below which cloud fallback triggers
    /// Default: 0.85
    pub fallback_threshold: f32,
    /// Language hint for transcription (ISO 639-1 code)
    pub language: Option<String>,
}

impl Default for CloudSttConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            provider: CloudSttProvider::OpenAI,
            api_key: String::new(),
            fallback_threshold: 0.85,
            language: None,
        }
    }
}

/// Result from cloud STT transcription
#[derive(Debug, Clone, Serialize)]
pub struct CloudSttResult {
    pub text: String,
    pub provider: CloudSttProvider,
    pub duration_ms: u64,
}

/// Event emitted when fallback is triggered
#[derive(Debug, Clone, Serialize)]
pub struct FallbackTriggeredEvent {
    pub provider: String,
    pub reason: String,
    pub local_confidence: f32,
    pub threshold: f32,
}

/// OpenAI Whisper API response
#[derive(Debug, Deserialize)]
struct OpenAITranscriptionResponse {
    text: String,
}

/// ElevenLabs STT API response
#[derive(Debug, Deserialize)]
struct ElevenLabsTranscriptionResponse {
    text: String,
}

/// Cloud STT client for making API requests
pub struct CloudSttClient {
    client: reqwest::Client,
}

impl CloudSttClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }

    /// Transcribe audio using the configured cloud provider
    pub async fn transcribe(
        &self,
        config: &CloudSttConfig,
        audio_samples: &[f32],
        sample_rate: u32,
    ) -> Result<CloudSttResult, String> {
        if config.api_key.is_empty() {
            return Err("Cloud STT API key not configured".to_string());
        }

        let start = std::time::Instant::now();

        // Convert f32 samples to WAV bytes
        let wav_data = samples_to_wav(audio_samples, sample_rate)?;

        let text = match config.provider {
            CloudSttProvider::OpenAI => {
                self.transcribe_openai(&config.api_key, &wav_data, config.language.as_deref())
                    .await?
            }
            CloudSttProvider::ElevenLabs => {
                self.transcribe_elevenlabs(&config.api_key, &wav_data, config.language.as_deref())
                    .await?
            }
        };

        let duration_ms = start.elapsed().as_millis() as u64;

        info!(
            "Cloud STT ({}) completed in {}ms: {} chars",
            config.provider.display_name(),
            duration_ms,
            text.len()
        );

        Ok(CloudSttResult {
            text,
            provider: config.provider,
            duration_ms,
        })
    }

    /// Transcribe using OpenAI Whisper API
    async fn transcribe_openai(
        &self,
        api_key: &str,
        wav_data: &[u8],
        language: Option<&str>,
    ) -> Result<String, String> {
        let url = "https://api.openai.com/v1/audio/transcriptions";

        debug!("Sending transcription request to OpenAI Whisper API");

        let file_part = Part::bytes(wav_data.to_vec())
            .file_name("audio.wav")
            .mime_str("audio/wav")
            .map_err(|e| format!("Failed to create file part: {}", e))?;

        let mut form = Form::new()
            .part("file", file_part)
            .text("model", "whisper-1");

        // Add language hint if provided
        if let Some(lang) = language {
            // Normalize Chinese language codes
            let normalized_lang = if lang == "zh-Hans" || lang == "zh-Hant" {
                "zh"
            } else {
                lang
            };
            form = form.text("language", normalized_lang.to_string());
        }

        let response = self
            .client
            .post(url)
            .header(AUTHORIZATION, format!("Bearer {}", api_key))
            .multipart(form)
            .send()
            .await
            .map_err(|e| format!("OpenAI API request failed: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Failed to read error response".to_string());
            return Err(format!(
                "OpenAI API request failed with status {}: {}",
                status, error_text
            ));
        }

        let result: OpenAITranscriptionResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

        Ok(result.text)
    }

    /// Transcribe using ElevenLabs STT API
    async fn transcribe_elevenlabs(
        &self,
        api_key: &str,
        wav_data: &[u8],
        language: Option<&str>,
    ) -> Result<String, String> {
        let url = "https://api.elevenlabs.io/v1/speech-to-text";

        debug!("Sending transcription request to ElevenLabs STT API");

        let file_part = Part::bytes(wav_data.to_vec())
            .file_name("audio.wav")
            .mime_str("audio/wav")
            .map_err(|e| format!("Failed to create file part: {}", e))?;

        let mut form = Form::new().part("audio", file_part);

        // Add language hint if provided
        if let Some(lang) = language {
            // Normalize Chinese language codes
            let normalized_lang = if lang == "zh-Hans" || lang == "zh-Hant" {
                "zh"
            } else {
                lang
            };
            form = form.text("language_code", normalized_lang.to_string());
        }

        let response = self
            .client
            .post(url)
            .header("xi-api-key", api_key)
            .multipart(form)
            .send()
            .await
            .map_err(|e| format!("ElevenLabs API request failed: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Failed to read error response".to_string());
            return Err(format!(
                "ElevenLabs API request failed with status {}: {}",
                status, error_text
            ));
        }

        let result: ElevenLabsTranscriptionResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse ElevenLabs response: {}", e))?;

        Ok(result.text)
    }
}

impl Default for CloudSttClient {
    fn default() -> Self {
        Self::new()
    }
}

/// Estimate transcription confidence based on heuristics
///
/// Since the local transcription engine doesn't provide confidence scores,
/// we estimate based on output characteristics:
/// - Empty or very short output suggests low confidence
/// - High ratio of special characters or numbers may indicate errors
/// - Presence of common hallucination patterns reduces confidence
pub fn estimate_confidence(text: &str, audio_duration_secs: f32) -> f32 {
    if text.is_empty() {
        return 0.0;
    }

    let mut confidence = 1.0f32;

    // Penalty for very short text relative to audio duration
    // Expected: ~2-3 words per second of speech
    let words_per_second = text.split_whitespace().count() as f32 / audio_duration_secs.max(0.1);
    if words_per_second < 0.5 {
        // Very sparse transcription
        confidence *= 0.6;
    } else if words_per_second > 10.0 {
        // Suspiciously dense (possible hallucination)
        confidence *= 0.7;
    }

    // Penalty for high ratio of non-alphabetic characters
    let alpha_count = text.chars().filter(|c| c.is_alphabetic()).count();
    let total_chars = text.chars().count();
    let alpha_ratio = alpha_count as f32 / total_chars.max(1) as f32;
    if alpha_ratio < 0.5 {
        confidence *= 0.7;
    }

    // Penalty for common hallucination patterns
    let text_lower = text.to_lowercase();
    let hallucination_patterns = [
        "thank you for watching",
        "subscribe",
        "like and share",
        "see you next time",
        "...",
        "!!!",
        "???",
    ];

    for pattern in hallucination_patterns {
        if text_lower.contains(pattern) {
            confidence *= 0.5;
            break;
        }
    }

    // Penalty for excessive repetition (stuttering/looping hallucination)
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.len() > 3 {
        let mut repetition_count = 0;
        for window in words.windows(2) {
            if window[0] == window[1] {
                repetition_count += 1;
            }
        }
        if repetition_count as f32 / words.len() as f32 > 0.3 {
            confidence *= 0.5;
        }
    }

    confidence.clamp(0.0, 1.0)
}

/// Convert f32 audio samples to WAV format bytes
fn samples_to_wav(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>, String> {
    use std::io::Cursor;

    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut cursor = Cursor::new(Vec::new());
    {
        let mut writer = hound::WavWriter::new(&mut cursor, spec)
            .map_err(|e| format!("Failed to create WAV writer: {}", e))?;

        for &sample in samples {
            // Convert f32 [-1.0, 1.0] to i16
            let sample_i16 = (sample * 32767.0).clamp(-32768.0, 32767.0) as i16;
            writer
                .write_sample(sample_i16)
                .map_err(|e| format!("Failed to write sample: {}", e))?;
        }

        writer
            .finalize()
            .map_err(|e| format!("Failed to finalize WAV: {}", e))?;
    }

    Ok(cursor.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_estimate_confidence_empty() {
        assert_eq!(estimate_confidence("", 5.0), 0.0);
    }

    #[test]
    fn test_estimate_confidence_normal() {
        let confidence = estimate_confidence("Hello world, this is a test.", 3.0);
        assert!(confidence > 0.8);
    }

    #[test]
    fn test_estimate_confidence_hallucination() {
        let confidence = estimate_confidence("Thank you for watching", 2.0);
        assert!(confidence < 0.6);
    }

    #[test]
    fn test_estimate_confidence_repetition() {
        let confidence = estimate_confidence("hello hello hello hello hello", 2.0);
        assert!(confidence < 0.6);
    }

    #[test]
    fn test_samples_to_wav() {
        let samples = vec![0.0f32; 16000]; // 1 second at 16kHz
        let result = samples_to_wav(&samples, 16000);
        assert!(result.is_ok());
        let wav_data = result.unwrap();
        // Check WAV header magic bytes
        assert_eq!(&wav_data[0..4], b"RIFF");
        assert_eq!(&wav_data[8..12], b"WAVE");
    }
}
