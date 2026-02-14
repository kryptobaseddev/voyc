/**
 * In-App Dictation Component for Voyc
 *
 * This provides a fallback dictation interface that works entirely within the app,
 * bypassing system hotkey and text injection limitations on Linux/Fedora.
 *
 * Features:
 * - Large text area for transcribed text
 * - Record/Stop button
 * - Copy to clipboard button
 * - Status indicators
 * - Transcription history
 */

import React, { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { toast } from "sonner";
import { useTranscriptionHistoryStore } from "../../stores/transcriptionHistoryStore";

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

type DictationState = "idle" | "recording" | "transcribing";

export const InAppDictation: React.FC = () => {
  const [text, setText] = useState("");
  const [state, setState] = useState<DictationState>("idle");
  const [isCopied, setIsCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const history = useTranscriptionHistoryStore((store) => store.entries);
  const clearHistoryStore = useTranscriptionHistoryStore(
    (store) => store.clearHistory,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Set up event listeners for dictation completion
  useEffect(() => {
    const setupListeners = async () => {
      // Listen for dictation completion
      const unlisten = await listen<DictationCompleteEvent>(
        "dictation-complete",
        (event) => {
          const { text: transcribedText } = event.payload;
          if (transcribedText) {
            setText((prev) => {
              const newText = prev
                ? `${prev}\n\n${transcribedText}`
                : transcribedText;
              return newText;
            });
            toast.success("Dictation complete! Text added to editor.");

            // Focus the textarea and scroll to bottom
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.scrollTop =
                  textareaRef.current.scrollHeight;
              }
            }, 100);
          }
          setState("idle");
        },
      );
      unlistenRef.current = unlisten;

      // Listen for state changes
      await listen<DictationState>("dictation-state-changed", (event) => {
        setState(event.payload);
      });
    };

    setupListeners();

    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, []);

  const handleStartRecording = async () => {
    try {
      await invoke("start_in_app_dictation");
      setState("recording");
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast.error("Failed to start recording");
    }
  };

  const handleStopRecording = async () => {
    try {
      setState("transcribing");
      await invoke("stop_in_app_dictation");
      // State will be updated by the event listener
    } catch (error) {
      console.error("Failed to stop recording:", error);
      toast.error("Failed to stop recording");
      setState("idle");
    }
  };

  const handleCancel = async () => {
    try {
      await invoke("cancel_in_app_dictation");
      setState("idle");
      toast.info("Recording cancelled");
    } catch (error) {
      console.error("Failed to cancel recording:", error);
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
      toast.success("Text copied to clipboard!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy text:", error);
      toast.error("Failed to copy text");
    }
  };

  const handleClear = () => {
    if (text) {
      if (confirm("Are you sure you want to clear all text?")) {
        setText("");
        toast.info("Text cleared");
      }
    }
  };

  const loadHistoryItem = (item: { text: string; timestamp: string }) => {
    const timestamp = new Date(item.timestamp).toLocaleTimeString();
    setText((prev) =>
      prev ? `${prev}\n\n[${timestamp}] ${item.text}` : item.text,
    );
    toast.info("History item loaded into editor");
  };

  const isRecording = state === "recording";
  const isTranscribing = state === "transcribing";

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-mid-gray/10 rounded-lg border border-mid-gray/20">
        <div className="flex items-center gap-3">
          <div
            className={`w-4 h-4 rounded-full transition-colors ${
              isRecording
                ? "bg-red-500 animate-pulse"
                : isTranscribing
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-green-500"
            }`}
          />
          <span className="text-sm font-semibold">
            {isRecording
              ? "🔴 Recording..."
              : isTranscribing
                ? "⏳ Transcribing..."
                : "✅ Ready"}
          </span>
          {isRecording && (
            <span className="text-xs text-mid-gray ml-2">
              (Speak now - click Stop when done)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              showHistory
                ? "bg-logo-primary text-white"
                : "bg-mid-gray/20 hover:bg-mid-gray/30"
            }`}
          >
            📋 History ({history.length})
          </button>
          {text && (
            <span className="text-xs text-mid-gray">
              {text.length} chars |{" "}
              {text.split(/\s+/).filter((w) => w.length > 0).length} words
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Main Text Editor */}
        <div
          className={`flex-1 flex flex-col ${showHistory ? "w-2/3" : "w-full"}`}
        >
          <div className="flex-1 relative border border-mid-gray/20 rounded-lg overflow-hidden">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Click 'Record' and speak. Your transcribed text will appear here..."
              className="w-full h-full p-4 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-logo-primary/30 text-base leading-relaxed font-mono"
              style={{
                minHeight: "300px",
                fontSize: "14px",
                lineHeight: "1.6",
              }}
            />

            {/* Overlay during recording */}
            {isRecording && (
              <div className="absolute inset-0 bg-red-500/5 pointer-events-none flex items-center justify-center">
                <div className="bg-red-500 text-white px-4 py-2 rounded-full font-medium animate-pulse">
                  🔴 Recording... Click Stop when done
                </div>
              </div>
            )}

            {/* Overlay during transcribing */}
            {isTranscribing && (
              <div className="absolute inset-0 bg-yellow-500/5 pointer-events-none flex items-center justify-center">
                <div className="bg-yellow-500 text-white px-4 py-2 rounded-full font-medium flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
        </div>

        {/* History Sidebar */}
        {showHistory && (
          <div className="w-1/3 min-w-[250px] border-l border-mid-gray/20 pl-4 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Recent Transcriptions</h3>
              {history.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm("Clear all history?")) {
                      clearHistoryStore();
                    }
                  }}
                  className="text-xs text-red-500 hover:text-red-600"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {history.length === 0 ? (
                <div className="text-sm text-mid-gray text-center py-8">
                  No history yet.
                  <br />
                  Start dictating to see entries here.
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => loadHistoryItem(item)}
                    className="p-3 bg-mid-gray/5 rounded-lg cursor-pointer hover:bg-mid-gray/10 transition-colors border border-mid-gray/10"
                  >
                    <div className="text-xs text-mid-gray mb-1">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="text-sm line-clamp-3">{item.text}</div>
                    <div className="text-xs text-logo-primary mt-1">
                      Click to load
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-3 pt-2 border-t border-mid-gray/20">
        {/* Record/Stop Button */}
        {!isRecording ? (
          <button
            onClick={handleStartRecording}
            disabled={isTranscribing}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-mid-gray/30 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
            Record
          </button>
        ) : (
          <button
            onClick={handleStopRecording}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-logo-primary hover:bg-logo-primary/90 text-white rounded-lg font-medium transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z" />
            </svg>
            Stop & Transcribe
          </button>
        )}

        {/* Cancel Button (only during recording) */}
        {isRecording && (
          <button
            onClick={handleCancel}
            className="px-4 py-3 border border-mid-gray/30 hover:bg-mid-gray/10 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
        )}

        <div className="flex-1" />

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          disabled={!text}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-logo-primary/10 hover:bg-logo-primary/20 disabled:bg-mid-gray/10 disabled:text-mid-gray/50 disabled:cursor-not-allowed text-logo-primary rounded-lg font-medium transition-colors"
        >
          {isCopied ? (
            <>
              <svg
                className="w-5 h-5"
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
                className="w-5 h-5"
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
              Copy All
            </>
          )}
        </button>

        {/* Clear Button */}
        <button
          onClick={handleClear}
          disabled={!text}
          className="px-4 py-3 border border-mid-gray/30 hover:bg-mid-gray/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Instructions */}
      <div className="text-sm text-mid-gray bg-mid-gray/5 p-4 rounded-lg border border-mid-gray/10">
        <p className="font-medium mb-2 text-text">
          How to use In-App Dictation:
        </p>
        <ol className="list-decimal list-inside space-y-1.5">
          <li>
            Click <strong className="text-text">Record</strong> to start
            dictating
          </li>
          <li>Speak clearly into your microphone</li>
          <li>
            Click <strong className="text-text">Stop & Transcribe</strong> when
            finished
          </li>
          <li>Your text appears in the editor above (you can edit it!)</li>
          <li>
            Click <strong className="text-text">Copy All</strong> to copy the
            text to your clipboard
          </li>
          <li>Paste the text wherever you need it (Ctrl+V)</li>
        </ol>
        <p className="mt-2 text-xs">
          💡 <strong>Tip:</strong> Click "History" to see previous
          transcriptions and load them back into the editor.
        </p>
      </div>
    </div>
  );
};
