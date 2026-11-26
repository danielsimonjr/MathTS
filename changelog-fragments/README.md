# Changelog fragments

One fragment per pull request, assembled into the root `CHANGELOG.md` by the
release version PR (`chore: release packages`), newest first. PRs do **not**
edit `CHANGELOG.md` directly: the top of `[Unreleased]` is where every parallel
PR used to insert its bullet, and that single line conflict forced re-merges and
full CI reruns.

## Format

- Filename: `YYYY-MM-DD-<short-slug>.md` (for example
  `2026-11-25-fraction-format-parity.md`). The filename is the assembly key:
  the version PR inserts fragments in descending filename order, so use the PR
  date.
- Content: one `### Added|Changed|Fixed|Deprecated|Removed|Security|Documented`
  heading, then one or more changelog bullets. The body is inserted verbatim.

```markdown
### Fixed

- **What changed and why (#1234):** the observable behavior before and after.
```

## Rules

- Add exactly one fragment per PR (a PR may carry several bullets in it).
- Do not edit `CHANGELOG.md` in the same PR. The assembler inserts fragments
  above the existing `[Unreleased]` content; a direct `CHANGELOG.md` edit is
  still accepted while in-flight PRs transition, but new work uses fragments.
- Docs-only PRs (markdown, `docs/`, `.github/`, `.changeset/`, this directory)
  need no fragment; the CI gate (`tools/test/check-changelog-fragment.mjs`)
  exempts them.
- Do not delete or edit another PR's fragment. Fragments are consumed only by
  the release version PR, which merges them into `CHANGELOG.md` and deletes
  them in the same commit.
