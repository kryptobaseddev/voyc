//! Text injection module for Wayland-safe text delivery
//!
//! @task T027
//! @epic T026
//!
//! This module implements Wayland-safe text injection using a clipboard + paste
//! simulation strategy. It copies text to the clipboard and then simulates a
//! paste keystroke using ydotool (preferred) or wtype (fallback).

use log::{debug, error, info, warn};
use std::process::Command;
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

/// Known terminal window class names for detection.
/// Terminals typically require Ctrl+Shift+V instead of Ctrl+V for paste.
///
/// @task T027
/// @epic T026
const TERMINAL_CLASSES: &[&str] = &[
    "gnome-terminal",
    "gnome-terminal-server",
    "konsole",
    "alacritty",
    "kitty",
    "foot",
    "wezterm",
    "tilix",
    "xfce4-terminal",
    "terminator",
    "st",
    "rio",
    "blackbox",
    "ptyxis",
    "kgx", // GNOME Console
];

/// Result of a text injection attempt.
///
/// @task T027
/// @epic T026
#[derive(Debug, Clone, PartialEq)]
pub enum InjectionResult {
    /// Successfully injected text using ydotool
    SuccessYdotool,
    /// Successfully injected text using wtype
    SuccessWtype,
    /// Text copied to clipboard but no paste tool available (user must paste manually)
    ClipboardOnly,
    /// Injection failed completely
    Failed(String),
}

/// Inject text into the currently focused application.
///
/// Strategy:
/// 1. Copy text to clipboard using Tauri's clipboard plugin
/// 2. Detect if the focused window is a terminal (for Ctrl+Shift+V)
/// 3. Simulate paste keystroke using ydotool or wtype
/// 4. If no paste tool available, leave text in clipboard for manual paste
///
/// @task T027
/// @epic T026
///
/// # Arguments
/// * `app` - Tauri AppHandle for clipboard access
/// * `text` - Text to inject into the focused application
///
/// # Returns
/// * `InjectionResult` indicating success method or failure
pub fn inject_text(app: &AppHandle, text: &str) -> InjectionResult {
    info!("Starting text injection ({} chars)", text.len());

    // Step 1: Copy text to clipboard
    if let Err(e) = app.clipboard().write_text(text) {
        error!("Failed to copy text to clipboard: {}", e);
        return InjectionResult::Failed(format!("Clipboard error: {}", e));
    }
    debug!("Text copied to clipboard");

    // Step 2: Detect if target is a terminal
    let is_terminal = detect_terminal();
    debug!("Terminal detection: {}", is_terminal);

    // Step 3: Try paste tools in order of preference
    if try_ydotool(is_terminal) {
        info!("Text injected successfully via ydotool");
        return InjectionResult::SuccessYdotool;
    }

    if try_wtype(is_terminal) {
        info!("Text injected successfully via wtype");
        return InjectionResult::SuccessWtype;
    }

    // No paste tool available - text remains in clipboard
    warn!("No paste tool available - text left in clipboard for manual paste");
    InjectionResult::ClipboardOnly
}

/// Detect if the currently focused window is a terminal.
///
/// Uses xdotool to get the active window class and checks against known
/// terminal window classes. If detection fails, assumes non-terminal (safer).
///
/// @task T027
/// @epic T026
///
/// # Returns
/// * `true` if the active window is a terminal
/// * `false` if not a terminal or detection failed
pub fn detect_terminal() -> bool {
    // Try to get active window class using xdotool
    match get_active_window_class() {
        Some(window_class) => {
            let lower_class = window_class.to_lowercase();
            let is_terminal = TERMINAL_CLASSES
                .iter()
                .any(|term| lower_class.contains(term));
            debug!(
                "Window class '{}' is_terminal: {}",
                window_class, is_terminal
            );
            is_terminal
        }
        None => {
            debug!("Could not detect window class, assuming non-terminal");
            false
        }
    }
}

