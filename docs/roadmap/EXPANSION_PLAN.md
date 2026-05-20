# MathTS Expansion Plan

**Status**: Draft v1 — pending adversarial review
**Derived from**: `docs/roadmap/GAP_ANALYSIS_BRIDGES_AND_MATH_FUNCTIONS.md`
**Goal**: Execute all 11 roadmap items — close the bridge gaps and the
physical-constants function gap.

---

## Guiding constraints (apply to every workstream)

1. **Do not break the public API.** Existing exports keep their names and
   signatures. New behaviour is additive or opt-in.
2. **Preserve the three security invariants** (WASM SHA-384, expression sandbox,
   WorkerPool timeout). The workbook rewrite must *adopt* the sandbox, not
   re-bypass it.
3. ESM rules per package — `.js` import extensions everywhere except `tensor/`.
4. Conventional Commits; one commit per workstream so a bad change is revertible.
5. Verify each workstream before moving on: `npx tsc --noEmit` for the touched
   package(s) + `npx vitest run` for affected tests.
6. No new runtime dependencies unless unavoidable; reuse what each package
   already has.

---

## Workstreams

### W1 — Activate the 52 physical constants  *(roadmap #2, P0, S)*

**Goal**: Expose mathjs's physical constants as named exports.

- Source factories already exist in
  `functions/src/type/unit/physicalConstants.ts` (`createSpeedOfLight`, …).
  Each takes `{ config, Unit, BigNumber }` and returns a `Unit` or `number`.
- `factoryScope` already provides `config`, `BigNumber`, and `Unit` (built in
  tier 12 of `factories/index.ts`).
- **Steps**: in `factories/index.ts`, after tier 12, add a "Tier 19 — physical
  constants" block: import all 52 `create*` from
  `../type/unit/physicalConstants.js`, call each with `factoryScope`, `export
  const`. They are leaf factories — no inter-dependencies.
- **Verify**: typecheck functions; assert `speedOfLight.toNumber('m/s') ===
  299792458` in a new test `functions/tests/physical-constants.test.ts`.
- **Docs**: add a "Physical Constants" section to `docs/reference/constants.md`.

### W2 — Fix factory stubs (`isInteger`, `det`, `reshape`)  *(roadmap #5, P1, S)*

- `factories/index.ts` currently wires an inline `isInteger` stub. Replace with
  the real `createIsInteger` factory (`../utils/isInteger.js`), activated in
  tier 1 (no deps beyond `typed`).
- `det` activates in tier 3 with a `multiplyScalar` stub for `multiply`. Move
  the real `det` activation to **after tier 12** (where `multiply` becomes the
  full typed implementation) so it works on non-scalar matrices.
- `reshape` uses the inline `isInteger` stub — once the real `isInteger` exists,
  pass it instead.
- **Verify**: typecheck; test `det` on a 3×3 non-trivial matrix.

### W3 — Wire `.mtsw` workbook cells through the expression engine  *(roadmap #1, P0-critical, M)*

- `workbook/src/executor.ts#executeCode()` uses `new Function(...)`. Replace
  with `evaluate()` from `@danielsimonjr/mathts-functions`.
- Add `@danielsimonjr/mathts-functions` to `workbook/package.json` dependencies
  (workbook → functions; no cycle — functions never imports workbook).
- Dependency outputs become the `evaluate` scope object (`{ [depId]: output }`).
- Keep a guarded fallback: if a cell is plain JS (not a math expression),
  surface a clear error rather than silently `new Function`-ing it — the raw
  `Function` path is removed for security.
- **Verify**: typecheck workbook; existing `workbook/tests/executor.test.ts`
  must pass (adjust expectations if cells used JS-only syntax); add a test that
  a cell `sin(pi/2)` evaluates to `1`.

### W4 — Implement `executeData()` (YAML/JSON)  *(roadmap #8, P2, S)*

- `workbook/src/executor.ts#executeData()` is a TODO stub. Parse `cell.content`
  with the `yaml` package (already a workbook dependency) — YAML is a superset
  of JSON, so one `yaml.parse()` covers both.
- **Verify**: test a data cell with YAML and with JSON content.

### W5 — Make the `compat` package real  *(roadmap #3, P1, M)*

- `compat/src/index.ts`: `all` is empty and `create()` ignores `_factories`.
- Re-export the **entire** `@danielsimonjr/mathts-functions` namespace as `all`.
- `create(all, config)` returns a `MathInstance` built by spreading the
  functions namespace (plus the existing `shims` for type constructors and
  constants), respecting `config`.
