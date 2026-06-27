# Workbook Cell Mutation CLI — Design Spec (slice 4)

**Status:** Draft (awaiting peer review + sign-off)
**Package:** `@danielsimonjr/mathts-workbook`
**Builds on:** read-contract ([[2026-06-27-workbook-gui-read-contract-design]]) + round-trip ([[2026-06-27-workbook-roundtrip-cli-design]]).

---

## 1. Goal

Make **editing a `.mtsw` a CLI operation** so the "everything the user/GUI does goes through the CLI" principle holds for mutation. Add `mtsw cell add|edit|rm|move|rename` — atomic, in-place, validity-preserving edits, with the same `--json` envelope as the rest of the contract. This is slice 4 of the GUI-on-CLI plan (slice 5 = `serve`/streaming/incremental).

## 2. Design principles

- **Pure core, thin CLI.** Edit logic lives in `src/edit.ts` as pure, immutable functions on `Workbook` (return a new workbook; never mutate the input). The CLI parses args → calls a pure op → serializes → atomic write.
- **Validity-preserving.** Every op enforces the workbook's invariants (unique + identifier-safe ids; supported type; `depends_on` references exist; no self-dependency). An op that would produce an invalid workbook **throws** and the file is **not written** — a mutation can never corrupt the file.
- **Atomic, in-place by default.** Edits write the file via the existing `writeFileAtomic` (temp + rename). `--json` additionally returns the resulting structured doc (a `describe`-style payload) so a GUI can refresh in one round-trip; `--dry-run` prints the would-be serialized YAML to stdout without writing.
- **Same envelope.** `--json` uses the unified envelope `{schemaVersion,command,ok,data,problems}`; `command` is `"cell"`.

## 3. Pure ops (`src/edit.ts`)

```ts
interface CellPosition { before?: string; after?: string; at?: number } // default: append

function addCell(wb: Workbook, spec: {
  id: string; type: CellType; content?: string; dependsOn?: string[];
}, position?: CellPosition): Workbook;

function editCell(wb: Workbook, id: string, changes: {
  content?: string; type?: CellType; dependsOn?: string[];
}): Workbook;

function removeCell(wb: Workbook, id: string, options?: { force?: boolean }): Workbook;

function moveCell(wb: Workbook, id: string, position: CellPosition): Workbook;

function renameCell(wb: Workbook, oldId: string, newId: string): Workbook;
```

Semantics:
- **addCell** — `id` must be a valid identifier and unique; `type` must be a supported type (`code`/`markdown`/`data`/`test`; deferred types rejected with a clear message); every `dependsOn` id must already exist; no self-dep. Inserts at `position` (default append). Throws otherwise.
- **editCell** — cell must exist; applies only the provided fields; re-validates type/deps. (Changing `id` is `renameCell`, not `editCell`.)
- **removeCell** — if other cells depend on `id` and `!force` → throw, listing dependents. With `force`, also strip `id` from every dependent's `dependsOn` (keeping the file valid), then remove the cell.
- **moveCell** — reorder only (execution order is topological regardless; this is display/file order for the GUI). Throws if `id` or the anchor is unknown.
- **renameCell** — `newId` must be valid + unique; rename the cell and rewrite every dependent's `dependsOn` (`oldId → newId`). Throws otherwise.

All ops are pure (clone-then-modify) and reuse the parser's identifier rule + cell-type set (exported/shared, not duplicated).

## 3.5 Peer-review hardening (incorporated — Adam gemini-2.5-pro / Eve o3)

- **Cycle rejection (validity = runnable-valid).** A cyclic workbook still *parses* (cycles are caught at run/validate, not parse), so the ops are stricter than the parser: after any op that changes `depends_on` (`addCell`, `editCell`, `renameCell`), run `detectCycles` on the result and **throw** if a cycle was introduced (message names the cycle). `moveCell` can't create cycles (order-only). This closes the "edit B to depend on A" gap.
- **`editCell` validates `type`** against the supported set exactly like `addCell` (no silent change to a deferred/unknown type).
- **`renameCell` rules:** `oldId === newId` → no-op (`changed:false`); `newId` must be a valid identifier and unique among the *other* cells; the rename + all dependent `depends_on` rewrites happen in one in-memory workbook, then a single atomic write.
- **`removeCell --force` is not silent:** it returns the list of cells whose `depends_on` it stripped; the `--json` `data` carries `changedCells: string[]` and the human output reports them.
- **Position validation:** `--at` out of range, `--before/--after` an unknown anchor, or moving a cell relative to itself all throw clear errors (move-to-same-position is a no-op).
- **`--depends-on` normalization:** split on commas, trim, drop empties, de-duplicate; a self-reference or unknown id is an error.
- **No-op edits skip the write:** if an `edit`/`move`/`rename` produces a workbook byte-identical to the input serialization, do not rewrite the file (preserves mtime, avoids churn); report `changed:false`, exit 0.
- **Empty content is legal:** `add`/`edit` with neither `--content` nor `--content-file` leaves content `''`.
- **`--content-file -` = stdin** (a real file literally named `-` must be given as `./-`).
- **Concurrency (deferred, documented):** edits are load-modify-write with no version token, so concurrent writers last-write-wins. Acceptable for the per-action single-user CLI; an optimistic guard (`--expect-hash`) ships with the stateful `serve` session in slice 5. Documented in the README.

