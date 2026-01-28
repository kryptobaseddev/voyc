/**
 * @task T017
 * @epic T001
 * @why Background application lifecycle and single-instance management
 * @what Manages single instance via DBus, signals, and background state
 */

// GJS-style imports
import Gio from 'gi://Gio?version=2.0';
import GLib from 'gi://GLib?version=2.0';
import GObject from 'gi://GObject?version=2.0';

import { ConfigManager } from '../config/Config.js';
import { TrayIndicator } from '../ui/TrayIndicator.js';

/**
 * Signal constants
 */
const Signals = {
    SIGHUP: 1,
    SIGINT: 2,
    SIGTERM: 15,
};

/**
 * Application ID for DBus name ownership
 * @task T017
 * @epic T001
 * @why Unique DBus identifier for single instance
 * @what Reverse DNS app ID used for DBus
 */
const APP_ID = 'com.voyc.app';

/**
 * DBus interface name for Voyc
 * @task T017
 * @epic T001
 * @why Well-known DBus name for the application
 * @what DBus bus name for single instance check
 */
const DBUS_NAME = 'com.voyc.App';

/**
 * DBus interface path
 * @task T017
 * @epic T001
 * @why Object path for DBus interface
 * @what DBus object path for application interface
 */
const DBUS_PATH = '/com/voyc/App';

/**
 * DBus interface XML definition
 * @task T017
 * @epic T001
 * @why Expose methods via DBus for single instance communication
 * @what Interface definition for remote commands
 */
const DBUS_INTERFACE_XML = `
<node>
  <interface name="com.voyc.App">
    <method name="ShowSettings">
    </method>
    <method name="ToggleDictation">
    </method>
    <method name="Quit">
    </method>
    <property name="Version" type="s" access="read"/>
    <property name="IsDictating" type="b" access="read"/>
  </interface>
</node>
`;

/**
 * Application lifecycle states
 * @task T017
 * @epic T001
 * @why Track application background/foreground state
 * @what Enumeration of lifecycle states
 */
export type LifecycleState = 'starting' | 'running' | 'background' | 'foreground' | 'shutting-down';

/**
 * Callback types for lifecycle events
 * @task T017
 * @epic T001
 * @why Type definitions for lifecycle callbacks
 * @what Function signatures for event handlers
 */
export interface LifecycleCallbacks {
    /** Called when app should show settings */
    onShowSettings: () => void;
    /** Called when app should toggle dictation */
    onToggleDictation: () => void;
    /** Called when app is shutting down */
    onShutdown: () => void;
    /** Called when state changes */
    onStateChange?: (state: LifecycleState) => void;
}

/**
 * Signal definition type for LifecycleManager
 * @task T017
 * @epic T001
 * @why Type-safe signal definitions
 * @what Defines the signals emitted by LifecycleManager
 */
type LifecycleManagerSignals = {
    /** Emitted when lifecycle state changes */
    'state-changed': [LifecycleState, LifecycleState];
    /** Emitted when shutdown is requested */
    'shutdown-requested': [];
    /** Emitted when another instance requests settings */
    'show-settings-requested': [];
    /** Emitted when another instance requests dictation toggle */
    'toggle-dictation-requested': [];
};

/**
 * Lifecycle manager class
 * Handles single instance enforcement, signal handling, and background state
 * 
 * @task T017
 * @epic T001
 * @why Single instance enforcement and graceful shutdown
 * @what Manages DBus name ownership, Unix signals, and lifecycle state
 */
export class LifecycleManager extends GObject.Object {
    private _configManager: ConfigManager;
    private _callbacks: LifecycleCallbacks;
    private _trayIndicator: TrayIndicator | null = null;
    private _state: LifecycleState = 'starting';
    private _dbusId: number | null = null;
    private _dbusConnection: any | null = null;
    private _signalHandlers: number[] = [];
    private _isDictating: boolean = false;

