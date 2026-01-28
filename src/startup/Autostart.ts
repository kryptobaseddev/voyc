/**
 * @task T017
 * @epic T001
 * @why XDG autostart management for Voyc application
 * @what Manages desktop entry creation/removal for login autostart
 */

// GJS-style imports
import Gio from 'gi://Gio?version=2.0';
import GLib from 'gi://GLib?version=2.0';
import system from 'system';

import { getConfigDir, ensureDir, fileExists } from '../config/paths.js';

/**
 * Desktop entry file name
 * @task T017
 * @epic T001
 * @why Standard desktop entry filename
 * @what Filename for the autostart desktop entry
 */
const DESKTOP_ENTRY_NAME = 'voyc.desktop';

/**
 * Application ID for DBus and desktop entry
 * @task T017
 * @epic T001
 * @why Consistent application identifier
 * @what Reverse DNS app ID used across the application
 */
const APP_ID = 'com.voyc.app';

/**
 * Autostart manager class
 * Handles XDG autostart desktop entry creation and removal
 * 
 * @task T017
 * @epic T001
 * @why Enable/disable autostart on login via XDG spec
 * @what Manages desktop entry file in XDG autostart directory
 */
export class Autostart {
    private _autostartDir: string;
    private _desktopEntryPath: string;
    private _execPath: string | null = null;

    /**
     * Create a new Autostart manager
     * 
     * @task T017
     * @epic T001
     * @why Initialize autostart with XDG paths
     * @what Sets up paths for desktop entry management
     */
    constructor() {
        // XDG autostart directory: ~/.config/autostart
        const configDir = GLib.get_user_config_dir();
        this._autostartDir = GLib.build_filenamev([configDir, 'autostart']);
        this._desktopEntryPath = GLib.build_filenamev([this._autostartDir, DESKTOP_ENTRY_NAME]);
        
        // Determine execution path for desktop entry
        this._determineExecPath();
    }

    /**
     * Determine the execution path for the desktop entry
     * Tries to find the installed script or falls back to development path
     * 
     * @task T017
     * @epic T001
     * @why Find correct path for Exec line in desktop entry
     * @what Searches for installed binary or uses project path
     * @private
     */
    private _determineExecPath(): void {
        // Check if running from installed location
        const installedPaths = [
            '/usr/bin/voyc',
            '/usr/local/bin/voyc',
            GLib.build_filenamev([GLib.get_home_dir(), '.local', 'bin', 'voyc']),
        ];

        for (const path of installedPaths) {
            if (fileExists(path)) {
                this._execPath = path;
                return;
            }
        }

        // Fall back to project path for development
        // Try to find the project root relative to this file
        const scriptFile = system.programInvocationName;
        if (scriptFile) {
            const scriptDir = GLib.path_get_dirname(scriptFile);
            // Assume standard structure: dist/startup/Autostart.js -> dist/main.js
            const projectDist = GLib.build_filenamev([scriptDir, '..']);
            const mainJs = GLib.build_filenamev([projectDist, 'main.js']);
            
            if (fileExists(mainJs)) {
                this._execPath = `/usr/bin/gjs ${mainJs}`;
                return;
            }
        }

        // Final fallback
        this._execPath = '/usr/bin/gjs /path/to/voyc/dist/main.js';
    }

    /**
     * Check if autostart is currently enabled
     * 
     * @task T017
     * @epic T001
     * @why Determine current autostart state
     * @what Checks if desktop entry exists and is enabled
     * @returns {boolean} True if autostart is enabled
     */
    isEnabled(): boolean {
        if (!fileExists(this._desktopEntryPath)) {
            return false;
        }

        // Check if explicitly disabled
        try {
            const file = Gio.File.new_for_path(this._desktopEntryPath);
            const [success, contents] = file.load_contents(null);
            
            if (success && contents) {
                const decoder = new TextDecoder();
                const content = decoder.decode(contents);
                
                // Check for X-GNOME-Autostart-enabled=false
                const disabledMatch = content.match(/X-GNOME-Autostart-enabled\s*=\s*false/i);
                if (disabledMatch) {
                    return false;
                }
                
                // Check for Hidden=true
                const hiddenMatch = content.match(/Hidden\s*=\s*true/i);
                if (hiddenMatch) {
                    return false;
                }
            }
        } catch (e) {
            console.error('Failed to read desktop entry:', e);
        }

        return true;
    }

    /**
     * Enable autostart by creating the desktop entry
     * 
     * @task T017
     * @epic T001
     * @why Create autostart desktop entry
     * @what Creates XDG autostart directory and desktop entry file
     * @returns {boolean} True if successful
     */
    enable(): boolean {
        try {
            // Ensure autostart directory exists
            if (!ensureDir(this._autostartDir)) {
                console.error(`Failed to create autostart directory: ${this._autostartDir}`);
                return false;
            }

            // Generate desktop entry content
            const desktopEntry = this._generateDesktopEntry();

            // Write desktop entry file
            const file = Gio.File.new_for_path(this._desktopEntryPath);
            const bytes = new TextEncoder().encode(desktopEntry);

            file.replace_contents(
                bytes,
                null,  // etag
                false, // make_backup
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null   // cancellable
            );

            // Make executable (desktop entries don't need +x, but some DEs prefer it)
            this._setExecutablePermission();

            console.log(`Autostart enabled: ${this._desktopEntryPath}`);
            return true;

        } catch (e) {
            console.error('Failed to enable autostart:', e);
            return false;
        }
    }

