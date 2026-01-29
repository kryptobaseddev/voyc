/**
 * Audio Settings Panel for Voyc
 * Contains: Microphone, Output Device, VAD Threshold, Audio Feedback, Test Sounds
 * Adapted from Handy's GeneralSettings audio section
 */

import React from "react";
import { SettingsGroup } from "../ui/SettingsGroup";
import { MicrophoneSelector } from "./MicrophoneSelector";
import { OutputDeviceSelector } from "./OutputDeviceSelector";
import { AudioFeedbackToggle } from "./AudioFeedbackToggle";
import { VolumeSlider } from "./VolumeSlider";
import { MuteWhileRecordingToggle } from "./MuteWhileRecordingToggle";
import { SoundPicker } from "./SoundPicker";
import { PushToTalkToggle } from "./PushToTalkToggle";
import { VadThresholdSlider } from "./VadThresholdSlider";
import { useSettings } from "../../hooks/useSettings";

export const AudioSettings: React.FC = () => {
  const { audioFeedbackEnabled } = useSettings();

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title="Input">
        <MicrophoneSelector descriptionMode="tooltip" grouped={true} />
        <MuteWhileRecordingToggle descriptionMode="tooltip" grouped={true} />
        <PushToTalkToggle descriptionMode="tooltip" grouped={true} />
      </SettingsGroup>

      <SettingsGroup title="Voice Detection">
        <VadThresholdSlider grouped={true} />
      </SettingsGroup>

      <SettingsGroup title="Feedback">
        <AudioFeedbackToggle descriptionMode="tooltip" grouped={true} />
        <OutputDeviceSelector
          descriptionMode="tooltip"
          grouped={true}
          disabled={!audioFeedbackEnabled}
        />
        <VolumeSlider disabled={!audioFeedbackEnabled} />
        <SoundPicker
          label="Sound Theme"
          description="Choose the sound played when starting and stopping dictation"
          disabled={!audioFeedbackEnabled}
        />
      </SettingsGroup>
    </div>
  );
};
