# Test Coverage Policy

**Last updated:** 2026-07-01
**Machine-readable form:** [`coverage-policy.json`](./coverage-policy.json)
**Consumed by:** [`tools/create-dependency-graph/`](../../tools/create-dependency-graph/)

The `create-dependency-graph` (CDG) tool reports **two** coverage
numbers in `TEST_COVERAGE.md`:

- **Raw coverage** — the fraction of source files (anywhere under any
  `src/`) that are directly imported by at least one `*.test.ts` file
  Vitest can discover. As of 2026-06-27 (`TEST_COVERAGE.md`) this is **35.8 % (201 / 562)**.
- **Effective coverage** — the same direct-import metric, but
  computed only over the **active hand-written code**. The denominator
  excludes files in the policy categories below — code that is
  intentionally not direct-tested because it is exercised through
  another path. As of 2026-06-27 (`TEST_COVERAGE.md`) this is **97.5 % (196 / 201)**.

Both numbers are reported. Neither is hidden. The raw number is the
true CDG measurement; the effective number is what callers usually
want when they ask "how well-tested is the codebase?".

This document defines what counts as "intentionally not direct-tested"
and why. Whenever a category here grows or shrinks, edit
`coverage-policy.json` first; the tool reads from that file.

## Why the two numbers diverge

CDG measures "directly imported by a test file" — a coarse proxy. It
necessarily under-reports for any code that is:

