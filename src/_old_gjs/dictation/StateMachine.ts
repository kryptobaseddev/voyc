/**
 * @task T015
 * @epic T001
 * @why Dictation state management with transition validation
 * @what State machine for dictation lifecycle with event emission
 */

// GJS-style imports
imports.gi.versions.GObject = '2.0';
imports.gi.versions.GLib = '2.0';

const { GObject, GLib } = imports.gi;

/**
 * Dictation states
 * IDLE → STARTING → LISTENING → PROCESSING → INJECTING → IDLE
 *              ↓ (silence/abort)      ↓ (error)
 *           STOPPING               ERROR → IDLE
 * 
 * @task T015
 * @epic T001
 * @why Clear state definitions for dictation lifecycle
 * @what Enumeration of all possible dictation states
 */
export type DictationState = 
  | 'idle' 
  | 'starting' 
  | 'listening' 
  | 'stopping' 
  | 'processing' 
  | 'injecting' 
  | 'error';

/**
 * State transition reasons
 * @task T015
 * @epic T001
 * @why Track why state transitions occurred
 * @what Reasons for state changes
 */
export type TransitionReason = 
  | 'user_toggle' 
  | 'hotkey' 
  | 'silence_detected' 
  | 'stt_complete' 
  | 'postprocess_complete' 
  | 'injection_complete' 
  | 'error' 
  | 'abort';

/**
 * State transition event
 * @task T015
 * @epic T001
 * @why Structured transition information
 * @what Data about a state transition
 */
export interface StateTransition {
  /** Previous state */
  from: DictationState;
  /** New state */
  to: DictationState;
  /** When the transition occurred (microseconds) */
  timestamp: number;
  /** Why the transition occurred */
  reason: TransitionReason;
  /** Optional error message if transition due to error */
  error?: string;
}

/**
 * Valid state transitions matrix
 * Defines which states can transition to which other states
 * @task T015
 * @epic T001
 * @why Prevent invalid state transitions
 * @what Maps valid transitions from each state
 */
const VALID_TRANSITIONS: Record<DictationState, DictationState[]> = {
  idle: ['starting', 'error'],
  starting: ['listening', 'idle', 'error'],
  listening: ['stopping', 'processing', 'idle', 'error'],
  stopping: ['processing', 'idle', 'error'],
  processing: ['injecting', 'idle', 'error'],
  injecting: ['idle', 'error'],
  error: ['idle'],
};

/**
 * State change callback type
 * @task T015
 * @epic T001
 * @why Type-safe state change handlers
 * @what Function signature for state change callbacks
 */
export type StateChangeCallback = (transition: StateTransition) => void;

/**
 * Dictation state machine
 * Manages dictation lifecycle with validated transitions
 * 
 * @task T015
 * @epic T001
 * @why Centralized state management for dictation flow
 * @what Validates transitions and emits state change events
 */
export class DictationStateMachine extends GObject.Object {
  private _currentState: DictationState = 'idle';
  private _stateHistory: StateTransition[] = [];
  private _maxHistorySize: number = 100;
  private _callbacks: StateChangeCallback[] = [];

