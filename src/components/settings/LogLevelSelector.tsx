/**
 * Log Level Selector Component for Voyc
 * Allows users to configure logging verbosity
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

  const currentLevel = settings?.log_level ?? "info";

  const handleSelect = async (value: string) => {
    if (value === currentLevel) return;
    await updateSetting(
      "log_level",
      value as "error" | "warn" | "info" | "debug" | "trace",
    );
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
        disabled={!settings || isUpdating("log_level")}
      />
    </SettingContainer>
  );
};
