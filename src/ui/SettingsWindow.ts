/**
 * @task T010
 * @epic T001
 * @why GTK4 + LibAdwaita settings window for Voyc configuration
 * @what Modern preferences window with Adw.PreferencesPage and Adw.ActionRow
 */

import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import GObject from 'gi://GObject?version=2.0';

import { ConfigManager } from '../config/Config.js';
import { 
    Provider, 
    SilenceTimeout 
} from '../config/schema.js';
import { Autostart } from '../startup/Autostart.js';

/**
 * SettingsWindow class provides GTK4/Adwaita UI for configuration
 * Uses Adw.PreferencesWindow for native GNOME settings look
 * 
 * @task T010
 * @epic T001
 * @why User-friendly configuration interface
 * @what Adwaita preferences window with config bindings
 */
export class SettingsWindow {
    private _configManager: ConfigManager;
    private _autostart: Autostart;
    private _window: any | null = null; // Adw.PreferencesWindow
    private _signalIds: number[] = [];

    // Widget references for updating from config changes
    private _providerRow: any | null = null; // Adw.ComboRow
    private _elevenlabsKeyRow: any | null = null; // Adw.PasswordEntryRow
    private _elevenlabsEndpointRow: any | null = null; // Adw.EntryRow
    private _openaiKeyRow: any | null = null; // Adw.PasswordEntryRow
    private _openaiEndpointRow: any | null = null; // Adw.EntryRow
    private _basetenKeyRow: any | null = null; // Adw.PasswordEntryRow
    private _basetenEndpointRow: any | null = null; // Adw.EntryRow
    private _silenceTimeoutRow: any | null = null; // Adw.ComboRow
    private _autostartRow: any | null = null; // Adw.SwitchRow (or ActionRow with Switch)
    private _postProcessingRow: any | null = null; // Adw.SwitchRow
    private _toggleHotkeyRow: any | null = null; // Adw.ActionRow
    private _terminalHotkeyRow: any | null = null; // Adw.ActionRow

    // Providers list for ComboRow
    private readonly _providers = ['elevenlabs', 'openai', 'baseten'];
    private readonly _silenceTimeouts = ['30', '60', '0'];

    /**
     * Create a new SettingsWindow instance
     * 
     * @task T010
     * @epic T001
     * @why Initialize with config manager and autostart
     * @what Sets up window reference and config bindings
     */
    constructor(configManager: ConfigManager, autostart?: Autostart) {
        this._configManager = configManager;
        this._autostart = autostart || new Autostart();

        // Listen for config changes to update UI
        const signalId = this._configManager.connect('changed', () => {
            this._updateUIFromConfig();
        });
        this._signalIds.push(signalId);
    }

    /**
     * Show the settings window
     * 
     * @task T010
     * @epic T001
     * @why Display settings UI
     * @what Creates window if needed and presents it
     * @param {any} [parent] - Optional parent window
     */
    show(parent?: any): void {
        if (!this._window) {
            this._createWindow(parent);
        }
        this._window.present();
    }

    /**
     * Hide the settings window
     * 
     * @task T010
     * @epic T001
     * @why Hide UI without destroying
     * @what Hides the window
     */
    hide(): void {
        if (this._window) {
            this._window.visible = false;
        }
    }

    /**
     * Check if window is visible
     * 
     * @task T010
     * @epic T001
     * @why Check UI state
     * @what Returns visibility status
     * @returns {boolean} True if visible
     */
    isVisible(): boolean {
        return this._window ? this._window.visible : false;
    }

