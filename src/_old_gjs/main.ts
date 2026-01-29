/**
 * @task T015
 * @epic T001
 * @why Fully integrated Voyc with system tray and proper config
 * @what GTK4 app with SNI tray, toggle controls, and working config
 */

import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio?version=2.0';
import GLib from 'gi://GLib?version=2.0';
import GObject from 'gi://GObject?version=2.0';

import { StatusNotifierItem, TrayState } from './ui/TraySNI.js';

// Dictation pipeline imports
// Note: DictationEngine and its dependencies use GJS-style imports internally,
// which work alongside ESM imports in GJS runtime
import { DictationEngine, DictationEngineConfig } from './dictation/DictationEngine.js';
import { ConfigManager as DictationConfigManager } from './config/Config.js';
import { PipeWireCapture } from './audio/PipeWireCapture.js';
import { DictationHotkeys } from './hotkeys/PortalHotkey.js';
import { TrayIndicator } from './ui/TrayIndicator.js';
import { StatusIcon } from './ui/StatusIcon.js';
import { ProviderFactory } from './stt/ProviderFactory.js';
import { createPipeline } from './postprocess/Pipeline.js';
import { TextInjector } from './inject/TextInjector.js';
import { Logger, LogLevel } from './logging/Logger.js';
import { MetricsTracker } from './logging/metrics.js';
import { LifecycleManager, LifecycleCallbacks } from './startup/Lifecycle.js';
import {
    VersionChecker,
    scheduleVersionCheck,
    shouldCheckForUpdates,
    getCurrentISODate,
    type UpdateInfo
} from './updates/VersionChecker.js';

const APP_ID = 'com.voyc.app';
const APP_NAME = 'Voyc';

/**
 * Config interface
 */
interface VoycConfig {
  provider: 'elevenlabs' | 'openai';
  elevenlabsApiKey: string;
  elevenlabsEndpoint: string;
  openaiApiKey: string;
  openaiEndpoint: string;
  silenceTimeout: number;
  autostart: boolean;
  enablePostProcessing: boolean;
  checkForUpdates: boolean;
  hotkeys: {
    toggleDictation: string;
    pasteAsTerminal: string;
  };
}

/**
 * Default config with user-friendly hotkeys
 */
const DEFAULT_CONFIG: VoycConfig = {
  provider: 'elevenlabs',
  elevenlabsApiKey: '',
  elevenlabsEndpoint: 'https://api.elevenlabs.io/v1',
  openaiApiKey: '',
  openaiEndpoint: 'https://api.openai.com/v1',
  silenceTimeout: 30,
  autostart: true,
  enablePostProcessing: true,
  checkForUpdates: true,
  hotkeys: {
    toggleDictation: '<Ctrl><Alt>d',
    pasteAsTerminal: '<Ctrl><Alt>t',
  },
};

/**
 * @task T015
 * @epic T001
 * @why Config manager that properly saves and loads
 * @what XDG config with immediate save on change
 */
class ConfigManager extends GObject.Object {
  private config: VoycConfig;
  private configPath: string;

  static {
    GObject.registerClass({
      GTypeName: 'VoycConfigManager',
      Signals: {
        'changed': { param_types: [] },
      },
    }, ConfigManager);
  }

  constructor() {
    super();
    const configDir = GLib.get_user_config_dir() + '/voyc';
    this.configPath = configDir + '/config.json';
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    this.load();
  }

  load(): boolean {
    try {
      const file = Gio.File.new_for_path(this.configPath);
      if (!file.query_exists(null)) {
        print('Config not found, creating default at ' + this.configPath);
        this.save();
        return true;
      }

      const [success, contents] = file.load_contents(null);
      if (success && contents) {
        const decoder = new TextDecoder();
        const loaded = JSON.parse(decoder.decode(contents));
        this.config = { ...DEFAULT_CONFIG, ...loaded };
        print('Config loaded from ' + this.configPath);
        return true;
      }
    } catch (e) {
      print('Error loading config: ' + e);
    }
    return false;
  }

