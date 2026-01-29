//! Wayland Global Shortcuts via XDG Desktop Portal
//!
//! This module provides global keyboard shortcut support on Wayland desktops
//! (GNOME 48+, KDE Plasma 6+) using the XDG Desktop Portal GlobalShortcuts interface.
//!
//! On Wayland, the paradigm is different from X11:
//! - Applications register "actions" with descriptions, not specific key combinations
//! - Users configure shortcuts through System Settings
//! - The portal notifies the app when shortcuts are activated

use ashpd::desktop::global_shortcuts::{GlobalShortcuts, NewShortcut};
use ashpd::WindowIdentifier;
use log::{debug, error, info, warn};
use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use serde_json;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::RwLock;

/// Action definition for Wayland global shortcuts
#[derive(Debug, Clone)]
pub struct ShortcutAction {
    /// Unique identifier for the action (e.g., "transcribe", "cancel")
    pub id: String,
    /// Human-readable description shown to users in System Settings
    pub description: String,
    /// Preferred trigger (suggestion only - user may override)
    pub preferred_trigger: Option<String>,
}

/// State of the Wayland shortcuts session
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SessionState {
    /// Not connected to portal
    Disconnected,
    /// Connecting to portal
    Connecting,
    /// Connected and shortcuts registered
    Connected,
    /// Portal not available (fallback to X11/XWayland)
    Unavailable,
    /// Error state
    Error(String),
}

/// Extracted window handles that can be sent across threads
/// We store the handle type info rather than raw pointers
#[derive(Debug, Clone)]
pub struct WindowHandleInfo {
    /// For X11: the window XID
    pub x11_xid: Option<u32>,
    /// For Wayland: we can't easily extract - will need to use None
    pub is_wayland: bool,
}

impl WindowHandleInfo {
    /// Extract window handle info from the app handle
    /// This must be called on the main thread before spawning async tasks
    pub fn from_app_handle(app_handle: &AppHandle) -> Option<Self> {
        let window = app_handle.get_webview_window("main")?;

        let window_handle = window.window_handle().ok()?;
        let raw_window = window_handle.as_raw();

        match raw_window {
            RawWindowHandle::Xlib(handle) => Some(WindowHandleInfo {
                x11_xid: Some(handle.window as u32),
                is_wayland: false,
            }),
            RawWindowHandle::Xcb(handle) => Some(WindowHandleInfo {
                x11_xid: Some(handle.window.get()),
                is_wayland: false,
            }),
            RawWindowHandle::Wayland(_) => {
                // On Wayland, we can't easily extract the handle in a Send-safe way
                // The portal will need to work without a window identifier
                Some(WindowHandleInfo {
                    x11_xid: None,
                    is_wayland: true,
                })
            }
            _ => None,
        }
    }

    /// Create a WindowIdentifier from the stored info
    pub fn to_window_identifier(&self) -> Option<WindowIdentifier> {
        if let Some(xid) = self.x11_xid {
            // For X11, we can create the identifier directly
            Some(WindowIdentifier::from_xid(xid as std::ffi::c_ulong))
        } else {
            // For Wayland or unknown, return None
            // The portal should still work, it just won't have a parent window
            None
        }
    }
}

/// Manager for Wayland global shortcuts via XDG Desktop Portal
pub struct WaylandShortcutManager {
    app_handle: AppHandle,
    #[allow(dead_code)]
    app_id: String,
    session_state: Arc<RwLock<SessionState>>,
    registered_shortcuts: Arc<RwLock<HashMap<String, ShortcutAction>>>,
    current_bindings: Arc<RwLock<HashMap<String, String>>>,
    window_handle_info: Option<WindowHandleInfo>,
}

