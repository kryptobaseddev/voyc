/**
 * Mute While Recording Toggle Component for Voyc
 * Mutes system audio during dictation to prevent feedback
 * Adapted from Handy's MuteWhileRecording
 */

import React from "react";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { useSettings } from "../../hooks/useSettings";

interface MuteWhileRecordingToggleProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const MuteWhileRecordingToggle: React.FC<MuteWhileRecordingToggleProps> =
  React.memo(({ descriptionMode = "tooltip", grouped = false }) => {
    const { getSetting, updateSetting, isUpdating } = useSettings();
    const muteEnabled = getSetting("mute_while_recording") || false;

    return (
      <ToggleSwitch
        checked={muteEnabled}
        onChange={(enabled) => updateSetting("mute_while_recording", enabled)}
        isUpdating={isUpdating("mute_while_recording")}
        label="Mute While Recording"
        description="Automatically mute system audio during dictation to prevent feedback"
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  });

MuteWhileRecordingToggle.displayName = "MuteWhileRecordingToggle";
