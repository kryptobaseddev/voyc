/**
 * Autostart Toggle Component for Voyc
 * Enables/disables starting app on system login
 * Adapted from Handy's AutostartToggle
 */

import React from "react";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { useSettings } from "../../hooks/useSettings";

interface AutostartToggleProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const AutostartToggle: React.FC<AutostartToggleProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const autostartEnabled = getSetting("autostart_enabled") ?? false;

    return (
      <ToggleSwitch
        checked={autostartEnabled}
        onChange={(enabled) => updateSetting("autostart_enabled", enabled)}
        isUpdating={isUpdating("autostart_enabled")}
        label="Start on Login"
        description="Automatically start Voyc when you log into your computer"
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  }
);

AutostartToggle.displayName = "AutostartToggle";
