/**
 * Settings Page for Voyc
 * Main settings container with sidebar navigation and content panels
 * Adapted from Handy's settings page patterns
 */

import React, { useState } from "react";
import { Sidebar, type SettingsSection } from "./Sidebar";
import { DictationSettings } from "./DictationSettings";
import { InAppDictation } from "./InAppDictation";
import { GeneralSettings } from "./GeneralSettings";
import { AudioSettings } from "./AudioSettings";
import { ModelSettings } from "./ModelSettings";
import { HotkeySettings } from "./HotkeySettings";
import { CloudSettings } from "./CloudSettings";
import { HistorySettings } from "./HistorySettings";
import { DebugSettings } from "./DebugSettings";
import { PrivacySettings } from "./PrivacySettings";
import { AboutSettings } from "./AboutSettings";

const SECTION_TITLES: Record<SettingsSection, string> = {
  dictation: "Dictation",
  inapp: "In-App Dictation",
  general: "General Settings",
  audio: "Audio Settings",
  models: "Model Settings",
  hotkeys: "Keyboard Shortcuts",
  cloud: "Cloud Services",
  history: "Transcription History",
  debug: "Debug & Diagnostics",
  privacy: "Privacy & Data",
  about: "About Voyc",
};

export const SettingsPage: React.FC = () => {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("dictation");

  const renderContent = () => {
    switch (activeSection) {
      case "dictation":
        return <DictationSettings />;
      case "inapp":
        return <InAppDictation />;
      case "general":
        return <GeneralSettings />;
      case "audio":
        return <AudioSettings />;
      case "models":
        return <ModelSettings />;
      case "hotkeys":
        return <HotkeySettings />;
      case "cloud":
        return <CloudSettings />;
      case "history":
        return <HistorySettings />;
      case "debug":
        return <DebugSettings />;
      case "privacy":
        return <PrivacySettings />;
      case "about":
        return <AboutSettings />;
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <div className="flex h-full bg-background">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-mid-gray/20">
          <h1 className="text-xl font-semibold">
            {SECTION_TITLES[activeSection]}
          </h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">{renderContent()}</div>
      </div>
    </div>
  );
};
