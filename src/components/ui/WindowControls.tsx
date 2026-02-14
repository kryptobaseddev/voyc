import React, { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

export const WindowControls: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      setIsMaximized(await appWindow.isMaximized());
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

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => appWindow.minimize()}
        className="h-7 w-7 rounded hover:bg-mid-gray/20 text-text/70 hover:text-text"
        aria-label="Minimize"
        title="Minimize"
      >
        <svg
          className="w-4 h-4 mx-auto"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 12h14"
          />
        </svg>
      </button>

      <button
        onClick={() => appWindow.toggleMaximize()}
        className="h-7 w-7 rounded hover:bg-mid-gray/20 text-text/70 hover:text-text"
        aria-label={isMaximized ? "Restore" : "Maximize"}
        title={isMaximized ? "Restore" : "Maximize"}
      >
        {isMaximized ? (
          <svg
            className="w-4 h-4 mx-auto"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 9h10v10H9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 5h10v10"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 mx-auto"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 5h14v14H5z"
            />
          </svg>
        )}
      </button>

      <button
        onClick={() => appWindow.close()}
        className="h-7 w-7 rounded hover:bg-red-500/20 text-text/70 hover:text-red-500"
        aria-label="Close"
        title="Close"
      >
        <svg
          className="w-4 h-4 mx-auto"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 6l12 12M6 18L18 6"
          />
        </svg>
      </button>
    </div>
  );
};