    /**
     * Disable autostart by removing or modifying the desktop entry
     * 
     * @task T017
     * @epic T001
     * @why Remove autostart desktop entry
     * @what Removes desktop entry file or marks it disabled
     * @returns {boolean} True if successful
     */
    disable(): boolean {
        try {
            if (!fileExists(this._desktopEntryPath)) {
                // Already disabled
                return true;
            }

            // Delete the desktop entry file
            const file = Gio.File.new_for_path(this._desktopEntryPath);
            file.delete(null);

            console.log(`Autostart disabled: ${this._desktopEntryPath}`);
            return true;

        } catch (e) {
            console.error('Failed to disable autostart:', e);
            return false;
        }
    }

    /**
     * Toggle autostart state
     * 
     * @task T017
     * @epic T001
     * @why Convenience method for UI toggle
     * @what Enables if disabled, disables if enabled
     * @returns {boolean} New autostart state
     */
    toggle(): boolean {
        if (this.isEnabled()) {
            this.disable();
            return false;
        } else {
            this.enable();
            return true;
        }
    }

    /**
     * Set autostart to match config preference
     * Called on startup to ensure desktop entry matches config
     * 
     * @task T017
     * @epic T001
     * @why Sync desktop entry with config setting
     * @what Enables/disables based on config.autostart
     * @param {boolean} shouldAutostart - Desired autostart state
     * @returns {boolean} True if state matches preference
     */
    syncWithConfig(shouldAutostart: boolean): boolean {
        const currentState = this.isEnabled();
        
        if (shouldAutostart && !currentState) {
            return this.enable();
        } else if (!shouldAutostart && currentState) {
            return this.disable();
        }
        
        return true;
    }

    /**
     * Generate the desktop entry content
     * 
     * @task T017
     * @epic T001
     * @why Create valid XDG desktop entry
     * @what Returns formatted desktop entry string
     * @returns {string} Desktop entry content
     * @private
     */
    private _generateDesktopEntry(): string {
        const iconPath = this._findIconPath();
        
        return `[Desktop Entry]
Type=Application
Name=Voyc
Comment=Voice dictation for Linux
Exec=${this._execPath}
Icon=${iconPath}
Terminal=false
X-GNOME-Autostart-enabled=true
StartupNotify=false
Categories=Utility;Audio;
Keywords=dictation;voice;speech;stt;
`;
    }

    /**
     * Find the icon path for the desktop entry
     * 
     * @task T017
     * @epic T001
     * @why Locate application icon
     * @what Searches common icon locations
     * @returns {string} Icon name or path
     * @private
     */
    private _findIconPath(): string {
        // Check for installed icon
        const iconPaths = [
            '/usr/share/icons/hicolor/scalable/apps/voyc.svg',
            '/usr/share/icons/hicolor/48x48/apps/voyc.png',
            '/usr/local/share/icons/hicolor/scalable/apps/voyc.svg',
            GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share', 'icons', 'voyc.svg']),
        ];

        for (const path of iconPaths) {
            if (fileExists(path)) {
                return path;
            }
        }

        // Fall back to icon name (will use system theme or hicolor)
        return 'voyc';
    }

    /**
     * Set executable permission on desktop entry
     * Some desktop environments require this
     * 
     * @task T017
     * @epic T001
     * @why Ensure desktop entry is executable
     * @what Sets file permissions to 0755
     * @private
     */
    private _setExecutablePermission(): void {
        try {
            // Use chmod via spawn_command_line_async
            const command = `chmod +x ${GLib.shell_quote(this._desktopEntryPath)}`;
            GLib.spawn_command_line_async(command);
        } catch (e) {
            // Non-fatal: desktop entries work without +x in most DEs
            console.log('Note: Could not set executable permission on desktop entry');
        }
    }

    /**
     * Get the desktop entry file path
     * 
     * @task T017
     * @epic T001
     * @why Access to desktop entry location
     * @what Returns full path to desktop entry
     * @returns {string} Desktop entry path
     */
    getDesktopEntryPath(): string {
        return this._desktopEntryPath;
    }

    /**
     * Get the autostart directory path
     * 
     * @task T017
     * @epic T001
     * @why Access to autostart directory
     * @what Returns XDG autostart directory path
     * @returns {string} Autostart directory path
     */
    getAutostartDir(): string {
        return this._autostartDir;
    }
}

/**
 * Create a new Autostart manager instance
 * Factory function for convenience
 * 
 * @task T017
 * @epic T001
 * @why Factory for Autostart instances
 * @what Creates and returns new Autostart manager
 * @returns {Autostart} New Autostart instance
 */
export function createAutostart(): Autostart {
    return new Autostart();
}