# Changelog

All notable changes to this project will be documented in this file.

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
