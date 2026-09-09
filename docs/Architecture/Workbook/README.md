# Workbook architecture notes

Specification and worked-example material for the workbook design. The shipped
implementation lives in `workbook/` at the repo root — nothing here is built,
installed, or published.

## Why `package.json.txt` and not `package.json`

**Do not rename it back.**

GitHub's dependency graph indexes _any_ file whose basename matches a known
manifest (`package.json`, `requirements.txt`, `Cargo.toml`, …) anywhere in the
repository, whether or not it is installable. This directory is documentation:
it is not a declared workspace (the root globs are `packages/*` plus named
directories, and `docs/` matches neither) and it has no lockfile.

Left named `package.json`, it was treated as a production manifest:

- Dependabot attempted to update `vitest` inside it and failed the whole run
  with `dependency_file_not_supported`, turning the Dependabot check red on
  `main` while every real package updated fine.
- Any future CVE in a package pinned here would raise an alert against a
  fixture that is never installed — noise with no security value, recurring
  indefinitely.

The `.txt` suffix takes it out of the graph. The pins are also kept current as a
second, independent mechanism, so neither has to be right on its own.
