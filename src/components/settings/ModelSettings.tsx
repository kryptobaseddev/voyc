/**
 * Model Settings Panel for Voyc
 * Contains: Model selector, download, unload timeout, cloud fallback threshold
 * Adapted from Handy's model management patterns
 */

import React from "react";
import { SettingsGroup } from "../ui/SettingsGroup";
import { ModelSelector } from "./ModelSelector";
import { ModelUnloadTimeout } from "./ModelUnloadTimeout";
import { CloudFallbackThreshold } from "./CloudFallbackThreshold";

export const ModelSettings: React.FC = () => {
  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title="Speech Recognition Models">
        <ModelSelector grouped={true} />
      </SettingsGroup>

      <SettingsGroup title="Performance">
        <ModelUnloadTimeout descriptionMode="tooltip" grouped={true} />
        <CloudFallbackThreshold descriptionMode="tooltip" grouped={true} />
      </SettingsGroup>
    </div>
  );
};
