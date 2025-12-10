# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project structure with monorepo setup
- @mathts/core package with type definitions and utilities
- GitHub Actions CI/CD workflows
- TypeScript configuration with project references
- Turbo build system for monorepo management

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

## [0.1.0] - Unreleased

### Added
- Initial release
- Core type system (`BackendType`, `NumericType`, `MathTSConfig`)
- Configuration management (`createConfig`, `defaultConfig`)
- Type guards (`isNumeric`, `isComplex`, `isMatrix`)
- Scientific workbook specification (`.mtsw` format)
- CLI tool (`mtsw`) for workbook execution

[Unreleased]: https://github.com/danielsimonjr/mathts/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/danielsimonjr/mathts/releases/tag/v0.1.0
