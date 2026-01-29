/**
 * Log Level Selector Component for Voyc
 * Allows users to configure logging verbosity
 * Adapted from Handy's LogLevelSelector
 */

import React from "react";
import { SettingContainer } from "../ui/SettingContainer";
import { Dropdown, type DropdownOption } from "../ui/Dropdown";
import { useSettings } from "../../hooks/useSettings";

const LOG_LEVEL_OPTIONS: DropdownOption[] = [
  { value: "error", label: "Error" },
  { value: "warn", label: "Warn" },
  { value: "info", label: "Info" },
  { value: "debug", label: "Debug" },
  { value: "trace", label: "Trace" },
];

interface LogLevelSelectorProps {
  descriptionMode?: "tooltip" | "inline";
  grouped?: boolean;
}

export const LogLevelSelector: React.FC<LogLevelSelectorProps> = ({
  descriptionMode = "tooltip",
  grouped = false,
}) => {
  const { settings, updateSetting, isUpdating } = useSettings();
  // Note: log_level might need to be added to AppSettings if not present
  const currentLevel = "info"; // Default fallback

  const handleSelect = async (value: string) => {
    if (value === currentLevel) return;

    try {
      // TODO: Implement log level setting when backend supports it
      console.log("Log level would be set to:", value);
    } catch (error) {
      console.error("Failed to update log level:", error);
    }
  };

  return (
    <SettingContainer
      title="Log Level"
      description="Control the verbosity of application logs for debugging"
      descriptionMode={descriptionMode}
      grouped={grouped}
      layout="horizontal"
    >
      <Dropdown
        options={LOG_LEVEL_OPTIONS}
        selectedValue={currentLevel}
        onSelect={handleSelect}
        disabled={!settings}
      />
    </SettingContainer>
  );
};