  save(): boolean {
    try {
      const configDir = GLib.get_user_config_dir() + '/voyc';
      GLib.mkdir_with_parents(configDir, 0o755);

      const file = Gio.File.new_for_path(this.configPath);
      const json = JSON.stringify(this.config, null, 2);
      const bytes = new TextEncoder().encode(json);

      file.replace_contents(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
      print('Config saved to ' + this.configPath);
      this.emit('changed');
      return true;
    } catch (e) {
      print('Error saving config: ' + e);
      return false;
    }
  }

  getConfig(): VoycConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  setElevenLabsKey(key: string): void {
    this.config.elevenlabsApiKey = key;
    this.save();
  }

  setOpenAIKey(key: string): void {
    this.config.openaiApiKey = key;
    this.save();
  }

  setProvider(provider: 'elevenlabs' | 'openai'): void {
    this.config.provider = provider;
    this.save();
  }

  setAutostart(enabled: boolean): void {
    this.config.autostart = enabled;
    this.save();
  }

  setPostProcessing(enabled: boolean): void {
    this.config.enablePostProcessing = enabled;
    this.save();
  }

  setSilenceTimeout(timeout: number): void {
    this.config.silenceTimeout = timeout;
    this.save();
  }

  setCheckForUpdates(enabled: boolean): void {
    this.config.checkForUpdates = enabled;
    this.save();
  }
}

/**
 * @task T015
 * @epic T001
 * @why Main application with tray and toggle
 * @what Full-featured app with all controls working
 */
class VoycApp extends Adw.Application {
  private configManager!: ConfigManager;
  private tray!: StatusNotifierItem;
  private mainWindow: any = null;
  private settingsDialog: any = null;
  private toggleButton: any = null;
  private statusLabel: any = null;
  private isDictating: boolean = false;

  // Dictation engine and dependencies
  private dictationEngine: DictationEngine | null = null;
  private dictationConfigManager: DictationConfigManager | null = null;
  private logger: Logger | null = null;

  // Version checker for update notifications (T023)
  private versionChecker: VersionChecker | null = null;

  static {
    GObject.registerClass({ GTypeName: 'VoycApp' }, VoycApp);
  }

  constructor() {
    super({ application_id: APP_ID, flags: Gio.ApplicationFlags.FLAGS_NONE });
    print('Voyc starting...');
  }

  vfunc_startup(): void {
    super.vfunc_startup();

    // Keep app running even when no windows are visible (tray mode)
    this.hold();

    this.configManager = new ConfigManager();

    // Initialize system tray
    this.tray = new StatusNotifierItem();
    const trayInitialized = this.tray.init();

    if (!trayInitialized) {
      print('Warning: System tray not available, showing window instead');
    }

    this.tray.connect('toggle-dictation', () => this.toggleDictation());
    this.tray.connect('show-settings', () => this.activate());
    this.tray.connect('quit', () => this.quit());

    const config = this.configManager.getConfig();
    const hasKey = config.elevenlabsApiKey || config.openaiApiKey;

    if (!hasKey) {
      // Show welcome dialog after startup
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
        this.activate();
        this.showFirstRunDialog();
        return GLib.SOURCE_REMOVE;
      });
    }

