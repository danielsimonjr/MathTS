# Parked changesets — release notes for a package that is not published yet

These are real, unreleased changesets for **`@danielsimonjr/mathts-workbook`**, which is
listed in `ignore` in `.changeset/config.json` (the package is not published to npm yet).

## Why they are not in `.changeset/`

A changeset whose only package is an **ignored** one is a contradiction: changesets reads
it, plans **zero** version bumps from it, and produces an empty diff. The
`changesets/action` release workflow then tries to open its "Version Packages" PR anyway
and GitHub rejects it:

    Validation Failed: No commits between main and changeset-release/main

which failed the `Release` workflow on **every push to main**, permanently. Eleven such
changesets had accumulated here.

Deleting them would throw away genuine release notes for real workbook work, so they are
parked instead.

> A subdirectory _inside_ `.changeset/` does **not** work — changesets descends into it and
> tries to read `.changeset/<dir>/changes.md`. Verified, not assumed. They must live
> outside the directory, which is why this folder is a sibling.

## Restoring them

When `@danielsimonjr/mathts-workbook` is ready to publish, drop it from the `ignore` list in
`.changeset/config.json` and move these files back:

```bash
mv .changeset-parked/workbook-*.md .changeset/
npx changeset status   # workbook should now appear under "packages to be bumped"
```

Their contents are unmodified, so the generated changelog will be exactly what it would
have been.
