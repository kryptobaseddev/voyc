//! Dictation Controller - Orchestrates the complete voice dictation flow
//!
//! @task DICTATION
//! @epic T026
//!
//! This module implements the brain of the application, tying together:
//! - AudioRecordingManager - start/stop recording, get audio samples
//! - TranscriptionManager - transcribe audio to text
//! - text_injection::inject_text - inject text into focused app
//! - audio_feedback module - play start/stop sounds
//! - overlay module - show/hide recording overlay
//! - tray module - change tray icon state

use crate::audio_feedback::{play_feedback_sound, play_feedback_sound_blocking, SoundType};
use crate::managers::audio::AudioRecordingManager;
use crate::managers::transcription::TranscriptionManager;
use crate::overlay::{hide_recording_overlay, show_recording_overlay, show_transcribing_overlay};
use crate::settings::get_settings;
use crate::text_injection::{self, InjectionResult};
use crate::tray::{change_tray_icon, TrayIconState};
use log::{debug, error, info, warn};
use serde::Serialize;
use specta::Type;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};

/// Dictation state for tracking workflow progress
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum DictationState {
    Idle,
    Recording,
    Transcribing,
}

/// Latency metrics for performance tracking (REQ-016)
#[derive(Debug, Clone, Serialize, Type, Default)]
pub struct LatencyMetrics {
    pub capture_ms: u64,
    pub transcription_ms: u64,
    pub injection_ms: u64,
    pub total_ms: u64,
}

/// Event emitted when dictation completes
#[derive(Debug, Clone, Serialize, Type)]
pub struct DictationCompleteEvent {
    pub text: String,
    pub used_fallback: bool,
    pub provider: Option<String>,
    pub duration_ms: u64,
    pub latency: LatencyMetrics,
}

/// Event emitted when text is copied to clipboard only (no paste tool available)
#[derive(Debug, Clone, Serialize, Type)]
pub struct TextClipboardOnlyEvent {
    pub text: String,
    pub reason: String,
}

/// Manages the complete dictation workflow
pub struct DictationController {
    app_handle: AppHandle,
    is_active: Arc<AtomicBool>,
}

impl DictationController {
    /// Create a new DictationController
    pub fn new(app_handle: AppHandle) -> Self {
        info!("DictationController created");
        Self {
            app_handle,
            is_active: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Start dictation (called on hotkey press)
    ///
    /// This method:
    /// 1. Checks if dictation is already active
    /// 2. Plays start sound if audio feedback is enabled
    /// 3. Starts audio recording
    /// 4. Applies mute if enabled (after audio feedback delay)
    /// 5. Updates UI (tray icon, overlay)
    pub fn start_dictation(&self, binding_id: &str) -> Result<(), String> {
        // Check if already active
        if self.is_active.load(Ordering::SeqCst) {
            debug!("Dictation already active, ignoring start");
            return Ok(());
        }

        info!("Starting dictation for binding: {}", binding_id);
        self.is_active.store(true, Ordering::SeqCst);

        let settings = get_settings(&self.app_handle);
        let audio_manager = self.app_handle.state::<Arc<AudioRecordingManager>>();

        // Play start sound if enabled (blocking to ensure it plays before mute)
        if settings.audio_feedback {
            play_feedback_sound_blocking(&self.app_handle, SoundType::Start);
        }

        // Start recording
        if !audio_manager.try_start_recording(binding_id) {
            self.is_active.store(false, Ordering::SeqCst);
            let current_state = audio_manager.is_recording();
            error!(
                "Failed to start recording for binding: {} (audio_manager.is_recording={})",
                binding_id, current_state
            );
            return Err(format!(
                "Failed to start recording (microphone may be in use or unavailable). is_recording={}",
                current_state
            ));
        }

        // Apply mute after audio feedback plays
        // Use a small delay to ensure the start sound has finished
        let audio_manager_clone = audio_manager.inner().clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(100));
            audio_manager_clone.apply_mute();
        });

        // Update UI
        change_tray_icon(&self.app_handle, TrayIconState::Recording);
        show_recording_overlay(&self.app_handle);

        // Emit state change event
        let _ = self
            .app_handle
            .emit("dictation-state-changed", DictationState::Recording);

