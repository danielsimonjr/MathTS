# Gap Analysis — Bridges & Missing Math Functions

**Generated**: 2026-05-20
**Revision 2**: 2026-05-20 — re-based on a corrected, complete function
inventory after rewriting `docs/reference/functions.md` to match the actual
package exports (see Part 1 / Part 3.5).
**Revision 3**: 2026-06-29 — full re-validation of all 10 bridges + the
function surface against current `main` (HEAD `45ebe78`), after the Workbook
workstream and the 2026-06-27 dormant purge. **Most of this report's severe
gaps are now closed.** Sections below (Parts 1–4) are preserved as the
2026-05-20 baseline; **[Part 5](#part-5--revision-3-re-validation-2026-06-29)
carries the current status and the new gaps.** When the two disagree, Part 5
wins.

> **Revision 3 TL;DR.** Of the five material gaps in the original scorecard,
> **three are resolved** (B5 compat, B7 workbook, B3 FFT-fallback), **one is
> half-built** (B8 tensor/autograd), and **one persists** (B2 matrix factory
> bridge). Every Part-3 *user-facing* function gap is closed — the 52 physical
> constants, the 10 type-conversion functions, `isInteger`, stateful
> `parser()`, and public JSON `reviver`/`replacer` are all wired; dormant
> factories fell 102 → 39 (now all internal-by-design). The export surface grew
> ~518 → **735**. The genuinely-open work is now a *different, smaller* set —
> see [Part 5 §New gaps](#new-gaps-surfaced-by-this-re-validation).
**Scope**: Whole monorepo — integration "bridges" between packages, and the
mathematical-function surface area (active / dormant / missing).
**Canonical function inventory**: `docs/reference/functions.md` (now current).
**Supersedes (partially)**: `docs/roadmap/MATHJS_SYNC_ROADMAP.md` (2026-04-10).
That document predates the large `functions/src/typed/` build-out and the
18-tier factory activation; its "207 missing functions" figure is no longer
accurate — see Part 3.

---

## Executive Summary

MathTS now has a **broad and largely complete mathematical-function surface**.
The `functions` package exposes three layers — ~354 native "typed" functions,
161 newly-activated mathjs factory functions, and 72 factory functions shadowed
by typed equivalents (~518 documented public exports in total). The April
roadmap's Phase 1–3 backlog (CAS, graph theory, distributions, hypothesis tests,
special functions, numerical methods) has been substantially delivered as native
TypeScript in `functions/src/typed/`.

The remaining gaps are **not primarily missing functions** — they are **missing
or weak bridges** between packages. The mathematics exists; the wiring that lets
each subsystem reach it does not. Seven of the codebase's ten integration points
are healthy; five carry material gaps, three of them severe.

### Scorecard

> ⚠️ **This scorecard is the 2026-05-20 baseline.** For current status see the
> [Revision 3 updated scorecard](#updated-scorecard) — B5/B7 are now Healthy,
> B3 FFT-fallback is resolved, B8 is Partial, only B2 persists.

| #   | Bridge                                      | Status         | Completeness |
| --- | ------------------------------------------- | -------------- | ------------ |
| B1  | typed-function type registration            | Healthy        | 100%         |
| B2  | Matrix factory bridge (`MathJSDenseMatrix`) | **Weak**       | ~65%         |
| B3  | Matrix backend selection (`BackendManager`) | Healthy        | ~95%         |
| B4  | WASM loaders (AssemblyScript)               | Healthy        | ~95%         |
| B5  | `compat` package (mathjs API shim)          | **Severe gap** | ~25%         |
| B6  | expression ↔ functions scope                | Healthy        | 100%         |
| B7  | workbook ↔ expression/functions             | **Severe gap** | ~10%         |
| B8  | tensor ↔ autograd ↔ matrix/functions        | **Severe gap** | ~0%          |
| B9  | parallel ↔ typed functions                  | **Weak**       | ~40%         |
| B10 | AssemblyScript WASM toolchain               | Healthy        | ~95%         |

### Function surface

Counts below are derived from a precise extraction of every public `export` in
`functions/src/typed/*.ts` and `functions/src/factories/index.ts` and are now
mirrored 1:1 in `docs/reference/functions.md`.

| Layer                                   |    Count | Notes                                            |
| --------------------------------------- | -------: | ------------------------------------------------ |
| Active typed functions                  |     ~354 | `functions/src/typed/` (17 modules)              |
| Active factory functions (unique)       |      161 | activated via `factories/index.ts` tiers 1–18    |
| Expression functions                    |        3 | `evaluate`, `compileExpr`, `parse`               |
| **Total public function exports**       | **~518** | the documented API surface                       |
| Active factory functions (shadowed)     |       72 | `factory_`-prefixed, typed impl takes precedence |
| Dormant factory files                   |      102 | synced but never activated — see Part 3          |
| Genuinely missing user-facing functions |      ~52 | physical constants (entirely dormant)            |

---

## Methodology

- Read the function index files: `functions/src/index.ts`,
  `functions/src/typed/index.ts`, `functions/src/factories/index.ts`.
- Extracted every public `export const`/`export function` from all 17 typed
  modules and every `export const` from `factories/index.ts`, then **rewrote
  `docs/reference/functions.md`** to mirror that surface 1:1 (Revision 2). The
  function-reference doc is now the canonical inventory this analysis uses.
- Enumerated all 328 `export const create*` factory files under the 19 synced
  category directories and diff'd them against the 259 `create*` identifiers
  referenced in `factories/index.ts` to derive the dormant set (102).
- Read every bridge/adapter file: `typed-bridge.ts`, `matrix-bridge.ts`,
  `scope.ts`, `evaluate.ts`, `compat/src/{index,shims}.ts`,
  `workbook/src/executor.ts`, `matrix/src/backends/*`.
- Cross-referenced against `factoriesAny.ts` (372 factory refs),
  `factoriesNumber.ts` (225 refs), and `docs/reference/constants.md` for full
  mathjs API and constant coverage.

---

## Part 1 — Current Capability Inventory

### 1.1 Active typed functions (`functions/src/typed/`)

The parallel-first native layer. All 17 modules are re-exported from
`functions/src/typed/index.ts` and from the package root. Counts below are exact
(internal pool-management helpers such as `initializePool`/`terminateSignal`
excluded). Every name is now catalogued in `docs/reference/functions.md`.

| Module             | Domain                                                         | Public fns |
| ------------------ | -------------------------------------------------------------- | ---------: |
| `arithmetic.ts`    | add/sub/mul/div, powers, logs, rounding, gcd/lcm, norm, matmul |         48 |
| `trigonometry.ts`  | sin/cos/tan + inverses + hyperbolic, hypot, deg/rad            |         19 |
| `combinatorics.ts` | fibonacci/lucas, factorials, primes, number theory             |         21 |
| `statistics.ts`    | parallel sum/mean/var/std/…/quantile + O(n) selection          |         21 |
| `signal.ts`        | FFT2D, DCT/DST, DWT, filters, convolution/correlation          |         30 |
| `special.ts`       | Bessel, beta/gamma, elliptic, erf, Fresnel, orthogonal polys   |         28 |
| `distributions.ts` | normal/exp/bernoulli/binomial/poisson/geometric PDF/CDF/PMF    |         10 |
| `dist-objects.ts`  | 12 distribution objects (`.pdf`/`.cdf`/`.ppf`/`.sample`)       |         12 |
| `algebra.ts`       | polynomial ops, expand/factor/collect/substitute, trig CAS     |         36 |
| `cas.ts`           | integrate, limit, solve, Laplace, Taylor, vector calculus      |         31 |
| `numeric.ts`       | root finding, optimization, ODE, interpolation, curve fit      |         34 |
| `integration.ts`   | trapz, simpson, romberg, gaussQuad                             |          4 |
| `interpolation.ts` | linear/lagrange/cubic-spline/hermite/pchip, polyFit            |          6 |
| `hypothesis.ts`    | t-test, chi-square, ANOVA, K-S, Mann-Whitney, PCA, Shapiro     |          7 |
| `graph.ts`         | adjacency, shortest path, MST, components, topo sort           |          8 |
| `geometry.ts`      | distances, areas, hulls, Delaunay/Voronoi, kd-tree             |         30 |
| `matrix-ops.ts`    | char. polynomial, Cholesky, Hessenberg, Jordan, rank, RREF     |          9 |
| **Total**          |                                                                |    **354** |

### 1.2 Active factory functions (`functions/src/factories/index.ts`)

161 unique mathjs factory functions are activated across an **18-tier
dependency-ordered cascade** — each tier injects its results into
`factoryScope` so later tiers can resolve their declared dependencies. This is
an elegant solution to mathjs's factory-graph problem, covering: bitwise ops,
set operations, relational ops, sparse linear algebra (`csChol`, `csLu`, `slu`,
`lup`, `qr`, `schur`, `lyap`, `sylvester`), expression nodes + `parse`,
`simplify`/`derivative`/`rationalize`, units (`Unit`, `unit`, `createUnit`),
`Chain`, `eigs`, `fft`/`ifft`, and more.

A further 72 factories are activated under a `factory_` prefix (e.g.
`factory_add`, `factory_multiply`) because a native typed implementation of the
same name already exists and takes precedence in the public namespace.

---

## Part 2 — Bridge Gap Analysis

### B1 — typed-function type registration · Healthy

`functions/src/typed/typed-bridge.ts` → `registerNativeTypes()` in core duck-
types `Complex`/`Fraction`/`BigNumber` so typed-function dispatch recognises
them. `scope.ts` additionally registers 19 extra types (`function`, all 16
expression `*Node` types, `Index`, `Range`, `Map`). No gaps.

### B2 — Matrix factory bridge · Weak (~65%)

**File**: `functions/src/factories/matrix-bridge.ts`

`MathJSDenseMatrix` / `MathJSSparseMatrix` are `number[][]`-backed (and CSC-
backed) adapters that present the mathjs `_data/_size/get/set/map/...` interface
so the 161 activated factories can run unmodified. The CSC sparse implementation
is genuine and well-built.

**Gaps:**

1. **No acceleration path.** The adapter is fully divorced from the native
   `@danielsimonjr/mathts-matrix` `DenseMatrix` (Float64Array + JS/WASM/GPU
   backends). `toNative()`/`fromNative()` exist but **no activated factory ever
   calls them** — every factory matrix op runs on boxed `number[][]` in pure JS.
   Result: `det`, `inv`, `eigs`, `lup`, `qr`, `expm`, `fft` etc. get **none** of
   the WASM/GPU acceleration the matrix package was built to provide.
2. **Two incompatible matrix worlds.** A program can hold both a native
   `DenseMatrix` and a `MathJSDenseMatrix`; they do not interoperate, are not
   `instanceof`-compatible, and `isMatrix` passes for both via duck typing. There
   is no single canonical matrix type.
3. **Stubbed dependencies.** `factories/index.ts` wires `det` with a
   `multiplyScalar` stub for `multiply` ("det will only work on numeric, non-
   symbolic matrices"), and `reshape` with an inline `isInteger` stub. `add`/
   `multiply` are scalar stubs until tier 12 upgrades them.
4. **`SparseMatrix.map` skips structural zeros** (noted in-file) — incorrect for
   callbacks that map `0 → nonzero`.

### B3 — Matrix backend selection · Healthy (~95%)

`matrix/src/backends/BackendManager.ts` cleanly routes by element count and
operation across `JSBackend`, `WASMBackend` (AssemblyScript), and `GPUBackend`,
with per-operation thresholds, adaptive threshold tuning, and fallback-on-error.
Minor gap: the matrix WASM bridge throws _"JavaScript FFT fallback not
implemented in bridge"_ — one un-covered fallback path.

### B4 — WASM loaders · Healthy (~95%)

Single loader (`WasmLoader.ts`) for the AssemblyScript WASM binary. SHA-384
manifest verification is enforced on the load path per the security invariants.
Healthy.

### B5 — `compat` package · Severe gap (~25%)

**Files**: `compat/src/index.ts`, `compat/src/shims.ts`

The mathjs migration shim is the **most under-built bridge relative to its
promise**.

- `export const all` is an **empty object** with a comment "Placeholder".
- `create(_factories, config)` **ignores `_factories` entirely** (the parameter
  is underscore-prefixed). `create(all)` and `create({})` behave identically.
- `shims.ts` imports only **~22 functions** from `@danielsimonjr/mathts-functions`
  (`add, subtract, multiply, divide, pow, sqrt, abs, exp, log, sin, cos, tan,
sum, mean, min, max, gcd, lcm, round, floor, ceil` + matrix helpers). The
  `functions` package exports **500+**.
- The returned `MathInstance` is a **hand-maintained list of ~50 properties**.
  Adding a function to `functions/` does not surface it in `compat`.

Net effect: a mathjs user migrating via `create(all)` gets ~50 of mathjs's
~280-function API. The compat layer is effectively a façade.

### B6 — expression ↔ functions scope · Healthy

`evaluate.ts` composes `mathScope` from `factoryScope` + all activated factories

- all typed functions + constants, and feeds it to `createEvaluate`. The
  expression evaluator sees the full library. The sandbox helpers
  (`getSafeProperty`/`getSafeMethod`) are intact per the security invariants.

### B7 — workbook ↔ expression/functions · Severe gap (~10%)

**File**: `workbook/src/executor.ts:139-165`

The `.mtsw` Scientific Workbook runtime **does not use the MathTS expression
engine or the functions package at all**. `executeCode()` evaluates each cell
with the raw JavaScript `Function` constructor:

```ts
const fn = new Function(...scopeKeys, `return (${cell.content});`);
```

Consequences:

1. **No math library in notebooks.** A cell cannot call `sin`, `matrix`,
   `derivative`, `fft`, … — only whatever exists on the JS global. The headline
   feature of a "Scientific Workbook" is unreachable.
2. **Security-invariant bypass.** The expression package maintains a hardened
   evaluation sandbox (a documented hard invariant). The workbook routes around
   it entirely — `new Function(cell.content)` is unrestricted code execution.
3. **`executeData()` is a stub** — `// TODO: Parse YAML/JSON data` returns the
   raw string.

This is the single largest functional gap in the repository: an entire package
(`expression`, plus all of `functions`) is built but not connected to the
product that most needs it.

### B8 — tensor ↔ autograd ↔ matrix/functions · Severe gap (~0%)

`tensor` and `autograd` form an **isolated island**. Confirmed: no package
outside `autograd/` imports `@danielsimonjr/mathts-tensor`.

- No `Tensor ↔ DenseMatrix` converter (both are Float64Array-backed but
  structurally unrelated).
- `autograd` differentiates only over `Tensor` ops it defines itself. It cannot
  differentiate any function in `functions/` — no `grad(sin)`, no gradient of a
  `matrix-ops` routine, no autodiff through `evaluate`.
- `Tensor` ops do not reach `BackendManager`, so tensors get no WASM/GPU path.

The autodiff capability exists but is wired to nothing the rest of the library
produces or consumes.

### B9 — parallel ↔ typed functions · Weak (~40%)

`ComputePool`/`WorkerPool` are mature, and `arithmetic.ts` (`matmul` and
friends) plus `statistics.ts`/`signal.ts` do dispatch to the pool. But the
parallel path is **opt-in by a separate name**, not transparent:

- Parallelism is reached via distinctly-named exports — `parallelStatSum`,
  `parallelStatMean`, `parallelFFT`, … — rather than the plain `sum`, `mean`,
  `fft` auto-dispatching by size.
- Coverage is uneven: statistics/signal have parallel variants; most of
  `arithmetic`, all of `special`, `cas`, `numeric`, `matrix-ops` do not.
- There is no `ThresholdDispatcher` integration inside the default typed
  functions, so callers must know to pick the parallel variant themselves.

### B10 — AssemblyScript WASM · Healthy

AssemblyScript is the sole WASM backend, built independently and selected by
`BackendManager` with JS fallback-on-error. Healthy.

---

## Part 3 — Missing & Dormant Math Functions

### 3.1 Dormant factories (synced, never activated) — 102 files

Diff of 328 `create*` factory files against the 259 referenced in
`factories/index.ts` yields 102 dormant factories, which break down as:

| Group                                                                                                       |  Count | Assessment                                                                                       |
| ----------------------------------------------------------------------------------------------------------- | -----: | ------------------------------------------------------------------------------------------------ |
| **Physical constants**                                                                                      | **52** | **Genuine gap — see 3.2**                                                                        |
| Internal matrix-algorithm suite (`MatAlgo01x…14x`, `matrixAlgorithmSuite`, `useMatrixForArrayScalar`)       |     16 | Internal dispatch helpers; dormant because B2 uses the adapter instead. Required if B2 is fixed. |
| Type-class constructors (`createComplexClass`, `createDenseMatrixClass`, `createMatrix`, `createSparse`, …) |     16 | By design — MathTS uses its own native types.                                                    |
| `*Number` number-only variants (`createCeilNumber`, `createCompareNumber`, …)                               |     14 | By design — the `any`-typed versions are activated.                                              |
| Shadowed / unit-aware (`createAdd`, `createMultiply`, `createCompareUnits`, `createTrigUnit`)               |      4 | Shadowed by typed implementations.                                                               |

Only the physical-constants group is a real user-facing gap; the other 50 are
internal-by-design or required only as a consequence of fixing B2.

### 3.2 Physical constants — entirely missing (52)

mathjs ships ~52 physical constants (`speedOfLight`, `planckConstant`,
`avogadro`, `boltzmann`, `gravitationConstant`, `electronMass`, `fineStructure`,
`vacuumImpedance`, `wienDisplacement`, …). **All 52 factory files are synced but
none are activated**, and none have a typed equivalent. They are absent from the
public API, from the `evaluate` scope, and from `compat`. For a "scientific"
math library this is the most visible missing capability.

Activation is low-risk: most are zero-dependency leaf factories that produce a
`number` or a `Unit` — they slot into tier 1 once `Unit` is available (already
built in tier 12).

### 3.3 mathjs API coverage — other gaps

Comparing the now-complete `functions.md` surface against `factoriesAny.ts`:

- **Type-conversion functions**: `complex`, `fraction`, `bignumber`, `number`,
  `string`, `boolean`, `bigint`, `matrix`, `sparse` are _not_ re-exported as
  named functions from the `functions` package. They exist inside `factoryScope`
  (so `evaluate('complex(1,2)')` works) and the underlying classes ship from
  `core`/`matrix`, but a direct `import { complex } from '…/functions'` fails.
- **`isInteger`**: not exported — `factories/index.ts` wires only an inline
  `Number.isInteger` stub into the scope. The real `createIsInteger` factory is
  dormant. (`isNumeric`, `isPrime`, `isFinite`, `isZero`, … _are_ exported.)
- **Help/introspection**: `help`, `docs` — not present (low priority).
- **Stateful `parser()`**: the one-shot `evaluate`/`compileExpr` exist; a
  persistent `Parser` object with retained scope does not.
- **JSON `reviver`/`replacer`**: `factoryScope.replacer` is an identity stub —
  serialization round-tripping of `Complex`/`Unit`/`Matrix` is not wired.
- **`apply`**: present as `mapSlices` (upstream rename) — OK.

Everything else from the pre-split mathjs surface is covered by either the typed
layer or an activated factory.

### 3.4 Status of the April roadmap

`MATHJS_SYNC_ROADMAP.md` listed 207 "missing" v15.4–15.6 functions. The
`functions/src/typed/` build-out has since delivered the great majority:
graph theory (8/8), distribution objects (12/12), hypothesis tests (7/7),
CAS (31), special functions (28), numerical methods (34), extended
combinatorics/number theory (21). That roadmap should be marked **largely
completed/superseded**; the remaining true backlog is the physical constants
and the bridge work below.

### 3.5 Documentation drift — function reference (resolved in Revision 2)

Before this revision, `docs/reference/functions.md` documented roughly **120 of
the ~518 public function exports (~23%)**. It omitted entire categories — set
operations, bitwise, logical, units, type-checking, relational, most special
functions, and most of CAS / numeric / signal / geometry / combinatorics — and
carried stale entries (e.g. `compileExpr` usage, partial CAS lists).

A consumer reading the reference would have concluded the library was a fraction
of its real size. `functions.md` has been **rewritten to mirror the export
surface 1:1** and is now the canonical inventory for this analysis. Treat it,
not the source tree, as the API contract — and keep it in sync (roadmap item 11).

---

## Part 4 — Prioritized Remediation Roadmap

| #   | Item                                                                                                                                           | Bridge / Area | Effort | Priority           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------ | ------------------ |
| 1   | Wire `.mtsw` cells through `evaluate()` from `expression`/`functions`; restore the eval sandbox; remove `new Function`                         | B7            | M      | **P0 — critical**  |
| 2   | Activate the 52 physical constants (tier-1 leaves, after `Unit`)                                                                               | 3.2           | S      | **P0 — quick win** |
| 3   | Make `compat` real: implement `all`, honour `_factories`, generate `MathInstance` from the `functions` namespace                               | B5            | M      | **P1**             |
| 4   | Route matrix factories through native `DenseMatrix` + `BackendManager` (use `toNative`/`fromNative`, or re-base the bridge on the native type) | B2            | L      | **P1**             |
| 5   | Replace `det`/`reshape`/`isInteger` stubs in `factories/index.ts` with real deps                                                               | B2            | S      | **P1**             |
| 6   | Add `Tensor ↔ DenseMatrix` converters; let `autograd` differentiate `functions` ops                                                            | B8            | L      | **P2**             |
| 7   | Transparent size-based parallel dispatch inside default typed functions (retire the `parallel*`-named duplicates)                              | B9            | M      | **P2**             |
| 8   | Implement `executeData()` YAML/JSON parsing in the workbook                                                                                    | B7            | S      | **P2**             |
| 9   | Stateful `Parser` object + JSON `reviver`/`replacer`; export type-conversion fns (`complex`, `matrix`, …)                                      | 3.3           | M      | **P3**             |
| 10  | JS FFT fallback in the matrix WASM bridge                                                                                                      | B3            | S      | **P3**             |
| 11  | Generate/CI-check `docs/reference/functions.md` from the export surface so it cannot drift again                                               | 3.5           | S      | **P3**             |

**Effort key**: S ≤ 1 day · M ≈ 2–5 days · L ≈ 1–2 weeks.

### Recommended sequencing

1. **P0 first** — items 1 & 2 are independent, high-visibility, and low-to-
   medium effort. Item 1 makes the Workbook actually scientific; item 2 is a
   half-day win that closes the only real function gap.
2. **P1** — items 3–5 restore the acceleration story (matrix factories on
   WASM/GPU) and make the migration shim trustworthy.
3. **P2/P3** — autograd integration and parallel-dispatch ergonomics are larger
   architectural efforts; schedule after the correctness gaps are closed.

---

## Appendix A — Bridge file reference

| Bridge | Primary files                                                                            |
| ------ | ---------------------------------------------------------------------------------------- |
| B1     | `core/src/typed/type-bridge.ts`, `functions/src/typed/typed-bridge.ts`                   |
| B2     | `functions/src/factories/matrix-bridge.ts`, `functions/src/factories/scope.ts`           |
| B3     | `matrix/src/backends/BackendManager.ts`, matrix WASM bridge                              |
| B4     | `matrix/src/backends/WasmLoader.ts`, `functions/src/wasm/WasmLoader.ts`                  |
| B5     | `compat/src/index.ts`, `compat/src/shims.ts`                                             |
| B6     | `functions/src/factories/evaluate.ts`                                                    |
| B7     | `workbook/src/executor.ts`                                                               |
| B8     | `tensor/src/`, `autograd/src/`                                                           |
| B9     | `parallel/src/`, `functions/src/typed/{statistics,signal,arithmetic}.ts`                 |
| B10    | `assembly/`                                                                              |

## Appendix B — The 52 dormant physical constants

`atomicMass`, `avogadro`, `bohrMagneton`, `bohrRadius`, `boltzmann`,
`classicalElectronRadius`, `conductanceQuantum`, `coulomb`, `coulombConstant`,
`deuteronMass`, `efimovFactor`, `electricConstant`, `electronMass`,
`elementaryCharge`, `faraday`, `fermiCoupling`, `fineStructure`,
`firstRadiation`, `gasConstant`, `gravitationConstant`, `gravity`,
`hartreeEnergy`, `inverseConductanceQuantum`, `josephson`, `klitzing`,
`loschmidt`, `magneticConstant`, `magneticFluxQuantum`, `molarMass`,
`molarMassC12`, `molarPlanckConstant`, `molarVolume`, `neutronMass`,
`nuclearMagneton`, `planckCharge`, `planckConstant`, `planckLength`,
`planckMass`, `planckTemperature`, `planckTime`, `protonMass`,
`quantumOfCirculation`, `reducedPlanckConstant`, `rydberg`, `sackurTetrode`,
`secondRadiation`, `speedOfLight`, `stefanBoltzmann`, `thomsonCrossSection`,
`vacuumImpedance`, `weakMixingAngle`, `wienDisplacement`.

> **Revision 3 (2026-06-29):** all 52 of these now export from the `functions`
> package as `Unit` (or `number` for dimensionless `fineStructure`). Verified by
> probing `functions/dist/index.js`: `PRESENT 52 / MISSING 0`. Wired via
> `functions/src/type/unit/physicalConstants.ts` + `factories/index.ts:1370-1387`.
> **This appendix is closed.**

---

## Part 5 — Revision 3 re-validation (2026-06-29)

Method: five parallel evidence passes over current `main` (HEAD `45ebe78`), each
re-checking one bridge cluster against the 2026-05-20 claims with `file:line`
citations and live probes of the **built** packages. Consequential new findings
(variance divergence, workbook cell types, functions.md drift) were
orchestrator-verified by direct execution. mathjs-side claims marked
`[confident]`.

### Updated scorecard

| #   | Bridge                              | 2026-05-20     | 2026-06-29           | What changed |
| --- | ----------------------------------- | -------------- | -------------------- | ------------ |
| B1  | typed-function type registration    | Healthy 100%   | Healthy 100%         | unchanged |
| B2  | Matrix factory bridge               | **Weak ~65%**  | **Weak ~65%** (persists) | factory matrix ops still pure-JS on boxed `number[][]`; det/reshape stubs still captured; bridge `SparseMatrix.map` still skips structural zeros |
| B3  | Matrix backend selection            | Healthy ~95%   | **Healthy ~100%**    | the "JS FFT fallback not implemented" throw is **gone** — real `fftJS` exists (`matrix/src/backends/wasm/fft-wasm.ts:119,264`) |
| B4  | WASM loaders                        | Healthy ~95%   | Healthy ~95%         | SHA-384 verify still enforced before compile (`WasmLoader.ts:733,783`; `integrity.ts:131-135`) |
| B5  | `compat` package                    | **Severe ~25%**| **Healthy ~90%** ✅  | rewritten: `all` spreads the full namespace (735 keys); `create(all)` exposes **665 callable functions** (`index.ts:173-183,279`) |
| B6  | expression ↔ functions scope        | Healthy 100%   | Healthy 100%         | unchanged |
| B7  | workbook ↔ expression/functions     | **Severe ~10%**| **Healthy ~95%** ✅  | cells run through `evaluate()` + sandbox; `executeData` uses hardened YAML (`executor.ts:170,180,192-196`) — `new Function` gone |
| B8  | tensor ↔ autograd ↔ matrix/functions| **Severe ~0%** | **Partial ~50%**     | Tensor↔DenseMatrix converters + tensor→matrix decomposition delegation + rich *native* AD landed; still no WASM compute path, no functions/ AD bridge |
| B9  | parallel ↔ typed functions          | **Weak ~40%**  | **Improved ~70%**    | plain `sum`/`mean`/`std` auto-dispatch by type+size; 15 typed files route to the pool; FFT still parallel-only-named, `numeric` unaccelerated |
| B10 | AssemblyScript WASM                 | Healthy ~95%   | Healthy ~95%         | unchanged |

### Function surface — every user-facing Part-3 gap is closed

| Part-3 claim | Status | Evidence |
| ------------ | ------ | -------- |
| 52 physical constants entirely missing | **RESOLVED** | 52/52 export as `Unit`/`number`; `physicalConstants.ts` + `factories/index.ts:1370-1387` |
| Type-conversion fns not exported (`complex`/`matrix`/…) | **RESOLVED** | all 10 export as functions; built-pkg probe |
| `isInteger` not exported (inline stub) | **RESOLVED** | `factories/index.ts:475,491-492` real `createIsInteger` replaces the stub |
| Stateful `parser()` missing | **RESOLVED** | `evaluate.ts:119` `parser()` with live scope (`Parser` *class* still absent — by design) |
| JSON `reviver`/`replacer` identity stub | **RESOLVED (public)** | `evaluate.ts:155,168` real `replacer`/`reviver`; internal `factoryScope.replacer` identity stub persists (`index.ts:999`) |
| 102 dormant factories | **OBSOLETE** | dormant fell 102 → **39**, now *all* internal-by-design (MatAlgo helpers, `*Number` variants, BigNumber-constant factories, type-class ctors); **zero user-facing gap** |
| Counts: ~518 exports / 17 typed modules | **CHANGED** | now **735** exports / **28** typed modules (+11 domains: bitwise, complex, fused, gpu, logical, parallel-map, probability, relational, set, string, unit) |

### Part-4 remediation roadmap — status

7 DONE, 2 partial, 1 open, 1 persists:

| # | Item | Status |
| - | ---- | ------ |
| 1 | Workbook through `evaluate()`, remove `new Function` | **✅ DONE** (`executor.ts:170`) |
| 2 | Activate 52 physical constants | **✅ DONE** |
| 3 | Make `compat` real | **✅ DONE** (665 fns via `create(all)`) |
| 4 | Matrix factories through native `DenseMatrix`/`BackendManager` | **❌ OPEN** (= B2 below) |
| 5 | Replace `det`/`reshape`/`isInteger` stubs | **⚠️ PARTIAL** — `isInteger` real & exported; but `det`/`reshape` still *capture* the scalar/inline stubs at factory-creation time (`index.ts:426-432` created before the tier-12 upgrade at `:1072-1074`) |
| 6 | Tensor↔DenseMatrix converters; autograd over functions ops | **⚠️ PARTIAL** — converters DONE (`Tensor.ts:113,123`); autograd-over-`functions` OPEN (no `functions` edge in `autograd/`) |
| 7 | Transparent size-based parallel dispatch | **⚠️ PARTIAL** — arithmetic/stats auto-dispatch; signal/FFT & `numeric` do not |
| 8 | `executeData()` YAML/JSON parsing | **✅ DONE** (`executor.ts:192-196`) |
| 9 | Stateful `Parser`; JSON reviver/replacer; type-conversion exports | **✅ DONE** |
| 10 | JS FFT fallback in matrix WASM bridge | **✅ DONE** (`fft-wasm.ts:264`) |
| 11 | Generate/CI-check `functions.md` from the export surface | **❌ OPEN** (still hand-maintained; drifted again — see below) |

### New gaps surfaced by this re-validation

The original roadmap's residual is now a *different, smaller* set. Ranked by leverage / risk:

| # | Gap | Severity | Evidence |
| - | --- | -------- | -------- |
| **N1** | **`docs/reference/functions.md` drifted again** — of 735 exports, ~40 *user-facing* functions are undocumented (`pageRank`, `betweennessCentrality`, `convexHull3D`, `carlsonRF/RD/RJ`, `casDerivative/Expand/Factor/Simplify`, `chebyshevFit`, `legendreFit`, `welchPSD/bartlettPSD/multiTaperPSD`, `goertzel`, `chirpZTransform`, `matrixExpm/Logm/Sqrtm`, `singularValues`, `betaPDF/gammaPDF/studentTPDF/noncentralChi2PDF`). No generator exists — roadmap item 11 was never built, so this is the *recurring* failure mode Revision 2 warned about. | **High** (the one open roadmap item, and self-perpetuating) | spot-checked 5/5 missing; no `docs:functions` script in `package.json`/`tools/`/CI |
| **N2** | **`variance` ≠ `parallelStatVariance` normalization.** Plain `variance([1,2,3,4]) = 1.25` (population) but `parallelStatVariance(...) = 1.6667` (sample). A user switching to the "parallel" variant for speed silently gets a *different statistical answer*. | **High** (correctness footgun) | orchestrator-executed; `arithmetic.ts:~961` (pop) vs `statistics.ts:~125` (sample) |
| **N3** | **B2 persists — factory matrix ops are pure-JS on boxed `number[][]`.** `toNative()`/`fromNative()` exist (`matrix-bridge.ts:309,314`) but **no activated factory calls them** (only the bridge's own `multiply`/`transpose`). `det`/`inv`/`eigs`/`lup`/`qr`/`expm`/`fft` get no WASM/GPU acceleration. | **Medium-High** (the surviving severe-ish gap) | grep: `toNative`/`fromNative` have zero factory call sites |
| **N4** | **`compat` config is inert.** `config({number:'BigNumber', matrix:'Array', precision, randomSeed})` stores the object but **nothing reads it** — a no-op vs mathjs, where config drives output/parse types. | Medium | `compat/src/index.ts:185-190`; no consumer |
| **N5** | **`compat` type defs frozen at ~22 fns + no `chain` API.** `functions.d.ts` declares ~22 of the 665 runtime functions; the rest type as `unknown` (usable, untyped). `math.chain(x).add(3).done()` fluent API absent. | Medium | `compat/src/functions.d.ts:8-96`; no `chain` key `[confident]` mathjs-has-it |
| **N6** | **Tensor decompositions bypass the existing WASM path.** `tensor/src/operations/svd.ts` imports matrix's *synchronous JS* `svd`, not the already-built async `svdWasm` (`matrix/src/operations/svd-wasm.ts:50`). Same for `eig`/`lu`/`cholesky`/`qr`. Closing B8.4's compute-path gap is mostly *wiring code that already exists*. | Medium | grep: tensor imports sync entry points only |
| **N7** | **`ThresholdDispatcher` is orphaned.** A category-based `ThresholdDispatcher` (`parallel/src/strategies/threshold.ts:86`) exists but is **not** wired into typed functions (zero hits in `functions/src`); the typed layer uses a *separate* `ComputePool.shouldParallelize` path. Two threshold mechanisms coexist — consolidation candidate. | Low-Medium | grep: `ThresholdDispatcher` unreferenced outside its own tests |
| **N8** | **Workbook `tensor` + `export` cell types throw.** Both are in `CELL_TYPE_KEYS` (`parser.ts:14-23`) but absent from `SUPPORTED_CELL_TYPES` (`parser.ts:37`) → "Unsupported cell type". The B8 Tensor work has no workbook surface. | Low | orchestrator-verified |
| **N9** | **Latent B2 foot-guns with no regression test.** (a) Stub-capture ordering: a future reorder of `factories/index.ts` could silently give `det`/`reshape` real-or-stub deps with nothing asserting it; (b) the bridge `SparseMatrix.map` skipping structural zeros (`matrix-bridge.ts:624-657`) has no test pinning the wrong behavior (the *native* `SparseMatrix.map` is correct, `SparseMatrix.ts:894-911`). | Low | no asserting tests found |
| **N10** | **`autograd` is still walled off from `functions/`** and `tensor` is still a single-consumer package (only `autograd` imports it). Rich *native* AD exists (`tape.ts` sin/cos/exp/svd/eig/…) but `grad` cannot flow through any `functions/` op or `evaluate`. | Low (architectural) | no `functions` edge in `autograd/package.json` |

### Revised remediation (residual only)

| # | Item | Maps to | Effort | Priority |
| - | ---- | ------- | ------ | -------- |
| R1 | Build a `functions.md` generator from the export surface + CI drift-check | N1 / item 11 | S | **P0** (recurring, cheap, unblocks doc trust) |
| R2 | Reconcile `variance`/`std`/`parallelStat*` normalization (pick population-vs-sample convention, document, align) | N2 | S | **P0** (silent correctness) |
| R3 | Route factory matrix ops through native `DenseMatrix` + `BackendManager` | N3 / item 4 | L | P1 |
| R4 | Wire tensor decompositions to the existing `*Wasm` async primitives | N6 | M | P1 |
| R5 | Make `compat` config drive behavior; widen `functions.d.ts`; add `chain` | N4,N5 | M | P2 |
| R6 | Support (or explicitly reject at parse time) workbook `tensor`/`export` cells; add B2 regression tests | N8,N9 | S | P2 |
| R7 | Consolidate the two parallel-threshold mechanisms; extend transparent dispatch to FFT/`numeric` | N7 / item 7 | M | P3 |
| R8 | A `functions/`↔`autograd` AD bridge (or document the boundary as intentional) | N10 / item 6 | L | P3 |

**Bottom line.** The 2026-05-20 analysis was right about *where* the gaps were, and the intervening work closed the three biggest (compat, workbook, FFT-fallback) plus the entire user-facing function backlog. What remains is **B2 (matrix-factory acceleration)**, a **recurring documentation-drift** problem (N1), one **silent correctness divergence** (N2), and a cluster of **"wiring that already exists" gaps** (N6, N7) — a much healthier position than the original five-severe-gaps scorecard.
