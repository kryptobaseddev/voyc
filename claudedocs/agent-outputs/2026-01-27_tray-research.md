# Tray Indicator Research: GNOME 46 & GTK4 StatusNotifierItem

## Summary

Research confirms that **native status icons (`GtkStatusIcon`) were removed in GTK4**, and GNOME 46+ does not natively display system tray icons without extensions. The "most recent" compliant path for 2026 is to implement the **StatusNotifierItem (SNI)** D-Bus specification manually. This allows the application to broadcast its icon/menu to any desktop environment (or GNOME extension like "AppIndicator Support") acting as a StatusNotifierHost, without relying on deprecated GTK3 widgets or libraries.

## Findings

### 1. GTK4 Status Icon Removal & GNOME Philosophy
- **Finding:** GTK4 strictly removed `Gtk.StatusIcon`. Libraries like `libappindicator` (AppIndicator3) depend on GTK3 and are incompatible with GTK4 applications in the same process.
- **Context:** GNOME's design philosophy favors the "Background Portal" and Notifications over persistent tray icons. However, for a "Voice Dictation" app that needs "Start/Stop" controls, a persistent indicator is functionally critical.
- **Evidence:** GNOME Developer Docs state standard system tray icons are deprecated in favor of background portals.

### 2. The Solution: Pure D-Bus StatusNotifierItem (SNI)
- **Finding:** Applications can bypass GTK's lack of support by implementing the `org.kde.StatusNotifierItem` interface directly over D-Bus.
- **Mechanism:**
    1.  **Export Object:** Create a D-Bus object implementing `org.kde.StatusNotifierItem`.
    2.  **Properties:** Expose `IconName`, `Title`, `Status` (Active/Passive), and `ToolTip`.
    3.  **Methods:** Implement `Activate` (click) and `ContextMenu` (right-click).
    4.  **Register:** Call `RegisterStatusNotifierItem` on the `org.kde.StatusNotifierWatcher` service.
- **Benefit:** This is toolkit-agnostic. It works in GTK4, Qt, or even Node.js apps, as long as they speak D-Bus. It restores the tray icon for users who have the "AppIndicator Support" extension installed (standard on Ubuntu, Pop!_OS, etc.).

### 3. Implementation Details for GJS
- **Finding:** GJS provides `Gio.DBusExportedObject` which allows wrapping a JavaScript class to expose it as a D-Bus interface.
- **Requirement:** We need the XML definition for `org.kde.StatusNotifierItem` (often referred to as SNI).
- **Service Name:** The service must be named uniquely, e.g., `org.kde.StatusNotifierItem-PID-1`.

## Recommendations

1.  **Implement `DbusStatusIcon` Class**: Create a new class in `src/ui/` that implements the SNI protocol using `Gio.DBusExportedObject`.
2.  **Define SNI XML**: Add the `org.kde.StatusNotifierItem` XML interface to `src/hotkeys/dbus-interfaces.ts` (or a new file).
3.  **Register with Watcher**: In `main.ts` or `TrayIndicator.ts`, connect to the `StatusNotifierWatcher` on the session bus and register the new object.
4.  **Fallback/UX**: Continue to show the startup notification ("Tray icon disabled...") *only* if the D-Bus registration fails or no Watcher is found, but make the D-Bus attempt the primary path.

## Sources

- [freedesktop.org: StatusNotifierItem Specification](https://www.freedesktop.org/wiki/Specifications/StatusNotifierItem/)
- [GNOME Developer: Migrating to GTK4](https://developer.gnome.org/documentation/tutorials/migrating-to-gtk4.html)
- [GJS Guide: D-Bus](https://gjs.guide/guides/gio/dbus.html)

## Linked Tasks

- Epic: T001
- Task: T010