  // Static GObject registration
  static {
    GObject.registerClass({
      GTypeName: 'DictationStateMachine',
      Signals: {
        'state-changed': {
          param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_STRING],
          return_type: GObject.TYPE_NONE,
        },
      },
    }, DictationStateMachine as any);
  }

  /**
   * Create a new state machine
   * 
   * @task T015
   * @epic T001
   * @why Initialize state machine in idle state
   * @what Creates state machine with default idle state
   */
  constructor() {
    super();
    this._currentState = 'idle';
  }

  /**
   * Get current state
   * 
   * @task T015
   * @epic T001
   * @why Access current dictation state
   * @what Returns the current state
   * @returns {DictationState} Current state
   */
  get currentState(): DictationState {
    return this._currentState;
  }

  /**
   * Check if in idle state
   * 
   * @task T015
   * @epic T001
   * @why Quick idle check
   * @what Returns true if idle
   * @returns {boolean} True if idle
   */
  isIdle(): boolean {
    return this._currentState === 'idle';
  }

  /**
   * Check if currently listening
   * 
   * @task T015
   * @epic T001
   * @why Quick listening check
   * @what Returns true if listening
   * @returns {boolean} True if listening
   */
  isListening(): boolean {
    return this._currentState === 'listening';
  }

  /**
   * Check if currently processing (STT or post-processing)
   * 
   * @task T015
   * @epic T001
   * @why Quick processing check
   * @what Returns true if processing or injecting
   * @returns {boolean} True if processing
   */
  isProcessing(): boolean {
    return this._currentState === 'processing' || this._currentState === 'injecting';
  }

  /**
   * Check if can start dictation
   * 
   * @task T015
   * @epic T001
   * @why Determine if start is allowed
   * @what Returns true if can transition to starting
   * @returns {boolean} True if can start
   */
  canStart(): boolean {
    return this._currentState === 'idle' || this._currentState === 'error';
  }

  /**
   * Check if can stop dictation
   * 
   * @task T015
   * @epic T001
   * @why Determine if stop is allowed
   * @what Returns true if currently listening
   * @returns {boolean} True if can stop
   */
  canStop(): boolean {
    return this._currentState === 'listening';
  }

  /**
   * Transition to a new state
   * Validates the transition and emits events
   * 
   * @task T015
   * @epic T001
   * @why State transition with validation
   * @what Validates and performs state transition
   * @param {DictationState} newState - State to transition to
   * @param {TransitionReason} reason - Reason for transition
   * @param {string} [error] - Optional error message
   * @returns {boolean} True if transition was successful
   */
  transition(newState: DictationState, reason: TransitionReason, error?: string): boolean {
    // Validate transition
    if (!this._isValidTransition(this._currentState, newState)) {
      logError(
        new Error(`Invalid state transition: ${this._currentState} -> ${newState}`),
        'StateMachine'
      );
      return false;
    }

    const fromState = this._currentState;
    const timestamp = GLib.get_monotonic_time();

    // Create transition record
    const transition: StateTransition = {
      from: fromState,
      to: newState,
      timestamp,
      reason,
      error,
    };

    // Update state
    this._currentState = newState;

    // Record in history
    this._stateHistory.push(transition);
    this._trimHistory();

    // Emit GObject signal
    this.emit('state-changed', fromState, newState, reason);

    // Notify callbacks
    this._notifyCallbacks(transition);

    log(`State transition: ${fromState} -> ${newState} (${reason})`);

    return true;
  }

  /**
   * Start dictation (idle -> starting)
   * 
   * @task T015
   * @epic T001
   * @why Convenience method for start transition
   * @what Transitions to starting state
   * @param {TransitionReason} [reason='user_toggle'] - Reason for starting
   * @returns {boolean} True if started successfully
   */
  start(reason: TransitionReason = 'user_toggle'): boolean {
    return this.transition('starting', reason);
  }

  /**
   * Mark capture started (starting -> listening)
   * 
   * @task T015
   * @epic T001
   * @why Convenience method for capture start
   * @what Transitions to listening state
   * @returns {boolean} True if transitioned successfully
   */
  markCaptureStarted(): boolean {
    return this.transition('listening', 'user_toggle');
  }

  /**
   * Stop listening (listening -> stopping)
   * 
   * @task T015
   * @epic T001
   * @why Convenience method for stop transition
   * @param {TransitionReason} [reason='user_toggle'] - Reason for stopping
   * @returns {boolean} True if stopped successfully
   */
  stop(reason: TransitionReason = 'user_toggle'): boolean {
    if (this._currentState === 'listening') {
      return this.transition('stopping', reason);
    }
    return false;
  }

  /**
   * Mark capture stopped, begin processing (listening/stopping -> processing)
   * 
   * @task T015
   * @epic T001
   * @why Convenience method for processing start
   * @param {TransitionReason} [reason='silence_detected'] - Reason for processing
   * @returns {boolean} True if transitioned successfully
   */
  markCaptureStopped(reason: TransitionReason = 'silence_detected'): boolean {
    if (this._currentState === 'listening' || this._currentState === 'stopping') {
      return this.transition('processing', reason);
    }
    return false;
  }

  /**
   * Mark STT complete, begin post-processing or injection (processing -> injecting)
   * 
   * @task T015
   * @epic T001
   * @why Convenience method for STT completion
   * @returns {boolean} True if transitioned successfully
   */
  markSttComplete(): boolean {
    if (this._currentState === 'processing') {
      return this.transition('injecting', 'stt_complete');
    }
    return false;
  }

  /**
   * Mark injection complete, return to idle (injecting -> idle)
   * 
   * @task T015
   * @epic T001
   * @why Convenience method for completion
   * @returns {boolean} True if transitioned successfully
   */
  markComplete(): boolean {
    if (this._currentState === 'injecting') {
      return this.transition('idle', 'injection_complete');
    }
    return false;
  }

  /**
   * Mark error state
   * 
   * @task T015
   * @epic T001
   * @why Convenience method for error transition
   * @param {string} errorMessage - Error message
   * @returns {boolean} True if transitioned successfully
   */
  markError(errorMessage: string): boolean {
    return this.transition('error', 'error', errorMessage);
  }

  /**
   * Reset to idle state
   * 
   * @task T015
   * @epic T001
   * @why Force reset to idle
   * @param {TransitionReason} [reason='abort'] - Reason for reset
   * @returns {boolean} True if reset successfully
   */
  reset(reason: TransitionReason = 'abort'): boolean {
    if (this._currentState !== 'idle') {
      return this.transition('idle', reason);
    }
    return true;
  }

  /**
   * Subscribe to state changes
   * 
   * @task T015
   * @epic T001
   * @why Allow external components to react to state changes
   * @param {StateChangeCallback} callback - Function to call on state change
   * @returns {() => void} Unsubscribe function
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this._callbacks.push(callback);
    return () => {
      const index = this._callbacks.indexOf(callback);
      if (index > -1) {
        this._callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get state history
   * 
   * @task T015
   * @epic T001
   * @why Access transition history for debugging
   * @returns {StateTransition[]} Copy of state history
   */
  getHistory(): StateTransition[] {
    return [...this._stateHistory];
  }

  /**
   * Get time in current state
   * 
   * @task T015
   * @epic T001
   * @why Track how long in current state
   * @returns {number} Microseconds in current state
   */
  getTimeInCurrentState(): number {
    const lastTransition = this._stateHistory[this._stateHistory.length - 1];
    if (!lastTransition) {
      return 0;
    }
    return GLib.get_monotonic_time() - lastTransition.timestamp;
  }

  /**
   * Check if a transition is valid
   * 
   * @task T015
   * @epic T001
   * @why Validate state transitions
   * @param {DictationState} from - Source state
   * @param {DictationState} to - Target state
   * @returns {boolean} True if transition is valid
   * @private
   */
  private _isValidTransition(from: DictationState, to: DictationState): boolean {
    const validTargets = VALID_TRANSITIONS[from];
    return validTargets.includes(to);
  }

  /**
   * Notify all callbacks of state change
   * 
   * @task T015
   * @epic T001
   * @why Broadcast state change to subscribers
   * @param {StateTransition} transition - Transition data
   * @private
   */
  private _notifyCallbacks(transition: StateTransition): void {
    for (const callback of this._callbacks) {
      try {
        callback(transition);
      } catch (e) {
        logError(e as Error, 'Error in state change callback');
      }
    }
  }

  /**
   * Trim history to max size
   * 
   * @task T015
   * @epic T001
   * @why Prevent unbounded memory growth
   * @private
   */
  private _trimHistory(): void {
    if (this._stateHistory.length > this._maxHistorySize) {
      this._stateHistory = this._stateHistory.slice(-this._maxHistorySize);
    }
  }

  /**
   * Dispose of the state machine
   * 
   * @task T015
   * @epic T001
   * @why Clean up resources
   */
  dispose(): void {
    this._callbacks = [];
    this._stateHistory = [];
  }
}

/**
 * Create a new state machine
 * 
 * @task T015
 * @epic T001
 * @why Factory function for state machine
 * @returns {DictationStateMachine} New state machine instance
 */
export function createStateMachine(): DictationStateMachine {
  return new DictationStateMachine();
}
