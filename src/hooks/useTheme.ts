/**
 * Theme management hook for Voyc
 * Applies light/dark/system theme mode to the document root element.
 *
 * For "system" mode, queries the Rust backend which uses the XDG Desktop Portal
 * Settings interface to detect the actual OS color scheme. This works reliably
 * on GNOME, KDE, and other Linux desktops — unlike matchMedia which WebKitGTK
 * does not implement correctly on Linux.
 */

import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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

    // "system" mode: query the Rust backend for the real OS color scheme
    let cancelled = false;

    const detectAndApply = async () => {
      try {
        const scheme = await invoke<string>("get_system_color_scheme");
        if (!cancelled) {
          applyThemeClass(scheme === "dark" ? "dark" : "light");
        }
      } catch {
        // Fallback to matchMedia if Rust command fails
        if (!cancelled) {
          const mq = window.matchMedia("(prefers-color-scheme: dark)");
          applyThemeClass(mq.matches ? "dark" : "light");
        }
      }
    };

    detectAndApply();

    // Listen for system theme changes emitted from the Rust backend
    let unlisten: (() => void) | null = null;
    listen<string>("system-theme-changed", (event) => {
      if (!cancelled) {
        applyThemeClass(event.payload === "dark" ? "dark" : "light");
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [themeMode]);

  const setTheme = (mode: ThemeMode) => {
    updateSetting("theme_mode", mode);
  };

  return { themeMode, setTheme };
}
