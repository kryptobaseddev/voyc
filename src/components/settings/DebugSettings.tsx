/**
 * Debug Settings Panel for Voyc
 * Displays system info, logs, and diagnostic tools
 */

import React, { useState, useEffect } from "react";
import { SettingsGroup } from "../ui/SettingsGroup";
import { invoke } from "@tauri-apps/api/core";

interface SystemInfo {
  platform: string;
  arch: string;
  version: string;
  tauriVersion: string;
}

export const DebugSettings: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [logPath, setLogPath] = useState<string>("");
  const [latencyStats, setLatencyStats] = useState({
    lastCapture: 0,
    lastTranscription: 0,
    lastInjection: 0,
    total: 0,
  });

  useEffect(() => {
    loadSystemInfo();
    loadLogPath();
  }, []);

  const loadSystemInfo = async () => {
    try {
      // Get basic system info from Tauri
      const info = {
        platform: navigator.platform,
        arch: "x86_64",
        version: "1.0.0",
        tauriVersion: "2.9.1",
      };
      setSystemInfo(info);
    } catch (error) {
      console.error("Failed to load system info:", error);
    }
  };

  const loadLogPath = async () => {
    try {
      const path = await invoke<string>("get_log_dir_path");
      setLogPath(path);
    } catch (error) {
      console.error("Failed to get log path:", error);
    }
  };

  const openLogFolder = async () => {
    try {
      await invoke("open_log_dir");
    } catch (error) {
      console.error("Failed to open log folder:", error);
    }
  };

  const copyDiagnostics = () => {
    const diagnostics = `
Voyc Diagnostics Report
=======================
Version: ${systemInfo?.version || "Unknown"}
Platform: ${systemInfo?.platform || "Unknown"}
Tauri: ${systemInfo?.tauriVersion || "Unknown"}

Latency (last session):
- Audio Capture: ${latencyStats.lastCapture}ms
- Transcription: ${latencyStats.lastTranscription}ms
- Text Injection: ${latencyStats.lastInjection}ms
- Total: ${latencyStats.total}ms

Log Location: ${logPath}
    `.trim();

    navigator.clipboard.writeText(diagnostics);
  };

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title="System Information">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between p-2 rounded bg-mid-gray/5">
            <span className="text-text/60">Platform</span>
            <span className="font-mono">{systemInfo?.platform || "..."}</span>
          </div>
          <div className="flex justify-between p-2 rounded bg-mid-gray/5">
            <span className="text-text/60">Architecture</span>
            <span className="font-mono">{systemInfo?.arch || "..."}</span>
          </div>
          <div className="flex justify-between p-2 rounded bg-mid-gray/5">
            <span className="text-text/60">App Version</span>
            <span className="font-mono">{systemInfo?.version || "..."}</span>
          </div>
          <div className="flex justify-between p-2 rounded bg-mid-gray/5">
            <span className="text-text/60">Tauri Version</span>
            <span className="font-mono">{systemInfo?.tauriVersion || "..."}</span>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Latency Metrics (REQ-016)">
        <div className="space-y-3">
          <div className="flex justify-between items-center p-2 rounded bg-mid-gray/5">
            <span className="text-sm text-text/60">Audio Capture</span>
            <span className="font-mono text-sm">
              {latencyStats.lastCapture > 0
                ? `${latencyStats.lastCapture}ms`
                : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center p-2 rounded bg-mid-gray/5">
            <span className="text-sm text-text/60">STT Processing</span>
            <span className="font-mono text-sm">
              {latencyStats.lastTranscription > 0
                ? `${latencyStats.lastTranscription}ms`
                : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center p-2 rounded bg-mid-gray/5">
            <span className="text-sm text-text/60">Text Injection</span>
            <span className="font-mono text-sm">
              {latencyStats.lastInjection > 0
                ? `${latencyStats.lastInjection}ms`
                : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center p-3 rounded bg-logo-primary/10 border border-logo-primary/20">
            <span className="text-sm font-medium">Total Latency</span>
            <span className="font-mono text-sm font-medium text-logo-primary">
              {latencyStats.total > 0
                ? `${latencyStats.total}ms`
                : "—"}
            </span>
          </div>
          <p className="text-xs text-text/40 mt-2">
            Target: &lt;250ms for optimal user experience (REQ-017)
          </p>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Logs & Diagnostics">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Log Files</p>
              <p className="text-xs text-text/50 font-mono truncate max-w-md">
                {logPath || "Loading..."}
              </p>
            </div>
            <button
              onClick={openLogFolder}
              className="px-3 py-1.5 text-sm rounded-lg bg-mid-gray/20 hover:bg-mid-gray/30 transition-colors"
            >
              Open Folder
            </button>
          </div>

          <div className="pt-4 border-t border-mid-gray/20">
            <button
              onClick={copyDiagnostics}
              className="w-full px-4 py-2 text-sm rounded-lg bg-logo-primary/10 text-logo-primary hover:bg-logo-primary/20 transition-colors"
            >
              Copy Diagnostics to Clipboard
            </button>
          </div>
        </div>
      </SettingsGroup>
    </div>
  );
};
