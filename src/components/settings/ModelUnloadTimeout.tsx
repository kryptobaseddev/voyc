/**
 * Model Unload Timeout Component for Voyc
 * Controls how long models stay loaded in memory after use
 * Adapted from Handy's ModelUnloadTimeout
 */

import React from "react";
import { Dropdown, type DropdownOption } from "../ui/Dropdown";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettings } from "../../hooks/useSettings";
import type { ModelUnloadTimeout as TimeoutType } from "../../stores/settingsStore";
import { invoke } from "@tauri-apps/api/core";

interface ModelUnloadTimeoutProps {
  descriptionMode?: "tooltip" | "inline";
  grouped?: boolean;
}

const TIMEOUT_OPTIONS: DropdownOption[] = [
  { value: "never", label: "Never" },
  { value: "immediately", label: "Immediately" },
  { value: "min_2", label: "2 minutes" },
  { value: "min_5", label: "5 minutes" },
  { value: "min_10", label: "10 minutes" },
  { value: "min_15", label: "15 minutes" },
  { value: "hour_1", label: "1 hour" },
];

export const ModelUnloadTimeout: React.FC<ModelUnloadTimeoutProps> = ({
  descriptionMode = "tooltip",
  grouped = false,
}) => {
  const { getSetting, updateSetting, settings } = useSettings();

  const currentValue = getSetting("model_unload_timeout") ?? "never";

  const handleChange = async (value: string) => {
    const newTimeout = value as TimeoutType;

    try {
      await invoke("set_model_unload_timeout", { timeout: newTimeout });
      updateSetting("model_unload_timeout", newTimeout);
    } catch (error) {
      console.error("Failed to update model unload timeout:", error);
    }
  };

  return (
    <SettingContainer
      title="Model Unload Timeout"
      description="How long to keep the model loaded in memory after use. Keeping it loaded speeds up subsequent dictations."
      descriptionMode={descriptionMode}
      grouped={grouped}
      layout="horizontal"
    >
      <Dropdown
        options={TIMEOUT_OPTIONS}
        selectedValue={currentValue}
        onSelect={handleChange}
        disabled={!settings}
      />
    </SettingContainer>
  );
};
