/**
 * VAD Threshold Slider Component for Voyc
 * Controls Voice Activity Detection sensitivity (REQ-025)
 */

import React from "react";
import { Slider } from "../ui/Slider";
import { useSettings } from "../../hooks/useSettings";

interface VadThresholdSliderProps {
  grouped?: boolean;
}

export const VadThresholdSlider: React.FC<VadThresholdSliderProps> = ({
  grouped = false,
}) => {
  const { getSetting, updateSetting } = useSettings();
  const vadThreshold = (getSetting("vad_threshold") as number) ?? 0.5;

  const getSensitivityLabel = (value: number): string => {
    if (value < 0.3) return "High";
    if (value < 0.7) return "Normal";
    return "Low";
  };

  return (
    <div className={`${grouped ? "" : "p-4 rounded-lg bg-mid-gray/5"}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-sm font-medium">Voice Detection Sensitivity</span>
          <p className="text-xs text-text/50 mt-0.5">
            Adjust how sensitive Silero VAD is to speech
          </p>
        </div>
        <span className="text-xs text-text/60 bg-mid-gray/10 px-2 py-1 rounded">
          {getSensitivityLabel(vadThreshold)}
        </span>
      </div>
      <Slider
        value={vadThreshold}
        onChange={(value) => updateSetting("vad_threshold", value)}
        min={0}
        max={1}
        step={0.05}
        label=""
        description=""
        showValue={false}
        grouped={true}
      />
      <div className="flex justify-between text-xs text-text/40 mt-1">
        <span>More Sensitive</span>
        <span>Less Sensitive</span>
      </div>
    </div>
  );
};
