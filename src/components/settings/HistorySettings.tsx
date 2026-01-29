/**
 * History Settings Panel for Voyc
 * Displays transcription history with timestamps and actions
 */

import React, { useState, useEffect } from "react";
import { SettingsGroup } from "../ui/SettingsGroup";

interface HistoryEntry {
  id: string;
  timestamp: Date;
  text: string;
  duration: number;
  provider: string;
}

export const HistorySettings: React.FC = () => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: Load history from backend
    setIsLoading(false);
    // Placeholder data for UI development
    setHistory([]);
  }, []);

  const clearHistory = () => {
    if (confirm("Clear all transcription history?")) {
      setHistory([]);
      // TODO: Call backend to clear history
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleString();
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  };

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup
        title="Transcription History"
        description="Recent voice-to-text transcriptions"
      >
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-text/60">
            {history.length} transcription{history.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={clearHistory}
            className="px-3 py-1.5 text-sm rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            disabled={history.length === 0}
          >
            Clear History
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-logo-primary border-t-transparent rounded-full" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 text-text/50">
            <svg
              className="w-12 h-12 mx-auto mb-4 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm">No transcriptions yet</p>
            <p className="text-xs mt-1">Press Ctrl+Space to start recording</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="p-3 rounded-lg bg-mid-gray/10 hover:bg-mid-gray/20 transition-colors"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs text-text/50">
                    {formatTime(entry.timestamp)}
                  </span>
                  <span className="text-xs text-text/40">
                    {formatDuration(entry.duration)} via {entry.provider}
                  </span>
                </div>
                <p className="text-sm">{entry.text}</p>
              </div>
            ))}
          </div>
        )}
      </SettingsGroup>
    </div>
  );
};
