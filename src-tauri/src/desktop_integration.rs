//! Desktop Integration for AppImage builds
//!
//! This module handles self-integration for AppImage distributions,
//! creating .desktop files and installing icons without requiring sudo.
//!
//! When Voyc runs as an AppImage, it automatically:
//! - Creates a .desktop file in ~/.local/share/applications/
//! - Installs the app icon to ~/.local/share/icons/
//!
//! This allows the app to appear in application menus and launchers
//! without requiring root privileges.

use log::{debug, error, info, warn};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Desktop entry template for the .desktop file
const DESKTOP_ENTRY_TEMPLATE: &str = r#"[Desktop Entry]
Name=Voyc
Comment=Voice Dictation for Linux
Exec={appimage_path}
Icon={icon_path}
Type=Application
Categories=Utility;Audio;
Keywords=voice;dictation;speech;transcription;whisper;
StartupWMClass=voyc
Terminal=false
"#;

/// Check if the application is running as an AppImage
pub fn is_appimage() -> bool {
    std::env::var("APPIMAGE").is_ok()
}

/// Get the AppImage path from environment
pub fn get_appimage_path() -> Option<String> {
    std::env::var("APPIMAGE").ok()
}

/// Get the XDG data home directory (~/.local/share by default)
fn get_xdg_data_home() -> PathBuf {
    std::env::var("XDG_DATA_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let home = std::env::var("HOME").expect("HOME environment variable not set");
            PathBuf::from(home).join(".local/share")
        })
}

/// Get the path where the .desktop file should be created
fn get_desktop_file_path() -> PathBuf {
    get_xdg_data_home()
        .join("applications")
        .join("voyc.desktop")
}

/// Get the path where the icon should be installed
fn get_icon_install_path() -> PathBuf {
    get_xdg_data_home()
        .join("icons/hicolor/256x256/apps")
        .join("voyc.png")
}

/// Check if desktop integration has already been performed
fn is_integration_complete() -> bool {
    let desktop_file = get_desktop_file_path();
    let icon_path = get_icon_install_path();

    // Check if both files exist
    if !desktop_file.exists() || !icon_path.exists() {
        return false;
    }

    // Also check if the AppImage path in the desktop file matches current path
    if let Some(current_appimage) = get_appimage_path() {
        if let Ok(content) = fs::read_to_string(&desktop_file) {
            return content.contains(&current_appimage);
        }
    }

    false
}

/// Install the application icon to the user's icon directory
fn install_icon(app: &AppHandle) -> Result<(), String> {
    let icon_install_path = get_icon_install_path();

    // Create the icon directory if it doesn't exist
    if let Some(parent) = icon_install_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create icon directory: {}", e))?;
    }

    // Try to find and copy the icon from the app resources
    // First try the 128x128@2x.png (256x256), then fall back to 128x128.png
    let icon_candidates = ["icons/128x128@2x.png", "icons/128x128.png", "icons/icon.png"];

    for icon_name in icon_candidates {
        let icon_resource = app
            .path()
            .resolve(icon_name, tauri::path::BaseDirectory::Resource);

        if let Ok(resource_path) = icon_resource {
            if resource_path.exists() {
                fs::copy(&resource_path, &icon_install_path)
                    .map_err(|e| format!("Failed to copy icon: {}", e))?;
                info!(
                    "Installed icon from {} to {}",
                    resource_path.display(),
                    icon_install_path.display()
                );
                return Ok(());
            }
        }
    }

    // If no resource icons found, try to extract from the AppImage's bundled location
    // This handles the case where resources might be in a different location
    warn!("Could not find icon in app resources, desktop integration may have incomplete icon");
    Err("No suitable icon found in app resources".to_string())
}

/// Create the .desktop file for application menu integration
fn create_desktop_file() -> Result<(), String> {
    let desktop_file_path = get_desktop_file_path();
    let icon_path = get_icon_install_path();

    // Create the applications directory if it doesn't exist
    if let Some(parent) = desktop_file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create applications directory: {}", e))?;
    }

    // Get the AppImage path for the Exec field
    let appimage_path = get_appimage_path()
        .ok_or_else(|| "APPIMAGE environment variable not set".to_string())?;

    // Generate the desktop entry content
    let desktop_content = DESKTOP_ENTRY_TEMPLATE
        .replace("{appimage_path}", &appimage_path)
        .replace("{icon_path}", &icon_path.to_string_lossy());

    // Write the desktop file
    fs::write(&desktop_file_path, desktop_content)
        .map_err(|e| format!("Failed to write desktop file: {}", e))?;

    info!("Created desktop file at {}", desktop_file_path.display());
    Ok(())
}

/// Update the desktop database to refresh application menus
fn update_desktop_database() {
    let applications_dir = get_xdg_data_home().join("applications");

    // Run update-desktop-database if available
    // This is optional - menus will eventually refresh anyway
    match std::process::Command::new("update-desktop-database")
        .arg(&applications_dir)
        .output()
    {
        Ok(output) => {
            if output.status.success() {
                debug!("Desktop database updated successfully");
            } else {
                debug!(
                    "update-desktop-database returned non-zero \
                    (this is normal if the command is not available)"
                );
            }
        }
        Err(e) => {
            debug!(
                "Could not run update-desktop-database: {} (this is normal on some systems)",
                e
            );
        }
    }
}

/// Perform desktop integration for AppImage installations
///
/// This function should be called during app setup. It will:
/// 1. Check if running as AppImage (skip otherwise)
/// 2. Check if integration is already complete
/// 3. Install the icon and create the .desktop file
///
/// # Arguments
/// * `app` - The Tauri AppHandle for accessing resources
pub fn setup_desktop_integration(app: &AppHandle) {
    // Only run for AppImage builds
    if !is_appimage() {
        debug!("Not running as AppImage, skipping desktop integration");
        return;
    }

    let appimage_path = get_appimage_path().unwrap_or_default();
    info!(
        "Running as AppImage: {}, checking desktop integration...",
        appimage_path
    );

    // Check if already integrated (and with correct AppImage path)
    if is_integration_complete() {
        debug!("Desktop integration already complete and up-to-date");
        return;
    }

    info!("Performing desktop integration for AppImage...");

    // Install the icon
    match install_icon(app) {
        Ok(()) => info!("Icon installed successfully"),
        Err(e) => {
            // Continue even if icon fails - the desktop file can still work
            warn!("Failed to install icon: {}", e);
        }
    }

    // Create the desktop file
    match create_desktop_file() {
        Ok(()) => info!("Desktop file created successfully"),
        Err(e) => {
            error!("Failed to create desktop file: {}", e);
            return;
        }
    }

    // Update the desktop database (optional, may fail silently)
    update_desktop_database();

    info!("Desktop integration complete - Voyc should now appear in your application menu");
}

/// Remove desktop integration files
///
/// This can be called during uninstallation or cleanup.
/// Returns true if any files were removed.
#[allow(dead_code)]
pub fn remove_desktop_integration() -> bool {
    let mut removed = false;

    let desktop_file = get_desktop_file_path();
    if desktop_file.exists() {
        if let Err(e) = fs::remove_file(&desktop_file) {
            warn!("Failed to remove desktop file: {}", e);
        } else {
            info!("Removed desktop file: {}", desktop_file.display());
            removed = true;
        }
    }

    let icon_path = get_icon_install_path();
    if icon_path.exists() {
        if let Err(e) = fs::remove_file(&icon_path) {
            warn!("Failed to remove icon: {}", e);
        } else {
            info!("Removed icon: {}", icon_path.display());
            removed = true;
        }
    }

    if removed {
        update_desktop_database();
    }

    removed
}
