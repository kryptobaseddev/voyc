/**
 * @task T015
 * @epic T001
 * @why Dictation module exports
 * @what Public API for dictation orchestration
 */

// State machine exports
export {
  DictationStateMachine,
  createStateMachine,
  type DictationState,
  type TransitionReason,
  type StateTransition,
  type StateChangeCallback,
} from './StateMachine.js';

// Engine exports
export {
  DictationEngine,
  createDictationEngine,
  type DictationEngineConfig,
  type DictationResult,
} from './DictationEngine.js';
