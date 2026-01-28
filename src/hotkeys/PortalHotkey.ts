/**
 * @task T009
 * @epic T001
 * @why Wayland-safe global hotkeys via xdg-desktop-portal
 * @what Portal-based global shortcut manager for dictation triggers
 */

// GJS-style imports
import Gio from 'gi://Gio?version=2.0';
import GLib from 'gi://GLib?version=2.0';

/**
 * @task T009
 * @epic T001
 * @why D-Bus interface definition for org.freedesktop.portal.GlobalShortcuts
 * @what XML interface for portal global shortcuts
 */
const GLOBAL_SHORTCUTS_INTERFACE = `
<node>
  <interface name="org.freedesktop.portal.GlobalShortcuts">
    <method name="CreateSession">
      <arg type="a{sv}" name="options" direction="in"/>
      <arg type="o" name="handle" direction="out"/>
    </method>
    <method name="BindShortcuts">
      <arg type="o" name="session_handle" direction="in"/>
      <arg type="a(sa{sv})" name="shortcuts" direction="in"/>
      <arg type="s" name="parent_window" direction="in"/>
      <arg type="a{sv}" name="options" direction="in"/>
      <arg type="o" name="request_handle" direction="out"/>
    </method>
    <method name="ListShortcuts">
      <arg type="o" name="session_handle" direction="in"/>
      <arg type="a{sv}" name="options" direction="in"/>
      <arg type="o" name="request_handle" direction="out"/>
    </method>
    <method name="ConfigureShortcuts">
      <arg type="o" name="session_handle" direction="in"/>
      <arg type="s" name="parent_window" direction="in"/>
      <arg type="a{sv}" name="options" direction="in"/>
    </method>
    <signal name="Activated">
      <arg type="o" name="session_handle"/>
      <arg type="s" name="shortcut_id"/>
      <arg type="t" name="timestamp"/>
      <arg type="a{sv}" name="options"/>
    </signal>
    <signal name="Deactivated">
      <arg type="o" name="session_handle"/>
      <arg type="s" name="shortcut_id"/>
      <arg type="t" name="timestamp"/>
      <arg type="a{sv}" name="options"/>
    </signal>
    <signal name="ShortcutsChanged">
      <arg type="o" name="session_handle"/>
      <arg type="a(sa{sv})" name="shortcuts"/>
    </signal>
    <property name="version" type="u" access="read"/>
  </interface>
</node>
`;

/**
 * @task T009
 * @epic T001
 * @why D-Bus interface definition for org.freedesktop.portal.Request
 * @what XML interface for portal request objects
 */
const REQUEST_INTERFACE = `
<node>
  <interface name="org.freedesktop.portal.Request">
    <method name="Close"/>
    <signal name="Response">
      <arg type="u" name="response"/>
      <arg type="a{sv}" name="results"/>
    </signal>
  </interface>
</node>
`;

/**
 * @task T009
 * @epic T001
 * @why Callback type for shortcut activation
 * @what Function signature for hotkey callbacks
 */
type ShortcutCallback = (shortcutId: string, timestamp: number) => void;

/**
 * @task T009
 * @epic T001
 * @why Configuration for a single shortcut
 * @what Defines shortcut properties and callback
 */
interface ShortcutConfig {
  id: string;
  description: string;
  preferredTrigger: string;
  callback: ShortcutCallback;
}

/**
 * @task T009
 * @epic T001
 * @why Portal session state tracking
 * @what Enum for session lifecycle states
 */
export type SessionStateType = 'idle' | 'creating' | 'active' | 'binding' | 'error';

export const SessionState = {
  IDLE: 'idle' as SessionStateType,
  CREATING: 'creating' as SessionStateType,
  ACTIVE: 'active' as SessionStateType,
  BINDING: 'binding' as SessionStateType,
  ERROR: 'error' as SessionStateType,
};

/**
 * @task T009
 * @epic T001
 * @why Portal availability status
 * @what Enum for portal availability states
 */
export type PortalStatusType = 'unknown' | 'available' | 'unavailable';

export const PortalStatus = {
  UNKNOWN: 'unknown' as PortalStatusType,
  AVAILABLE: 'available' as PortalStatusType,
  UNAVAILABLE: 'unavailable' as PortalStatusType,
};

/**
 * @task T009
 * @epic T001
 * @why Response codes from portal Request
 * @what Portal response code constants
 */
const PortalResponse = {
  SUCCESS: 0,
  CANCELLED: 1,
  OTHER: 2,
};

/**
 * @task T009
 * @epic T001
 * @why Portal service constants
 * @what D-Bus service names and paths
 */
const PORTAL_SERVICE = 'org.freedesktop.portal.Desktop';
const PORTAL_OBJECT_PATH = '/org/freedesktop/portal/desktop';
const PORTAL_GLOBAL_SHORTCUTS_INTERFACE = 'org.freedesktop.portal.GlobalShortcuts';

