/**
 * Settings Components Index for Voyc
 * Exports all settings-related components
 */

// Main settings page
export { SettingsPage } from "./SettingsPage";

// Main settings panels
export { GeneralSettings } from "./GeneralSettings";
export { AudioSettings } from "./AudioSettings";
export { ModelSettings } from "./ModelSettings";
export { HotkeySettings } from "./HotkeySettings";
export { CloudSettings } from "./CloudSettings";

// Navigation
export { Sidebar, type SettingsSection } from "./Sidebar";

// Individual setting components
export { ThemeSelector } from "./ThemeSelector";
export { AutostartToggle } from "./AutostartToggle";
export { UpdateChecksToggle } from "./UpdateChecksToggle";
export { LogLevelSelector } from "./LogLevelSelector";

export { MicrophoneSelector } from "./MicrophoneSelector";
export { OutputDeviceSelector } from "./OutputDeviceSelector";
export { AudioFeedbackToggle } from "./AudioFeedbackToggle";
export { VolumeSlider } from "./VolumeSlider";
export { MuteWhileRecordingToggle } from "./MuteWhileRecordingToggle";
export { SoundPicker } from "./SoundPicker";

export { ModelSelector } from "./ModelSelector";
export { ModelUnloadTimeout } from "./ModelUnloadTimeout";
export { CloudFallbackThreshold } from "./CloudFallbackThreshold";

export { GlobalShortcutInput } from "./GlobalShortcutInput";

export { ApiKeyInput } from "./ApiKeyInput";
export { ProviderPriority } from "./ProviderPriority";