        info!("Dictation started successfully");
        Ok(())
    }

    /// Stop dictation and process (called on hotkey release)
    ///
    /// This method:
    /// 1. Stops recording and gets audio samples
    /// 2. Updates overlay to transcribing state
    /// 3. Transcribes audio
    /// 4. Injects transcribed text into focused application
    /// 5. Plays stop sound
    /// 6. Cleans up and returns to idle state
    pub async fn stop_dictation(&self, binding_id: &str) -> Result<String, String> {
        // Check if active
        if !self.is_active.load(Ordering::SeqCst) {
            debug!("Dictation not active, ignoring stop");
            return Ok(String::new());
        }

        info!("Stopping dictation for binding: {}", binding_id);

        // REQ-016: Start latency tracking
        let total_start = Instant::now();
        let mut latency = LatencyMetrics::default();

        let audio_manager = self.app_handle.state::<Arc<AudioRecordingManager>>();
        let transcription_manager = self.app_handle.state::<Arc<TranscriptionManager>>();

        // Remove mute first
        audio_manager.remove_mute();

        // Stop recording and get audio samples
        let capture_start = Instant::now();
        let audio_samples = match audio_manager.stop_recording(binding_id) {
            Some(samples) => samples,
            None => {
                warn!("No audio recorded for binding: {}", binding_id);
                self.cleanup();
                return Ok(String::new());
            }
        };

        // Check if we have meaningful audio
        if audio_samples.is_empty() {
            info!("Empty audio, nothing to transcribe");
            self.cleanup();
            return Ok(String::new());
        }

        debug!("Got {} audio samples", audio_samples.len());
        latency.capture_ms = capture_start.elapsed().as_millis() as u64;

        // Update overlay to transcribing state
        let transcription_start = Instant::now();
        show_transcribing_overlay(&self.app_handle);
        change_tray_icon(&self.app_handle, TrayIconState::Transcribing);

        // Emit state change event
        let _ = self
            .app_handle
            .emit("dictation-state-changed", DictationState::Transcribing);

        // Initiate model load if needed (this will block until ready)
        transcription_manager.initiate_model_load();

        // Transcribe the audio
        let result = transcription_manager
            .transcribe_with_fallback(audio_samples)
            .await
            .map_err(|e| {
                error!("Transcription failed: {}", e);
                self.cleanup();
                format!("Transcription failed: {}", e)
            })?;

        let text = result.text.trim().to_string();

        // Check if we got any text
        if text.is_empty() {
            info!("Empty transcription result");
            self.play_stop_sound_async();
            self.cleanup();
            return Ok(String::new());
        }

        latency.transcription_ms = transcription_start.elapsed().as_millis() as u64;
        info!(
            "Transcription result: {} chars in {}ms (fallback: {}, provider: {:?})",
            text.len(),
            latency.transcription_ms,
            result.used_fallback,
            result.provider
        );

        // Inject text into focused application
        let injection_start = Instant::now();
        let injection_result = text_injection::inject_text(&self.app_handle, &text);

        match &injection_result {
            InjectionResult::SuccessYdotool => {
                info!("Text injected via ydotool");
            }
            InjectionResult::SuccessWtype => {
                info!("Text injected via wtype");
            }
            InjectionResult::ClipboardOnly => {
                info!("Text copied to clipboard (no paste tool available)");
                // Emit event so UI can notify user
                let _ = self.app_handle.emit(
                    "text-clipboard-only",
                    TextClipboardOnlyEvent {
                        text: text.clone(),
                        reason: "No paste tool (ydotool or wtype) available".to_string(),
                    },
                );
            }
            InjectionResult::Failed(msg) => {
                error!("Text injection failed: {}", msg);
            }
        }
        latency.injection_ms = injection_start.elapsed().as_millis() as u64;
        latency.total_ms = total_start.elapsed().as_millis() as u64;

        // REQ-016: Log latency metrics
        info!(
            "Latency metrics: capture={}ms, transcription={}ms, injection={}ms, total={}ms",
            latency.capture_ms, latency.transcription_ms, latency.injection_ms, latency.total_ms
        );

        // Play stop sound asynchronously
        self.play_stop_sound_async();

        // Emit completion event with latency metrics
        let _ = self.app_handle.emit(
            "dictation-complete",
            DictationCompleteEvent {
                text: text.clone(),
                used_fallback: result.used_fallback,
                provider: result.provider,
                duration_ms: result.duration_ms,
                latency,
            },
        );

        self.cleanup();
        Ok(text)
    }

    /// Cancel dictation without processing
    ///
    /// This method:
    /// 1. Removes mute if applied
    /// 2. Cancels recording (discards audio)
    /// 3. Cleans up UI state
    pub fn cancel_dictation(&self) {
        if !self.is_active.load(Ordering::SeqCst) {
            debug!("Dictation not active, nothing to cancel");
            return;
        }

        info!("Cancelling dictation");

        let audio_manager = self.app_handle.state::<Arc<AudioRecordingManager>>();

        // Remove mute
        audio_manager.remove_mute();

        // Cancel recording (discards audio)
        audio_manager.cancel_recording();

        // Emit cancel event
        let _ = self.app_handle.emit("dictation-cancelled", ());

        self.cleanup();
    }

    /// Check if dictation is currently active
    pub fn is_active(&self) -> bool {
        self.is_active.load(Ordering::SeqCst)
    }

    /// Get current dictation state
    pub fn get_state(&self) -> DictationState {
        if self.is_active.load(Ordering::SeqCst) {
            // Could be recording or transcribing, but we track it as a single active state
            // More detailed state tracking would require additional atomic state
            DictationState::Recording
        } else {
            DictationState::Idle
        }
    }

    /// Clean up after dictation ends (success, failure, or cancel)
    fn cleanup(&self) {
        self.is_active.store(false, Ordering::SeqCst);
        change_tray_icon(&self.app_handle, TrayIconState::Idle);
        hide_recording_overlay(&self.app_handle);

        // Emit state change event
        let _ = self
            .app_handle
            .emit("dictation-state-changed", DictationState::Idle);

        debug!("Dictation cleanup complete");
    }

    /// Play stop sound asynchronously
    fn play_stop_sound_async(&self) {
        let settings = get_settings(&self.app_handle);
        if settings.audio_feedback {
            play_feedback_sound(&self.app_handle, SoundType::Stop);
        }
    }
}
