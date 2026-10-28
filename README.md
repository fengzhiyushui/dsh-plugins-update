# dsh-plugins-update

<p align="center">
  <img src="icon.svg" width="80" height="80" alt="dsh-plugins-update icon" />
</p>

<p align="center">
  <b>A DeepSeek Harness (DSH) desktop plugin for one-click updating third-party plugins.</b>
</p>

<p align="center">
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/releases"><img src="https://img.shields.io/badge/Release-v0.1.4-brightgreen.svg" alt="Release" /></a>
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update"><img src="https://img.shields.io/badge/DeepSeek%20Harness-v0.2+-orange.svg" alt="DeepSeek Harness" /></a>
</p>

---

[中文文档 (README_zh.md)](README_zh.md)

Solves the pain point where third-party plugins in DeepSeek Harness desktop cannot be upgraded directly from the UI when newer versions are released.

---

## 🌟 Features

* **Native Integration**: Seamlessly injected into the DSH plugin detail page header (next to the Uninstall button) using the native `plugins.detail.actions` slot.
* **Automatic Version Check**: Compares local installed version with the latest release on npm registry automatically upon opening the detail view.
* **Smart Dynamic States**:
  * **Update Available**: Highlights `⬆️ Update to vX.X.X` button.
  * **Up to Date**: Displays `✓ Up to date` (click to manually re-check).
  * **Updating**: Shows loading spinner and disables concurrent operations.
  * **Success**: Shows the result panel and guides the user to reload/restart.
* **GitHub-aware**: Resolves the repository default branch, pins releases to matching `vX.Y.Z` tags when possible, and detects new commits even when the package version was not bumped.
* **Safe & recoverable**: Snapshots the profile manifest and lockfile before installing, verifies disk version/commit afterwards, and rolls back automatically on failure, cancellation or verification mismatch.
* **Live progress & cancel**: Shows phase, rough percentage and the install-log tail while updating; updates can be cancelled, and the install timeout is configurable (`installTimeoutSeconds`).
* **Network resilience**: Retries with backoff, ETag caching, `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` support, and `GITHUB_TOKEN` / `GH_TOKEN` for private repositories.
* **Bilingual UI**: All client copy is registered with the DSH locale service, so 中文 / English switches live from Settings → General → Language without a reload.
* **Zero Intrusion**: Completely non-destructive to the official DSH client executable and files.

---

## 🛠️ Installation

### In DSH Desktop UI:
1. Open **DeepSeek Harness Desktop**;
2. Navigate to **Plugins** in the left sidebar;
3. Click **Add plugin** in the top right corner;
4. Enter the GitHub repository:
   ```text
   fengzhiyushui/dsh-plugins-update
   ```
   Or the full repository URL:
   ```text
   https://github.com/fengzhiyushui/dsh-plugins-update
   ```
5. Click **Install**.

### Via DSH CLI:
```bash
dsh plugin --profile desktop add fengzhiyushui/dsh-plugins-update
```

---

## 💡 Development & Build

```bash
# Install dependencies
pnpm install

# Compile client and server bundles
pnpm run build
```

---

## ⚠️ Known Limitations

* **GitHub updates**: detection uses `package.json#version` on the repository default branch. Updates pin the matching `vX.Y.Z` tag when one exists; otherwise the branch head is installed (the UI says so). New commits without a version bump are reported as "update to latest commit".
* **Private repositories**: reading metadata requires `GITHUB_TOKEN` / `GH_TOKEN`; installing additionally needs usable local git credentials.
* **Proxy**: `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` environment variables are honored; OS proxy settings are not read.
* **Install timeout**: defaults to 120s and can be changed with the `installTimeoutSeconds` plugin config (30–900).
* **Official plugins**: this plugin does not offer updates for official DSH plugins; use DSH's built-in Update button.

---

## 📄 License

MIT © [fengzhiyushui](https://github.com/fengzhiyushui)