## 4. CLI: `mtsw cell <verb> <file> ...`

Common: writes the file atomically on success; `--json` → envelope whose `data` is the resulting `describe`-style doc; `--dry-run` → serialized YAML to stdout, no write; errors → `problems`/stderr, exit 1, **no write**.

- `cell add <file> --type <t> --id <id> [--content <s> | --content-file <p|->] [--depends-on a,b] [--before <id> | --after <id> | --at <n>]`
- `cell edit <file> <id> [--content <s> | --content-file <p|->] [--type <t>] [--depends-on a,b]`
- `cell rm <file> <id> [--force]`
- `cell move <file> <id> (--before <id> | --after <id> | --at <n>)`
- `cell rename <file> <oldId> <newId>`

**Content input:** `--content <s>` inline (single line). For multi-line content, `--content-file <path>` reads a file, or `--content-file -` reads **stdin** (the GUI/editor pipes the cell body). Exactly one of `--content`/`--content-file` may be given.

**Value flags** (consume the next arg; added to the positional-scanner allowlist): `--type/-t`, `--id`, `--content`, `--content-file`, `--depends-on`, `--before`, `--after`, `--at`. `--depends-on` is a comma-separated list.

## 5. Components
- **`src/edit.ts`** (new): the five pure ops + `CellPosition`. Reuses `IDENTIFIER_RE` + `CELL_TYPE_KEYS` (export the supported-types set from parser; or a small shared `cell-types.ts`).
- **`src/cli.ts`**: `cellCommand(args)` parses the sub-verb + flags, reads content (inline/file/stdin), loads+parses the file, applies the op, serializes, atomic-writes (or `--dry-run`), and reports. Add `cell` to `COMMAND_NAMES`/HELP/dispatch; add the new value-flags to `VALUE_FLAGS`. `capabilities.features.editCell = true`.
- **`src/index.ts`**: export the `edit.ts` ops.

## 6. Error handling
| Failure | Handling |
|---|---|
| Unknown verb / missing file / missing id | usage → stderr or envelope, exit 1 |
| Invalid/duplicate id, unknown type, missing dep, self-dep | op throws → caught → problems/stderr, exit 1, **no write** |
| `rm` with dependents (no `--force`) | throw listing dependents, exit 1, no write |
| both `--content` and `--content-file` | usage error |
| `--content-file` path unreadable | error, exit 1 |
| write failure | caught → error, exit 1 (original intact via atomic temp+rename) |

## 7. Testing (vitest, TDD)
- **`edit.ts`**: each op — happy path + every throw branch; immutability (input workbook unchanged); add at before/after/at/append; rm with/without dependents (+force strips deps); rename updates dependents; round-trip (serialize→parse the result is valid).
- **CLI**: `cell add/edit/rm/move/rename` against temp files — file actually changes; `--json` envelope returns updated doc; `--dry-run` writes nothing; `--content-file -` reads stdin; invalid op leaves the file **unchanged**; drift test still green (cell routable, creates no stray file with no args).

## 8. Out of scope (slice 5)
`mtsw serve` (JSON-RPC + streaming events), incremental/reactive re-execution, `functions --json` autocomplete, workbook-level metadata editing (could be a small follow-on), batch/transactional multi-op edits.

## 9. Global constraints
ESM-only; vitest explicit imports; security invariant untouched; atomic writes; `tsc --noEmit` gate; Conventional Commits; **no `npm publish`**; Changesets `minor`.

## 10. Acceptance criteria
1. `mtsw cell add f.mtsw --type code --id x --content "1+1"` appends a runnable cell; the file changes; re-`describe` shows it.
2. `cell edit` / `cell move` / `cell rename` change the file as specified; `rename` updates dependents' `depends_on`.
3. `cell rm f.mtsw <id>` refuses when dependents exist; `--force` removes it and strips it from dependents.
4. An invalid edit (dup id, missing dep, unknown type) exits non-zero and leaves the file **byte-for-byte unchanged**.
5. `--content-file -` reads cell content from stdin; `--dry-run` writes nothing.
6. Full suite + `tsc --noEmit` green; security invariant untouched.
