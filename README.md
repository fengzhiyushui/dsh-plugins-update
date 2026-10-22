# dsh-plugins-update

A DeepSeek Harness (DSH) desktop plugin for **one-click updating third-party plugins**.

Solves the issue where third-party plugins in DSH desktop cannot be updated directly from the UI when a new version is released.

[中文文档](README_zh.md)

---

## 🌟 Features

* **Native Integration**: Injected seamlessly into the DSH plugin detail page (next to the Uninstall button).
* **Automatic Version Check**: Compares local installed version with the latest release on npm registry upon opening detail page.
* **Smart Action States**:
  * **Update Available**: Highlights `⬆️ Update to vX.X.X` button.
  * **Up to Date**: Shows `✓ Up to date` (click to manually recheck).
  * **Updating**: Displays loading spinner and disables concurrent operations.
  * **Success**: Alerts when update completes and guides user to reload.
* **Zero Intrusion**: Completely non-destructive to the official DSH client executable and files.

---

## 🛠️ Installation

### In DSH Desktop UI:
1. Open DeepSeek Harness Desktop;
2. Navigate to **Plugins** in the left sidebar;
3. Click **Add plugin** in the top right corner;
4. Enter the GitHub repository:
   ```text
   fengzhiyushui/dsh-plugins-update
   ```
   Or the full URL:
   ```text
   https://github.com/fengzhiyushui/dsh-plugins-update
   ```
5. Click **Install**.

### Via DSH CLI:
```bash
dsh plugin --profile desktop add fengzhiyushui/dsh-plugins-update
```

---

## 📄 License

MIT
