/**
 * Dictation Settings for Voyc
 * Control panel for manual dictation triggering and status display
 * Useful on Wayland where global shortcuts require manual configuration
 */

import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useDictationStore } from "../../stores/dictationStore";

// Platform detection
const isWayland =
  typeof window !== "undefined" &&
  (navigator.userAgent.includes("Wayland") ||
    window.location.search.includes("wayland"));

export const DictationSettings: React.FC = () => {
  const { isRecording, isTranscribing, lastText, lastLatency, error } =
    useDictationStore();

  const [shortcutsConfigured, setShortcutsConfigured] = useState<boolean | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Listen for shortcut configuration events
  useEffect(() => {
    const setupListeners = async () => {
      const unlistenConfigured = await listen<number>(
        "shortcuts-configured",
        (event) => {
          setShortcutsConfigured(event.payload > 0);
        }
      );

      const unlistenNeedConfig = await listen(
        "shortcuts-need-configuration",
        () => {
          setShortcutsConfigured(false);
        }
      );

      return () => {
        unlistenConfigured();
        unlistenNeedConfig();
      };
    };

    setupListeners();
  }, []);

  const handleStartDictation = async () => {
    if (isRecording || isTranscribing) return;

    setIsStarting(true);
    try {
      await invoke("start_dictation", { bindingId: "transcribe" });
    } catch (err) {
      console.error("Failed to start dictation:", err);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopDictation = async () => {
    try {
      await invoke("stop_dictation", { bindingId: "transcribe" });
    } catch (err) {
      console.error("Failed to stop dictation:", err);
    }
  };

  const handleCancelDictation = async () => {
    try {
      await invoke("cancel_dictation", {});
    } catch (err) {
      console.error("Failed to cancel dictation:", err);
    }
  };

  const handleOpenShortcutSettings = async () => {
    try {
      await invoke("open_shortcut_settings", {});
    } catch (err) {
      console.error("Failed to open shortcut settings:", err);
    }
  };

  // Determine status
  const getStatus = () => {
    if (isRecording) return { text: "Recording...", color: "text-green-500", bg: "bg-green-500/20" };
    if (isTranscribing) return { text: "Transcribing...", color: "text-blue-500", bg: "bg-blue-500/20" };
    return { text: "Idle", color: "text-mid-gray", bg: "bg-mid-gray/20" };
  };

  const status = getStatus();

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="bg-background-secondary rounded-lg p-4 border border-mid-gray/20">
        <h3 className="text-sm font-medium mb-3">Dictation Status</h3>

        <div className="flex items-center gap-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${isRecording ? "bg-green-500 animate-pulse" : isTranscribing ? "bg-blue-500 animate-pulse" : "bg-mid-gray"}`} />
          <span className={`font-medium ${status.color}`}>{status.text}</span>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-2">
          {!isRecording && !isTranscribing ? (
            <button
              onClick={handleStartDictation}
              disabled={isStarting}
              className="px-4 py-2 bg-logo-primary text-white rounded-lg hover:bg-logo-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
            >
              {isStarting ? "Starting..." : "Start Dictation"}
            </button>
          ) : (
            <>
              <button
                onClick={handleStopDictation}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm transition-colors"
              >
                Stop & Transcribe
              </button>
              <button
                onClick={handleCancelDictation}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-500 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Last Transcription */}
      {lastText && (
        <div className="bg-background-secondary rounded-lg p-4 border border-mid-gray/20">
          <h3 className="text-sm font-medium mb-2">Last Transcription</h3>
          <div className="p-3 bg-background rounded border border-mid-gray/10 text-sm">
            {lastText}
          </div>
          {lastLatency && (
            <div className="mt-2 text-xs text-mid-gray">
              Total: {lastLatency.total_ms}ms | Capture: {lastLatency.capture_ms}ms |
              Transcription: {lastLatency.transcription_ms}ms | Injection: {lastLatency.injection_ms}ms
            </div>
          )}
        </div>
      )}

      {/* Shortcut Configuration Help */}
      {shortcutsConfigured === false && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <h3 className="text-sm font-medium text-amber-600 mb-2">
            Keyboard Shortcuts Not Configured
          </h3>
          <p className="text-sm text-amber-600/80 mb-3">
            On Wayland/GNOME, you need to manually configure keyboard shortcuts in System Settings.
            Click below to open the settings.
          </p>
          <button
            onClick={handleOpenShortcutSettings}
            className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 transition-colors"
          >
            Open Keyboard Settings
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-background-secondary rounded-lg p-4 border border-mid-gray/20">
        <h3 className="text-sm font-medium mb-2">How to Use</h3>
        <ul className="text-sm text-mid-gray space-y-1 list-disc list-inside">
          <li>Click "Start Dictation" or use your configured hotkey</li>
          <li>Speak clearly into your microphone</li>
          <li>Click "Stop & Transcribe" or release the hotkey</li>
          <li>Your speech will be transcribed and typed at the cursor</li>
        </ul>
      </div>

      {/* Tray Menu Tip */}
      <div className="text-xs text-mid-gray">
        <strong>Tip:</strong> You can also start dictation from the system tray icon menu.
      </div>
    </div>
  );
};
