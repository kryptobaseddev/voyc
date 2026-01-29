/**
 * @task T023
 * @epic T001
 * @why Updates module exports
 * @what Clean exports for version checking system
 */

export {
    VersionChecker,
    scheduleVersionCheck,
    compareSemver,
    shouldCheckForUpdates,
    getCurrentISODate,
    type UpdateInfo,
    type VersionCheckerConfig,
} from './VersionChecker.js';
