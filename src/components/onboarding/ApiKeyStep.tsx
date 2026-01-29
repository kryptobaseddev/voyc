import React, { useState } from "react";
import { Cloud, Key, ChevronRight, ChevronDown } from "lucide-react";
import { Input } from "../ui/Input";

interface ApiKeyStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

interface ApiKeyConfig {
  elevenLabsKey: string;
  openAiKey: string;
}

const ApiKeyStep: React.FC<ApiKeyStepProps> = ({ onComplete, onSkip }) => {
  const [config, setConfig] = useState<ApiKeyConfig>({
    elevenLabsKey: "",
    openAiKey: "",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: Save API keys to settings store
      // For now, we'll just proceed - the settings UI can handle this later
      console.log("API keys configured:", {
        elevenLabs: config.elevenLabsKey ? "***" : "(not set)",
        openAi: config.openAiKey ? "***" : "(not set)",
      });
      onComplete();
    } catch (error) {
      console.error("Failed to save API keys:", error);
    } finally {
      setSaving(false);
    }
  };

  const hasAnyKey = config.elevenLabsKey || config.openAiKey;

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center mb-2">
        <h2 className="text-xl font-semibold text-text mb-2">
          Cloud API Keys (Optional)
        </h2>
        <p className="text-text/70">
          Voyc works entirely offline with local models. Optionally, you can add
          API keys for cloud-based speech recognition as a fallback.
        </p>
      </div>

      {/* Main content */}
      <div className="space-y-4">
        {/* Info card */}
        <div className="p-4 rounded-lg bg-logo-primary/5 border border-logo-primary/20">
          <div className="flex items-start gap-3">
            <Cloud className="w-5 h-5 text-logo-primary mt-0.5 shrink-0" />
            <div>
              <h3 className="font-medium text-text mb-1">
                Why add cloud API keys?
              </h3>
              <ul className="text-sm text-text/70 space-y-1">
                <li>
                  - Fallback when local models are unavailable or loading
                </li>
                <li>- Higher accuracy for specialized vocabularies</li>
                <li>- Support for more languages</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Collapsible API key section */}
        <div className="border border-mid-gray/20 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between p-4 hover:bg-mid-gray/5 transition-colors"
            type="button"
          >
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-text/60" />
              <span className="font-medium text-text">Configure API Keys</span>
            </div>
            {showAdvanced ? (
              <ChevronDown className="w-5 h-5 text-text/60" />
            ) : (
              <ChevronRight className="w-5 h-5 text-text/60" />
            )}
          </button>

          {showAdvanced && (
            <div className="p-4 pt-0 space-y-4">
              {/* ElevenLabs API Key */}
              <div className="space-y-2">
                <label
                  htmlFor="elevenlabs-key"
                  className="block text-sm font-medium text-text"
                >
                  ElevenLabs API Key
                </label>
                <Input
                  id="elevenlabs-key"
                  type="password"
                  placeholder="Enter your ElevenLabs API key"
                  value={config.elevenLabsKey}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      elevenLabsKey: e.target.value,
                    }))
                  }
                  className="w-full"
                />
                <p className="text-xs text-text/50">
                  Get your API key from{" "}
                  <a
                    href="https://elevenlabs.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-logo-primary hover:underline"
                  >
                    elevenlabs.io
                  </a>
                </p>
              </div>

              {/* OpenAI API Key */}
              <div className="space-y-2">
                <label
                  htmlFor="openai-key"
                  className="block text-sm font-medium text-text"
                >
                  OpenAI API Key
                </label>
                <Input
                  id="openai-key"
                  type="password"
                  placeholder="Enter your OpenAI API key"
                  value={config.openAiKey}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, openAiKey: e.target.value }))
                  }
                  className="w-full"
                />
                <p className="text-xs text-text/50">
                  Get your API key from{" "}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-logo-primary hover:underline"
                  >
                    platform.openai.com
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-4">
        <button
          onClick={onSkip}
          className="px-4 py-2 text-sm text-text/70 hover:text-text transition-colors"
          type="button"
        >
          Skip for now
        </button>

        {hasAnyKey && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 rounded-lg bg-logo-primary hover:bg-logo-primary/90 text-white text-sm font-medium transition-colors disabled:opacity-50"
            type="button"
          >
            {saving ? "Saving..." : "Save & Continue"}
          </button>
        )}
      </div>
    </div>
  );
};

export default ApiKeyStep;
