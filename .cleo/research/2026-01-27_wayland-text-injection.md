# Wayland-Safe Text Injection Research

**Date**: 2026-01-27  
**Task**: T014 - Wayland-safe text injection  
**Epic**: T001 - Build application from claudedocs/prd.md

## Overview

This document summarizes the implementation of Wayland-safe text injection for the Voyc voice dictation application. The approach uses clipboard-based delivery with paste keystroke simulation, avoiding X11-only dependencies.

## Injection Strategy

The implemented solution follows a three-step process:

1. **Copy text to clipboard** - Uses GTK4's `Gdk.Clipboard` for Wayland-native clipboard access
2. **Detect target context** - Identifies if the active window is a terminal application
3. **Simulate paste keystroke** - Uses available tools (ydotool or wtype) to trigger paste

## Terminal Detection

Terminal applications require `Ctrl+Shift+V` for paste instead of `Ctrl+V`. The implementation detects terminals by checking the active window's WM_CLASS against a curated list of known terminal emulators:

- gnome-terminal, gnome-terminal-server
- konsole, xterm
- alacritty, kitty
- terminator, tilix
- xfce4-terminal, lxterminal, mate-terminal
- qterminal, st, foot, wezterm
- rio, blackbox, ptyxis, kgx (GNOME Console)

Detection uses `xdotool getactivewindow getwindowclassname` when available, falling back to non-terminal detection on failure.

## Paste Tools

### ydotool (Preferred)

- **Why preferred**: Uses uinput, works on both X11 and Wayland
- **Command**: `ydotool key ctrl+v` or `ydotool key ctrl+shift+v`
- **Availability**: Requires ydotool daemon (ydotoold) running

### wtype (Fallback)

- **Why fallback**: Wayland-native, but less widely available
- **Command**: `wtype -M ctrl -P v -p v -m ctrl` (complex key sequence)
- **Availability**: Native Wayland compositor support required

### Clipboard-Only (Graceful Degradation)

If no paste tool is available, text is still copied to the clipboard. The user must manually paste, but the transcription workflow is not broken.

## Implementation Files

### src/inject/Clipboard.ts

GTK4 clipboard wrapper providing:
- `setText(text: string): Promise<void>` - Copy text to clipboard
- `getText(): Promise<string | null>` - Read text from clipboard

Uses `Gdk.Display.get_default().get_clipboard()` for Wayland compatibility.

### src/inject/TextInjector.ts

Main injection orchestrator providing:
- `inject(text: string): Promise<InjectionResult>` - Full injection workflow
- `isYdotoolAvailable(): Promise<boolean>` - Check ydotool presence
- `isWtypeAvailable(): Promise<boolean>` - Check wtype presence
- `isAnyPasteToolAvailable(): Promise<boolean>` - Check any tool availability

Returns `InjectionResult` enum indicating the method used:
- `SUCCESS_YDOTOOL` - Paste simulated via ydotool
- `SUCCESS_WTYPE` - Paste simulated via wtype
- `CLIPBOARD_ONLY` - Text copied, no paste tool available
- `FAILED` - Injection failed

### src/inject/index.ts

Module exports for clean imports:
- `Clipboard`
- `TextInjector`
- `InjectionResult`

## Wayland Compliance

The implementation satisfies constraint **CON-003** from the specification:

> Injection MUST be Wayland-safe and MUST NOT depend on X11-only tools.

- Clipboard uses GTK4's native Wayland clipboard
- ydotool uses uinput (kernel-level, not X11)
- wtype is Wayland-native
- xdotool is only used for window class detection (optional, graceful fallback)

## Usage Example

```typescript
import { TextInjector, InjectionResult } from './inject';

const injector = new TextInjector();

// Check if automatic paste is available
const canAutoPaste = await injector.isAnyPasteToolAvailable();

// Inject transcribed text
const result = await injector.inject('Hello, world!');

switch (result) {
    case InjectionResult.SUCCESS_YDOTOOL:
    case InjectionResult.SUCCESS_WTYPE:
        console.log('Text injected successfully');
        break;
    case InjectionResult.CLIPBOARD_ONLY:
        console.log('Text copied - please paste manually');
        break;
    case InjectionResult.FAILED:
        console.error('Injection failed');
        break;
}
```

## Future Improvements

1. **Portal-based injection**: Investigate `org.freedesktop.portal.RemoteDesktop` for future Wayland-native injection without external tools
2. **Per-app profiles**: Allow users to define custom paste shortcuts for specific applications
3. **Manual terminal override**: Hotkey to force terminal-style paste (Ctrl+Shift+V)

## References

- PRD Section 4.6: Text Injection
- Spec: REQ-014, CON-003
- GTK4 Clipboard: https://docs.gtk.org/gdk4/class.Clipboard.html
- ydotool: https://github.com/ReimuNotMoe/ydotool
- wtype: https://github.com/atx/wtype
