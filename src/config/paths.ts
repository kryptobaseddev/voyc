/**
 * @task T007
 * @epic T001
 * @why XDG-compliant path utilities for configuration storage
 * @what Provides XDG Base Directory Specification paths using GLib
 */

// GJS-style imports for GLib
imports.gi.versions.GLib = '2.0';
imports.gi.versions.Gio = '2.0';

const { GLib, Gio } = imports.gi;

/**
 * Application identifier used for directory naming
 * @task T007
 * @epic T001
 * @why Consistent app directory naming across XDG paths
 * @what Application name for config/data directories
 */
const APP_NAME = 'voyc';

/**
 * Get the XDG config directory for Voyc
 * Uses GLib.get_user_config_dir() for GJS compatibility
 * Falls back to ~/.config if needed
 * 
 * @task T007
 * @epic T001
 * @why XDG-compliant configuration directory
 * @what Returns path to $XDG_CONFIG_HOME/voyc
 * @returns {string} Path to config directory
 */
export function getConfigDir(): string {
    const configDir = GLib.get_user_config_dir();
    return GLib.build_filenamev([configDir, APP_NAME]);
}

/**
 * Get the full path to the config file
 * 
 * @task T007
 * @epic T001
 * @why Standard location for config.json
 * @what Returns path to $XDG_CONFIG_HOME/voyc/config.json
 * @returns {string} Path to config file
 */
export function getConfigFilePath(): string {
    return GLib.build_filenamev([getConfigDir(), 'config.json']);
}

/**
 * Get the XDG data directory for Voyc
 * Used for application data, logs, etc.
 * 
 * @task T007
 * @epic T001
 * @why XDG-compliant data directory
 * @what Returns path to $XDG_DATA_HOME/voyc
 * @returns {string} Path to data directory
 */
export function getDataDir(): string {
    const dataDir = GLib.get_user_data_dir();
    return GLib.build_filenamev([dataDir, APP_NAME]);
}

/**
 * Get the XDG cache directory for Voyc
 * Used for temporary/cache files
 * 
 * @task T007
 * @epic T001
 * @why XDG-compliant cache directory
 * @what Returns path to $XDG_CACHE_HOME/voyc
 * @returns {string} Path to cache directory
 */
export function getCacheDir(): string {
    const cacheDir = GLib.get_user_cache_dir();
    return GLib.build_filenamev([cacheDir, APP_NAME]);
}

/**
 * Ensure a directory exists, creating it if necessary
 * 
 * @task T007
 * @epic T001
 * @why Ensure config directory exists before writing
 * @what Creates directory with appropriate permissions if missing
 * @param {string} dirPath - Directory path to ensure
 * @returns {boolean} True if directory exists or was created
 */
export function ensureDir(dirPath: string): boolean {
    try {
        const file = Gio.File.new_for_path(dirPath);
        
        if (file.query_exists(null)) {
            return true;
        }
        
        // Create directory with mode 0755 (rwxr-xr-x)
        file.make_directory_with_parents(null);
        return true;
    } catch (e) {
        logError(e as Error, `Failed to create directory: ${dirPath}`);
        return false;
    }
}

/**
 * Check if a file exists at the given path
 * 
 * @task T007
 * @epic T001
 * @why Check for existing config before loading
 * @what Returns true if file exists
 * @param {string} filePath - Path to check
 * @returns {boolean} True if file exists
 */
export function fileExists(filePath: string): boolean {
    try {
        const file = Gio.File.new_for_path(filePath);
        return file.query_exists(null);
    } catch (e) {
        return false;
    }
}
