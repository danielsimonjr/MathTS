---
"@danielsimonjr/mathts-workbook": minor
---

Cell mutation via the CLI — editing a `.mtsw` is now a first-class CLI operation.

- **`mtsw cell add|edit|rm|move|rename <file> ...`** — atomic, in-place, validity-preserving edits with the unified `--json` envelope and a `--dry-run` preview.
  - `add --type --id [--content | --content-file <p|->] [--depends-on a,b] [--before|--after <id> | --at <n>]`
  - `edit <id> [--content | --content-file] [--type] [--depends-on]`, `rm <id> [--force]`, `move <id> (--before|--after|--at)`, `rename <oldId> <newId>`
- **Pure, immutable edit ops** in `edit.ts` (`addCell`/`editCell`/`removeCell`/`moveCell`/`renameCell`), exported from the package. Enforce invariants: unique + identifier-safe ids, supported cell type, existing `depends_on`, no self-dependency, and **no newly-introduced cycle** (a pre-existing cycle stays editable).
- **Safety:** an invalid op throws and the file is left **byte-for-byte unchanged**; writes are atomic (temp + rename). Editing a cell clears its now-stale persisted `output`/`error`; `rm --force` detaches dependents (clearing their outputs) and reports `changedCells`.
- **`rename` rewrites both the `depends_on` edge and by-id references in dependent content**, so a renamed workbook still runs.
- Content via `--content` (inline) or `--content-file <path|->` (file/stdin; guarded against hanging on a TTY). `parser` now exports `isValidIdentifier` + `SUPPORTED_CELL_TYPES`; `capabilities.features.editCell = true`.

Reviewed (Adam/Eve + code-reviewer): introduced-cycle-only rejection, stale-output clearing, rename content rewrite (caught by an end-to-end smoke), TTY stdin guard. Known limitation: concurrent editors are last-write-wins (an optimistic lock ships with `serve`).
