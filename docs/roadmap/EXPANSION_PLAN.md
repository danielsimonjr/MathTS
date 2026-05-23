# MathTS Expansion Plan

**Status**: v3 — executed (all workstreams complete; see Execution Log)
**Derived from**: `docs/roadmap/GAP_ANALYSIS_BRIDGES_AND_MATH_FUNCTIONS.md`
**Goal**: Execute the 11 roadmap items — close the bridge gaps and the
physical-constants function gap.

> **v2 changelog** (adversarial review findings folded in):
>
> - W1 scoped to **number-mode only** — the synced factories' BigNumber path
>   needs decimal.js semantics that core's `BigNumber` does not provide, and
>   `Unit` rejects core-BigNumber values. Default config uses `number` mode, so
>   the constants work; the test must cover that explicitly.
> - W2 tier corrected — `createIsInteger` needs `['typed','equal']`, so it
>   activates **after tier 4**, not tier 1. `reshape`'s inline stub is correct
>   for numeric dimensions and is left alone.
> - W6 **redesigned** — native `DenseMatrix.multiply/transpose` are plain JS and
>   do _not_ use `BackendManager`. Route through `BackendManager` directly
>   (its `multiply`/`transpose` are sync) after pre-initialising it.
> - W8 **re-scoped** — auto-dispatching `Float64Array` to the async pool would
>   turn a sync return into a `Promise` (breaking). No return-type changes;
>   W8 becomes an audit + doc of the _existing_ additive overloads.
> - Added **W0 — export-surface collision audit** as a prerequisite for W5/W9.
> - W7 must declare a new `tensor → matrix` workspace dependency.
> - W3 must rewrite two `executor.test.ts` cases that use JS-only syntax.

---

## Guiding constraints

1. **Do not break the public API** — names, signatures, and sync/async contract
   of existing exports are preserved. New behaviour is additive or opt-in.
2. **Preserve the three security invariants.** The workbook adopts the
   expression evaluator (which routes through the safe-access sandbox) —
   strictly safer than the `new Function` it replaces.
3. ESM `.js` import extensions per package (`tensor/` excepted).
4. Conventional Commits; one commit per workstream — bad changes stay revertible.
5. Verify each workstream: `npx tsc --noEmit` for touched packages +
   `npx vitest run` for affected tests.

---

## W0 — Export-surface collision audit _(prerequisite, S)_

`functions/src/index.ts` does `export *` over both `typed/` and `factories/`.
A name exported by both barrels becomes an ambiguous star-export that resolves
to `undefined` with no compile error.

- **Step**: script the intersection of typed-barrel names and factory-barrel
  names. Confirm the `factory_` prefix scheme leaves zero genuine collisions.
- If any collision exists, fix it before W5/W9 (which re-export the namespace).
- **Outcome**: a documented clean bill of health, or a fix.

---

## Workstreams

### W1 — Activate the 52 physical constants _(#2, P0, S)_

- Factories live in `functions/src/type/unit/physicalConstants.ts`; each takes
  `{ config, Unit, BigNumber }`. Under the **default config** (`number:
'number'`) `unitFactory`/`numberFactory` take the `parseFloat` branch and
  produce a plain `number` (or a `Unit` wrapping a `number`) — no `new
BigNumber` call, no `Unit` type-rejection. **BigNumber mode is out of scope.**
- **Steps**: in `factories/index.ts`, after tier 12 (where `Unit` exists), add a
  "Tier 19 — physical constants" block: import all 52 `create*`, call each with
  `factoryScope`, `export const`.
- **Verify**: `functions/tests/physical-constants.test.ts` — assert
  `speedOfLight.toNumber('m/s')` ≈ `299792458` and a dimensionless one
  (`fineStructure`). Do **not** assert on `josephson` (value string carries
  units — upstream quirk).
- **Docs**: add a "Physical Constants" section to `docs/reference/constants.md`.

### W2 — Fix factory stubs (`isInteger`, `det`) _(#5, P1, S)_

- Activate the real `createIsInteger` (`../utils/isInteger.js`, deps
  `['typed','equal']`) **after tier 4** (`factory_equal` is in scope there);
  `export const isInteger`.
- Relocate the `det` activation to **after tier 12** (`factoryScope.multiply`
  becomes the full typed impl there). Nothing between tiers 3–12 reads
  `factoryScope.det`, so this is safe.
- Leave `reshape`'s inline `isInteger` stub — it only validates numeric
  dimensions, for which the stub is correct.
- **Verify**: typecheck; `isInteger(4) === true`, `isInteger(4.5) === false`;
  `det` on a non-trivial 3×3.

### W3 — Workbook cells through the expression engine _(#1, P0-critical, M)_

