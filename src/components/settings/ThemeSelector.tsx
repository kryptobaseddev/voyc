/**
 * Theme Selector Component for Voyc
 * Allows choosing between System, Light, and Dark theme modes
 */

import React from "react";
import { useSettings } from "../../hooks/useSettings";

interface ThemeSelectorProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

type ThemeMode = "system" | "light" | "dark";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: "system", label: "System", icon: "💻" },
  { value: "light", label: "Light", icon: "☀" },
  { value: "dark", label: "Dark", icon: "🌙" },
];

export const ThemeSelector: React.FC<ThemeSelectorProps> = React.memo(
  ({ grouped = false }) => {
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const themeMode = (getSetting("theme_mode") as ThemeMode) ?? "system";

    return (
      <div
        className={`flex items-center justify-between ${
          grouped
            ? "py-2.5 border-b border-mid-gray/10 last:border-b-0"
            : "p-3 bg-background-secondary rounded-lg border border-mid-gray/20"
        }`}
      >
        <div className="flex-1">
          <div className="text-sm font-medium">Theme</div>
          <div className="text-xs text-mid-gray mt-0.5">
            Choose your preferred color scheme
          </div>
        </div>
        <div className="flex items-center gap-1 bg-mid-gray/10 rounded-lg p-0.5">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => updateSetting("theme_mode", option.value)}
              disabled={isUpdating("theme_mode")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                themeMode === option.value
                  ? "bg-logo-primary text-white shadow-sm"
                  : "text-mid-gray hover:text-text hover:bg-mid-gray/10"
              } disabled:opacity-50`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  },
);

ThemeSelector.displayName = "ThemeSelector";
