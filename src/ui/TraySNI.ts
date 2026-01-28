/**
 * @task T010
 * @epic T001
 * @why StatusNotifierItem implementation for GTK4 system tray
 * @what D-Bus based tray icon for modern Linux desktops
 */

import Gio from 'gi://Gio?version=2.0';
import GLib from 'gi://GLib?version=2.0';
import GObject from 'gi://GObject?version=2.0';

/**
 * Tray state types
 */
export type TrayState = 'idle' | 'listening' | 'processing' | 'error';

/**
 * Menu item structure
 */
interface MenuItem {
  id: string;
  label: string;
  enabled: boolean;
  toggleState?: boolean;
}

/**
 * StatusNotifierItem implementation for GTK4
 * Uses D-Bus to expose tray icon to desktop environment
 * 
 * @task T010
 * @epic T001
 * @why Provide system tray icon without GTK StatusIcon (removed in GTK4)
 * @what D-Bus service implementing org.kde.StatusNotifierItem
 */
export class StatusNotifierItem extends GObject.Object {
  private _busId: number = 0;
  private _iconName: string = 'audio-input-microphone-symbolic';
  private _state: TrayState = 'idle';
  private _isActive: boolean = false;
  private _menuItems: MenuItem[] = [];
  private _connection: Gio.DBusConnection | null = null;

  // Icons for each state
  private static readonly STATE_ICONS: Record<TrayState, string> = {
    idle: 'audio-input-microphone-symbolic',
    listening: 'media-record-symbolic',
    processing: 'emblem-synchronizing-symbolic',
    error: 'dialog-error-symbolic',
  };

  // Tooltips for each state
  private static readonly STATE_TOOLTIPS: Record<TrayState, string> = {
    idle: 'Voyc - Click to dictate',
    listening: 'Voyc - Listening...',
    processing: 'Voyc - Processing...',
    error: 'Voyc - Error',
  };

  static {
    GObject.registerClass({
      GTypeName: 'StatusNotifierItem',
      Signals: {
        'activate': { param_types: [] },
        'toggle-dictation': { param_types: [] },
        'show-settings': { param_types: [] },
        'quit': { param_types: [] },
      },
    }, StatusNotifierItem);
  }

  constructor() {
    super();
    this._setupMenuItems();
  }

  /**
   * Set up default menu items
   */
  private _setupMenuItems(): void {
    this._menuItems = [
      { id: 'toggle', label: 'Start Dictation', enabled: true, toggleState: false },
      { id: 'sep1', label: '', enabled: false },
      { id: 'settings', label: 'Settings', enabled: true },
      { id: 'sep2', label: '', enabled: false },
      { id: 'quit', label: 'Quit', enabled: true },
    ];
  }

  /**
   * Initialize and register on D-Bus
   */
  init(): boolean {
    try {
      // Get session bus
      this._connection = Gio.DBus.session;

      // Export our interfaces
      this._exportItemInterface();
      this._exportMenuInterface();

      // Register with StatusNotifierWatcher
      this._registerWithWatcher();

      print('StatusNotifierItem: Registered on D-Bus');
      return true;
    } catch (e) {
      print('StatusNotifierItem: Failed to initialize: ' + e);
      return false;
    }
  }

  /**
   * Export the StatusNotifierItem interface
   */
  private _exportItemInterface(): void {
    const itemXml = `
    <node>
      <interface name="org.kde.StatusNotifierItem">
        <property name="Category" type="s" access="read"/>
        <property name="Id" type="s" access="read"/>
        <property name="Title" type="s" access="read"/>
        <property name="Status" type="s" access="read"/>
        <property name="IconName" type="s" access="read"/>
        <property name="IconThemePath" type="s" access="read"/>
        <property name="Menu" type="o" access="read"/>
        <method name="Activate">
          <arg type="i" name="x" direction="in"/>
          <arg type="i" name="y" direction="in"/>
        </method>
        <method name="SecondaryActivate">
          <arg type="i" name="x" direction="in"/>
          <arg type="i" name="y" direction="in"/>
        </method>
        <method name="ContextMenu">
          <arg type="i" name="x" direction="in"/>
          <arg type="i" name="y" direction="in"/>
        </method>
      </interface>
    </node>`;

    const ifaceInfo = Gio.DBusNodeInfo.new_for_xml(itemXml);
    const iface = ifaceInfo.lookup_interface('org.kde.StatusNotifierItem');

    this._busId = this._connection!.register_object(
      '/StatusNotifierItem',
      iface!,
      (connection: Gio.DBusConnection, sender: string, objectPath: string,
       interfaceName: string, methodName: string, parameters: GLib.Variant,
       invocation: Gio.DBusMethodInvocation) => {
        this._handleItemMethod(methodName, parameters, invocation);
      },
      (connection: Gio.DBusConnection, sender: string, objectPath: string,
       interfaceName: string, propertyName: string) => {
        return this._handleItemGetProperty(propertyName);
      },
      null
    );
  }

