/**
 * @task T010
 * @epic T001
 * @why Manage tray icon states for visual feedback
 * @what Icon state management with icon name resolution
 */

/**
 * Tray icon states
 * @task T010
 * @epic T001
 * @why Visual feedback for dictation state
 * @what Enumeration of possible tray icon states
 */
export type TrayState = 'idle' | 'listening' | 'processing' | 'error';

/**
 * Icon names for each state (using standard GNOME icon names)
 * @task T010
 * @epic T001
 * @why Consistent icon theming
 * @what Maps states to icon names
 */
const STATE_ICONS: Record<TrayState, string> = {
    idle: 'audio-input-microphone-symbolic',
    listening: 'media-record-symbolic',
    processing: 'emblem-synchronizing-symbolic',
    error: 'dialog-error-symbolic',
};

/**
 * Tooltip text for each state
 * @task T010
 * @epic T001
 * @why Informative hover text
 * @what Maps states to tooltip messages
 */
const STATE_TOOLTIPS: Record<TrayState, string> = {
    idle: 'Voyc - Ready (Click to dictate)',
    listening: 'Voyc - Listening... (Click to stop)',
    processing: 'Voyc - Processing speech...',
    error: 'Voyc - Error occurred (Click for details)',
};

/**
 * StatusIcon class manages tray icon state
 * Provides icon names and tooltips based on current state
 * 
 * @task T010
 * @epic T001
 * @why Centralized icon state management
 * @what Tracks state and provides icon resources
 */
export class StatusIcon {
    private _state: TrayState = 'idle';
    private _stateChangeCallbacks: Array<(state: TrayState) => void> = [];

    /**
     * Create a new StatusIcon instance
     * 
     * @task T010
     * @epic T001
     * @why Initialize with default idle state
     * @what Sets up initial state
     */
    constructor() {
        this._state = 'idle';
    }

    /**
     * Get current state
     * 
     * @task T010
     * @epic T001
     * @why Read current icon state
     * @what Returns current tray state
     * @returns {TrayState} Current state
     */
    get state(): TrayState {
        return this._state;
    }

    /**
     * Set current state and notify listeners
     * 
     * @task T010
     * @epic T001
     * @why Update visual state
     * @what Sets new state and emits change notification
     * @param {TrayState} state - New state to set
     */
    setState(state: TrayState): void {
        if (this._state !== state) {
            this._state = state;
            this._notifyStateChange();
        }
    }

    /**
     * Get icon name for current state
     * 
     * @task T010
     * @epic T001
     * @why Retrieve themed icon name
     * @what Returns icon name for current or specified state
     * @param {TrayState} [state] - Optional state override
     * @returns {string} Icon name
     */
    getIconName(state?: TrayState): string {
        return STATE_ICONS[state || this._state];
    }

    /**
     * Get tooltip text for current state
     * 
     * @task T010
     * @epic T001
     * @why Retrieve tooltip message
     * @what Returns tooltip for current or specified state
     * @param {TrayState} [state] - Optional state override
     * @returns {string} Tooltip text
     */
    getTooltip(state?: TrayState): string {
        return STATE_TOOLTIPS[state || this._state];
    }

    /**
     * Check if currently listening
     * 
     * @task T010
     * @epic T001
     * @why Quick state check for UI
     * @what Returns true if in listening state
     * @returns {boolean} True if listening
     */
    isListening(): boolean {
        return this._state === 'listening';
    }

    /**
     * Check if currently processing
     * 
     * @task T010
     * @epic T001
     * @why Quick state check for UI
     * @what Returns true if in processing state
     * @returns {boolean} True if processing
     */
    isProcessing(): boolean {
        return this._state === 'processing';
    }

    /**
     * Check if in error state
     * 
     * @task T010
     * @epic T001
     * @why Quick state check for UI
     * @what Returns true if in error state
     * @returns {boolean} True if error
     */
    isError(): boolean {
        return this._state === 'error';
    }

    /**
     * Subscribe to state changes
     * 
     * @task T010
     * @epic T001
     * @why Allow external components to react to state changes
     * @what Registers callback for state change events
     * @param {(state: TrayState) => void} callback - Function to call on change
     * @returns {() => void} Unsubscribe function
     */
    onStateChange(callback: (state: TrayState) => void): () => void {
        this._stateChangeCallbacks.push(callback);
        return () => {
            const index = this._stateChangeCallbacks.indexOf(callback);
            if (index > -1) {
                this._stateChangeCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * Notify all listeners of state change
     * 
     * @task T010
     * @epic T001
     * @why Broadcast state change
     * @what Calls all registered callbacks
     * @private
     */
    private _notifyStateChange(): void {
        for (const callback of this._stateChangeCallbacks) {
            try {
                callback(this._state);
            } catch (e) {
                logError(e as Error, 'Error in state change callback');
            }
        }
    }
}
