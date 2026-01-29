pub mod audio;
pub mod dictation;
pub mod hotkey;
pub mod models;
pub mod text_injection;
pub mod transcription;

use crate::managers::audio::AudioRecordingManager;
use crate::overlay::hide_recording_overlay;
use crate::settings::{get_default_settings, get_settings, write_settings, AppSettings};
use crate::tray::{change_tray_icon, TrayIconState};
use log::{info, warn};
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
#[specta::specta]
pub fn get_app_dir_path(app: AppHandle) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    Ok(app_data_dir.to_string_lossy().to_string())
}

#[tauri::command]
#[specta::specta]
pub fn get_app_settings(app: AppHandle) -> Result<AppSettings, String> {
    Ok(get_settings(&app))
}

#[tauri::command]
#[specta::specta]
pub fn get_default_app_settings() -> Result<AppSettings, String> {
    Ok(get_default_settings())
}

#[tauri::command]
#[specta::specta]
pub fn get_log_dir_path(app: AppHandle) -> Result<String, String> {
    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|e| format!("Failed to get log directory: {}", e))?;

    Ok(log_dir.to_string_lossy().to_string())
}

#[specta::specta]
#[tauri::command]
pub fn open_log_dir(app: AppHandle) -> Result<(), String> {
    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|e| format!("Failed to get log directory: {}", e))?;

    let path = log_dir.to_string_lossy().as_ref().to_string();
    app.opener()
        .open_path(path, None::<String>)
        .map_err(|e| format!("Failed to open log directory: {}", e))?;

    Ok(())
}

#[specta::specta]
#[tauri::command]
pub fn open_app_data_dir(app: AppHandle) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let path = app_data_dir.to_string_lossy().as_ref().to_string();
    app.opener()
        .open_path(path, None::<String>)
        .map_err(|e| format!("Failed to open app data directory: {}", e))?;

    Ok(())
}

use serde::{Deserialize, Serialize};
use specta::Type;

/// Strongly-typed setting update enum - each variant has the correct type.
/// This provides type safety, works with specta for TypeScript generation,
/// and follows SOLID principles (Open/Closed - add new variants without modifying existing code).
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "key", content = "value")]
pub enum SettingUpdate {
    #[serde(rename = "push_to_talk")]
    PushToTalk(bool),
    #[serde(rename = "audio_feedback")]
    AudioFeedback(bool),
    #[serde(rename = "audio_feedback_volume")]
    AudioFeedbackVolume(f32),
    #[serde(rename = "start_hidden")]
    StartHidden(bool),
    #[serde(rename = "autostart_enabled")]
    AutostartEnabled(bool),
    #[serde(rename = "update_checks_enabled")]
    UpdateChecksEnabled(bool),
    #[serde(rename = "translate_to_english")]
    TranslateToEnglish(bool),
    #[serde(rename = "selected_language")]
    SelectedLanguage(String),
    #[serde(rename = "mute_while_recording")]
    MuteWhileRecording(bool),
    #[serde(rename = "always_on_microphone")]
    AlwaysOnMicrophone(bool),
    #[serde(rename = "cloud_stt_enabled")]
    CloudSttEnabled(bool),
}

/// Update a single setting with type-safe value.
///
/// # Example (TypeScript)
/// ```typescript
/// await commands.updateSetting({ key: "push_to_talk", value: true });
/// await commands.updateSetting({ key: "audio_feedback_volume", value: 0.8 });
/// ```
#[specta::specta]
#[tauri::command]
pub fn update_setting(app: AppHandle, update: SettingUpdate) -> Result<(), String> {
    let mut settings = get_settings(&app);

    match update {
        SettingUpdate::PushToTalk(v) => settings.push_to_talk = v,
        SettingUpdate::AudioFeedback(v) => settings.audio_feedback = v,
        SettingUpdate::AudioFeedbackVolume(v) => settings.audio_feedback_volume = v,
        SettingUpdate::StartHidden(v) => settings.start_hidden = v,
        SettingUpdate::AutostartEnabled(enabled) => {
            settings.autostart_enabled = enabled;
            let autostart_manager = app.autolaunch();
            if enabled {
                autostart_manager.enable().map_err(|e| {
                    warn!("Failed to enable autostart: {}", e);
                    format!("Failed to enable autostart: {}", e)
                })?;
                info!("Autostart enabled");
            } else {
                autostart_manager.disable().map_err(|e| {
                    warn!("Failed to disable autostart: {}", e);
                    format!("Failed to disable autostart: {}", e)
                })?;
                info!("Autostart disabled");
            }
        }
        SettingUpdate::UpdateChecksEnabled(v) => settings.update_checks_enabled = v,
        SettingUpdate::TranslateToEnglish(v) => settings.translate_to_english = v,
        SettingUpdate::SelectedLanguage(v) => settings.selected_language = v,
        SettingUpdate::MuteWhileRecording(v) => settings.mute_while_recording = v,
        SettingUpdate::AlwaysOnMicrophone(v) => settings.always_on_microphone = v,
        SettingUpdate::CloudSttEnabled(v) => settings.cloud_stt_enabled = v,
    }

    write_settings(&app, settings);
    Ok(())
}

#[specta::specta]
#[tauri::command]
pub fn cancel_operation(app: AppHandle) {
    info!("Initiating operation cancellation...");

    // Cancel any ongoing recording
    let audio_manager = app.state::<Arc<AudioRecordingManager>>();
    audio_manager.cancel_recording();

    // Update tray icon and hide overlay
    change_tray_icon(&app, TrayIconState::Idle);
    hide_recording_overlay(&app);

    info!("Operation cancellation completed - returned to idle state");
}

/// Get the actual autostart state from the system (via plugin).
/// This queries the OS-level autostart configuration, not the saved setting.
#[tauri::command]
#[specta::specta]
pub fn get_autostart_enabled(app: AppHandle) -> Result<bool, String> {
    let autostart_manager = app.autolaunch();
    autostart_manager
        .is_enabled()
        .map_err(|e| format!("Failed to check autostart status: {}", e))
}

/// Set the autostart state directly via the plugin.
/// This updates both the OS-level autostart and the saved setting.
#[tauri::command]
#[specta::specta]
pub fn set_autostart_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    let autostart_manager = app.autolaunch();

    if enabled {
        autostart_manager
            .enable()
            .map_err(|e| format!("Failed to enable autostart: {}", e))?;
        info!("Autostart enabled via set_autostart_enabled");
    } else {
        autostart_manager
            .disable()
            .map_err(|e| format!("Failed to disable autostart: {}", e))?;
        info!("Autostart disabled via set_autostart_enabled");
    }

    // Also update the saved setting to keep them in sync
    let mut settings = get_settings(&app);
    settings.autostart_enabled = enabled;
    write_settings(&app, settings);

    Ok(())
}

/// Sync the saved autostart setting with the actual OS-level autostart state.
/// This is useful during app initialization to ensure consistency.
#[tauri::command]
#[specta::specta]
pub fn sync_autostart_state(app: AppHandle) -> Result<bool, String> {
    let autostart_manager = app.autolaunch();
    let actual_state = autostart_manager
        .is_enabled()
        .map_err(|e| format!("Failed to check autostart status: {}", e))?;

    // Update the saved setting to match the actual state
    let mut settings = get_settings(&app);
    if settings.autostart_enabled != actual_state {
        info!(
            "Syncing autostart setting: saved={} actual={}",
            settings.autostart_enabled, actual_state
        );
        settings.autostart_enabled = actual_state;
        write_settings(&app, settings);
    }

    Ok(actual_state)
}