/// Get the active window class using xdotool.
///
/// @task T027
/// @epic T026
///
/// # Returns
/// * `Some(String)` containing the window class if successful
/// * `None` if xdotool is not available or failed
fn get_active_window_class() -> Option<String> {
    let output = Command::new("xdotool")
        .args(["getactivewindow", "getwindowclassname"])
        .output()
        .ok()?;

    if output.status.success() {
        let class = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if class.is_empty() {
            None
        } else {
            Some(class)
        }
    } else {
        None
    }
}

/// Attempt to simulate paste using ydotool.
///
/// ydotool is the preferred tool as it works via uinput and doesn't require
/// XWayland for the paste simulation itself.
///
/// @task T027
/// @epic T026
///
/// # Arguments
/// * `is_terminal` - If true, uses Ctrl+Shift+V; otherwise Ctrl+V
///
/// # Returns
/// * `true` if ydotool succeeded
/// * `false` if ydotool is not available or failed
pub fn try_ydotool(is_terminal: bool) -> bool {
    let keys = if is_terminal {
        "ctrl+shift+v"
    } else {
        "ctrl+v"
    };

    debug!("Attempting ydotool key {}", keys);

    match Command::new("ydotool").args(["key", keys]).status() {
        Ok(status) => {
            if status.success() {
                debug!("ydotool succeeded");
                true
            } else {
                debug!("ydotool failed with status: {:?}", status.code());
                false
            }
        }
        Err(e) => {
            debug!("ydotool not available or failed: {}", e);
            false
        }
    }
}

/// Attempt to simulate paste using wtype.
///
/// wtype is a Wayland-native alternative to ydotool.
///
/// @task T027
/// @epic T026
///
/// # Arguments
/// * `is_terminal` - If true, uses Ctrl+Shift+V; otherwise Ctrl+V
///
/// # Returns
/// * `true` if wtype succeeded
/// * `false` if wtype is not available or failed
pub fn try_wtype(is_terminal: bool) -> bool {
    let args: Vec<&str> = if is_terminal {
        // Ctrl+Shift+V for terminal
        vec![
            "-M", "ctrl", "-M", "shift", "-P", "v", "-p", "v", "-m", "shift", "-m", "ctrl",
        ]
    } else {
        // Ctrl+V for non-terminal
        vec!["-M", "ctrl", "-P", "v", "-p", "v", "-m", "ctrl"]
    };

    debug!("Attempting wtype with args: {:?}", args);

    match Command::new("wtype").args(&args).status() {
        Ok(status) => {
            if status.success() {
                debug!("wtype succeeded");
                true
            } else {
                debug!("wtype failed with status: {:?}", status.code());
                false
            }
        }
        Err(e) => {
            debug!("wtype not available or failed: {}", e);
            false
        }
    }
}

/// Check if a tool is available on the system.
///
/// @task T027
/// @epic T026
///
/// # Arguments
/// * `tool` - Name of the tool to check
///
/// # Returns
/// * `true` if the tool is available
/// * `false` if the tool is not found or not executable
pub fn is_tool_available(tool: &str) -> bool {
    // Use 'which' to check if the tool exists in PATH
    match Command::new("which").arg(tool).output() {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

/// Check if ydotool is available on the system.
///
/// @task T027
/// @epic T026
pub fn is_ydotool_available() -> bool {
    is_tool_available("ydotool")
}

/// Check if wtype is available on the system.
///
/// @task T027
/// @epic T026
pub fn is_wtype_available() -> bool {
    is_tool_available("wtype")
}

/// Check if any paste tool is available.
///
/// @task T027
/// @epic T026
pub fn is_any_paste_tool_available() -> bool {
    is_ydotool_available() || is_wtype_available()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_terminal_classes() {
        assert!(TERMINAL_CLASSES.contains(&"gnome-terminal"));
        assert!(TERMINAL_CLASSES.contains(&"kitty"));
    }
}
