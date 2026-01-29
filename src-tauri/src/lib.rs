pub mod audio_feedback;
pub mod audio_toolkit;
pub mod cloud_stt;
pub mod commands;
pub mod dictation;
pub mod hotkey;
pub mod llm_client;
pub mod managers;
pub mod overlay;
pub mod settings;
pub mod text_injection;
pub mod tray;
pub mod utils;

#[cfg(target_os = "linux")]
pub mod wayland_shortcuts;

use log::{info, warn};
use managers::audio::AudioRecordingManager;
use managers::model::ModelManager;
use managers::transcription::TranscriptionManager;
use overlay::create_recording_overlay;
use settings::get_settings;
use std::sync::Arc;
use tauri::image::Image;
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Listener, Manager};
#[cfg(debug_assertions)]
use specta_typescript::Typescript;
use tauri_specta::{collect_commands, Builder};
use tray::{change_tray_icon, get_current_theme, get_icon_path, show_main_window, TrayIconState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Set up Specta builder for TypeScript bindings
    let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
        // General commands
        commands::get_app_dir_path,
        commands::get_app_settings,
        commands::get_default_app_settings,
        commands::get_log_dir_path,
        commands::open_log_dir,
        commands::open_app_data_dir,
        commands::update_setting,
        commands::cancel_operation,
        // Autostart commands
        commands::get_autostart_enabled,
        commands::set_autostart_enabled,
        commands::sync_autostart_state,
        // Audio commands
        commands::audio::check_custom_sounds,
        commands::audio::update_microphone_mode,
        commands::audio::get_microphone_mode,
        commands::audio::get_available_microphones,
        commands::audio::set_selected_microphone,
        commands::audio::get_selected_microphone,
        commands::audio::get_available_output_devices,
        commands::audio::set_selected_output_device,
        commands::audio::get_selected_output_device,
        commands::audio::play_test_sound,
        commands::audio::is_recording,
        // Model commands
        commands::models::get_available_models,
        commands::models::get_model_info,
        commands::models::download_model,
        commands::models::delete_model,
        commands::models::set_active_model,
        commands::models::get_current_model,
        commands::models::get_transcription_model_status,
        commands::models::is_model_loading,
        commands::models::has_any_models_available,
        commands::models::has_any_models_or_downloads,
        commands::models::cancel_download,
        commands::models::get_recommended_first_model,
        // Transcription commands
        commands::transcription::set_model_unload_timeout,
        commands::transcription::get_model_load_status,
        commands::transcription::unload_model_manually,
        // Cloud STT commands
        commands::transcription::get_cloud_stt_status,
        commands::transcription::set_cloud_stt_config,
        commands::transcription::set_cloud_stt_api_key,
        commands::transcription::set_cloud_stt_enabled,
        commands::transcription::set_cloud_stt_provider,
        commands::transcription::set_cloud_stt_threshold,
        commands::transcription::is_cloud_stt_available,
        commands::transcription::transcribe_with_fallback,
        commands::transcription::transcribe_cloud_only,
        // Text injection commands
        commands::text_injection::inject_text,
        commands::text_injection::check_paste_tools,
        // Hotkey commands
        commands::hotkey::update_binding,
        commands::hotkey::suspend_binding,
        commands::hotkey::resume_binding,
        commands::hotkey::register_all_shortcuts,
        commands::hotkey::is_binding_suspended,
        commands::hotkey::get_shortcut_backend_info,
        commands::hotkey::open_shortcut_settings,
        // Dictation commands
        commands::dictation::start_dictation,
        commands::dictation::stop_dictation,
        commands::dictation::cancel_dictation,
        commands::dictation::is_dictation_active,
        commands::dictation::get_dictation_state,
    ]);

    // Export TypeScript bindings in development
    #[cfg(debug_assertions)]
    builder
        .export(Typescript::default(), "../src/bindings.ts")
        .expect("Failed to export TypeScript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(main_window) = app.get_webview_window("main") {
                let _ = main_window.show();
                let _ = main_window.set_focus();
            }
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            // Mount Specta events
            builder.mount_events(app);

            // Initialize managers
            info!("Initializing managers...");

            // Initialize ModelManager
            let model_manager =
                Arc::new(ModelManager::new(&app.handle()).expect("Failed to create ModelManager"));
            app.manage(model_manager.clone());
            info!("ModelManager initialized");

            // Initialize TranscriptionManager
            let transcription_manager = Arc::new(
                TranscriptionManager::new(&app.handle(), model_manager.clone())
                    .expect("Failed to create TranscriptionManager"),
            );
            app.manage(transcription_manager.clone());
            info!("TranscriptionManager initialized");

            // Initialize AudioRecordingManager
            let audio_manager = Arc::new(
                AudioRecordingManager::new(&app.handle())
                    .expect("Failed to create AudioRecordingManager"),
            );
            app.manage(audio_manager);
            info!("AudioRecordingManager initialized");

            // Initialize HotkeyManager
            let hotkey_manager = Arc::new(hotkey::HotkeyManager::new(app.handle().clone()));
            if let Err(e) = hotkey_manager.register_all() {
                warn!("Failed to register shortcuts: {}", e);
            }
            app.manage(hotkey_manager);
            info!("HotkeyManager initialized");

            // Initialize DictationController
            let dictation_controller =
                Arc::new(dictation::DictationController::new(app.handle().clone()));
            app.manage(dictation_controller.clone());
            info!("DictationController initialized");

            // Set up hotkey event handlers to trigger dictation
            info!("Setting up hotkey event listeners for dictation...");
            let dc_pressed = dictation_controller.clone();
            app.listen("shortcut-pressed", move |event| {
                let payload = event.payload();
                log::debug!("Received shortcut-pressed event with payload: {}", payload);
                // Parse the binding_id from the JSON payload (it's a quoted string)
                match serde_json::from_str::<String>(payload) {
                    Ok(binding_id) => {
                        log::debug!("Parsed shortcut-pressed binding_id: {}", binding_id);
                        if binding_id == "transcribe" {
                            if let Err(e) = dc_pressed.start_dictation(&binding_id) {
                                log::error!("Failed to start dictation: {}", e);
                            }
                        } else if binding_id == "cancel" {
                            dc_pressed.cancel_dictation();
                        }
                    }
                    Err(e) => {
                        log::error!(
                            "Failed to parse shortcut-pressed payload '{}': {}",
                            payload,
                            e
                        );
                    }
                }
            });

            let dc_released = dictation_controller.clone();
            app.listen("shortcut-released", move |event| {
                let payload = event.payload();
                log::debug!("Received shortcut-released event with payload: {}", payload);
                // Parse the binding_id from the JSON payload (it's a quoted string)
                match serde_json::from_str::<String>(payload) {
                    Ok(binding_id) => {
                        log::debug!("Parsed shortcut-released binding_id: {}", binding_id);
                        if binding_id == "transcribe" {
                            let dc = dc_released.clone();
                            let binding = binding_id.clone();
                            tauri::async_runtime::spawn(async move {
                                if let Err(e) = dc.stop_dictation(&binding).await {
                                    log::error!("Failed to stop dictation: {}", e);
                                }
                            });
                        }
                    }
                    Err(e) => {
                        log::error!(
                            "Failed to parse shortcut-released payload '{}': {}",
                            payload,
                            e
                        );
                    }
                }
            });
            info!("Hotkey event listeners registered and active");

            // Get the current theme to set the appropriate initial icon
            let app_handle = app.handle().clone();
            let initial_theme = get_current_theme(&app_handle);

            // Choose the appropriate initial icon based on theme
            let initial_icon_path = get_icon_path(initial_theme.clone(), TrayIconState::Idle);

            // For colored theme (Linux), disable template mode to preserve colors
            // For macOS dark/light themes, enable template mode for system-tinted icons
            let use_template = !matches!(initial_theme, tray::AppTheme::Colored);

            let tray = TrayIconBuilder::new()
                .icon(
                    Image::from_path(
                        app_handle
                            .path()
                            .resolve(initial_icon_path, tauri::path::BaseDirectory::Resource)
                            .unwrap(),
                    )
                    .unwrap(),
                )
                .show_menu_on_left_click(true)
                .icon_as_template(use_template)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "settings" => {
                        show_main_window(app);
                    }
                    "check_updates" => {
                        let settings = get_settings(app);
                        if settings.update_checks_enabled {
                            show_main_window(app);
                            let _ = app.emit("check-for-updates", ());
                        }
                    }
                    "cancel" => {
                        commands::cancel_operation(app.clone());
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(&app_handle)
                .unwrap();
            app.manage(tray);
            info!("System tray initialized");

            // Initialize tray menu with idle state
            change_tray_icon(&app_handle, TrayIconState::Idle);

            // Show main window on setup (unless start_hidden is enabled)
            let settings = get_settings(&app_handle);
            if !settings.start_hidden {
                if let Some(main_window) = app.get_webview_window("main") {
                    let _ = main_window.show();
                    let _ = main_window.set_focus();
                }
            }

            // Create the recording overlay window (hidden by default)
            create_recording_overlay(&app_handle);
            info!("Recording overlay created");

            info!("Application setup complete");
            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                // Prevent closing, just hide to tray
                api.prevent_close();
                let _ = window.hide();
            }
            tauri::WindowEvent::ThemeChanged(_theme) => {
                // Update tray icon to match new theme, maintaining idle state
                change_tray_icon(&window.app_handle(), TrayIconState::Idle);
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
