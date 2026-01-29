/**
 * Provider Priority Component for Voyc
 * Configure the order of cloud STT providers for fallback
 * Specific to Voyc's hybrid local/cloud architecture
 */

import React, { useState } from "react";
import { SettingContainer } from "../ui/SettingContainer";
import { Button } from "../ui/Button";

interface ProviderPriorityProps {
  grouped?: boolean;
}

interface Provider {
  id: string;
  name: string;
  enabled: boolean;
}

export const ProviderPriority: React.FC<ProviderPriorityProps> = ({
  grouped = false,
}) => {
  // TODO: Sync with backend when implemented
  const [providers, setProviders] = useState<Provider[]>([
    { id: "local", name: "Local (Parakeet)", enabled: true },
    { id: "elevenlabs", name: "ElevenLabs", enabled: true },
    { id: "openai", name: "OpenAI Whisper", enabled: true },
  ]);

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const newProviders = [...providers];
    [newProviders[index - 1], newProviders[index]] = [
      newProviders[index],
      newProviders[index - 1],
    ];
    setProviders(newProviders);
  };

  const moveDown = (index: number) => {
    if (index >= providers.length - 1) return;
    const newProviders = [...providers];
    [newProviders[index], newProviders[index + 1]] = [
      newProviders[index + 1],
      newProviders[index],
    ];
    setProviders(newProviders);
  };

  const toggleProvider = (index: number) => {
    // Don't allow disabling local provider
    if (providers[index].id === "local") return;

    const newProviders = [...providers];
    newProviders[index] = {
      ...newProviders[index],
      enabled: !newProviders[index].enabled,
    };
    setProviders(newProviders);
  };

  return (
    <SettingContainer
      title="Provider Order"
      description="Drag to reorder. Providers are tried in order from top to bottom."
      grouped={grouped}
      layout="stacked"
    >
      <div className="space-y-1">
        {providers.map((provider, index) => (
          <div
            key={provider.id}
            className={`flex items-center gap-2 p-2 rounded border transition-all ${
              provider.enabled
                ? "border-mid-gray/20 bg-background"
                : "border-mid-gray/10 bg-mid-gray/5 opacity-50"
            }`}
          >
            <div className="flex flex-col gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => moveUp(index)}
                disabled={index === 0}
                className="!p-0.5 !h-auto"
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => moveDown(index)}
                disabled={index === providers.length - 1}
                className="!p-0.5 !h-auto"
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </Button>
            </div>

            <div className="flex-1">
              <span
                className={`text-sm font-medium ${
                  provider.enabled ? "" : "text-mid-gray"
                }`}
              >
                {provider.name}
              </span>
              {provider.id === "local" && (
                <span className="ml-2 text-xs text-mid-gray">(always first)</span>
              )}
            </div>

            <span className="text-xs text-mid-gray w-4 text-center">
              {index + 1}
            </span>

            {provider.id !== "local" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleProvider(index)}
                title={provider.enabled ? "Disable" : "Enable"}
                className="!p-1"
              >
                {provider.enabled ? (
                  <svg
                    className="h-4 w-4 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-4 w-4 text-mid-gray"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                )}
              </Button>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-mid-gray/70 mt-2">
        Local transcription is always attempted first. Cloud providers are used
        as fallback when local confidence is below the threshold.
      </p>
    </SettingContainer>
  );
};
