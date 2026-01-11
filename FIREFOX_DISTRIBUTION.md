# Firefox Extension Distribution Guide

This guide covers distributing the Overtime Take-Home Calculator extension for Firefox using Mozilla's **unlisted self-distribution** method.

## Overview

With unlisted distribution:
- Mozilla **signs** the extension (no security warnings for users)
- Extension is **not listed** in Firefox Add-ons store (not publicly searchable)
- You distribute the `.xpi` file internally
- Auto-updates work via self-hosted `updates.json`

## Prerequisites

1. A Mozilla Add-ons developer account: https://addons.mozilla.org/developers/
2. A web server to host `updates.json` and `.xpi` files (must be HTTPS)
3. The `web-ext` CLI tool (optional but recommended)

```bash
npm install -g web-ext
```

## Step 1: Configure the Extension ID and Update URL

Before building, update `manifest-firefox.json`:

```json
"browser_specific_settings": {
  "gecko": {
    "id": "overtidskassa@bekk.no",
    "update_url": "https://YOUR-SERVER.com/extensions/overtidskassa/updates.json"
  }
}
```

**Important:**
- The extension ID (`overtidskassa@bekk.no`) must remain constant across versions
- Change `update_url` to your actual hosting location

## Step 2: Build the Firefox Extension Package

Create a `.zip` file containing only the necessary files:

```bash
# From the repository root
zip -r overtidskassa-firefox.zip \
  manifest-firefox.json \
  content/ \
  lib/ \
  popup/ \
  icons/ \
  -x "*.DS_Store" -x "*/.git/*"

# Rename manifest for the package
cd /tmp && unzip /path/to/overtidskassa-firefox.zip
mv manifest-firefox.json manifest.json
zip -r overtidskassa-firefox-final.zip .
```

Or use the build script (if added):
```bash
npm run build:firefox
```

## Step 3: Submit for Signing (Unlisted)

### Option A: Web Interface

1. Go to https://addons.mozilla.org/developers/
2. Click "Submit a New Add-on"
3. Select **"On your own"** (self-distribution)
4. Upload the `.zip` file
5. Fill in version notes
6. Submit and wait for automatic signing (usually < 5 minutes)
7. Download the signed `.xpi` file

### Option B: Command Line (web-ext)

```bash
# Set up API credentials from https://addons.mozilla.org/developers/addon/api/key/
export WEB_EXT_API_KEY="your-api-key"
export WEB_EXT_API_SECRET="your-api-secret"

# Sign the extension (unlisted)
web-ext sign --channel=unlisted --source-dir=./build-firefox
```

The signed `.xpi` will be saved to `./web-ext-artifacts/`.

## Step 4: Host the Signed Extension

Upload to your web server:
```
https://your-server.com/extensions/overtidskassa/
├── updates.json
└── overtidskassa-1.0.0.xpi
```

**Server requirements:**
- Must serve over HTTPS
- `.xpi` files must have `Content-Type: application/x-xpinstall`
- CORS headers may be needed depending on setup

## Step 5: Update `updates.json`

Edit `updates.json` to point to the actual download URL:

```json
{
  "addons": {
    "overtidskassa@bekk.no": {
      "updates": [
        {
          "version": "1.0.0",
          "update_link": "https://your-server.com/extensions/overtidskassa/overtidskassa-1.0.0.xpi",
          "browser_specific_settings": {
            "gecko": {
              "strict_min_version": "109.0"
            }
          }
        }
      ]
    }
  }
}
```

Upload `updates.json` to the URL specified in `manifest-firefox.json`.

## Step 6: Distribute to Users

Share the `.xpi` download link with employees. Users can install by:

1. Clicking the `.xpi` link directly (Firefox will prompt to install)
2. Or: Firefox Menu → Add-ons → ⚙️ → Install Add-on From File

## Releasing Updates

When releasing a new version:

### 1. Update version numbers

In `manifest-firefox.json`:
```json
"version": "1.1.0"
```

### 2. Build and sign the new version

Follow Steps 2-3 above.

### 3. Update `updates.json`

Add the new version to the updates array:

```json
{
  "addons": {
    "overtidskassa@bekk.no": {
      "updates": [
        {
          "version": "1.1.0",
          "update_link": "https://your-server.com/extensions/overtidskassa/overtidskassa-1.1.0.xpi",
          "browser_specific_settings": {
            "gecko": {
              "strict_min_version": "109.0"
            }
          }
        },
        {
          "version": "1.0.0",
          "update_link": "https://your-server.com/extensions/overtidskassa/overtidskassa-1.0.0.xpi",
          "browser_specific_settings": {
            "gecko": {
              "strict_min_version": "109.0"
            }
          }
        }
      ]
    }
  }
}
```

### 4. Upload files

- Upload the new signed `.xpi`
- Upload the updated `updates.json`

### 5. Users receive update automatically

Firefox checks `update_url` periodically (typically every 24 hours, or on browser restart). Users will be prompted to update automatically.

## Automated Releases with GitHub Actions

Instead of manually signing each release, you can automate the process using GitHub Actions.

### Setup

1. **Get Mozilla API credentials**
   - Go to https://addons.mozilla.org/developers/addon/api/key/
   - Generate new credentials
   - Note your **JWT issuer** (API key) and **JWT secret**

2. **Add secrets to GitHub repository**
   - Go to your repo → Settings → Secrets and variables → Actions
   - Add two secrets:
     - `AMO_SIGN_KEY`: Your JWT issuer
     - `AMO_SIGN_SECRET`: Your JWT secret

3. **The workflow is ready**
   - See `.github/workflows/publish-firefox.yml`

### Usage

**Option A: Release-triggered (recommended)**

1. Update version in `manifest-firefox.json`
2. Commit and push
3. Create a GitHub Release with tag matching the version (e.g., `v1.1.0` or `1.1.0`)
4. The workflow automatically:
   - Builds the extension
   - Signs it with Mozilla (unlisted)
   - Attaches the signed `.xpi` to the release

**Option B: Manual trigger**

1. Go to Actions → "Publish Firefox Extension"
2. Click "Run workflow"
3. Enter the version number
4. Download the signed `.xpi` from workflow artifacts

### After the Workflow Completes

The signed `.xpi` is attached to the GitHub Release. You still need to:

1. Download the signed `.xpi` from the release
2. Upload it to your hosting server
3. Update `updates.json` with the new version
4. Upload the updated `updates.json`

### Fully Automated Hosting (Advanced)

To fully automate hosting, you could extend the workflow to:
- Upload `.xpi` to your server via SSH/SCP
- Update `updates.json` automatically
- Deploy to a static hosting service (GitHub Pages, Cloudflare Pages, etc.)

Example addition to the workflow:
```yaml
- name: Deploy to server
  run: |
    scp ${{ steps.web-ext-sign.outputs.target }} user@server:/var/www/extensions/
    # Update updates.json on server
```

## Troubleshooting

### "This add-on could not be installed because it has not been verified"
- The `.xpi` must be signed by Mozilla. Unsigned packages won't install on release Firefox.
- Re-submit for signing via addons.mozilla.org

### Updates not being detected
- Verify `updates.json` is accessible at the URL in `manifest-firefox.json`
- Check that the version number in `updates.json` is higher than installed version
- Users can force an update check: `about:addons` → ⚙️ → "Check for Updates"

### CORS errors
If hosting on a different domain, you may need:
```
Access-Control-Allow-Origin: *
```

## File Checklist

| File | Purpose |
|------|---------|
| `manifest-firefox.json` | Firefox manifest v2 with gecko settings |
| `updates.json` | Self-hosted update manifest |
| `overtidskassa-X.Y.Z.xpi` | Signed extension package (from Mozilla) |

## Annual Maintenance

Each year when tax rates change:
1. Update `lib/tax-rates.js` with new rates
2. Bump version in `manifest-firefox.json`
3. Sign and release as described above

## References

- [Simplify Browser Extension Deployment with GitHub Actions](https://dev.to/jellyfith/simplify-browser-extension-deployment-with-github-actions-37ob) - Overview of automated extension publishing
- [kewisch/action-web-ext](https://github.com/kewisch/action-web-ext) - GitHub Action for building and signing Firefox extensions
- [Mozilla Add-ons API Keys](https://addons.mozilla.org/developers/addon/api/key/) - Generate API credentials for signing
- [aklinker1/publish-browser-extension](https://github.com/aklinker1/publish-browser-extension) - Multi-browser publishing tool
- [Firefox Extension Update Manifest](https://extensionworkshop.com/documentation/manage/updating-your-extension/) - Mozilla documentation on self-hosted updates
