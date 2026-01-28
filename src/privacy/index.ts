/**
 * @task T016
 * @epic T001
 * @why Privacy module exports
 * @what Clean exports for privacy and redaction systems
 */

// Redaction exports
export {
    redactString,
    redactObject,
    redactTranscript,
    redactHeaders,
    createRedactedContext,
    maskApiKey,
    DEFAULT_REPLACEMENT,
    API_KEY_PATTERNS,
    PERSONAL_DATA_PATTERNS,
    type RedactionOptions,
    type RedactionPattern,
} from './redaction.js';

// Policy exports
export {
    getProviderPolicy,
    getAllProviderPolicies,
    getPrivacySummary,
    getShortPrivacyNotice,
    validatePrivacySettings,
    isAudioRetentionEnabled,
    getRetentionWarning,
    DEFAULT_PRIVACY_SETTINGS,
    PROVIDER_POLICIES,
    PRIVACY_POLICY_MARKDOWN,
    type ProviderDataPolicy,
    type PrivacySettings,
} from './policy.js';
