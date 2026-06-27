---
"@danielsimonjr/mathts-workbook": minor
---

Round-trip serialization + CLI completeness for the headless workbook.

- **`serializeWorkbook`** implemented (was a throwing stub): emits YAML that round-trips through `parseWorkbook` — structure exact, persisted `output` values best-effort (the serializer quotes ambiguous scalars so string outputs don't re-type). `output`/`error` are now read back onto cells (reserved keys, not swept into `metadata`).
- **`mtsw strip <file> [-w]`** — strip cell outputs to stdout (default) or rewrite in place.
- **`mtsw new <name> [-t basic] [--force]`** — scaffold a runnable `.mtsw`; rejects path separators/colons/reserved names; exclusive create (no symlink clobber) unless `--force`.
- **`mtsw run <file> --write`** — opt-in: persist run outputs/errors back into the file (stdout stays clean; confirmation to stderr).
- All write paths are **atomic** (unique temp file + rename, with cleanup on failure). Known limitation: writes drop YAML comments and re-order keys (parse→serialize).
