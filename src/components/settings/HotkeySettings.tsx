/**
 * Hotkey Settings Panel for Voyc
 * Contains: Toggle dictation hotkey, Terminal paste hotkey
 * Adapted from Handy's GlobalShortcutInput patterns
 */

import React from "react";
import { SettingsGroup } from "../ui/SettingsGroup";
import { GlobalShortcutInput } from "./GlobalShortcutInput";

export const HotkeySettings: React.FC = () => {
  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title="Keyboard Shortcuts">
        <GlobalShortcutInput
          shortcutId="transcribe"
          descriptionMode="tooltip"
          grouped={true}
        />
        <GlobalShortcutInput
          shortcutId="terminal_paste"
          descriptionMode="tooltip"
          grouped={true}
        />
      </SettingsGroup>
    </div>
  );
};
