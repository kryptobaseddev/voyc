/**
 * Push to Talk Toggle Component for Voyc
 * Toggle between push-to-talk and toggle modes
 */

import React from "react";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { useSettings } from "../../hooks/useSettings";

interface PushToTalkToggleProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const PushToTalkToggle: React.FC<PushToTalkToggleProps> = ({
  descriptionMode = "inline",
  grouped = false,
}) => {
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const pushToTalk = getSetting("push_to_talk") ?? true;

  return (
    <ToggleSwitch
      label="Push to Talk"
      description="Hold the hotkey to record, release to stop. When off, press to toggle recording."
      descriptionMode={descriptionMode}
      grouped={grouped}
      checked={pushToTalk}
      onChange={(checked) => updateSetting("push_to_talk", checked)}
      isUpdating={isUpdating("push_to_talk")}
    />
  );
};
