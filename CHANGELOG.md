# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-10-22

### Added
- Initial public release of `dsh-plugins-update`.
- Integrated with DeepSeek Harness desktop via `plugins.detail.actions` extension slot.
- Automatic version detection by querying npm registry/mirrors.
- Dynamic action button rendering in plugin detail headers (`⬆️ Update to vX.X.X`, `✓ Up to date`, `Updating...`).
- Backend update execution service invoking local profile pnpm/dsh environment with zero system pollution.