    // Initialize DictationEngine asynchronously after startup
    // Using a short delay to let the main loop settle
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
      this.initializeDictationEngine().catch((error) => {
        print(`DictationEngine init failed: ${error}`);
      });
      return GLib.SOURCE_REMOVE;
    });

    // Schedule non-blocking version check (T023)
    // Runs after engine init to avoid delaying startup
    GLib.timeout_add(GLib.PRIORITY_LOW, 3000, () => {
      this.checkForUpdatesIfEnabled();
      return GLib.SOURCE_REMOVE;
    });

    print('Voyc ready - Ctrl+Alt+D to dictate');
  }

  vfunc_activate(): void {
    if (!this.mainWindow) {
      this.createMainWindow();
    }
    this.mainWindow.present();
  }

  private createMainWindow(): void {
    const config = this.configManager.getConfig();
    const hasKey = config.elevenlabsApiKey || config.openaiApiKey;

    this.mainWindow = new Adw.ApplicationWindow({
      application: this,
      title: 'Voyc',
      default_width: 500,
      default_height: 500,
    });

    const toolbarView = new Adw.ToolbarView();
    const headerBar = new Adw.HeaderBar();
    
    const settingsBtn = new Gtk.Button({
      icon_name: 'emblem-system-symbolic',
      tooltip_text: 'Settings',
    });
    settingsBtn.connect('clicked', () => this.showSettings());
    headerBar.pack_end(settingsBtn);
    
    toolbarView.add_top_bar(headerBar);

    const content = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 20,
      margin_top: 24,
      margin_bottom: 24,
      margin_start: 24,
      margin_end: 24,
    });

    const title = new Gtk.Label({ label: 'Voyc', css_classes: ['title-1'] });
    content.append(title);

    const subtitle = new Gtk.Label({
      label: 'Voice Dictation',
      css_classes: ['subtitle'],
      margin_bottom: 16,
    });
    content.append(subtitle);

    // Status
    const statusCard = new Adw.PreferencesGroup({ title: 'Status', margin_bottom: 16 });
    this.statusLabel = new Gtk.Label({ label: this.getStatusText(), wrap: true });
    const statusRow = new Adw.ActionRow({ title: hasKey ? 'Ready' : 'Configuration Required' });
    statusRow.add_suffix(this.statusLabel);
    statusCard.add(statusRow);
    content.append(statusCard);

    // TOGGLE BUTTON
    const toggleGroup = new Adw.PreferencesGroup({ title: 'Dictation Control', margin_bottom: 16 });
    this.toggleButton = new Gtk.Button({
      label: 'Start Dictation',
      css_classes: ['suggested-action', 'pill'],
      height_request: 56,
    });
    this.toggleButton.connect('clicked', () => this.toggleDictation());
    const toggleRow = new Adw.ActionRow();
    toggleRow.add_suffix(this.toggleButton);
    toggleGroup.add(toggleRow);
    content.append(toggleGroup);

    // Hotkeys
    const hotkeyGroup = new Adw.PreferencesGroup({
      title: 'Keyboard Shortcuts',
      description: 'Global hotkeys work from anywhere',
      margin_bottom: 16,
    });

    const toggleHotkeyRow = new Adw.ActionRow({
      title: 'Toggle Dictation',
      subtitle: this.formatHotkey(config.hotkeys.toggleDictation),
    });
    toggleHotkeyRow.add_suffix(new Gtk.Image({ icon_name: 'input-keyboard-symbolic' }));
    hotkeyGroup.add(toggleHotkeyRow);

    const terminalHotkeyRow = new Adw.ActionRow({
      title: 'Paste in Terminal',
      subtitle: this.formatHotkey(config.hotkeys.pasteAsTerminal),
    });
    terminalHotkeyRow.add_suffix(new Gtk.Image({ icon_name: 'utilities-terminal-symbolic' }));
    hotkeyGroup.add(terminalHotkeyRow);

    content.append(hotkeyGroup);

    // Provider status
    const providerGroup = new Adw.PreferencesGroup({ title: 'Configuration' });
    const providerRow = new Adw.ActionRow({
      title: 'Speech-to-Text Provider',
      subtitle: config.provider === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI',
    });
    
    const hasProviderKey = config.provider === 'elevenlabs' 
      ? !!config.elevenlabsApiKey 
      : !!config.openaiApiKey;
    
    providerRow.add_suffix(new Gtk.Image({
      icon_name: hasProviderKey ? 'emblem-ok-symbolic' : 'dialog-warning-symbolic',
    }));
    providerRow.activatable = true;
    providerRow.connect('activated', () => this.showSettings());
    providerGroup.add(providerRow);
    content.append(providerGroup);

    // Settings button
    const openSettingsBtn = new Gtk.Button({
      label: 'Open Settings',
      margin_top: 16,
      halign: Gtk.Align.CENTER,
    });
    openSettingsBtn.connect('clicked', () => this.showSettings());
    content.append(openSettingsBtn);

    toolbarView.set_content(content);
    this.mainWindow.set_content(toolbarView);

    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
      this.updateUI();
      return GLib.SOURCE_CONTINUE;
    });
  }

  private getStatusText(): string {
    const config = this.configManager.getConfig();
    const hasKey = config.elevenlabsApiKey || config.openaiApiKey;
    if (!hasKey) return 'Add API key in Settings';
    if (this.isDictating) return '🔴 Listening...';
    return 'Ready';
  }

  private updateUI(): void {
    if (this.statusLabel) this.statusLabel.label = this.getStatusText();
    
    if (this.toggleButton) {
      this.toggleButton.label = this.isDictating ? 'Stop Dictation' : 'Start Dictation';
      const ctx = this.toggleButton.get_style_context();
      if (this.isDictating) {
        ctx.add_class('destructive-action');
        ctx.remove_class('suggested-action');
      } else {
        ctx.add_class('suggested-action');
        ctx.remove_class('destructive-action');
      }
    }
  }

  private toggleDictation(): void {
    const config = this.configManager.getConfig();
    const hasKey = config.elevenlabsApiKey || config.openaiApiKey;

    if (!hasKey) {
      this.showSettings();
      return;
    }

    // Delegate to DictationEngine if available
    if (this.dictationEngine) {
      this.dictationEngine.toggleDictation();
    } else {
      // Fallback: simple toggle (for when engine init failed)
      this.isDictating = !this.isDictating;
      this.updateUI();
      this.tray.setState(this.isDictating ? 'listening' : 'idle');
      print(this.isDictating ? 'Dictation started (fallback)' : 'Dictation stopped (fallback)');
    }
  }

  /**
   * Initialize the DictationEngine with all dependencies
   * Called asynchronously after startup to avoid blocking the main loop
   */
  private async initializeDictationEngine(): Promise<void> {
    try {
      print('Initializing DictationEngine...');

      // Create logger
      this.logger = new Logger({
        component: 'voyc',
        minLevel: LogLevel.INFO,
      });

      // Create the dictation config manager (uses GJS-style imports internally)
      this.dictationConfigManager = new DictationConfigManager();
      const dictConfig = this.dictationConfigManager.config;

      // Create StatusIcon for tray state management
      const statusIcon = new StatusIcon();
      statusIcon.onStateChange((state) => {
        // Map StatusIcon state to SNI tray
        this.tray.setState(state);
      });

      // Create TrayIndicator (GTK4 placeholder - uses notifications)
      const trayIndicator = new TrayIndicator(
        statusIcon,
        this.dictationConfigManager,
        {
          onToggle: () => this.toggleDictation(),
          onSettings: () => this.activate(),
          onQuit: () => this.quit(),
        }
      );

      // Create PipeWireCapture for audio
      const capture = new PipeWireCapture({
        silenceTimeout: dictConfig.silenceTimeout,
      });

      // Create DictationHotkeys for global shortcuts
      const hotkeys = new DictationHotkeys();

      // Create ProviderFactory for STT
      const providerFactory = new ProviderFactory({
        logger: this.logger,
        config: dictConfig,
      });

      // Create PostProcessPipeline
      const pipeline = createPipeline(dictConfig, this.logger);

      // Create TextInjector for clipboard/paste
      const injector = new TextInjector();

      // Create MetricsTracker
      const metrics = new MetricsTracker(
        this.logger,
        dictConfig.latencyThresholds
      );

      // Create LifecycleManager
      const lifecycleCallbacks: LifecycleCallbacks = {
        onShowSettings: () => this.activate(),
        onToggleDictation: () => this.toggleDictation(),
        onShutdown: () => this.quit(),
      };
      const lifecycle = new LifecycleManager(this.dictationConfigManager, lifecycleCallbacks);

      // Create the DictationEngine with all dependencies
      this.dictationEngine = new DictationEngine(
        this.dictationConfigManager,
        capture,
        hotkeys,
        trayIndicator,
        statusIcon,
        providerFactory,
        pipeline,
        injector,
        this.logger,
        metrics,
        lifecycle
      );

      // Connect engine signals to update UI
      this.dictationEngine.connect('dictation-started', (_engine: any, sessionId: string) => {
        this.isDictating = true;
        this.updateUI();
        this.tray.setState('listening');
        print(`Dictation started (session: ${sessionId})`);
      });

      this.dictationEngine.connect('dictation-stopped', (_engine: any, sessionId: string) => {
        this.tray.setState('processing');
        print(`Dictation stopped, processing... (session: ${sessionId})`);
      });

      this.dictationEngine.connect('dictation-complete', (_engine: any, sessionId: string) => {
        this.isDictating = false;
        this.updateUI();
        this.tray.setState('idle');
        print(`Dictation complete (session: ${sessionId})`);
      });

      this.dictationEngine.connect('dictation-error', (_engine: any, errorMsg: string) => {
        this.isDictating = false;
        this.updateUI();
        this.tray.setState('error');
        print(`Dictation error: ${errorMsg}`);

        // Reset to idle after a short delay
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => {
          if (!this.isDictating) {
            this.tray.setState('idle');
          }
          return GLib.SOURCE_REMOVE;
        });
      });

      // Initialize the engine (sets up hotkeys, etc.)
      const initSuccess = await this.dictationEngine.init();
      if (initSuccess) {
        print('DictationEngine initialized successfully');
      } else {
        print('DictationEngine initialized with warnings (hotkeys may not be available)');
      }

    } catch (error) {
      print(`Failed to initialize DictationEngine: ${(error as Error).message}`);
      // Continue without engine - fallback mode will be used
      this.dictationEngine = null;
    }
  }

  /**
   * Check for updates if enabled and enough time has passed
   *
   * @task T023
   * @epic T001
   * @why Non-blocking update check respecting user preferences
   * @what Checks GitHub for newer versions and shows notification
   */
  private checkForUpdatesIfEnabled(): void {
    // Use local config manager for update preference
    const config = this.configManager.getConfig();
    const checkEnabled = config.checkForUpdates;

    if (!checkEnabled) {
      print('Update check disabled by user preference');
      return;
    }

    // Check if enough time has passed since last check (24 hours)
    const lastCheck = this.dictationConfigManager?.config.lastUpdateCheck ?? null;
    if (!shouldCheckForUpdates(lastCheck)) {
      print('Skipping update check - checked recently');
      return;
    }

    print('Checking for updates...');

    // Get current version from package.json (hardcoded for now, can be read at build time)
    const currentVersion = '1.0.0'; // TODO: Read from package.json at build time

    // GitHub repo configuration (placeholder - update when repo is public)
    const repoOwner = 'OWNER';  // TODO: Update with actual owner
    const repoName = 'voyc';    // TODO: Update with actual repo name

    this.versionChecker = new VersionChecker({
      currentVersion,
      repoOwner,
      repoName,
      onUpdateAvailable: (info: UpdateInfo) => {
        print(`Update available: ${info.currentVersion} -> ${info.latestVersion}`);
        this.showUpdateNotification(info);
      },
      onError: (error: Error) => {
        // Silent fail - just log for debugging
        print(`Update check failed: ${error.message}`);
      },
    });

    this.versionChecker.checkForUpdates().then(() => {
      // Record that we checked (even if no update found)
      if (this.dictationConfigManager) {
        this.dictationConfigManager.setLastUpdateCheck(getCurrentISODate());
      }
    }).catch(() => {
      // Silent fail
    });
  }

  /**
   * Show notification when update is available
   *
   * @task T023
   * @epic T001
   * @why Inform user about available updates
   * @what Shows desktop notification via notify-send
   * @param {UpdateInfo} info - Update information
   */
  private showUpdateNotification(info: UpdateInfo): void {
    try {
      const title = 'Voyc Update Available';
      const message = `Version ${info.latestVersion} is available (you have ${info.currentVersion})`;

      const escapedTitle = GLib.shell_quote(title);
      const escapedMessage = GLib.shell_quote(message);
      const command = `notify-send -a Voyc -i software-update-available ${escapedTitle} ${escapedMessage}`;

      GLib.spawn_command_line_async(command);
      print(`Update notification shown: ${message}`);
    } catch (e) {
      print(`Failed to show update notification: ${e}`);
    }
  }

  private formatHotkey(hotkey: string): string {
    // Parse GTK accelerator format like "<Ctrl><Alt>d" into "Ctrl + Alt + D"
    const modifiers: string[] = [];
    let key = hotkey;

    if (key.includes('<Primary>') || key.includes('<Ctrl>')) {
      modifiers.push('Ctrl');
      key = key.replace(/<Primary>/g, '').replace(/<Ctrl>/g, '');
    }
    if (key.includes('<Shift>')) {
      modifiers.push('Shift');
      key = key.replace(/<Shift>/g, '');
    }
    if (key.includes('<Alt>')) {
      modifiers.push('Alt');
      key = key.replace(/<Alt>/g, '');
    }
    if (key.includes('<Super>')) {
      modifiers.push('Super');
      key = key.replace(/<Super>/g, '');
    }

    // Clean up remaining brackets and get the key
    key = key.replace(/[<>]/g, '').toUpperCase();

    if (modifiers.length > 0) {
      return [...modifiers, key].join(' + ');
    }
    return key;
  }

  private showSettings(): void {
    if (this.settingsDialog) this.settingsDialog.destroy();

    const config = this.configManager.getConfig();

    this.settingsDialog = new Adw.PreferencesWindow({
      transient_for: this.mainWindow,
      title: 'Voyc Settings',
      default_width: 600,
      default_height: 550,
      modal: true,
    });

    // API Page
    const apiPage = new Adw.PreferencesPage({ title: 'API', icon_name: 'network-server-symbolic' });
    const providerGroup = new Adw.PreferencesGroup({
      title: 'Speech-to-Text Provider',
      description: 'Choose your provider and enter API key',
    });

    const providerRow = new Adw.ComboRow({
      title: 'Provider',
      model: Gtk.StringList.new(['ElevenLabs', 'OpenAI']),
      selected: config.provider === 'elevenlabs' ? 0 : 1,
    });
    providerRow.connect('notify::selected', () => {
      this.configManager.setProvider(providerRow.selected === 0 ? 'elevenlabs' : 'openai');
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
        this.settingsDialog.destroy();
        this.showSettings();
        return GLib.SOURCE_REMOVE;
      });
    });
    providerGroup.add(providerRow);

    if (config.provider === 'elevenlabs') {
      const keyRow = new Adw.PasswordEntryRow({
        title: 'ElevenLabs API Key',
        text: config.elevenlabsApiKey,
        show_apply_button: true,
      });
      keyRow.connect('apply', () => {
        this.configManager.setElevenLabsKey(keyRow.text);
        this.showToast('API key saved');
      });
      providerGroup.add(keyRow);
    } else {
      const keyRow = new Adw.PasswordEntryRow({
        title: 'OpenAI API Key',
        text: config.openaiApiKey,
        show_apply_button: true,
      });
      keyRow.connect('apply', () => {
        this.configManager.setOpenAIKey(keyRow.text);
        this.showToast('API key saved');
      });
      providerGroup.add(keyRow);
    }

    apiPage.add(providerGroup);
    this.settingsDialog.add(apiPage);

    // Audio Page
    const audioPage = new Adw.PreferencesPage({ title: 'Audio', icon_name: 'audio-input-microphone-symbolic' });
    const audioGroup = new Adw.PreferencesGroup({ title: 'Recording Settings' });

    const silenceRow = new Adw.ComboRow({
      title: 'Silence Timeout',
      subtitle: 'Stop recording after silence',
      model: Gtk.StringList.new(['30 seconds', '60 seconds', 'Disabled']),
      selected: config.silenceTimeout === 30 ? 0 : config.silenceTimeout === 60 ? 1 : 2,
    });
    silenceRow.connect('notify::selected', () => {
      const timeouts = [30, 60, 0];
      this.configManager.setSilenceTimeout(timeouts[silenceRow.selected]);
    });
    audioGroup.add(silenceRow);
    audioPage.add(audioGroup);
    this.settingsDialog.add(audioPage);

    // General Page
    const generalPage = new Adw.PreferencesPage({ title: 'General', icon_name: 'applications-system-symbolic' });
    const generalGroup = new Adw.PreferencesGroup({ title: 'Application Settings' });

    const autostartRow = new Adw.SwitchRow({
      title: 'Start on Login',
      subtitle: 'Automatically start Voyc when you log in',
      active: config.autostart,
    });
    autostartRow.connect('notify::active', () => {
      this.configManager.setAutostart(autostartRow.active);
    });
    generalGroup.add(autostartRow);

    const postProcessRow = new Adw.SwitchRow({
      title: 'Smart Formatting',
      subtitle: 'Use AI to improve punctuation and capitalization',
      active: config.enablePostProcessing,
    });
    postProcessRow.connect('notify::active', () => {
      this.configManager.setPostProcessing(postProcessRow.active);
    });
    generalGroup.add(postProcessRow);

    const updateCheckRow = new Adw.SwitchRow({
      title: 'Check for Updates',
      subtitle: 'Notify when a new version is available',
      active: config.checkForUpdates,
    });
    updateCheckRow.connect('notify::active', () => {
      this.configManager.setCheckForUpdates(updateCheckRow.active);
      // Also update the dictation config manager if available
      if (this.dictationConfigManager) {
        this.dictationConfigManager.setCheckForUpdates(updateCheckRow.active);
      }
    });
    generalGroup.add(updateCheckRow);

    generalPage.add(generalGroup);
    this.settingsDialog.add(generalPage);

    this.settingsDialog.present();
  }

  private showToast(message: string): void {
    if (this.settingsDialog) {
      this.settingsDialog.add_toast(new Adw.Toast({ title: message, timeout: 2 }));
    }
  }

  private showFirstRunDialog(): void {
    const dialog = new Adw.MessageDialog({
      transient_for: this.mainWindow,
      heading: 'Welcome to Voyc',
      body: 'To use voice dictation, you need to add an API key.\n\nVoyc supports ElevenLabs and OpenAI.',
    });

    dialog.add_response('later', 'Later');
    dialog.add_response('setup', 'Add API Key');
    dialog.set_response_appearance('setup', Adw.ResponseAppearance.SUGGESTED);

    dialog.connect('response', (_: any, response: string) => {
      if (response === 'setup') this.showSettings();
      dialog.destroy();
    });

    dialog.present();
  }

  vfunc_shutdown(): void {
    print('Voyc shutting down...');

    // Cancel any pending version check (T023)
    if (this.versionChecker) {
      this.versionChecker.cancel();
      this.versionChecker = null;
    }

    // Dispose DictationEngine and its dependencies
    if (this.dictationEngine) {
      try {
        this.dictationEngine.dispose();
        print('DictationEngine disposed');
      } catch (error) {
        print(`Error disposing DictationEngine: ${(error as Error).message}`);
      }
      this.dictationEngine = null;
    }

    if (this.tray) this.tray.dispose();
    this.release();
    super.vfunc_shutdown();
  }
}

// Native Wayland - let GTK4 auto-detect backend
// Do NOT set GDK_BACKEND=x11 as Fedora 43+ is Wayland-only

print('Starting Voyc...');
const app = new VoycApp();
const exitCode = (app as any).run([]);
print('Exit code: ' + exitCode);
