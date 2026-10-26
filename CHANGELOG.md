# Changelog

All notable changes to this project will be documented in this file.

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
