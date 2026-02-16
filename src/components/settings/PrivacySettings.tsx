/**
 * Privacy Settings Panel for Voyc
 * Data handling policy and privacy controls (REQ-018, REQ-019, REQ-020)
 */

import React from "react";
import { SettingsGroup } from "../ui/SettingsGroup";

export const PrivacySettings: React.FC = () => {
  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title="Data Handling Policy">
        <div className="max-w-none">
          <div className="p-4 rounded-lg bg-logo-primary/5 border border-logo-primary/20 mb-4">
            <h4 className="text-sm font-medium text-logo-primary mb-2 flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              Privacy-First Design
            </h4>
            <p className="text-xs text-text/70">
              Voyc is designed with privacy as a core principle. Your voice data
              is processed locally whenever possible, and cloud services are
              only used when explicitly enabled.
            </p>
          </div>

          <div className="space-y-4 text-sm text-text/80">
            <div>
              <h4 className="font-medium text-text mb-1">
                Local Processing (Default)
              </h4>
              <p className="text-text/60">
                When using local Whisper models, all audio processing happens
                entirely on your device. No audio data leaves your computer.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-text mb-1">Cloud Fallback</h4>
              <p className="text-text/60">
                If cloud fallback is enabled and local confidence is below
                threshold, audio may be sent to your configured cloud provider
                (ElevenLabs or OpenAI) for processing. These providers have
                their own privacy policies.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-text mb-1">Audio Storage</h4>
              <p className="text-text/60">
                By default, Voyc does not store raw audio recordings. Audio is
                processed in real-time and discarded after transcription. This
                cannot be changed in the current version.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-text mb-1">Configuration Data</h4>
              <p className="text-text/60">
                Your settings (API keys, preferences) are stored locally on your
                device in encrypted format. They are never transmitted to
                external servers.
              </p>
            </div>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Log Redaction (REQ-020)">
        <div className="space-y-4">
          <p className="text-sm text-text/60">
            Application logs are automatically redacted to remove sensitive
            information. Raw audio and full transcription text are never written
            to log files.
          </p>

          <div className="p-3 rounded-lg bg-mid-gray/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium">Redaction Active</span>
            </div>
            <p className="text-xs text-text/50">
              Sensitive data is automatically masked in logs: API keys,
              transcription content, and audio metadata are replaced with
              [REDACTED] markers.
            </p>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Third-Party Services">
        <div className="space-y-3 text-sm">
          <div className="p-3 rounded-lg bg-mid-gray/5">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">ElevenLabs</span>
              <a
                href="https://elevenlabs.io/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-logo-primary hover:underline"
              >
                Privacy Policy
              </a>
            </div>
            <p className="text-xs text-text/50">
              Speech-to-text processing when cloud fallback is enabled.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-mid-gray/5">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">OpenAI</span>
              <a
                href="https://openai.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-logo-primary hover:underline"
              >
                Privacy Policy
              </a>
            </div>
            <p className="text-xs text-text/50">
              Alternative STT provider and post-processing LLM.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-mid-gray/5">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">Baseten</span>
              <a
                href="https://baseten.co/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-logo-primary hover:underline"
              >
                Privacy Policy
              </a>
            </div>
            <p className="text-xs text-text/50">
              Post-processing LLM provider for text formatting.
            </p>
          </div>
        </div>
      </SettingsGroup>
    </div>
  );
};
