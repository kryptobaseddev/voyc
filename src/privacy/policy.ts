/**
 * @task T016
 * @epic T001
 * @why Data handling policy display per REQ-018
 * @what Privacy policy definitions and provider data handling info
 */

import type { Provider } from '../config/schema.js';

/**
 * Data retention policy for a provider
 * @task T016
 * @epic T001
 * @why Transparency about data handling per REQ-018
 * @what Describes how a provider handles data
 */
export interface ProviderDataPolicy {
    /** Provider name */
    provider: string;
    /** What data is sent to the provider */
    dataSent: string[];
    /** Provider's data retention policy */
    retentionPolicy: string;
    /** Link to provider's privacy policy */
    privacyPolicyUrl: string;
    /** Whether audio is stored by provider */
    storesAudio: boolean;
    /** Whether transcripts are stored by provider */
    storesTranscripts: boolean;
    /** Data processing location */
    processingLocation: string;
    /** GDPR compliance status */
    gdprCompliant: boolean;
}

/**
 * Application privacy settings
 * @task T016
 * @epic T001
 * @why User-configurable privacy options per REQ-019
 * @what Local privacy settings
 */
export interface PrivacySettings {
    /** Whether to store raw audio locally (default: false per REQ-019) */
    storeAudioLocally: boolean;
    /** Whether to log transcripts (default: false per REQ-020) */
    logTranscripts: boolean;
    /** Whether to enable telemetry (default: false per PRD) */
    enableTelemetry: boolean;
    /** Audio retention duration in days (0 = no retention) */
    audioRetentionDays: number;
    /** Last updated timestamp */
    lastUpdated: string;
}

/**
 * Default privacy settings
 * Per REQ-019: No raw audio stored by default
 * Per REQ-020: No transcripts logged by default
 * Per PRD Section 10: No telemetry in v1
 * @task T016
 * @epic T001
 * @why Privacy-first defaults
 * @what Default privacy settings
 */
export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
    storeAudioLocally: false,
    logTranscripts: false,
    enableTelemetry: false,
    audioRetentionDays: 0,
    lastUpdated: new Date().toISOString(),
};

/**
 * Provider data policies
 * @task T016
 * @epic T001
 * @why Transparency about provider data handling per REQ-018
 * @what Data handling policies for each supported provider
 */
export const PROVIDER_POLICIES: Record<Provider, ProviderDataPolicy> = {
    elevenlabs: {
        provider: 'ElevenLabs',
        dataSent: [
            'Audio recordings (for transcription)',
            'API key (for authentication)',
        ],
        retentionPolicy: 'Audio and transcripts are processed and not retained by ElevenLabs for Scribe API calls. See ElevenLabs privacy policy for details.',
        privacyPolicyUrl: 'https://elevenlabs.io/privacy',
        storesAudio: false,
        storesTranscripts: false,
        processingLocation: 'United States / EU (depending on region)',
        gdprCompliant: true,
    },
    'elevenlabs-realtime': {
        provider: 'ElevenLabs (Realtime)',
        dataSent: [
            'Audio recordings (streamed for realtime transcription)',
            'API key (for authentication)',
        ],
        retentionPolicy: 'Audio is streamed and processed in realtime. Not retained by ElevenLabs. This is an experimental feature.',
        privacyPolicyUrl: 'https://elevenlabs.io/privacy',
        storesAudio: false,
        storesTranscripts: false,
        processingLocation: 'United States / EU (depending on region)',
        gdprCompliant: true,
    },
    openai: {
        provider: 'OpenAI',
        dataSent: [
            'Audio recordings (for transcription)',
            'API key (for authentication)',
        ],
        retentionPolicy: 'OpenAI may retain audio and transcripts for up to 30 days for abuse monitoring. Data is not used to train models.',
        privacyPolicyUrl: 'https://openai.com/privacy',
        storesAudio: true,
        storesTranscripts: true,
        processingLocation: 'United States',
        gdprCompliant: true,
    },
    baseten: {
        provider: 'Baseten',
        dataSent: [
            'Text transcripts (for post-processing)',
            'API key (for authentication)',
        ],
        retentionPolicy: 'Text data is processed in real-time and not retained by Baseten.',
        privacyPolicyUrl: 'https://baseten.co/privacy',
        storesAudio: false,
        storesTranscripts: false,
        processingLocation: 'United States',
        gdprCompliant: true,
    },
};

/**
 * Get data policy for a provider
 * 
 * @task T016
 * @epic T001
 * @why Display provider-specific data handling per REQ-018
 * @what Returns policy for specified provider
 * @param {Provider} provider - Provider name
 * @returns {ProviderDataPolicy} Provider data policy
 */
export function getProviderPolicy(provider: Provider): ProviderDataPolicy {
    return PROVIDER_POLICIES[provider];
}

/**
 * Get all provider policies
 * 
 * @task T016
 * @epic T001
 * @why Display all provider policies
 * @what Returns all provider data policies
 * @returns {Record<Provider, ProviderDataPolicy>} All provider policies
 */
export function getAllProviderPolicies(): Record<Provider, ProviderDataPolicy> {
    return { ...PROVIDER_POLICIES };
}

/**
 * Get privacy policy summary for UI display
 * 
 * @task T016
 * @epic T001
 * @why User-friendly policy display per REQ-018
 * @what Returns formatted policy summary
 * @param {Provider} provider - Active provider
 * @param {PrivacySettings} settings - Current privacy settings
 * @returns {string} Formatted policy summary
 */