impl WaylandShortcutManager {
    /// Creates a new WaylandShortcutManager
    ///
    /// # Arguments
    /// * `app_handle` - Tauri application handle for event emission
    /// * `app_id` - Application ID (e.g., "com.voyc.dictation")
    pub fn new(app_handle: AppHandle, app_id: &str) -> Self {
        // Extract window handle info on creation (must be on main thread)
        let window_handle_info = WindowHandleInfo::from_app_handle(&app_handle);

        if let Some(ref info) = window_handle_info {
            if info.is_wayland {
                debug!("WaylandShortcutManager: Running on Wayland, window identifier limited");
            } else if info.x11_xid.is_some() {
                debug!("WaylandShortcutManager: Got X11 window ID for portal");
            }
        } else {
            warn!("WaylandShortcutManager: No window handle available");
        }

        Self {
            app_handle,
            app_id: app_id.to_string(),
            session_state: Arc::new(RwLock::new(SessionState::Disconnected)),
            registered_shortcuts: Arc::new(RwLock::new(HashMap::new())),
            current_bindings: Arc::new(RwLock::new(HashMap::new())),
            window_handle_info,
        }
    }

    /// Checks if we're running on Wayland
    pub fn is_wayland() -> bool {
        cfg!(target_os = "linux") && std::env::var("WAYLAND_DISPLAY").is_ok()
    }

    /// Gets the current session state
    pub async fn get_session_state(&self) -> SessionState {
        self.session_state.read().await.clone()
    }

    /// Gets the current shortcut bindings as configured by the user
    pub async fn get_current_bindings(&self) -> HashMap<String, String> {
        self.current_bindings.read().await.clone()
    }