- Replace `new Function(...)` in `workbook/src/executor.ts#executeCode()` with
  `evaluate()` from `@danielsimonjr/mathts-functions`. This is the evaluator
  wired to the full math scope; it parses to AST nodes whose property access
  routes through the expression sandbox — removing the raw-`Function` bypass.
- Add `@danielsimonjr/mathts-functions` to `workbook/package.json` deps (no
  cycle — `functions` never imports `workbook`). Note: importing `functions`
  runs its 18-tier factory init at module load — accepted cost.
- Dependency outputs form the `evaluate` scope (`{ [depId]: output }`). On a
  parse/eval failure, surface a clear error (no `new Function` fallback).
- **Rewrite** the two `executor.test.ts` cases that use JS-only syntax
  (`const v = 3; return v*v` and `throw new Error("deliberate")`) into math
  expressions; add a `sin(pi/2) → 1` cell test.
- **Verify**: typecheck workbook; `vitest run` workbook.

### W4 — Implement `executeData()` (YAML/JSON) _(#8, P2, S)_

- `executeData()` is a TODO stub. Parse `cell.content` with the `yaml` package
  (already a workbook dep) — YAML parses JSON too.
- **Verify**: data cell with YAML and with JSON; existing data-cell tests
  (`'json-data'`, `'data'`) still pass (YAML scalars round-trip).

### W6 — Accelerated matrix-bridge multiply/transpose _(#4, P1, M — redesigned)_

- Native `DenseMatrix.multiply/transpose` are plain JS; `BackendManager`'s
  `multiply`/`transpose` are the accelerated, **synchronous** entry points.
- Pre-initialise a shared `BackendManager` (fire-and-forget `initialize()`) at
  `matrix-bridge.ts` module load.
- Add `MathJSDenseMatrix.prototype.multiply(other)` /
  `.transpose()` that convert to `Float64Array` data, call
  `backendManager.multiply/transpose`, and wrap the result. Before WASM init
  resolves these route to the JS backend — correct, just not yet accelerated.
- The factory `multiply`/`transpose` keep their current behaviour; the new
  instance methods are additive and opt-in.
- **Verify**: numeric parity adapter-vs-native on a 64×64 product; typecheck.

### W7 — Tensor ↔ DenseMatrix converters _(#6, P2, L)_

- Add `Tensor.fromDenseMatrix(m)` and `Tensor.prototype.toDenseMatrix()`
  (rank-2 only; throw for other ranks).
- **Declare the new dependency**: add `@danielsimonjr/mathts-matrix` to
  `tensor/package.json` and a tsconfig project reference. `matrix` does not
  import `tensor` → no cycle.
- **Verify**: round-trip a 3×3 matrix; typecheck tensor.

### W8 — Audit & document parallel auto-dispatch _(#7, P2, S — re-scoped)_

- The active `add`/`multiply`/`sin`/`mean` etc. in `typed/arithmetic.ts`
  **already** auto-dispatch `Float64Array` to the pool (returning a `Promise`).
  Changing that contract further would be breaking.
- W8 = **verify** the existing dispatch works and **document** it accurately in
  `functions.md` (already done in the Parallel Return Type section). No code
  change to return types. If a genuinely missing `Float64Array` overload is
  found, add it as a _separate_ `Promise`-returning path.
- **Verify**: confirm `mean(Float64Array)` resolves to the same value as
  `parallelStatMean`.

### W9 — Type-conversion exports, `parser()`, reviver/replacer _(#9, P3, M)_

- Export `complex`, `fraction`, `bignumber`, `matrix`, `number`, `string`,
  `boolean`, `bigint` as named functions (collision-free per W0 — none are
  exported by the typed barrel today). Use the scope helpers / `create*`
  factories.
- Add a stateful `parser()` returning `{ evaluate, get, set, scope }` over a
  retained scope object.
- Add `reviver`/`replacer` for JSON round-tripping of `Complex`/`Fraction`.
- **Verify**: typecheck; `parser()` retains variables; `reviver(replacer(c))`
  round-trips a `Complex`.

### W10 — JS FFT fallback in `MatrixWasmBridge` _(#10, P3, S)_

- `MatrixWasmBridge.ts:~350` throws "not implemented". Implement a synchronous
  **radix-2** FFT (power-of-2 lengths only; throw a clear error otherwise),
  matching the bridge's interleaved-complex `Float64Array` layout (real/imag
  pairs) and the existing inverse-scaling convention.
- **Verify**: FFT of a known signal matches the WASM path within tolerance.

### W11 — Keep `functions.md` from drifting _(#11, P3, S)_

- Add `functions/tests/docs-sync.test.ts`: extract `` `name(` `` tokens from
  `docs/reference/functions.md` and assert each resolves to a real package
  export. Use a small allow-list for documented-but-aliased names
  (`indexFn`/`index`, `factory_*`). Hard-fail on unknown names.
