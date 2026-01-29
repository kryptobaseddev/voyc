/**
 * @task T023
 * @epic T001
 * @why In-app version checking for update notifications
 * @what Checks GitHub Releases API for newer versions
 */

import Gio from 'gi://Gio?version=2.0';
import GLib from 'gi://GLib?version=2.0';

/**
 * GitHub release response structure (subset of fields we need)
 */
interface GitHubRelease {
    tag_name: string;
    html_url: string;
    body: string;
    published_at: string;
}

/**
 * Update information returned when a newer version is available
 */
export interface UpdateInfo {
    currentVersion: string;
    latestVersion: string;
    releaseUrl: string;
    releaseNotes: string;
    publishedAt: string;
}

/**
 * Configuration for the VersionChecker
 */
export interface VersionCheckerConfig {
    /** Current application version (from package.json) */
    currentVersion: string;
    /** GitHub repository owner */
    repoOwner: string;
    /** GitHub repository name */
    repoName: string;
    /** Callback when update is available */
    onUpdateAvailable?: (info: UpdateInfo) => void;
    /** Callback on error (silent by default) */
    onError?: (error: Error) => void;
}

/**
 * Compare two semver version strings
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 *
 * @task T023
 * @epic T001
 * @why Need to compare version strings to detect updates
 * @what Parses semver and compares major.minor.patch
 * @param {string} a - First version string (e.g., "1.0.0")
 * @param {string} b - Second version string (e.g., "1.0.1")
 * @returns {number} Comparison result (-1, 0, or 1)
 */
export function compareSemver(a: string, b: string): number {
    // Strip leading 'v' if present
    const cleanA = a.replace(/^v/, '');
    const cleanB = b.replace(/^v/, '');

    const partsA = cleanA.split('.').map((p) => parseInt(p, 10) || 0);
    const partsB = cleanB.split('.').map((p) => parseInt(p, 10) || 0);

    // Ensure both have at least 3 parts
    while (partsA.length < 3) partsA.push(0);
    while (partsB.length < 3) partsB.push(0);

    for (let i = 0; i < 3; i++) {
        if (partsA[i] < partsB[i]) return -1;
        if (partsA[i] > partsB[i]) return 1;
    }

    return 0;
}

/**
 * Check if enough time has passed since last check (24 hours)
 *
 * @task T023
 * @epic T001
 * @why Only check once per day to avoid rate limiting
 * @what Compares ISO date strings
 * @param {string | null} lastCheck - ISO date string of last check, or null
 * @returns {boolean} True if should check again
 */
export function shouldCheckForUpdates(lastCheck: string | null): boolean {
    if (!lastCheck) return true;

    try {
        const lastCheckTime = new Date(lastCheck).getTime();
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;

        return (now - lastCheckTime) >= oneDayMs;
    } catch {
        // Invalid date format, allow check
        return true;
    }
}

/**
 * Get current ISO date string
 *
 * @task T023
 * @epic T001
 * @why Need to record when last update check occurred
 * @what Returns current time as ISO string
 * @returns {string} ISO date string
 */
export function getCurrentISODate(): string {
    return new Date().toISOString();
}

/**
 * VersionChecker class
 *
 * Fetches latest release from GitHub API and compares with current version.
 * Designed to be non-blocking and fail silently on network errors.
 *
 * @task T023
 * @epic T001
 * @why Enable users to know when updates are available
 * @what Async GitHub API check with semver comparison
 */
export class VersionChecker {
    private _config: VersionCheckerConfig;
    private _cancellable: Gio.Cancellable | null = null;

    /**
     * Create a new VersionChecker instance
     *
     * @task T023
     * @epic T001
     * @why Initialize version checker with configuration
     * @what Stores config for later use
     * @param {VersionCheckerConfig} config - Checker configuration
     */
    constructor(config: VersionCheckerConfig) {
        this._config = config;
    }

    /**
     * Get the GitHub API URL for latest release
     *
     * @task T023
     * @epic T001
     * @why Construct API endpoint URL
     * @what Returns GitHub releases API URL
     * @returns {string} API URL
     */
    private getApiUrl(): string {
        return `https://api.github.com/repos/${this._config.repoOwner}/${this._config.repoName}/releases/latest`;
    }

