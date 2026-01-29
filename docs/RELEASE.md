# Voyc Release Process

This document describes how to create releases for Voyc with automatic update support.

## Overview

Voyc uses Tauri's built-in updater system with Ed25519 signatures for secure auto-updates. When you create a release:

1. GitHub Actions builds the application for Linux
2. The build is signed with a private key
3. A `latest.json` manifest is generated with version info and signatures
4. Users' installed apps check this manifest and download updates automatically

## Prerequisites

Before your first release, you must:

1. Generate a signing key pair
2. Configure GitHub Secrets
3. Update the public key in `tauri.conf.json` (already done)

## Step 1: Generate Signing Key

The signing key is used to sign update packages so the app can verify their authenticity.

### Generate the Key

Run this command in the project directory:

```bash
cd /mnt/projects/voyc
bun tauri signer generate -w ~/.tauri/voyc.key
```

You will be prompted to enter a password. **Save this password securely** - you'll need it for GitHub Secrets.

This creates two files:
- `~/.tauri/voyc.key` - Private key (keep this secret)
- `~/.tauri/voyc.key.pub` - Public key (this goes in tauri.conf.json)

### View the Public Key

```bash
cat ~/.tauri/voyc.key.pub
```

The output should match the `pubkey` in `src-tauri/tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEUwMTkyQjlBNzYwMjAwQkIKUldTN0FBSjJtaXNaNENaRlRZbUxtUHdIWS82WWZ0Nk1kTnJHL1VkcUtDaUJvUnVqVER4bjh4T0sK",
      "endpoints": [
        "https://github.com/kryptobaseddev/voyc/releases/latest/download/latest.json"
      ]
    }
  }
}
```

If you generate a new key, update this `pubkey` value with your new public key.

## Step 2: Configure GitHub Secrets

Go to your repository on GitHub: **Settings > Secrets and variables > Actions**

Add these two secrets:

### TAURI_SIGNING_PRIVATE_KEY

The contents of your private key file:

```bash
cat ~/.tauri/voyc.key
```

Copy the entire output (including the `-----BEGIN...` and `-----END...` lines) and paste it as the secret value.

### TAURI_SIGNING_PRIVATE_KEY_PASSWORD

The password you entered when generating the key.

## Step 3: Create a Release

### Option A: Tag Push (Recommended)

Create and push a version tag:

```bash
# Update version numbers in package.json, Cargo.toml, and tauri.conf.json
bun run version:patch  # or version:minor, version:major

# Commit the version bump
git add -A
git commit -m "chore: bump version to X.Y.Z"

# Create and push the tag
git tag v1.0.1
git push origin main --tags
```

The workflow triggers automatically when a `v*` tag is pushed.

### Option B: Manual Workflow Dispatch

1. Go to **Actions** tab in GitHub
2. Select **Release** workflow
3. Click **Run workflow**
4. Optionally check "Create as draft release" for review before publishing

## What Gets Built

The release workflow builds:

| Artifact | Format | Description |
|----------|--------|-------------|
| `voyc_X.Y.Z_amd64.deb` | Debian package | For Debian, Ubuntu, and derivatives |
| `voyc_X.Y.Z_amd64.AppImage` | AppImage | Portable, runs on most Linux distros |
| `voyc_X.Y.Z_amd64.AppImage.tar.gz` | Compressed AppImage | For auto-updater |
| `latest.json` | JSON manifest | Auto-update metadata with signatures |

## How Auto-Updates Work

### Update Check Flow

1. User launches Voyc
2. App fetches `latest.json` from the endpoint URL
3. App compares `version` in manifest with installed version
4. If newer, app notifies user
5. User approves update
6. App downloads the `.tar.gz` artifact
7. App verifies the Ed25519 signature
8. App extracts and replaces the binary
9. App restarts

### The latest.json File

Example structure:

```json
{
  "version": "1.0.1",
  "notes": "Release notes here",
  "pub_date": "2026-01-29T12:00:00Z",
  "platforms": {
    "linux-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6...",
      "url": "https://github.com/kryptobaseddev/voyc/releases/download/v1.0.1/voyc_1.0.1_amd64.AppImage.tar.gz"
    }
  }
}
```

### Update Endpoint

The app checks this URL for updates:

```
https://github.com/kryptobaseddev/voyc/releases/latest/download/latest.json
```

Using `/latest/download/` ensures it always fetches from the most recent release.

## Troubleshooting

### "Signature verification failed"

- Ensure `TAURI_SIGNING_PRIVATE_KEY` secret matches the key that generated the public key in `tauri.conf.json`
- Regenerate the key pair and update both the secret and the config

### "latest.json not found"

- Check that the workflow completed successfully
- Verify `TAURI_SIGNING_PRIVATE_KEY` secret is set
- Without the signing key, `latest.json` is not generated

### Build Fails

1. Check the Actions log for specific errors
2. Ensure all dependencies are available
3. Verify Rust toolchain is compatible

### Update Not Detected

- Ensure version in `tauri.conf.json` is lower than the release version
- Check that the update endpoint URL is correct
- Verify the app has network access

## Security Considerations

1. **Never commit the private key** - Always use GitHub Secrets
2. **Use a strong password** - The key password protects against key theft
3. **Backup your key** - Losing it means users can't verify updates from you
4. **Rotate keys if compromised** - Generate new key, update config and secrets

## Version Management

Voyc uses semantic versioning (MAJOR.MINOR.PATCH):

- **PATCH** (1.0.0 -> 1.0.1): Bug fixes, minor improvements
- **MINOR** (1.0.0 -> 1.1.0): New features, backward compatible
- **MAJOR** (1.0.0 -> 2.0.0): Breaking changes

Update these files when bumping version:
- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

Or use the helper scripts:

```bash
bun run version:patch
bun run version:minor
bun run version:major
```

## Pre-release Versions

Tags containing `-alpha`, `-beta`, or `-rc` are marked as pre-releases:

```bash
git tag v1.1.0-beta.1
git push origin --tags
```

Pre-releases are visible on GitHub but not served via the `/latest/` endpoint, so stable users won't receive them automatically.
