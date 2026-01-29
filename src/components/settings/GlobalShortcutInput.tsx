/**
 * Global Shortcut Input Component for Voyc
 * Allows recording and setting global keyboard shortcuts
 * Adapted from Handy's GlobalShortcutInput
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { ResetButton } from "../ui/ResetButton";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettings } from "../../hooks/useSettings";
import { useOsType } from "../../hooks/useOsType";
import { invoke } from "@tauri-apps/api/core";

interface GlobalShortcutInputProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  shortcutId: string;
  disabled?: boolean;
}

// Shortcut metadata for display
const SHORTCUT_META: Record<string, { name: string; description: string }> = {
  transcribe: {
    name: "Toggle Dictation",
    description: "Start or stop voice dictation",
  },
  terminal_paste: {
    name: "Terminal Paste",
    description: "Paste transcribed text into terminal applications",
  },
};

// Get platform-specific key name
const getKeyName = (event: KeyboardEvent, osType: string | null): string => {
  const key = event.key;

  // Map modifier keys
  if (key === "Control") return "Ctrl";
  if (key === "Meta") return osType === "Darwin" ? "Cmd" : "Super";
  if (key === "Alt") return osType === "Darwin" ? "Option" : "Alt";
  if (key === "Shift") return "Shift";

  // Handle special keys
  if (key === " ") return "Space";
  if (key === "ArrowUp") return "Up";
  if (key === "ArrowDown") return "Down";
  if (key === "ArrowLeft") return "Left";
  if (key === "ArrowRight") return "Right";

  // Return capitalized single characters
  if (key.length === 1) return key.toUpperCase();

  return key;
};

// Normalize key names for consistency
const normalizeKey = (key: string): string => {
  const lower = key.toLowerCase();
  if (lower === "control") return "Ctrl";
  if (lower === "meta" || lower === "command" || lower === "cmd") return "Cmd";
  if (lower === "option") return "Alt";
  return key;
};

// Format key combination for display
const formatKeyCombination = (
  binding: string,
  osType: string | null
): string => {
  if (!binding) return "Not set";

  const keys = binding.split("+");
  const formatted = keys.map((key) => {
    const normalized = normalizeKey(key);
    // Use platform-specific symbols on macOS
    if (osType === "Darwin") {
      if (normalized === "Cmd") return "\u2318";
      if (normalized === "Alt" || normalized === "Option") return "\u2325";
      if (normalized === "Shift") return "\u21E7";
      if (normalized === "Ctrl") return "\u2303";
    }
    return normalized;
  });

  return formatted.join(osType === "Darwin" ? "" : "+");
};

export const GlobalShortcutInput: React.FC<GlobalShortcutInputProps> = ({
  descriptionMode = "tooltip",
  grouped = false,
  shortcutId,
  disabled = false,
}) => {
  const { getSetting, isLoading } = useSettings();
  const osType = useOsType();

  const [keyPressed, setKeyPressed] = useState<string[]>([]);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [originalBinding, setOriginalBinding] = useState<string>("");
  const [currentBinding, setCurrentBinding] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const bindings = getSetting("bindings") || {};
  const binding = bindings[shortcutId];

  // Sync current binding from store
  useEffect(() => {
    if (binding?.current_binding) {
      setCurrentBinding(binding.current_binding);
    }
  }, [binding?.current_binding]);

  // Handle keyboard events when editing
  useEffect(() => {
    if (!isEditing) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (e.key === "Escape") {
        // Cancel and restore
        setIsEditing(false);
        setKeyPressed([]);
        setRecordedKeys([]);
        if (originalBinding) {
          try {
            await invoke("resume_binding", { bindingId: shortcutId });
          } catch (error) {
            console.error("Failed to resume binding:", error);
          }
        }
        return;
      }

      e.preventDefault();

      const key = normalizeKey(getKeyName(e, osType));
      if (!keyPressed.includes(key)) {
        setKeyPressed((prev) => [...prev, key]);
        if (!recordedKeys.includes(key)) {
          setRecordedKeys((prev) => [...prev, key]);
        }
      }
    };

    const handleKeyUp = async (e: KeyboardEvent) => {
      e.preventDefault();

      const key = normalizeKey(getKeyName(e, osType));
      const updatedKeyPressed = keyPressed.filter((k) => k !== key);
      setKeyPressed(updatedKeyPressed);

      // Commit when all keys are released
      if (updatedKeyPressed.length === 0 && recordedKeys.length > 0) {
        // Sort: modifiers first, then main key
        const modifiers = [
          "ctrl",
          "shift",
          "alt",
          "option",
          "cmd",
          "meta",
          "super",
        ];
        const sortedKeys = [...recordedKeys].sort((a, b) => {
          const aIsMod = modifiers.includes(a.toLowerCase());
          const bIsMod = modifiers.includes(b.toLowerCase());
          if (aIsMod && !bIsMod) return -1;
          if (!aIsMod && bIsMod) return 1;
          return 0;
        });

        const newShortcut = sortedKeys.join("+");

        try {
          setIsUpdating(true);
          await invoke("update_binding", {
            bindingId: shortcutId,
            newBinding: newShortcut,
          });
          setCurrentBinding(newShortcut);
        } catch (error) {
          console.error("Failed to update binding:", error);
          // Restore original on error
          if (originalBinding) {
            try {
              await invoke("update_binding", {
                bindingId: shortcutId,
                newBinding: originalBinding,
              });
            } catch (resetError) {
              console.error("Failed to restore binding:", resetError);
            }
          }
        } finally {
          setIsUpdating(false);
          setIsEditing(false);
          setKeyPressed([]);
          setRecordedKeys([]);
          setOriginalBinding("");
        }
      }
    };

    const handleClickOutside = async (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsEditing(false);
        setKeyPressed([]);
        setRecordedKeys([]);
        if (originalBinding) {
          try {
            await invoke("resume_binding", { bindingId: shortcutId });
          } catch (error) {
            console.error("Failed to resume binding:", error);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("click", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("click", handleClickOutside);
    };
  }, [isEditing, keyPressed, recordedKeys, originalBinding, shortcutId, osType]);

  const startRecording = async () => {
    if (isEditing || disabled) return;

    try {
      await invoke("suspend_binding", { bindingId: shortcutId });
      setOriginalBinding(currentBinding);
      setIsEditing(true);
      setKeyPressed([]);
      setRecordedKeys([]);
    } catch (error) {
      console.error("Failed to suspend binding:", error);
    }
  };

  const handleReset = async () => {
    if (!binding?.default_binding) return;

    try {
      setIsUpdating(true);
      await invoke("update_binding", {
        bindingId: shortcutId,
        newBinding: binding.default_binding,
      });
      setCurrentBinding(binding.default_binding);
    } catch (error) {
      console.error("Failed to reset binding:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Format current keys being recorded
  const formatCurrentKeys = (): string => {
    if (recordedKeys.length === 0) return "Press keys...";
    return formatKeyCombination(recordedKeys.join("+"), osType);
  };

  // Get metadata for this shortcut
  const meta = SHORTCUT_META[shortcutId] || {
    name: binding?.name || shortcutId,
    description: binding?.description || "",
  };

  if (isLoading) {
    return (
      <SettingContainer
        title={meta.name}
        description={meta.description}
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <div className="text-sm text-mid-gray">Loading...</div>
      </SettingContainer>
    );
  }

  if (!binding) {
    return (
      <SettingContainer
        title={meta.name}
        description={meta.description}
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <div className="text-sm text-mid-gray">Not configured</div>
      </SettingContainer>
    );
  }

  return (
    <SettingContainer
      title={meta.name}
      description={meta.description}
      descriptionMode={descriptionMode}
      grouped={grouped}
      disabled={disabled}
      layout="horizontal"
    >
      <div className="flex items-center space-x-1" ref={containerRef}>
        {isEditing ? (
          <div className="px-2 py-1 text-sm font-semibold border border-logo-primary bg-logo-primary/30 rounded min-w-[120px] text-center">
            {formatCurrentKeys()}
          </div>
        ) : (
          <div
            className={`px-2 py-1 text-sm font-semibold bg-mid-gray/10 border border-mid-gray/80 rounded cursor-pointer hover:border-logo-primary hover:bg-logo-primary/10 transition-all ${
              disabled ? "opacity-50 cursor-not-allowed" : ""
            }`}
            onClick={startRecording}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                startRecording();
              }
            }}
          >
            {formatKeyCombination(currentBinding, osType)}
          </div>
        )}
        <ResetButton onClick={handleReset} disabled={isUpdating || isLoading} />
      </div>
    </SettingContainer>
  );
};
