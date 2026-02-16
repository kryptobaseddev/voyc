/**
 * Theme management hook for Voyc
 * Applies light/dark/system theme mode to the document root element
 */

import { useEffect } from "react";
import { useSettingsStore } from "../stores/settingsStore";

type ThemeMode = "system" | "light" | "dark";

/**
 * Applies the correct CSS class to <html> based on the theme_mode setting.
 *
 * - "dark": adds .dark-theme class
 * - "light": adds .light-theme class (prevents dark media query from applying)
 * - "system": removes both classes, letting prefers-color-scheme handle it
 */
export function useTheme() {
  const themeMode = useSettingsStore(
    (state) => (state.settings?.theme_mode as ThemeMode) ?? "system",
  );
  const updateSetting = useSettingsStore((state) => state.updateSetting);

  useEffect(() => {
    const root = document.documentElement;

    // Remove both theme classes first
    root.classList.remove("dark-theme", "light-theme");

    if (themeMode === "dark") {
      root.classList.add("dark-theme");
    } else if (themeMode === "light") {
      root.classList.add("light-theme");
    }
    // "system" mode: no class added, CSS prefers-color-scheme handles it
  }, [themeMode]);

  const setTheme = (mode: ThemeMode) => {
    updateSetting("theme_mode", mode);
  };

  return { themeMode, setTheme };
}