    /**
     * Create the settings window
     * 
     * @task T010
     * @epic T001
     * @why Build UI structure
     * @what Creates Adw.PreferencesWindow and pages
     * @param {any} [parent] - Optional parent window
     * @private
     */
    private _createWindow(parent?: any): void {
        this._window = new Adw.PreferencesWindow({
            title: 'Voyc Settings',
            default_width: 600,
            default_height: 500,
            modal: true,
            destroy_with_parent: true,
        });

        if (parent) {
            this._window.set_transient_for(parent);
        }

        // Add pages
        this._window.add(this._createAPIPage());
        this._window.add(this._createAudioPage());
        this._window.add(this._createHotkeysPage());
        this._window.add(this._createGeneralPage());

        // Connect destroy handler
        this._window.connect('destroy', () => {
            this._window = null;
        });

        // Update UI with current config
        this._updateUIFromConfig();
    }

    /**
     * Create API settings page
     * 
     * @task T010
     * @epic T001
     * @why Configure API providers
     * @what Creates API preferences page
     * @returns {any} PreferencesPage
     * @private
     */
    private _createAPIPage(): any {
        const page = new Adw.PreferencesPage({
            title: 'API',
            icon_name: 'network-server-symbolic',
        });

        // Provider Group
        const providerGroup = new Adw.PreferencesGroup({
            title: 'STT Provider',
            description: 'Select the speech-to-text service provider.',
        });

        // Provider ComboRow
        const providerModel = new Gtk.StringList();
        this._providers.forEach(p => providerModel.append(p));
        
        this._providerRow = new Adw.ComboRow({
            title: 'Provider',
            model: providerModel,
        });
        
        this._providerRow.connect('notify::selected', () => {
            const index = this._providerRow.selected;
            const provider = this._providers[index] as Provider;
            this._configManager.setProvider(provider);
            this._updateProviderVisibility();
        });
        providerGroup.add(this._providerRow);
        page.add(providerGroup);

        // ElevenLabs Group
        const elevenlabsGroup = new Adw.PreferencesGroup({
            title: 'ElevenLabs',
        });

        this._elevenlabsKeyRow = new Adw.PasswordEntryRow({
            title: 'API Key',
        });
        this._elevenlabsKeyRow.connect('changed', () => {
            this._configManager.setElevenlabsApiKey(this._elevenlabsKeyRow.text);
        });
        elevenlabsGroup.add(this._elevenlabsKeyRow);

        this._elevenlabsEndpointRow = new Adw.EntryRow({
            title: 'Endpoint',
        });
        this._elevenlabsEndpointRow.connect('changed', () => {
            this._configManager.update({
                elevenlabsEndpoint: this._elevenlabsEndpointRow.text
            });
        });
        elevenlabsGroup.add(this._elevenlabsEndpointRow);
        page.add(elevenlabsGroup);

        // OpenAI Group
        const openaiGroup = new Adw.PreferencesGroup({
            title: 'OpenAI',
        });

        this._openaiKeyRow = new Adw.PasswordEntryRow({
            title: 'API Key',
        });
        this._openaiKeyRow.connect('changed', () => {
            this._configManager.setOpenaiApiKey(this._openaiKeyRow.text);
        });
        openaiGroup.add(this._openaiKeyRow);

        this._openaiEndpointRow = new Adw.EntryRow({
            title: 'Endpoint',
        });
        this._openaiEndpointRow.connect('changed', () => {
            this._configManager.update({
                openaiEndpoint: this._openaiEndpointRow.text
            });
        });
        openaiGroup.add(this._openaiEndpointRow);
        page.add(openaiGroup);

        // Baseten Group
        const basetenGroup = new Adw.PreferencesGroup({
            title: 'Baseten (Post-processing)',
        });

        this._basetenKeyRow = new Adw.PasswordEntryRow({
            title: 'API Key',
        });
        this._basetenKeyRow.connect('changed', () => {
            this._configManager.setBasetenApiKey(this._basetenKeyRow.text);
        });
        basetenGroup.add(this._basetenKeyRow);

        this._basetenEndpointRow = new Adw.EntryRow({
            title: 'Endpoint',
        });
        this._basetenEndpointRow.connect('changed', () => {
            this._configManager.update({
                basetenEndpoint: this._basetenEndpointRow.text
            });
        });
        basetenGroup.add(this._basetenEndpointRow);
        page.add(basetenGroup);

        return page;
    }

