# Voyc

Fast, minimal, GNOME-native voice dictation app for Linux Wayland.

## Build and Run

### Prerequisites

- Node.js 18+ and npm
- GJS (GNOME JavaScript bindings)
- GTK3 development libraries
- TypeScript

On Fedora:
```bash
sudo dnf install gjs gtk3-devel typescript
```

On Ubuntu/Debian:
```bash
sudo apt install gjs libgtk-3-dev typescript
```

### Installation

```bash
npm install
```

### Type Generation

Generate TypeScript bindings for GJS/GTK:

```bash
npm run generate:types
```

This generates type definitions under `./types/` for:
- Gtk-3.0 (or Gtk-4.0 if available)
- Gio-2.0
- GLib-2.0
- GObject-2.0

### Build

Compile TypeScript to GJS-compatible JavaScript:

```bash
npm run build
```

Output is written to `dist/main.js`.

### Development

Build and run in one command:

```bash
npm run dev
```

Or manually:

```bash
npm run build
gjs dist/main.js
```

### Clean

Remove build artifacts:

```bash
npm run clean
```

## Project Structure

```
voyc/
├── src/
│   └── main.ts          # Application entry point
├── scripts/
│   └── build.js         # Build script
├── types/               # Generated GJS type bindings
├── dist/                # Compiled output
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

## Tech Stack

- **GJS**: GNOME JavaScript runtime
- **GTK3**: UI toolkit (GTK4 when available)
- **TypeScript**: Type-safe JavaScript
- **ts-for-gir**: TypeScript bindings generator

## License

MIT
