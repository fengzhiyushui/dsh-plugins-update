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
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/releases"><img src="https://img.shields.io/badge/Release-v0.2.2-brightgreen.svg" alt="Release" /></a>
</p>

---

A minimal and powerful companion for DeepSeek Harness third-party plugins. Fully integrated with DSH 0.2.2+ native plugin management, filling critical native gaps with **proactive global sidebar badges**, **exclusive one-click updates for GitHub repositories**, and **supply chain release-age policy bypass**, all powered by a sub-second HTTP detection engine.

## Features

- **Exclusive GitHub Plugin Update Support**: Solves DSH native's limitation where non-registry Git plugins cannot be updated in-place, enabling one-click upgrades to the latest commit;
- **Proactive Global Reminders**: Runs lightning-fast startup/background probes to display a numeric badge on the sidebar `Plugins` icon and native-style `Update available` tags on plugin rows;
- **Smart Coexistence & Conflict Prevention**:
  - Automatically hides redundant action buttons on standard npm plugin pages when up to date, yielding full prominence to DSH native version cards;
  - Offers a clean `⚡ Fast Update` option when an update is available without visual clutter;
- **Release Age Policy Bypass**: Automatically catches and bypasses pnpm supply chain restrictions (`minimumReleaseAge`), letting users install brand-new releases immediately;
- **Sub-Second Concurrent Detection**: Direct async HTTP fetching over global CDN and domestic mirrors, eliminating the heavy overhead of spawning multiple `pnpm view` subprocesses;
- **Multi-Registry & Fallback**: Supports npm official, npmmirror, and custom registries with automatic fallback to npm official upon mirror failure;
- **Native Design System & Bilingual (i18n)**: UI components built entirely with DSH native primitives (`Modal`, `Button`, `Tag`), adapting seamlessly to English and Chinese locales.

## Comparison with DSH Native

| Scenario | DSH 0.2.2 Native | With `dsh-plugins-update` |
|---|---|---|
| **GitHub Plugins** | ❌ Refuses updates; requires manual uninstall/reinstall | ✅ **Full one-click updates** directly from the repository |
| **Proactive Awareness** | ❌ No badges; only checks when opening the panel | ✅ **Sidebar numeric badge** & installed list row tags |
| **Newly Published Releases** | ❌ Blocked by `minimumReleaseAge` policy window | ✅ **Auto-bypasses policy window** for instant updates |
| **Detection Speed** | ⚠️ Spawns external `pnpm view` subprocesses repeatedly | ⚡ **Pure lightweight HTTP**, settles in <500ms |
| **Detail Page UI** | Native version section & update button | Native-first, secondary channel on demand, zero duplicate buttons |

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