    /**
     * Create Audio settings page
     * 
     * @task T010
     * @epic T001
     * @why Configure audio input
     * @what Creates audio preferences page
     * @returns {any} PreferencesPage
     * @private
     */
    private _createAudioPage(): any {
        const page = new Adw.PreferencesPage({
            title: 'Audio',
            icon_name: 'audio-input-microphone-symbolic',
        });

        const group = new Adw.PreferencesGroup({
            title: 'Input Settings',
        });

        // Device selection (ActionRow with label for now)
        const deviceRow = new Adw.ActionRow({
            title: 'Input Device',
            subtitle: 'Default Device (Detection pending)',
        });
        group.add(deviceRow);

        // Silence Timeout
        const timeoutModel = new Gtk.StringList();
        timeoutModel.append('30 seconds');
        timeoutModel.append('60 seconds');
        timeoutModel.append('Disabled');

        this._silenceTimeoutRow = new Adw.ComboRow({
            title: 'Silence Timeout',
            subtitle: 'Automatically stop recording after silence',
            model: timeoutModel,
        });
        this._silenceTimeoutRow.connect('notify::selected', () => {
            const index = this._silenceTimeoutRow.selected;
            const valueStr = this._silenceTimeouts[index];
            this._configManager.setSilenceTimeout(parseInt(valueStr) as SilenceTimeout);
        });
        group.add(this._silenceTimeoutRow);

        // Test Microphone Button
        const testRow = new Adw.ActionRow({
            title: 'Microphone Test',
        });
        const testBtn = new Gtk.Button({
            label: 'Test',
            valign: Gtk.Align.CENTER,
        });
        testBtn.connect('clicked', () => {
            this._showInfoDialog('Microphone Test', 'Microphone test not yet implemented.');
        });
        testRow.add_suffix(testBtn);
        group.add(testRow);

        page.add(group);
        return page;
    }

    /**
     * Create Hotkeys settings page
     * 
     * @task T010
     * @epic T001
     * @why View hotkeys
     * @what Creates hotkeys preferences page
     * @returns {any} PreferencesPage
     * @private
     */
    private _createHotkeysPage(): any {
        const page = new Adw.PreferencesPage({
            title: 'Hotkeys',
            icon_name: 'input-keyboard-symbolic',
        });

        const group = new Adw.PreferencesGroup({
            title: 'Global Shortcuts',
            description: 'Hotkeys are managed by your system settings via xdg-desktop-portal.',
        });

        this._toggleHotkeyRow = new Adw.ActionRow({
            title: 'Toggle Dictation',
        });
        group.add(this._toggleHotkeyRow);

        this._terminalHotkeyRow = new Adw.ActionRow({
            title: 'Paste as Terminal',
        });
        group.add(this._terminalHotkeyRow);

        page.add(group);
        return page;
    }

