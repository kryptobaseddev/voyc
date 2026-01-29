/**
 * Model Store for Voyc
 * Zustand state management for model download and selection
 * Adapted from Handy's modelStore
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

// Type definitions matching Rust backend (src-tauri/src/managers/model.rs)
export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  size_bytes: number;
  is_downloaded: boolean;
  is_default: boolean;
}

interface DownloadProgress {
  model_id: string;
  downloaded: number;
  total: number;
  percentage: number;
}

interface ModelStore {
  models: ModelInfo[];
  currentModel: string;
  downloadingModels: Set<string>;
  extractingModels: Set<string>;
  downloadProgress: Map<string, DownloadProgress>;
  loading: boolean;
  error: string | null;
  hasAnyModels: boolean;
  isFirstRun: boolean;

  // Actions
  initialize: () => Promise<void>;
  loadModels: () => Promise<void>;
  loadCurrentModel: () => Promise<void>;
  checkFirstRun: () => Promise<boolean>;
  selectModel: (modelId: string) => Promise<boolean>;
  downloadModel: (modelId: string) => Promise<boolean>;
  deleteModel: (modelId: string) => Promise<boolean>;
  cancelDownload: (modelId: string) => Promise<boolean>;
  getRecommendedFirstModel: () => Promise<string>;

  // Getters
  getModelInfo: (modelId: string) => ModelInfo | undefined;
  isModelDownloading: (modelId: string) => boolean;
  isModelExtracting: (modelId: string) => boolean;
  getDownloadProgress: (modelId: string) => DownloadProgress | undefined;

  // Internal setters
  setModels: (models: ModelInfo[]) => void;
  setCurrentModel: (model: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHasAnyModels: (hasAny: boolean) => void;
  setIsFirstRun: (isFirst: boolean) => void;
  addDownloadingModel: (modelId: string) => void;
  removeDownloadingModel: (modelId: string) => void;
  addExtractingModel: (modelId: string) => void;
  removeExtractingModel: (modelId: string) => void;
  setDownloadProgress: (modelId: string, progress: DownloadProgress) => void;
  removeDownloadProgress: (modelId: string) => void;
}

export const useModelStore = create<ModelStore>()(
  subscribeWithSelector((set, get) => ({
    models: [],
    currentModel: "",
    downloadingModels: new Set(),
    extractingModels: new Set(),
    downloadProgress: new Map(),
    loading: true,
    error: null,
    hasAnyModels: false,
    isFirstRun: false,

    // Internal setters
    setModels: (models) => set({ models }),
    setCurrentModel: (currentModel) => set({ currentModel }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    setHasAnyModels: (hasAnyModels) => set({ hasAnyModels }),
    setIsFirstRun: (isFirstRun) => set({ isFirstRun }),
    addDownloadingModel: (modelId) =>
      set((state) => ({
        downloadingModels: new Set(state.downloadingModels).add(modelId),
      })),
    removeDownloadingModel: (modelId) =>
      set((state) => {
        const next = new Set(state.downloadingModels);
        next.delete(modelId);
        return { downloadingModels: next };
      }),
    addExtractingModel: (modelId) =>
      set((state) => ({
        extractingModels: new Set(state.extractingModels).add(modelId),
      })),
    removeExtractingModel: (modelId) =>
      set((state) => {
        const next = new Set(state.extractingModels);
        next.delete(modelId);
        return { extractingModels: next };
      }),
    setDownloadProgress: (modelId, progress) =>
      set((state) => ({
        downloadProgress: new Map(state.downloadProgress).set(modelId, progress),
      })),
    removeDownloadProgress: (modelId) =>
      set((state) => {
        const next = new Map(state.downloadProgress);
        next.delete(modelId);
        return { downloadProgress: next };
      }),

    // Getters
    getModelInfo: (modelId) =>
      get().models.find((model) => model.id === modelId),
    isModelDownloading: (modelId) => get().downloadingModels.has(modelId),
    isModelExtracting: (modelId) => get().extractingModels.has(modelId),
    getDownloadProgress: (modelId) => get().downloadProgress.get(modelId),

    // Actions
    loadModels: async () => {
      try {
        const models = await invoke<ModelInfo[]>("get_available_models");
        set({ models, error: null });
      } catch (err) {
        set({ error: `Failed to load models: ${err}` });
      } finally {
        set({ loading: false });
      }
    },

    loadCurrentModel: async () => {
      try {
        const currentModel = await invoke<string>("get_current_model");
        set({ currentModel });
      } catch (err) {
        console.error("Failed to load current model:", err);
      }
    },

    checkFirstRun: async () => {
      try {
        const hasModels = await invoke<boolean>("has_any_models_available");
        set({ hasAnyModels: hasModels, isFirstRun: !hasModels });
        return !hasModels;
      } catch (err) {
        console.error("Failed to check model availability:", err);
        return false;
      }
    },

    selectModel: async (modelId) => {
      try {
        set({ error: null });
        await invoke("set_active_model", { modelId });
        set({ currentModel: modelId, isFirstRun: false, hasAnyModels: true });
        return true;
      } catch (err) {
        set({ error: `Failed to switch to model: ${err}` });
        return false;
      }
    },

    downloadModel: async (modelId) => {
      const { addDownloadingModel, removeDownloadingModel } = get();
      try {
        set({ error: null });
        addDownloadingModel(modelId);
        await invoke("download_model", { modelId });
        return true;
      } catch (err) {
        set({ error: `Failed to download model: ${err}` });
        removeDownloadingModel(modelId);
        return false;
      }
    },

    deleteModel: async (modelId) => {
      const { loadModels } = get();
      try {
        set({ error: null });
        await invoke("delete_model", { modelId });
        await loadModels();
        return true;
      } catch (err) {
        set({ error: `Failed to delete model: ${err}` });
        return false;
      }
    },

    cancelDownload: async (modelId) => {
      const { removeDownloadingModel, removeDownloadProgress } = get();
      try {
        await invoke("cancel_download", { modelId });
        removeDownloadingModel(modelId);
        removeDownloadProgress(modelId);
        return true;
      } catch (err) {
        set({ error: `Failed to cancel download: ${err}` });
        return false;
      }
    },

    getRecommendedFirstModel: async () => {
      try {
        return await invoke<string>("get_recommended_first_model");
      } catch (err) {
        console.error("Failed to get recommended model:", err);
        return "parakeet-tdt-0.6b-v3"; // Fallback default
      }
    },

    initialize: async () => {
      const { loadModels, loadCurrentModel, checkFirstRun } = get();
      await Promise.all([loadModels(), loadCurrentModel(), checkFirstRun()]);
    },
  }))
);

// Set up event listeners at module load
// These events are emitted from the Rust backend during model operations

listen("model-state-changed", () => {
  useModelStore.getState().loadCurrentModel();
});

listen<DownloadProgress>("model-download-progress", (event) => {
  useModelStore
    .getState()
    .setDownloadProgress(event.payload.model_id, event.payload);
});

listen<string>("model-download-complete", (event) => {
  const modelId = event.payload;
  const state = useModelStore.getState();
  state.removeDownloadingModel(modelId);
  state.removeDownloadProgress(modelId);
  state.loadModels();
});

listen<string>("model-extraction-started", (event) => {
  useModelStore.getState().addExtractingModel(event.payload);
});

listen<string>("model-extraction-completed", (event) => {
  const state = useModelStore.getState();
  state.removeExtractingModel(event.payload);
  state.loadModels();
});

listen<{ model_id: string; error: string }>(
  "model-extraction-failed",
  (event) => {
    const state = useModelStore.getState();
    state.removeExtractingModel(event.payload.model_id);
    state.setError(`Failed to extract model: ${event.payload.error}`);
  }
);

listen<{ model_id: string; error: string }>(
  "model-download-failed",
  (event) => {
    const state = useModelStore.getState();
    state.removeDownloadingModel(event.payload.model_id);
    state.removeDownloadProgress(event.payload.model_id);
    state.setError(`Failed to download model: ${event.payload.error}`);
  }
);
