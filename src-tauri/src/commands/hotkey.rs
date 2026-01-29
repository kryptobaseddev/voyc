//! Hotkey commands for Tauri frontend
//!
//! This module exposes the HotkeyManager functionality to the frontend
//! through Tauri commands. All commands are type-safe with specta bindings.

use crate::hotkey::HotkeyManager;
use std::sync::Arc;
use tauri::State;

/// Updates a binding's shortcut.
///
/// This command unregisters the old shortcut, updates the settings,
/// and registers the new shortcut.
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