    /// Registers shortcut actions with the XDG Desktop Portal
    pub async fn register_actions(&mut self, actions: Vec<ShortcutAction>) -> Result<(), String> {
        if !Self::is_wayland() {
            return Err("Not running on Wayland".to_string());
        }

        // Update state to connecting
        *self.session_state.write().await = SessionState::Connecting;

        info!(
            "Registering {} shortcut actions with XDG GlobalShortcuts portal",
            actions.len()
        );

        // Create the GlobalShortcuts proxy
        let proxy = match GlobalShortcuts::new().await {
            Ok(p) => p,
            Err(e) => {
                let msg = format!("Failed to connect to GlobalShortcuts portal: {}", e);
                error!("{}", msg);
                *self.session_state.write().await = SessionState::Unavailable;
                return Err(msg);
            }
        };

        // Create a session
        let session = match proxy.create_session().await {
            Ok(s) => s,
            Err(e) => {
                let msg = format!("Failed to create GlobalShortcuts session: {}", e);
                error!("{}", msg);
                *self.session_state.write().await = SessionState::Error(msg.clone());
                return Err(msg);
            }
        };

        // Build the shortcuts to register
        let shortcuts: Vec<NewShortcut> = actions
            .iter()
            .map(|action| {
                let mut shortcut = NewShortcut::new(&action.id, &action.description);
                if let Some(ref trigger) = action.preferred_trigger {
                    shortcut = shortcut.preferred_trigger(trigger.as_str());
                }
                shortcut
            })
            .collect();

        // Get the WindowIdentifier if available
        // On pure Wayland this will be None, which should still work
        // The portal may not show a permission dialog but shortcuts may still register
        let window_identifier = self
            .window_handle_info
            .as_ref()
            .and_then(|info| info.to_window_identifier());

        if window_identifier.is_some() {
            info!("Using window identifier for portal shortcut registration");
        } else {
            info!("No window identifier available - portal will register without parent window");
            info!(
                "Note: On Wayland, shortcuts may need to be configured in System Settings > Keyboard > Shortcuts"
            );
        }

        // Bind shortcuts with the window identifier (if available)
        match proxy
            .bind_shortcuts(&session, &shortcuts, window_identifier.as_ref())
            .await
        {
            Ok(request) => match request.response() {
                Ok(response) => {
                    // Successfully bound - extract the registered shortcuts
                    let mut bindings = self.current_bindings.write().await;
                    bindings.clear();

                    for shortcut in response.shortcuts() {
                        let id = shortcut.id().to_string();
                        let trigger = shortcut.trigger_description().to_string();
                        info!("Shortcut '{}' registered with trigger: {}", id, trigger);
                        bindings.insert(id, trigger);
                    }

                    info!(
                        "Successfully registered {} shortcuts via portal",
                        bindings.len()
                    );
                }
                Err(e) => {
                    // Response error - might be user cancelled or other issue
                    warn!("bind_shortcuts response error: {}", e);
                    warn!("This may indicate the portal requires user configuration");
                    warn!(
                        "Try: System Settings > Keyboard > Shortcuts > Custom > Add Voyc shortcuts"
                    );
                }
            },
            Err(e) => {
                warn!("bind_shortcuts request error: {}", e);
            }
        }

        // Verify by listing shortcuts (in case bind had issues but shortcuts exist)
        match proxy.list_shortcuts(&session).await {
            Ok(request) => match request.response() {
                Ok(list_response) => {
                    let mut bindings = self.current_bindings.write().await;
                    let listed_count = list_response.shortcuts().len();

                    // Only update if we got results
                    if listed_count > 0 || bindings.is_empty() {
                        bindings.clear();
                        for shortcut in list_response.shortcuts() {
                            let id = shortcut.id().to_string();
                            let trigger = shortcut.trigger_description().to_string();
                            debug!("Listed shortcut '{}' bound to '{}'", id, trigger);
                            bindings.insert(id, trigger);
                        }
                    }

                    if listed_count > 0 {
                        info!("Verified {} shortcuts registered via portal", listed_count);
                        // Emit success event with shortcut info
                        let _ = self.app_handle.emit("shortcuts-configured", listed_count);
                    } else {
                        warn!("No shortcuts currently configured via portal");
                        warn!(
                            "Users need to configure shortcuts in GNOME Settings > Keyboard > Shortcuts"
                        );
                        // Emit event to frontend that shortcuts need configuration
                        let _ = self.app_handle.emit(
                            "shortcuts-need-configuration",
                            serde_json::json!({
                                "message": "Global shortcuts are not configured",
                                "instructions": "Open System Settings > Keyboard > Keyboard Shortcuts > Custom Shortcuts and add shortcuts for Voyc",
                                "actions": ["transcribe", "cancel"]
                            }),
                        );
                    }
                }
                Err(e) => {
                    warn!("Failed to get list_shortcuts response: {}", e);
                }
            },
            Err(e) => {
                warn!("Failed to list shortcuts: {}", e);
            }
        }

        // Store registered actions
        {
            let mut registered = self.registered_shortcuts.write().await;
            registered.clear();
            for action in actions {
                registered.insert(action.id.clone(), action);
            }
        }

        // Set up event listeners
        let app_handle = self.app_handle.clone();
        let state = self.session_state.clone();

        // Spawn task to listen for portal events
        tokio::spawn(async move {
            // Listen for activated signals
            let activated_stream = match proxy.receive_activated().await {
                Ok(stream) => stream,
                Err(e) => {
                    error!("Failed to listen for activated events: {}", e);
                    return;
                }
            };

            // Listen for deactivated signals
            let deactivated_stream = match proxy.receive_deactivated().await {
                Ok(stream) => stream,
                Err(e) => {
                    error!("Failed to listen for deactivated events: {}", e);
                    return;
                }
            };

            // Listen for shortcuts changed signals
            let changed_stream = match proxy.receive_shortcuts_changed().await {
                Ok(stream) => stream,
                Err(e) => {
                    error!("Failed to listen for shortcuts changed events: {}", e);
                    return;
                }
            };

            use futures_util::StreamExt;

            let mut activated_stream = std::pin::pin!(activated_stream);
            let mut deactivated_stream = std::pin::pin!(deactivated_stream);
            let mut changed_stream = std::pin::pin!(changed_stream);

            info!("Listening for portal shortcut events...");

            loop {
                tokio::select! {
                    Some(event) = activated_stream.next() => {
                        let shortcut_id = event.shortcut_id().to_string();
                        let timestamp = event.timestamp().as_millis();
                        info!(
                            "Wayland shortcut activated: {} at {}ms",
                            shortcut_id, timestamp
                        );

                        // Emit to frontend
                        if let Err(e) = app_handle.emit("shortcut-pressed", &shortcut_id) {
                            error!("Failed to emit shortcut-pressed event: {}", e);
                        }
                    }
                    Some(event) = deactivated_stream.next() => {
                        let shortcut_id = event.shortcut_id().to_string();
                        let timestamp = event.timestamp().as_millis();
                        debug!(
                            "Wayland shortcut deactivated: {} at {}ms",
                            shortcut_id, timestamp
                        );

                        // Emit to frontend
                        if let Err(e) = app_handle.emit("shortcut-released", &shortcut_id) {
                            error!("Failed to emit shortcut-released event: {}", e);
                        }
                    }
                    Some(_) = changed_stream.next() => {
                        info!("User changed shortcut configuration via System Settings");
                        // Emit shortcuts changed event
                        if let Err(e) = app_handle.emit("shortcuts-changed", ()) {
                            error!("Failed to emit shortcuts-changed event: {}", e);
                        }
                    }
                    else => {
                        warn!("Portal event streams ended");
                        break;
                    }
                }
            }

            // Session ended
            *state.write().await = SessionState::Disconnected;
        });

        // Update state to connected
        *self.session_state.write().await = SessionState::Connected;

        Ok(())
    }

