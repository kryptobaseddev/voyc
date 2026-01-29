/**
 * @task T007
 * @epic T001
 * @why Configuration module exports
 * @what Clean exports for config system
 */

// Export paths module
export {
    getConfigDir,
    getConfigFilePath,
    getDataDir,
    getCacheDir,
    ensureDir,
    fileExists,
} from './paths.js';

// Export schema module
export {
    // Types
    type Provider,
    type SilenceTimeout,
    type Hotkeys,
    type Config,
    type LogLevelConfig,
    type LatencyThresholds,
    
    // Constants
    DEFAULT_CONFIG,
    
    // Validation functions
    isValidProvider,
    isValidSilenceTimeout,
    isValidLogLevel,
    validateConfig,
    hasValidApiKey,
    getCurrentApiKey,
    getCurrentEndpoint,
} from './schema.js';

// Export ConfigManager
export {
    ConfigManager,
    type ConfigManagerType,
} from './Config.js';
