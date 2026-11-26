### Added

- CI fails when a package's built exports differ from the published tarball at the same version and no changeset names the package (#1573).

### Fixed

- **Unpublished surface check (#1573, #1771):** compare every `package.json` export subpath (not only `.`), parse package names strictly from changeset YAML frontmatter, treat `npm pack` `ETARGET` like `E404`, fail when no package was actually compared unless every comparable skip is a registry miss, skip both-side import failures only for worker entries, continue after per-entry import errors, and run only on `pull_request` with unit tests pinned in CI.