1. **Mechanically synced from upstream** and exercised through a thin
   active wrapper layer (the upstream tests have already validated the
   inner code; the wrapper layer carries the project's own tests).
2. **Written in a language Vitest cannot import** (AssemblyScript —
   the `*.ts` extension is misleading for AssemblyScript).
3. **Type-only** (`interface` / `type` / `.d.ts`) — no runtime to
   exercise.

For everything else — every file that has real runtime behaviour and
should fail loudly if regressed — direct test coverage is the right
metric.

## Categories

The categories are defined in `coverage-policy.json`. The summary
table here mirrors that file with prose.

### `synced_mathjs_functions`

**What it covers:** every file under
`functions/src/{arithmetic, algebra, bitwise, logical, relational,
trigonometry, statistics, set, special, matrix, signal, combinatorics,
complex, probability, string, geometry, unit, utils, plain, type,
expression, error, numeric, core/function}/`.

**Why it isn't direct-tested:** these are factory-pattern category
implementations (`create*` factories) originally synced from upstream
`mathjs` and since **activated** into the live graph via
`functions/src/factories/index.ts` (reachable from
`functions/src/index.ts`). They are exercised transitively through the
public `functions/src/typed/` + `functions/src/factories/` surface
rather than imported directly by a `*.test.ts`. (The `.ts→.ts` mathjs
sync model is retired, and the dead, unreachable synced remnant that once
sat alongside them — 455 files / ~58.6k LOC — was deleted 2026-06-27; see
`CLAUDE.md`'s "Syncing from mathjs" section.) The active public surface
has direct tests — 3,086 functions tests across 124 test files at the
time of writing.

**What would fail loudly:** every typed/ export has tests that exercise
the underlying synced helpers transitively. A synced helper that breaks
will surface as a typed-function test failure.

### `synced_wasm_bindings`

**What it covers:** every directory under `functions/src/wasm/` EXCEPT
the four active files at the root (`WasmLoader.ts`, `integrity.ts`,
`MatrixWasmBridge.ts`, `bitwise/wasm-bridge.ts`), all of which DO have
direct tests.

**Why it isn't direct-tested:** synced from the upstream WASM bindings.
Exercised through the active bridge files above plus the cross-package
WASM integration suite invoked by `npm run test:wasm:integration`
(122 passing / 16 skipped at the time of writing).

### `synced_expression_utils`

**What it covers:** `expression/src/transform/**`. The corresponding
`expression/src/utils/` directory already has its own direct test
files (`utils-array.test.ts`, `utils-bignumber-formatter.test.ts`,
etc.); only the transforms remain in this bucket.

**Why it isn't direct-tested:** synced. Exercised transitively by
the parser, evaluator, and node tests (every AST node has its own
direct test file, and they all call into the transforms during
parse / compile / evaluate).

### `synced_core_helpers`

**What it covers:** `core/src/{bignumber, function, types/matrix,
types/unit}/**` plus the synced helpers at the `core/src/` root
(`array.ts`, `customs.ts`, `emitter.ts`, `factory.ts`, `function.ts`,
`is.ts`, `latex.ts`, `map.ts`, `number.ts`, `object.ts`,
`optimizeCallback.ts`, `scope.ts`, `string.ts`, `create.ts`, and the
type-definition wrappers under `core/src/types/`).

**Why it isn't direct-tested:** hand-ported analogues of mathjs's own
utilities. Exercised through the active `core/src/numeric/` (`BigNumber`,
`Complex`, `Fraction`), `core/src/typed/`, and `core/src/factory/`
modules, which all have direct test files (`BigNumber.test.ts`,
`Complex.test.ts`, `Fraction.test.ts`, `typed.test.ts`, etc.).

### `assemblyscript_sources`

**What it covers:** every file under `assembly/src/`.

**Why it isn't direct-tested:** AssemblyScript is not a Vitest target.
A vitest `*.test.ts` cannot meaningfully import an `.ts` file that
uses AssemblyScript-only syntax — the file won't parse in TypeScript's
compiler. Exercised end-to-end by the cross-package WASM integration
suite at `tests/wasm/` invoked by `npm run test:wasm:integration`
(122 passing / 16 skipped).

### `type_only_barrels`

**What it covers:** `functions/src/core/config.ts` (interface-only
`ConfigOptions` definitions) and `functions/src/types.ts` (a
type-only re-export barrel).

**Why it isn't direct-tested:** no runtime to test. A direct-import
test would be a no-op. If the types regress, every consumer's
`tsc --noEmit` catches it.

## How to read the two numbers

When the raw and effective figures diverge significantly, that's a
signal — not of poor test discipline, but of a healthy synced /
generated / barrel layer. The thing to watch is the `active_untested`
row in `TEST_COVERAGE.md`'s breakdown table:

| `active_untested` count | What it means                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------- |
| **0**                   | Every active file has at least one direct-import test. Healthy.                    |
| **1–10**                | A handful of new files added since the last test pass. Catch up in the next slice. |
| **> 10**                | Coverage is regressing. Investigate.                                               |

## How to maintain the policy

1. **Adding a new active file?** Write a `*.test.ts` that directly
   imports it. The CDG counts it automatically.
2. **Adding a new synced category** (running the mathjs sync script
   on a new mathjs directory)? Add the prefix to
   `coverage-policy.json` under the matching `synced_*` category. Re-
   run CDG; the effective number stays accurate.
3. **Adding a new type-only file** that genuinely has no runtime?
   Add its path to `type_only_barrels.exactPaths`. Don't use prefixes
   here — type-only files are individual.
4. **Removing a category** (e.g. de-syncing a directory and writing
   real tests for it)? Remove the prefix; the files now count as
   active and need real tests.

## How the tool consumes the policy

`tools/create-dependency-graph/create-dependency-graph.ts` calls
`loadCoveragePolicy(rootDir)`, which reads
`docs/Architecture/coverage-policy.json`. If the file is missing or
malformed, the tool stays backwards-compatible — only the raw number
is reported. With the policy loaded, the tool builds a
`CategoryBreakdown` over every untested file and emits:

- `coverage-policy.json` is the source of truth.
- `TEST_COVERAGE.md` gains the "Coverage (effective, active code only)"
  row and the "Untested-file breakdown by category" table.
- `test-coverage.json`'s `metadata.effectiveCoverage` carries the
  same data as a machine-readable object, with a per-file
  classification under `classifiedUntested` (category = `null` for
  active gaps).
