//! Dictation commands for Tauri frontend
//!
//! @task DICTATION
//! @epic T026
//!
//! These commands expose the DictationController functionality to the frontend.

use crate::dictation::{DictationController, DictationState};
use serde::Serialize;
use specta::Type;
use std::sync::Arc;
use tauri::State;

/// Result of a dictation operation
#[derive(Serialize, Type)]
pub struct DictationResult {
    /// Whether the operation succeeded
    pub success: bool,
    /// The transcribed text (empty if failed or no audio)
    pub text: String,
    /// Error message if operation failed
    pub error: Option<String>,
    /// Whether cloud fallback was used
    pub used_fallback: bool,
    /// Provider used (None = local, Some = cloud provider name)
    pub provider: Option<String>,
    /// Duration in milliseconds
    pub duration_ms: u64,
}

/// Start dictation recording
///
/// Called when the hotkey is pressed. Begins recording audio.
///
/// @task DICTATION
/// @epic T026
#[tauri::command]
#[specta::specta]
pub fn start_dictation(
    dictation_controller: State<Arc<DictationController>>,
    binding_id: String,
) -> Result<(), String> {
    dictation_controller.start_dictation(&binding_id)
}

/// Stop dictation and process
///
/// Called when the hotkey is released. Stops recording, transcribes audio,
/// and injects the text into the focused application.
///
/// @task DICTATION
/// @epic T026
#[tauri::command]
#[specta::specta]
pub async fn stop_dictation(
    dictation_controller: State<'_, Arc<DictationController>>,
    binding_id: String,
) -> Result<DictationResult, String> {
    match dictation_controller.stop_dictation(&binding_id).await {
        Ok(text) => Ok(DictationResult {
            success: true,
            text,
            error: None,
            used_fallback: false,
            provider: None,
            duration_ms: 0,
        }),
        Err(e) => Ok(DictationResult {
            success: false,
            text: String::new(),
            error: Some(e),
            used_fallback: false,
            provider: None,
            duration_ms: 0,
        }),
    }
}

/// Cancel ongoing dictation
///
/// Cancels any ongoing recording without processing. The recorded audio
/// is discarded.
///
/// @task DICTATION
/// @epic T026
#[tauri::command]
#[specta::specta]
pub fn cancel_dictation(dictation_controller: State<Arc<DictationController>>) {
    dictation_controller.cancel_dictation()
}

/// Check if dictation is currently active
///
/// Returns true if dictation is in progress (recording or transcribing).
///
/// @task DICTATION
/// @epic T026
#[tauri::command]
#[specta::specta]
pub fn is_dictation_active(dictation_controller: State<Arc<DictationController>>) -> bool {
    dictation_controller.is_active()
}

/// Get current dictation state
///
/// Returns the current state of the dictation workflow.
///
/// @task DICTATION
/// @epic T026
#[tauri::command]
#[specta::specta]
pub fn get_dictation_state(
    dictation_controller: State<Arc<DictationController>>,
) -> DictationState {
    dictation_controller.get_state()
}
