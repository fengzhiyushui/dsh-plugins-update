# dsh-plugins-update

<p align="center">
  <img src="icon.svg" width="80" height="80" alt="dsh-plugins-update icon" />
</p>

<p align="center">
  <b>A minimal one-click updater for third-party DeepSeek Harness (DSH) plugins.</b>
</p>

<p align="center">
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/releases"><img src="https://img.shields.io/badge/Release-v0.2.0-brightgreen.svg" alt="Release" /></a>
</p>

---

Adds an update button to every third-party plugin detail page in DSH.

## Features

- Injected into the native `plugins.detail.actions` slot;
- Checks npm packages and minimal GitHub sources for newer versions;
- One-click update with post-install disk version verification;
- Registry configuration: npm official, npmmirror and custom registries;
- Optional fallback to the npm official registry;
- Uses DSH's native Modal for confirmation;\n- Update button and settings card follow the DSH language setting.

Not included: progress percentage, install logs, cancellation, update history, GitHub tag/commit tracking.

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
