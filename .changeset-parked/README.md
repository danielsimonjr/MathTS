# Parked changesets — historical workbook release notes

These are **archived** changesets for `@danielsimonjr/mathts-workbook` from the period
when the package was listed in `.changeset/config.json` `ignore` and not yet on npm.
That is no longer true: `ignore` is `[]`, workbook is public (`publishConfig.access`
follows the root Changesets config), and the package ships on the registry (see
`workbook/package.json` `"version"`).

## Why they stay outside `.changeset/`

While workbook was ignored, changesets that only touched it produced empty version PRs
and broke the Release workflow (`No commits between main and changeset-release/main`).
Those files were moved here so real release notes were not deleted.

Keeping them **out of** `.changeset/` still avoids feeding stale, already-shipped
workbook bumps back into Changesets. They are reference-only.

> A subdirectory _inside_ `.changeset/` does **not** work — changesets descends into it and
> tries to read `.changeset/<dir>/changes.md`. Verified, not assumed. They must live
> outside the directory, which is why this folder is a sibling.

## Do not "restore" into `.changeset/`

Do **not** move these files back into `.changeset/` unless you are deliberately
replaying historical changelog text. For new workbook work, add a fresh changeset
under `.changeset/` like any other package.
