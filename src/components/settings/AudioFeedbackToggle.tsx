/**
 * Audio Feedback Toggle Component for Voyc
 * Enables/disables audio feedback sounds for dictation start/stop
 * Adapted from Handy's AudioFeedback
 */

import React from "react";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { useSettings } from "../../hooks/useSettings";

interface AudioFeedbackToggleProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const AudioFeedbackToggle: React.FC<AudioFeedbackToggleProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { getSetting, updateSetting, isUpdating } = useSettings();
    const audioFeedbackEnabled = getSetting("audio_feedback") || false;

    return (
      <ToggleSwitch
        checked={audioFeedbackEnabled}
        onChange={(enabled) => updateSetting("audio_feedback", enabled)}
        isUpdating={isUpdating("audio_feedback")}
        label="Audio Feedback"
        description="Play sounds when starting and stopping dictation"
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  }
);

AudioFeedbackToggle.displayName = "AudioFeedbackToggle";
