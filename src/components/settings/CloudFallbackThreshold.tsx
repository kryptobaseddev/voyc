/**
 * Cloud Fallback Threshold Component for Voyc
 * Controls when to fall back to cloud STT if local confidence is low
 * Specific to Voyc's hybrid local/cloud STT architecture
 */

import React from "react";
import { Slider } from "../ui/Slider";
import { SettingContainer } from "../ui/SettingContainer";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { useSettings } from "../../hooks/useSettings";

interface CloudFallbackThresholdProps {
  descriptionMode?: "tooltip" | "inline";
  grouped?: boolean;
}

export const CloudFallbackThreshold: React.FC<CloudFallbackThresholdProps> = ({
  descriptionMode = "tooltip",
  grouped = false,
}) => {
  const { settings } = useSettings();

  // TODO: These settings need to be added to AppSettings and backend
  // For now, using local state as placeholder
  const [cloudFallbackEnabled, setCloudFallbackEnabled] = React.useState(true);
  const [threshold, setThreshold] = React.useState(0.85);

  return (
    <div className="space-y-2">
      <ToggleSwitch
        checked={cloudFallbackEnabled}
        onChange={setCloudFallbackEnabled}
        label="Cloud Fallback"
        description="Automatically use cloud STT when local transcription confidence is low"
        descriptionMode={descriptionMode}
        grouped={grouped}
      />

      {cloudFallbackEnabled && (
        <div className={grouped ? "px-4 pb-2" : ""}>
          <Slider
            value={threshold}
            onChange={setThreshold}
            min={0.5}
            max={1}
            step={0.05}
            label="Confidence Threshold"
            description="Fall back to cloud when local confidence is below this value"
            descriptionMode="tooltip"
            grouped={grouped}
            formatValue={(value) => `${Math.round(value * 100)}%`}
          />
          <p className="text-xs text-mid-gray mt-1 px-1">
            Higher values mean more cloud usage but better accuracy. Default: 85%
          </p>
        </div>
      )}
    </div>
  );
};