export function getPrivacySummary(provider: Provider, settings: PrivacySettings): string {
    const policy = PROVIDER_POLICIES[provider];
    
    const lines = [
        '=== Voyc Privacy & Data Handling ===',
        '',
        `Active Provider: ${policy.provider}`,
        '',
        'Data Sent to Provider:',
        ...policy.dataSent.map(item => `  • ${item}`),
        '',
        'Provider Data Retention:',
        `  ${policy.retentionPolicy}`,
        '',
        'Local Privacy Settings:',
        `  • Store audio locally: ${settings.storeAudioLocally ? 'YES' : 'NO'}`,
        `  • Log transcripts: ${settings.logTranscripts ? 'YES' : 'NO'}`,
        `  • Telemetry enabled: ${settings.enableTelemetry ? 'YES' : 'NO'}`,
        '',
        'Privacy Policy Links:',
        `  • ${policy.provider}: ${policy.privacyPolicyUrl}`,
        '  • Voyc: https://github.com/voyc/voyc/blob/main/PRIVACY.md',
        '',
        'Last Updated: ' + settings.lastUpdated,
    ];

    return lines.join('\n');
}

/**
 * Get short privacy notice for display
 * 
 * @task T016
 * @epic T001
 * @why Brief privacy notice for UI
 * @what Returns one-line privacy notice
 * @param {Provider} provider - Active provider
 * @returns {string} Short privacy notice
 */
export function getShortPrivacyNotice(provider: Provider): string {
    const policy = PROVIDER_POLICIES[provider];
    return `Audio sent to ${policy.provider}. ${policy.storesAudio ? 'Provider may retain audio.' : 'Audio not retained by provider.'}`;
}

/**
 * Validate privacy settings
 * 
 * @task T016
 * @epic T001
 * @why Ensure valid privacy configuration
 * @what Validates and sanitizes privacy settings
 * @param {Partial<PrivacySettings>} partial - Partial settings
 * @returns {PrivacySettings} Validated settings
 */
export function validatePrivacySettings(partial: Partial<PrivacySettings>): PrivacySettings {
    const settings: PrivacySettings = {
        ...DEFAULT_PRIVACY_SETTINGS,
    };

    if (typeof partial.storeAudioLocally === 'boolean') {
        settings.storeAudioLocally = partial.storeAudioLocally;
    }

    if (typeof partial.logTranscripts === 'boolean') {
        settings.logTranscripts = partial.logTranscripts;
    }

    if (typeof partial.enableTelemetry === 'boolean') {
        settings.enableTelemetry = partial.enableTelemetry;
    }

    if (typeof partial.audioRetentionDays === 'number' && partial.audioRetentionDays >= 0) {
        settings.audioRetentionDays = partial.audioRetentionDays;
    }

    settings.lastUpdated = new Date().toISOString();

    return settings;
}

/**
 * Check if audio retention is enabled
 * 
 * @task T016
 * @epic T001
 * @why Quick check for audio retention per REQ-019
 * @what Returns true if audio should be stored
 * @param {PrivacySettings} settings - Privacy settings
 * @returns {boolean} True if audio retention enabled
 */
export function isAudioRetentionEnabled(settings: PrivacySettings): boolean {
    return settings.storeAudioLocally && settings.audioRetentionDays > 0;
}

/**
 * Get data retention warning
 * 
 * @task T016
 * @epic T001
 * @why Warn users about data retention
 * @what Returns warning message if retention enabled
 * @param {PrivacySettings} settings - Privacy settings
 * @returns {string | null} Warning message or null
 */
export function getRetentionWarning(settings: PrivacySettings): string | null {
    if (!settings.storeAudioLocally) {
        return null;
    }

    if (settings.audioRetentionDays === 0) {
        return 'Warning: Audio storage is enabled but retention is set to 0 days. Audio will not be retained.';
    }

    return `Audio retention enabled: Recordings stored locally for ${settings.audioRetentionDays} days.`;
}

/**
 * Privacy policy markdown for documentation
 * @task T016
 * @epic T001
 * @why Complete privacy policy document
 * @what Full privacy policy text
 */
export const PRIVACY_POLICY_MARKDOWN = `
# Voyc Privacy Policy

## Overview

Voyc is committed to protecting your privacy. This policy explains how we handle your data.

## Data We Send to Providers

Voyc sends audio recordings to your chosen speech-to-text provider for transcription:

### ElevenLabs (Default)
- **Data sent**: Audio recordings, API key
- **Retention**: Audio is processed and not retained
- **Location**: US/EU depending on region
- **Policy**: https://elevenlabs.io/privacy

### OpenAI
- **Data sent**: Audio recordings, API key
- **Retention**: May retain up to 30 days for abuse monitoring
- **Location**: United States
- **Policy**: https://openai.com/privacy

### Baseten (Post-processing)
- **Data sent**: Text transcripts only (no audio), API key
- **Retention**: Not retained
- **Location**: United States
- **Policy**: https://baseten.co/privacy

## Local Data Handling

### Default Settings (Privacy-First)
- **Raw audio**: Not stored locally (REQ-019)
- **Transcripts**: Not logged locally (REQ-020)
- **Telemetry**: Disabled (PRD Section 10)

### Optional Features (Opt-in)
You may enable these features in settings:
- Local audio storage (with configurable retention)
- Transcript logging for debugging

## Your API Keys

- API keys are stored only on your local machine
- Keys are never transmitted to Voyc developers
- Keys are redacted in all logs

## Contact

For privacy questions, please open an issue on GitHub.
`;
