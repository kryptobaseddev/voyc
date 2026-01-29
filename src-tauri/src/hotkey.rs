//! Hotkey management for Voyc
//!
//! This module provides global keyboard shortcut management for the application.
//! It wraps the tauri_plugin_global_shortcut plugin and integrates with the
//! settings system to persist shortcut bindings.

use crate::settings::{get_settings, write_settings};
use log::{debug, error, info, warn};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Manages global keyboard shortcuts for the application.
///
/// HotkeyManager handles registration, unregistration, and updates of global
/// keyboard shortcuts. It maintains a list of suspended bindings that can be
/// temporarily disabled (e.g., during shortcut re-recording).
pub struct HotkeyManager {
    app_handle: AppHandle,
    suspended_bindings: Arc<Mutex<Vec<String>>>,
}

impl HotkeyManager {
    /// Creates a new HotkeyManager instance.
    ///
    /// # Arguments
    ///
    /// * `app_handle` - The Tauri application handle used for event emission
    ///                  and accessing the global shortcut plugin.
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            suspended_bindings: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Registers all shortcuts from settings.
    ///
    /// This method reads the current application settings and registers
    /// all non-empty shortcut bindings with the global shortcut system.
    ///
    /// # Returns
    ///
    /// * `Ok(())` - All shortcuts were registered successfully
    /// * `Err(String)` - An error occurred during registration
    pub fn register_all(&self) -> Result<(), String> {
        let settings = get_settings(&self.app_handle);

        for (id, binding) in settings.bindings.iter() {
            if !binding.current_binding.is_empty() {
                if let Err(e) = self.register_shortcut(id, &binding.current_binding) {
                    warn!(
                        "Failed to register shortcut '{}' for binding '{}': {}",
                        binding.current_binding, id, e
                    );
                }
            }
        }

        info!("All shortcuts registered from settings");
        Ok(())
    }

