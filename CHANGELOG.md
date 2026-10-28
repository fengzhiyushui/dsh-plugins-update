# Changelog

All notable changes to this project will be documented in this file.

## [0.1.4] - 2026-10-28

### Added
- GitHub-aware updates: resolve the repository default branch, pin releases to matching `vX.Y.Z` tags, and detect commit-level updates even when `package.json` version did not change.
- Live update progress: asynchronous install jobs expose phase, rough percentage and an install-log tail; the UI shows a progress panel with a cancel button, and installs can be cancelled and rolled back.
- Post-install verification and automatic rollback: a snapshot of `package.json` + `pnpm-lock.yaml` is restored when an install fails, is cancelled, or fails version/commit verification.
- Configurable install timeout (`installTimeoutSeconds`, default 120s, 30-900) and `GITHUB_TOKEN`/`GH_TOKEN` support for private repositories (metadata reads + git credential env for installs).
- Retry/backoff, ETag caching and environment proxy support (`HTTPS_PROXY`/`HTTP_PROXY`/`NO_PROXY`) for all GitHub/npm metadata requests.
- Bilingual UI: zh/en dictionaries registered through the DSH locale service, live language switching in the updater button and registry settings card, and machine-readable API error codes localized by the client. Config schema descriptions are bilingual.

### Changed
- Registry completeness checks now read the resolved dependency set from `pnpm-lock.yaml` instead of only direct dependencies.
- Semver comparison now implements full prerelease precedence (alpha/beta/rc) and ignores build metadata.

## [0.1.3] - 2026-10-27

### Fixed
- Hide the update entry and reject update requests for official DSH plugins (`pkg.official`, `@deepseek-ai/*`); official bundles are upgraded through DSH's own update button.
- Validate `packageName` and `targetVersion` in the check/update APIs instead of trusting request bodies.
- Launch the DSH CLI through Electron in Node mode (`cli.js`) without a shell; the pnpm fallback is guarded and only accepts shell-safe characters. Removed the hard-coded `D:\dsh` / `C:\dsh` install paths and the hard-coded desktop profile assumption.
- Serialize installs per profile: a second update started while one is running now fails fast instead of racing on the same `node_modules`.
- Self-update responses are sent before the Host refreshes the plugin list; the UI now asks for a full DSH restart instead of a window reload.
- Failed version checks now report `ok: false` ("检查失败") instead of being shown as "已是最新", and failures are no longer cached.
- Use the Host plugin dependency spec (`pluginManager.listBundles().source`) for origin detection; the client-side `subject.pkg.source` assumption (never provided to detail slots) is gone.

## [0.1.2] - 2026-10-26

### Added
- Added registry selection settings (`RegistrySettingsCard`) integrated into DSH bundle configuration (`plugins.bundle.config`) and directly accessible via a quick-settings button (`⚙️`) beside the updater button.
- Added support for custom registries: users can freely add, switch to, and remove custom npm registries.
- Added pre-configured official npm registry (`https://registry.npmjs.org/`) and DSH domestic mirror (`https://registry.npmmirror.com/`) options with detailed in-app guidance.
- Added smart package presence validation in auto-selection mode: validates that all required versions exist on the mirror before proceeding, seamlessly switching to the official registry if any package is lagging or missing.
- Added automated fallback to the official registry if an installation fails on domestic or custom registries (e.g. `ERR_PNPM_NO_MATCHING_VERSION`).

### Fixed
- Fixed update failure on other plugins (e.g. `dsh-context`) caused by hardcoded `--registry=https://registry.npmmirror.com/` resolving un-synced dependencies across shared profile `package.json`.
- Fixed version check query race where fast-responding mirrors could return outdated versions over the official registry.

## [0.1.1] - 2026-10-25

### Fixed
- Fixed package origin resolution (`resolvePackageOrigin`) misidentifying npm-installed plugins that contain a `repository` field in `package.json` as GitHub-installed packages.
- Replaced `pnpm update` with `pnpm add <pkg>@<version>` in `runUpdateCommand` so updates across `0.x` minor versions and GitHub specs actually take effect on disk.
- Added post-update on-disk version verification (`readInstalledVersion`) to prevent false-positive success notifications and triggered runtime package refresh events (`pluginPackages.refresh`, `hmr.reconcileProfile`, `plugin-manager/changed`).

## [0.1.0] - 2026-10-22

### Added
- Initial public release of `dsh-plugins-update`.
- Integrated with DeepSeek Harness desktop via `plugins.detail.actions` extension slot.
- Automatic version detection by querying npm registry/mirrors.
- Dynamic action button rendering in plugin detail headers (`⬆️ Update to vX.X.X`, `✓ Up to date`, `Updating...`).
- Backend update execution service invoking local profile pnpm/dsh environment with zero system pollution.
