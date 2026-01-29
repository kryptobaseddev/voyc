// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Workaround for Wayland + NVIDIA explicit sync crash (Error 71)
        // See: https://github.com/tauri-apps/tauri/issues/10702
        if std::env::var("WAYLAND_DISPLAY").is_ok()
            || std::env::var("XDG_SESSION_TYPE")
                .map(|v| v.to_lowercase() == "wayland")
                .unwrap_or(false)
        {
            // Disable NVIDIA explicit sync to prevent protocol errors
            std::env::set_var("__NV_DISABLE_EXPLICIT_SYNC", "1");
        }

        // X11 DMA-BUF workaround for systems without proper GPU support
        if std::path::Path::new("/dev/dri").exists()
            && std::env::var("WAYLAND_DISPLAY").is_err()
            && std::env::var("XDG_SESSION_TYPE").unwrap_or_default() == "x11"
        {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    voyc_app_lib::run()
}