- Keep the typed `MathInstance` interface but widen it to `Record<string,
  unknown> & {…known members…}` so new functions surface without hand-editing.
- **Verify**: typecheck compat; `create(all).det` and `create(all).integrate`
  are functions; existing `compat/tests` pass.

### W6 — Route matrix factories through the native backend  *(roadmap #4, P1, L)*

- The `MathJSDenseMatrix` adapter has `toNative()`/`fromNative()` but nothing
  calls them.
- Add `MatrixWasmBridge`-style acceleration: in `matrix-bridge.ts`, give
  `MathJSDenseMatrix` a `multiply()` instance method that, above an element
  threshold, converts to native `DenseMatrix`, calls `BackendManager`, converts
  back. Same for `transpose()`.
- Route the factory `multiply`/`transpose` through these when both operands are
  `MathJSDenseMatrix`.
- **Verify**: numeric parity between adapter and native paths on a 64×64
  product; typecheck functions + matrix.

### W7 — Tensor ↔ DenseMatrix converters  *(roadmap #6, P2, L)*

- Add `Tensor.fromDenseMatrix(m)` and `Tensor.prototype.toDenseMatrix()` (rank-2
  tensors only). `autograd` can then accept matrix data.
- Add a thin `autograd` helper `gradientOf(fn, x)` that traces a scalar-valued
  function of a `Tensor` — the converters make matrix inputs usable.
- **Verify**: round-trip a 3×3 matrix Tensor↔DenseMatrix; typecheck tensor +
  autograd.

### W8 — Transparent size-based parallel dispatch  *(roadmap #7, P2, M)*

- Keep the `parallel*` names (public API stability) but have the **default**
  typed functions auto-dispatch: when given a `Float64Array` above the
  threshold, route to the pool.
- This is already true for arithmetic/trig; extend the pattern to `statistics`
  so `mean(Float64Array)` works without the `parallelStat` prefix.
- **Verify**: `mean(largeFloat64Array)` returns the same value as
  `parallelStatMean`.

### W9 — Parser object, type-conversion exports, reviver/replacer  *(roadmap #9, P3, M)*

- Export `complex`, `fraction`, `bignumber`, `matrix`, `number`, `string`,
  `boolean`, `bigint` as named functions from `functions` (the `create*`
  factories or scope helpers already exist).
- Add a stateful `parser()` that wraps `evaluate` with a retained scope object.
- Add real `reviver`/`replacer` for JSON round-tripping of `Complex`/`Fraction`.
- **Verify**: typecheck functions; `parser()` retains variables across calls.

### W10 — JS FFT fallback in `MatrixWasmBridge`  *(roadmap #10, P3, S)*

- `matrix/src/backends/MatrixWasmBridge.ts:350` throws "not implemented".
  Implement a pure-JS radix-2 FFT fallback.
- **Verify**: FFT of a known signal matches the WASM path within tolerance.

### W11 — Keep `functions.md` from drifting  *(roadmap #11, P3, S)*

- Add `functions/tests/docs-sync.test.ts`: parse the function names out of
  `docs/reference/functions.md` and assert every one is a real export of the
  package (and flag exports missing from the doc as a soft warning).
- **Verify**: the test passes against the current doc.

---

## Sequencing

```
W1  W2  W11   →  independent, do first (functions package, low risk)
W10           →  independent (matrix package)
W4            →  independent (workbook)
W3            →  after W4 (same file), needs functions built
W6            →  after W1/W2 (same package, factories/index.ts + matrix-bridge)
W9            →  after W1 (same factories/index.ts area)
W8            →  after W2
W5            →  LAST — re-exports the whole functions namespace, so it should
                 see W1/W6/W8/W9 additions
W7            →  independent (tensor/autograd)
```

Commit order: W1, W2, W11, W10, W4+W3, W6, W9, W8, W7, W5.

## Verification strategy

- Per workstream: `npx tsc --noEmit` in the touched package(s).
- After functions changes: `npx vitest run` in `functions/`.
- After all workstreams: `npm run typecheck` + `npm run test` from root if the
  environment allows (Turbo); otherwise per-package.
- The three security-invariant regression tests must stay green.

## Explicitly out of scope

- Full re-platforming of every matrix factory onto native types (W6 covers
  `multiply`/`transpose` only — the highest-value ops).
- Reverse-mode autodiff *through* arbitrary `functions` calls (W7 delivers the
  converters + a forward-mode helper, not full library-wide tracing).
- Publishing / version bumps (Changesets) — left for a release commit.
