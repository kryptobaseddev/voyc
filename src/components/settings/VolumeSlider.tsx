/**
 * Volume Slider Component for Voyc
 * Controls audio feedback volume level
 * Adapted from Handy's VolumeSlider
 */

import React from "react";
import { Slider } from "../ui/Slider";
import { useSettings } from "../../hooks/useSettings";

interface VolumeSliderProps {
  disabled?: boolean;
}

export const VolumeSlider: React.FC<VolumeSliderProps> = ({
  disabled = false,
}) => {
  const { getSetting, updateSetting } = useSettings();
  const audioFeedbackVolume = getSetting("audio_feedback_volume") ?? 0.5;

  return (
    <Slider
      value={audioFeedbackVolume}
      onChange={(value: number) =>
        updateSetting("audio_feedback_volume", value)
      }
      min={0}
      max={1}
      step={0.1}
      label="Volume"
      description="Adjust the volume of audio feedback sounds"
      descriptionMode="tooltip"
      grouped
      formatValue={(value) => `${Math.round(value * 100)}%`}
      disabled={disabled}
    />
  );
};