    /**
     * Check for updates asynchronously
     *
     * Non-blocking check that calls onUpdateAvailable callback if newer version exists.
     * Fails silently on network errors (calls onError if provided).
     *
     * @task T023
     * @epic T001
     * @why Main entry point for version checking
     * @what Fetches GitHub API and compares versions
     * @returns {Promise<UpdateInfo | null>} Update info if available, null otherwise
     */
    async checkForUpdates(): Promise<UpdateInfo | null> {
        try {
            const release = await this.fetchLatestRelease();
            if (!release) return null;

            const latestVersion = release.tag_name;
            const currentVersion = this._config.currentVersion;

            // Check if latest is newer than current
            if (compareSemver(currentVersion, latestVersion) < 0) {
                const updateInfo: UpdateInfo = {
                    currentVersion,
                    latestVersion,
                    releaseUrl: release.html_url,
                    releaseNotes: release.body || '',
                    publishedAt: release.published_at,
                };

                if (this._config.onUpdateAvailable) {
                    this._config.onUpdateAvailable(updateInfo);
                }

                return updateInfo;
            }

            return null;
        } catch (error) {
            if (this._config.onError) {
                this._config.onError(error as Error);
            }
            // Silent fail - don't disrupt app startup
            return null;
        }
    }

    /**
     * Fetch latest release from GitHub API
     *
     * Uses curl subprocess for reliable HTTP in GJS.
     *
     * @task T023
     * @epic T001
     * @why Retrieve release data from GitHub
     * @what HTTP GET to GitHub releases API
     * @returns {Promise<GitHubRelease | null>} Release data or null on error
     */
    private async fetchLatestRelease(): Promise<GitHubRelease | null> {
        return new Promise((resolve) => {
            try {
                const url = this.getApiUrl();

                // Create a cancellable for timeout handling
                this._cancellable = Gio.Cancellable.new();

                // Set up timeout (10 seconds)
                const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
                    if (this._cancellable) {
                        this._cancellable.cancel();
                    }
                    return GLib.SOURCE_REMOVE;
                });

                // Use curl for HTTP request - simpler and more reliable in GJS
                this.fetchWithCurl(url)
                    .then((data) => {
                        GLib.source_remove(timeoutId);
                        resolve(data);
                    })
                    .catch(() => {
                        GLib.source_remove(timeoutId);
                        resolve(null);
                    });

            } catch (error) {
                resolve(null);
            }
        });
    }

    /**
     * Fetch URL using curl subprocess
     *
     * Uses GLib.spawn_async to run curl and get response.
     * More reliable in GJS than Soup in some environments.
     *
     * @task T023
     * @epic T001
     * @why HTTP client that works reliably in GJS
     * @what Spawns curl and parses JSON response
     * @param {string} url - URL to fetch
     * @returns {Promise<GitHubRelease | null>} Parsed response or null
     */
    private fetchWithCurl(url: string): Promise<GitHubRelease | null> {
        return new Promise((resolve) => {
            try {
                // Build curl command with User-Agent (required by GitHub API)
                const args = [
                    'curl',
                    '-s',                          // Silent mode
                    '-m', '10',                    // 10 second timeout
                    '-H', 'Accept: application/vnd.github.v3+json',
                    '-H', 'User-Agent: Voyc-Update-Checker',
                    url,
                ];

                // Spawn subprocess
                const [success, stdout, stderr, exitStatus] = GLib.spawn_command_line_sync(
                    args.join(' ')
                );

                if (!success || exitStatus !== 0 || !stdout) {
                    resolve(null);
                    return;
                }

                // Decode response
                const decoder = new TextDecoder();
                const responseText = decoder.decode(stdout as Uint8Array);

                // Parse JSON
                const release = JSON.parse(responseText) as GitHubRelease;

                // Validate required fields
                if (!release.tag_name || !release.html_url) {
                    resolve(null);
                    return;
                }

                resolve(release);

            } catch (error) {
                resolve(null);
            }
        });
    }

    /**
     * Cancel any pending requests
     *
     * @task T023
     * @epic T001
     * @why Allow cleanup on app shutdown
     * @what Cancels in-flight requests
     */
    cancel(): void {
        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
    }
}

/**
 * Convenience function to schedule a non-blocking version check
 *
 * Uses GLib.timeout_add to run the check after app startup,
 * ensuring it doesn't delay initial render.
 *
 * @task T023
 * @epic T001
 * @why Don't block app startup with network request
 * @what Schedules check after short delay
 * @param {VersionCheckerConfig} config - Checker configuration
 * @param {number} [delayMs=2000] - Delay before checking (default 2 seconds)
 * @returns {VersionChecker} The checker instance (for cancellation)
 */
export function scheduleVersionCheck(
    config: VersionCheckerConfig,
    delayMs: number = 2000
): VersionChecker {
    const checker = new VersionChecker(config);

    GLib.timeout_add(GLib.PRIORITY_LOW, delayMs, () => {
        checker.checkForUpdates().catch(() => {
            // Silent fail
        });
        return GLib.SOURCE_REMOVE;
    });

    return checker;
}