    /// Gets the default actions for Voyc
    pub fn get_default_actions() -> Vec<ShortcutAction> {
        vec![
            ShortcutAction {
                id: "transcribe".to_string(),
                description: "Start voice dictation - hold to record, release to transcribe"
                    .to_string(),
                preferred_trigger: Some("CTRL+SPACE".to_string()),
            },
            ShortcutAction {
                id: "cancel".to_string(),
                description: "Cancel the current recording".to_string(),
                preferred_trigger: Some("Escape".to_string()),
            },
        ]
    }
}

/// Check if GlobalShortcuts portal is available
pub async fn is_portal_available() -> bool {
    if !WaylandShortcutManager::is_wayland() {
        return false;
    }

    match GlobalShortcuts::new().await {
        Ok(_) => {
            info!("XDG GlobalShortcuts portal is available");
            true
        }
        Err(e) => {
            debug!("XDG GlobalShortcuts portal not available: {}", e);
            false
        }
    }
}

/// Get information about the current display server
pub fn get_display_server_info() -> DisplayServerInfo {
    let is_wayland = std::env::var("WAYLAND_DISPLAY").is_ok();
    let is_x11 = std::env::var("DISPLAY").is_ok();
    let session_type = std::env::var("XDG_SESSION_TYPE").ok();
    let desktop = std::env::var("XDG_CURRENT_DESKTOP").ok();

    DisplayServerInfo {
        is_wayland,
        is_x11,
        session_type,
        desktop_environment: desktop,
    }
}

/// Information about the current display server
#[derive(Debug, Clone)]
pub struct DisplayServerInfo {
    pub is_wayland: bool,
    pub is_x11: bool,
    pub session_type: Option<String>,
    pub desktop_environment: Option<String>,
}

impl DisplayServerInfo {
    /// Returns a user-friendly description of the display server
    pub fn description(&self) -> String {
        let server = if self.is_wayland {
            "Wayland"
        } else if self.is_x11 {
            "X11"
        } else {
            "Unknown"
        };

        let desktop = self
            .desktop_environment
            .as_ref()
            .map(|d| d.as_str())
            .unwrap_or("Unknown");

        format!("{} on {}", server, desktop)
    }

    /// Returns whether global shortcuts require portal (Wayland)
    pub fn requires_portal(&self) -> bool {
        self.is_wayland
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_display_server_detection() {
        let info = get_display_server_info();
        // Just verify it doesn't panic
        let _ = info.description();
        let _ = info.requires_portal();
    }

    #[test]
    fn test_default_actions() {
        let actions = WaylandShortcutManager::get_default_actions();
        assert_eq!(actions.len(), 2);
        assert_eq!(actions[0].id, "transcribe");
        assert_eq!(actions[1].id, "cancel");
    }
}
