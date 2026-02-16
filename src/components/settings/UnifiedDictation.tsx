/**
 * Unified Dictation Component for Voyc
 *
 * Single dictation interface combining the best of both worlds:
 * - Clean status display with theme-matched buttons
 * - Text editor workspace with history sidebar
 * - ONE dictation system (no conflicts)
 * - No duplicate history entries
 */

import React, { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { toast } from "sonner";
import { useTranscriptionHistoryStore } from "../../stores/transcriptionHistoryStore";
import { useDictationStore } from "../../stores/dictationStore";
import { useSettingsStore } from "../../stores/settingsStore";

interface DictationCompleteEvent {
  text: string;
  used_fallback: boolean;
  provider: string | null;
  duration_ms: number;
  latency: {
    capture_ms: number;
    transcription_ms: number;
    injection_ms: number;
    total_ms: number;
  };
}

export const UnifiedDictation: React.FC = () => {
  // Use global dictation store for state (single source of truth)
  const { isRecording, isTranscribing, error } = useDictationStore();

  // Settings store for dictation text mode
  const dictationTextMode = useSettingsStore(
    (state) => state.settings?.dictation_text_mode ?? "append",
  );
  const updateSetting = useSettingsStore((state) => state.updateSetting);

  // Local state for text editing
  const [text, setText] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(
    new Set(),
  );

  // History from store
  const history = useTranscriptionHistoryStore((store) => store.entries);
  const clearHistoryStore = useTranscriptionHistoryStore(
    (store) => store.clearHistory,
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Use a ref to track the current text mode so the listener closure
  // always has the latest value without re-subscribing
  const textModeRef = useRef(dictationTextMode);
  useEffect(() => {
    textModeRef.current = dictationTextMode;
  }, [dictationTextMode]);

  // Listen for dictation completion to add to editor
  useEffect(() => {
    const setupListeners = async () => {
      const unlisten = await listen<DictationCompleteEvent>(
        "dictation-complete",
        (event) => {
          const { text: transcribedText, provider } = event.payload;
          if (transcribedText && provider !== "clipboard-only") {
            const mode = textModeRef.current;
            if (mode === "replace") {
              // Replace mode: clear previous text
              setText(transcribedText);
            } else {
              // Append mode (default): add to existing text
              setText((prev) => {
                if (prev) {
                  return `${prev}\n\n${transcribedText}`;
                }
                return transcribedText;
              });
            }
            toast.success("Dictation complete!");

            // Scroll to bottom
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.scrollTop =
                  textareaRef.current.scrollHeight;
              }
            }, 100);
          }
        },
      );
      unlistenRef.current = unlisten;
    };

    setupListeners();

    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, []);

  const handleStartRecording = async () => {
    if (isRecording || isTranscribing) return;

    try {
      await invoke("start_dictation", { bindingId: "transcribe" });
    } catch (err: any) {
      console.error("Failed to start dictation:", err);
      toast.error(err?.toString?.() || "Failed to start recording");
    }
  };

  const handleStopRecording = async () => {
    try {
      await invoke("stop_dictation", { bindingId: "transcribe" });
    } catch (err: any) {
      console.error("Failed to stop dictation:", err);
      toast.error("Failed to stop recording");
    }
  };

  const handleCancelRecording = async () => {
    try {
      await invoke("cancel_dictation");
      toast.info("Recording cancelled");
    } catch (err) {
      console.error("Failed to cancel dictation:", err);
    }
  };

  const handleCopy = async () => {
    if (!text) {
      toast.info("No text to copy");
      return;
    }

    try {
      await writeText(text);
      setIsCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy text:", error);
      toast.error("Failed to copy text");
    }
  };

  const handleClear = () => {
    if (text && confirm("Are you sure you want to clear all text?")) {
      setText("");
      toast.info("Text cleared");
    }
  };

  const loadHistoryItem = (item: { text: string; timestamp: string }) => {
    const timestamp = new Date(item.timestamp).toLocaleTimeString();
    setText((prev) => {
      if (prev) {
        return `${prev}\n\n[${timestamp}] ${item.text}`;
      }
      return `[${timestamp}] ${item.text}`;
    });
    toast.info("History item loaded");
  };

  const toggleHistorySelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCopySelected = async () => {
    if (selectedHistoryIds.size === 0) return;
    const selectedItems = history
      .filter((item) => selectedHistoryIds.has(item.id))
      .map((item) => item.text);
    try {
      await writeText(selectedItems.join("\n\n"));
      toast.success(`Copied ${selectedItems.length} item(s) to clipboard!`);
      setSelectedHistoryIds(new Set());
    } catch (err) {
      console.error("Failed to copy selected:", err);
      toast.error("Failed to copy selected items");
    }
  };

  const handleSelectAllHistory = () => {
    if (selectedHistoryIds.size === history.length) {
      setSelectedHistoryIds(new Set());
    } else {
      setSelectedHistoryIds(new Set(history.map((item) => item.id)));
    }
  };

  const handleToggleTextMode = () => {
    const newMode = dictationTextMode === "append" ? "replace" : "append";
    updateSetting("dictation_text_mode", newMode);
  };

  // Get status display
  const getStatusDisplay = () => {
    if (isRecording) {
      return {
        text: "Recording...",
        color: "text-green-500",
        bg: "bg-green-500",
        icon: "●",
        pulse: true,
      };
    }
    if (isTranscribing) {
      return {
        text: "Transcribing...",
        color: "text-blue-500",
        bg: "bg-blue-500",
        icon: "⟳",
        pulse: true,
      };
    }
    return {
      text: "Ready",
      color: "text-mid-gray",
      bg: "bg-mid-gray",
      icon: "○",
      pulse: false,
    };
  };

  const status = getStatusDisplay();
  const hasText = text.length > 0;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Status & Controls Bar */}
      <div className="flex items-center gap-4 p-3 bg-background-secondary rounded-lg border border-mid-gray/20">
        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${status.bg} ${
              status.pulse ? "animate-pulse" : ""
            }`}
          />
          <span className={`font-medium ${status.color}`}>{status.text}</span>
        </div>

        {/* Control Buttons */}
        <div className="flex-1 flex items-center justify-center gap-2">
          {!isRecording && !isTranscribing ? (
            <button
              onClick={handleStartRecording}
              className="flex items-center gap-2 px-4 py-2 bg-logo-primary text-white rounded-lg hover:bg-logo-primary/90 font-medium text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
              Start Recording
            </button>
          ) : (
            <>
              <button
                onClick={handleStopRecording}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 6h12v12H6z" />
                </svg>
                Stop & Transcribe
              </button>
              {isRecording && (
                <button
                  onClick={handleCancelRecording}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
              )}
            </>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded text-red-500 text-xs max-w-xs">
            {error}
          </div>
        )}
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Text Editor */}
        <div
          className={`flex-1 flex flex-col ${showHistory ? "w-2/3" : "w-full"}`}
        >
          <div className="flex-1 relative border border-mid-gray/20 rounded-lg overflow-hidden bg-background">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Click 'Start Recording' and speak. Your transcribed text will appear here..."
              className="w-full h-full p-4 bg-transparent resize-none focus:outline-none focus:ring-2 focus:ring-logo-primary/30 text-base leading-relaxed"
              spellCheck={false}
            />

            {/* Recording Overlay */}
            {isRecording && (
              <div className="absolute inset-0 bg-red-500/5 pointer-events-none flex items-center justify-center">
                <div className="bg-red-500 text-white px-4 py-2 rounded-full font-medium animate-pulse">
                  🔴 Recording... Click Stop when done
                </div>
              </div>
            )}

            {/* Transcribing Overlay */}
            {isTranscribing && (
              <div className="absolute inset-0 bg-blue-500/5 pointer-events-none flex items-center justify-center">
                <div className="bg-blue-500 text-white px-4 py-2 rounded-full font-medium flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Transcribing...
                </div>
              </div>
            )}
          </div>

          {/* Editor Toolbar */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3">
              <div className="text-xs text-mid-gray">
                {hasText && (
                  <>
                    {text.length} chars |{" "}
                    {text.split(/\s+/).filter((w) => w.length > 0).length} words
                  </>
                )}
              </div>
              {/* Text Mode Toggle */}
              <button
                onClick={handleToggleTextMode}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border border-mid-gray/20 hover:bg-mid-gray/10 transition-colors"
                title={
                  dictationTextMode === "append"
                    ? "Append mode: new text is added to existing text"
                    : "Replace mode: new text replaces existing text"
                }
              >
                {dictationTextMode === "append" ? (
                  <>
                    <svg
                      className="w-3 h-3 text-logo-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v12m6-6H6"
                      />
                    </svg>
                    <span className="text-logo-primary">Append</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3 h-3 text-amber-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4h16M4 12h16M4 20h16"
                      />
                    </svg>
                    <span className="text-amber-500">Replace</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                disabled={!hasText}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-logo-primary/10 hover:bg-logo-primary/20 disabled:bg-mid-gray/10 disabled:text-mid-gray/50 text-logo-primary rounded text-sm font-medium transition-colors"
              >
                {isCopied ? (
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Copied!
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
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={handleClear}
                disabled={!hasText}
                className="px-3 py-1.5 border border-mid-gray/30 hover:bg-mid-gray/10 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* History Sidebar */}
        {showHistory && (
          <div className="w-1/3 min-w-[220px] max-w-[280px] flex flex-col border-l border-mid-gray/20 pl-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">History</h3>
              <div className="flex items-center gap-2">
                {history.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm("Clear all history?")) {
                        clearHistoryStore();
                        setSelectedHistoryIds(new Set());
                      }
                    }}
                    className="text-xs text-red-500 hover:text-red-600"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-mid-gray hover:text-text"
                  title="Hide history"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Multi-select controls */}
            {history.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={handleSelectAllHistory}
                  className="text-xs text-mid-gray hover:text-text transition-colors"
                >
                  {selectedHistoryIds.size === history.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
                {selectedHistoryIds.size > 0 && (
                  <button
                    onClick={handleCopySelected}
                    className="flex items-center gap-1 text-xs px-2 py-0.5 bg-logo-primary/10 text-logo-primary rounded hover:bg-logo-primary/20 transition-colors"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Copy {selectedHistoryIds.size}
                  </button>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2">
              {history.length === 0 ? (
                <div className="text-sm text-mid-gray text-center py-8">
                  No history yet
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-lg cursor-pointer hover:bg-mid-gray/10 transition-colors border ${
                      selectedHistoryIds.has(item.id)
                        ? "border-logo-primary/40 bg-logo-primary/5"
                        : "border-mid-gray/10 bg-mid-gray/5"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedHistoryIds.has(item.id)}
                        onChange={(e) =>
                          toggleHistorySelection(
                            item.id,
                            e as unknown as React.MouseEvent,
                          )
                        }
                        className="mt-0.5 accent-logo-primary cursor-pointer flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div
                        className="flex-1 min-w-0"
                        onClick={() => loadHistoryItem(item)}
                      >
                        <div className="text-xs text-mid-gray mb-1">
                          {new Date(item.timestamp).toLocaleTimeString()} •{" "}
                          {item.provider}
                        </div>
                        <div className="text-sm line-clamp-3">{item.text}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Show History Button (when hidden) */}
      {!showHistory && (
        <button
          onClick={() => setShowHistory(true)}
          className="self-start flex items-center gap-1.5 px-3 py-1.5 text-sm text-mid-gray hover:text-text transition-colors"
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Show History ({history.length})
        </button>
      )}

      {/* Instructions */}
      <div className="text-sm text-mid-gray bg-mid-gray/5 p-3 rounded-lg">
        <p className="font-medium mb-1 text-text">How to use:</p>
        <ol className="list-decimal list-inside space-y-0.5 text-xs">
          <li>
            Click <strong className="text-text">Start Recording</strong> and
            speak
          </li>
          <li>
            Click <strong className="text-text">Stop & Transcribe</strong> when
            done
          </li>
          <li>Edit your text in the editor above</li>
          <li>
            Click <strong className="text-text">Copy</strong> to copy to
            clipboard
          </li>
        </ol>
      </div>
    </div>
  );
};
