# Plan: PySR Phases 3–5 (M9–M15, Sprints 3R–5R, B9)

**Status:** planning only. This file is the contract for the implementation PRs below. It does not change runtime source.
**Tree reviewed:** `a847be64` (`main` after core-sprint PR 10, #515). Re-read a cited file if `main` has moved; the paths below were checked on that commit.
**Source of truth:** [`docs/roadmap/PYSR_INFORMED_ROADMAP.md`](../roadmap/PYSR_INFORMED_ROADMAP.md) §5, §6, §8 Phases 3–5. Where that roadmap still says Phase 3 or Phase 4 waits on a UPT issue or a consumer request, this plan wins: both phases are built in MathTS now.
**Follows:** the core sprint, which is done (PRs 1–10, #510 #509 #508 #511 #513 #514 #512 #516 #517 #515). Do not implement core-sprint PRs 8–10 again. Do not reopen [`CORE_SPRINT_PLAN.md`](./CORE_SPRINT_PLAN.md).
**Does not include:** Phase 6. That loop is specified in the roadmap (§8, "Phase 6 and up"). This file does not write a clone-refactoring plan.

## Goal

Ship dimension inference and constant-unit solving (M9, M10), the search kit (M11–M14), front export (M15), the three integration sprints, and a recorded review of M1, M3, and M4. Each PR merges to `main` on its own. A later PR rebases onto `main` after the previous one merges.

## Roles

| Role     | Model             | Job                                                                                                                                                     |
| -------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builder  | composer-2.5      | Implements one PR from this file. Does not start the next PR. Does not tick B9 on a PR the reviewer has not re-run.                                     |
| Reviewer | claude-sonnet-5-5 | Independent of the builder. Re-runs the PR's commands, greps for a second copy of an algorithm the PR claims to reuse, and approves only with evidence. |

## Definition of Done

Copy §6's B1–B9 into every implementation PR body. Tick a box only with a command and its result, or a file and a line. B9 is the reviewer's box.

Docs-only PRs (PR 1, PR 4, PR 10, PR 12) waive B7: no changeset. They still pass `bun run format:check` and `bun run docs:roadmap-check`.

## Non-goals

- No new package. No `@danielsimonjr/mathts-symbolic-search`. No new `ScalarNode` arm.
- No WASM or GPU evaluation of `ScalarNode`. No change to `functions/src/wasm/policy.ts`, `GPU_MIN_ELEMENTS`, or `matrix/src/config.ts` `DEFAULT_CONFIG`.
- No migration of `seedProbabilityRng` (`functions/src/typed/probability.ts`) or `createRng` (`functions/src/probability/util/seededRNG.ts`) onto `createSeededRng`.
- No CODATA uncertainty field on `functions/src/type/unit/physicalConstants.ts`. §10 question 4 stays open.
- No dimensional analysis on `Tensor`. `docs/integration/upt.md` Q2 stays UPT-only for tensors.
- No AIC/BIC score. `scoreFront` on the linear scale stays `null`.
- No tag, no GitHub Release, no npm publish, no `package.json` `"version"` edit. Do not push to `changeset-release/main`. Do not edit, retarget, close, or merge PR [#398](https://github.com/danielsimonjr/MathTS/pull/398).
- No `node:` import on a path `check:browser-safety` can see. `NODE_RUNTIME_PACKAGES` in `tools/query-dependency-graph/query-dependency-graph.mjs` is only `workbook`. Do not copy `require('node:fs')` from `parallel/src/ParallelMatrix.ts`.
- Do not redo work this tree already has. The "Already on main" table is the list.

## Already on main

Leave these alone. A PR that rewrites them is out of scope.

| Item                       | Evidence on `a847be64`                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1 structure               | `expression/src/scalar-structure.ts` exports `forEachScalar`, `mapScalar`, `scalarSize`, `scalarDepth`, `scalarComplexity`, `scalarSymbols`, `scalarCanonical`, `scalarCanonicalKey`, `scalarEquals`. Barrel: `expression/src/index.ts` lines 63–74. Own-key lookup: `hasOwnProperty` at `scalar-structure.ts:208`.                                                                      |
| M2 bridge                  | `scalarToNode`, `nodeToScalar`, `simplifyScalar`, `scalarToTex` from `functions/src/factories/index.ts` (created near line 1378).                                                                                                                                                                                                                                                        |
| M3 batch                   | `compileScalar` in `functions/src/scalar-compile.ts` (export at line 692). Barrel: `functions/src/index.ts` line 51.                                                                                                                                                                                                                                                                     |
| M4 front                   | `paretoFront`, `scoreFront`, `selectFrontModel`, `ParetoFrontError` in `functions/src/pareto-front.ts`. `paretoDist` in `functions/src/typed/dist-objects.ts` is a distribution.                                                                                                                                                                                                         |
| M5 RNG                     | `createSeededRng` and `SeededRng.fork` in `core/src/numeric/rng.ts`, barrel `core/src/index.ts`.                                                                                                                                                                                                                                                                                         |
| M6 gradient                | `compileScalarGradient` in `functions/src/scalar-compile.ts`.                                                                                                                                                                                                                                                                                                                            |
| M7 fit                     | `fitScalarParameters` in `functions/src/fit-scalar.ts`, barrel `functions/src/index.ts` line 358.                                                                                                                                                                                                                                                                                        |
| M8 equivalence             | `numericallyEquivalent` in `functions/src/numeric-equivalence.ts`.                                                                                                                                                                                                                                                                                                                       |
| Sprint 2R code             | Jacobians, `nelderMead` behind `minimize`, `matMul`, `numericRealRoots`. The two unchecked DoD boxes under Sprint 2R stay unchecked. This plan does not retick them.                                                                                                                                                                                                                     |
| Sprint 3R item 2           | `simplify` `exactFractions`. Oracle: `functions/tests/simplify-exact-fractions.test.ts` (`0.4 * x` → 2/5). `_exactFraction` in `functions/src/algebra/simplifyConstant.ts`.                                                                                                                                                                                                              |
| Sprint 4R items 2–5        | `packages/workerpool/src/fft-core.ts` lines 8–9 name `functions/src/signal/fft-core-f64.ts`. `polymul` (`functions/src/typed/algebra.ts`) calls `polyMulJS` (`functions/src/wasm/poly/wasm-bridge.ts`). `matrix/src/config.ts` `DEFAULT_CONFIG` is the threshold table. Public `DenseMatrix.multiply` stays JS (`matrix/tests/dense-js-backend-reach.test.ts`).                          |
| Sprint 5R items 1–3, 5–6   | Workbook exports `DependencyGraph`, `toDOT`, `toTeX` (`workbook/src/index.ts`). `jsonEnvelope` (`workbook/src/cli.ts`) copies `schemaVersion`. `SCHEMA_VERSION` is `{ major: 1, minor: 0 }` in `workbook/src/contract.ts`. Oracle: `workbook/tests/cli.test.ts`. Examples: `tests/integration/examples-smoke.test.ts`. Dead artefacts deleted in #413. `tools/test/bun-audit-retry.mjs`. |
| Sprint 5R item 4 (partial) | `runWithConfig` and `parallelStatMeanAD` (`functions/src/typed/statistics.ts`) are done. I-10 stays: no workspace package depends on `@danielsimonjr/mathts-typed-function`. `core` depends on the npm alias `typed-function`. Do not add a dependent.                                                                                                                                   |
| Core sprint                | Coverage floors: `tools/test/coverage-floors.json`. Export lock: `tools/test/export-lock.json`.                                                                                                                                                                                                                                                                                          |

## Order

| PR  | Title                               | Depends on |
| --- | ----------------------------------- | ---------- |
| 1   | Record the review of M1, M3, and M4 | none       |
| 2   | M9 `inferScalarDimension`           | none       |
| 3   | M10 `solveParameterDimensions`      | 2          |
| 4   | Sprint 3R                           | 2, 3       |
| 5   | M11 grammar and enumerator          | none       |
| 6   | M12 mutations and crossover         | 5          |
| 7   | M13a single-population search       | 6          |
| 8   | M13b islands, migration, annealing  | 7          |
| 9   | M14 parallel population evaluation  | 8          |
| 10  | Sprint 4R                           | 5, 9       |
| 11  | M15 front export                    | none       |
| 12  | Sprint 5R close-out                 | 1–11       |

PRs 1, 2, 5, and 11 do not depend on each other. Land them in this order anyway, so the roadmap status edits do not conflict.

## Reuse map

| Need                   | Existing piece                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scalar IR              | `ScalarNode`, `ScalarOperator`, `LoweredScalarFn`, `SCALAR_FUNCTIONS`, `SCALAR_FUNCTION_LOWERING`, `createScalarBuilder` in `expression/src/scalar-builder.ts`                                                                                                                                                                          |
| Walk, size, depth, key | `forEachScalar`, `mapScalar`, `scalarSize`, `scalarDepth`, `scalarCanonical`, `scalarCanonicalKey` in `expression/src/scalar-structure.ts`                                                                                                                                                                                              |
| Own-key read           | `hasOwnProperty` re-exported from `functions/src/utils/object.ts` (implementation in `core/src/shared.ts`)                                                                                                                                                                                                                              |
| Dimension vector       | `SiDimensionVector`, `SI_DIMENSION_LENGTH`, `toSiDimensionVector`, `fromSiDimensionVector` in `core/src/types/si-dimension-vector.ts`. Exponents are `Fraction` (`core/src/types/fraction.ts`: `add`, `sub`, `mul`, `div`, `equals`).                                                                                                   |
| Unit fixtures          | `Unit` on the `core` barrel. `gravitationConstant` from `functions/src/factories/index.ts` (unit string `m^3 kg^-1 s^-2` in `createGravitationConstant`, `functions/src/type/unit/physicalConstants.ts`).                                                                                                                               |
| Nullspace              | `rationalNullspace` in `functions/src/numeric/rational-nullspace.ts`. Do not import the numeric `nullspace`.                                                                                                                                                                                                                            |
| Batch eval             | `compileScalar`, `CompileScalarOptions`, `ScalarBatchResult` in `functions/src/scalar-compile.ts`. One-row reference: `evaluateScalar` in `functions/src/scalar-eval.ts`.                                                                                                                                                               |
| Fit and front          | `fitScalarParameters`, `paretoFront`, `scoreFront`, `selectFrontModel`                                                                                                                                                                                                                                                                  |
| RNG                    | `createSeededRng` / `SeededRng.fork`. Not `seedProbabilityRng`.                                                                                                                                                                                                                                                                         |
| LaTeX of one formula   | `scalarToTex` (M2). `workbook/src/tex.ts` `toTeX` renders a `RenderDoc`. `plot/src/plot.ts` `toTikZ` renders a plot. Neither takes a scored front.                                                                                                                                                                                      |
| Workers                | `WorkerPool` class and `execute` in `parallel/src/WorkerPool.ts` (the `execute` signature starts at line 220). It is not on `parallel/src/index.ts` today. `ComputePool.integrateFanOut` is the fan-out pattern (partition, `Promise.all`, merge on the parent). It calls `@danielsimonjr/mathts-workerpool`, not `WorkerPool.execute`. |
| Kernel string          | `kernelSource` in `functions/src/typed/parallel-map.ts` is for self-contained `(x) => number` kernels. M14 does not ship the tape that way.                                                                                                                                                                                             |
| Export lock            | `node tools/test/check-export-lock.mjs --write` rewrites `tools/test/export-lock.json`.                                                                                                                                                                                                                                                 |
| Reference index        | `DOMAIN_SUPPLEMENT` in `tools/generate-functions-reference.mjs`, key `Expression Evaluation`.                                                                                                                                                                                                                                           |
| Benchmark citation     | `docs/BENCHMARK_RESULTS.md` section `evaluateScalar` vs `compileScalar` (M3 batch evaluator) — 2026-10-25. M14 threshold is 100 rows.                                                                                                                                                                                                   |
| Cycles                 | `bun run docs:graph -- cycles` after `bun run docs:deps`.                                                                                                                                                                                                                                                                               |

## Shared CI bar

Every PR:

- `bun run typecheck` reports 0 errors when the PR changes `.ts`. Docs-only PRs skip it.
- `bun run lint` reports 0 warnings when the PR changes linted source.
- `bun run format:check`.
- The tests named in the PR pass. Test files import `describe`, `it`, and `expect` from `vitest`.
- Linux CI on the PR head is green. The jobs in `.github/workflows/ci.yml` are `compile`, `benchmark-baseline`, `test`, `coverage`, `browser`, and `architecture-docs`. The `test` job on Node 22 runs `node tools/test/consumer-typecheck.mjs --skip-build`.
- A new `.ts` file makes the pre-commit hook run `bun run docs:deps`. Commit the generated `docs/Architecture/*` diff. Do not hand-edit `FILE_INVENTORY.md` or `dependency-graph.json`.
- A new `functions` or `expression` export: rebuild that package before committing so the hook's `docs:functions` step reads a fresh `dist`. `expression` is a `TARGETS` package of `tools/generate-functions-reference.mjs`.
- A new or removed public export name: refresh `tools/test/export-lock.json` and say why in the PR body. `node tools/test/check-export-lock.mjs` must exit 0.
- `bun run check:duplicates:fast`, `bun run check:file-census`, and `bun run check:browser-safety` when `src/` or `tools/` changes.
- `bun run docs:functions:check` when a published barrel changes.
- `bun run docs:roadmap-check` when a roadmap markdown file changes. Do not add a `<pkg>@<version>` line under `ROADMAP.md` "Recently shipped".
- `repo-tools check . --docs=docs/Architecture` with `@danielsimonjr/repo-tools` **2.2.4** (the pin `REPO_TOOLS_VERSION` in `.github/workflows/ci.yml`) when architecture Verification counts change. Set a failing cell to the number the checker prints.
- Changeset (`.changeset/*.md`) for every touched published package, `minor` for a new export, `patch` for a behavior fix. No version bump in `package.json`. Docs-only PRs have no changeset.
- No tag, release, or publish. PR #398 stays untouched.

Package tests go through turbo so `dist/` is fresh: `bunx turbo test --filter=@danielsimonjr/mathts-functions` (and the same for `expression` and `parallel`). One file: run vitest from the package that owns it (`cd functions && bunx vitest run tests/<file>`; the same for `expression`, `parallel`). The repo-root `vitest.config.ts` includes only `tests/integration/**` and `tests/wasm/**`, so `bunx vitest run functions/tests/<file>` from the repo root exits 1 with "No test files found". Files under the root `tests/integration/` run from the repo root.

## PR 1 — Record the review of M1, M3, and M4

**Size:** S. Docs only. **Depends on:** nothing.

### Outcome

§6 B9 for M1 (#396, fix #407), M3 (#397), and M4 (#395) changes from Partly to Yes. The reviewer is claude-sonnet-5-5. The builder does not tick the boxes.

M2, M5, M6, M7, and M8 keep their B9 boxes open. This PR does not review them.

### Work

The reviewer re-runs these four commands. Three of the four files belong to a package, so each runs under that package's vitest config; only the integration file runs from the repo root (the root config includes only `tests/integration/**` and `tests/wasm/**`, and the plain `bunx vitest run expression/tests/…` form exits 1 with "No test files found"):

```bash
(cd expression && bunx vitest run tests/scalar-structure.test.ts)
bunx vitest run tests/integration/scalar-canonical-parity.test.ts
(cd functions && bunx vitest run tests/scalar-compile.test.ts)
(cd functions && bunx vitest run tests/pareto-front.test.ts)
```

The reviewer greps `expression/src/scalar-structure.ts` for `hasOwnProperty` (the own-key helper at line 208) and confirms there is one walker. The reviewer confirms `paretoDist` is not called from `functions/src/pareto-front.ts`.

### Files

| Path                                    | Action                                                                                                                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/roadmap/PYSR_INFORMED_ROADMAP.md` | In the §6 audit table, set B9 for M1, M3, and M4 to Yes. Name this PR and state that claude-sonnet-5-5 re-ran the four commands above. In the M1, M3, and M4 sections, tick the B9 line the same way. Leave every other checkbox as it is. |

### Acceptance

- The four vitest commands exit 0, and the PR body pastes the summary line of each.
- The audit table's B1–B8 cells are unchanged.
- B9 for M5–M8 is still open.

### CI

Shared bar for a docs-only PR. `bun run docs:roadmap-check` exits 0.

## PR 2 — M9 `inferScalarDimension`

**Package:** `@danielsimonjr/mathts-functions`. **Size:** M. **Depends on:** nothing. `expression` cannot import `functions`. The walk lives in `functions`.

### Outcome

`inferScalarDimension(node, dims)` returns either the SI dimension of a `ScalarNode` or one of four violations and the path of the failing node. Exponents are `Fraction`s. No new dimension-order constant. No second vector type: `RationalDimension` is `SiDimensionVector`.

### Rules

`dims` is `Readonly<Record<string, SiDimensionVector>>`. Read it with `hasOwnProperty` from `functions/src/utils/object.ts`. A symbol named `constructor` is unknown unless that name is an own property.

A vector is dimensionless when all seven components `equals` `new Fraction(0n, 1n)`. Compare with `Fraction.equals`. Do not call `toNumber()` to decide equality.

Child index path: `[]` is the root. An `op` child's path is the parent path plus that child's index. A `call` argument's path is the parent path plus `0`. The violation's `path` is the path of the node where the rule failed.

`forEachScalar` visits `(node, depth)` and does not report a child index, so it cannot build `path`. Do not change `forEachScalar`. The inference walk is local to the new file. It must not reimplement `scalarCanonical`.

| Node                                                                                 | Rule                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `number`                                                                             | Dimensionless, including `NaN` and `±Infinity`.                                                                                                                                                                                                                                                                            |
| `symbol`                                                                             | The own property in `dims`, or `unknown-symbol`.                                                                                                                                                                                                                                                                           |
| `+` with no children                                                                 | Dimensionless (same as `evaluateScalar`: empty `+` is 0).                                                                                                                                                                                                                                                                  |
| `+` or `-` with one child                                                            | That child's dimension (`evaluateScalar` returns a single argument unchanged; unary minus is `(-1) * x`, not a one-arg `-`).                                                                                                                                                                                               |
| `+` or `-` with two or more children                                                 | Every child has the same dimension, or `add-mismatch` at the operator. The result is that dimension.                                                                                                                                                                                                                       |
| `*` or `/` with no children                                                          | Dimensionless.                                                                                                                                                                                                                                                                                                             |
| `*` or `/` with one child                                                            | That child's dimension.                                                                                                                                                                                                                                                                                                    |
| `*`                                                                                  | Component-wise `Fraction.add`, left to right.                                                                                                                                                                                                                                                                              |
| `/`                                                                                  | Component-wise `Fraction.sub` of each next child, left to right.                                                                                                                                                                                                                                                           |
| `^`                                                                                  | Exactly two children. A `number` exponent scales the base with `Fraction.mul` after `Fraction.fromNumber` on the exponent (`0.5` is `1/2`). A non-number exponent on a dimensional base is `non-literal-exponent-on-dimensional-base` at the `^` node. A non-number exponent on a dimensionless base yields dimensionless. |
| `call` of `abs`                                                                      | The argument's dimension.                                                                                                                                                                                                                                                                                                  |
| `call` of `exp`, `log`, `log2`, `log10`, `sin`, `cos`, `tan`, `sinh`, `cosh`, `tanh` | The argument is dimensionless, or `transcendental-arg-not-dimensionless` at the call. The result is dimensionless.                                                                                                                                                                                                         |

A bad `dims` value (not length `SI_DIMENSION_LENGTH`) throws `TypeError`. The four violations do not throw.

### Hand oracles

Build trees with `createScalarBuilder`. Expected vectors are written as `Fraction` tuples in the test. Do not call `inferScalarDimension` to obtain the expected tuple.

Newton, `G * m1 * m2 / r^2`. Input vectors, in `[L, M, T, I, Θ, N, J]`:

- `G` is `toSiDimensionVector` of `gravitationConstant.dimensions` (unit `m^3 kg^-1 s^-2`). The test also asserts that vector equals `[3, -1, -2, 0, 0, 0, 0]` as `Fraction`s, which is the hand count of the unit string (length 3, mass −1, time −2).
- `m1` and `m2` are kilogram: `[0, 1, 0, 0, 0, 0, 0]`.
- `r` is metre: `[1, 0, 0, 0, 0, 0, 0]`.

The product is force: `[1, 1, -2, 0, 0, 0, 0]`.

Kinetic energy, `(1/2) * m * v^2`, with `v` a metre-per-second symbol `[1, 0, -1, 0, 0, 0, 0]` and `m` a kilogram: `[2, 1, -2, 0, 0, 0, 0]`.

Pendulum period, `2 * (L / g) ^ 0.5`, with `L` length and `g` `[1, 0, -2, 0, 0, 0, 0]`: `[0, 0, 1, 0, 0, 0, 0]`. The time component `equals` `new Fraction(1n, 1n)`.

Violations, each with `path`:

| Case                        | Tree                              | `violation`                                | `path` |
| --------------------------- | --------------------------------- | ------------------------------------------ | ------ |
| Sum of length and time      | `x + t`                           | `add-mismatch`                             | `[]`   |
| Sine of a length            | `sin(x)`                          | `transcendental-arg-not-dimensionless`     | `[]`   |
| Symbol exponent on a length | `x ^ n` with `n` dimensionless    | `non-literal-exponent-on-dimensional-base` | `[]`   |
| Missing name under a sum    | `x + q`, `q` absent, `x` a length | `unknown-symbol`                           | `[1]`  |

Also: a symbol named `constructor` on a null-prototype map that does not own that key is `unknown-symbol`. An empty `+` is dimensionless.

### Files

| Path                                           | Action                                                                                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `functions/src/scalar-dimension.ts`            | **Add.** `inferScalarDimension` and the types below. `@packageDocumentation` header.                                                      |
| `functions/src/index.ts`                       | **Change.** Export the function and the types after the `numericallyEquivalent` block (after line 63).                                    |
| `functions/tests/scalar-dimension.test.ts`     | **Add.** The oracles above. Import from `../src/scalar-dimension.js` and from `../src/index.js`.                                          |
| `functions/README.md`                          | **Change.** One bullet for `inferScalarDimension`.                                                                                        |
| `docs/reference/functions.md`                  | **Change.** One row in the curated Expression Evaluation table, above the generated index.                                                |
| `tools/generate-functions-reference.mjs`       | **Change.** Append `inferScalarDimension`, `RationalDimension`, and `DimensionInference` to `DOMAIN_SUPPLEMENT['Expression Evaluation']`. |
| `.changeset/scalar-dimension-m9.md`            | **Add.** `minor` on `@danielsimonjr/mathts-functions`.                                                                                    |
| `docs/api/functions.md`, `docs/Architecture/*` | Generated. Rebuild `functions` before commit.                                                                                             |

### Exports

```ts
export type RationalDimension = SiDimensionVector;
export type DimensionInference =
  | { readonly ok: true; readonly dimension: RationalDimension }
  | {
      readonly ok: false;
      readonly violation:
        | 'add-mismatch'
        | 'transcendental-arg-not-dimensionless'
        | 'non-literal-exponent-on-dimensional-base'
        | 'unknown-symbol';
      readonly path: readonly number[];
    };
export function inferScalarDimension(
  node: ScalarNode,
  dims: Readonly<Record<string, RationalDimension>>
): DimensionInference;
```

### CI

Shared bar. `bunx turbo test --filter=@danielsimonjr/mathts-functions`. Export lock refreshed. `bun run check:browser-safety` passes.

## PR 3 — M10 `solveParameterDimensions`

**Package:** `@danielsimonjr/mathts-functions`. **Size:** M. **Depends on:** PR 2. Same file. One walk.

### Outcome

For a tree whose unknown parameters appear linearly in the exponent equations, solve each parameter's `SiDimensionVector` so the tree's dimension equals `target`. The solver is `rationalNullspace`. A non-linear placement (a parameter inside an exponent) returns `underdetermined` and does not guess.

### Algorithm

Generalize PR 2's walk so each SI component is a linear form: a known `Fraction` plus a coefficient `Fraction` per parameter. `+` / `-` require the forms to be identical (that emits equations). `*` adds forms. `/` subtracts. A literal `^` scales the form. `abs` passes the form through. A transcendental call requires the form to be identically zero. A parameter that is the exponent, or that occurs inside an exponent, skips the solver and returns `{ underdetermined: [...parameters] }`.

A symbol that is neither in `dims` nor in `parameters` is `{ inconsistent: true }`.

Solve the seven components separately. Unknowns are the parameters, in the order given.

- Zero unknowns: if the known dimension equals `target`, `{ solved: {} }`. Otherwise `{ inconsistent: true }`. Do not call `rationalNullspace`.
- Otherwise build `A x = b` for that component. Call `rationalNullspace` on `A` for the homogeneous basis. For a non-zero `b`, call `rationalNullspace` on the augmented matrix `[A | -b]` (one extra column). A basis vector whose last entry is non-zero, divided by that entry with `Fraction.div`, is a particular solution. No such vector means `{ inconsistent: true }`. Do not write a second RREF.
- A non-empty homogeneous basis for any component means `{ underdetermined: names }` where `names` are the parameters with a non-zero coefficient in some homogeneous vector, in `parameters` order. Do not return a particular solution in that case.
- `dimensionlessOnly: true` adds rows that force every parameter exponent to 0, then uses the same solver. The PySR example below becomes `inconsistent`.

`rationalNullspace` of a matrix with no rows needs `options.columns`. Use it when a component has parameters and no equations: that component is underdetermined.

### Hand oracles

PySR's physics example (`docs/src/examples/physics.md` in the fork, as cited by the roadmap): tree `M * c`, `parameters: ['c']`, `M` is kilogram `[0, 1, 0, 0, 0, 0, 0]`, `target` is `m s^-2 kg` which is `[1, 1, -2, 0, 0, 0, 0]`. Solved `c` is `[1, 0, -2, 0, 0, 0, 0]` (metre per second squared). The test writes that tuple. It does not call the solver twice.

`{ dimensionlessOnly: true }` on the same inputs is `{ inconsistent: true }`.

`c1 * c2` with both names as parameters and a force target is `{ underdetermined: ['c1', 'c2'] }`.

`x ^ c` with `x` a length and `c` a parameter is `{ underdetermined: ['c'] }`.

A time symbol equal to a length target, with no parameters, is `{ inconsistent: true }`.

### Files

| Path                                                                                           | Action                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions/src/scalar-dimension.ts`                                                            | **Change.** Add `solveParameterDimensions`. Refactor the M9 walk into one helper in this file if the alternative is a second copy of the violation rules. One string `add-mismatch` in the file.                             |
| `functions/src/index.ts`                                                                       | **Change.** Export the function and `ParameterDimensionResult`.                                                                                                                                                              |
| `functions/tests/scalar-dimension.test.ts`                                                     | **Change.** Add the oracles. Import `rationalNullspace` only if a test needs to show the augmented matrix by hand; the expected record is a `Fraction` tuple, not `rationalNullspace(...)` of the function's private matrix. |
| `functions/README.md`, `docs/reference/functions.md`, `tools/generate-functions-reference.mjs` | **Change.** Document `solveParameterDimensions`.                                                                                                                                                                             |
| `.changeset/scalar-parameter-dimensions-m10.md`                                                | **Add.** `minor` on `@danielsimonjr/mathts-functions`.                                                                                                                                                                       |

### Export

```ts
export type ParameterDimensionResult =
  | { readonly solved: Readonly<Record<string, RationalDimension>> }
  | { readonly underdetermined: readonly string[] }
  | { readonly inconsistent: true };
export function solveParameterDimensions(
  node: ScalarNode,
  dims: Readonly<Record<string, RationalDimension>>,
  target: RationalDimension,
  parameters: readonly string[],
  options?: { readonly dimensionlessOnly?: boolean }
): ParameterDimensionResult;
```

`dimensionlessOnly` defaults to `false`.

### CI

Same as PR 2.

## PR 4 — Sprint 3R

**Size:** S. Docs, plus a citation of the existing fraction test. **Depends on:** PRs 2 and 3.

### Outcome

`docs/integration/upt.md` matches the code after #414, M9, and M10. `exactFractions` is not rewritten. Uncertainties are not added.

### Work

1. In `docs/integration/upt.md`, under the Scalar ExprNode section, add that `inferScalarDimension` and `solveParameterDimensions` are MathTS exports and that their exponents are `Fraction`s on `SiDimensionVector` (`#414`). State that Q2 is unchanged: dimensional analysis of `Tensor` stays in UPT.
2. Run `(cd functions && bunx vitest run tests/simplify-exact-fractions.test.ts)`. Do not edit `simplifyConstant.ts`.
3. Leave §10 question 4 unanswered. Do not edit `physicalConstants.ts`.

### Files

| Path                                    | Action                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `docs/integration/upt.md`               | **Change.** The paragraph above. Link this plan and the roadmap.                                  |
| `docs/roadmap/PYSR_INFORMED_ROADMAP.md` | **Change.** Tick Sprint 3R's exit line for the upt doc. Leave the uncertainty clause as not done. |

### Acceptance

- The upt page names both functions and cites `core/src/types/si-dimension-vector.ts`.
- The exact-fraction test exits 0.
- `physicalConstants.ts` has no `uncertainty` field (grep).

### CI

Docs-only bar, plus the one vitest file. No changeset.

## PR 5 — M11 grammar and enumerator

**Package:** `@danielsimonjr/mathts-expression`. **Size:** M. **Depends on:** nothing. It does not import `functions` or `core`.

### Placement

The module uses `createScalarBuilder`, `scalarSize`, `scalarDepth`, and `scalarCanonicalKey`, which already live in `expression`. `admit` is a callback, so `inferScalarDimension` is not imported. Home: `expression/src/scalar-enumerate.ts`.

Before merge, run `bun run docs:deps` and then `bun run docs:graph -- cycles`. Paste the command's summary in the PR body. A cycle is a bug in the import list. Do not create a package. Do not move the file to `functions` to hide a cycle.

### Behavior

`enumerateScalars` is a generator. It yields `ScalarNode`s and returns an `EnumerationStop`.

Generated `op` nodes have exactly two children. `^` already requires two. `+ - * /` are emitted as binary nodes even though the IR allows other arities. No empty operators. Unary operators are `call` nodes whose `fn` is in `grammar.unary`. Leaves are `grammar.variables`, then `grammar.parameters`, then `grammar.literals`, in the order those arrays give. Omitted `literals` means no number leaves. Omitted `parameters` means no parameter leaves.

Visit order is non-decreasing `scalarSize` of the stored tree (not the canonical tree). Within one size, the order is deterministic: leaves first (variables, parameters, literals), then operators in `grammar.binary` order, then calls in `grammar.unary` order. Children are earlier yields, so the pair `(left, right)` follows lexicographic order of their yield indexes. No seed is read. The function does not accept an RNG.

`maxSize` and `maxDepth` use `scalarSize` and `scalarDepth`. A symbol has depth 1 (`scalarDepth`).

Dedup: if `scalarCanonicalKey` was already yielded, skip the tree. The first yield wins.

`argumentLimits` maps an operator or function name to max `scalarSize` per argument. `-1` means no limit. `nesting[outer][inner]` is the maximum number of `inner` nodes anywhere under one `outer` node.

`admit` runs on a finished candidate. When `admitMonotone` is `true` (default `false`), a candidate that fails `admit` is not used as a child of a larger tree. When it is `false`, failed candidates are skipped at yield time and may still be children.

Stop reasons: `exhausted-space` when every legal tree within size and depth was considered; `candidate-limit` when `budget.maxCandidates` yields have been produced; `time-limit` when `maxWallClockMs` is set and `performance.now()` exceeds it before the next yield; `cancelled` when `signal.aborted` is true. Check the signal and the clock at the start of each yield.

`scalarGrammarAccepts(grammar, node)` is the same constraint check without enumeration: binary arity 2, operator in `binary`, call name in `unary`, symbols in `variables` or `parameters`, finite numbers allowed (a mutated constant need not be in `literals`), `scalarSize` / `scalarDepth` within the grammar, `argumentLimits`, and `nesting`. It does not call `admit`. The enumerator and PR 6 both call this function. It is the only constraint checker.

### Tiny grammar oracle

`variables: ['x']`, `binary: ['+', '*']`, `unary: []`, `maxSize: 3`, `maxCandidates: 10`.

Stored trees, in order:

1. symbol `x` (size 1)
2. `(+ x x)` (size 3)
3. `(* x x)` (size 3)

The return is `exhausted-space`. With `maxCandidates: 2` the yields are the first two and the return is `candidate-limit`.

A second run yields the same `scalarCanonicalKey` sequence. No `createSeededRng` import in the module (grep).

`admit` that rejects every `*` node, with `admitMonotone: true`, yields only `x` and `(+ x x)`.

### Files

| Path                                        | Action                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| `expression/src/scalar-enumerate.ts`        | **Add.**                                                                         |
| `expression/src/index.ts`                   | **Change.** Named exports after the scalar-structure block (after line 74).      |
| `expression/tests/scalar-enumerate.test.ts` | **Add.**                                                                         |
| `expression/README.md`                      | **Change.** One bullet.                                                          |
| `docs/api/expression.md`                    | Usage example. The generated index updates via `docs:functions` after a rebuild. |
| `.changeset/scalar-enumerate-m11.md`        | **Add.** `minor` on `@danielsimonjr/mathts-expression`.                          |

### Exports

```ts
export interface ScalarGrammar {
  readonly variables: readonly string[];
  readonly parameters?: readonly string[];
  readonly literals?: readonly number[];
  readonly binary: readonly ScalarOperator[];
  readonly unary: readonly LoweredScalarFn[];
  readonly maxSize: number;
  readonly maxDepth?: number;
  readonly argumentLimits?: Readonly<Record<string, readonly number[]>>;
  readonly nesting?: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly admit?: (node: ScalarNode) => boolean;
  readonly admitMonotone?: boolean;
}
export interface EnumerationBudget {
  readonly maxCandidates: number;
  readonly maxWallClockMs?: number;
}
export type EnumerationStop = 'exhausted-space' | 'candidate-limit' | 'time-limit' | 'cancelled';
export function enumerateScalars(
  grammar: ScalarGrammar,
  budget: EnumerationBudget,
  signal?: AbortSignal
): Generator<ScalarNode, EnumerationStop>;
export function scalarGrammarAccepts(grammar: ScalarGrammar, node: ScalarNode): boolean;
```

### CI

Shared bar. `bunx turbo test --filter=@danielsimonjr/mathts-expression`. Cycle command pasted in the PR body. Export lock refreshed (`expression` is in the lock).

## PR 6 — M12 mutations and crossover

**Package:** `@danielsimonjr/mathts-functions`. **Size:** M. **Depends on:** PR 5.

### Outcome

Pure operators `(node, rng, ctx) => ScalarNode | null`. `null` means the mutation failed. They do not mutate the input. They do not contain a constraint checker or a simplifier. Constraints go through `scalarGrammarAccepts` from `@danielsimonjr/mathts-expression`. Constant folding of a closed number subtree goes through `evaluateScalar`. Tree rebuilds go through `mapScalar` or a fresh `createScalarBuilder` node. Random choices go through `SeededRng` (`next` / `nextInt` only).

`ctx` is `{ grammar: ScalarGrammar; perturbationFactor: number; temperature: number }`. There is no hidden default for `perturbationFactor` or `temperature`. The negate probability is the constant `0.00743` from roadmap §2.5, named `MUTATE_CONSTANT_NEGATE_PROBABILITY` in the module.

| Operator            | Behavior                                                                                                                                                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity`          | Returns the same node. Does not draw from `rng`.                                                                                                                                                                                                                                                     |
| `mutateConstant`    | Picks a `number` node with `nextInt`. Multiplier is `1 + (2 * next() - 1) * (perturbationFactor * temperature)`. Then, with probability `0.00743` (`next()` compared to that constant), negates the value. No number node returns `null`. A result that fails `scalarGrammarAccepts` returns `null`. |
| `mutateOperator`    | Replaces one op with another `grammar.binary` entry, or one call name with another `grammar.unary` entry. One choice, or a result that fails the grammar, returns `null`.                                                                                                                            |
| `mutateFeature`     | Replaces one symbol leaf with another name from `variables` concatenated with `parameters`. One name returns `null`.                                                                                                                                                                                 |
| `swapOperands`      | Swaps the two children of one binary op. No binary op returns `null`.                                                                                                                                                                                                                                |
| `addNode`           | Replaces one subtree with a binary op or a call of that subtree and a new leaf drawn from the grammar. The result must pass `scalarGrammarAccepts`. Otherwise `null`.                                                                                                                                |
| `insertNode`        | Inserts a new binary op between a parent and one child. The child stays one operand; the other operand is a new leaf. Distinct from `addNode`: `insertNode` on a single-node tree returns `null` (there is no parent edge).                                                                          |
| `deleteNode`        | Replaces a binary op with one of its children. Deleting the root returns `null` when that would remove the last node.                                                                                                                                                                                |
| `rotateTree`        | One left or right rotation at a binary node whose child is binary: `(a∘b)∘c` becomes `a∘(b∘c)`, or the inverse. No such node returns `null`.                                                                                                                                                         |
| `randomizeTree`     | Grows a new binary tree from the grammar using `rng`, with `scalarSize` at most `maxSize`. The result must pass `scalarGrammarAccepts`.                                                                                                                                                              |
| `simplifyConstants` | `mapScalar`: a subtree whose every leaf is a `number` and whose size is greater than 1 is replaced by `evaluateScalar` of that subtree on `{}`. A throw leaves the subtree. No fold returns the original node, not `null`.                                                                           |
| `crossoverSubtrees` | `(left, right, rng, ctx) => ScalarNode \| null`. Replaces one subtree of `left` with one subtree of `right`. A result that fails the grammar returns `null`.                                                                                                                                         |

`weightedMutation(weights)` returns an operator. Default weights, in draw order, from roadmap §2.2 (optimize and backsolve stay omitted; their PySR weight is 0):

| Key                 | Weight   |
| ------------------- | -------- |
| `rotateTree`        | 4.26     |
| `addNode`           | 2.47     |
| `deleteNode`        | 0.870    |
| `mutateOperator`    | 0.293    |
| `identity`          | 0.273    |
| `swapOperands`      | 0.198    |
| `mutateFeature`     | 0.1      |
| `mutateConstant`    | 0.0346   |
| `insertNode`        | 0.0112   |
| `simplifyConstants` | 0.00209  |
| `randomizeTree`     | 0.000502 |

Sum of the table is `8.512392`. The picker draws `next()`, multiplies by that sum, and walks the table in the order above. The test's expected weights are the literals in the table. `DEFAULT_MUTATION_WEIGHTS` must equal those literals.

`crossoverSubtrees` is not in the default weights. It is a separate export.

The `identity` operator is exported as `identityMutation`: `functions/src/index.ts` re-exports `./factories/index.js` with `export *`, and an explicit `identity` export would replace the package's matrix `identity` for every consumer. The weight key stays `identity`.

### Tests

`functions/tests/scalar-mutate.test.ts`.

- Each operator: one hand-built input, one stub `SeededRng` whose `next` / `nextInt` sequence is written in the test, and one expected `scalarCanonicalKey`. The stub is the oracle. Do not pin an operator to a second call of itself.
- 1,000 draws from `createSeededRng(1)` through `weightedMutation()`. Every non-null result passes `scalarGrammarAccepts`. At least one result is non-null.
- Two runs with `createSeededRng(1)` produce the same key sequence (20 draws).
- χ² of the picker only (do not build trees): 400,000 draws, seed `20261030`, statistic `Σ (obs - exp)^2 / exp`, df = 10. Fail when the statistic exceeds `29.588` (χ² critical value, df 10, α = 0.001). The smallest expected count is `400000 * 0.000502 / 8.512392`, about 23.6, so the usual "expected at least 5" rule holds.

### Files

| Path                                                                      | Action                                                                                                                                               |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions/src/scalar-mutate.ts`                                          | **Add.**                                                                                                                                             |
| `functions/src/index.ts`                                                  | **Change.** Export the operators, `weightedMutation`, `DEFAULT_MUTATION_WEIGHTS`, `MUTATE_CONSTANT_NEGATE_PROBABILITY`, and `ScalarMutationContext`. |
| `functions/tests/scalar-mutate.test.ts`                                   | **Add.**                                                                                                                                             |
| `functions/README.md`, `docs/reference/functions.md`, `DOMAIN_SUPPLEMENT` | **Change.**                                                                                                                                          |
| `.changeset/scalar-mutate-m12.md`                                         | **Add.** `minor` on `@danielsimonjr/mathts-functions`.                                                                                               |

Grep the new file: no function named `simplify` other than the call to `evaluateScalar` / the import of `scalarGrammarAccepts`. `simplifyScalar` is not used here; constant folding is evaluation, which is what the roadmap's simplify mutation is.

### CI

Same as PR 2. The χ² test must finish inside the package test timeout (it only draws numbers).

## PR 7 — M13a single-population search

**Package:** `@danielsimonjr/mathts-functions`. **Size:** M. **Depends on:** PR 6. M3, M4, M5, and M7 are already on `main`.

### Outcome

`searchScalars(problem, options)` returns an `AsyncIterable<SearchProgress>` and finishes with a front. One population. Tournament selection. Variation is `weightedMutation`. Evaluation is `compileScalar`. Constants, when `optimizeProbability` says so, go through `fitScalarParameters`. The hall of fame is `paretoFront` then `scoreFront`. The final pick, when the caller asks, is `selectFrontModel`. Island RNG is `options.rng.fork`. This PR uses one fork label, `'population'`. It does not call `seedProbabilityRng`.

The progress and result types have a status field whose only value is `'fitted'`. No other status string exists in the module.

A budget exhaustion still returns a front (possibly empty of finite losses, but the object is present).

### Options this PR reads

`populationSize`, `tournamentSize`, `tournamentP` (roadmap default `0.982`; the test sets it), `optimizeProbability`, `maxEvaluations`, `maxCandidates`, `seeds` (an array of `ScalarNode` injected like PySR `guesses`), `rng: SeededRng`, `grammar: ScalarGrammar`, `variables`, `columns`, `observed`, `parameters`. Islands, migration, annealing, and adaptive parsimony are ignored here and implemented in PR 8. Passing them must not throw; they have no effect until PR 8.

### Planted laws

Noise-free. The test builds `observed` with `compileScalar` of the planted tree (that compiler is not the search). The assertion is `numericallyEquivalent` against the planted tree, or an equal `scalarCanonicalKey` after `simplifyScalar`. Either is enough. Do not assert that the search returns the identical object the test built.

1. `x^2 + x`. Grammar: variable `x`, binary `+`, `*`, `^`, literal `1`, `maxSize: 7`. Twenty `x` values from −1 to 1. `createSeededRng(7)`. Raise `maxEvaluations` in the test up to 20,000 if a correct search needs it. Record the number that found the law. Do not ship a test that did not find it.
2. `2 * m1 * m2 / r^2` with fitted parameter `p` (the Newton's-law shape; the constant is 2, not a CODATA digit). The fitted `p` is within `1e-6` of 2. Same seed rule.

Serial: two `for await` runs with `createSeededRng(7)` produce the same list of `scalarCanonicalKey`s and the same losses, compared with `Object.is` on each loss.

### Files

| Path                                    | Action                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `functions/src/scalar-search.ts`        | **Add.**                                                                        |
| `functions/src/index.ts`                | **Change.** Export `searchScalars` and the option, problem, and progress types. |
| `functions/tests/scalar-search.test.ts` | **Add.**                                                                        |
| README, reference, `DOMAIN_SUPPLEMENT`  | **Change.**                                                                     |
| `.changeset/scalar-search-m13.md`       | **Add.** `minor` on `@danielsimonjr/mathts-functions`.                          |

### CI

Same as PR 2. No wall-clock assertion. No worker.

## PR 8 — M13b islands, migration, annealing

**Package:** `@danielsimonjr/mathts-functions`. **Size:** M. **Depends on:** PR 7. Same file.

### Outcome

`options.populations` (default 1, so PR 7's tests stay valid) independent populations. Each island's RNG is `rng.fork('island:' + index)` and does not advance the parent (`SeededRng.fork` already promises that). Migration replaces the worst fraction of an island with copies from other islands, using `fractionReplaced` (roadmap default `0.00036`; tests set a larger fraction so a tiny run can show a migrant). Annealing uses `temperature` passed into `ScalarMutationContext`. Adaptive parsimony reweights selection by how often each complexity appears; the implementation calls `scoreFront` for the reported front and does not add a second score formula.

`populations: 1` is byte-identical to PR 7 for seed 7 on the `x^2 + x` fixture. That is the regression test. Do not edit PR 7's expected keys.

A two-island run with a fixed seed is byte-identical across two runs.

### Files

| Path                                      | Action                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `functions/src/scalar-search.ts`          | **Change.**                                                                                                 |
| `functions/tests/scalar-search.test.ts`   | **Change.** Add the island tests.                                                                           |
| `.changeset/scalar-search-islands-m13.md` | **Add.** `patch` on `@danielsimonjr/mathts-functions` (behavior of new options; the export already exists). |

No new public name unless a type gained a required field. If the export lock changes, say why.

### CI

Same as PR 7.

## PR 9 — M14 parallel population evaluation

**Packages:** `@danielsimonjr/mathts-parallel`, `@danielsimonjr/mathts-functions`. **Size:** M. **Depends on:** PR 8.

### Decision

The worker obtains the evaluator by importing it. `packages/workerpool` cannot depend on `functions` (no such dependency in `packages/workerpool/package.json`; adding one cycles through `parallel`). Do not copy the tape into `packages/workerpool/src/worker.ts` or `parallel/src/matrix.worker.ts`.

`parallel/src/WorkerPool.ts` `execute(data, transferables?, timeoutMs?)` is the pool. It is not exported today. Export the class from `parallel/src/index.ts`.

The tape runner is one function, `evaluateScalarTape`, in `functions/src/scalar-compile.ts`. `compileScalar` calls it. The worker module imports that function. One body. If the loop is currently closed over inside `compileScalar`, lift it into `evaluateScalarTape` in the same file. Values stay bit-identical to today's `compileScalar` tests (`functions/tests/scalar-compile.test.ts` must pass unedited).

The worker file is `functions/src/scalar-batch.worker.ts`. It is a second tsdown entry. Change `functions/package.json` `build`, `dev`, and `build:prod` from `tsdown src/index.ts` to `tsdown src/index.ts src/scalar-batch.worker.ts`, matching `parallel/package.json`. `dts: false` stays. The worker is not imported by `functions/src/index.ts`.

Resolve the script with `new URL('./scalar-batch.worker.js', import.meta.url)` from the built module. No `node:fs`, no `node:url`, no `require`. The parallel-equals-serial test imports `@danielsimonjr/mathts-functions` (the built `dist`) so that URL is the sibling of `dist/index.js`.

Dispatch constant `SCALAR_PARALLEL_MIN_ROWS = 100` in `functions/src/scalar-batch-parallel.ts`, with a comment that cites the M3 section of `docs/BENCHMARK_RESULTS.md`. That section compares `compileScalar` with per-row `evaluateScalar` on one thread; it did not time a worker round trip. The comment says so: 100 rows is the smallest size at which the compiled batch beats per-row evaluation, used here as a floor for the opt-in worker path, not a measured worker crossover. The comment carries no speedup number. The comparison is in the function that chooses the path, not only in the comment. Below 100 rows, `compileScalar` on the caller thread and the pool is not called. At 100 or more, `pool.execute(payload, transferables, timeoutMs)`.

`timeoutMs` is required on the options object the search passes. Default `30_000`. The third argument of `execute` is that number. Omitting it is a bug (the security invariant is the timeout path).

Merge worker results by candidate index on the caller. A parallel front equals the serial front for the same seed. Do not add a speedup number. Do not add a benchmark file in this PR.

`evaluateScalarPopulation` accepts `pool?: Pick<WorkerPool, 'execute'>` so a test can pass a fake. The default constructs `new WorkerPool(scriptUrl)`. The fake records `timeoutMs` and returns the serial `compileScalar` values. The public `searchScalars` options gain `parallel?: { timeoutMs?: number; pool?: ... }`. When `parallel` is omitted, evaluation stays on the caller thread (PR 7 and PR 8 tests stay serial).

### Tests

- `functions/tests/scalar-batch-parallel.test.ts` imports the source. Rows 99: the fake `execute` is not called, values match `compileScalar`. Rows 100: `execute` is called with `30_000` as the third argument, values match `compileScalar`. `SCALAR_PARALLEL_MIN_ROWS` is 100.
- `tests/integration/scalar-search-parallel.test.ts` imports the package names (dist). Same seed, `parallel` on and off, equal `scalarCanonicalKey` list and `Object.is` losses. The row count is at least 100.

`functions/tests/scalar-compile.test.ts` passes without edits.

### Files

| Path                                                | Action                                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `parallel/src/index.ts`                             | **Change.** Export `WorkerPool` from `./WorkerPool.js` next to `ComputePool`.                                                   |
| `functions/src/scalar-compile.ts`                   | **Change.** Lift `evaluateScalarTape`. Do not export it from the package barrel (the worker imports the file).                  |
| `functions/src/scalar-batch.worker.ts`              | **Add.** Message loop. Calls `evaluateScalarTape`.                                                                              |
| `functions/src/scalar-batch-parallel.ts`            | **Add.** Threshold, resolver, `evaluateScalarPopulation`.                                                                       |
| `functions/src/scalar-search.ts`                    | **Change.** Optional `parallel` option.                                                                                         |
| `functions/package.json`                            | **Change.** The three tsdown scripts, as above. No `"version"` edit.                                                            |
| `functions/tests/scalar-batch-parallel.test.ts`     | **Add.**                                                                                                                        |
| `tests/integration/scalar-search-parallel.test.ts`  | **Add.**                                                                                                                        |
| `.changeset/workerpool-export-m14.md`               | **Add.** `minor` on `@danielsimonjr/mathts-parallel`.                                                                           |
| `.changeset/scalar-search-parallel-m14.md`          | **Add.** `minor` on `@danielsimonjr/mathts-functions`.                                                                          |
| Export lock, README, reference, `DOMAIN_SUPPLEMENT` | **Change** if `searchScalars` options are a new exported type name. `WorkerPool` is a new parallel export, so the lock changes. |

### CI

Shared bar for both packages. `bun run check:browser-safety` passes. Grep `functions/src` for a second copy of the tape loop (one `evaluateScalarTape`). `node tools/test/check-export-lock.mjs` exits 0.

## PR 10 — Sprint 4R

**Size:** S. **Depends on:** PRs 5 and 9.

### Outcome

The roadmap's Sprint 4R boxes are ticked with file-and-line evidence. Code changes only if a grep shows a regression from the "Already on main" table.

### Greps (must match)

- `packages/workerpool/src/fft-core.ts` header names `functions/src/signal/fft-core-f64.ts`.
- `polymul` in `functions/src/typed/algebra.ts` calls `polyMulJS`.
- One matrix threshold table: `DEFAULT_CONFIG` in `matrix/src/config.ts`.
- M11's module header states the placement (`expression/src/scalar-enumerate.ts`) and points at the cycle-probe output in PR 5.
- M14's dispatch names `SCALAR_PARALLEL_MIN_ROWS`.

Existing FFT and `polymul` tests pass unedited (`functions` package tests that already import them). Do not add a threshold. Do not delete `fft-core.ts`.

### Files

| Path                                    | Action                                                      |
| --------------------------------------- | ----------------------------------------------------------- |
| `docs/roadmap/PYSR_INFORMED_ROADMAP.md` | **Change.** Tick Sprint 4R's DoD line. Quote the grep hits. |

### CI

Docs-only bar, unless a grep failed and a header comment changed. No changeset for a comment. A code fix gets a `patch` changeset and the shared code bar.

## PR 11 — M15 front export

**Package:** `@danielsimonjr/mathts-functions`. **Size:** S. **Depends on:** nothing (M2 and M4 are on `main`). Can land after PR 1 in calendar time; land it after PR 10 in this list so roadmap edits stay ordered.

### Outcome

`frontToLatexTable` and `frontToJson` over `ScoredCandidate<ScalarNode>`. Formula cells are `scalarToTex`. Canonical keys are `scalarCanonicalKey`. No second formula printer. `toTeX` and `toTikZ` were checked and do not take a front; the new file is the table wrapper only.

### LaTeX

One `tabular` with columns complexity, loss, score, equation, in that order, plus a header row. Loss and score use `toPrecision` when `options.precision` is set; the default precision is 6. A `null` score is an empty cell. `Infinity` is `\infty`.

The test's expected document is one string literal. Formula cells inside it are the strings already pinned in `functions/tests/scalar-node-bridge.test.ts`:

| Tree       | `scalarToTex` |
| ---------- | ------------- |
| symbol `x` | ` x`          |
| `a + b`    | ` a+ b`       |
| `a * b`    | ` a\cdot b`   |

Three rows, complexities 1, 3, and 3, losses `0.5`, `0.25`, and `0.125`, scores `0`, a finite score, and `null` (build the `null` with `scoreFront(..., { lossScale: 'linear' })` on a one-row front, or pass a `ScoredCandidate` whose `score` is `null`). The literal includes those tex strings. The test does not call `frontToLatexTable` to build the expected value.

### JSON

`frontToJson` returns `{ schemaVersion: 1, rows: [{ complexity, loss, score, key, tex }] }`. `key` equals `scalarCanonicalKey(item)`. For symbol `x` the key is `{"k":"s","v":"x"}` (`expression/src/scalar-structure.ts` encodes a symbol as `{ k: 's', v: name }`). The test pins that string. `JSON.parse` of the serialized value restores the same keys. `tex` equals `scalarToTex(item)`.

### Files

| Path                                   | Action                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `functions/src/front-export.ts`        | **Add.**                                                                |
| `functions/src/index.ts`               | **Change.** Export `frontToLatexTable`, `frontToJson`, and `FrontJson`. |
| `functions/tests/front-export.test.ts` | **Add.**                                                                |
| README, reference, `DOMAIN_SUPPLEMENT` | **Change.**                                                             |
| `.changeset/front-export-m15.md`       | **Add.** `minor` on `@danielsimonjr/mathts-functions`.                  |

### CI

Same as PR 2.

## PR 12 — Sprint 5R close-out

**Size:** S. Docs. **Depends on:** PRs 1–11. Lands last.

### Outcome

Phases 1–5 are recorded complete in the roadmap status. The release in §7 does not run. Phase 6 is the remaining gate.

### Work

1. Cite, do not rewrite: `workbook/tests/cli.test.ts` (the `capabilities --json` `schemaVersion` oracle), `compat/tests/instance-config-isolation.test.ts`, and a green `node tools/test/consumer-typecheck.mjs --skip-build` from this PR's CI log.
2. Record I-10 in §10: `@danielsimonjr/mathts-typed-function` stays without workspace dependents. `core` depends on npm `typed-function`. No code change.
3. Tick the Sprint 5R boxes that the citations cover. Set the status line to: Phases 1–5 are complete; release waits on Phase 6 and up. Do not write "ready to release". Do not set `RELEASES_ENABLED`. Do not touch PR #398.
4. Do not edit `CHANGELOG.md` (there is no release).

### Files

| Path                                    | Action                                                 |
| --------------------------------------- | ------------------------------------------------------ |
| `docs/roadmap/PYSR_INFORMED_ROADMAP.md` | **Change.** Status line and Sprint 5R boxes, as above. |

### Acceptance

- Every M9–M15 and Sprint 3R–5R box this plan owns is ticked, or the PR body says which PR ticked it.
- §7 still forbids a tag, a release, and a publish.
- The Phase 6 section is still present and still says the clone loop has not started.

### CI

Docs-only bar. `bun run docs:roadmap-check` exits 0.
