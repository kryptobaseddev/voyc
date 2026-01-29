# Wayland Crash Research: Gdk Error 71 Analysis

**Task**: T040
**Epic**: T026
**Date**: 2026-01-28
**Status**: complete

---

## Summary

The Voyc Wayland crash (Gdk Error 71) is caused by a known WebKitGTK/NVIDIA driver issue with explicit sync on Wayland, NOT by the overlay window configuration. The crash occurs ~400ms after setup because WebKit's DMA-BUF renderer triggers an explicit sync protocol error during first render. The fix requires setting `__NV_DISABLE_EXPLICIT_SYNC=1` for NVIDIA GPUs on Wayland.

## Root Cause Analysis

### The Error Chain

1. **Symptom**: `Gdk-Message: Error 71 (Protocol error) dispatching to Wayland display`
2. **Cause**: WebKitGTK's DMA-BUF renderer uses Wayland's explicit sync protocol
3. **Trigger**: NVIDIA driver 560+ has incompatibility with WebKit's explicit sync implementation
4. **Underlying Issue**: The Wayland protocol error `wp_linux_drm_syncobj_surface_v1` reports "explicit sync is used, but no acquire point is set"

### Why It Happens ~400ms After Setup

The crash timing aligns with WebKit's first render cycle:
1. Application setup completes
2. Main window shown (renders successfully)
3. Overlay window created (hidden, no render yet)
4. WebKit begins rendering React frontend (SVG processing visible in logs)
5. DMA-BUF renderer attempts explicit sync with NVIDIA driver
6. Protocol error triggers crash

### GitHub Issue Evidence

From [tauri-apps/tauri#10702](https://github.com/tauri-apps/tauri/issues/10702):

> "I got the same error on my NVIDIA-only machine. Here is the log with `WAYLAND_DEBUG=1`:
> `[...] wl_display#1.error(wp_linux_drm_syncobj_surface_v1#50, 4, "explicit sync is used, but no acquire point is set")`"

This confirms the root cause is the NVIDIA/WebKit/Wayland explicit sync incompatibility.

## Handy vs Voyc Comparison

### Key Differences Found

| Aspect | Handy | Voyc | Impact |
|--------|-------|------|--------|
| `always_on_top` at build time | Yes (line 153) | No (removed) | None - not the cause |
| Wayland delay before overlay | None | 100ms sleep | Attempted fix, ineffective |
| `always_on_top` deferred | No | Yes (at show time) | Attempted fix, ineffective |

### Overlay Implementation Comparison

**Handy overlay.rs (lines 136-168)**:
```rust
.always_on_top(true)  // Set at build time
.skip_taskbar(true)
.transparent(true)
.focused(false)
.visible(false)
.build()
```

**Voyc overlay.rs (lines 65-94)**:
```rust
// Note: always_on_top is set when showing to avoid Wayland protocol errors
.skip_taskbar(true)
.transparent(true)
.focused(false)
.visible(false)
.build()
```

The difference in `always_on_top` timing is NOT the root cause. Both implementations should work identically because:
1. The window is created hidden (`visible(false)`)
2. The crash happens during WebKit rendering, not window property changes
3. The error is a DMA-BUF/explicit sync issue, not a window state issue

### Why Handy Works

Handy works because:
1. **Different test environment**: Handy may have been tested on X11 or non-NVIDIA Wayland
2. **Different WebKit caching**: Fresh installs vs cached WebKit state
3. **Timing differences**: Different frontend complexity affecting render timing

Both apps have identical `WEBKIT_DISABLE_DMABUF_RENDERER=1` logic in `main.rs`, but this only applies to X11 sessions, not Wayland.

## Fix Recommendations

### Immediate Fix (High Confidence)

Add NVIDIA explicit sync workaround to `src-tauri/src/main.rs`:

```rust
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

        // Existing X11 DMA-BUF workaround
        if std::path::Path::new("/dev/dri").exists()
            && std::env::var("WAYLAND_DISPLAY").is_err()
            && std::env::var("XDG_SESSION_TYPE").unwrap_or_default() == "x11"
        {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    voyc_app_lib::run()
}
```

### Alternative Fix (Lower Performance)

If explicit sync workaround causes visual glitches:

```rust
// Use DMA-BUF renderer workaround (slower but more stable)
if std::env::var("WAYLAND_DISPLAY").is_ok() {
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
}
```

**Trade-offs**:
- `__NV_DISABLE_EXPLICIT_SYNC=1`: Better performance, may have minor visual glitches
- `WEBKIT_DISABLE_DMABUF_RENDERER=1`: Slower animations, but no glitches

### Revert Unnecessary Changes

The overlay changes made in T032 can be reverted since they don't address the root cause:

1. Restore `always_on_top(true)` at build time (like Handy)
2. Remove the 100ms Wayland delay
3. Remove the deferred `set_always_on_top` in `show_recording_overlay`

## Additional Findings

### Environment Variables Summary

| Variable | Purpose | Use Case |
|----------|---------|----------|
| `__NV_DISABLE_EXPLICIT_SYNC=1` | Disable NVIDIA explicit sync | NVIDIA + Wayland |
| `WEBKIT_DISABLE_DMABUF_RENDERER=1` | Disable DMA-BUF rendering | Fallback, slower |
| `__GL_THREADED_OPTIMIZATIONS=0` | Additional NVIDIA workaround | If still glitchy |
| `GDK_BACKEND=x11` | Force X11 backend | Last resort |

### Detection Logic

To detect if fix is needed:

```rust
fn needs_nvidia_wayland_workaround() -> bool {
    // Check if Wayland
    let is_wayland = std::env::var("WAYLAND_DISPLAY").is_ok()
        || std::env::var("XDG_SESSION_TYPE")
            .map(|v| v.to_lowercase() == "wayland")
            .unwrap_or(false);

    // Check for NVIDIA (rough heuristic)
    let has_nvidia = std::path::Path::new("/proc/driver/nvidia/version").exists()
        || std::env::var("__GLX_VENDOR_LIBRARY_NAME")
            .map(|v| v.contains("nvidia"))
            .unwrap_or(false);

    is_wayland && has_nvidia
}
```

## Confidence Assessment

- **Root cause identification**: 95% confidence
- **Fix effectiveness**: 90% confidence (based on 62 thumbs-up on GitHub workaround)
- **No negative side effects**: 80% confidence (some users report minor visual glitches)

## References

- [tauri-apps/tauri#10702](https://github.com/tauri-apps/tauri/issues/10702) - Main bug report
- [tauri-apps/tao#977](https://github.com/tauri-apps/tao/issues/977) - Related TAO issue
- [tauri-apps/tao#979](https://github.com/tauri-apps/tao/pull/979) - Partial fix (not fully resolved)
- [WebKit Bug 280210](https://bugs.webkit.org/show_bug.cgi?id=280210) - Upstream WebKit issue
- [Fedora Discussion](https://discussion.fedoraproject.org/t/gdk-message-error-71-protocol-error-dispatching-to-wayland-display/127927) - User reports

---

## Appendix: Full File Paths

- Voyc overlay: `/mnt/projects/voyc/src-tauri/src/overlay.rs`
- Voyc main: `/mnt/projects/voyc/src-tauri/src/main.rs`
- Voyc lib: `/mnt/projects/voyc/src-tauri/src/lib.rs`
- Handy overlay: `/mnt/projects/handy/src-tauri/src/overlay.rs`
- Handy main: `/mnt/projects/handy/src-tauri/src/main.rs`
- Handy lib: `/mnt/projects/handy/src-tauri/src/lib.rs`
