/**
 * @task T017
 * @epic T001
 * @why Startup module exports for Voyc
 * @what Clean exports for autostart and lifecycle management
 */

// Export Autostart
export {
    Autostart,
    createAutostart,
} from './Autostart.js';

// Export LifecycleManager
export {
    LifecycleManager,
    createLifecycleManager,
    type LifecycleState,
    type LifecycleCallbacks,
} from './Lifecycle.js';
