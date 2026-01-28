/**
 * @task T014
 * @epic T001
 * @why Wayland-safe text delivery without X11 dependencies
 * @what Injection module exports
 */

// Export Clipboard class
export { Clipboard } from './Clipboard';

// Export TextInjector class and related types
export { TextInjector, InjectionResult } from './TextInjector';
