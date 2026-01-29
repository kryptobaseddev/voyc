//! Hotkey management for Voyc
//!
//! This module provides global keyboard shortcut management for the application.
//! It automatically detects the display server (X11 vs Wayland) and uses the
//! appropriate backend:
//!
//! - **X11**: Uses tauri_plugin_global_shortcut (traditional key grabbing)
//! - **Wayland**: Uses XDG Desktop Portal GlobalShortcuts (GNOME 48+, KDE Plasma 6+)
//!
//! On Wayland, the API paradigm is different:
//! - Applications register "actions" with descriptions, not specific key combinations
//! - Users configure shortcuts through System Settings
//! - The portal notifies the app when shortcuts are activated

use crate::settings::{get_settings, write_settings};
use log::{debug, error, info, warn};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[cfg(target_os = "linux")]
use crate::wayland_shortcuts::{
    get_display_server_info, is_portal_available, WaylandShortcutManager,
};

/// Backend type for global shortcuts
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ShortcutBackend {
    /// X11/XWayland using traditional key grabbing
    X11,
    /// Wayland using XDG Desktop Portal
    WaylandPortal,
    /// No backend available
    Unavailable,
}

/// Manages global keyboard shortcuts for the application.
///
/// HotkeyManager handles registration, unregistration, and updates of global
/// keyboard shortcuts. It maintains a list of suspended bindings that can be
/// temporarily disabled (e.g., during shortcut re-recording).
///
/// On Linux, it automatically detects Wayland vs X11 and uses the appropriate
/// backend. On Wayland, shortcuts are registered as "actions" with the XDG
/// Desktop Portal, and users configure the actual key combinations in System Settings.
pub struct HotkeyManager {
    app_handle: AppHandle,
    suspended_bindings: Arc<Mutex<Vec<String>>>,
    backend: Arc<Mutex<ShortcutBackend>>,
    #[cfg(target_os = "linux")]
    wayland_manager: Arc<tokio::sync::Mutex<Option<WaylandShortcutManager>>>,
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
            backend: Arc::new(Mutex::new(ShortcutBackend::Unavailable)),
            #[cfg(target_os = "linux")]
            wayland_manager: Arc::new(tokio::sync::Mutex::new(None)),
        }
    }

    /// Detects the appropriate backend for global shortcuts
    #[cfg(target_os = "linux")]
    fn detect_backend(&self) -> ShortcutBackend {
        let info = get_display_server_info();

        if info.is_wayland {
            info!(
                "Detected Wayland session ({}), will use XDG Portal for shortcuts",
                info.desktop_environment.as_deref().unwrap_or("unknown DE")
            );
            ShortcutBackend::WaylandPortal
        } else if info.is_x11 {
            info!("Detected X11 session, will use traditional key grabbing");
            ShortcutBackend::X11
        } else {
            warn!("Could not detect display server, shortcuts may not work");
            ShortcutBackend::Unavailable
        }
    }

    #[cfg(not(target_os = "linux"))]
    fn detect_backend(&self) -> ShortcutBackend {
        // On non-Linux platforms, always use the traditional approach
        ShortcutBackend::X11
    }

    /// Gets the current backend type
    pub fn get_backend(&self) -> ShortcutBackend {
        self.backend
            .lock()
            .map(|b| b.clone())
            .unwrap_or(ShortcutBackend::Unavailable)
    }

    /// Registers all shortcuts from settings.
    ///
    /// This method reads the current application settings and registers
    /// all non-empty shortcut bindings with the global shortcut system.
    ///
    /// On Wayland, this registers actions with the XDG Desktop Portal.
    /// On X11, this registers specific key combinations with the global shortcut plugin.
    ///
    /// # Returns
    ///
    /// * `Ok(())` - At least one shortcut was registered successfully
    /// * `Err(String)` - All shortcut registrations failed
    pub fn register_all(&self) -> Result<(), String> {
        // Log platform detection for debugging hotkey issues
        self.log_platform_info();

        // Detect and store the backend
        let backend = self.detect_backend();
        if let Ok(mut b) = self.backend.lock() {
            *b = backend.clone();
        }

        match backend {
            ShortcutBackend::WaylandPortal => {
                #[cfg(target_os = "linux")]
                {
                    self.register_wayland_shortcuts()
                }
                #[cfg(not(target_os = "linux"))]
                {
                    Err("Wayland portal not available on this platform".to_string())
                }
            }
            ShortcutBackend::X11 => self.register_x11_shortcuts(),
            ShortcutBackend::Unavailable => {
                warn!("No shortcut backend available");
                Err("No shortcut backend available".to_string())
            }
        }
    }

    /// Registers shortcuts using the traditional X11/tauri approach
    fn register_x11_shortcuts(&self) -> Result<(), String> {
        let settings = get_settings(&self.app_handle);

        let mut total_bindings = 0;
        let mut successful_registrations = 0;
        let mut failed_registrations: Vec<String> = Vec::new();

        for (id, binding) in settings.bindings.iter() {
            if !binding.current_binding.is_empty() {
                total_bindings += 1;
                match self.register_shortcut(id, &binding.current_binding) {
                    Ok(()) => {
                        successful_registrations += 1;
                    }
                    Err(e) => {
                        let error_msg = format!(
                            "Failed to register shortcut '{}' for binding '{}': {}",
                            binding.current_binding, id, e
                        );
                        warn!("{}", error_msg);
                        failed_registrations.push(error_msg);
                    }
                }
            }
        }

        // Log summary of registration results
        info!(
            "Shortcut registration complete: {}/{} successful",
            successful_registrations, total_bindings
        );

        // Return error only if ALL registrations failed and there were bindings to register
        if total_bindings > 0 && successful_registrations == 0 {
            let error_summary = format!(
                "All {} shortcut registrations failed. Errors: {}",
                total_bindings,
                failed_registrations.join("; ")
            );
            error!("{}", error_summary);
            return Err(error_summary);
        }

        Ok(())
    }

    /// Registers shortcuts using the Wayland XDG Desktop Portal
    #[cfg(target_os = "linux")]
    fn register_wayland_shortcuts(&self) -> Result<(), String> {
        let app_handle = self.app_handle.clone();
        let wayland_manager = self.wayland_manager.clone();

        // Get the app ID from tauri.conf.json (com.voyc.dictation)
        let app_id = "com.voyc.dictation";

        // Create actions for registration
        let actions = WaylandShortcutManager::get_default_actions();

        // Spawn async task to register with portal
        tauri::async_runtime::spawn(async move {
            // Check if portal is available
            if !is_portal_available().await {
                warn!("XDG GlobalShortcuts portal not available, falling back to X11 behavior");
                // Emit event to frontend about portal unavailability
                let _ = app_handle.emit("shortcut-backend-unavailable", "wayland_portal");
                return;
            }

            let mut manager = WaylandShortcutManager::new(app_handle.clone(), app_id);

            match manager.register_actions(actions).await {
                Ok(()) => {
                    info!("Successfully registered shortcuts with XDG GlobalShortcuts portal");
                    // Store the manager for later use
                    let mut wm = wayland_manager.lock().await;
                    *wm = Some(manager);
                    // Emit success event
                    let _ = app_handle.emit("shortcut-backend-ready", "wayland_portal");
                }
                Err(e) => {
                    error!("Failed to register Wayland shortcuts: {}", e);
                    let _ = app_handle.emit("shortcut-registration-failed", e);
                }
            }
        });

        // Return Ok immediately - actual registration happens asynchronously
        // The frontend will receive events about the outcome
        Ok(())
    }

    /// Logs platform information for debugging hotkey issues.
    fn log_platform_info(&self) {
        // Detect Wayland vs X11 on Linux
        if cfg!(target_os = "linux") {
            #[cfg(target_os = "linux")]
            {
                let info = get_display_server_info();
                info!("Display server: {}", info.description());

                if info.is_wayland {
                    info!("Platform: Linux (Wayland) - using xdg-desktop-portal");
                    info!("Users configure shortcuts in System Settings > Applications");
                    if let Ok(session_type) = std::env::var("XDG_SESSION_TYPE") {
                        debug!("XDG_SESSION_TYPE: {}", session_type);
                    }
                } else if info.is_x11 {
                    info!("Platform: Linux (X11) - using XRecord for global shortcuts");
                } else {
                    warn!("Platform: Linux (unknown display server) - hotkeys may not work");
                }
            }
        } else if cfg!(target_os = "macos") {
            info!("Platform: macOS - using CGEventTap for global shortcuts");
        } else if cfg!(target_os = "windows") {
            info!("Platform: Windows - using RegisterHotKey for global shortcuts");
        } else {
            info!("Platform: unknown - hotkey support may be limited");
        }
    }

    /// Registers a single shortcut (X11 only).
    ///
    /// Parses the shortcut string and registers it with the global shortcut
    /// system. When the shortcut is pressed or released, events are emitted
    /// to the frontend.
    ///
    /// Note: On Wayland, this method is not used. Use `register_all()` instead,
    /// which will register actions with the XDG Desktop Portal.
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

    /// Unregisters a shortcut (X11 only).
    ///
    /// Removes the shortcut from the global shortcut system so it no longer
    /// triggers events.
    ///
    /// Note: On Wayland, shortcut management is handled by the desktop environment.
    /// Users can change or remove shortcuts in System Settings.
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
        // On Wayland, we don't directly unregister - the portal handles this
        if self.get_backend() == ShortcutBackend::WaylandPortal {
            debug!(
                "Skipping unregister on Wayland (managed by portal): {}",
                shortcut_str
            );
            return Ok(());
        }

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
    /// Note: On Wayland, this method updates the stored preference but users
    /// must configure the actual shortcuts in System Settings.
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

        // Register new shortcut (X11 only - Wayland uses portal)
        if self.get_backend() != ShortcutBackend::WaylandPortal && !new_shortcut.is_empty() {
            self.register_shortcut(id, new_shortcut)?;
        }

        info!("Updated binding '{}' to '{}'", id, new_shortcut);

        // On Wayland, notify user that they need to update System Settings
        if self.get_backend() == ShortcutBackend::WaylandPortal {
            info!(
                "Note: On Wayland, users configure actual shortcuts in System Settings"
            );
        }

        Ok(())
    }

    /// Suspends a binding (for re-recording).
    ///
    /// This method temporarily unregisters a shortcut without changing the
    /// settings. This is useful when the user wants to record a new shortcut
    /// and the existing one would interfere.
    ///
    /// Note: On Wayland, shortcuts cannot be suspended as they're managed by the portal.
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
        // On Wayland, we can't suspend shortcuts directly
        if self.get_backend() == ShortcutBackend::WaylandPortal {
            debug!("Suspend not supported on Wayland portal backend");
            // Still track it for consistency
            let mut suspended = self
                .suspended_bindings
                .lock()
                .map_err(|e| format!("Failed to lock suspended bindings: {}", e))?;
            if !suspended.contains(&id.to_string()) {
                suspended.push(id.to_string());
            }
            return Ok(());
        }

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

        // On Wayland, just remove from suspended list
        if self.get_backend() == ShortcutBackend::WaylandPortal {
            let mut suspended = self
                .suspended_bindings
                .lock()
                .map_err(|e| format!("Failed to lock suspended bindings: {}", e))?;
            suspended.retain(|b| b != id);
            return Ok(());
        }

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

    /// Opens the system settings for configuring shortcuts (Wayland only).
    ///
    /// On GNOME, this opens Settings > Applications
    /// On KDE, this opens System Settings > Shortcuts
    ///
    /// # Returns
    ///
    /// * `Ok(())` - Settings were opened successfully
    /// * `Err(String)` - Failed to open settings
    #[cfg(target_os = "linux")]
    pub fn open_shortcut_settings(&self) -> Result<(), String> {
        // Try GNOME Settings first
        if std::process::Command::new("gnome-control-center")
            .args(["applications"])
            .spawn()
            .is_ok()
        {
            return Ok(());
        }

        // Try KDE System Settings
        if std::process::Command::new("systemsettings")
            .args(["kcm_kglobalaccel"])
            .spawn()
            .is_ok()
        {
            return Ok(());
        }

        // Generic fallback
        if std::process::Command::new("xdg-open")
            .args(["gnome-control-center"])
            .spawn()
            .is_ok()
        {
            return Ok(());
        }

        Err("Could not open system settings".to_string())
    }

    #[cfg(not(target_os = "linux"))]
    pub fn open_shortcut_settings(&self) -> Result<(), String> {
        Err("Opening system settings is only supported on Linux".to_string())
    }

    /// Returns information about the shortcut backend and configuration
    pub fn get_shortcut_info(&self) -> ShortcutInfo {
        let backend = self.get_backend();

        #[cfg(target_os = "linux")]
        let display_server = {
            let info = get_display_server_info();
            Some(info.description())
        };

        #[cfg(not(target_os = "linux"))]
        let display_server: Option<String> = None;

        ShortcutInfo {
            backend: backend.clone(),
            requires_system_settings: backend == ShortcutBackend::WaylandPortal,
            platform: std::env::consts::OS.to_string(),
            display_server,
        }
    }
}

/// Information about the shortcut configuration
#[derive(Debug, Clone)]
pub struct ShortcutInfo {
    /// The backend being used for shortcuts
    pub backend: ShortcutBackend,
    /// Whether shortcuts must be configured in system settings
    pub requires_system_settings: bool,
    /// The platform (linux, macos, windows)
    pub platform: String,
    /// Display server description (Linux only)
    pub display_server: Option<String>,
}
