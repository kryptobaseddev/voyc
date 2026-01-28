/**
 * @task T014
 * @epic T001
 * @why Wayland-safe text delivery without X11 dependencies
 * @what Clipboard-based injection with paste tool integration
 */

// GJS-style imports
import Gio from 'gi://Gio?version=2.0';
import GLib from 'gi://GLib?version=2.0';

import { Clipboard } from './Clipboard.js';
import { Logger } from '../logging/Logger.js';

// Logger instance (imported or created)
const logger = new Logger({ component: 'text-injector' });

/**
 * Injection result indicating the method used
 * 
 * @task T014
 * @epic T001
 * @why Provide feedback on injection success/failure
 * @what Enum of possible injection outcomes
 */
export enum InjectionResult {
    SUCCESS_YDOTOOL = 'success_ydotool',
    SUCCESS_WTYPE = 'success_wtype',
    CLIPBOARD_ONLY = 'clipboard_only',
    FAILED = 'failed',
}

/**
 * Known terminal window class names for detection
 * Based on common terminal emulators on Linux
 * 
 * @task T014
 * @epic T001
 * @why Detect terminal apps for Ctrl+Shift+V paste
 * @what List of WM_CLASS values for terminal detection
 */
const TERMINAL_CLASSES: string[] = [
    'gnome-terminal',
    'gnome-terminal-server',
    'konsole',
    'xterm',
    'alacritty',
    'kitty',
    'terminator',
    'tilix',
    'xfce4-terminal',
    'lxterminal',
    'mate-terminal',
    'qterminal',
    'st',
    'foot',
    'wezterm',
    'rio',
    'blackbox',
    'ptyxis',
    'kgx', // GNOME Console
];

/**
 * Text injection manager for Wayland environments
 * Uses clipboard + paste simulation for text delivery
 * 
 * @task T014
 * @epic T001
 * @why Wayland-safe text injection without X11 dependencies
 * @what Orchestrates clipboard copy and paste keystroke simulation
 */
export class TextInjector {
    private clipboard: Clipboard;

    /**
     * @task T014
     * @epic T001
     * @why Initialize injector with clipboard manager
     * @what Creates clipboard instance for text operations
     */
    constructor() {
        this.clipboard = new Clipboard();
    }

    /**
     * Inject text into the currently focused application
     * Strategy: Copy to clipboard, then simulate paste keystroke
     * 
     * @task T014
     * @epic T001
     * @why Deliver transcribed text to target application
     * @what Copies text to clipboard and triggers paste via ydotool/wtype
     * @param {string} text - Text to inject
     * @returns {Promise<InjectionResult>} Result of injection attempt
     */
    async inject(text: string): Promise<InjectionResult> {
        try {
            // Step 1: Copy text to clipboard
            await this.clipboard.setText(text);

            // Step 2: Detect if target is a terminal
            const isTerminal = await this.detectTerminal();

            // Step 3: Try paste tools in order of preference
            const result = await this.simulatePaste(isTerminal);
            
            return result;
        } catch (e) {
            logger.error('Text injection failed', { error: (e as Error).message });
            return InjectionResult.FAILED;
        }
    }

    /**
     * Detect if the currently focused window is a terminal
     * Uses xdotool or similar to get active window class
     * 
     * @task T014
     * @epic T001
     * @why Terminal apps need Ctrl+Shift+V instead of Ctrl+V
     * @what Checks active window WM_CLASS against known terminal list
     * @returns {Promise<boolean>} True if active window is a terminal
     */
    private async detectTerminal(): Promise<boolean> {
        try {
            // Try to get active window class using xdotool
            // Note: xdotool requires XWayland but is commonly available
            const windowClass = await this.getActiveWindowClass();
            
            if (!windowClass) {
                return false;
            }

            const lowerClass = windowClass.toLowerCase();
            return TERMINAL_CLASSES.some(term => lowerClass.includes(term));
        } catch (e) {
            // If detection fails, assume non-terminal (safer default)
            return false;
        }
    }

    /**
     * Get the active window class using xdotool
     * Falls back gracefully if xdotool is unavailable
     * 
     * @task T014
     * @epic T001
     * @why Determine target application type
     * @what Spawns xdotool to get active window WM_CLASS
     * @returns {Promise<string | null>} Window class or null
     */
    private async getActiveWindowClass(): Promise<string | null> {
        return new Promise((resolve) => {
            try {
                const proc = Gio.Subprocess.new(
                    ['xdotool', 'getactivewindow', 'getwindowclassname'],
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
                );

                proc.communicate_utf8_async(null, null, (source: any, result: any) => {
                    try {
                        const [, stdout] = source.communicate_utf8_finish(result);
                        if (stdout) {
                            resolve(stdout.trim());
                        } else {
                            resolve(null);
                        }
                    } catch (e) {
                        resolve(null);
                    }
                });
            } catch (e) {
                // xdotool not available or failed
                resolve(null);
            }
        });
    }

