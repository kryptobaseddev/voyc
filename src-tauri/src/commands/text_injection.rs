//! Text injection commands for Tauri frontend
//!
//! @task T027
//! @epic T026
//!
//! This module exposes text injection functionality to the frontend via Tauri commands.

use crate::text_injection::{self, InjectionResult};
use serde::Serialize;
use specta::Type;
use tauri::AppHandle;

/// Response structure for text injection result.
///
/// @task T027
/// @epic T026
#[derive(Serialize, Type)]
pub struct InjectionResultResponse {
    /// Whether the injection was successful (includes clipboard_only as success)
    pub success: bool,
    /// The method used: "ydotool", "wtype", or "clipboard_only"
    pub method: Option<String>,
    /// Error message if injection failed completely
    pub error: Option<String>,
}

/// Status of available paste tools on the system.
///
/// @task T027
/// @epic T026
#[derive(Serialize, Type)]
pub struct PasteToolsStatus {
    /// Whether ydotool is available
    pub ydotool_available: bool,
    /// Whether wtype is available
    pub wtype_available: bool,
    /// Whether any paste tool is available
    pub any_available: bool,
}

/// Inject text into the currently focused application.
///
/// This command copies the text to the clipboard and attempts to simulate
/// a paste keystroke using ydotool or wtype. If no paste tool is available,
/// the text remains in the clipboard for manual paste.
///
/// @task T027
/// @epic T026
///
/// # Arguments
/// * `app` - Tauri AppHandle
/// * `text` - Text to inject
///
/// # Returns
/// * `InjectionResultResponse` with success status and method used
#[tauri::command]
#[specta::specta]
pub fn inject_text(app: AppHandle, text: String) -> InjectionResultResponse {
    match text_injection::inject_text(&app, &text) {
        InjectionResult::SuccessYdotool => InjectionResultResponse {
            success: true,
            method: Some("ydotool".to_string()),
            error: None,
        },
        InjectionResult::SuccessWtype => InjectionResultResponse {
            success: true,
            method: Some("wtype".to_string()),
            error: None,
        },
        InjectionResult::ClipboardOnly => InjectionResultResponse {
            success: true,
            method: Some("clipboard_only".to_string()),
            error: None,
        },
        InjectionResult::Failed(msg) => InjectionResultResponse {
            success: false,
            method: None,
            error: Some(msg),
        },
    }
}

/// Check which paste tools are available on the system.
///
/// This command checks for the presence of ydotool and wtype, which are
/// used for simulating paste keystrokes on Wayland.
///
/// @task T027
/// @epic T026
///
/// # Returns
/// * `PasteToolsStatus` indicating which tools are available
#[tauri::command]
#[specta::specta]
pub fn check_paste_tools() -> PasteToolsStatus {
    let ydotool_available = text_injection::is_ydotool_available();
    let wtype_available = text_injection::is_wtype_available();

    PasteToolsStatus {
        ydotool_available,
        wtype_available,
        any_available: ydotool_available || wtype_available,
    }
}
