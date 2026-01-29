//! Hotkey commands for Tauri frontend
//!
//! This module exposes the HotkeyManager functionality to the frontend
//! through Tauri commands. All commands are type-safe with specta bindings.
//!
//! On Wayland, shortcuts are managed differently:
//! - Applications register "actions" with descriptions
//! - Users configure actual key combinations in System Settings
//! - The `get_shortcut_backend_info` command tells the frontend which mode is active

use crate::hotkey::{HotkeyManager, ShortcutBackend};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::Arc;
use tauri::State;

/// Information about the shortcut backend for the frontend
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ShortcutBackendInfo {
    /// The backend being used: "x11", "wayland_portal", or "unavailable"
    pub backend: String,
    /// Whether shortcuts must be configured in system settings (true for Wayland)
    pub requires_system_settings: bool,
    /// The current platform
    pub platform: String,
    /// Display server description (Linux only)
    pub display_server: Option<String>,
    /// Human-readable message about the shortcut configuration
    pub message: String,
}

/// Updates a binding's shortcut.
///
/// This command unregisters the old shortcut, updates the settings,
/// and registers the new shortcut.
///
/// Note: On Wayland, this updates the stored preference but users must
/// configure the actual shortcuts in System Settings.
///
/// # Arguments
///
/// * `binding_id` - The binding identifier (e.g., "transcribe", "cancel")
/// * `new_binding` - The new shortcut string (e.g., "ctrl+space", "escape")
///
/// # Returns
///
/// * `Ok(())` - The binding was updated successfully
/// * `Err(String)` - An error occurred during the update
#[tauri::command]
#[specta::specta]
pub fn update_binding(
    hotkey_manager: State<Arc<HotkeyManager>>,
    binding_id: String,
    new_binding: String,
) -> Result<(), String> {
    hotkey_manager.update_binding(&binding_id, &new_binding)
}

/// Suspends a binding temporarily.
///
/// This is useful when the user wants to record a new shortcut and the
/// existing shortcut would interfere with the recording process.
///
/// Note: On Wayland, shortcuts cannot be suspended as they're managed by the portal.
/// This command still tracks the suspension state for UI consistency.
///
/// # Arguments
///
/// * `binding_id` - The binding identifier to suspend
///
/// # Returns
///
/// * `Ok(())` - The binding was suspended successfully
/// * `Err(String)` - An error occurred during suspension
#[tauri::command]
#[specta::specta]
pub fn suspend_binding(
    hotkey_manager: State<Arc<HotkeyManager>>,
    binding_id: String,
) -> Result<(), String> {
    hotkey_manager.suspend_binding(&binding_id)
}

/// Resumes a suspended binding.
///
/// This re-registers the shortcut that was previously suspended.
///
/// # Arguments
///
/// * `binding_id` - The binding identifier to resume
///
/// # Returns
///
/// * `Ok(())` - The binding was resumed successfully
/// * `Err(String)` - An error occurred during resumption
#[tauri::command]
#[specta::specta]
pub fn resume_binding(
    hotkey_manager: State<Arc<HotkeyManager>>,
    binding_id: String,
) -> Result<(), String> {
    hotkey_manager.resume_binding(&binding_id)
}

/// Registers all shortcuts from settings.
///
/// This command reads the current application settings and registers
/// all non-empty shortcut bindings with the global shortcut system.
/// It is typically called during application initialization.
///
/// On Wayland, this registers actions with the XDG Desktop Portal.
/// On X11, this registers specific key combinations.
///
/// # Returns
///
/// * `Ok(())` - All shortcuts were registered successfully
/// * `Err(String)` - An error occurred during registration
#[tauri::command]
#[specta::specta]
pub fn register_all_shortcuts(hotkey_manager: State<Arc<HotkeyManager>>) -> Result<(), String> {
    hotkey_manager.register_all()
}

/// Checks if a binding is currently suspended.
///
/// # Arguments
///
/// * `binding_id` - The binding identifier to check
///
/// # Returns
///
/// * `true` if the binding is suspended
/// * `false` if the binding is active or doesn't exist
#[tauri::command]
#[specta::specta]
pub fn is_binding_suspended(hotkey_manager: State<Arc<HotkeyManager>>, binding_id: String) -> bool {
    hotkey_manager.is_suspended(&binding_id)
}

/// Gets information about the shortcut backend.
///
/// This tells the frontend whether shortcuts are configured via:
/// - X11: Traditional key grabbing (user sets shortcuts in the app)
/// - Wayland Portal: XDG Desktop Portal (user sets shortcuts in System Settings)
///
/// # Returns
///
/// Information about the current shortcut backend
#[tauri::command]
#[specta::specta]
pub fn get_shortcut_backend_info(hotkey_manager: State<Arc<HotkeyManager>>) -> ShortcutBackendInfo {
    let info = hotkey_manager.get_shortcut_info();

    let backend_str = match info.backend {
        ShortcutBackend::X11 => "x11",
        ShortcutBackend::WaylandPortal => "wayland_portal",
        ShortcutBackend::Unavailable => "unavailable",
    };

    let message = if info.requires_system_settings {
        "On Wayland, keyboard shortcuts are configured in System Settings. \
         Go to Settings > Applications > Voyc to set your preferred shortcuts."
            .to_string()
    } else {
        "Click on a shortcut to record a new key combination.".to_string()
    };

    ShortcutBackendInfo {
        backend: backend_str.to_string(),
        requires_system_settings: info.requires_system_settings,
        platform: info.platform,
        display_server: info.display_server,
        message,
    }
}

/// Opens the system settings for configuring shortcuts.
///
/// On GNOME, this opens Settings > Applications
/// On KDE, this opens System Settings > Shortcuts
///
/// This is primarily useful on Wayland where shortcuts must be configured
/// in System Settings rather than in the app.
///
/// # Returns
///
/// * `Ok(())` - Settings were opened successfully
/// * `Err(String)` - Failed to open settings or not on Linux
#[tauri::command]
#[specta::specta]
pub fn open_shortcut_settings(hotkey_manager: State<Arc<HotkeyManager>>) -> Result<(), String> {
    hotkey_manager.open_shortcut_settings()
}
