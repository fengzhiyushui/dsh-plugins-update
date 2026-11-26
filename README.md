# dsh-plugins-update

<p align="center">
  <img src="icon.svg" width="80" height="80" alt="dsh-plugins-update icon" />
</p>

<p align="center">
  <b>A lightweight updater & startup conflict guard for third-party DeepSeek Harness (DSH) plugins.</b><br>
  Proactive Reminders · Startup Conflict Auto-Disable · Orthogonal Red/Blue Badges · GitHub Plugin Updates · Release Age Bypass
</p>

<p align="center">
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/releases"><img src="https://img.shields.io/badge/Release-v0.2.6-brightgreen.svg" alt="Release" /></a>
  <a href="https://awesome-dsh-plugin.com"><img src="https://awesome-dsh-plugin.com/badge.svg" alt="Awesome DSH Plugin" /></a>
</p>

<p align="center">
  <b>English</b> | <a href="README_zh.md">简体中文</a>
</p>

---

> **Experimental Branch Notice (`experimental`)**: This is the experimental branch (`v0.2.7-exp.2`). It is **not packaged or published to npm and cannot be installed via npm**. Install it via GitHub branch spec only (`fengzhiyushui/dsh-plugins-update#experimental`). Do not merge into `main` without explicit approval; for stable releases, switch to the [`main` branch](https://github.com/fengzhiyushui/dsh-plugins-update/tree/main).

> **Important Notice**: DSH natively supports plugin updates since `0.2.2-rc.1`. This plugin coexists with the native updater (compatible with `0.2.2-rc.1` ~ `0.2.3-alpha.2`).

## Introduction

`dsh-plugins-update` is a lightweight update and compatibility guard plugin for DeepSeek Harness (DSH) that extends the built-in plugin manager across rapid DSH releases:

- **Startup Conflict Auto-Disable & Orthogonal Red/Blue Badges (Experimental)**: When DSH boots after a version upgrade, if no plugin conflict is detected, startup proceeds silently. If an enabled third-party plugin conflicts with the running DSH version (manifest incompatibility, failed/stuck Cordis Fiber, missing entry files, repeated startup crash loops, or uncaught client bundle crashes), the plugin is automatically disabled (`setBundleEnabled(false)` with atomic manifest fallback) so DSH stays usable, and marked in-place with a **red conflict badge** (`Disabled (conflict)`) alongside any **blue update badge** (`Update available`) across the sidebar, installed list, and detail page—with zero extra popups. After updating the plugin, the red badge clears automatically while keeping the switch off for you to re-enable manually.
- **Background Probing & Global Reminders**: At startup, the plugin runs lightweight concurrent HTTPS checks across installed third-party plugins, adds numeric badges on the sidebar `Plugins` item, and attaches native-style `Update available` tags next to plugin titles in the installed list. Automatically reconciles pending badges when DSH's native update/install dialog finishes.
- **Native-First Layering & Fallback Activation**: When using the official `npmjs` registry, standard reviewed updates (>=24h) yield cleanly to DSH's native UI. Whenever DSH native does not apply (e.g., `<24h` fresh releases when enabled, **GitHub repository plugins**, **npmmirror / custom HTTPS registries**) or the **Always show Fast Update button** switch is enabled, this plugin exposes a direct one-click action in detail headers (without repetitive per-update confirmation modals).
- **Security Policy Gates & Scoped Exemption (Experimental)**:
  - Settings provide 4 native `Switch` controls: fallback to official registry, always show detail button, plus two **off-by-default** high-risk gates—**Allow <24h releases (`minimumReleaseAge`)** and **Allow unreviewed versions/sources** (enabling either from off triggers a danger confirmation modal).
  - By default, versions are verified against configured DSH `pluginMarket` indexes (automatically falling back to the `awesome-dsh-plugin.com` Format-1 curated index when unconfigured), blocking unlisted packages/versions and floating GitHub branches. When `<24h` updates are permitted, only `<package>@<version>` is added to the profile `pnpm-workspace.yaml` (`minimumReleaseAgeExclude`), keeping transitive dependencies protected for 24h while keeping build scripts blocked (`--ignore-scripts`).
- **Registry Security & Failure Rollback**: Supports npm official, `npmmirror`, or custom HTTPS registries with SSRF-hardened manual redirects, anti-CSRF header checks, minimal child-process env allowlists, and atomic rollback across `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`.
- **GitHub Update Signal**: For GitHub-sourced plugins (including `#ref` branch/tag targets, 40-char commit-pinned specs, and monorepo `&path:<subdir>` specs), updates are detected via concurrent HTTPS requests racing jsDelivr and `raw.githubusercontent.com` for the target `package.json` `version` field while preserving `#ref` and `&path:<subdir>` on upgrade.

## Features

- **Startup Conflict Circuit Breaker (Experimental)**: Automatically disables incompatible or crashing third-party bundles so DSH remains responsive;
- **Orthogonal Red & Blue Indicators (Experimental)**: Red badges denote conflict-disabled plugins and blue badges denote available updates—rendered side-by-side in expanded sidebars and plugin rows, with a compact red badge + blue dot in collapsed sidebars and native `plugins.detail.badge` support on detail pages;
- **Upgrade-Resilient Decoupling (Experimental)**: Minimizes hard Cordis `inject` dependencies and guards UI primitive loading so `dsh-plugins-update` itself stays resilient across DSH updates;
- **Enhanced GitHub Plugin Updates**: Races global CDN and GitHub raw endpoints on `package.json` for one-click upgrades while preserving `#ref` and `&path:<subdir>`;
- **Native `Switch` Settings & Bilingual UI**: Uses DSH's native `Switch`, `Tag`, `Button`, and `Modal` primitives with synchronized English and Simplified Chinese localization;
- **Security Gates & Scoped Release-Age Exemption**: Blocks <24h and unreviewed versions/floating branches by default; when explicitly enabled via danger-confirmed toggles, exempts only `<pkg>@<version>` in `pnpm-workspace.yaml` instead of disabling protection across transitive dependencies.

## Install (`experimental` branch)

In DSH open **Plugins → Add plugin** and enter:

```text
fengzhiyushui/dsh-plugins-update#experimental
```

Or use the DSH CLI:

```bash
dsh plugin --profile desktop add fengzhiyushui/dsh-plugins-update#experimental
```

## Development

```bash
pnpm install
pnpm run build
```

## License

MIT License © [fengzhiyushui](https://github.com/fengzhiyushui)
