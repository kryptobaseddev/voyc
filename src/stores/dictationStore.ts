/**
 * Dictation Store for Voyc
 * Zustand state management for dictation workflow
 * Tracks recording/transcribing state and handles backend events
 */

import { create } from "zustand";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useTranscriptionHistoryStore } from "./transcriptionHistoryStore";

// Matches Rust DictationState enum (serde rename_all = "snake_case")
type DictationStateValue = "idle" | "recording" | "transcribing";

// Matches Rust LatencyMetrics struct
interface LatencyMetrics {
  capture_ms: number;
  transcription_ms: number;
  injection_ms: number;
  total_ms: number;
}

// Matches Rust DictationCompleteEvent struct
interface DictationCompleteEvent {
  text: string;
  used_fallback: boolean;
  provider: string | null;
  duration_ms: number;
  latency: LatencyMetrics;
}

// Matches Rust TextClipboardOnlyEvent struct
interface TextClipboardOnlyEvent {
  text: string;
  reason: string;
}

interface DictationState {
  isRecording: boolean;
  isTranscribing: boolean;
  lastText: string;
  lastLatency: LatencyMetrics | null;
  clipboardOnlyReason: string | null;
  error: string | null;
}

interface DictationStore extends DictationState {
  setRecording: (recording: boolean) => void;
  setTranscribing: (transcribing: boolean) => void;
  setLastText: (text: string) => void;
  setLastLatency: (latency: LatencyMetrics | null) => void;
  setClipboardOnlyReason: (reason: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  initialize: () => Promise<void>;
  cleanup: () => void;
}

// Store unlisten functions for cleanup
let unlistenFns: UnlistenFn[] = [];

export const useDictationStore = create<DictationStore>((set) => ({
  isRecording: false,
  isTranscribing: false,
  lastText: "",
  lastLatency: null,
  clipboardOnlyReason: null,
  error: null,

  setRecording: (recording) => set({ isRecording: recording, error: null }),
  setTranscribing: (transcribing) => set({ isTranscribing: transcribing }),
  setLastText: (text) => set({ lastText: text }),
  setLastLatency: (latency) => set({ lastLatency: latency }),
  setClipboardOnlyReason: (reason) => set({ clipboardOnlyReason: reason }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      isRecording: false,
      isTranscribing: false,
      error: null,
      clipboardOnlyReason: null,
    }),

  initialize: async () => {
    // Clean up any existing listeners
    useDictationStore.getState().cleanup();

    // Listen for dictation state changes
    // Backend emits DictationState enum directly (not wrapped in object)
    const unlistenState = await listen<DictationStateValue>(
      "dictation-state-changed",
      (event) => {
        const state = event.payload;
        if (state === "recording") {
          set({
            isRecording: true,
            isTranscribing: false,
            error: null,
            clipboardOnlyReason: null,
          });
        } else if (state === "transcribing") {
          set({ isRecording: false, isTranscribing: true });
        } else if (state === "idle") {
          set({ isRecording: false, isTranscribing: false });
        }
      },
    );

    // Listen for dictation completion
    const unlistenComplete = await listen<DictationCompleteEvent>(
      "dictation-complete",
      (event) => {
        const { text, latency, duration_ms, provider } = event.payload;
        set({
          lastText: text,
          lastLatency: latency,
          isRecording: false,
          isTranscribing: false,
        });

        useTranscriptionHistoryStore.getState().addEntry({
          text,
          durationMs: duration_ms,
          provider: provider || "local",
        });
      },
    );

    // Listen for clipboard-only events (no paste tool available)
    const unlistenClipboard = await listen<TextClipboardOnlyEvent>(
      "text-clipboard-only",
      (event) => {
        const { text, reason } = event.payload;
        set({
          lastText: text,
          clipboardOnlyReason: reason,
        });

        useTranscriptionHistoryStore.getState().addEntry({
          text,
          durationMs: 0,
          provider: "clipboard-only",
        });
      },
    );

    // Listen for dictation cancellation
    const unlistenCancelled = await listen<void>("dictation-cancelled", () => {
      set({
        isRecording: false,
        isTranscribing: false,
        error: null,
      });
    });

    unlistenFns = [
      unlistenState,
      unlistenComplete,
      unlistenClipboard,
      unlistenCancelled,
    ];
  },

  cleanup: () => {
    unlistenFns.forEach((unlisten) => unlisten());
    unlistenFns = [];
  },
}));