    /**
     * Create General settings page
     * 
     * @task T010
     * @epic T001
     * @why Configure app behavior
     * @what Creates general preferences page
     * @returns {any} PreferencesPage
     * @private
     */
    private _createGeneralPage(): any {
        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-system-symbolic',
        });

        const group = new Adw.PreferencesGroup({
            title: 'Application Behavior',
        });

        // Autostart
        this._autostartRow = new Adw.SwitchRow({
            title: 'Start on Login',
            subtitle: 'Automatically start Voyc when you log in',
        });
        this._autostartRow.connect('notify::active', () => {
            const state = this._autostartRow.active;
            this._configManager.setAutostart(state);
            this._autostart.syncWithConfig(state);
        });
        group.add(this._autostartRow);

        // Post-processing
        this._postProcessingRow = new Adw.SwitchRow({
            title: 'Enable Post-processing',
            subtitle: 'Apply LLM post-processing for better formatting',
        });
        this._postProcessingRow.connect('notify::active', () => {
            this._configManager.setEnablePostProcessing(this._postProcessingRow.active);
        });
        group.add(this._postProcessingRow);

        page.add(group);
        
        // Config Info
        const infoGroup = new Adw.PreferencesGroup({
            title: 'Advanced',
        });
        
        const pathRow = new Adw.ActionRow({
            title: 'Configuration File',
            subtitle: this._configManager.configPath,
        });
        // Allow subtitle selection if possible, or just display
        pathRow.set_subtitle_selectable(true);
        infoGroup.add(pathRow);
        
        page.add(infoGroup);

        return page;
    }

    /**
     * Update UI from current config
     * 
     * @task T010
     * @epic T001
     * @why Sync UI with config
     * @what Updates all rows with current config values
     * @private
     */
    private _updateUIFromConfig(): void {
        const config = this._configManager.config;

        // Update provider combo
        if (this._providerRow) {
            const index = this._providers.indexOf(config.provider);
            if (index !== -1) {
                this._providerRow.selected = index;
            }
        }

        // Update entries
        if (this._elevenlabsKeyRow) this._elevenlabsKeyRow.text = config.elevenlabsApiKey;
        if (this._elevenlabsEndpointRow) this._elevenlabsEndpointRow.text = config.elevenlabsEndpoint;
        if (this._openaiKeyRow) this._openaiKeyRow.text = config.openaiApiKey;
        if (this._openaiEndpointRow) this._openaiEndpointRow.text = config.openaiEndpoint;
        if (this._basetenKeyRow) this._basetenKeyRow.text = config.basetenApiKey;
        if (this._basetenEndpointRow) this._basetenEndpointRow.text = config.basetenEndpoint;

        // Update silence timeout
        if (this._silenceTimeoutRow) {
            const valStr = config.silenceTimeout.toString();
            const index = this._silenceTimeouts.indexOf(valStr);
            if (index !== -1) {
                this._silenceTimeoutRow.selected = index;
            }
        }

        // Update switches
        if (this._autostartRow) this._autostartRow.active = config.autostart;
        if (this._postProcessingRow) this._postProcessingRow.active = config.enablePostProcessing;

        // Update hotkey labels
        if (this._toggleHotkeyRow) this._toggleHotkeyRow.subtitle = config.hotkeys.toggleDictation;
        if (this._terminalHotkeyRow) this._terminalHotkeyRow.subtitle = config.hotkeys.pasteAsTerminal;

        this._updateProviderVisibility();
    }

    /**
     * Update visibility of provider sections
     * 
     * @task T010
     * @epic T001
     * @why Show relevant settings
     * @what Adjusts UI based on selected provider
     * @private
     */
    private _updateProviderVisibility(): void {
        // In Adw.PreferencesWindow, we might want to disable/dim groups, 
        // but for now, we'll keep them all visible for easy access.
    }

    /**
     * Show info dialog
     * 
     * @task T010
     * @epic T001
     * @why Display messages to user
     * @what Shows Adw.MessageDialog
     * @param {string} title - Dialog title
     * @param {string} message - Dialog message
     * @private
     */
    private _showInfoDialog(title: string, message: string): void {
        // Use Adw.MessageDialog if available, or Gtk.AlertDialog (new in 4.10)
        // or classic Gtk.MessageDialog (deprecated-ish but works)
        
        const dialog = new Adw.MessageDialog({
            heading: title,
            body: message,
            transient_for: this._window,
        });
        
        dialog.add_response('ok', 'OK');
        
        dialog.connect('response', () => {
            dialog.close();
        });
        
        dialog.present();
    }

    /**
     * Cleanup resources
     * 
     * @task T010
     * @epic T001
     * @why Cleanup on destroy
     * @what Disconnects signals and destroys window
     */
    destroy(): void {
        for (const signalId of this._signalIds) {
            this._configManager.disconnect(signalId);
        }
        this._signalIds = [];

        if (this._window) {
            this._window.destroy();
            this._window = null;
        }
    }
}