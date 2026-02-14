/**
 * About Settings Panel for Voyc
 * Version info, update checks, and credits
 */

import React, { useState, useEffect } from "react";
import { SettingsGroup } from "../ui/SettingsGroup";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";

const BUILD_DATE = "2026-01-28";

export const AboutSettings: React.FC = () => {
  const [appVersion, setAppVersion] = useState<string>("...");
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<Awaited<
    ReturnType<typeof check>
  > | null>(null);
  const [fallbackVersion, setFallbackVersion] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  useEffect(() => {
    // Get actual version from backend
    invoke<string>("get_app_version").then(setAppVersion).catch(console.error);
  }, []);

  const checkForUpdates = async () => {
    setIsCheckingUpdate(true);
    setPendingUpdate(null);
    setFallbackVersion(null);
    setUpdateStatus(null);

    try {
      const update = await check();
      if (update) {
        setPendingUpdate(update);
        setUpdateStatus(`Update available: v${update.version}`);
      } else {
        setUpdateStatus("You're running the latest version!");
      }
    } catch (error) {
      console.error(
        "Tauri updater check failed, using GitHub fallback:",
        error,
      );
      try {
        const response = await fetch(
          "https://api.github.com/repos/kryptobaseddev/voyc/releases/latest",
        );
        if (!response.ok) {
          throw new Error(`GitHub API returned ${response.status}`);
        }
        const data = (await response.json()) as { tag_name?: string };
        const latest = (data.tag_name || "").replace(/^v/, "");

        if (!latest) {
          throw new Error("Missing tag_name in GitHub response");
        }

        if (latest === appVersion) {
          setUpdateStatus("You're running the latest version!");
        } else {
          setFallbackVersion(latest);
          setUpdateStatus(`Update available: v${latest}`);
        }
      } catch (fallbackError) {
        console.error("Fallback update check failed:", fallbackError);
        setUpdateStatus(
          "Unable to check for updates. Verify internet and release availability.",
        );
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const installUpdate = async () => {
    if (!pendingUpdate && !fallbackVersion) return;
    setIsInstallingUpdate(true);
    setUpdateStatus("Downloading and installing update...");

    try {
      if (pendingUpdate) {
        await pendingUpdate.downloadAndInstall();
        setUpdateStatus("Update installed. Restarting app...");
        await relaunch();
      } else {
        await invoke("run_user_update");
        setUpdateStatus("Update installed. Please restart Voyc.");
      }
    } catch (error) {
      console.error("Update install failed:", error);
      setUpdateStatus(
        "Update install failed. Check that release signatures and updater endpoint are configured correctly.",
      );
    } finally {
      setIsInstallingUpdate(false);
    }
  };

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      {/* Logo and Version */}
      <div className="flex flex-col items-center py-8">
        <img
          src="/voyc-icon.png"
          alt="Voyc"
          className="w-20 h-20 rounded-2xl mb-4"
        />
        <h1 className="text-2xl font-bold">Voyc</h1>
        <p className="text-text/60 text-sm">Voice Dictation for Linux</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-logo-primary/20 text-logo-primary text-xs font-mono">
            v{appVersion}
          </span>
        </div>
      </div>

      <SettingsGroup title="Updates">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Current Version</p>
              <p className="text-xs text-text/50">
                v{appVersion} ({BUILD_DATE})
              </p>
            </div>
            <button
              onClick={checkForUpdates}
              disabled={isCheckingUpdate}
              className="px-4 py-2 text-sm rounded-lg bg-logo-primary/10 text-logo-primary hover:bg-logo-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isCheckingUpdate ? (
                <>
                  <div className="w-4 h-4 border-2 border-logo-primary border-t-transparent rounded-full animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Check for Updates
                </>
              )}
            </button>
          </div>

          {(pendingUpdate || fallbackVersion) && (
            <div className="flex justify-end">
              <button
                onClick={installUpdate}
                disabled={isInstallingUpdate}
                className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isInstallingUpdate
                  ? "Installing..."
                  : `Install v${pendingUpdate?.version || fallbackVersion}`}
              </button>
            </div>
          )}

          {updateStatus && (
            <div
              className={`p-3 rounded-lg text-sm ${
                updateStatus.includes("available")
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : updateStatus.includes("latest")
                    ? "bg-logo-primary/10 text-logo-primary border border-logo-primary/20"
                    : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
              }`}
            >
              {updateStatus}
            </div>
          )}
        </div>
      </SettingsGroup>

      <SettingsGroup title="Credits">
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-2 rounded bg-mid-gray/5">
            <span className="text-text/60">Built with</span>
            <span>Tauri + React + Rust</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-mid-gray/5">
            <span className="text-text/60">Speech Recognition</span>
            <span>Whisper / ElevenLabs</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-mid-gray/5">
            <span className="text-text/60">Audio Processing</span>
            <span>cpal + Silero VAD</span>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Links">
        <div className="flex flex-wrap gap-3">
          <a
            href="https://github.com/voyc-app/voyc"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm rounded-lg bg-mid-gray/10 hover:bg-mid-gray/20 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            GitHub
          </a>
          <a
            href="https://voyc.app/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm rounded-lg bg-mid-gray/10 hover:bg-mid-gray/20 transition-colors flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            Documentation
          </a>
          <a
            href="https://voyc.app/support"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm rounded-lg bg-mid-gray/10 hover:bg-mid-gray/20 transition-colors flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            Support
          </a>
        </div>
      </SettingsGroup>

      {/* Footer */}
      <div className="text-center py-4 text-xs text-text/40">
        <p>Made with care for the Linux community</p>
        <p className="mt-1">MIT License</p>
      </div>
    </div>
  );
};