    /// Registers a single shortcut.
    ///
    /// Parses the shortcut string and registers it with the global shortcut
    /// system. When the shortcut is pressed or released, events are emitted
    /// to the frontend.
    ///
    /// # Arguments
    ///
    /// * `id` - The binding identifier (e.g., "transcribe", "cancel")
    /// * `shortcut_str` - The shortcut string (e.g., "ctrl+space", "escape")
    ///
    /// # Returns
    ///
    /// * `Ok(())` - The shortcut was registered successfully
    /// * `Err(String)` - The shortcut string was invalid or registration failed
    pub fn register_shortcut(&self, id: &str, shortcut_str: &str) -> Result<(), String> {
        let shortcut: Shortcut = shortcut_str
            .parse()
            .map_err(|e| format!("Invalid shortcut '{}': {:?}", shortcut_str, e))?;

        let binding_id = id.to_string();

        self.app_handle
            .global_shortcut()
            .on_shortcut(shortcut, move |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    debug!("Shortcut pressed: {}", binding_id);
                    if let Err(e) = app.emit("shortcut-pressed", &binding_id) {
                        error!("Failed to emit shortcut-pressed event: {}", e);
                    }
                } else if event.state == ShortcutState::Released {
                    debug!("Shortcut released: {}", binding_id);
                    if let Err(e) = app.emit("shortcut-released", &binding_id) {
                        error!("Failed to emit shortcut-released event: {}", e);
                    }
                }
            })
            .map_err(|e| format!("Failed to register shortcut: {}", e))?;

        info!(
            "Registered shortcut '{}' for binding '{}'",
            shortcut_str, id
        );
        Ok(())
    }

    /// Unregisters a shortcut.
    ///
    /// Removes the shortcut from the global shortcut system so it no longer
    /// triggers events.
    ///
    /// # Arguments
    ///
    /// * `shortcut_str` - The shortcut string to unregister
    ///
    /// # Returns
    ///
    /// * `Ok(())` - The shortcut was unregistered successfully
    /// * `Err(String)` - The shortcut string was invalid or unregistration failed
    pub fn unregister_shortcut(&self, shortcut_str: &str) -> Result<(), String> {
        let shortcut: Shortcut = shortcut_str
            .parse()
            .map_err(|e| format!("Invalid shortcut '{}': {:?}", shortcut_str, e))?;

        self.app_handle
            .global_shortcut()
            .unregister(shortcut)
            .map_err(|e| format!("Failed to unregister shortcut: {}", e))?;

        debug!("Unregistered shortcut '{}'", shortcut_str);
        Ok(())
    }

    /// Updates a binding's shortcut.
    ///
    /// This method unregisters the old shortcut (if any), updates the settings,
    /// and registers the new shortcut. The settings are persisted to storage.
    ///
    /// # Arguments
    ///
    /// * `id` - The binding identifier to update
    /// * `new_shortcut` - The new shortcut string (can be empty to disable)
    ///
    /// # Returns
    ///
    /// * `Ok(())` - The binding was updated successfully
    /// * `Err(String)` - An error occurred during the update
    pub fn update_binding(&self, id: &str, new_shortcut: &str) -> Result<(), String> {
        let mut settings = get_settings(&self.app_handle);

        // Get old shortcut to unregister
        if let Some(binding) = settings.bindings.get(id) {
            if !binding.current_binding.is_empty() {
                if let Err(e) = self.unregister_shortcut(&binding.current_binding) {
                    warn!("Failed to unregister old shortcut: {}", e);
                    // Continue anyway - the old shortcut might not be registered
                }
            }
        } else {
            return Err(format!("Unknown binding id: {}", id));
        }

        // Update settings
        if let Some(binding) = settings.bindings.get_mut(id) {
            binding.current_binding = new_shortcut.to_string();
        }
        write_settings(&self.app_handle, settings);

        // Register new shortcut
        if !new_shortcut.is_empty() {
            self.register_shortcut(id, new_shortcut)?;
        }

        info!("Updated binding '{}' to '{}'", id, new_shortcut);
        Ok(())
    }

    /// Suspends a binding (for re-recording).
    ///
    /// This method temporarily unregisters a shortcut without changing the
    /// settings. This is useful when the user wants to record a new shortcut
    /// and the existing one would interfere.
    ///
    /// # Arguments
    ///
    /// * `id` - The binding identifier to suspend
    ///
    /// # Returns
    ///
    /// * `Ok(())` - The binding was suspended successfully
    /// * `Err(String)` - An error occurred during suspension
    pub fn suspend_binding(&self, id: &str) -> Result<(), String> {
        let settings = get_settings(&self.app_handle);

        if let Some(binding) = settings.bindings.get(id) {
            if !binding.current_binding.is_empty() {
                self.unregister_shortcut(&binding.current_binding)?;

                let mut suspended = self
                    .suspended_bindings
                    .lock()
                    .map_err(|e| format!("Failed to lock suspended bindings: {}", e))?;

                if !suspended.contains(&id.to_string()) {
                    suspended.push(id.to_string());
                }

                info!("Suspended binding '{}'", id);
            }
        } else {
            return Err(format!("Unknown binding id: {}", id));
        }

        Ok(())
    }

    /// Resumes a suspended binding.
    ///
    /// This method re-registers a shortcut that was previously suspended.
    /// The shortcut string is read from the current settings.
    ///
    /// # Arguments
    ///
    /// * `id` - The binding identifier to resume
    ///
    /// # Returns
    ///
    /// * `Ok(())` - The binding was resumed successfully
    /// * `Err(String)` - An error occurred during resumption
    pub fn resume_binding(&self, id: &str) -> Result<(), String> {
        let settings = get_settings(&self.app_handle);

        if let Some(binding) = settings.bindings.get(id) {
            if !binding.current_binding.is_empty() {
                self.register_shortcut(id, &binding.current_binding)?;
            }
        } else {
            return Err(format!("Unknown binding id: {}", id));
        }

        let mut suspended = self
            .suspended_bindings
            .lock()
            .map_err(|e| format!("Failed to lock suspended bindings: {}", e))?;

        suspended.retain(|b| b != id);
        info!("Resumed binding '{}'", id);

        Ok(())
    }

    /// Checks if a binding is currently suspended.
    ///
    /// # Arguments
    ///
    /// * `id` - The binding identifier to check
    ///
    /// # Returns
    ///
    /// * `true` if the binding is suspended
    /// * `false` if the binding is active or doesn't exist
    pub fn is_suspended(&self, id: &str) -> bool {
        self.suspended_bindings
            .lock()
            .map(|suspended| suspended.contains(&id.to_string()))
            .unwrap_or(false)
    }
}
