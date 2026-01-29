/**
 * @task T009
 * @epic T001
 * @why Hotkeys module exports
 * @what Central export point for hotkey functionality
 */

export {
  PortalHotkeyManager,
  DictationHotkeys,
  SessionState,
  PortalStatus,
  type SessionStateType,
  type PortalStatusType,
} from './PortalHotkey.js';

export {
  GLOBAL_SHORTCUTS_INTERFACE_XML,
  REQUEST_INTERFACE_XML,
  SESSION_INTERFACE_XML,
  PORTAL_CONSTANTS,
  PortalResponseCode,
  SHORTCUT_FORMAT_DOCS,
} from './dbus-interfaces.js';

// Error classes
export class HotkeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HotkeyError';
  }
}

export class PortalUnavailableError extends HotkeyError {
  constructor() {
    super('GlobalShortcuts portal is not available');
    this.name = 'PortalUnavailableError';
  }
}

export class SessionCreationError extends HotkeyError {
  constructor(message: string) {
    super(`Failed to create portal session: ${message}`);
    this.name = 'SessionCreationError';
  }
}

export class ShortcutBindingError extends HotkeyError {
  constructor(message: string) {
    super(`Failed to bind shortcuts: ${message}`);
    this.name = 'ShortcutBindingError';
  }
}

/**
 * @task T009
 * @epic T001
 * @why Default hotkey configuration
 * @what Default triggers for dictation actions
 */
export const DEFAULT_HOTKEYS = {
  toggleDictation: '<Primary><Alt>D',
  pasteAsTerminal: '<Super><Shift>T',
};

/**
 * @task T009
 * @epic T001
 * @why Factory function for creating hotkey manager
 * @what Creates and initializes a DictationHotkeys instance
 */
import { DictationHotkeys } from './PortalHotkey.js';

export function createHotkeyManager(): DictationHotkeys {
  return new DictationHotkeys();
}