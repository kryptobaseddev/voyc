# Portal Global Hotkeys Research

**Date**: 2026-01-27  
**Task**: T009 - Portal global hotkeys  
**Epic**: T001 (Build application from claudedocs/prd.md)

## Overview

Research on implementing Wayland-safe global hotkeys via xdg-desktop-portal for the Voyc voice dictation application.

## xdg-desktop-portal GlobalShortcuts API

### Service Details
- **Bus**: Session bus
- **Service**: `org.freedesktop.portal.Desktop`
- **Object Path**: `/org/freedesktop/portal/desktop`
- **Interface**: `org.freedesktop.portal.GlobalShortcuts`
- **Version**: 2 (current)

### Key Methods

#### CreateSession(options) → handle
Creates a global shortcuts session. Returns a Request handle.

**Options**:
- `handle_token` (s): Token for the request handle
- `session_handle_token` (s): Token for the session handle

**Response** (via Request::Response signal):
- `session_handle` (s): Object path for the Session object

#### BindShortcuts(session_handle, shortcuts, parent_window, options) → request_handle
Binds shortcuts to a session. Typically shows a dialog for user configuration.

**Parameters**:
- `session_handle` (o): Session object path
- `shortcuts` (a(sa{sv})): Array of (shortcut_id, properties)
  - `description` (s): User-readable description
  - `preferred_trigger` (s): Preferred shortcut (XDG shortcuts spec)
- `parent_window` (s): Window identifier
- `options` (a{sv}): Options vardict

**Response**:
- `shortcuts` (a(sa{sv})): Bound shortcuts subset

#### ListShortcuts(session_handle, options) → request_handle
Lists all shortcuts for a session.

### Signals

#### Activated(session_handle, shortcut_id, timestamp, options)
Emitted when a shortcut is activated.

**Parameters**:
- `session_handle` (o): Session that requested the shortcut
- `shortcut_id` (s): Application-provided ID
- `timestamp` (t): Activation time (ms, undefined base)
- `options` (a{sv}): May include `activation_token`

#### Deactivated(session_handle, shortcut_id, timestamp, options)
Emitted when a shortcut is deactivated.

#### ShortcutsChanged(session_handle, shortcuts)
Emitted when shortcut information changes.

## GJS Implementation Approach

### D-Bus Proxy Pattern
Using `Gio.DBusProxy.makeProxyWrapper()` for high-level D-Bus access:

```javascript
const ProxyClass = Gio.DBusProxy.makeProxyWrapper(xmlInterface);
const proxy = new ProxyClass(
    Gio.DBus.session,
    'org.freedesktop.portal.Desktop',
    '/org/freedesktop/portal/desktop'
);
```

### Portal Request Pattern
Portal methods return Request objects that emit `Response` signals:

1. Call method (e.g., `CreateSession`)
2. Receive Request handle
3. Connect to Request's `Response` signal
4. Handle result or error

### Required Interfaces

#### org.freedesktop.portal.GlobalShortcuts
Main interface for shortcut management.

#### org.freedesktop.portal.Request
Returned by portal methods, emits `Response` signal.

#### org.freedesktop.portal.Session
Created by CreateSession, represents a shortcuts session.

## Implementation Notes

### Error Handling
- Portal may be unavailable (no implementation or denied)
- User may deny shortcut binding
- Shortcuts may conflict with system shortcuts

### Window Identifiers
Parent window identifiers follow the XDG foreign window protocol:
- Wayland: `wayland:<handle>`
- X11: `x11:<xid>`

### Shortcut Trigger Format
Follows XDG shortcuts specification:
- Modifiers: `<Ctrl>`, `<Alt>`, `<Shift>`, `<Super>`
- Keys: Single characters or named keys
- Examples: `<Ctrl><Alt>D`, `<Super>V`

## References

1. [xdg-desktop-portal GlobalShortcuts docs](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.GlobalShortcuts.html)
2. [GJS D-Bus Guide](https://gjs.guide/guides/gio/dbus.html)
3. [GJS Examples - DBusClient](https://wiki.gnome.org/Gjs/Examples/DBusClient)

## Required Voyc Hotkeys

1. **Toggle Dictation**: Start/stop voice dictation
   - Default: `<Super><Shift>V` (configurable)
   
2. **Paste as Terminal**: Force terminal paste (Ctrl+Shift+V)
   - Default: `<Super><Shift>T` (configurable)

## Fallback Strategy

If portal is unavailable:
1. Log warning
2. Disable global hotkeys
3. Rely on tray UI for control
4. Consider X11 fallback (if on X11)
