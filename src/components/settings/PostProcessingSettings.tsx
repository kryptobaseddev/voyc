/**
 * Post-Processing Settings Component for Voyc
 * Configure LLM post-processing for smart formatting (REQ-011-013)
 */

import React from "react";
import { SettingsGroup } from "../ui/SettingsGroup";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { Select } from "../ui/Select";
import { useSettings } from "../../hooks/useSettings";

const POST_PROCESS_PROVIDERS = [
  { value: "baseten", label: "Baseten (LLaMA - Default)" },
  { value: "openai", label: "OpenAI GPT" },
  { value: "none", label: "Disabled" },
];

export const PostProcessingSettings: React.FC = () => {
  const { getSetting, updateSetting, isUpdating } = useSettings();

  const postProcessEnabled = (getSetting("post_process_enabled") as boolean) ?? false;
  const postProcessProvider = (getSetting("post_process_provider") as string) ?? "baseten";
  const postProcessApiKey = (getSetting("post_process_api_key") as string) ?? "";

  return (
    <SettingsGroup
      title="Post-Processing (REQ-011)"
      description="Smart formatting and text cleanup using LLM"
    >
      <ToggleSwitch
        label="Enable Post-Processing"
        description="Process transcription through LLM for formatting and corrections"
        descriptionMode="tooltip"
        grouped={true}
        checked={postProcessEnabled}
        onChange={(checked) => updateSetting("post_process_enabled", checked)}
        isUpdating={isUpdating("post_process_enabled")}
      />

      <div className={`space-y-4 mt-4 ${!postProcessEnabled ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium">Provider</span>
            <p className="text-xs text-text/50">Select the LLM provider for post-processing</p>
          </div>
          <Select
            value={postProcessProvider}
            onChange={(value) => {
              if (value) updateSetting("post_process_provider", value);
            }}
            options={POST_PROCESS_PROVIDERS}
            disabled={!postProcessEnabled}
          />
        </div>

        {postProcessProvider !== "none" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">API Key</label>
            <input
              type="password"
              value={postProcessApiKey}
              onChange={(e) => updateSetting("post_process_api_key", e.target.value)}
              placeholder={`Enter ${postProcessProvider === "baseten" ? "Baseten" : "OpenAI"} API key`}
              className="w-full px-3 py-2 text-sm rounded-lg bg-mid-gray/10 border border-mid-gray/20 focus:border-logo-primary focus:outline-none"
              disabled={!postProcessEnabled}
            />
            <p className="text-xs text-text/50">
              {postProcessProvider === "baseten"
                ? "Get your API key from baseten.co"
                : "Get your API key from platform.openai.com"}
            </p>
          </div>
        )}

        <div className="p-3 rounded-lg bg-mid-gray/5 text-xs text-text/60">
          <p className="font-medium mb-1">How it works:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Transcribed text is sent to the LLM for formatting</li>
            <li>Adds punctuation, capitalization, and structure</li>
            <li>Baseten targets &lt;250ms latency (REQ-017)</li>
            <li>Can fix common speech-to-text errors</li>
          </ul>
        </div>
      </div>
    </SettingsGroup>
  );
};