  /**
   * Export the Menu interface (com.canonical.dbusmenu)
   */
  private _exportMenuInterface(): void {
    const menuXml = `
    <node>
      <interface name="com.canonical.dbusmenu">
        <method name="GetLayout">
          <arg type="i" name="parentId" direction="in"/>
          <arg type="i" name="recursionDepth" direction="in"/>
          <arg type="as" name="propertyNames" direction="in"/>
          <arg type="u" name="revision" direction="out"/>
          <arg type="(ia{sv}av)" name="layout" direction="out"/>
        </method>
        <method name="GetGroupProperties">
          <arg type="ai" name="ids" direction="in"/>
          <arg type="as" name="propertyNames" direction="in"/>
          <arg type="a(ia{sv})" name="properties" direction="out"/>
        </method>
        <method name="GetProperty">
          <arg type="i" name="id" direction="in"/>
          <arg type="s" name="name" direction="in"/>
          <arg type="v" name="value" direction="out"/>
        </method>
        <method name="Event">
          <arg type="i" name="id" direction="in"/>
          <arg type="s" name="eventId" direction="in"/>
          <arg type="v" name="data" direction="in"/>
          <arg type="u" name="timestamp" direction="in"/>
        </method>
        <method name="AboutToShow">
          <arg type="i" name="id" direction="in"/>
          <arg type="b" name="needUpdate" direction="out"/>
        </method>
        <signal name="ItemsPropertiesUpdated">
          <arg type="a(ia{sv})" name="updatedProps"/>
          <arg type="a(ias)" name="removedProps"/>
        </signal>
        <signal name="LayoutUpdated">
          <arg type="u" name="revision"/>
          <arg type="i" name="parent"/>
        </signal>
      </interface>
    </node>`;

    const ifaceInfo = Gio.DBusNodeInfo.new_for_xml(menuXml);
    const iface = ifaceInfo.lookup_interface('com.canonical.dbusmenu');

    this._connection!.register_object(
      '/MenuBar',
      iface!,
      (connection: Gio.DBusConnection, sender: string, objectPath: string,
       interfaceName: string, methodName: string, parameters: GLib.Variant,
       invocation: Gio.DBusMethodInvocation) => {
        this._handleMenuMethod(methodName, parameters, invocation);
      },
      null,
      null
    );
  }

  /**
   * Register with StatusNotifierWatcher
   */
  private _registerWithWatcher(): void {
    const watcherXml = `
    <node>
      <interface name="org.kde.StatusNotifierWatcher">
        <method name="RegisterStatusNotifierItem">
          <arg type="s" name="service" direction="in"/>
        </method>
      </interface>
    </node>`;

    try {
      const proxy = Gio.DBusProxy.new_for_bus_sync(
        Gio.BusType.SESSION,
        Gio.DBusProxyFlags.NONE,
        Gio.DBusNodeInfo.new_for_xml(watcherXml).lookup_interface('org.kde.StatusNotifierWatcher')!,
        'org.kde.StatusNotifierWatcher',
        '/StatusNotifierWatcher',
        'org.kde.StatusNotifierWatcher',
        null
      );

      proxy.call_sync(
        'RegisterStatusNotifierItem',
        GLib.Variant.new('(s)', ['com.voyc.app']),
        Gio.DBusCallFlags.NONE,
        -1,
        null
      );

      print('StatusNotifierItem: Registered with watcher');
    } catch (e) {
      print('StatusNotifierItem: No watcher found, tray may not appear: ' + e);
    }
  }

  /**
   * Handle item interface method calls
   */
  private _handleItemMethod(methodName: string, parameters: GLib.Variant,
                            invocation: Gio.DBusMethodInvocation): void {
    switch (methodName) {
      case 'Activate':
        this.emit('activate');
        this.emit('toggle-dictation');
        invocation.return_value(null);
        break;
      case 'SecondaryActivate':
        this.emit('show-settings');
        invocation.return_value(null);
        break;
      case 'ContextMenu':
        invocation.return_value(null);
        break;
      default:
        invocation.return_error_literal(
          Gio.DBusError,
          Gio.DBusError.UNKNOWN_METHOD,
          'Unknown method: ' + methodName
        );
    }
  }

