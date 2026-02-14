import { useEffect, useState, useRef } from "react";
import { Toaster, toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { OnboardingWizard } from "./components/onboarding";
import { SettingsPage } from "./components/settings";
import { useDictationStore } from "./stores/dictationStore";
import { useModelStore } from "./stores/modelStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useUpdaterStore } from "./stores/updaterStore";
import { WindowControls } from "./components/ui/WindowControls";
import "./App.css";

type AppState = "loading" | "onboarding" | "main";

function App() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [appVersion, setAppVersion] = useState<string>("...");
  const hasCompletedPostOnboardingInit = useRef(false);
  const hasAutoCheckedUpdates = useRef(false);

  const {
    checkFirstRun,
    isFirstRun,
    hasAnyModels,
    initialize: initializeModels,
  } = useModelStore();
  const {
    initialize: initializeSettings,
    refreshAudioDevices,
    refreshOutputDevices,
  } = useSettingsStore();
  const { initialize: initializeDictation, cleanup: cleanupDictation } =
    useDictationStore();
  const updateChecksEnabled = useSettingsStore(
    (state) => state.settings?.update_checks_enabled ?? true,
  );
  const {
    hasUpdate,
    latestVersion,
    isInstalling,
    checkForUpdates,
    installUpdate,
  } = useUpdaterStore();

  // Fetch app version on mount
  useEffect(() => {
    invoke<string>("get_app_version").then(setAppVersion).catch(console.error);
  }, []);

  // Check onboarding status on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize settings store
        await initializeSettings();

        // Check if this is first run (no models downloaded)
        const isFirst = await checkFirstRun();

        if (isFirst) {
          setAppState("onboarding");
        } else {
          setAppState("main");
        }
      } catch (error) {
        console.error("Failed to initialize app:", error);
        // Default to onboarding on error
        setAppState("onboarding");
      }
    };

    initializeApp();
  }, [checkFirstRun, initializeSettings]);

  // Initialize audio devices, models, and dictation event listeners when main app loads
  useEffect(() => {
    if (appState === "main" && !hasCompletedPostOnboardingInit.current) {
      hasCompletedPostOnboardingInit.current = true;

      // Initialize model store (loads models, current model, and first run status)
      initializeModels().catch((error) => {
        console.error("Failed to initialize models:", error);
      });

      // Refresh audio devices now that we're in the main app
      Promise.all([refreshAudioDevices(), refreshOutputDevices()]).catch(
        (error) => {
          console.error("Failed to refresh audio devices:", error);
        },
      );

      // Initialize dictation store event listeners
      initializeDictation().catch((error) => {
        console.error("Failed to initialize dictation listeners:", error);
      });

      console.log("Voyc main app initialized");
    }

    // Cleanup dictation listeners on unmount
    return () => {
      cleanupDictation();
    };
  }, [
    appState,
    initializeModels,
    refreshAudioDevices,
    refreshOutputDevices,
    initializeDictation,
    cleanupDictation,
  ]);

  // Startup/tray update checks
  useEffect(() => {
    if (
      appState === "main" &&
      appVersion !== "..." &&
      updateChecksEnabled &&
      !hasAutoCheckedUpdates.current
    ) {
      hasAutoCheckedUpdates.current = true;
      checkForUpdates(appVersion).catch(console.error);
    }
  }, [appState, appVersion, updateChecksEnabled, checkForUpdates]);

  useEffect(() => {
    const setup = async () => {
      const unlisten = await listen("check-for-updates", async () => {
        if (appVersion !== "...") {
          await checkForUpdates(appVersion);
        }
      });

      return unlisten;
    };

    let cleanup: (() => void) | undefined;
    setup().then((fn) => {
      cleanup = fn;
    });

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [appVersion, checkForUpdates]);

  useEffect(() => {
    if (hasUpdate && latestVersion) {
      toast.info(`Voyc v${latestVersion} is available`);
    }
  }, [hasUpdate, latestVersion]);

  const handleOnboardingComplete = () => {
    setAppState("main");
  };

  // Loading state
  if (appState === "loading") {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-logo-primary" />
      </div>
    );
  }

  // Onboarding state
  if (appState === "onboarding") {
    return (
      <>
        <Toaster
          theme="system"
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                "bg-background border border-mid-gray/20 rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 text-sm",
              title: "font-medium",
              description: "text-mid-gray",
            },
          }}
        />
        <OnboardingWizard onComplete={handleOnboardingComplete} />
      </>
    );
  }

  // Main app state
  return (
    <div className="h-screen flex flex-col select-none cursor-default">
      <Toaster
        theme="system"
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              "bg-background border border-mid-gray/20 rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 text-sm",
            title: "font-medium",
            description: "text-mid-gray",
          },
        }}
      />
      <div
        className="h-10 px-3 border-b border-mid-gray/20 flex items-center justify-between"
        data-tauri-drag-region
      >
        <div className="text-xs text-mid-gray" data-tauri-drag-region>
          Voyc
        </div>
        <WindowControls />
      </div>

      {/* Main settings content */}
      <div className="flex-1 overflow-hidden">
        <SettingsPage />
      </div>
      {/* Footer */}
      <div className="border-t border-mid-gray/20 px-4 py-2 text-xs text-mid-gray flex items-center justify-between">
        <span>Voyc v{appVersion} - Voice dictation for Linux</span>
        {hasUpdate && latestVersion && (
          <button
            onClick={() => installUpdate()}
            disabled={isInstalling}
            className="px-2 py-1 rounded bg-logo-primary/20 text-logo-primary hover:bg-logo-primary/30 disabled:opacity-50"
          >
            {isInstalling ? "Installing..." : `Update to v${latestVersion}`}
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
