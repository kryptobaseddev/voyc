/**
 * @task T007
 * @epic T001
 * @why Configuration manager with load/save and GObject signals
 * @what Manages configuration lifecycle with signal emission
 */

// GJS-style imports
imports.gi.versions.GObject = '2.0';
imports.gi.versions.Gio = '2.0';
imports.gi.versions.GLib = '2.0';

const { GObject, Gio, GLib } = imports.gi;

import { 
    Config, 
    DEFAULT_CONFIG, 
    validateConfig,
    Provider,
    SilenceTimeout,
    Hotkeys
} from './schema.js';

import { 
    getConfigFilePath, 
    ensureDir, 
    fileExists,
    getConfigDir
} from './paths.js';

/**
 * Signal definition type for ConfigManager
 * @task T007
 * @epic T001
 * @why Type-safe signal definitions
 * @what Defines the signals emitted by ConfigManager
 */
type ConfigManagerSignals = {
    /** Emitted when any config value changes */
    'changed': [];
    /** Emitted when provider changes */
    'provider-changed': [];
    /** Emitted when hotkeys change */
    'hotkeys-changed': [];
};

/**
 * Configuration manager class
 * Handles loading, saving, and notifying of config changes
 * Uses GObject signals for change notification
 * 
 * @task T007
 * @epic T001
 * @why Centralized configuration management with change notifications
 * @what Loads/saves config and emits signals on changes
 */
export class ConfigManager extends GObject.Object {
    private _config: Config;
    private _configPath: string;
    private _saveTimeout: number | null = null;
    
    // Static GObject registration
    static {
        GObject.registerClass({
            GTypeName: 'ConfigManager',
            Signals: {
                'changed': {
                    param_types: [],
                    return_type: GObject.TYPE_NONE,
                },
                'provider-changed': {
                    param_types: [],
                    return_type: GObject.TYPE_NONE,
                },
                'hotkeys-changed': {
                    param_types: [],
                    return_type: GObject.TYPE_NONE,
                },
            },
        }, ConfigManager as any);
    }

    /**
     * Create a new ConfigManager instance
     * 
     * @task T007
     * @epic T001
     * @why Initialize config manager with default or loaded config
     * @what Creates manager and loads existing config or creates defaults
     * @param {string} [configPath] - Optional custom config path
     */
    constructor(configPath?: string) {
        super();
        
        this._configPath = configPath || getConfigFilePath();
        this._config = { ...DEFAULT_CONFIG };
        this._saveTimeout = null;
        
        // Try to load existing config
        this.load();
    }

    /**
     * Get the current configuration
     * Returns a copy to prevent external mutation
     * 
     * @task T007
     * @epic T001
     * @why Read access to current configuration
     * @what Returns immutable copy of current config
     * @returns {Config} Current configuration copy
     */
    get config(): Config {
        return { ...this._config };
    }

    /**
     * Get the config file path
     * 
     * @task T007
     * @epic T001
     * @why Access to config file location
     * @what Returns path to config file
     * @returns {string} Config file path
     */
    get configPath(): string {
        return this._configPath;
    }

    /**
     * Load configuration from disk
     * Creates default config if file doesn't exist
     * 
     * @task T007
     * @epic T001
     * @why Load persisted configuration
     * @what Reads JSON config and validates it
     * @returns {boolean} True if load succeeded
     */
    load(): boolean {
        try {
            // If no config file exists, create default
            if (!fileExists(this._configPath)) {
                log(`Config not found at ${this._configPath}, creating default`);
                return this.save();
            }
            
            const file = Gio.File.new_for_path(this._configPath);
            const [success, contents] = file.load_contents(null);
            
            if (!success || !contents) {
                logError(new Error('Failed to read config file'));
                return false;
            }
            
            // Decode bytes to string
            const decoder = new TextDecoder();
            const jsonStr = decoder.decode(contents);
            
            // Parse JSON
            const parsed = JSON.parse(jsonStr);
            
            // Validate and apply defaults
            this._config = validateConfig(parsed);
            
            log(`Config loaded from ${this._configPath}`);
            return true;
            
        } catch (e) {
            logError(e as Error, 'Failed to load config, using defaults');
            this._config = { ...DEFAULT_CONFIG };
            return false;
        }
    }

