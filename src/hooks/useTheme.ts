/**
 * Theme management hook for Voyc
 * Applies light/dark/system theme mode to the document root element.
 *
 * For "system" mode we actively query `matchMedia("(prefers-color-scheme: dark)")`
 * rather than relying on the CSS media query alone, because WebKitGTK on Linux
 * does not always propagate the GTK/GNOME dark-mode preference to CSS.
 */

import { useEffect } from "react";
import { useSettingsStore } from "../stores/settingsStore";

type ThemeMode = "system" | "light" | "dark";

function applyThemeClass(mode: "light" | "dark") {
  const root = document.documentElement;
  root.classList.remove("dark-theme", "light-theme");
  if (mode === "dark") {
    root.classList.add("dark-theme");
  } else {
    root.classList.add("light-theme");
  }
}

export function useTheme() {
  const themeMode = useSettingsStore(
    (state) => (state.settings?.theme_mode as ThemeMode) ?? "system",
  );
  const updateSetting = useSettingsStore((state) => state.updateSetting);

  useEffect(() => {
    if (themeMode === "dark") {
      applyThemeClass("dark");
      return;
    }

    if (themeMode === "light") {
      applyThemeClass("light");
      return;
    }

    // "system" mode: detect OS preference via matchMedia and listen for changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    applyThemeClass(mq.matches ? "dark" : "light");

    const handler = (e: MediaQueryListEvent) => {
      applyThemeClass(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);

    return () => {
      mq.removeEventListener("change", handler);
    };
  }, [themeMode]);

  const setTheme = (mode: ThemeMode) => {
    updateSetting("theme_mode", mode);
  };

  return { themeMode, setTheme };
}
