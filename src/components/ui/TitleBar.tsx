/**
 * Title Bar Component with Window Controls
 * Custom title bar for frameless window on Wayland/Linux
 */

import React, { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      // Check initial state
      setIsMaximized(await appWindow.isMaximized());

      // Listen for resize events
      unlisten = await appWindow.onResized(async () => {
        setIsMaximized(await appWindow.isMaximized());
      });
    };

    setup().catch(console.error);

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleMinimize = async () => {
    try {
      await appWindow.minimize();
    } catch (e) {
      console.error("Failed to minimize:", e);
    }
  };

  const handleMaximize = async () => {
    try {
      await appWindow.toggleMaximize();
    } catch (e) {
      console.error("Failed to maximize:", e);
    }
  };

  const handleClose = async () => {
    try {
      await appWindow.close();
    } catch (e) {
      console.error("Failed to close:", e);
    }
  };

  return (
    <div
      className="h-8 bg-background-secondary border-b border-mid-gray/20 flex items-center justify-between select-none"
      data-tauri-drag-region
    >
      {/* Title */}
      <div
        className="flex-1 px-3 text-sm font-medium text-text/80 truncate"
        data-tauri-drag-region
      >
        Voyc
      </div>

      {/* Window Controls */}
      <div className="flex items-center h-full">
        {/* Minimize */}
        <button
          onClick={handleMinimize}
          className="h-full w-10 flex items-center justify-center text-mid-gray hover:text-text hover:bg-mid-gray/10 transition-colors"
          aria-label="Minimize"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 12h14" strokeLinecap="round" />
          </svg>
        </button>

        {/* Maximize/Restore */}
        <button
          onClick={handleMaximize}
          className="h-full w-10 flex items-center justify-center text-mid-gray hover:text-text hover:bg-mid-gray/10 transition-colors"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 9h6v6H9z" />
              <path
                d="M15 9V5H5v10h4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="5" y="5" width="14" height="14" rx="1" />
            </svg>
          )}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="h-full w-10 flex items-center justify-center text-mid-gray hover:text-white hover:bg-red-500 transition-colors"
          aria-label="Close"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
};
