/**
 * Cloud Settings Panel for Voyc
 * Contains: API keys for cloud STT providers (ElevenLabs, OpenAI)
 * Specific to Voyc's cloud fallback functionality
 */

import React from "react";
import { SettingsGroup } from "../ui/SettingsGroup";
import { ApiKeyInput } from "./ApiKeyInput";
import { ProviderPriority } from "./ProviderPriority";
import { PostProcessingSettings } from "./PostProcessingSettings";

export const CloudSettings: React.FC = () => {
  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title="Cloud Providers">
        <p className="px-4 py-2 text-sm text-mid-gray">
          Configure API keys for cloud speech-to-text services. These are used
          as fallback when local transcription confidence is low.
        </p>
        <ApiKeyInput
          provider="elevenlabs"
          label="ElevenLabs API Key"
          description="Used for high-quality cloud transcription fallback"
          placeholder="sk_..."
          grouped={true}
        />
        <ApiKeyInput
          provider="openai"
          label="OpenAI API Key"
          description="Used for Whisper cloud transcription fallback"
          placeholder="sk-..."
          grouped={true}
        />
      </SettingsGroup>

      <SettingsGroup title="Provider Priority">
        <ProviderPriority grouped={true} />
      </SettingsGroup>

      <PostProcessingSettings />
    </div>
  );
};
