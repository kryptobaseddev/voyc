/**
 * @task T014
 * @epic T001
 * @why Wayland-safe text delivery without X11 dependencies
 * @what GTK4 clipboard utilities for text copying
 */

import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import GLib from 'gi://GLib?version=2.0';

/**
 * Clipboard manager for GTK4 applications
 * Provides Wayland-safe text copying using Gdk.Clipboard
 * 
 * @task T014
 * @epic T001
 * @why Abstract clipboard operations for text injection workflow
 * @what GTK4 clipboard wrapper with async text setting
 */
export class Clipboard {
    private clipboard: any; // Gdk.Clipboard

    /**
     * @task T014
     * @epic T001
     * @why Initialize clipboard with default display
     * @what Get the default clipboard for the primary display
     */
    constructor() {
        const display = Gdk.Display.get_default();
        if (!display) {
            throw new Error('No default display available');
        }
        this.clipboard = display.get_clipboard();
    }

    /**
     * Copy text to the clipboard
     * 
     * @task T014
     * @epic T001
     * @why Store transcribed text for paste injection
     * @what Sets clipboard content to the provided text
     * @param {string} text - Text to copy to clipboard
     * @returns {Promise<void>} Resolves when text is copied
     */
    async setText(text: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.clipboard.set_text(text);
                // GTK4 set_text is synchronous, but we wrap in Promise
                // for API consistency and future-proofing
                resolve();
            } catch (e) {
                reject(new Error(`Failed to set clipboard text: ${e}`));
            }
        });
    }

    /**
     * Get text from the clipboard
     * 
     * @task T014
     * @epic T001
     * @why Read clipboard content when needed
     * @what Retrieves text content from clipboard asynchronously
     * @returns {Promise<string | null>} Clipboard text or null if not available
     */
    async getText(): Promise<string | null> {
        return new Promise((resolve, reject) => {
            try {
                this.clipboard.read_text_async(null, (source: any, result: any) => {
                    try {
                        const text = source.read_text_finish(result);
                        resolve(text);
                    } catch (e) {
                        reject(new Error(`Failed to read clipboard text: ${e}`));
                    }
                });
            } catch (e) {
                reject(new Error(`Failed to start clipboard read: ${e}`));
            }
        });
    }
}