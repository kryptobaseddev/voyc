import { create } from "zustand";

const STORAGE_KEY = "voyc.transcriptionHistory.v1";
const MAX_ENTRIES = 200;

export interface TranscriptionHistoryEntry {
  id: string;
  text: string;
  timestamp: string;
  durationMs: number;
  provider: string;
}

interface TranscriptionHistoryStore {
  entries: TranscriptionHistoryEntry[];
  addEntry: (
    entry: Omit<TranscriptionHistoryEntry, "id" | "timestamp">,
  ) => void;
  clearHistory: () => void;
}

function loadInitialEntries(): TranscriptionHistoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as TranscriptionHistoryEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry) => typeof entry.text === "string");
  } catch {
    return [];
  }
}

function persistEntries(entries: TranscriptionHistoryEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export const useTranscriptionHistoryStore = create<TranscriptionHistoryStore>(
  (set) => ({
    entries: loadInitialEntries(),

    addEntry: ({ text, durationMs, provider }) => {
      if (!text.trim()) {
        return;
      }

      set((state) => {
        const next = [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text,
            timestamp: new Date().toISOString(),
            durationMs,
            provider,
          },
          ...state.entries,
        ].slice(0, MAX_ENTRIES);

        persistEntries(next);
        return { entries: next };
      });
    },

    clearHistory: () => {
      persistEntries([]);
      set({ entries: [] });
    },
  }),
);