    /**
     * Save configuration to disk
     * Ensures config directory exists before writing
     * 
     * @task T007
     * @epic T001
     * @why Persist configuration changes
     * @what Writes JSON config to XDG config directory
     * @returns {boolean} True if save succeeded
     */
    save(): boolean {
        try {
            // Ensure config directory exists
            const configDir = getConfigDir();
            if (!ensureDir(configDir)) {
                logError(new Error(`Failed to create config directory: ${configDir}`));
                return false;
            }
            
            // Serialize config to JSON with pretty printing
            const jsonStr = JSON.stringify(this._config, null, 2);
            
            // Write to file
            const file = Gio.File.new_for_path(this._configPath);
            const bytes = new TextEncoder().encode(jsonStr);
            
            file.replace_contents(
                bytes,
                null,  // etag
                false, // make_backup
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null   // cancellable
            );
            
            log(`Config saved to ${this._configPath}`);
            return true;
            
        } catch (e) {
            logError(e as Error, 'Failed to save config');
            return false;
        }
    }

    /**
     * Schedule a deferred save
     * Useful for batching multiple changes
     * 
     * @task T007
     * @epic T001
     * @why Batch rapid config changes
     * @what Schedules save after short delay
     * @param {number} [delayMs=500] - Delay in milliseconds
     */
    scheduleSave(delayMs: number = 500): void {
        // Clear existing timeout
        if (this._saveTimeout !== null) {
            GLib.source_remove(this._saveTimeout);
        }
        
        // Schedule new save
        this._saveTimeout = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            delayMs,
            () => {
                this.save();
                this._saveTimeout = null;
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    /**
     * Update the entire configuration
     * Validates and emits change signals
     * 
     * @task T007
     * @epic T001
     * @why Bulk config update
     * @what Validates and applies new config, emits signals
     * @param {Partial<Config>} partial - Partial config to merge
     * @param {boolean} [save=true] - Whether to save immediately
     */
    update(partial: Partial<Config>, save: boolean = true): void {
        const oldProvider = this._config.provider;
        const oldHotkeys = { ...this._config.hotkeys };
        
        // Validate and merge
        this._config = validateConfig({ ...this._config, ...partial });
        
        // Emit signals
        this.emit('changed');
        
        if (oldProvider !== this._config.provider) {
            this.emit('provider-changed');
        }
        
        if (oldHotkeys.toggleDictation !== this._config.hotkeys.toggleDictation ||
            oldHotkeys.pasteAsTerminal !== this._config.hotkeys.pasteAsTerminal) {
            this.emit('hotkeys-changed');
        }
        
        if (save) {
            this.scheduleSave();
        }
    }

    /**
     * Reset configuration to defaults
     * 
     * @task T007
     * @epic T001
     * @why Reset to factory defaults
     * @what Restores default config and saves
     */
    reset(): void {
        this._config = { ...DEFAULT_CONFIG };
        this.emit('changed');
        this.emit('provider-changed');
        this.emit('hotkeys-changed');
        this.save();
    }

    // Individual property setters with change notification

    /**
     * Set the STT provider
     * 
     * @task T007
     * @epic T001
     * @why Change transcription provider
     * @what Updates provider and emits signal
     * @param {Provider} provider - New provider
     */
    setProvider(provider: Provider): void {
        if (this._config.provider !== provider) {
            this._config.provider = provider;
            this.emit('changed');
            this.emit('provider-changed');
            this.scheduleSave();
        }
    }

    /**
     * Set ElevenLabs API key
     * 
     * @task T007
     * @epic T001
     * @why Update ElevenLabs credentials
     * @what Updates API key and saves
     * @param {string} apiKey - New API key
     */
    setElevenlabsApiKey(apiKey: string): void {
        if (this._config.elevenlabsApiKey !== apiKey) {
            this._config.elevenlabsApiKey = apiKey;
            this.emit('changed');
            this.scheduleSave();
        }
    }

    /**
     * Set OpenAI API key
     * 
     * @task T007
     * @epic T001
     * @why Update OpenAI credentials
     * @what Updates API key and saves
     * @param {string} apiKey - New API key
     */
    setOpenaiApiKey(apiKey: string): void {
        if (this._config.openaiApiKey !== apiKey) {
            this._config.openaiApiKey = apiKey;
            this.emit('changed');
            this.scheduleSave();
        }
    }

    /**
     * Set Baseten API key
     * 
     * @task T007
     * @epic T001
     * @why Update Baseten credentials
     * @what Updates API key and saves
     * @param {string} apiKey - New API key
     */
    setBasetenApiKey(apiKey: string): void {
        if (this._config.basetenApiKey !== apiKey) {
            this._config.basetenApiKey = apiKey;
            this.emit('changed');
            this.scheduleSave();
        }
    }

    /**
     * Set silence timeout
     * 
     * @task T007
     * @epic T001
     * @why Configure auto-stop behavior
     * @what Updates timeout and saves
     * @param {SilenceTimeout} timeout - Timeout in seconds (0, 30, or 60)
     */
    setSilenceTimeout(timeout: SilenceTimeout): void {
        if (this._config.silenceTimeout !== timeout) {
            this._config.silenceTimeout = timeout;
            this.emit('changed');
            this.scheduleSave();
        }
    }

    /**
     * Set autostart preference
     * 
     * @task T007
     * @epic T001
     * @why Configure startup behavior
     * @what Updates autostart and saves
     * @param {boolean} autostart - Whether to autostart
     */
    setAutostart(autostart: boolean): void {
        if (this._config.autostart !== autostart) {
            this._config.autostart = autostart;
            this.emit('changed');
            this.scheduleSave();
        }
    }

    /**
     * Set hotkeys
     * 
     * @task T007
     * @epic T001
     * @why Update keyboard shortcuts
     * @what Updates hotkeys and emits signal
     * @param {Partial<Hotkeys>} hotkeys - Hotkey changes
     */
    setHotkeys(hotkeys: Partial<Hotkeys>): void {
        const oldHotkeys = { ...this._config.hotkeys };
        this._config.hotkeys = { ...this._config.hotkeys, ...hotkeys };
        
        if (oldHotkeys.toggleDictation !== this._config.hotkeys.toggleDictation ||
            oldHotkeys.pasteAsTerminal !== this._config.hotkeys.pasteAsTerminal) {
            this.emit('changed');
            this.emit('hotkeys-changed');
            this.scheduleSave();
        }
    }

    /**
     * Set audio device
     * 
     * @task T007
     * @epic T001
     * @why Select input device
     * @what Updates device and saves
     * @param {string | null} device - Device ID or null for default
     */
    setAudioDevice(device: string | null): void {
        if (this._config.audioDevice !== device) {
            this._config.audioDevice = device;
            this.emit('changed');
            this.scheduleSave();
        }
    }

    /**
     * Set post-processing preference
     * 
     * @task T007
     * @epic T001
     * @why Enable/disable LLM post-processing
     * @what Updates setting and saves
     * @param {boolean} enabled - Whether to enable
     */
    setEnablePostProcessing(enabled: boolean): void {
        if (this._config.enablePostProcessing !== enabled) {
            this._config.enablePostProcessing = enabled;
            this.emit('changed');
            this.scheduleSave();
        }
    }

    /**
     * Set transcript logging preference
     * 
     * @task T007
     * @epic T001
     * @why Enable/disable transcript logging
     * @what Updates setting and saves
     * @param {boolean} enabled - Whether to log
     */
    setLogTranscripts(enabled: boolean): void {
        if (this._config.logTranscripts !== enabled) {
            this._config.logTranscripts = enabled;
            this.emit('changed');
            this.scheduleSave();
        }
    }

    /**
     * Set local audio storage preference
     * 
     * @task T016
     * @epic T001
     * @why Enable/disable local audio storage per REQ-019
     * @what Updates setting and saves
     * @param {boolean} enabled - Whether to store audio
     */
    setStoreAudioLocally(enabled: boolean): void {
        if (this._config.storeAudioLocally !== enabled) {
            this._config.storeAudioLocally = enabled;
            this.emit('changed');
            this.scheduleSave();
        }
    }

    /**
     * Set audio retention period
     * 
     * @task T016
     * @epic T001
     * @why Configure how long to retain audio per REQ-019
     * @what Updates retention days and saves
     * @param {number} days - Retention period in days (0 = no retention)
     */
    setAudioRetentionDays(days: number): void {
        if (this._config.audioRetentionDays !== days && days >= 0) {
            this._config.audioRetentionDays = days;
            this.emit('changed');
            this.scheduleSave();
        }
    }

    /**
     * Set log level
     * 
     * @task T016
     * @epic T001
     * @why Configure logging verbosity per T016
     * @what Updates log level and saves
     * @param {import('./schema.js').LogLevelConfig} level - Log level
     */
    setLogLevel(level: import('./schema.js').LogLevelConfig): void {
        if (this._config.logLevel !== level) {
            this._config.logLevel = level;
            this.emit('changed');
            this.scheduleSave();
        }
    }

    /**
     * Set latency threshold alerts enabled
     * 
     * @task T016
     * @epic T001
     * @why Enable/disable latency alerts per REQ-017
     * @what Updates alert setting and saves
     * @param {boolean} enabled - Whether to enable alerts
     */
    setEnableLatencyAlerts(enabled: boolean): void {
        if (this._config.enableLatencyAlerts !== enabled) {
            this._config.enableLatencyAlerts = enabled;
            this.emit('changed');
            this.scheduleSave();
        }
    }

    /**
     * Update latency thresholds
     *
     * @task T016
     * @epic T001
     * @why Configure latency thresholds per REQ-017
     * @what Updates threshold values and saves
     * @param {Partial<import('./schema.js').LatencyThresholds>} thresholds - Threshold changes
     */
    setLatencyThresholds(thresholds: Partial<import('./schema.js').LatencyThresholds>): void {
        const oldThresholds = { ...this._config.latencyThresholds };
        this._config.latencyThresholds = { ...this._config.latencyThresholds, ...thresholds };

        // Only emit if actually changed
        if (JSON.stringify(oldThresholds) !== JSON.stringify(this._config.latencyThresholds)) {
            this.emit('changed');
            this.scheduleSave();
        }
    }

    /**
     * Set check for updates preference
     *
     * @task T023
     * @epic T001
     * @why Allow user to enable/disable update checks
     * @what Updates setting and saves
     * @param {boolean} enabled - Whether to check for updates
     */
    setCheckForUpdates(enabled: boolean): void {
        if (this._config.checkForUpdates !== enabled) {
            this._config.checkForUpdates = enabled;
            this.emit('changed');
            this.scheduleSave();
        }
    }

    /**
     * Set last update check timestamp
     *
     * @task T023
     * @epic T001
     * @why Track when last update check occurred
     * @what Updates timestamp and saves
     * @param {string | null} isoDate - ISO date string or null
     */
    setLastUpdateCheck(isoDate: string | null): void {
        if (this._config.lastUpdateCheck !== isoDate) {
            this._config.lastUpdateCheck = isoDate;
            this.emit('changed');
            this.scheduleSave();
        }
    }
}

// Type export for signal connections
export type ConfigManagerType = InstanceType<typeof ConfigManager>;
