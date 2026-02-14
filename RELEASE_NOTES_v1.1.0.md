# Voyc v1.1.0 Release Notes

🎉 **In-App Dictation is here!** 🎉

## What's New

### ✨ New Feature: In-App Dictation

We've added a brand new "In-App Dictation" mode that provides a reliable text editor interface for voice dictation. This is perfect for Linux systems (especially Fedora/Wayland) where system-wide hotkeys may not work properly.

**Features:**

- **Large Text Editor**: See and edit your transcribed text in real-time
- **Manual Controls**: Record/Stop buttons for full control
- **History Sidebar**: Access previous transcriptions (last 50 saved)
- **Word & Character Count**: Track how much you've dictated
- **One-Click Copy**: Copy all text to clipboard instantly
- **Persistent Editing**: Edit your text before copying

**How to use:**

1. Open Voyc and click "In-App Dictation" in the left sidebar
2. Click the red **Record** button
3. Speak clearly into your microphone
4. Click **Stop & Transcribe** when finished
5. Edit your text if needed, then click **Copy All**
6. Paste (Ctrl+V) your text wherever you need it!

### 🔧 Why In-App Dictation?

Many Linux distributions, particularly Fedora with Wayland, have limitations with system-wide hotkeys and text injection. The In-App Dictation mode bypasses these issues entirely by keeping everything within the application window.

### 🐛 Bug Fixes

- Fixed various UI consistency issues
- Improved error handling for transcription failures

### 📦 Installation

#### Quick Install (One Command)

```bash
curl -fsSL https://raw.githubusercontent.com/kryptobaseddev/voyc/main/install.sh | bash
```

#### Manual Install

**Debian/Ubuntu:**

```bash
wget https://github.com/kryptobaseddev/voyc/releases/download/v1.1.0/Voyc_1.1.0_amd64.deb
sudo dpkg -i Voyc_1.1.0_amd64.deb
```

**Fedora/RHEL:**

```bash
wget https://github.com/kryptobaseddev/voyc/releases/download/v1.1.0/Voyc-1.1.0-1.x86_64.rpm
sudo dnf install Voyc-1.1.0-1.x86_64.rpm
```

**AppImage (Universal):**

```bash
wget https://github.com/kryptobaseddev/voyc/releases/download/v1.1.0/Voyc_1.1.0_amd64.AppImage
chmod +x Voyc_1.1.0_amd64.AppImage
./Voyc_1.1.0_amd64.AppImage
```

### 🔄 Upgrading

The new version includes automatic update checking. You'll be notified when new versions are available.

### 📝 System Requirements

- Linux (x86_64)
- Microphone access
- ~50MB disk space

### 🤝 Contributing

Found a bug or have a feature request?

- Open an issue: https://github.com/kryptobaseddev/voyc/issues
- Join discussions: https://github.com/kryptobaseddev/voyc/discussions

### 🙏 Credits

Thanks to all the users who reported issues with hotkeys on various Linux distributions. Your feedback led to the creation of the In-App Dictation feature!

---

**Full Changelog**: https://github.com/kryptobaseddev/voyc/compare/v1.0.2...v1.1.0