  /**
   * Handle item interface property gets
   */
  private _handleItemGetProperty(propertyName: string): GLib.Variant | null {
    switch (propertyName) {
      case 'Category':
        return GLib.Variant.new_string('ApplicationStatus');
      case 'Id':
        return GLib.Variant.new_string('com.voyc.app');
      case 'Title':
        return GLib.Variant.new_string('Voyc');
      case 'Status':
        return GLib.Variant.new_string('Active');
      case 'IconName':
        return GLib.Variant.new_string(this._iconName);
      case 'IconThemePath':
        return GLib.Variant.new_string('');
      case 'Menu':
        return GLib.Variant.new_object_path('/MenuBar');
      default:
        return null;
    }
  }

  /**
   * Handle menu interface method calls
   */
  private _handleMenuMethod(methodName: string, parameters: GLib.Variant,
                            invocation: Gio.DBusMethodInvocation): void {
    switch (methodName) {
      case 'GetLayout':
        this._handleGetLayout(invocation);
        break;
      case 'GetGroupProperties':
        invocation.return_value(GLib.Variant.new('(a(ia{sv}))', [[]]));
        break;
      case 'GetProperty':
        invocation.return_value(GLib.Variant.new('v', GLib.Variant.new_string('')));
        break;
      case 'Event':
        const [id, eventId] = parameters.deep_unpack() as [number, string];
        if (eventId === 'clicked') {
          this._handleMenuClick(id);
        }
        invocation.return_value(null);
        break;
      case 'AboutToShow':
        invocation.return_value(GLib.Variant.new('(b)', [false]));
        break;
      default:
        invocation.return_error_literal(
          Gio.DBusError,
          Gio.DBusError.UNKNOWN_METHOD,
          'Unknown method: ' + methodName
        );
    }
  }

  /**
   * Handle GetLayout menu method
   */
  private _handleGetLayout(invocation: Gio.DBusMethodInvocation): void {
    const layout = this._buildMenuLayout();
    invocation.return_value(GLib.Variant.new('(u(ia{sv}av))', [0, layout]));
  }

  /**
   * Build menu layout structure
   */
  private _buildMenuLayout(): [number, Record<string, GLib.Variant>, unknown[]] {
    const children: unknown[] = [];

    for (let i = 0; i < this._menuItems.length; i++) {
      const item = this._menuItems[i];
      const props: Record<string, GLib.Variant> = {};

      if (item.id.startsWith('sep')) {
        props.type = GLib.Variant.new_string('separator');
      } else {
        props.label = GLib.Variant.new_string(item.label);
        props.enabled = GLib.Variant.new_boolean(item.enabled);
        
        if (item.toggleState !== undefined) {
          props.toggleType = GLib.Variant.new_string('checkmark');
          props.toggleState = GLib.Variant.new_int32(item.toggleState ? 1 : 0);
        }
      }

      children.push(GLib.Variant.new('(ia{sv})', [i + 1, props]));
    }

    const rootProps: Record<string, GLib.Variant> = {
      label: GLib.Variant.new_string('Voyc'),
    };

    return [0, rootProps, children];
  }

  /**
   * Handle menu item clicks
   */
  private _handleMenuClick(id: number): void {
    const item = this._menuItems[id - 1];
    if (!item) return;

    switch (item.id) {
      case 'toggle':
        this.emit('toggle-dictation');
        break;
      case 'settings':
        this.emit('show-settings');
        break;
      case 'quit':
        this.emit('quit');
        break;
    }
  }

  /**
   * Set the tray state
   */
  setState(state: TrayState): void {
    this._state = state;
    this._iconName = StatusNotifierItem.STATE_ICONS[state];
    
    // Update toggle menu item
    const toggleItem = this._menuItems.find(i => i.id === 'toggle');
    if (toggleItem) {
      toggleItem.label = state === 'listening' ? 'Stop Dictation' : 'Start Dictation';
      toggleItem.toggleState = state === 'listening';
    }

    // Notify properties changed
    this._notifyPropertiesChanged();
  }

  /**
   * Set active/inactive state
   */
  setActive(active: boolean): void {
    this._isActive = active;
    this.setState(active ? 'listening' : 'idle');
  }

  /**
   * Notify D-Bus of property changes
   */
  private _notifyPropertiesChanged(): void {
    if (!this._connection) return;

    const changedProps: Record<string, GLib.Variant> = {
      IconName: GLib.Variant.new_string(this._iconName),
    };

    this._connection.emit_signal(
      null,
      '/StatusNotifierItem',
      'org.freedesktop.DBus.Properties',
      'PropertiesChanged',
      GLib.Variant.new('(sa{sv}as)', [
        'org.kde.StatusNotifierItem',
        changedProps,
        [],
      ])
    );
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    if (this._busId > 0 && this._connection) {
      this._connection.unregister_object(this._busId);
      this._busId = 0;
    }
    this._connection = null;
  }
}
