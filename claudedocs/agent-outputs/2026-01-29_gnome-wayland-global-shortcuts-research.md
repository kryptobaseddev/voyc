# GNOME/Wayland Global Shortcuts: Complete Implementation Research

**Task**: T056 - Fix keyboard shortcuts to work natively on GNOME/Wayland WITHOUT workarounds
**Date**: 2026-01-29
**Status**: Complete

---

## Executive Summary

Global keyboard shortcuts on GNOME/Wayland now have a **working, standards-based solution** that requires NO user workarounds. GNOME 48+ (released March 2025) fully implements the XDG Desktop Portal GlobalShortcuts interface. The Tauri ecosystem has an **open PR (#162)** that adds complete Wayland support using this portal. This provides a concrete implementation path.

**Key Finding**: The `tauri-apps/global-hotkey` library has PR #162 that implements full Wayland support using the XDG GlobalShortcuts portal via the `ashpd` Rust crate. This PR has been tested on GNOME 48.5 and KDE Plasma 6.4.4.

---

## Background: Why Global Shortcuts Are Difficult on Wayland

Wayland's security model intentionally prevents applications from intercepting keystrokes when not focused. This is a security feature to prevent keyloggers. Unlike X11, where any application could grab keyboard events globally, Wayland requires a privileged intermediary.

### The Solution: XDG Desktop Portal GlobalShortcuts

The XDG Desktop Portal project defined a `GlobalShortcuts` interface that acts as this intermediary:

1. Applications register "actions" (not specific key combinations) with the portal
2. The desktop environment shows users a configuration dialog
3. Users assign their preferred shortcuts to each action
4. The portal notifies applications when shortcuts are activated

This design respects user agency and system security while enabling the functionality apps need.

---

## Current Support Status

### Desktop Environments with GlobalShortcuts Support

| Desktop Environment | Status | Portal Package | Notes |
|---------------------|--------|----------------|-------|
| **GNOME 48+** | Full Support | xdg-desktop-portal-gnome | Released March 2025 |
| **KDE Plasma 6+** | Full Support | xdg-desktop-portal-kde | Mature implementation |
| **Hyprland** | Full Support | xdg-desktop-portal-hyprland | Well-documented |
| **COSMIC** | In Progress | xdg-desktop-portal-cosmic | Alpha state |
| **wlroots (Sway)** | Tracking | xdg-desktop-portal-wlr | Issue #240 open |

### GNOME Implementation Details

From [TWIG #189](https://thisweek.gnome.org/posts/2025/02/twig-189/):

> "Thanks to the work of many people across multiple components, the GNOME desktop portal now supports the Global Shortcuts interface. Applications can register desktop-wide shortcuts, and users can edit and revoke them through the system settings."

The GNOME 48 implementation involves:
- **xdg-desktop-portal-gnome**: Receives shortcut requests
- **Mutter**: Provides keyboard monitoring backend
- **GNOME Control Center**: Settings UI for managing shortcuts
- **libportal/ashpd**: Client libraries for applications

---

## How Apps Currently Work

### OBS Studio (via Wayland Hotkeys Plus Plugin)

The [wayland-hotkeys-plus](https://github.com/codycwiseman/wayland-hotkeys-plus) plugin demonstrates the working pattern:

1. On first launch, triggers system "Add Keyboard Shortcuts" dialog
2. Lists all available OBS actions (Toggle Recording, Switch Scene, etc.)
3. User assigns shortcuts through system UI
4. Shortcuts are managed by the OS, not OBS
5. Configuration changes require going to GNOME Settings > Applications

**Requirements**: GNOME 49+ or KDE Plasma 6+

### Discord and Slack on Wayland

These Electron apps currently use XWayland as a fallback, which provides partial X11 compatibility. In GNOME 48+, they trigger the GlobalShortcuts portal dialog when attempting to use global shortcuts.

---

## The Correct Implementation Pattern

### XDG GlobalShortcuts Portal API

**D-Bus Details**:
- Service: `org.freedesktop.portal.Desktop`
- Object Path: `/org/freedesktop/portal/desktop`
- Interface: `org.freedesktop.portal.GlobalShortcuts`

**Core Methods**:

1. **CreateSession**: Start a shortcuts session
2. **BindShortcuts**: Register actions with descriptions and preferred triggers
3. **ListShortcuts**: Get current shortcut assignments
4. **ConfigureShortcuts**: Open user configuration UI (v2)

**Signals**:

- **Activated**: Shortcut was pressed
- **Deactivated**: Shortcut was released
- **ShortcutsChanged**: User changed configuration

### Key Behavioral Difference from X11

On Wayland with the portal:

1. **Application registers ACTIONS, not key combinations**
2. **User decides the actual shortcuts via system UI**
3. **Shortcuts survive application restarts** (stored by portal)
4. **User can revoke/change at any time in Settings**

This is fundamentally different from the X11 model where apps specify exact key combinations.

---

## Tauri Implementation: PR #162

### Overview

PR [#162 on tauri-apps/global-hotkey](https://github.com/tauri-apps/global-hotkey/pull/162) adds complete Wayland support:

**Stats**:
- +1412 lines, -104 lines
- New files: `src/wayland.rs`, `src/platform_impl/linux/wayland.rs`
- Uses `ashpd` crate (Rust XDG portal bindings)
- Tested on GNOME 48.5 and KDE Plasma 6.4.4

### API Design

The PR introduces a separate Wayland API due to fundamental differences:

```rust
use global_hotkey::{
    wayland::{WlNewHotKeyAction, WlHotKeysChangedEvent},
    GlobalHotKeyEvent, GlobalHotKeyManager,
};

const MY_ACTION_ID: u32 = 1;

fn main() {
    let hotkey_manager = GlobalHotKeyManager::new().unwrap();

    // Register an action with CTRL+META+O as the preferred hotkey
    let my_action = WlNewHotKeyAction::new(
        MY_ACTION_ID,
        "Do cool stuff.",  // Description shown to user
        Some(HotKey::new(
            Some(Modifiers::CONTROL | Modifiers::META),
            Code::KeyO,
        )),
    );

    // Register all actions - this may show system dialog
    hotkey_manager
        .wl_register_all("com.example.MyApp", &[my_action])
        .unwrap();

    // Listen for hotkey change events (user changed bindings)
    std::thread::spawn(move || {
        let Some(receiver) = WlHotKeysChangedEvent::receiver() else {
            return;
        };
        while let Ok(_) = receiver.recv() {
            println!("Hotkeys changed: {:?}", hotkey_manager.wl_get_hotkeys());
        }
    });

    // Receive global hotkey events (presses/releases)
    let event_receiver = GlobalHotKeyEvent::receiver();
    while let Ok(event) = event_receiver.recv() {
        println!("{event:?}");
    }
}
```

### Key Implementation Details

From `src/platform_impl/linux/wayland.rs`:

```rust
use ashpd::{
    desktop::{
        global_shortcuts::{
            Activated, Deactivated, GlobalShortcuts, NewShortcut, Shortcut, ShortcutsChanged,
        },
        Session,
    },
    AppID,
};

impl GlobalShortcutsState<'_> {
    pub async fn new(
        app_id: impl Into<String>,
        event_sender: Sender<GSEvent>,
    ) -> Result<Self, String> {
        // Register app ID with portal
        if let Err(_e) = ashpd::register_host_app(app_id).await { /* warn */ }

        // Create portal proxy
        let proxy = GlobalShortcuts::new().await?;

        // Create session
        let session = proxy.create_session().await?;

        // Set up event streams
        let gs_event_stream = Self::get_event_stream(&proxy).await?;

        // Listen in background
        tokio::spawn(async move {
            while let Some(ev) = gs_event_stream.next().await {
                let _ = event_sender.send(ev);
            }
        });

        Ok(Self { proxy, session })
    }
}
```

### Detection and Fallback

```rust
/// Returns `true` if `WAYLAND_DISPLAY` is set and running on Linux/BSD.
pub fn using_wayland() -> bool {
    cfg!(any(target_os = "linux", ...)) && env::var("WAYLAND_DISPLAY").is_ok()
}
```

---

## Implementation Path for Voyc

### Option 1: Wait for PR #162 Merge (Recommended for Production)

The PR is feature-complete and tested. Monitor for merge and update dependencies.

**Pros**: Clean, maintained solution
**Cons**: Unknown timeline

### Option 2: Use PR #162 Branch Directly

```toml
# Cargo.toml
[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]
global-hotkey = { git = "https://github.com/Adamskye/global-hotkey", branch = "wayland_support" }
```

**Pros**: Immediate access
**Cons**: Not on crates.io, may have breaking changes

### Option 3: Implement Directly with ashpd

Use the `ashpd` crate to call the portal directly, bypassing tauri-plugin-global-shortcut.

```toml
[dependencies]
ashpd = { version = "0.12", features = ["tokio"] }
```

This gives full control but requires more work.

### Option 4: Native D-Bus Implementation

Use `zbus` directly to talk to the portal. This is what `ashpd` does internally.

---

## Required Changes for Voyc

### 1. Detect Wayland at Runtime

```rust
fn is_wayland() -> bool {
    cfg!(target_os = "linux") && std::env::var("WAYLAND_DISPLAY").is_ok()
}
```

### 2. Use Different API on Wayland

The current `tauri-plugin-global-shortcut` API will NOT work on Wayland. The Wayland API requires:

1. **Action-based registration** (not key-based)
2. **App ID for portal identification**
3. **Handling user configuration changes**
4. **Different event flow** (portal-mediated)

### 3. Settings Model Change

Current Voyc stores `current_binding: "ctrl+space"`. On Wayland:

- Store action definitions with preferred triggers
- Accept that users may assign different shortcuts
- Display what the user actually configured, not what we requested

### 4. UI Considerations

- Inform users that shortcuts are configured in System Settings
- Provide a button to open GNOME Settings > Applications > Voyc
- Show current assigned shortcuts (from `wl_get_hotkeys()`)

---

## Known Issues and Workarounds

### GNOME 48 Bug (Fixed in GNOME 49)

PR #162 notes:
> "not handling error from BindShortcuts due to GNOME 48 bug (fixed in GNOME 49): https://gitlab.gnome.org/GNOME/xdg-desktop-portal-gnome/-/issues/177"

The workaround is to ignore errors from `BindShortcuts` and verify registration via `ListShortcuts`.

### App ID Requirements

Non-sandboxed (non-Flatpak) apps must provide a valid app ID:
- Format: reverse domain (e.g., `com.voyc.app`)
- Must match `.desktop` file if installed

---

## Testing Recommendations

1. **Test on GNOME 48+**: Ubuntu 24.10+, Fedora 42+
2. **Test on KDE Plasma 6**: Kubuntu 24.10+
3. **Verify dialog appears**: First launch should show "Add Keyboard Shortcuts"
4. **Test user modifications**: Change shortcuts in Settings, verify app sees changes
5. **Test persistence**: Restart app, verify shortcuts still work

---

## References

### Official Documentation
- [XDG Desktop Portal GlobalShortcuts](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.GlobalShortcuts.html)
- [GNOME 48 Release Notes (Developers)](https://release.gnome.org/48/developers/index.html)

### Implementation References
- [tauri-apps/global-hotkey PR #162](https://github.com/tauri-apps/global-hotkey/pull/162) - Full Wayland implementation
- [ashpd crate](https://docs.rs/ashpd/latest/ashpd/) - Rust XDG portal bindings
- [wayland-hotkeys-plus](https://github.com/codycwiseman/wayland-hotkeys-plus) - OBS plugin example

### GNOME Development
- [TWIG #189: Global Shortcuts](https://thisweek.gnome.org/posts/2025/02/twig-189/)
- [xdg-desktop-portal-gnome issue #47](https://gitlab.gnome.org/GNOME/xdg-desktop-portal-gnome/-/issues/47) - Tracking issue
- [GNOME Discourse: Global Shortcuts](https://discourse.gnome.org/t/how-do-you-enable-disable-global-shortcuts-in-gnome-48/29119)

### Discussions
- [Fedora Discussion: XDG Global Keybinds Portal](https://discussion.fedoraproject.org/t/xdg-global-keybinds-portal-in-gnome/121019)
- [tauri-apps/global-hotkey issue #28](https://github.com/tauri-apps/global-hotkey/issues/28) - Original tracking issue

---

## Conclusion

**Global shortcuts on GNOME/Wayland are now solvable without user workarounds.** The XDG Desktop Portal GlobalShortcuts API is fully implemented in GNOME 48+ and has working Rust implementations via `ashpd`. The Tauri ecosystem has PR #162 ready to merge that provides complete Wayland support.

**Recommended Implementation Path**:
1. Short-term: Use the global-hotkey branch from PR #162 directly
2. Medium-term: Update when PR merges to main
3. Long-term: Monitor tauri-plugin-global-shortcut for native portal support

**Critical Note**: The Wayland API is fundamentally different from X11. Applications register *actions with descriptions*, and *users choose the shortcuts*. This paradigm shift must be reflected in both code architecture and user interface design.
