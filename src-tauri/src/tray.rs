use crate::settings;
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIcon;
use tauri::{AppHandle, Manager, Theme};

#[derive(Clone, Debug, PartialEq)]
pub enum TrayIconState {
    Idle,        // Yellow - bored face
    Recording,   // Green - happy face
    Transcribing, // Green - happy face (TODO: spinning animation in frontend)
    Error,       // Red - sad face
    Off,         // Grey - dead face
}

#[derive(Clone, Debug, PartialEq)]
pub enum AppTheme {
    Dark,
    Light,
    Colored, // Colored theme for Linux (default)
}

/// Gets the current app theme, with Linux defaulting to Colored theme
pub fn get_current_theme(app: &AppHandle) -> AppTheme {
    if cfg!(target_os = "linux") {
        // On Linux, always use the colored theme for better visibility
        AppTheme::Colored
    } else {
        // On other platforms, map system theme to our app theme
        if let Some(main_window) = app.get_webview_window("main") {
            match main_window.theme().unwrap_or(Theme::Dark) {
                Theme::Light => AppTheme::Light,
                Theme::Dark => AppTheme::Dark,
                _ => AppTheme::Dark, // Default fallback
            }
        } else {
            AppTheme::Dark
        }
    }
}

/// Gets the appropriate icon path for the given theme and state
/// Voyc custom icons:
/// - happy.png (green) = recording/transcribing (active states)
/// - bored.png (yellow) = idle
/// - sad.png (red) = error
/// - dead.png (grey) = off/disabled
pub fn get_icon_path(theme: AppTheme, state: TrayIconState) -> &'static str {
    match (theme, state) {
        // Colored theme (Linux default) - uses Voyc custom icons
        (AppTheme::Colored, TrayIconState::Idle) => "resources/tray_idle.png",           // bored (yellow)
        (AppTheme::Colored, TrayIconState::Recording) => "resources/tray_active.png",    // happy (green)
        (AppTheme::Colored, TrayIconState::Transcribing) => "resources/tray_active.png", // happy (green)
        (AppTheme::Colored, TrayIconState::Error) => "resources/tray_error.png",         // sad (red)
        (AppTheme::Colored, TrayIconState::Off) => "resources/tray_off.png",             // dead (grey)

        // Dark theme - uses monochrome light icons (for macOS/Windows dark mode)
        (AppTheme::Dark, TrayIconState::Idle) => "resources/tray_idle.png",
        (AppTheme::Dark, TrayIconState::Recording) => "resources/tray_recording.png",
        (AppTheme::Dark, TrayIconState::Transcribing) => "resources/tray_transcribing.png",
        (AppTheme::Dark, TrayIconState::Error) => "resources/tray_error.png",
        (AppTheme::Dark, TrayIconState::Off) => "resources/tray_off.png",

        // Light theme - uses monochrome dark icons (for macOS/Windows light mode)
        (AppTheme::Light, TrayIconState::Idle) => "resources/tray_idle_dark.png",
        (AppTheme::Light, TrayIconState::Recording) => "resources/tray_recording_dark.png",
        (AppTheme::Light, TrayIconState::Transcribing) => "resources/tray_transcribing_dark.png",
        (AppTheme::Light, TrayIconState::Error) => "resources/tray_error.png",
        (AppTheme::Light, TrayIconState::Off) => "resources/tray_off.png",
    }
}

pub fn change_tray_icon(app: &AppHandle, icon: TrayIconState) {
    let tray = app.state::<TrayIcon>();
    let theme = get_current_theme(app);

    let icon_path = get_icon_path(theme, icon.clone());

    let _ = tray.set_icon(Some(
        Image::from_path(
            app.path()
                .resolve(icon_path, tauri::path::BaseDirectory::Resource)
                .expect("failed to resolve"),
        )
        .expect("failed to set icon"),
    ));

    // Update menu based on state
    update_tray_menu(app, &icon);
}

pub fn update_tray_menu(app: &AppHandle, state: &TrayIconState) {
    let settings = settings::get_settings(app);
    let theme = get_current_theme(app);

    // Create common menu items
    let version_label = if cfg!(debug_assertions) {
        format!("Voyc v{} (Dev)", env!("CARGO_PKG_VERSION"))
    } else {
        format!("Voyc v{}", env!("CARGO_PKG_VERSION"))
    };

    let version_i = MenuItem::with_id(app, "version", &version_label, false, None::<&str>)
        .expect("failed to create version item");

    let settings_i = MenuItem::with_id(
        app,
        "settings",
        "Settings...",
        true,
        Some("Ctrl+,"),
    )
    .expect("failed to create settings item");

    let check_updates_i = MenuItem::with_id(
        app,
        "check_updates",
        "Check for Updates...",
        settings.update_checks_enabled,
        None::<&str>,
    )
    .expect("failed to create check updates item");

    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, Some("Ctrl+Q"))
        .expect("failed to create quit item");

    let separator = || PredefinedMenuItem::separator(app).expect("failed to create separator");

    let menu = match state {
        TrayIconState::Recording | TrayIconState::Transcribing => {
            let cancel_i = MenuItem::with_id(app, "cancel", "Cancel", true, None::<&str>)
                .expect("failed to create cancel item");
            Menu::with_items(
                app,
                &[
                    &version_i,
                    &separator(),
                    &cancel_i,
                    &separator(),
                    &settings_i,
                    &check_updates_i,
                    &separator(),
                    &quit_i,
                ],
            )
            .expect("failed to create menu")
        }
        TrayIconState::Idle => {
            // In idle state, show "Start Dictation" option
            let start_dictation_i = MenuItem::with_id(
                app,
                "start_dictation",
                "Start Dictation",
                true,
                None::<&str>,
            )
            .expect("failed to create start dictation item");

            Menu::with_items(
                app,
                &[
                    &version_i,
                    &separator(),
                    &start_dictation_i,
                    &separator(),
                    &settings_i,
                    &check_updates_i,
                    &separator(),
                    &quit_i,
                ],
            )
            .expect("failed to create menu")
        }
        TrayIconState::Error | TrayIconState::Off => Menu::with_items(
            app,
            &[
                &version_i,
                &separator(),
                &settings_i,
                &check_updates_i,
                &separator(),
                &quit_i,
            ],
        )
        .expect("failed to create menu"),
    };

    let tray = app.state::<TrayIcon>();
    let _ = tray.set_menu(Some(menu));
    // For colored theme (Linux), disable template mode to preserve colors
    // For macOS dark/light themes, enable template mode for system-tinted icons
    let use_template = !matches!(theme, AppTheme::Colored);
    let _ = tray.set_icon_as_template(use_template);
}

/// Show the main window
pub fn show_main_window(app: &AppHandle) {
    if let Some(main_window) = app.get_webview_window("main") {
        // First, ensure the window is visible
        if let Err(e) = main_window.show() {
            log::error!("Failed to show window: {}", e);
        }
        // Then, bring it to the front and give it focus
        if let Err(e) = main_window.set_focus() {
            log::error!("Failed to focus window: {}", e);
        }
    } else {
        log::error!("Main window not found.");
    }
}
