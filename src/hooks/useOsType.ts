/**
 * useOsType Hook for Voyc
 * Platform detection for keyboard handling
 * Adapted from Handy's useOsType
 */

import { type } from "@tauri-apps/plugin-os";

export type OSType = "macos" | "windows" | "linux" | "unknown";

/**
 * Get the current OS type for keyboard handling.
 * This is a simple wrapper - type() is synchronous.
 */
export function useOsType(): OSType {
  const osType = type();
  // type() returns "macos" | "windows" | "linux" | "ios" | "android"
  // OSType expects "macos" | "windows" | "linux" | "unknown"
  if (osType === "macos" || osType === "windows" || osType === "linux") {
    return osType;
  }
  return "unknown";
}
