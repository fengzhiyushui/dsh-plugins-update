# dsh-plugins-update

<p align="center">
  <img src="icon.svg" width="80" height="80" alt="dsh-plugins-update icon" />
</p>

<p align="center">
  <b>A lightweight updater & power-tool companion for third-party DeepSeek Harness (DSH) plugins.</b><br>
  Proactive Global Reminders · One-Click GitHub Plugin Updates · Smart Native UI Coexistence · Release Age Policy Bypass
</p>

<p align="center">
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/releases"><img src="https://img.shields.io/badge/Release-v0.2.3-brightgreen.svg" alt="Release" /></a>
</p>

<p align="center">
  <b>English</b> | <a href="README_zh.md">简体中文</a>
</p>

---

> **Important Notice**: DeepSeek Harness (DSH) has natively supported checking and updating plugins since `0.2.2-rc.1`. Starting from `v0.2.2`, this plugin adapts to coexist with DSH's native update mechanism (locally tested on DSH `0.2.2-rc.1`).

## Introduction

`dsh-plugins-update` is a lightweight update enhancement plugin for DeepSeek Harness (DSH) that extends the built-in plugin manager in everyday maintenance scenarios:

- **Background Probing & Global Reminders**: At startup, the plugin runs lightweight concurrent HTTP checks across installed third-party plugins, adds a numeric update counter badge on the sidebar `Plugins` item, and attaches native-style `Update available` tags next to plugin titles in the installed list—letting you see pending updates without opening each plugin one by one.
- **Native-First Layering & On-Demand Fast Channel**: By default (when using the official `npmjs` registry), standard npm plugin detail pages yield cleanly to DSH's native update controls with zero duplicate buttons. For **GitHub repository plugins**, setups using **npmmirror / custom registries**, or when **Always show the Fast Update button on plugin detail pages** is enabled in settings, this plugin exposes a direct `⚡ Fast Update` channel.
- **Registry Switching & Failure Rollback**: Choose between npm official, `npmmirror`, or custom private registries in settings, with optional automatic fallback to npm official if a mirror fails. Before upgrading, the plugin snapshots your profile's `package.json` and `pnpm-lock.yaml`, restores them automatically on install or version-verification failure, and performs best-effort offline lockfile alignment if `node_modules` drifted.
- **GitHub Update Signal**: For GitHub-sourced plugins, updates are detected via concurrent HTTP requests racing jsDelivr and `raw.githubusercontent.com` for the root `package.json` `version` field (upstream repositories must bump `version` to trigger an update notice), while upgrading pulls the latest commit on the default branch.

## Features

- **Exclusive GitHub Plugin Update Support**: Races global CDN and GitHub raw endpoints to check versions on non-registry GitHub plugins, enabling one-click upgrades to the latest default-branch commit;
- **Proactive Global Reminders**: Performs lightweight startup/background HTTP checks without spawning `pnpm view` subprocesses, showing a sidebar numeric badge on `Plugins` and inline `Update available` tags on installed plugin rows (while avoiding duplicates with DSH native tags);
- **Native-First Coexistence + Optional Toggle**: Yields standard official npm detail pages to DSH native by default, while keeping GitHub plugins, mirror/custom registries, and an explicit settings toggle ready whenever single-step fast updates are needed;
- **Release Age Policy Bypass**: Automatically catches and bypasses pnpm `minimumReleaseAge` restrictions so newly published versions can be updated immediately;
- **Snapshot & Safe Rollback**: Snapshots `package.json` and `pnpm-lock.yaml` before updates, verifies installed semver versions afterward, and restores/realigns on failure;
- **Multi-Registry & Fallback**: Supports npm official, `npmmirror`, and custom HTTP/HTTPS registries with optional fallback retry to npm official;
- **Native Design System & Bilingual (i18n)**: Built with DSH UI primitives and synchronized English / Simplified Chinese localization.

## Install

In DSH open **Plugins → Add plugin** and enter:

```text
fengzhiyushui/dsh-plugins-update
```

Or by npm package name:

```text
dsh-plugins-update
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
