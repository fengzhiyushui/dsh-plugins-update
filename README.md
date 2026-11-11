# dsh-plugins-update

<p align="center">
  <img src="icon.svg" width="80" height="80" alt="dsh-plugins-update icon" />
</p>

<p align="center">
  <b>A minimal one-click updater for third-party DeepSeek Harness (DSH) plugins.</b>
</p>

<p align="center">
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/releases"><img src="https://img.shields.io/badge/Release-v0.2.2-brightgreen.svg" alt="Release" /></a>
</p>

---

Adds an update button to every third-party plugin detail page in DSH, with proactive update reminders on the sidebar and installed plugin list.

## Features

- Injected into the native `plugins.detail.actions` slot;
- Proactive startup update reminders: displays an `Update available` tag on updatable rows in the installed plugin list and a total count badge on the sidebar `Plugins` entry;
- Smart probe deduplication: unapplied update reminders persist across restarts without re-probing known updatable plugins on startup, while opening a plugin's detail page always performs a live check (with cached fallback on offline/timeout) to catch newer cross-version releases;
- Checks npm packages and minimal GitHub sources for newer versions;
- One-click update with post-install disk version verification;
- Registry configuration: npm official, npmmirror and custom registries;
- Optional fallback to the npm official registry;
- Uses DSH's native `Modal` and `Tag` components;
- Update button, reminder badges, and settings card follow the DSH language setting.

Not included: progress percentage, install logs, cancellation, update history, GitHub tag/commit tracking.

## Compatibility & Protection Mechanisms

- **Dual-Path Backend Detection**: Startup batch checks read DSH's runtime `installer` service first and automatically fall back to scanning `package.json` and `node_modules/*/package.json` on disk, ensuring update detection remains unaffected by DSH internal API changes.
- **Semantic Anchoring & Silent Degradation**: Sidebar count badges and plugin row tags anchor on semantic attributes (`li[data-plugin-package]`, WAI-ARIA `[role="switch"]`, and `sidebar.panellist` metadata) rather than hashed CSS class names, and all DOM operations are isolated inside `try / catch` boundaries. If a future DSH major update restructures the outer layout, badges degrade silently without impacting conversations, page rendering, or the detail-page update button.
- **Cross-Version & Offline Fallback**: If a plugin skips an intermediate release (e.g. `0.1` -> `0.2`), entering its detail page triggers a live version probe to upgrade directly to the newest version (`0.2`), and falls back to the cached update target if a transient network timeout occurs.

## Install

In DSH open **Plugins → Add plugin** and enter:

```text
fengzhiyushui/dsh-plugins-update
```

Or use the DSH CLI:

```bash
dsh plugin --profile desktop add fengzhiyushui/dsh-plugins-update
```

## Development

```bash
pnpm install
pnpm run build
```

## License

MIT License © [fengzhiyushui](https://github.com/fengzhiyushui)
