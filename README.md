# dsh-plugins-update

<p align="center">
  <img src="icon.svg" width="80" height="80" alt="dsh-plugins-update icon" />
</p>

<p align="center">
  <b>A DeepSeek Harness (DSH) desktop plugin for one-click updating third-party plugins.</b>
</p>

<p align="center">
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/releases"><img src="https://img.shields.io/badge/Release-v0.1.3-brightgreen.svg" alt="Release" /></a>
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
  * **Success**: Alerts when update completes and guides user to reload.
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

## 📄 License

MIT © [fengzhiyushui](https://github.com/fengzhiyushui)