    /**
     * Simulate paste keystroke using available tools
     * Tries ydotool first, then wtype, falls back to clipboard-only
     * 
     * @task T014
     * @epic T001
     * @why Trigger paste after copying to clipboard
     * @what Spawns paste tool with appropriate keystroke for context
     * @param {boolean} isTerminal - Whether target is a terminal
     * @returns {Promise<InjectionResult>} Result of paste simulation
     */
    private async simulatePaste(isTerminal: boolean): Promise<InjectionResult> {
        // Try ydotool first (preferred - uinput-based)
        const ydotoolResult = await this.tryYdotool(isTerminal);
        if (ydotoolResult) {
            return InjectionResult.SUCCESS_YDOTOOL;
        }

        // Fall back to wtype (Wayland native)
        const wtypeResult = await this.tryWtype(isTerminal);
        if (wtypeResult) {
            return InjectionResult.SUCCESS_WTYPE;
        }

        // No paste tool available - clipboard only (user must paste manually)
        return InjectionResult.CLIPBOARD_ONLY;
    }

    /**
     * Try to simulate paste using ydotool
     * 
     * @task T014
     * @epic T001
     * @why ydotool is preferred for Wayland (uinput-based)
     * @what Spawns ydotool with appropriate key combination
     * @param {boolean} isTerminal - Whether to use Ctrl+Shift+V
     * @returns {Promise<boolean>} True if ydotool succeeded
     */
    private async tryYdotool(isTerminal: boolean): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                const keys = isTerminal 
                    ? ['key', 'ctrl+shift+v']
                    : ['key', 'ctrl+v'];

                const proc = Gio.Subprocess.new(
                    ['ydotool', ...keys],
                    Gio.SubprocessFlags.NONE
                );

                proc.wait_async(null, (source: any, result: any) => {
                    try {
                        const success = source.wait_finish(result);
                        const exitCode = source.get_exit_status();
                        resolve(success && exitCode === 0);
                    } catch (e) {
                        resolve(false);
                    }
                });
            } catch (e) {
                // ydotool not available
                resolve(false);
            }
        });
    }

    /**
     * Try to simulate paste using wtype
     * 
     * @task T014
     * @epic T001
     * @why wtype is a Wayland-native alternative to ydotool
     * @what Spawns wtype with appropriate key combination
     * @param {boolean} isTerminal - Whether to use Ctrl+Shift+V
     * @returns {Promise<boolean>} True if wtype succeeded
     */
    private async tryWtype(isTerminal: boolean): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                const keys = isTerminal
                    ? ['-M', 'ctrl', '-M', 'shift', '-P', 'v', '-p', 'v', '-m', 'shift', '-m', 'ctrl']
                    : ['-M', 'ctrl', '-P', 'v', '-p', 'v', '-m', 'ctrl'];

                const proc = Gio.Subprocess.new(
                    ['wtype', ...keys],
                    Gio.SubprocessFlags.NONE
                );

                proc.wait_async(null, (source: any, result: any) => {
                    try {
                        const success = source.wait_finish(result);
                        const exitCode = source.get_exit_status();
                        resolve(success && exitCode === 0);
                    } catch (e) {
                        resolve(false);
                    }
                });
            } catch (e) {
                // wtype not available
                resolve(false);
            }
        });
    }

    /**
     * Check if ydotool is available on the system
     * 
     * @task T014
     * @epic T001
     * @why Allow callers to check tool availability
     * @what Spawns ydotool --version to check presence
     * @returns {Promise<boolean>} True if ydotool is available
     */
    async isYdotoolAvailable(): Promise<boolean> {
        return this.checkToolAvailable('ydotool');
    }

    /**
     * Check if wtype is available on the system
     * 
     * @task T014
     * @epic T001
     * @why Allow callers to check tool availability
     * @what Spawns wtype --version to check presence
     * @returns {Promise<boolean>} True if wtype is available
     */
    async isWtypeAvailable(): Promise<boolean> {
        return this.checkToolAvailable('wtype');
    }

    /**
     * Check if any paste tool is available
     * 
     * @task T014
     * @epic T001
     * @why Allow UI to warn if no automatic paste available
     * @what Checks for ydotool or wtype availability
     * @returns {Promise<boolean>} True if any paste tool is available
     */
    async isAnyPasteToolAvailable(): Promise<boolean> {
        const [ydotool, wtype] = await Promise.all([
            this.isYdotoolAvailable(),
            this.isWtypeAvailable(),
        ]);
        return ydotool || wtype;
    }

    /**
     * Generic tool availability checker
     * 
     * @task T014
     * @epic T001
     * @why Reusable tool presence check
     * @what Spawns tool with --version flag
     * @param {string} tool - Tool name to check
     * @returns {Promise<boolean>} True if tool is available
     */
    private async checkToolAvailable(tool: string): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                const proc = Gio.Subprocess.new(
                    [tool, '--version'],
                    Gio.SubprocessFlags.STDERR_SILENCE
                );

                proc.wait_async(null, (source: any, result: any) => {
                    try {
                        source.wait_finish(result);
                        const exitCode = source.get_exit_status();
                        resolve(exitCode === 0);
                    } catch (e) {
                        resolve(false);
                    }
                });
            } catch (e) {
                resolve(false);
            }
        });
    }
}