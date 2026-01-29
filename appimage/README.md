# Voyc AppImage Build

This directory contains resources for building Voyc as an AppImage.

## Prerequisites

Install appimage-builder:

```bash
pip install appimage-builder
```

## Building

From the project root:

```bash
# Install dependencies first
npm install

# Build the AppImage
appimage-builder --recipe AppImageBuilder.yml
```

The output will be `Voyc-1.0.0-x86_64.AppImage` in the project root.

## Files

- `com.voyc.app.desktop` - Desktop entry for AppImage integration
- `voyc.svg` - Scalable vector icon (GNOME-style)
- `voyc-256.png` - Optional 256x256 PNG icon (generate from SVG if needed)

## Generating PNG Icon

If you need a PNG icon:

```bash
# Using Inkscape
inkscape -w 256 -h 256 voyc.svg -o voyc-256.png

# Using ImageMagick
convert -density 256 -background none voyc.svg -resize 256x256 voyc-256.png

# Using rsvg-convert
rsvg-convert -w 256 -h 256 voyc.svg > voyc-256.png
```

## Testing

```bash
# Make executable
chmod +x Voyc-1.0.0-x86_64.AppImage

# Run
./Voyc-1.0.0-x86_64.AppImage
```

## Troubleshooting

### Missing typelibs
If GObject introspection fails, ensure the GI_TYPELIB_PATH includes the AppDir paths.

### Audio not working
The AppImage bundles PipeWire and GStreamer plugins. Ensure your system has PipeWire or PulseAudio running.

### Wayland issues
The app defaults to Wayland but falls back to X11. Set `GDK_BACKEND=x11` to force X11 mode.
