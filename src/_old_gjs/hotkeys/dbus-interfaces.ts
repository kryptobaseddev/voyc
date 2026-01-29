/**
 * @task T009
 * @epic T001
 * @why D-Bus interface definitions for portal communication
 * @what XML interface definitions for xdg-desktop-portal GlobalShortcuts
 */

/**
 * @task T009
 * @epic T001
 * @why GlobalShortcuts portal interface
 * @what D-Bus XML for org.freedesktop.portal.GlobalShortcuts
 */
export const GLOBAL_SHORTCUTS_INTERFACE_XML = `
<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN"
 "http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd">
<node>
  <interface name="org.freedesktop.portal.GlobalShortcuts">
    <method name="CreateSession">
      <arg type="a{sv}" name="options" direction="in"/>
      <arg type="o" name="handle" direction="out"/>
      <annotation name="org.qtproject.QtDBus.QtTypeName.In0" value="QVariantMap"/>
    </method>
    <method name="BindShortcuts">
      <arg type="o" name="session_handle" direction="in"/>
      <arg type="a(sa{sv})" name="shortcuts" direction="in"/>
      <arg type="s" name="parent_window" direction="in"/>
      <arg type="a{sv}" name="options" direction="in"/>
      <arg type="o" name="request_handle" direction="out"/>
      <annotation name="org.qtproject.QtDBus.QtTypeName.In1" value="QList&lt;QPair&lt;QString,QVariantMap&gt;&gt;"/>
      <annotation name="org.qtproject.QtDBus.QtTypeName.In3" value="QVariantMap"/>
    </method>
    <method name="ListShortcuts">
      <arg type="o" name="session_handle" direction="in"/>
      <arg type="a{sv}" name="options" direction="in"/>
      <arg type="o" name="request_handle" direction="out"/>
      <annotation name="org.qtproject.QtDBus.QtTypeName.In1" value="QVariantMap"/>
    </method>
    <method name="ConfigureShortcuts">
      <arg type="o" name="session_handle" direction="in"/>
      <arg type="s" name="parent_window" direction="in"/>
      <arg type="a{sv}" name="options" direction="in"/>
      <annotation name="org.qtproject.QtDBus.QtTypeName.In2" value="QVariantMap"/>
    </method>
    <signal name="Activated">
      <arg type="o" name="session_handle"/>
      <arg type="s" name="shortcut_id"/>
      <arg type="t" name="timestamp"/>
      <arg type="a{sv}" name="options"/>
      <annotation name="org.qtproject.QtDBus.QtTypeName.Out3" value="QVariantMap"/>
    </signal>
    <signal name="Deactivated">
      <arg type="o" name="session_handle"/>
      <arg type="s" name="shortcut_id"/>
      <arg type="t" name="timestamp"/>
      <arg type="a{sv}" name="options"/>
      <annotation name="org.qtproject.QtDBus.QtTypeName.Out3" value="QVariantMap"/>
    </signal>
    <signal name="ShortcutsChanged">
      <arg type="o" name="session_handle"/>
      <arg type="a(sa{sv})" name="shortcuts"/>
      <annotation name="org.qtproject.QtDBus.QtTypeName.Out1" value="QList&lt;QPair&lt;QString,QVariantMap&gt;&gt;"/>
    </signal>
    <property name="version" type="u" access="read"/>
  </interface>
</node>
`;

/**
 * @task T009
 * @epic T001
 * @why Request interface for portal operations
 * @what D-Bus XML for org.freedesktop.portal.Request
 */
export const REQUEST_INTERFACE_XML = `
<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN"
 "http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd">
<node>
  <interface name="org.freedesktop.portal.Request">
    <method name="Close"/>
    <signal name="Response">
      <arg type="u" name="response"/>
      <arg type="a{sv}" name="results"/>
      <annotation name="org.qtproject.QtDBus.QtTypeName.Out1" value="QVariantMap"/>
    </signal>
  </interface>
</node>
`;

/**
 * @task T009
 * @epic T001
 * @why Session interface for portal sessions
 * @what D-Bus XML for org.freedesktop.portal.Session
 */
export const SESSION_INTERFACE_XML = `
<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN"
 "http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd">
<node>
  <interface name="org.freedesktop.portal.Session">
    <method name="Close"/>
  </interface>
</node>
`;

/**
 * @task T009
 * @epic T001
 * @why Portal service constants
 * @what D-Bus service name and object path constants
 */
export const PORTAL_CONSTANTS = {
  SERVICE_NAME: 'org.freedesktop.portal.Desktop',
  OBJECT_PATH: '/org/freedesktop/portal/desktop',
  GLOBAL_SHORTCUTS_INTERFACE: 'org.freedesktop.portal.GlobalShortcuts',
  REQUEST_INTERFACE: 'org.freedesktop.portal.Request',
  SESSION_INTERFACE: 'org.freedesktop.portal.Session',
} as const;

/**
 * @task T009
 * @epic T001
 * @why Response codes from portal Request
 * @what Constants for portal response codes
 */
export const PortalResponseCode = {
  SUCCESS: 0,
  CANCELLED: 1,
  OTHER: 2,
} as const;

/**
 * @task T009
 * @epic T001
 * @why Shortcut trigger format documentation
 * @what XDG shortcuts specification format
 */
export const SHORTCUT_FORMAT_DOCS = `
XDG Shortcuts Specification Format:

Modifiers:
  <Ctrl>    - Control key
  <Alt>     - Alt/Option key
  <Shift>   - Shift key
  <Super>   - Super/Windows/Command key

Special Keys:
  <Return>, <Enter>  - Return/Enter key
  <Escape>, <Esc>    - Escape key
  <Tab>              - Tab key
  <Space>            - Space bar
  <Backspace>        - Backspace key
  <Delete>, <Del>    - Delete key
  <Home>             - Home key
  <End>              - End key
  <PageUp>           - Page Up key
  <PageDown>         - Page Down key
  <Up>, <Down>, <Left>, <Right>  - Arrow keys
  <F1> through <F12> - Function keys

Regular Keys:
  Any single character: a-z, 0-9, punctuation

Examples:
  <Super><Shift>V    - Super+Shift+V
  <Ctrl><Alt>T       - Ctrl+Alt+T
  <Ctrl><Shift>Escape - Ctrl+Shift+Escape
`;