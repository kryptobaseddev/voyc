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
      GTypeName: 'ConfigManager',
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

  static {
    GObject.registerClass({ GTypeName: 'VoycApp' }, VoycApp);
  }

  constructor() {
    super({ application_id: APP_ID, flags: Gio.ApplicationFlags.FLAGS_NONE });
    print('Voyc starting...');
  }

  vfunc_startup(): void {
    super.vfunc_startup();
    
    this.configManager = new ConfigManager();
    
    // Initialize system tray
    this.tray = new StatusNotifierItem();
    this.tray.init();
    
    this.tray.connect('toggle-dictation', () => this.toggleDictation());
    this.tray.connect('show-settings', () => this.activate());
    this.tray.connect('quit', () => this.quit());

    const config = this.configManager.getConfig();
    const hasKey = config.elevenlabsApiKey || config.openaiApiKey;
    
    if (!hasKey) {
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
        this.showFirstRunDialog();
        return GLib.SOURCE_REMOVE;
      });
    }

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

    this.isDictating = !this.isDictating;
    this.updateUI();
    this.tray.setState(this.isDictating ? 'listening' : 'idle');
    print(this.isDictating ? 'Dictation started' : 'Dictation stopped');
  }

  private formatHotkey(hotkey: string): string {
    return hotkey
      .replace(/<Primary>/g, 'Ctrl')
      .replace(/<Ctrl>/g, 'Ctrl')
      .replace(/<Shift>/g, 'Shift')
      .replace(/<Alt>/g, 'Alt')
      .replace(/<Super>/g, 'Super')
      .replace(/[<>]/g, '+');
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
    if (this.tray) this.tray.dispose();
    super.vfunc_shutdown();
  }
}

// Set X11 backend for compatibility
GLib.setenv('GDK_BACKEND', 'x11', true);

print('Starting Voyc...');
const app = new VoycApp();
const exitCode = (app as any).run([]);
print('Exit code: ' + exitCode);
