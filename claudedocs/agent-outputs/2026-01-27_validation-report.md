# Validation Report: Voice Dictation App

## Summary

- **Status**: FAIL
- **Compliance**: 60%
- **Critical Issues**: 1

## Checklist Results

| Check | Status | Details |
|-------|--------|---------|
| **Architecture: GTK Version** | **FAIL** | Conflicting GTK versions (3.0 vs 4.0) detected in source code. |
| **Architecture: Wayland Safety** | PASS | Injection uses `ydotool` and clipboard (Wayland-safe). |
| **Config Schema** | PASS | Schema supports all required providers and latency thresholds. |
| **Module: Audio** | PASS | PipeWire capture implemented. |
| **Module: STT** | PASS | ElevenLabs and OpenAI providers implemented. |
| **Module: Post-Processing** | PASS | Baseten provider implemented with `Soup 3.0`. |
| **Module: Orchestration** | **FAIL** | `main.ts` is a "Hello World" placeholder; no wiring of components. |

## Issues Found

### Critical
1.  **GTK Version Conflict**:
    -   `src/main.ts` imports `Gtk = '3.0'`.
    -   `src/ui/SettingsWindow.ts` imports `Gtk = '3.0'`.
    -   `src/inject/Clipboard.ts` imports `Gtk = '4.0'`.
    -   `package.json` depends on `@girs/gtk-3.0`.
    -   **Impact**: Application will likely crash or fail to load due to conflicting GObject Introspection namespaces. Spec mandates GTK 4.

### Warnings
1.  **Soup Version Compatibility**: `BasetenProvider.ts` uses `Soup 3.0`. While correct for modern apps, ensure it aligns with the chosen GTK version (GTK 3 usually pairs with Soup 2.4, GTK 4 with Soup 3.0).
2.  **Task Status Sync**: Task T013 is marked "pending" in `todo.json`, but `src/postprocess/BasetenProvider.ts` is fully implemented.

### Suggestions
1.  **Unified GTK 4 Migration**: Update `main.ts` and `ui/` components to use GTK 4.0 to match the Spec and `Clipboard.ts`. Update `package.json` to use `@girs/gtk-4.0`.

## Remediation

1.  **Update `package.json`**: Remove `@girs/gtk-3.0`, add `@girs/gtk-4.0`.
2.  **Refactor UI**: Update `SettingsWindow.ts`, `TrayIndicator.ts`, and `main.ts` to use GTK 4 APIs (e.g., `Gtk.ApplicationWindow` constructor changes, `Gtk.Box` instead of `Gtk.VBox`, `set_child` instead of `add`).
3.  **Implement Orchestrator**: Rewrite `main.ts` to initialize `ConfigManager`, `AudioCapture`, `SttProvider`, `PostProcessor`, and `HotkeyManager` and wire them together.