    // Static GObject registration
    static {
        GObject.registerClass({
            GTypeName: 'LifecycleManager',
            Signals: {
                'state-changed': {
                    param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING],
                    return_type: GObject.TYPE_NONE,
                },
                'shutdown-requested': {
                    param_types: [],
                    return_type: GObject.TYPE_NONE,
                },
                'show-settings-requested': {
                    param_types: [],
                    return_type: GObject.TYPE_NONE,
                },
                'toggle-dictation-requested': {
                    param_types: [],
                    return_type: GObject.TYPE_NONE,
                },
            },
        }, LifecycleManager as any);
    }

    /**
     * Create a new LifecycleManager instance
     * 
     * @task T017
     * @epic T001
     * @why Initialize lifecycle management
     * @what Sets up config manager and callbacks
     * @param {ConfigManager} configManager - Configuration manager
     * @param {LifecycleCallbacks} callbacks - Lifecycle event callbacks
     */
    constructor(configManager: ConfigManager, callbacks: LifecycleCallbacks) {
        super();
        
        this._configManager = configManager;
        this._callbacks = callbacks;
    }

    /**
     * Initialize the lifecycle manager
     * Attempts to own DBus name for single instance enforcement
     * 
     * @task T017
     * @epic T001
     * @why Set up single instance and signal handlers
     * @what Registers DBus name and Unix signal handlers
     * @returns {boolean} True if this is the first instance, false if another is running
     */
    init(): boolean {
        // Try to own the DBus name
        const result = this._acquireDBusName();
        
        if (!result) {
            // Another instance is running
            console.log('Another instance of Voyc is already running');
            return false;
        }

        // Set up Unix signal handlers
        this._setupSignalHandlers();

        // Set initial state
        this._setState('running');

        console.log('Lifecycle manager initialized (single instance)');
        return true;
    }

    /**
     * Set the tray indicator for background mode integration
     * 
     * @task T017
     * @epic T001
     * @why Connect lifecycle with tray for background mode
     * @what Stores tray indicator reference
     * @param {TrayIndicator} trayIndicator - Tray indicator instance
     */
    setTrayIndicator(trayIndicator: TrayIndicator): void {
        this._trayIndicator = trayIndicator;
    }

    /**
     * Get current lifecycle state
     * 
     * @task T017
     * @epic T001
     * @why Access current state
     * @what Returns current lifecycle state
     * @returns {LifecycleState} Current state
     */
    get state(): LifecycleState {
        return this._state;
    }

    /**
     * Check if application is in background mode
     * 
     * @task T017
     * @epic T001
     * @why Determine if app is minimized to tray
     * @what Returns true if in background state
     * @returns {boolean} True if background mode
     */
    isBackground(): boolean {
        return this._state === 'background';
    }

    /**
     * Check if application is shutting down
     * 
     * @task T017
     * @epic T001
     * @why Determine if shutdown is in progress
     * @what Returns true if shutting down
     * @returns {boolean} True if shutting down
     */
    isShuttingDown(): boolean {
        return this._state === 'shutting-down';
    }

    /**
     * Set dictation state for DBus property
     * 
     * @task T017
     * @epic T001
     * @why Update external state visibility
     * @what Updates internal dictation state
     * @param {boolean} isDictating - Whether dictation is active
     */
    setDictationState(isDictating: boolean): void {
        this._isDictating = isDictating;
    }

    /**
     * Enter background mode (minimize to tray)
     * 
     * @task T017
     * @epic T001
     * @why Hide window but keep running
     * @what Sets state to background
     */
    enterBackground(): void {
        if (this._state !== 'shutting-down') {
            this._setState('background');
            console.log('Entered background mode');
        }
    }

    /**
     * Enter foreground mode (restore from tray)
     * 
     * @task T017
     * @epic T001
     * @why Show window from tray
     * @what Sets state to foreground
     */
    enterForeground(): void {
        if (this._state !== 'shutting-down') {
            this._setState('foreground');
            console.log('Entered foreground mode');
        }
    }

    /**
     * Request graceful shutdown
     * 
     * @task T017
     * @epic T001
     * @why Clean application exit
     * @what Initiates shutdown sequence
     */
    shutdown(): void {
        if (this._state === 'shutting-down') {
            return; // Already shutting down
        }

        console.log('Shutdown requested');
        this._setState('shutting-down');

        // Emit shutdown signal
        this.emit('shutdown-requested');

        // Call callback
        this._callbacks.onShutdown();

        // Release DBus name
        this._releaseDBusName();

        // Remove signal handlers
        this._cleanupSignalHandlers();
    }

    /**
     * Notify another running instance to show settings
     * Used when second instance is started
     * 
     * @task T017
     * @epic T001
     * @why Communicate with running instance
     * @what Calls ShowSettings on primary instance via DBus
     * @returns {boolean} True if successful
     */
    notifyShowSettings(): boolean {
        return this._callRemoteMethod('ShowSettings');
    }

    /**
     * Notify another running instance to toggle dictation
     * 
     * @task T017
     * @epic T001
     * @why Remote dictation toggle
     * @what Calls ToggleDictation on primary instance via DBus
     * @returns {boolean} True if successful
     */
    notifyToggleDictation(): boolean {
        return this._callRemoteMethod('ToggleDictation');
    }

    /**
     * Notify another running instance to quit
     * 
     * @task T017
     * @epic T001
     * @why Remote quit command
     * @what Calls Quit on primary instance via DBus
     * @returns {boolean} True if successful
     */
    notifyQuit(): boolean {
        return this._callRemoteMethod('Quit');
    }

    /**
     * Acquire the DBus well-known name
     * 
     * @task T017
     * @epic T001
     * @why Single instance enforcement
     * @what Attempts to own DBus name, returns false if already owned
     * @returns {boolean} True if name acquired, false if already owned
     * @private
     */
    private _acquireDBusName(): boolean {
        try {
            // Get the session bus
            const bus = Gio.DBus.session;

            // Try to own the name
            this._dbusId = bus.own_name(
                DBUS_NAME,
                Gio.BusNameOwnerFlags.NONE,
                (connection: any) => {
                    // Name acquired callback
                    this._onDBusNameAcquired(connection);
                },
                () => {
                    // Name lost callback
                    console.log('DBus name lost');
                }
            );

            // Check if we actually got the name
            // If another instance owns it, own_name won't error but we can check
            const proxy = Gio.DBusProxy.new_for_bus_sync(
                Gio.BusType.SESSION,
                Gio.DBusProxyFlags.NONE,
                null,
                DBUS_NAME,
                DBUS_PATH,
                DBUS_NAME,
                null
            );

            // If we can create a proxy and it's not ours, another instance exists
            if (proxy && this._dbusConnection === null) {
                // Another instance is running
                return false;
            }

            return true;

        } catch (e) {
            // Error usually means name is not owned (which is good for us)
            // But could also mean DBus is not available
            console.log(`DBus check result: ${e}`);
            // Assume we can proceed
            return true;
        }
    }

    /**
     * Handle DBus name acquisition
     * 
     * @task T017
     * @epic T001
     * @why Set up DBus interface when name is acquired
     * @what Creates DBus interface for remote commands
     * @param {any} connection - DBus connection
     * @private
     */
    private _onDBusNameAcquired(connection: any): void {
        console.log(`DBus name acquired: ${DBUS_NAME}`);
        this._dbusConnection = connection;

        try {
            // Create the DBus interface
            const nodeInfo = Gio.DBusNodeInfo.new_for_xml(DBUS_INTERFACE_XML);
            // Access interfaces using get_interfaces() or by array index depending on types
            // GJS mapping usually exposes interfaces property or method
            const interfaceInfo = (nodeInfo as any).interfaces[0]; 

            // Register the object
            connection.register_object(
                DBUS_PATH,
                interfaceInfo,
                this._createDBusVTable()
            );

        } catch (e) {
            console.error('Failed to register DBus interface', e);
        }
    }

    /**
     * Create DBus vtable for method handling
     * 
     * @task T017
     * @epic T001
     * @why Handle incoming DBus method calls
     * @what Returns vtable with method handlers
     * @returns {any} DBus vtable
     * @private
     */
    private _createDBusVTable(): any {
        return {
            method_call: (
                connection: any,
                sender: string,
                objectPath: string,
                interfaceName: string,
                methodName: string,
                parameters: any,
                invocation: any
            ) => {
                this._handleDBusMethod(methodName, invocation);
            },
            get_property: (
                connection: any,
                sender: string,
                objectPath: string,
                interfaceName: string,
                propertyName: string
            ) => {
                return this._handleDBusPropertyGet(propertyName);
            },
        };
    }

    /**
     * Handle DBus method calls
     * 
     * @task T017
     * @epic T001
     * @why Process remote commands
     * @what Dispatches method calls to handlers
     * @param {string} methodName - Method name
     * @param {any} invocation - Method invocation
     * @private
     */
    private _handleDBusMethod(methodName: string, invocation: any): void {
        console.log(`DBus method called: ${methodName}`);

        switch (methodName) {
            case 'ShowSettings':
                this.emit('show-settings-requested');
                this._callbacks.onShowSettings();
                invocation.return_value(null);
                break;

            case 'ToggleDictation':
                this.emit('toggle-dictation-requested');
                this._callbacks.onToggleDictation();
                invocation.return_value(null);
                break;

            case 'Quit':
                this.shutdown();
                invocation.return_value(null);
                break;

            default:
                invocation.return_error(
                    Gio.DBusError,
                    Gio.DBusError.UNKNOWN_METHOD,
                    `Unknown method: ${methodName}`
                );
        }
    }

    /**
     * Handle DBus property get requests
     * 
     * @task T017
     * @epic T001
     * @why Expose properties to remote instances
     * @what Returns property values
     * @param {string} propertyName - Property name
     * @returns {any} Property value
     * @private
     */
    private _handleDBusPropertyGet(propertyName: string): any {
        switch (propertyName) {
            case 'Version':
                return new GLib.Variant('s', '1.0.0');
            case 'IsDictating':
                return new GLib.Variant('b', this._isDictating);
            default:
                return null;
        }
    }

    /**
     * Call a method on the remote (primary) instance
     * 
     * @task T017
     * @epic T001
     * @why Communicate with running instance
     * @what Makes DBus method call to primary instance
     * @param {string} methodName - Method to call
     * @returns {boolean} True if successful
     * @private
     */
    private _callRemoteMethod(methodName: string): boolean {
        try {
            const proxy = Gio.DBusProxy.new_for_bus_sync(
                Gio.BusType.SESSION,
                Gio.DBusProxyFlags.NONE,
                null,
                DBUS_NAME,
                DBUS_PATH,
                DBUS_NAME,
                null
            );

            proxy.call_sync(
                methodName,
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null
            );

            return true;
        } catch (e) {
            console.error(`Failed to call remote method: ${methodName}`, e);
            return false;
        }
    }

    /**
     * Release the DBus name
     * 
     * @task T017
     * @epic T001
     * @why Clean up DBus on shutdown
     * @what Unowns the DBus name
     * @private
     */
    private _releaseDBusName(): void {
        if (this._dbusId !== null) {
            try {
                Gio.DBus.session.unown_name(this._dbusId);
                this._dbusId = null;
                this._dbusConnection = null;
                console.log('DBus name released');
            } catch (e) {
                console.error('Failed to release DBus name', e);
            }
        }
    }

    /**
     * Set up Unix signal handlers
     * 
     * @task T017
     * @epic T001
     * @why Graceful shutdown on signals
     * @what Registers SIGTERM and SIGINT handlers
     * @private
     */
    private _setupSignalHandlers(): void {
        // Handle SIGTERM
        const termHandler = new (GLib as any).UnixSignalSource(Signals.SIGTERM);
        termHandler.set_callback(() => {
            console.log('SIGTERM received, shutting down gracefully');
            this.shutdown();
            return GLib.SOURCE_REMOVE;
        });
        termHandler.attach(null);
        this._signalHandlers.push(termHandler.get_id());

        // Handle SIGINT (Ctrl+C)
        const intHandler = new (GLib as any).UnixSignalSource(Signals.SIGINT);
        intHandler.set_callback(() => {
            console.log('SIGINT received, shutting down gracefully');
            this.shutdown();
            return GLib.SOURCE_REMOVE;
        });
        intHandler.attach(null);
        this._signalHandlers.push(intHandler.get_id());

        // Handle SIGHUP (optional: reload config)
        const hupHandler = new (GLib as any).UnixSignalSource(Signals.SIGHUP);
        hupHandler.set_callback(() => {
            console.log('SIGHUP received, reloading configuration');
            this._configManager.load();
            return GLib.SOURCE_CONTINUE;
        });
        hupHandler.attach(null);
        this._signalHandlers.push(hupHandler.get_id());
    }

    /**
     * Clean up signal handlers
     * 
     * @task T017
     * @epic T001
     * @why Remove signal handlers on shutdown
     * @what Destroys all signal handlers
     * @private
     */
    private _cleanupSignalHandlers(): void {
        // Note: GLib.UnixSignalSource doesn't have a direct destroy method
        // The sources will be cleaned up when the main loop exits
        this._signalHandlers = [];
    }

    /**
     * Set lifecycle state and emit signal
     * 
     * @task T017
     * @epic T001
     * @why Track and notify state changes
     * @what Updates state and emits signal
     * @param {LifecycleState} newState - New state
     * @private
     */
    private _setState(newState: LifecycleState): void {
        const oldState = this._state;
        this._state = newState;

        if (oldState !== newState) {
            this.emit('state-changed', oldState, newState);
            
            if (this._callbacks.onStateChange) {
                this._callbacks.onStateChange(newState);
            }
        }
    }

    /**
     * Clean up resources
     * 
     * @task T017
     * @epic T001
     * @why Proper cleanup on exit
     * @what Releases DBus name and removes handlers
     */
    destroy(): void {
        this._releaseDBusName();
        this._cleanupSignalHandlers();
    }
}

/**
 * Create a new LifecycleManager instance
 * Factory function for convenience
 * 
 * @task T017
 * @epic T001
 * @why Factory for LifecycleManager instances
 * @what Creates and returns new LifecycleManager
 * @param {ConfigManager} configManager - Configuration manager
 * @param {LifecycleCallbacks} callbacks - Lifecycle callbacks
 * @returns {LifecycleManager} New LifecycleManager instance
 */
export function createLifecycleManager(
    configManager: ConfigManager,
    callbacks: LifecycleCallbacks
): LifecycleManager {
    return new LifecycleManager(configManager, callbacks);
}