/**
 * @task T009
 * @epic T001
 * @why Main portal hotkey manager class
 * @what Manages portal session, shortcut registration, and signal handling
 */
export class PortalHotkeyManager {
  private _globalShortcutsProxy: any | null = null;
  private _sessionHandle: string | null = null;
  private _state: SessionStateType = SessionState.IDLE;
  private _status: PortalStatusType = PortalStatus.UNKNOWN;
  private _shortcuts: Map<string, ShortcutConfig> = new Map();
  private _signalConnections: number[] = [];
  private _requestProxies: Map<string, any> = new Map();
  private _onErrorCallback: ((error: Error) => void) | null = null;

  /**
   * @task T009
   * @epic T001
   * @why Check if portal is available
   * @what Probes for GlobalShortcuts portal on D-Bus
   */
  async checkAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
        this._status = PortalStatus.UNAVAILABLE;
        resolve(false);
        return GLib.SOURCE_REMOVE;
      });

      Gio.DBus.session.call(
        PORTAL_SERVICE,
        PORTAL_OBJECT_PATH,
        'org.freedesktop.DBus.Introspectable',
        'Introspect',
        null,
        new GLib.VariantType('(s)'),
        Gio.DBusCallFlags.NONE,
        5000,
        null,
        (connection: any, result: any) => {
          GLib.source_remove(timeoutId);
          try {
            const reply = connection.call_finish(result);
            const xml = reply.get_child_value(0).get_string()[0];
            const available = xml.includes(PORTAL_GLOBAL_SHORTCUTS_INTERFACE);
            this._status = available ? PortalStatus.AVAILABLE : PortalStatus.UNAVAILABLE;
            resolve(available);
          } catch (error) {
            this._status = PortalStatus.UNAVAILABLE;
            resolve(false);
          }
        }
      );
    });
  }

  /**
   * @task T009
   * @epic T001
   * @why Initialize portal connection and create session
   * @what Sets up D-Bus proxy and creates global shortcuts session
   */
  async init(onError?: (error: Error) => void): Promise<boolean> {
    this._onErrorCallback = onError || null;

    // Check availability first
    const available = await this.checkAvailability();
    if (!available) {
      const error = new Error('GlobalShortcuts portal not available');
      if (this._onErrorCallback) {
        this._onErrorCallback(error);
      }
      return false;
    }

    try {
      // Create proxy wrapper for GlobalShortcuts
      const GlobalShortcutsProxy = Gio.DBusProxy.makeProxyWrapper(GLOBAL_SHORTCUTS_INTERFACE) as any;
      this._globalShortcutsProxy = new GlobalShortcutsProxy(
        Gio.DBus.session,
        PORTAL_SERVICE,
        PORTAL_OBJECT_PATH
      );

      // Connect to portal signals
      this._connectPortalSignals();

      // Create session
      return await this._createSession();
    } catch (error) {
      this._state = SessionState.ERROR;
      if (this._onErrorCallback && error instanceof Error) {
        this._onErrorCallback(error);
      }
      return false;
    }
  }

  /**
   * @task T009
   * @epic T001
   * @why Connect to portal signals for shortcut activation
   * @what Sets up signal handlers for Activated and Deactivated
   */
  private _connectPortalSignals(): void {
    if (!this._globalShortcutsProxy) return;

    // Connect to Activated signal
    const activatedId = this._globalShortcutsProxy.connect(
      'Activated',
      (proxy: any, sessionHandle: string, shortcutId: string, timestamp: number) => {
        this._handleShortcutActivated(shortcutId, timestamp);
      }
    );
    this._signalConnections.push(activatedId);

    // Connect to Deactivated signal
    const deactivatedId = this._globalShortcutsProxy.connect(
      'Deactivated',
      (proxy: any, sessionHandle: string, shortcutId: string, timestamp: number) => {
        this._handleShortcutDeactivated(shortcutId, timestamp);
      }
    );
    this._signalConnections.push(deactivatedId);

    // Connect to ShortcutsChanged signal
    const changedId = this._globalShortcutsProxy.connect(
      'ShortcutsChanged',
      (proxy: any, sessionHandle: string, shortcuts: any) => {
        this._handleShortcutsChanged(shortcuts);
      }
    );
    this._signalConnections.push(changedId);
  }

  /**
   * @task T009
   * @epic T001
   * @why Create a global shortcuts session
   * @what Calls CreateSession and waits for response
   */
  private async _createSession(): Promise<boolean> {
    if (!this._globalShortcutsProxy) return false;

    this._state = SessionState.CREATING;

    return new Promise((resolve) => {
      const handleToken = `voyc_session_${Date.now()}`;
      const options = new GLib.Variant('a{sv}', {
        'handle_token': new GLib.Variant('s', handleToken),
        'session_handle_token': new GLib.Variant('s', `voyc_${Date.now()}`),
      });

      // Call CreateSession
      let requestHandle: string;
      try {
        requestHandle = this._globalShortcutsProxy.CreateSessionSync(options);
      } catch (error) {
        this._state = SessionState.ERROR;
        if (this._onErrorCallback && error instanceof Error) {
          this._onErrorCallback(error);
        }
        resolve(false);
        return;
      }

      // Create request proxy to listen for response
      this._waitForRequestResponse(requestHandle, (responseCode, results) => {
        if (responseCode === PortalResponse.SUCCESS) {
          const sessionHandle = results['session_handle'];
          if (sessionHandle) {
            this._sessionHandle = sessionHandle.get_string()[0];
            this._state = SessionState.ACTIVE;
            resolve(true);
          } else {
            this._state = SessionState.ERROR;
            resolve(false);
          }
        } else {
          this._state = SessionState.ERROR;
          resolve(false);
        }
      });

      // Timeout fallback
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
        if (this._state === SessionState.CREATING) {
          this._state = SessionState.ERROR;
          resolve(false);
        }
        return GLib.SOURCE_REMOVE;
      });
    });
  }

  /**
   * @task T009
   * @epic T001
   * @why Wait for Request Response signal
   * @what Creates temporary proxy to listen for request completion
   */
  private _waitForRequestResponse(
    requestHandle: string,
    callback: (responseCode: number, results: any) => void
  ): void {
    const RequestProxy = Gio.DBusProxy.makeProxyWrapper(REQUEST_INTERFACE) as any;
    const requestProxy = new RequestProxy(
      Gio.DBus.session,
      PORTAL_SERVICE,
      requestHandle
    );

    this._requestProxies.set(requestHandle, requestProxy);

    const responseId = requestProxy.connect('Response', (proxy: any, response: number, results: any) => {
      callback(response, results);
      requestProxy.disconnect(responseId);
      this._requestProxies.delete(requestHandle);
    });
  }

  /**
   * @task T009
   * @epic T001
   * @why Register a shortcut with the portal
   * @what Adds shortcut config and binds if session is active
   */
  async registerShortcut(
    id: string,
    description: string,
    preferredTrigger: string,
    callback: ShortcutCallback
  ): Promise<boolean> {
    this._shortcuts.set(id, {
      id,
      description,
      preferredTrigger,
      callback,
    });

    // If session is active, bind immediately
    if (this._state === SessionState.ACTIVE && this._sessionHandle) {
      return await this._bindShortcuts();
    }

    return true;
  }

  /**
   * @task T009
   * @epic T001
   * @why Bind all registered shortcuts to the session
   * @what Calls BindShortcuts with all registered shortcuts
   */
  private async _bindShortcuts(parentWindow: string = ''): Promise<boolean> {
    if (!this._globalShortcutsProxy || !this._sessionHandle) return false;

    this._state = SessionState.BINDING;

    return new Promise((resolve) => {
      // Build shortcuts array
      const shortcutsArray: any[] = [];
      for (const shortcut of this._shortcuts.values()) {
        const shortcutVariant = new GLib.Variant('(sa{sv})', [
          shortcut.id,
          {
            'description': new GLib.Variant('s', shortcut.description),
            'preferred_trigger': new GLib.Variant('s', shortcut.preferredTrigger),
          },
        ]);
        shortcutsArray.push(shortcutVariant);
      }

      const shortcutsVariant = new GLib.Variant('a(sa{sv})', shortcutsArray);
      const options = new GLib.Variant('a{sv}', {});

      let requestHandle: string;
      try {
        if (!this._sessionHandle) throw new Error('No session handle');
        requestHandle = this._globalShortcutsProxy.BindShortcutsSync(
          new GLib.Variant('o', this._sessionHandle),
          shortcutsVariant,
          parentWindow,
          options
        );
      } catch (error) {
        this._state = SessionState.ERROR;
        if (this._onErrorCallback && error instanceof Error) {
          this._onErrorCallback(error);
        }
        resolve(false);
        return;
      }

      this._waitForRequestResponse(requestHandle, (responseCode, results) => {
        if (responseCode === PortalResponse.SUCCESS) {
          this._state = SessionState.ACTIVE;
          resolve(true);
        } else {
          this._state = SessionState.ERROR;
          resolve(false);
        }
      });

      // Timeout fallback
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30000, () => {
        if (this._state === SessionState.BINDING) {
          this._state = SessionState.ERROR;
          resolve(false);
        }
        return GLib.SOURCE_REMOVE;
      });
    });
  }

  /**
   * @task T009
   * @epic T001
   * @why Handle shortcut activation signal
   * @what Dispatches to registered callback
   */
  private _handleShortcutActivated(shortcutId: string, timestamp: number): void {
    const shortcut = this._shortcuts.get(shortcutId);
    if (shortcut) {
      try {
        shortcut.callback(shortcutId, timestamp);
      } catch (error) {
        console.error(`Error in shortcut callback for ${shortcutId}:`, error);
      }
    }
  }

  /**
   * @task T009
   * @epic T001
   * @why Handle shortcut deactivation signal
   * @what Logs deactivation (mainly for debugging)
   */
  private _handleShortcutDeactivated(shortcutId: string, timestamp: number): void {
    // Currently no action needed on deactivation
  }

  /**
   * @task T009
   * @epic T001
   * @why Handle shortcuts changed signal
   * @what Updates internal state when user changes shortcuts
   */
  private _handleShortcutsChanged(shortcuts: any): void {
    // Update trigger descriptions based on user configuration
  }

  /**
   * @task T009
   * @epic T001
   * @why Get current session state
   * @what Returns the session state enum value
   */
  getState(): SessionStateType {
    return this._state;
  }

  /**
   * @task T009
   * @epic T001
   * @why Get portal availability status
   * @what Returns the portal status enum value
   */
  getStatus(): PortalStatusType {
    return this._status;
  }

  /**
   * @task T009
   * @epic T001
   * @why Check if portal is ready for shortcuts
   * @what Returns true if session is active
   */
  isReady(): boolean {
    return this._state === SessionState.ACTIVE && this._sessionHandle !== null;
  }

  /**
   * @task T009
   * @epic T001
   * @why Clean up resources
   * @what Closes session and disconnects signals
   */
  dispose(): void {
    // Disconnect all signal handlers
    if (this._globalShortcutsProxy) {
      for (const id of this._signalConnections) {
        try {
          this._globalShortcutsProxy.disconnect(id);
        } catch (e) {
          // Ignore disconnect errors
        }
      }
    }
    this._signalConnections = [];

    // Close any pending requests
    for (const [handle, proxy] of this._requestProxies) {
      try {
        proxy.CloseSync();
      } catch (e) {
        // Ignore close errors
      }
    }
    this._requestProxies.clear();

    // Clear shortcuts
    this._shortcuts.clear();

    // Reset state
    this._sessionHandle = null;
    this._state = SessionState.IDLE;
    this._globalShortcutsProxy = null;
  }
}

