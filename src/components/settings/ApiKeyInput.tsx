/**
 * API Key Input Component for Voyc
 * Secure input for cloud provider API keys
 * Adapted from Handy's ApiKeyField patterns
 */

import React, { useState, useEffect } from "react";
import { SettingContainer } from "../ui/SettingContainer";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { invoke } from "@tauri-apps/api/core";

interface ApiKeyInputProps {
  provider: "elevenlabs" | "openai";
  label: string;
  description: string;
  placeholder?: string;
  grouped?: boolean;
}

export const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
  provider,
  label,
  description,
  placeholder = "",
  grouped = false,
}) => {
  const [localValue, setLocalValue] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if key exists on mount
  useEffect(() => {
    const checkKey = async () => {
      try {
        const exists = await invoke<boolean>("has_api_key", { provider });
        setHasKey(exists);
      } catch (err) {
        console.error(`Failed to check ${provider} API key:`, err);
      } finally {
        setIsLoading(false);
      }
    };
    checkKey();
  }, [provider]);

  const handleSave = async () => {
    if (!localValue.trim()) return;

    setIsSaving(true);
    setError(null);

    try {
      await invoke("set_api_key", {
        provider,
        apiKey: localValue.trim(),
      });
      setHasKey(true);
      setLocalValue("");
      setShowKey(false);
    } catch (err) {
      setError(`Failed to save API key: ${err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await invoke("clear_api_key", { provider });
      setHasKey(false);
      setLocalValue("");
    } catch (err) {
      setError(`Failed to clear API key: ${err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && localValue.trim()) {
      handleSave();
    }
  };

  if (isLoading) {
    return (
      <SettingContainer
        title={label}
        description={description}
        grouped={grouped}
        layout="stacked"
      >
        <div className="flex items-center h-9">
          <div className="w-4 h-4 border-2 border-logo-primary border-t-transparent rounded-full animate-spin" />
          <span className="ml-2 text-sm text-mid-gray">Loading...</span>
        </div>
      </SettingContainer>
    );
  }

  return (
    <SettingContainer
      title={label}
      description={description}
      grouped={grouped}
      layout="stacked"
    >
      <div className="space-y-2">
        {error && (
          <div className="text-sm text-red-500 bg-red-500/10 px-2 py-1 rounded">
            {error}
          </div>
        )}

        {hasKey ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 bg-mid-gray/10 border border-mid-gray/20 rounded text-sm">
              <span className="text-mid-gray">
                {showKey ? "sk-" + "*".repeat(20) : "API key configured"}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={isSaving}
              title="Remove API key"
            >
              <svg
                className="h-4 w-4 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type={showKey ? "text" : "password"}
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isSaving}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKey(!showKey)}
              title={showKey ? "Hide" : "Show"}
            >
              {showKey ? (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !localValue.trim()}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}

        <p className="text-xs text-mid-gray/70">
          Your API key is stored securely in the system keychain.
        </p>
      </div>
    </SettingContainer>
  );
};
