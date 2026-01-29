use crate::cloud_stt::CloudSttProvider;
use crate::managers::transcription::{TranscriptionManager, TranscriptionResultWithFallback};
use crate::settings::{get_settings, write_settings, ModelUnloadTimeout};
use serde::Serialize;
use specta::Type;
use std::sync::Arc;
use tauri::{AppHandle, State};

#[derive(Serialize, Type)]
pub struct ModelLoadStatus {
    is_loaded: bool,
    current_model: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub fn set_model_unload_timeout(app: AppHandle, timeout: ModelUnloadTimeout) {
    let mut settings = get_settings(&app);
    settings.model_unload_timeout = timeout;
    write_settings(&app, settings);
}

#[tauri::command]
#[specta::specta]
pub fn get_model_load_status(
    transcription_manager: State<Arc<TranscriptionManager>>,
) -> Result<ModelLoadStatus, String> {
    Ok(ModelLoadStatus {
        is_loaded: transcription_manager.is_model_loaded(),
        current_model: transcription_manager.get_current_model(),
    })
}

#[tauri::command]
#[specta::specta]
pub fn unload_model_manually(
    transcription_manager: State<Arc<TranscriptionManager>>,
) -> Result<(), String> {
    transcription_manager
        .unload_model()
        .map_err(|e| format!("Failed to unload model: {}", e))
}

/// Cloud STT fallback status
#[derive(Serialize, Type)]
pub struct CloudSttStatus {
    pub enabled: bool,
    pub provider: CloudSttProvider,
    pub has_api_key: bool,
    pub fallback_threshold: f32,
}

/// Get current cloud STT configuration status
#[tauri::command]
#[specta::specta]
pub fn get_cloud_stt_status(app: AppHandle) -> CloudSttStatus {
    let settings = get_settings(&app);
    CloudSttStatus {
        enabled: settings.cloud_stt_enabled,
        provider: settings.cloud_stt_provider,
        has_api_key: !settings.cloud_stt_api_key.is_empty(),
        fallback_threshold: settings.cloud_stt_fallback_threshold,
    }
}

/// Configure cloud STT settings
#[tauri::command]
#[specta::specta]
pub fn set_cloud_stt_config(
    app: AppHandle,
    enabled: bool,
    provider: CloudSttProvider,
    api_key: String,
    fallback_threshold: f32,
) {
    let mut settings = get_settings(&app);
    settings.cloud_stt_enabled = enabled;
    settings.cloud_stt_provider = provider;
    settings.cloud_stt_api_key = api_key;
    settings.cloud_stt_fallback_threshold = fallback_threshold.clamp(0.0, 1.0);
    write_settings(&app, settings);
}

/// Set only the cloud STT API key (for secure input)
#[tauri::command]
#[specta::specta]
pub fn set_cloud_stt_api_key(app: AppHandle, api_key: String) {
    let mut settings = get_settings(&app);
    settings.cloud_stt_api_key = api_key;
    write_settings(&app, settings);
}

/// Enable or disable cloud STT fallback
#[tauri::command]
#[specta::specta]
pub fn set_cloud_stt_enabled(app: AppHandle, enabled: bool) {
    let mut settings = get_settings(&app);
    settings.cloud_stt_enabled = enabled;
    write_settings(&app, settings);
}

/// Set cloud STT provider
#[tauri::command]
#[specta::specta]
pub fn set_cloud_stt_provider(app: AppHandle, provider: CloudSttProvider) {
    let mut settings = get_settings(&app);
    settings.cloud_stt_provider = provider;
    write_settings(&app, settings);
}

/// Set cloud STT fallback threshold
#[tauri::command]
#[specta::specta]
pub fn set_cloud_stt_threshold(app: AppHandle, threshold: f32) {
    let mut settings = get_settings(&app);
    settings.cloud_stt_fallback_threshold = threshold.clamp(0.0, 1.0);
    write_settings(&app, settings);
}

/// Check if cloud STT is ready to use
#[tauri::command]
#[specta::specta]
pub fn is_cloud_stt_available(
    transcription_manager: State<Arc<TranscriptionManager>>,
) -> bool {
    transcription_manager.is_cloud_stt_available()
}

/// Transcribe audio with cloud fallback support
/// This is an async command that performs local transcription and falls back to cloud if needed
#[tauri::command]
#[specta::specta]
pub async fn transcribe_with_fallback(
    transcription_manager: State<'_, Arc<TranscriptionManager>>,
    audio: Vec<f32>,
) -> Result<TranscriptionResultWithFallback, String> {
    transcription_manager
        .transcribe_with_fallback(audio)
        .await
        .map_err(|e| format!("Transcription failed: {}", e))
}

/// Transcribe audio using only cloud STT (bypass local model)
#[tauri::command]
#[specta::specta]
pub async fn transcribe_cloud_only(
    transcription_manager: State<'_, Arc<TranscriptionManager>>,
    audio: Vec<f32>,
) -> Result<TranscriptionResultWithFallback, String> {
    transcription_manager
        .transcribe_cloud_only(audio)
        .await
        .map_err(|e| format!("Cloud transcription failed: {}", e))
}
