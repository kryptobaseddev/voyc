/**
 * @task T010
 * @epic T001
 * @why UI module exports for Voyc
 * @what Clean exports for tray indicator, settings window, and status icon
 */

// Export StatusIcon
export {
    StatusIcon,
    type TrayState,
} from './StatusIcon.js';

// Export TrayIndicator
export {
    TrayIndicator,
} from './TrayIndicator.js';

// Export SettingsWindow
export {
    SettingsWindow,
} from './SettingsWindow.js';
