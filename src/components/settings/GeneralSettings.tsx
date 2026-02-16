/**
 * General Settings Panel for Voyc
 * Contains: Theme, Autostart, Update Checks, Log Level
 * Adapted from Handy's advanced settings structure
 */

import React from "react";
import { SettingsGroup } from "../ui/SettingsGroup";
import { ThemeSelector } from "./ThemeSelector";
import { AutostartToggle } from "./AutostartToggle";
import { UpdateChecksToggle } from "./UpdateChecksToggle";
import { LogLevelSelector } from "./LogLevelSelector";

export const GeneralSettings: React.FC = () => {
  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title="Appearance">
        <ThemeSelector grouped={true} />
      </SettingsGroup>
      <SettingsGroup title="Application">
        <AutostartToggle descriptionMode="tooltip" grouped={true} />
        <UpdateChecksToggle descriptionMode="tooltip" grouped={true} />
        <LogLevelSelector descriptionMode="tooltip" grouped={true} />
      </SettingsGroup>
    </div>
  );
};