- **Verify**: the test passes against the current (Revision 2) doc.

### W5 — Make the `compat` package real _(#3, P1, M — runs last)_

- `compat/src/index.ts`: set `all` to the full `@danielsimonjr/mathts-functions`
  namespace. `create(all, config)` returns `{ ...all, ...shims, config }` —
  `all` provides breadth, `shims` overlay the compat-specific type constructors
  and constants (deliberate precedence: shims win for the names they define).
- **Keep `MathInstance`'s precise members**; add an index signature
  `[name: string]: unknown` for the new breadth — precise members stay
  type-safe, so no break for existing typed consumers.
- **Verify**: typecheck compat; `create(all).det` / `.integrate` are functions;
  `create(all).add` keeps its precise type; existing `compat/tests` pass.

---

## Sequencing & commit order

```
W0  → audit (no commit unless a fix is needed)
W11 → functions: docs-sync test
W2  → functions: isInteger / det
W1  → functions: physical constants
W4  → workbook: executeData
W3  → workbook: evaluate wiring + test rewrites   (after W4 — same file)
W10 → matrix: FFT fallback
W6  → functions+matrix: accelerated bridge
W9  → functions: conversions / parser / reviver
W8  → functions: audit (doc-only; commit only if code changes)
W7  → tensor: converters + dependency
W5  → compat: rebuild (LAST — sees W1/W6/W9 additions)
```

## Verification strategy

- Per workstream: `npx tsc --noEmit` in touched package(s) +
  `npx vitest run` for affected tests.
- The three security-invariant regression tests must stay green.
- Final: `npm run typecheck` from root if the environment allows.

## Explicitly deferred (not in this pass)

- BigNumber-mode physical constants (needs a decimal.js-compatible BigNumber or
  an `isBigNumber` marker on core's class).
- Routing _every_ matrix factory onto native types — W6 covers the
  `multiply`/`transpose` instance path only.
- Reverse-mode autodiff _through_ arbitrary `functions` calls — W7 ships
  converters only.
- Changesets / version bumps / publish.

---

## Execution Log (v3)

All 11 workstreams implemented, each in its own commit, verified by tests.

| WS  | Status             | Notes                                                                                                                                                                                                                                                           |
| --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W0  | Done               | Audit clean — **zero** collisions between the typed and factory barrels.                                                                                                                                                                                        |
| W1  | Done               | 52 physical constants activated as "tier 19" of `factories/index.ts`; `functions/tests/physical-constants.test.ts`.                                                                                                                                             |
| W2  | Done (adjusted)    | Real `createIsInteger` activated after tier 4. **Deviation**: the `det` relocation was reverted — `inv` (tier 4) depends on `det`, so `det` stays at tier 3; its internal `multiply` use is scalar-only, so the `multiplyScalar` binding is correct, not a bug. |
| W3  | Done               | Workbook `executeCode()` now calls `evaluate()`; raw `new Function` removed; ambient `workbook/src/functions.d.ts` added; two JS-syntax tests rewritten as math expressions.                                                                                    |
| W4  | Done               | `executeData()` parses cell content as YAML/JSON.                                                                                                                                                                                                               |
| W5  | Done               | `compat` `all` = full functions namespace; `create()` honours it; `MathInstance` keeps precise members + index signature.                                                                                                                                       |
| W6  | Done               | `MathJSDenseMatrix.multiply/transpose()` route through `BackendManager`; manager pre-initialised at module load.                                                                                                                                                |
| W7  | Done               | `Tensor.fromDenseMatrix` / `toDenseMatrix`; `tensor → matrix` dependency declared.                                                                                                                                                                              |
| W8  | Done (verify-only) | Confirmed `sum`/`mean` already auto-dispatch `Float64Array` to the pool; no return-type change (that would be breaking). Test added.                                                                                                                            |
| W9  | Done (adjusted)    | Conversion exports, `parser()`, `reviver`/`replacer`. **Deviation**: `parser()` does not support assignment expressions inside `evaluate` — the expression security validator rejects `AssignmentNode`; retained state is managed via `set`/`get`.              |
| W10 | Done               | Radix-2 Cooley-Tukey JS FFT fallback in `MatrixWasmBridge`.                                                                                                                                                                                                     |
| W11 | Done               | `functions/tests/docs-sync.test.ts` guards `functions.md` against export drift.                                                                                                                                                                                 |

**Verification**: `functions` 1469 tests / 41 files green; `matrix` + `tensor` +
`workbook` + `compat` 612 passing / 7 skipped / 27 files green. No regressions.
Touched packages build cleanly; `compat`/`workbook`/`tensor`/`matrix` typecheck
clean; the new `functions` code adds no `tsc` errors beyond the package's
pre-existing synced-code baseline.
