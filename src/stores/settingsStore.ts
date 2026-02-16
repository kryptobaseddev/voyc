/**
 * Settings Store for Voyc
 * Zustand state management for app settings
 * Adapted from Handy's settingsStore
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";

// Type definitions matching Rust backend (src-tauri/src/settings.rs)
export type ModelUnloadTimeout =
  | "never"
  | "immediately"
  | "min_2"
  | "min_5"
  | "min_10"
  | "min_15"
  | "hour_1"
  | "sec_5";

export type SoundTheme = "marimba" | "pop" | "custom";

export interface ShortcutBinding {
  id: string;
  name: string;
  description: string;
  default_binding: string;
  current_binding: string;
}

export type OverlayPosition = "top" | "bottom" | "none";
export type CloudSttProvider = "openai" | "elevenlabs";

export interface AppSettings {
  bindings: Record<string, ShortcutBinding>;
  push_to_talk: boolean;
  audio_feedback: boolean;
  audio_feedback_volume: number;
  sound_theme: SoundTheme;
  start_hidden: boolean;
  autostart_enabled: boolean;
  update_checks_enabled: boolean;
  selected_model: string;
  always_on_microphone: boolean;
  selected_microphone: string | null;
  selected_output_device: string | null;
  translate_to_english: boolean;
  selected_language: string;
  custom_words: string[];
  word_correction_threshold: number;
  model_unload_timeout: ModelUnloadTimeout;
  mute_while_recording: boolean;
  overlay_position: OverlayPosition;
  // Cloud STT settings
  cloud_stt_enabled: boolean;
  cloud_stt_provider: CloudSttProvider;
  cloud_stt_api_key: string;
  cloud_stt_fallback_threshold: number;
  // VAD settings
  vad_threshold: number;
  // Post-processing settings
  post_process_enabled: boolean;
  post_process_api_key: string;
  post_process_provider: string;
  // Dictation text editor mode
  dictation_text_mode: "append" | "replace";
  // Theme mode
  theme_mode: "system" | "light" | "dark";
}

export interface AudioDevice {
  index: string;
  name: string;
  is_default: boolean;
}

interface SettingsStore {
  settings: AppSettings | null;
  defaultSettings: AppSettings | null;
  isLoading: boolean;
  isUpdating: Record<string, boolean>;
  audioDevices: AudioDevice[];
  outputDevices: AudioDevice[];
  customSounds: { start: boolean; stop: boolean };

  // Actions
  initialize: () => Promise<void>;
  loadDefaultSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => Promise<void>;
  resetSetting: (key: keyof AppSettings) => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshAudioDevices: () => Promise<void>;
  refreshOutputDevices: () => Promise<void>;
  playTestSound: (soundType: "start" | "stop") => Promise<void>;
  checkCustomSounds: () => Promise<void>;

  // Getters
  getSetting: <K extends keyof AppSettings>(
    key: K,
  ) => AppSettings[K] | undefined;
  isUpdatingKey: (key: string) => boolean;

  // Internal state setters
  setSettings: (settings: AppSettings | null) => void;
  setDefaultSettings: (defaultSettings: AppSettings | null) => void;
  setLoading: (loading: boolean) => void;
  setUpdating: (key: string, updating: boolean) => void;
  setAudioDevices: (devices: AudioDevice[]) => void;
  setOutputDevices: (devices: AudioDevice[]) => void;
  setCustomSounds: (sounds: { start: boolean; stop: boolean }) => void;
}

const DEFAULT_AUDIO_DEVICE: AudioDevice = {
  index: "default",
  name: "Default",
  is_default: true,
};

// Mapping of settings keys to their Tauri update commands
// Voyc uses a generic update_setting command with key/value pairs
const SETTING_KEYS_REQUIRING_BACKEND_UPDATE: (keyof AppSettings)[] = [
  "push_to_talk",
  "audio_feedback",
  "audio_feedback_volume",
  "start_hidden",
  "autostart_enabled",
  "update_checks_enabled",
  "translate_to_english",
  "selected_language",
  "mute_while_recording",
  "dictation_text_mode",
  "theme_mode",
];

export const useSettingsStore = create<SettingsStore>()(
  subscribeWithSelector((set, get) => ({
    settings: null,
    defaultSettings: null,
    isLoading: true,
    isUpdating: {},
    audioDevices: [],
    outputDevices: [],
    customSounds: { start: false, stop: false },

    // Internal setters
    setSettings: (settings) => set({ settings }),
    setDefaultSettings: (defaultSettings) => set({ defaultSettings }),
    setLoading: (isLoading) => set({ isLoading }),
    setUpdating: (key, updating) =>
      set((state) => ({
        isUpdating: { ...state.isUpdating, [key]: updating },
      })),
    setAudioDevices: (audioDevices) => set({ audioDevices }),
    setOutputDevices: (outputDevices) => set({ outputDevices }),
    setCustomSounds: (customSounds) => set({ customSounds }),

    // Getters
    getSetting: (key) => get().settings?.[key],
    isUpdatingKey: (key) => get().isUpdating[key] || false,

    // Load settings from backend
    refreshSettings: async () => {
      try {
        const settings = await invoke<AppSettings>("get_app_settings");
        const normalizedSettings: AppSettings = {
          ...settings,
          always_on_microphone: settings.always_on_microphone ?? false,
          selected_microphone: settings.selected_microphone ?? null,
          selected_output_device: settings.selected_output_device ?? null,
        };
        set({ settings: normalizedSettings, isLoading: false });
      } catch (error) {
        console.error("Failed to load settings:", error);
        set({ isLoading: false });
      }
    },

    // Load audio devices
    refreshAudioDevices: async () => {
      try {
        const devices = await invoke<AudioDevice[]>(
          "get_available_microphones",
        );
        const devicesWithDefault = [
          DEFAULT_AUDIO_DEVICE,
          ...devices.filter(
            (d) => d.name !== "Default" && d.name !== "default",
          ),
        ];
        set({ audioDevices: devicesWithDefault });
      } catch (error) {
        console.error("Failed to load audio devices:", error);
        set({ audioDevices: [DEFAULT_AUDIO_DEVICE] });
      }
    },

    // Load output devices
    refreshOutputDevices: async () => {
      try {
        const devices = await invoke<AudioDevice[]>(
          "get_available_output_devices",
        );
        const devicesWithDefault = [
          DEFAULT_AUDIO_DEVICE,
          ...devices.filter(
            (d) => d.name !== "Default" && d.name !== "default",
          ),
        ];
        set({ outputDevices: devicesWithDefault });
      } catch (error) {
        console.error("Failed to load output devices:", error);
        set({ outputDevices: [DEFAULT_AUDIO_DEVICE] });
      }
    },

    // Play a test sound
    playTestSound: async (soundType: "start" | "stop") => {
      try {
        await invoke("play_test_sound", { soundType });
      } catch (error) {
        console.error(`Failed to play test sound (${soundType}):`, error);
      }
    },

    checkCustomSounds: async () => {
      try {
        const sounds = await invoke<{ start: boolean; stop: boolean }>(
          "check_custom_sounds",
        );
        get().setCustomSounds(sounds);
      } catch (error) {
        console.error("Failed to check custom sounds:", error);
      }
    },

    // Update a specific setting
    updateSetting: async <K extends keyof AppSettings>(
      key: K,
      value: AppSettings[K],
    ) => {
      const { settings, setUpdating } = get();
      const updateKey = String(key);
      const originalValue = settings?.[key];

      setUpdating(updateKey, true);

      try {
        // Optimistic update
        set((state) => ({
          settings: state.settings ? { ...state.settings, [key]: value } : null,
        }));

        // Handle special cases with dedicated commands
        if (key === "always_on_microphone") {
          await invoke("update_microphone_mode", {
            alwaysOn: value as boolean,
          });
        } else if (key === "selected_microphone") {
          const deviceName =
            (value as string | null) === null || value === "Default"
              ? "default"
              : (value as string);
          await invoke("set_selected_microphone", { deviceName });
        } else if (key === "selected_output_device") {
          const deviceName =
            (value as string | null) === null || value === "Default"
              ? "default"
              : (value as string);
          await invoke("set_selected_output_device", { deviceName });
        } else if (SETTING_KEYS_REQUIRING_BACKEND_UPDATE.includes(key)) {
          // Use generic update_setting command for supported keys
          await invoke("update_setting", {
            update: { key: updateKey, value },
          });
        } else if (key !== "bindings" && key !== "selected_model") {
          // For unsupported keys, log warning but don't fail
          console.warn(`No handler for setting: ${String(key)}`);
        }
      } catch (error) {
        console.error(`Failed to update setting ${String(key)}:`, error);
        // Rollback on error
        if (settings) {
          set({ settings: { ...settings, [key]: originalValue } });
        }
      } finally {
        setUpdating(updateKey, false);
      }
    },

    // Reset a setting to its default value
    resetSetting: async (key) => {
      const { defaultSettings } = get();
      if (defaultSettings) {
        const defaultValue = defaultSettings[key];
        if (defaultValue !== undefined) {
          await get().updateSetting(key, defaultValue);
        }
      }
    },

    // Load default settings from Rust
    loadDefaultSettings: async () => {
      try {
        const defaultSettings = await invoke<AppSettings>(
          "get_default_app_settings",
        );
        set({ defaultSettings });
      } catch (error) {
        console.error("Failed to load default settings:", error);
      }
    },

    // Initialize everything
    initialize: async () => {
      const { refreshSettings, checkCustomSounds, loadDefaultSettings } = get();

      // Note: Audio devices are NOT refreshed here. The frontend (App.tsx)
      // is responsible for calling refreshAudioDevices/refreshOutputDevices
      // after onboarding completes. This avoids triggering permission dialogs
      // before the user is ready.
      await Promise.all([
        loadDefaultSettings(),
        refreshSettings(),
        checkCustomSounds(),
      ]);
    },
  })),
);
