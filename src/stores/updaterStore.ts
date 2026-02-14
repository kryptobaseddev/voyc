import { create } from "zustand";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";

type PendingUpdate = Awaited<ReturnType<typeof check>>;

interface UpdaterState {
  latestVersion: string | null;
  hasUpdate: boolean;
  isChecking: boolean;
  isInstalling: boolean;
  status: string | null;
  pendingUpdate: PendingUpdate | null;
  checkForUpdates: (currentVersion: string) => Promise<void>;
  installUpdate: () => Promise<void>;
}

function compareVersions(a: string, b: string): number {
  const ap = a.split(".").map((v) => Number.parseInt(v, 10) || 0);
  const bp = b.split(".").map((v) => Number.parseInt(v, 10) || 0);
  const len = Math.max(ap.length, bp.length);

  for (let i = 0; i < len; i += 1) {
    const av = ap[i] || 0;
    const bv = bp[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }

  return 0;
}

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  latestVersion: null,
  hasUpdate: false,
  isChecking: false,
  isInstalling: false,
  status: null,
  pendingUpdate: null,

  checkForUpdates: async (currentVersion: string) => {
    set({
      isChecking: true,
      status: null,
      pendingUpdate: null,
      latestVersion: null,
    });

    try {
      const update = await check();
      if (update) {
        set({
          hasUpdate: true,
          latestVersion: update.version,
          pendingUpdate: update,
          status: `Update available: v${update.version}`,
        });
      } else {
        set({ hasUpdate: false, status: "You're running the latest version!" });
      }
    } catch {
      try {
        const response = await fetch(
          "https://api.github.com/repos/kryptobaseddev/voyc/releases/latest",
        );
        if (!response.ok) {
          throw new Error(`GitHub API ${response.status}`);
        }

        const data = (await response.json()) as { tag_name?: string };
        const latest = (data.tag_name || "").replace(/^v/, "");

        if (!latest) {
          throw new Error("Missing latest release tag");
        }

        if (compareVersions(latest, currentVersion) > 0) {
          set({
            hasUpdate: true,
            latestVersion: latest,
            status: `Update available: v${latest}`,
          });
        } else {
          set({
            hasUpdate: false,
            status: "You're running the latest version!",
          });
        }
      } catch {
        set({
          hasUpdate: false,
          status:
            "Unable to check for updates. Verify internet and GitHub access.",
        });
      }
    } finally {
      set({ isChecking: false });
    }
  },

  installUpdate: async () => {
    const { pendingUpdate } = get();
    set({ isInstalling: true, status: "Downloading and installing update..." });

    try {
      if (pendingUpdate) {
        await pendingUpdate.downloadAndInstall();
      } else {
        await invoke("run_user_update");
      }

      set({ status: "Update installed. Restarting app...", hasUpdate: false });
      await relaunch();
    } catch {
      set({
        status:
          "Update installation failed. Please try again. If the issue persists, open the GitHub Releases page from About > Links.",
      });
    } finally {
      set({ isInstalling: false });
    }
  },
}));
