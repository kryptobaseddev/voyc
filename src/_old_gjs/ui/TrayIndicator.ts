/**
 * @task T010
 * @epic T001
 * @why System tray indicator for Voyc
 * @what Placeholder for GTK4 support (AppIndicator3 is GTK3-only)
 */

import Gtk from 'gi://Gtk?version=4.0';
import GLib from 'gi://GLib?version=2.0';

import { StatusIcon, TrayState } from './StatusIcon.js';
import { ConfigManager } from '../config/Config.js';

/**
 * Menu action identifiers
 */
type MenuAction = 'toggle' | 'settings' | 'quit';

/**
 * Callback types for menu actions
 */
interface TrayCallbacks {
    onToggle: () => void;
    onSettings: () => void;
    onQuit: () => void;
}

/**
 * TrayIndicator class
 * 
 * NOTE: GTK4 removed GtkStatusIcon. AppIndicator3 depends on GTK3.
 * For a pure GTK4 app, we must either:
 * 1. Use a GNOME Shell Extension (preferred for integration).
 * 2. Implement StatusNotifierItem via D-Bus manually.
 * 
 * For this "Most Recent" implementation, we currently disable the legacy tray
 * to ensure stability with GTK4. Features like "Start/Stop" must be accessed via 
 * Hotkeys or the Main Window until D-Bus SNI is implemented.
 */
export class TrayIndicator {
    private _statusIcon: StatusIcon;
    private _configManager: ConfigManager;
    private _callbacks: TrayCallbacks;

    /**
     * Create a new TrayIndicator instance
     * 
     * @task T010
     * @epic T001
     * @why Initialize tray indicator
     * @what Sets up status icon and config manager references
     * @param {StatusIcon} statusIcon - Status icon manager
     * @param {ConfigManager} configManager - Config manager
     * @param {TrayCallbacks} callbacks - Menu action callbacks
     */
    constructor(
        statusIcon: StatusIcon,
        configManager: ConfigManager,
        callbacks: TrayCallbacks
    ) {
        this._statusIcon = statusIcon;
        this._configManager = configManager;
        this._callbacks = callbacks;
    }

    /**
     * Initialize the tray indicator
     * 
     * @task T010
     * @epic T001
     * @why Start the tray indicator (or fallback)
     * @what Initializes the indicator or shows a warning for GTK4
     * @returns {boolean} True if initialized successfully
     */
    init(): boolean {
        // GTK4 Transition: Tray disabled
        console.warn('TrayIndicator: System Tray not supported in pure GTK4 mode. Use Hotkeys or Main Window.');
        this.showNotification('Voyc Started', 'Use Super+V to dictate. Tray icon is disabled in GTK4 mode.');
        return true;
    }

    /**
     * Set dictation active state
     * 
     * @task T010
     * @epic T001
     * @why Update UI to reflect dictation state
     * @what Updates the tray icon state (if visible)
     * @param {boolean} active - Whether dictation is active
     */
    setDictationActive(active: boolean): void {
        // No-op for now
    }

    /**
     * Show a notification
     * 
     * @task T010
     * @epic T001
     * @why Notify user of events
     * @what Sends a desktop notification via notify-send
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     */
    showNotification(title: string, message: string): void {
        try {
            // Use notify-send via GLib.spawn_command_line_async
            const escapedTitle = GLib.shell_quote(title);
            const escapedMessage = GLib.shell_quote(message);
            const command = `notify-send -a Voyc ${escapedTitle} ${escapedMessage}`;
            GLib.spawn_command_line_async(command);
        } catch (e) {
            console.error('Failed to show notification:', e);
        }
    }

    /**
     * Clean up resources
     * 
     * @task T010
     * @epic T001
     * @why Cleanup on destroy
     * @what Releases resources
     */
    destroy(): void {
        // No-op
    }
}