/**
 * @task T009
 * @epic T001
 * @why Convenience class for dictation-specific hotkeys
 * @what Pre-configured hotkeys for Voyc dictation functionality
 */
export class DictationHotkeys {
  private _manager: PortalHotkeyManager;
  private _onToggleDictation: (() => void) | null = null;
  private _onPasteAsTerminal: (() => void) | null = null;

  /**
   * @task T009
   * @epic T001
   * @why Initialize with portal manager
   * @what Creates manager and sets up callbacks
   */
  constructor() {
    this._manager = new PortalHotkeyManager();
  }

  /**
   * @task T009
   * @epic T001
   * @why Initialize portal and register dictation hotkeys
   * @what Sets up toggle and terminal paste hotkeys
   */
  async init(
    onToggleDictation: () => void,
    onPasteAsTerminal: () => void,
    onError?: (error: Error) => void
  ): Promise<boolean> {
    this._onToggleDictation = onToggleDictation;
    this._onPasteAsTerminal = onPasteAsTerminal;

    const initialized = await this._manager.init(onError);
    if (!initialized) {
      return false;
    }

    // Register toggle dictation shortcut
    await this._manager.registerShortcut(
      'toggle-dictation',
      'Toggle Voice Dictation',
      '<Super><Shift>V',
      () => {
        if (this._onToggleDictation) {
          this._onToggleDictation();
        }
      }
    );

    // Register paste as terminal shortcut
    await this._manager.registerShortcut(
      'paste-as-terminal',
      'Paste as Terminal (Ctrl+Shift+V)',
      '<Super><Shift>T',
      () => {
        if (this._onPasteAsTerminal) {
          this._onPasteAsTerminal();
        }
      }
    );

    return true;
  }

  /**
   * @task T009
   * @epic T001
   * @why Get underlying manager for advanced use
   * @what Returns the PortalHotkeyManager instance
   */
  getManager(): PortalHotkeyManager {
    return this._manager;
  }

  /**
   * @task T009
   * @epic T001
   * @why Check if hotkeys are ready
   * @what Returns true if portal session is active
   */
  isReady(): boolean {
    return this._manager.isReady();
  }

  /**
   * @task T009
   * @epic T001
   * @why Clean up resources
   * @what Disposes the portal manager
   */
  dispose(): void {
    this._manager.dispose();
    this._onToggleDictation = null;
    this._onPasteAsTerminal = null;
  }
}
