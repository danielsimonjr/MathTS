# Plan: core sprint — speed, stability, and security

**Status:** planning only. This file is the contract for the implementation PRs below. It does not change runtime source.
**Tree reviewed:** `bf90a00eca7ae5c3adf1bd93f2f42798056da4db` (`main` at the time of this plan). Re-read a cited file if `main` has moved; the paths below were checked on that commit.
**Follows:** the #473 clone sprint and its ledger [`docs/roadmap/CLONES_REMAINING.md`](../roadmap/CLONES_REMAINING.md). That ledger's open typing note is PR 5 of this plan. The clone-merge work in [`CLONES_REFACTOR_PLAN.md`](./CLONES_REFACTOR_PLAN.md) is a different queue. Do not land its PR-A–PR-I here.
**Returns to:** [`docs/roadmap/PYSR_INFORMED_ROADMAP.md`](../roadmap/PYSR_INFORMED_ROADMAP.md) only after PR 10. Do not implement a PySR milestone in this sprint.
**Source of truth for "done":** §6 of that roadmap, applied as [Definition of Done](#definition-of-done) below. Where this plan and a roadmap sketch differ, this plan wins.

## Goal

Make MathTS faster to judge, harder to break, and safer to embed, before any further symbolic-search work. The hot code is `@danielsimonjr/mathts-core` (`core/`) and the expression parser and sandbox (`expression/`). The gates (API lock, bundle size, coverage, tier parity, special-function pins) cover every published package, because a core-only gate would miss a regression in `functions` or `matrix`.

No optimization lands before PR 1's committed baseline. Later PRs may change speed only when PR 1's numeric fingerprints stay the same, or when the PR updates those fingerprints and states why the result changed.

## Non-goals

- No new package. No new dependency edge unless `bun run docs:graph -- cycles` still reports none.
- No changeset, no `package.json` `"version"` edit, no tag, no GitHub Release, no npm publish. Do not push to `changeset-release/main`. Do not edit, retarget, close, or merge PR [#398](https://github.com/danielsimonjr/MathTS/pull/398) (`chore: release packages`).
- No change to WASM or GPU dispatch thresholds (`functions/src/wasm/policy.ts`, `GPU_MIN_ELEMENTS`, `FFT_GPU_MIN_ELEMENTS`, `matrix/src/config.ts`). A parity or accuracy test may call `overrideWasmPolicy` inside the test only.
- No `sideEffects: false` on a package until PR 3's measurement shows a consumer bundle drops a sentinel and a test shows load-time registration still runs. `core/src/types/unit/Unit.ts` mutates unit tables at load. Expect `treeShake: false` for `core`'s bundled entries.
- Do not merge the two `deepMap` implementations. `core/src/array.ts` walks arrays and can pass an index. `core/src/collection.ts` dispatches arrays and matrices. They are allowlisted duplicates on purpose.
- Do not rewrite existing tier tests that already compare results (`matrix/tests/wasm/operations.test.ts`, `functions/tests/special-as-wasm.test.ts`, `functions/tests/gpu-elementwise.test.ts`, `parallel/tests/ComputePool.coverage.test.ts`). PR 7 adds the missing registry, not a second copy.
- Do not put a wall-clock assertion in the aggregate `bun run test` suite. `vitest.config.bench.ts` explains why `tests/benchmark/**` is excluded.
- Do not use `TypedArray.from` in a new benchmark or dispatch. `new Float64Array(n)` plus a fill loop is the allowed construction. `tools/benchmarks/core-hot-paths.mjs` line 34 uses `Float64Array.from` today; PR 1 deletes that call.

## Roles

| Role     | Model             | Job                                                                                                                                                                       |
| -------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builder  | composer-2.5      | Implements one PR from this file. Does not start the next PR. Does not tick B9.                                                                                           |
| Reviewer | claude-sonnet-5-5 | Independent of the builder. Re-runs the PR's commands, greps for a second copy of an algorithm the PR claims to reuse, and approves only when every DoD box has evidence. |

Each implementation PR is its own branch off current `main`, not stacked. Land them in the order below. A later PR rebases onto `main` after the previous one merges. Each PR is green by itself: `bun run typecheck` reports 0 errors, `bun run lint` reports 0 warnings, and the package tests named in that PR pass.

## Definition of Done

Copy this list into every implementation PR body. Tick a box only with a command and its result, or a file and a line. "DoD: base checklist + the specifics under this PR."

- [ ] **B1 Reuse.** The PR names every reused symbol and its path. A new file has a one-line reason that no existing module fits. The reviewer greps for a private copy of an existing algorithm.
- [ ] **B2 Oracle tests.** Tests pin to an independent oracle (a committed baseline, a published constant, libm, or a loop written in the test). They do not pin a function to a second call of itself. Edge rows: empty input, non-finite values, domain errors. Test files import `describe`, `it`, and `expect` from `vitest`, except the `node:test` files under `tools/test/`, which follow `tools/test/check-skip-budget.test.mjs`.
- [ ] **B3 Surface.** No new public export unless this plan names it. Internal helpers stay off `src/index.ts`. `node tools/test/consumer-typecheck.mjs --skip-build` still passes on Node 22 after the package build. PR 2's name lock stays green, or the PR updates `tools/test/export-lock.json` and says why in the PR body.
- [ ] **B4 Docs a caller can run.** A behavior a caller can hit (parse limits, `clone` skipping a polluting key) gets TSDoc on the touched function, one README bullet, and a short addition to `docs/api/core.md` or `docs/api/expression.md`. A CI gate that is not a library function does not need TSDoc. Do not add a symbol to `tools/generate-functions-reference.mjs` `DOMAIN_SUPPLEMENT`.
- [ ] **B5 Generated docs and architecture counts.** A new `.ts` file makes the pre-commit hook run `bun run docs:deps`. Commit the generated `docs/Architecture/*` diff. Do not hand-edit `FILE_INVENTORY.md` or `dependency-graph.json`. Adding a `.ts` file changes the counts in the Verification tables. Run `repo-tools check . --docs=docs/Architecture` with `@danielsimonjr/repo-tools` **2.2.4** (the pin in `.github/workflows/ci.yml`, job `architecture-docs`). Set each failing cell to the number the checker prints. Do not edit PySR milestone checkboxes. PR 10 adds the only roadmap pointer.
- [ ] **B6 Doc gates that this diff can affect.** `bun run format:check`. If `src/` or `tools/` changed: `bun run check:duplicates:fast`, `bun run check:file-census`, `bun run check:browser-safety`. If a published barrel changed: `bun run docs:functions:check`. `bun run docs:roadmap-check` when a roadmap markdown file changed.
- [ ] **B7 Releases.** Waived for this sprint by the sprint contract: no `.changeset/*.md`, no version bump, no tag, no publish. [#398](https://github.com/danielsimonjr/MathTS/pull/398) stays untouched. The "no version bump, tag, or publish" half of roadmap §7 still applies.
- [ ] **B8 Code gates.** `bun run typecheck` is 0 errors. `bun run lint` is 0 warnings. The tests named in the PR pass. Linux CI is green on the PR head. A new `node:` import fails `check:browser-safety`; do not add one in library source. `tools/test/*.mjs` may import `node:` the way `tools/test/check-published-deps.mjs` already does.
- [ ] **B9 Review.** claude-sonnet-5-5 re-ran the commands, checked B1 against the diff, and approved. The builder does not tick this box.

## Order

PR 1 is first because later speed claims need its fingerprints. PR 2 and PR 3 land before behavior edits so an export or a bundle delta is a deliberate lock update. PR 4 closes the holes the property tests then lock. PR 5 changes types only, with runtime results unchanged, so PR 1's fingerprints still match. PR 6 through PR 8 add tests. PR 9 sets coverage floors after those tests exist. PR 10 deletes duplication the earlier PRs left behind and points back at the PySR roadmap.

| PR  | Title                                             | Depends on             |
| --- | ------------------------------------------------- | ---------------------- |
| 1   | Benchmark baseline                                | none                   |
| 2   | Public export-name lock                           | none, but land after 1 |
| 3   | Bundle size and tree-shake record                 | 2's CI pattern         |
| 4   | Security: pollution, limits, runtime deps         | 2                      |
| 5   | Nested `deepMap` / `deepForEach` / `reduce` types | 1, 2, 4                |
| 6   | Property tests and parser fuzz                    | 4, 5                   |
| 7   | Tier-parity registry                              | 1                      |
| 8   | Special-function external pins                    | 1                      |
| 9   | Per-package coverage floors                       | 4, 5, 6, 7, 8          |
| 10  | Integration                                       | 1–9                    |

## Reuse map

Use these. Do not write a second copy.

| Need                                            | Existing piece                                                                                                                                                                                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace package list                          | `workspaceDirs()` in `tools/test/workspaces.mjs`                                                                                                                                                                                                                       |
| Registry-only dependency specs                  | `tools/test/check-published-deps.mjs` (specs, not the name set)                                                                                                                                                                                                        |
| High+ advisory audit                            | `tools/test/bun-audit-retry.mjs`, already a step in `.github/workflows/ci.yml`                                                                                                                                                                                         |
| Packed public types                             | `tools/test/consumer-typecheck.mjs`                                                                                                                                                                                                                                    |
| Skip-count lock pattern                         | `tools/test/check-skip-budget.mjs` and `tools/test/skip-baseline.json`                                                                                                                                                                                                 |
| Export-name census (generated, not a lock)      | `docs/Architecture/package-export-surfaces.json`, written by `bun run docs:deps`                                                                                                                                                                                       |
| Core hot-path bench entry                       | `tools/benchmarks/core-hot-paths.mjs`, script `bench:core`                                                                                                                                                                                                             |
| Node (V8) bench runner                          | `tools/benchmark/wasm/run-node.mjs` (`node`, never `bun run`)                                                                                                                                                                                                          |
| Why wall-clock stays out of the aggregate suite | `vitest.config.bench.ts`, script `test:bench`                                                                                                                                                                                                                          |
| Median timing discussion                        | `tools/benchmark/parallel/harness.ts` (do not import it; it pulls `ComputePool`)                                                                                                                                                                                       |
| Coverage files                                  | each package `bunfig.toml` `coverageReporter = ["text", "lcov"]` → `coverage/lcov.info`. `functions` uses `vitest run --coverage` (`functions/package.json`). `assembly` has no `test:coverage` script.                                                                |
| Coverage policy (file census, not line %)       | `docs/Architecture/coverage-policy.json`, `docs/Architecture/COVERAGE_POLICY.md`. The 42.6% figure in `docs/Architecture/TEST_COVERAGE.md` is a direct-import census dated 2026-10-14. Do not use it as a line-coverage floor.                                         |
| Property harness                                | `fast-check` `^4.9.0` in the root `package.json` `devDependencies`. `core/tests/helpers/equivalence.ts` for structural equivalence.                                                                                                                                    |
| Sandbox helpers                                 | `getSafeProperty`, `setSafeProperty`, `getSafeMethod` in `expression/src/utils/customs.ts`. Tests in `expression/tests/security/sandbox.test.ts`, `expression/tests/utils-customs.test.ts`, `expression/tests/parse.test.ts` (`{__proto__: 1}`).                       |
| Pollution guard to reuse                        | The condition in `core/src/object.ts` `deepExtend` (around line 138). PR 4 moves it to `isPollutingKey` in `core/src/shared.ts` and does not re-export that name from `core/src/internal.ts`.                                                                          |
| Nested array type                               | `NestedArray<T>` in `core/src/array.ts` (line 33), re-exported from `core/src/internal.ts`.                                                                                                                                                                            |
| Collection entry                                | `deepMap`, `deepForEach`, `reduce`, `scatter` from `core/src/collection.ts`, re-exported by `expression/src/utils/collection.ts` and `functions/src/utils/collection.ts`.                                                                                              |
| Seeded RNG                                      | `mulberry32` / `createSeededRng` in `core/src/numeric/rng.ts`.                                                                                                                                                                                                         |
| WASM load and policy                            | `loadWasm` / `wasmLoader` in `functions/src/wasm/WasmLoader.ts`. `overrideWasmPolicy` in `functions/src/wasm/policy.ts`.                                                                                                                                               |
| GPU fall-through                                | `elementwiseChainGpuDispatch` in `functions/src/gpu/elementwise-gpu.ts`. Flag tests in `functions/tests/gpu-elementwise.test.ts`. f32 oracles in `functions/tests/gpu-elementwise.browser.test.ts` using `F32_REL_TOL` from `functions/tests/helpers/gpu-hardware.ts`. |
| SHA-384 wasm check                              | `core/src/wasm-loader.ts`. Do not weaken it.                                                                                                                                                                                                                           |
| Special-function goldens                        | `functions/tests/golden/gen_special_goldens.py` (author machine, not CI). Existing pins in `functions/tests/gap-special-*.test.ts` and `functions/tests/special-accuracy.test.ts`.                                                                                     |
| esbuild                                         | root `devDependency` `esbuild` `^0.28.1`, already used by `tools/benchmark/wasm/run-node.mjs`.                                                                                                                                                                         |

## PR 1 — Benchmark baseline

**Package:** none published. **Size:** S. **Must merge before any PR that changes a hot path.**

### Outcome

A Node (V8) benchmark of the calls a user actually makes, with committed fingerprints and two timing runs. CI re-runs it and fails when a fingerprint or the case list changes. CI does not fail because a millisecond moved.

### Cases

Time these, and no others, in this PR. Each case returns a fingerprint (see below) and a median time.

Core, imported from the built `@danielsimonjr/mathts-core` and `@danielsimonjr/mathts-core/internal` (same symbols `tools/benchmarks/core-hot-paths.mjs` already imports, plus the two internal helpers):

| Case                     | Call                                                                                                                     | Iterations            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| `complex-add`            | `new Complex(3, 4).add(new Complex(1, 2))`                                                                               | 200_000               |
| `complex-mul`            | multiply the same pair                                                                                                   | 200_000               |
| `complex-abs`            | `abs()`                                                                                                                  | 200_000               |
| `complex-sqrt`           | `new Complex(0.7, 0.4).sqrt()`                                                                                           | 100_000               |
| `complex-tan`            | `tan()` of that value                                                                                                    | 100_000               |
| `complex-log10`          | `log10()` of that value                                                                                                  | 100_000               |
| `fraction-add`           | `new Fraction(355n, 113n).add(new Fraction(22n, 7n))`                                                                    | 100_000               |
| `fraction-mul`           | multiply the same pair                                                                                                   | 100_000               |
| `fraction-new`           | `new Fraction(355n, 113n)`                                                                                               | 100_000               |
| `bignumber-from-number`  | `BigNumber.fromNumber(123456789)`                                                                                        | 50_000                |
| `bignumber-from-bigint`  | `BigNumber.fromBigInt(123456789n)`                                                                                       | 50_000                |
| `sum-squared-deviations` | `sumSquaredDeviations` on a length-50_000 `Float64Array` filled by index: `1e6 + (i % 97) / 97`                          | 80                    |
| `deep-map-nested`        | `deepMap` from `/internal` on a 100×100 array of numbers, callback `(x) => x + 1`                                        | 200                   |
| `clone-nested`           | `clone` from `/internal` on a 20-deep `{ v: n, child }` object                                                           | 2_000                 |
| `control-add`            | the same `Complex.add` call as `complex-add`, timed as a second case so the ratio of the two medians is the harness bias | same as `complex-add` |

Expression, imported from the built `@danielsimonjr/mathts-functions` (`parse`, `evaluate`, `compileExpr` in `functions/src/factories/evaluate.ts`, re-exported from `functions/src/index.ts`). That is the caller path. `expression` does not export a bare `parse`.

| Case                 | Input                                                    |
| -------------------- | -------------------------------------------------------- |
| `parse-arithmetic`   | `1+2*3`                                                  |
| `parse-pythagoras`   | `sqrt(3^2 + 4^2)`                                        |
| `parse-trig`         | `sin(1)+cos(2)`                                          |
| `parse-object`       | `{a: 1, b: 2+3}`                                         |
| `parse-matrix`       | `[[1, 2], [3, 4]]`                                       |
| `parse-nested`       | 20 pairs of parentheses around `1`                       |
| `eval-arithmetic`    | `evaluate('1+2*3')`                                      |
| `eval-pythagoras`    | `evaluate('sqrt(3^2 + 4^2)')`                            |
| `eval-trig`          | `evaluate('sin(1)+cos(2)')`                              |
| `compile-arithmetic` | `compileExpr('1+2*3')` then one `evaluate` of the result |

Build `functions` before this bench (`bunx turbo build --filter=@danielsimonjr/mathts-functions`). That builds wasm and core first. Import the package names so Node resolves `dist`, not `src`.

### Harness rules

- Run with `node`, not `bun`. New script `bench:sprint` in the root `package.json`: `node tools/benchmarks/sprint-baseline.mjs`.
- Warm up 8 times, then take the median of 5 timed reps. Interleave nothing except the control, which is a separate case run after `complex-add` (AB then, later, the control). Record `control-add / complex-add`. On the author's machine that ratio is about 1. A ratio outside `[0.5, 2]` on the author's two runs means the harness is wrong; fix the harness before committing numbers.
- Fingerprint: one untimed call. Spell the result with `JSON.stringify` of a plain value. Numbers use `Object.is(n, -0) ? '-0' : Number.isNaN(n) ? 'NaN' : String(n)`. A `Complex` is `{ re, im }` with that spelling. A `Fraction` is `{ n: String(numerator), d: String(denominator) }`. A `BigNumber` is its `toString()`. An AST or compiled function is the fingerprint of `evaluate` of that expression, not the source text.
- `sum-squared-deviations` allocates the array with `new Float64Array(50_000)` and a loop. Delete the `Float64Array.from` call in `core-hot-paths.mjs`. Keep `bench:core` working: it may call the same module.
- A thrown error or a `null` result fails the process. Do not time a failure as 0 ms.

### Files

| Path                                        | Action                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/benchmarks/sprint-baseline.mjs`      | **Add.** The cases, the median timer, JSON on stdout, `--check`.                                                                                                                                                                                                                                                                      |
| `tools/benchmarks/core-hot-paths.mjs`       | **Change.** Remove `Float64Array.from`. Keep the existing rows. It may import the timer from `sprint-baseline.mjs` only if that import does not run the suite; otherwise duplicate the 15-line median helper in `core-hot-paths.mjs` and say so in the PR (a shared import that starts the suite is worse than 15 lines).             |
| `docs/benchmarks/core-sprint-baseline.json` | **Add.** Written by the author, not by CI.                                                                                                                                                                                                                                                                                            |
| `tools/test/sprint-baseline.test.mjs`       | **Add.** `node:test`. Spawns `node tools/benchmarks/sprint-baseline.mjs --check` with a fixture JSON, and checks the speller for `-0` and `NaN`.                                                                                                                                                                                      |
| `package.json`                              | **Change.** Add `bench:sprint`.                                                                                                                                                                                                                                                                                                       |
| `.github/workflows/ci.yml`                  | **Change.** New job `benchmark-baseline` (ubuntu-latest, timeout 15). Steps: checkout, setup Bun (same action as `compile`), `bun install --frozen-lockfile`, `bunx turbo build --filter=@danielsimonjr/mathts-functions`, then `node tools/benchmarks/sprint-baseline.mjs --check`. Do not add this to the `test` or `coverage` job. |

### Committed JSON

Run the script twice on Node and store both runs:

```json
{
  "node": "v22.x.y",
  "platform": "linux",
  "arch": "x64",
  "command": "node tools/benchmarks/sprint-baseline.mjs",
  "note": "Timings are one machine. Fingerprints are the contract. Not a speedup claim.",
  "runs": [
    { "medianMs": {}, "controlRatio": 1.0 },
    { "medianMs": {}, "controlRatio": 1.0 }
  ],
  "fingerprints": { "complex-add": "..." }
}
```

`--check` compares case names and fingerprints to this file. It prints timings. It fails when a fingerprint differs, a case is missing, a time is not finite, or the control ratio is outside `[0.25, 4]` (CI noise band, not a performance budget). It does not rewrite the file.

### Acceptance

- [ ] Two Node runs are in the JSON, with node version and platform.
- [ ] `controlRatio` on both author runs is inside `[0.5, 2]`.
- [ ] `--check` exits 0 against that file and exits 1 if a fingerprint is edited.
- [ ] `node --test tools/test/sprint-baseline.test.mjs` passes.
- [ ] No library source under `core/src` or `expression/src` changes.
- [ ] DoD base checklist. B4 is N/A (no export). B7 waived.

### DoD specifics

- [ ] The bench imports `parse` / `evaluate` / `compileExpr` from `@danielsimonjr/mathts-functions`, not from `expression/src/parse.ts`.
- [ ] `complex-sqrt` fingerprint matches a single untimed `sqrt()` (the reviewer recomputes it).

## PR 2 — Public export-name lock

**Package:** tooling. **Size:** S.

### Outcome

CI fails when a published entry gains or loses an export name. Updating `tools/test/export-lock.json` in the same PR is the planned change. A signature-only change does not fail this lock; `consumer-typecheck.mjs` still type-checks the `.d.ts`.

### What to lock

Every non-private workspace package (`workspaceDirs()`, skip `private: true`). For each key of `package.json` `exports` whose value has `types`, read the built `.d.ts` and collect names from `export { ... }`, `export type { ... }`, `export class`, `export function`, `export const`, `export interface`, `export type`, and `export default`. Sort them. Also record `typeof` for each runtime export by importing the built `.js` (`function`, `object`, `number`, `string`, `bigint`, `boolean`, `symbol`, `undefined`). Type-only names get `"kind": "type"`.

Do not lock `docs/Architecture/package-export-surfaces.json`. That file is regenerated by `docs:deps` and mixes source names. The lock is the built public entry.

`assembly` publishes wasm helpers if its `package.json` is not private. Include it if `workspaceDirs` says it is public. Do not special-case it.

### Files

| Path                                    | Action                                                                                                                                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/test/check-export-lock.mjs`      | **Add.** Default mode compares the tree to the lock and exits 1 on a difference. `--write` rewrites the lock. Follow the comment style of `tools/test/check-published-deps.mjs`.         |
| `tools/test/export-lock.json`           | **Add.** Output of `--write` on a fresh `bun run build`.                                                                                                                                 |
| `tools/test/check-export-lock.test.mjs` | **Add.** `node:test` with a tiny fixture package in `os.tmpdir()`, the way `tools/test/check-skip-budget.test.mjs` uses fixtures. Assert an added name fails and a matching tree passes. |
| `.github/workflows/ci.yml`              | **Change.** In the `test` job, after `Build`, on `matrix.node-version == '22.x'` only: `node tools/test/check-export-lock.mjs`.                                                          |

### Acceptance

- [ ] The lock matches `node tools/test/check-export-lock.mjs` with no diff.
- [ ] The fixture test fails when a name is added and passes when the lock is updated.
- [ ] `core` `.` and `./internal` are both present. `deepMap` is on `./internal` and not on `.` (`core/src/index.ts` does not export it; `core/src/internal.ts` does).
- [ ] DoD base checklist. B7 waived.

### DoD specifics

- [ ] No library source change.
- [ ] The checker uses `workspaceDirs()` and does not hard-code the 24 package directories.

## PR 3 — Bundle size and tree-shake record

**Package:** tooling. **Size:** S. Land after PR 2, before behavior PRs.

### Outcome

CI fails when a production-unminified bundle size drifts, or when a package that tree-shook stops tree-shaking. The publish build is `bun run build`, not `build:prod`. `.github/workflows/ci.yml` runs `build:prod` later in the `compile` job and that step rewrites `dist/`. Measure **before** `build:prod`.

### Size

After `bun run build`, for every non-private package, record the byte length of each file named by `exports[subpath].import` (follow one relative hop if it re-exports, but the tsdown output is the file itself). Also record `dist/wasm/mathts-as.wasm` for `@danielsimonjr/mathts-matrix` and `@danielsimonjr/mathts-functions` when the file exists (`consumer-typecheck.mjs` already requires it).

`tools/test/bundle-budget.json`:

```json
{
  "note": "Bytes of bun run build output, before build:prod. A change beyond the tolerance updates this file in the same PR.",
  "tolerance": { "bytes": 512, "ratio": 0.01 },
  "files": {
    "core/dist/index.js": 0,
    "core/dist/internal.js": 0
  }
}
```

Fail when `abs(actual - budget) > max(512, budget * 0.01)`. Both growth and shrinkage fail, same rule as `check-skip-budget.mjs`. The PR that changes the size updates the budget and names the reason in the PR body.

### Tree-shake

For each package entry, esbuild (root `esbuild`) bundles a one-line fixture `import { FirstExport } from '<package>'` with `platform: 'node'`, `format: 'esm'`, and the package's `dist` as the entry. `FirstExport` is the first runtime function export in the lock from PR 2.

Compare the fixture's byte length to the full entry. If the fixture is at most 80% of the entry, set `"treeShake": true`. Otherwise `"treeShake": false`. Also search the fixture for a sentinel: a string that appears in the full entry and is unique to a different export (for `core`, the unit name `kilogram` from `core/src/types/unit/Unit.ts` while importing `Complex` only). Record whether the sentinel is present.

Do not set `sideEffects` in this PR. `treeShake: false` with the sentinel present is an honest result for `core`, because `core/tsdown.config.ts` bundles `src/index.ts` into one file and `Unit` has load-time work.

CI fails when `treeShake` flips from `true` to `false`, or when a `treeShake: true` entry starts containing its sentinel. A flip from `false` to `true` updates the budget file in that PR (an improvement, still an explicit edit).

### Files

| Path                                      | Action                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `tools/test/check-bundle-budget.mjs`      | **Add.**                                                                               |
| `tools/test/bundle-budget.json`           | **Add.** Measured.                                                                     |
| `tools/test/check-bundle-budget.test.mjs` | **Add.** Fixture: a two-export ESM file, esbuild of one export, sentinel of the other. |
| `.github/workflows/ci.yml`                | **Change.** In `compile`, after `Build` and before `Build (production)`.               |

### Acceptance

- [ ] The committed budget matches a fresh `bun run build` within tolerance.
- [ ] The step is above `build:prod` in `ci.yml`.
- [ ] `core` is recorded, not "fixed", if the sentinel remains.
- [ ] DoD base checklist. B7 waived.

### DoD specifics

- [ ] The checker shells out to the repo's `esbuild` binary (`node_modules/esbuild`), the same dependency `run-node.mjs` imports. No new package.

## PR 4 — Security

**Packages:** `core`, `expression`. **Size:** M.

Three workstreams in one PR. They share the pollution predicate and the tests that lock it.

### 4a. Prototype pollution in core

Measured on Node 22 during planning (re-measure in the test, do not trust this paragraph alone):

- `JSON.parse('{"__proto__": {"polluted": true}}')` does not set `({}).polluted`.
- A recursive assign that does `target[key] =` when `key` is `__proto__` **does** set `({}).polluted`, because `target['__proto__']` reads `Object.prototype` and the next write lands there.
- `deepExtend` in `core/src/object.ts` skips that key (`prop in Object.prototype`).
- `mapObject` (lines 63–76) and `extend` (lines 84–95) do not. `clone` (line 46) calls `mapObject`. Both set the **result's** `[[Prototype]]` when the source has an own `__proto__` key. `({}).polluted` stays unset; `result.polluted` is `true` and `Object.getPrototypeOf(result) !== Object.prototype`.
- `deepFlatten` (lines 226–248) walks into the object stored under `__proto__` and copies its keys onto the result as own properties. A primitive `__proto__` value assigned with `obj[key] = 1` does not stick (the setter ignores non-objects).

**Change:** add one function in `core/src/shared.ts`. That file already forbids imports of other core utility modules, and this predicate has none. `core/src/internal.ts` re-exports `shared.ts` by name (`hasOwnProperty`, `endsWith`, `warnOnce`, `memoize` only). Do not add `isPollutingKey` to that list or to `core/src/index.ts`. An `export` on the function is what lets `object.ts` and `Unit.ts` import it; it does not become a public entry unless a barrel names it. PR 2's lock stays unchanged.

```ts
/** True for keys whose assignment changes [[Prototype]] or writes through it. */
export function isPollutingKey(prop: string): boolean {
  return prop in Object.prototype || prop in Function.prototype;
}
```

- `object.ts` imports `isPollutingKey` from `./shared.js` (it already imports `hasOwnProperty` from there). `mapObject`, `extend`, `deepExtend`, and `deepFlatten` skip keys for which `isPollutingKey` is true. `deepExtend` replaces its inlined condition with the call.
- `Unit.createUnit` (`core/src/types/unit/Unit.ts`, the loop around line 2596) throws `TypeError` with message `` `unsafe unit name '${key}'` `` when `isPollutingKey(key)` before `createUnitSingle`. `Unit.ts` already imports `hasOwnProperty` from `../../shared.js`. Add `isPollutingKey` to that import. `shared.ts` does not import `Unit`, so this is not a cycle. Confirm with `bun run docs:graph -- cycles` after `docs:deps` has regenerated the graph.

Runtime of ordinary keys is unchanged. A key `__proto__` is skipped, not assigned.

### 4b. Expression parser and compiler limits

`expression/src/parse.ts` `ParserState.nestingLevel` (line 108) counts parentheses so newlines can be ignored. It is not a cap. `openParams` (around line 573) increments it. `compileNode` in `expression/src/compiler/compile.ts` recurses with no depth counter. A hostile string or a hand-built node can throw `RangeError: Maximum call stack size exceeded`.

**Add** `expression/src/limits.ts` (new file: no existing module owns these constants):

```ts
/**
 * Caps for untrusted expression text and hand-built trees.
 * Chosen by the measurement in expression/tests/security/limits.test.ts.
 * They are finite on purpose. ConfigOptions in core/src/config.ts is not extended.
 */
export const MAX_EXPRESSION_LENGTH: number;
export const MAX_PARSE_NESTING: number;
export const MAX_COMPILE_DEPTH: number;
```

Do not export them from `expression/src/index.ts`.

**Parse.** At the start of the `string` signature in `createParse`, before `parseStart`, if `expression.length > MAX_EXPRESSION_LENGTH` throw `SyntaxError` with message `` `expression exceeds ${MAX_EXPRESSION_LENGTH} characters` ``. Inside `openParams`, if `state.nestingLevel >= MAX_PARSE_NESTING` throw `createSyntaxError(state, 'expression exceeds nesting limit')`. `createSyntaxError` is the existing helper (line 1975).

**Compile.** `compileNode` takes a depth. The top `compile` starts at 0. Before the recursive call, if `depth >= MAX_COMPILE_DEPTH` throw `Error` with message `` `expression exceeds compile depth ${MAX_COMPILE_DEPTH}` ``. Legitimate nodes in the current tests are far shallower than any cap that still parses.

**How to choose the numbers.** In the test file, comment the measurement: the largest `n` such that `parse('('.repeat(n) + '1' + ')'.repeat(n))` returns a node, and `n + 1` throws `SyntaxError` rather than `RangeError`. Start the search at 64, 128, 256, 512. Set `MAX_PARSE_NESTING` to the largest passing `n` that leaves at least a 2× stack margin under the `n` that throws `RangeError` (if 256 parses and 512 throws `RangeError`, the cap is 256 only when 256 is at most half of the overflowing depth; otherwise lower it). Set `MAX_COMPILE_DEPTH` the same way with a hand-built unary chain (a `ParenthesisNode` or `OperatorNode` of `-` around a constant, using the constructors the sandbox tests already build). Set `MAX_EXPRESSION_LENGTH` to `1_000_000`. The length check runs before tokenization, so the test that one extra character throws does not parse a megabyte.

Do not add fields to `ConfigOptions` (`core/src/config.ts`). That type is public.

### 4c. ObjectNode map and clone

`expression/src/node/ObjectNode.ts` `map` (around line 146) and `clone` (around line 161) assign `properties[key] =`. `parseObject` in `parse.ts` (around line 1858) and the compiler already use `setSafeProperty`. A hand-built `ObjectNode` whose `properties` own `__proto__` (the `Object.defineProperty` pattern in `expression/tests/ObjectNode.test.ts`) can set the prototype of the object `map` allocates.

**Change:** both loops call `setSafeProperty(properties, key, value)` from `expression/src/utils/customs.ts`. An unsafe key throws `No access to property "..."`, the same error `setSafeProperty` already throws. Do not skip silently. Parse already throws.

### 4d. Runtime dependency lock

`bun audit` (high+, `tools/test/bun-audit-retry.mjs`) and `check-published-deps.mjs` (registry specs only) stay as they are. Neither fails when a package **gains a new runtime dependency name**.

**Add** `tools/test/check-runtime-deps.mjs` and `tools/test/runtime-deps-lock.json`. Reuse `workspaceDirs()` and the field list `dependencies`, `peerDependencies`, `optionalDependencies` from `check-published-deps.mjs`. The lock maps `"<dir>/package.json"` to `{ "dependencies": { "name": "spec" }, ... }`. Include the root `package.json` (it has `dependencies` on `typed-function` and `workerpool` even though it is private). Fail when a name or a spec string differs. `--write` refreshes the file. Do not lock `devDependencies` (the root `fast-check` and `esbuild` entries move without being a published surface).

CI: `compile` job, next to the existing audit step. `node tools/test/check-runtime-deps.mjs`. Plus `tools/test/check-runtime-deps.test.mjs` with a temp manifest.

Known current runtime deps to expect in the lock (re-measure; do not hand-trim):

- root: `typed-function` `npm:@danielsimonjr/typed-function@5.0.0-alpha.4`, `workerpool` `npm:@danielsimonjr/workerpool@10.2.2`
- `core`: `typed-function` the same alias (`core/package.json`)
- `expression`: `@danielsimonjr/mathts-core`

### Tests

| Path                                                  | What                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/tests/object-pollution.test.ts`                 | `clone`, `mapObject`, `extend`, `deepExtend`, `deepFlatten`. Oracle: `Object.prototype` key snapshot before and after, and `Object.getPrototypeOf(result) === Object.prototype`. Inputs: `JSON.parse` of `{"__proto__":{"polluted":true}}`, `{"constructor":{"prototype":{"polluted":true}}}`, and an own `__proto__` via `Object.defineProperty`. Ordinary `{ a: 1 }` still clones. `deepFlatten` does not copy a nested key out of a `__proto__` object. |
| `core/tests/types/unit/create-unit-pollution.test.ts` | `Unit.createUnit({ ['__proto__']: '1 m' })` throws `/unsafe unit name/`. A normal `createUnit` still works and the test deletes the unit it created.                                                                                                                                                                                                                                                                                                       |
| `expression/tests/security/limits.test.ts`            | Length, nesting, compile depth. `RangeError` fails the test. `({}).polluted` stays unset. One expression under each cap still evaluates through `compile` the way `sandbox.test.ts` does.                                                                                                                                                                                                                                                                  |
| `expression/tests/ObjectNode.test.ts`                 | **Extend.** `map` and `clone` of a node with an own `__proto__` key throw `/No access to property/` and leave `Object.prototype` alone.                                                                                                                                                                                                                                                                                                                    |
| `tools/test/check-runtime-deps.test.mjs`              | Fixture manifest.                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Import `describe`, `it`, `expect` from `vitest` in the `*.test.ts` files.

### Docs

- `expression/README.md` and the Security Sandbox section of `docs/api/expression.md`: the three caps, the `SyntaxError` / `Error` messages, and that `{__proto__: ...}` still throws at parse.
- `docs/core/configuration.md` paragraph on `/internal`: `clone` / `extend` / `mapObject` skip keys that sit on `Object.prototype` or `Function.prototype`, same as `deepExtend`.
- TSDoc on `clone`, `extend`, `mapObject`, `deepFlatten`: one sentence on skipped keys, and `@example` that shows `{ a: 1 }` still copies.

### Acceptance

- [ ] The pollution tests fail on the old `mapObject` and pass after the change (the reviewer can see the assertion is on `getPrototypeOf`, not only on `({}).polluted`).
- [ ] A nested parenthesis expression of depth `MAX_PARSE_NESTING - 1` parses; one deeper throws `SyntaxError`, not `RangeError`.
- [ ] `ConfigOptions` in `core/src/config.ts` is unchanged. PR 2's lock is unchanged.
- [ ] `node tools/test/check-runtime-deps.mjs` passes. `node tools/test/bun-audit-retry.mjs` is still the advisory gate and is not rewritten.
- [ ] `expression/tests/security/sandbox.test.ts` still passes without edits, unless a message string it matches was preserved on purpose.
- [ ] DoD base checklist. B7 waived.

### DoD specifics

- [ ] `isPollutingKey` is the only predicate. `deepExtend` calls it.
- [ ] `setSafeProperty` is the only write in `ObjectNode.map` and `ObjectNode.clone`.
- [ ] No `eval` and no `new Function`.

## PR 5 — Nested `deepMap` / `deepForEach` / `reduce` types

**Package:** `core`, then the call sites that stop type-checking. **Size:** M.
**Known issue:** `CLAUDE.md` "Known Issues" and `docs/roadmap/CLONES_REMAINING.md` "Known follow-ups".

### Runtime

Do not change results. PR 1 fingerprints for `deep-map-nested` and `clone-nested` stay valid. `reduce([1, 2, 3], 0, (a, b) => Number(a) + Number(b))` returns the number `6`, not `[6]`. `_reduce` in `core/src/collection.ts` already returns that scalar when `dim <= 0` and `mat[0]` is not an array (lines 142–148). The public `reduce` casts it to `U[]`. The cast is the bug in the types. Do not wrap the scalar in an array to match the old annotation.

`skipZeros` keeps a `0` as the original value (`core/src/collection.ts` around line 90). The mapped type is `T | U` in that mode.

`scatter` is unchanged.

`core/src/array.ts` `deepMap` / `deepForEach` stay as they are (`NestedArray`, optional index callback). Do not route `collection.ts` through a new walker.

### Types

In `core/src/collection.ts`, import `NestedArray` from `./array.js`.

```ts
export function deepForEach<T>(
  array: NestedArray<T> | Matrix<T>,
  callback: (value: T) => void
): void;

export function deepMap<T, U>(
  array: Matrix<T>,
  callback: (value: T) => U,
  skipZeros: true
): Matrix<T | U>;
export function deepMap<T, U>(
  array: NestedArray<T>,
  callback: (value: T) => U,
  skipZeros: true
): NestedArray<T | U>;
export function deepMap<T, U>(
  array: Matrix<T>,
  callback: (value: T) => U,
  skipZeros?: false
): Matrix<U>;
export function deepMap<T, U>(
  array: NestedArray<T>,
  callback: (value: T) => U,
  skipZeros?: false
): NestedArray<U>;

export function reduce<T, U>(
  mat: Matrix<T>,
  dim: number,
  callback: (acc: U | T, val: T) => U
): Matrix<U>;
export function reduce<T, U>(
  mat: NestedArray<T>,
  dim: number,
  callback: (acc: U | T, val: T) => U
): U | NestedArray<U>;
```

The implementation signatures may use a wider union. Overload order is the one above so a `Matrix` argument picks the matrix return. A `skipZeros` argument that is a non-literal `boolean` may fall through to the implementation union `NestedArray<T | U> | Matrix<T | U>`; that is acceptable. Do not add `any`. Do not add `@ts-ignore` or `@ts-expect-error` except a one-line comment on a cast that names the runtime fact it preserves.

`Matrix<T>` stays the local interface in `collection.ts`. Do not import the class from `matrix` (`core` must not depend on `matrix`).

### Call sites

`bun run typecheck` is the list. Expect errors in files that import `deepMap`, `deepForEach`, or `reduce` from `functions/src/utils/collection.ts` or `expression/src/utils/collection.ts` (both re-export `core`). The casts the known issue names:

- `functions/src/statistics/sum.ts`, `max.ts`, `min.ts`, `mean.ts`, `prod.ts`: `as Parameters<typeof reduce>[0]`.
- `functions/src/arithmetic/{abs,ceil,fix,floor,log10,log1p,log2,round,sign,unaryMinus,unaryPlus}.ts`, `functions/src/complex/{arg,conj,im,re}.ts`, `functions/src/logical/not.ts`, `functions/src/bitwise/bitNot.ts`, and the `functions/src/utils/is*.ts` files that call `deepMap`.
- `expression/src/parse.ts` `parseMultiple` (`as Parameters<typeof deepMap>[0]`).

Delete a cast that type-checks without it. Keep a cast only where the value is a matrix-like structural type that is not the local `Matrix` interface, and comment that. Rebuild `core` before type-checking `functions` (`functions` reads `core/dist`).

`expression/tests/utils-collection.test.ts` and `functions/tests/dedup-bucketB-slice2-equivalence.test.ts` must still pass. Update them if they assert the old return annotation. Do not change the behavioral assertions.

### Tests

`core/tests/collection-nested.test.ts`:

- `deepMap([[1, 2], [3]], (n) => n + 1)` equals `[[2, 3], [4]]` with no cast at the call.
- `deepForEach` on that value visits `1, 2, 3` in order. The oracle is a loop in the test, not `deepMap`.
- `reduce([1, 2, 3], 0, (a, b) => Number(a) + Number(b))` is `6` (`Object.is` or `toBe(6)`).
- `reduce([[1, 2], [3, 4]], 0, ...)` returns a nested array whose values match a loop in the test.
- `reduce` of an empty array throws, or returns the value the current code returns. Read `_reduce` and pin that behavior; do not invent a new throw.
- `dim` out of range still throws `DimensionError` (`core/src/error/DimensionError.ts`).
- `skipZeros: true` on `[0, 2]` with `(n) => n + 1` yields `[0, 3]` (the zero is the original number).

### Docs

TSDoc on the three functions: nested arrays are real inputs, `reduce` of a vector along dimension 0 returns the scalar, `skipZeros` preserves zeros. One bullet in `docs/core/configuration.md` next to the existing `/internal` paragraph. No README section on the main `.` entry (these symbols are not exported there).

### Acceptance

- [ ] `bun run typecheck` is 0 errors.
- [ ] PR 1 `--check` still passes (fingerprints unchanged).
- [ ] PR 2 lock unchanged (names did not change). If a `.d.ts` kind flipped, stop and fix the type; do not edit the lock to hide a kind change.
- [ ] No `any`. The only remaining casts have a comment.
- [ ] DoD base checklist. B7 waived.

### DoD specifics

- [ ] `array.ts` `deepMap` is not modified.
- [ ] `scatter` is not modified.
- [ ] Vector `reduce` returns a scalar, asserted with `toBe(6)`.

## PR 6 — Property tests and parser fuzz

**Packages:** `core`, `expression`. **Size:** S. Tests only, unless a fuzz case finds a defect. A defect is fixed in this PR with a regression test. Do not widen into a refactor.

### Property tests

`core/tests/collection-properties.test.ts` and `core/tests/object-properties.test.ts`. Use `fast-check` (`import fc from 'fast-check'`). Seed `0x5eed`. `numRuns: 100`. Import `describe`, `it`, `expect` from `vitest`.

Oracles are loops written in the test file.

| Property                                                                                     | Oracle                                                                        |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `deepMap` identity                                                                           | recursive walk that returns the same numbers                                  |
| `deepMap` fusion                                                                             | `deepMap(deepMap(a, f), g)` deep-equals the walk of `g(f(x))`                 |
| `deepForEach` visits each leaf once, left to right                                           | push into an array in the test's walk                                         |
| `reduce` of a vector by addition                                                             | a `for` loop                                                                  |
| `clone` / `mapObject` / `extend` leave `Object.prototype` and the result prototype untouched | key snapshot, including generated keys `constructor`, `__proto__`, `toString` |
| empty array                                                                                  | `deepMap([], (x) => x)` is `[]`                                               |

Generators: `fc.array(fc.double({ noNaN: false }), { maxLength: 8 })` nested one level by `fc.oneof`, plus a dedicated `fc.constantFrom('__proto__', 'constructor', 'toString')` object key. Do not generate arrays deeper than 4 (stack and time).

`assertEquivalent` in `core/tests/helpers/equivalence.ts` is for comparing two implementations. Use it only if a property compares `clone` to a test-local copier. Do not compare `deepMap` to `array.ts` `deepMap` and call that an oracle (they are the same family). The test-local loop is the oracle.

### Fuzz

`expression/tests/security/parse-fuzz.test.ts`.

Build `parse` the way `expression/tests/parse.test.ts` does (`createParse` from `../src/parse.js`, the node constructors, `mathTyped`). Move that bootstrap into `expression/tests/helpers/wired-parse.ts` exporting `parse`, and switch `parse.test.ts` to import it, so there is one wiring. The helper is a test file's dependency, not a `src/` module.

Cases, seed `0x5eed`, `numRuns: 200`:

- `fc.string({ maxLength: 80 })` of arbitrary UTF-16.
- A token soup from the alphabet `0123456789.+-*/^(),[]{}eE ` joined to at most 120 characters.
- `'('.repeat(k) + '1' + ')'.repeat(k)` for `k` from 0 through `MAX_PARSE_NESTING` (this one is a fixed loop, not 200 random draws).

For each string: `parse` either returns a node or throws `SyntaxError` or `Error`. `RangeError` fails. `Object.getOwnPropertyNames(Object.prototype)` is unchanged. `Object.prototype.polluted` is unset. A successful parse of a token-soup string that is valid is then `compile`d with the empty math scope from `sandbox.test.ts` only when the node is a constant or arithmetic operator; do not evaluate assignment nodes (the validator rejects them). Cap compile fuzz at strings that parsed with node count ≤ 30, counted by a walk in the test, so a wide generated tree cannot time out.

### Acceptance

- [ ] Both seeds are in the test source.
- [ ] A mutated `deepMap` that drops the first element fails the fusion property (the reviewer checks the oracle is a separate loop).
- [ ] `parse.test.ts` still passes and no longer contains its own `createParse({...})` block.
- [ ] DoD base checklist. B3 unchanged. B4 N/A. B7 waived.

### DoD specifics

- [ ] No new production dependency. `fast-check` resolves from the root devDependency. If a package test cannot resolve it, add it to that package's `devDependencies` only, and do not touch `tools/test/runtime-deps-lock.json` (devDependencies are not locked).

## PR 7 — Tier-parity registry

**Package:** `functions` tests, plus a JSON registry. **Size:** S.

### Outcome

A new kernel cannot merge without a row that names the test which checks numeric agreement. This PR does not change dispatch and does not duplicate the suites that already compare tiers.

### Already covered (do not rewrite)

| Pair                                       | Test                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| matrix JS vs WASM `multiply`               | `matrix/tests/wasm/operations.test.ts`, `matrix/tests/backends/WASMBackend-as.test.ts`   |
| elementwise AS kernel vs JS                | `functions/tests/typed-elementwise-as-wasm.test.ts`                                      |
| special AS kernel vs JS                    | `functions/tests/special-as-wasm.test.ts` (JS is not an external oracle; PR 8 adds that) |
| `ComputePool` vs sequential                | `parallel/tests/ComputePool.coverage.test.ts`                                            |
| GPU flag off, null fall-through, no device | `functions/tests/gpu-elementwise.test.ts`                                                |
| GPU f32 vs independent `Math.*` oracle     | `functions/tests/gpu-elementwise.browser.test.ts` (`F32_REL_TOL`)                        |

`functions/tests/gpu-elementwise.test.ts` uses `Float64Array.from`. Leave it. This PR does not touch that file unless the registry cites it.

### Registry

`functions/tests/tier-parity-registry.json` lists every key of `WASM_DISPATCH_POLICY` in `functions/src/wasm/policy.ts`, every entry of `GPU_ELEMENTWISE_OPS` in `functions/src/gpu/elementwise-gpu.ts`, the matrix op `multiply` (the only `shouldUseWasm` kind that returns true, `matrix/src/backends/WASMBackend.ts`), and the `ComputePool` operations that `parallel/tests/ComputePool.coverage.test.ts` already names.

Each row: `{ "id": "array_sin_ptr", "tier": "wasm", "test": "functions/tests/typed-elementwise-as-wasm.test.ts", "symbol": "array_sin_ptr" }`. The test file must exist and contain `symbol`.

`functions/tests/tier-parity-registry.test.ts` reads the policy and the GPU op list from source (import the const; do not parse the file with a regex if the export is available) and fails when an id has no row. It fails when a row's file does not contain the symbol. It imports `describe`, `it`, `expect` from `vitest`.

If an id has no existing test, add the smallest equality test in the suite that already loads that tier (`overrideWasmPolicy({ '*': { min: 0 } })` and `wasmLoader.load()`, or the GPU browser file's `ORACLE` map). Numeric tolerance is the one that file already uses (`1e-12` relative in `special-as-wasm.test.ts`, `F32_REL_TOL` for GPU). Seed inputs with `createSeededRng` from `@danielsimonjr/mathts-core` when the input is random. Do not compare a GPU result to a WASM result (f32 vs f64). Do not assert timings.

### Acceptance

- [ ] Adding a fake key to a local copy of the policy object fails the test (cover this by exporting a pure checker function from the test file, or by a `node:test` that points the checker at a fixture policy).
- [ ] `policy.ts` and `GPU_MIN_ELEMENTS` are unchanged.
- [ ] DoD base checklist. B7 waived.

### DoD specifics

- [ ] Every `WASM_DISPATCH_POLICY` key has a row.
- [ ] The PR body lists any new equality test and the oracle it uses. "Matches JS" is allowed here only as parity of two tiers. External accuracy is PR 8.

## PR 8 — Special-function external pins

**Packages:** `core`, `functions`. **Size:** M.

### Outcome

Every public special function and the complex elementary methods on `core`'s `Complex` are pinned to a constant this repo did not compute by calling the function under test. AS kernels that PR 7 compares to JS get the same external constant, so a bug shared by both tiers fails.

### Complex elementary (`core`)

`core/tests/types/complex-oracle.test.ts`. Input `new Complex(0.5, 0.25)`. Oracle: CPython `cmath` (libm), which does not call `Complex`. Relative error `< 1e-12` on each part, or absolute `< 1e-12` when the reference part is 0. The reviewer recomputes one value with `python3 -c 'import cmath; print(cmath.sin(complex(0.5, 0.25)))'`.

| Method | re                   | im                   |
| ------ | -------------------- | -------------------- |
| `sin`  | 0.49448578093319501  | 0.22168816414957482  |
| `cos`  | 0.90515015055960679  | -0.12110879604381165 |
| `tan`  | 0.50450070269856395  | 0.31242069250258875  |
| `exp`  | 1.5974665191199127   | 0.40790017007835982  |
| `log`  | -0.58157540490284043 | 0.46364760900080609  |
| `sqrt` | 0.72767334511267745  | 0.17178037486125622  |
| `asin` | 0.50160885327550075  | 0.28139605624529274  |
| `acos` | 1.069187473519396    | -0.28139605624529274 |
| `atan` | 0.4842544903299662   | 0.20058661813123432  |
| `sinh` | 0.50489571438799496  | 0.27897912835026151  |
| `cosh` | 1.0925708047319176   | 0.12892104172809826  |
| `tanh` | 0.4854872810241353   | 0.19805544995134958  |

Also pin, as edge rows, the behavior the current methods already implement (read `core/src/types/complex.ts` before writing the assertion): `log` of `0`, `sqrt` of a negative real, and `tan` of a value whose cosine magnitude underflows. If the current method returns `NaN` there, the test expects `NaN`. Do not change the method to match a different branch cut in this PR. A mismatch against `cmath` on the principal value `0.5+0.25i` is a bug to fix in this PR. A mismatch on a branch cut is a comment and an expected `NaN` or the current value, not a silent retune.

### BigNumber elementary (`core`)

`core/tests/types/bignumber-oracle.test.ts`. `BigNumber.fromNumber(1).sin()`, `.cos()`, `.exp()` against `Math.sin(1)`, `Math.cos(1)`, `Math.exp(1)`. libm is independent of `_sinTaylor` (`core/src/types/bignumber.ts` around line 960). Compare `toNumber()` with relative error `< 1e-12`. Also `fromNumber(0).sin()` is `0`, `fromNumber(NaN).sin()` is NaN, `fromNumber(Infinity).sin()` is NaN (the method returns a NaN `BigNumber` today). Same for `cos` and `exp` after reading those methods: `exp(0)` is `1`.

### `typedSpecial` inventory (`functions`)

`functions/src/typed/special.ts` exports `typedSpecial` with these keys: `erfc`, `lgamma`, `beta`, `gammainc`, `digamma`, `besselJ0`, `besselJ1`, `besselY0`, `besselY1`, `besselJ`, `besselY`, `besselI`, `besselK`, `betainc`, `gammaincp`, `ellipticK`, `ellipticE`, `chebyshevT`, `hermiteH`, `laguerreL`, `legendreP`, `lambertW`, `erfi`, `cosIntegral`, `sinIntegral`, `logIntegral`, `expIntegralEi`, `fresnelC`, `fresnelS`, `airyAi`, `airyBi`, `carlsonRC`, `carlsonRF`, `carlsonRD`, `carlsonRJ`, `ellipticF`, `ellipticEIncomplete`, `ellipticPi`.

`functions/tests/special-oracle-inventory.test.ts` imports `typedSpecial` and fails when a key has no entry in `functions/tests/special-oracle-inventory.json`. Each entry names a test file and a substring that must appear in that file (`mpmath`, `scipy`, `DLMF`, `Abramowitz`, or `closed form`). Many keys already have pins (`functions/tests/special-accuracy.test.ts`, `functions/tests/gap-special-niche-oracle.test.ts`, `functions/tests/gap-special-wave-oracle.test.ts`, and the `gap-wave-*` files). Point the JSON at those files. For a key that has only a round trip, add a constant.

Parameter convention: read the TSDoc before pinning `ellipticK` / `ellipticE` (parameter `m` versus modulus `k`). A pin that uses the wrong argument is a false oracle. The existing tests are the convention.

Constants come from `mpmath` at `dps=25`, generated on the author's machine with `functions/tests/golden/gen_special_goldens.py` or a one-off `python3` snippet. Commit the decimal literals. CI does not install `mpmath` and does not run Python. Comment the snippet above the table.

Reference values already computed at `dps=25` for the AS pin below (regenerate if you change the argument):

| Function    | Argument                              | Value                 |
| ----------- | ------------------------------------- | --------------------- |
| `lgamma`    | 2.5                                   | 0.28468287047291916   |
| `besselJ0`  | 2.5                                   | -0.048383776468197996 |
| `besselJ1`  | 2.5                                   | 0.49709410246427404   |
| `besselY0`  | 2.5                                   | 0.49807035961523189   |
| `besselY1`  | 2.5                                   | 0.14591813796678580   |
| `airyAi`    | 1.2                                   | 0.10612576226331254   |
| `airyBi`    | 1.2                                   | 1.4211336756103481    |
| `ellipticK` | 0.5, only if TSDoc says parameter `m` | 1.8540746773013719    |
| `ellipticE` | 0.5, same condition                   | 1.3506438810476755    |
| `erfi`      | 0.7                                   | 0.94028293383350748   |

Relative tolerance `1e-12`, except where an existing test already documents a looser bound (`besselK` near the series join is `3e-9` in `special-accuracy.test.ts`). Use the looser bound only for that function and cite that file.

### AS kernels against the same constants

`functions/tests/special-as-oracle.test.ts`. For each dispatch exported from `functions/src/wasm/special/wasm-bridge.ts` that PR 7's registry lists (`besselJ0Dispatch`, `airyAiDispatch`, `lgammaDispatch`, and the siblings in `special-as-wasm.test.ts`):

1. Call the public function (`besselJ0(2.5)` and so on) and compare to the constant.
2. With `overrideWasmPolicy({ '*': { min: 0 } })` and `wasmLoader.load()`, call the dispatch on a one-element `Float64Array` and compare to the **same** constant, not to the JS result.
3. Skip the AS half only when `AS_WASM_PATH` is missing, using the same `describe.skip` pattern as `special-as-wasm.test.ts`, so `tools/test/skip-baseline.json` does not move. If the skip count changes, update the baseline in this PR and say why. Do not add a new skip on machines that have the wasm binary (CI builds it).

Do not edit `policy.ts`. `lgamma_f64` stays at `min: 1048576` for production.

### Acceptance

- [ ] The inventory test fails if a key is deleted from the JSON.
- [ ] One `cmath` value is recomputed in the PR body.
- [ ] AS comparisons use the external constant.
- [ ] No threshold edit.
- [ ] DoD base checklist. B7 waived. B4: TSDoc only if a function's documented domain was wrong and the PR fixes it.

### DoD specifics

- [ ] `ellipticK(0.5)` is pinned only after the TSDoc argument convention is quoted in the test comment.
- [ ] No `mpmath` import in TypeScript and no Python step in CI.

## PR 9 — Per-package coverage floors

**Package:** tooling plus `functions` vitest config. **Size:** S. Land after PRs 4–8 so the floors include their tests.

### Outcome

The `coverage` CI job fails when a package's line coverage drops below a committed integer. Codecov stays `fail_ci_if_error: false` (forks have no token). The floor is the gate.

### What is measured

`bun run test:coverage` is `turbo run test:coverage`. Packages with `bun test --coverage` write `coverage/lcov.info` because `bunfig.toml` sets `coverageReporter = ["text", "lcov"]` and `coveragePathIgnorePatterns = ["../**"]`. Bun counts lines in files the tests load. It does not match vitest's "unloaded file is 0%" number. `functions` runs `vitest run --coverage` and has no `coverage` block in `functions/vitest.config.ts`.

**Change** `functions/vitest.config.ts` `test.coverage` to:

```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'lcov'],
  reportsDirectory: 'coverage',
}
```

Do not set `all: true` in this PR (that would drop the percentage by counting untouched files and make the floor incomparable with the bun packages). `plot` uses `bun test` (`plot/package.json`); its `bunfig.toml` already emits lcov. `assembly` has no `test:coverage` script. Turbo skips it. Do not add a fake floor. AssemblyScript is covered by `bun run test:wasm` and `tests/wasm/`, which this gate does not pretend to measure.

### Floors

`tools/test/coverage-floors.json`:

```json
{
  "note": "Line hits / line found from coverage/lcov.info after bun run test:coverage. Integer floor is the measured percent rounded down, minus 1. Bun and vitest numbers are not comparable across packages.",
  "packages": {
    "core": { "runner": "bun", "floor": 0 },
    "functions": { "runner": "vitest", "floor": 0 }
  }
}
```

Fill every workspace directory that has a `test:coverage` script, including the thin re-export packages (`parser`, `arithmetic`, `linalg`, and the rest). `floor = max(0, Math.floor(measuredPercent) - 1)`.

`tools/test/check-coverage-floors.mjs` reads `LF:` and `LH:` in each package's `coverage/lcov.info`, sums them, computes `100 * LH / LF`, and fails when the percent is below `floor` or the lcov file is missing. A package with `LF === 0` fails (the run did not measure it).

### CI

`.github/workflows/ci.yml` job `coverage`, after `Test with coverage`: `node tools/test/check-coverage-floors.mjs`. The job already runs `bun run build` and `bun run test:coverage`.

`tools/test/check-coverage-floors.test.mjs`: a fixture lcov with `LF:100` and `LH:80` against floor 79 passes and floor 81 fails.

### Acceptance

- [ ] The JSON floors equal `floor(measured) - 1` for each package, and the PR body pastes the measured percents.
- [ ] The checker fails on the fixture.
- [ ] Codecov `fail_ci_if_error` stays `false`.
- [ ] `assembly` is absent from the JSON, with the reason in the JSON `note`.
- [ ] DoD base checklist. B7 waived.

### DoD specifics

- [ ] The root `vitest.config.ts` `coverage.include` list is not turned into a second aggregate run. Package floors come from each package's own `test:coverage`.

## PR 10 — Integration

**Size:** S. No new behavior. Lands last.

### Outcome

One implementation of each helper this sprint added, docs that match the code, coverage floors ratcheted to the new measurements, and a pointer from the PySR roadmap back to this plan. PR 1 fingerprints still match.

### Work

1. Grep for a second pollution check (`in Object.prototype` outside `isPollutingKey`). `deepExtend` must call `isPollutingKey`. Expression writes of a parsed key must call `setSafeProperty` / `getSafeProperty` / `getSafeMethod`. A hit that assigns `obj[key]` with a key from a node is a bug to fix in this PR.
2. Grep for a second expression-length or depth constant. Only `expression/src/limits.ts` defines the three numbers.
3. `bun run docs:deps` and commit the generated architecture diff if a previous PR missed it.
4. `repo-tools check . --docs=docs/Architecture` at version 2.2.4. Fix Verification cells that drift.
5. Re-run `node tools/benchmarks/sprint-baseline.mjs --check`. It must pass. If a fingerprint drifted, that is a bug in an earlier PR; fix the bug, do not refresh the fingerprint to hide it.
6. Re-run coverage. If a package's measured percent is more than 2 points above its floor, raise the floor to `floor(measured) - 1` in `coverage-floors.json`.
7. `bun run check:duplicates:fast` reports no new `TRUE_DUPLICATE`. `isPollutingKey` must not show up as one.
8. Add this paragraph under the status block at the top of `docs/roadmap/PYSR_INFORMED_ROADMAP.md` (do not edit milestone checkboxes, §6's audit table, or §7):

   > Core sprint (speed, stability, security of `core` and the expression parser) is planned in `docs/plans/CORE_SPRINT_PLAN.md` and gated by PRs 1–10 of that plan. The next PySR milestone starts after PR 10 merges. Releases stay off (§7, PR #398 unmerged).

9. `docs/api/core.md` and `docs/api/expression.md` match PRs 4 and 5. `expression/README.md` mentions the caps. No changelog edit (there is no changeset).

### Acceptance

- [ ] `--check` on the sprint baseline exits 0.
- [ ] `check:duplicates:fast` and `check:file-census` and `check:browser-safety` pass.
- [ ] `docs:roadmap-check` passes with the new status paragraph (it must not look like a `pkg@version` "Recently shipped" line).
- [ ] The PySR milestone boxes are unchanged.
- [ ] [#398](https://github.com/danielsimonjr/MathTS/pull/398) was not pushed to.
- [ ] DoD base checklist, including B9 from claude-sonnet-5-5. B7 waived.

### DoD specifics

- [ ] No production behavior change except a pollution or limit hole the grep in step 1 finds. A find is fixed with a regression test, not a new feature.
- [ ] The roadmap paragraph links this file and does not mark a milestone done.

## Out of scope reminder

Clone merges (plan `CLONES_REFACTOR_PLAN.md`), GPU `serializeGpu` on `matrix` `GPUBackend` (the other #473 follow-up), PySR milestones, and any release of the changesets already on `main`. Those changesets stay accumulated. PR #398 stays open and unmerged.
