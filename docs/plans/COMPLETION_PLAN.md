# Plan: Completion (B9 for M2 and M5–M8, residual UPT units, P6-5 Bun regression)

**Status:** planning only. This file is the contract for the three implementation PRs below. It does not change runtime source.
**Tree reviewed:** `9dc97c56` (`main`, P6-11, [#542](https://github.com/danielsimonjr/MathTS/pull/542)). Re-read a cited file if `main` has moved; the paths and line numbers below were checked on that commit.
**Source of truth:** [`docs/roadmap/PYSR_INFORMED_ROADMAP.md`](../roadmap/PYSR_INFORMED_ROADMAP.md) for the review and the status edits. The unit table and `ExactScale` live in `core`. The speed gate is `tools/benchmark/core/complex-tan-family.bench.mjs`.
**Follows:** Phases 1–5 ([#519](https://github.com/danielsimonjr/MathTS/pull/519)–[#528](https://github.com/danielsimonjr/MathTS/pull/528)) and the Phase 6 build PRs ([#532](https://github.com/danielsimonjr/MathTS/pull/532)–[#542](https://github.com/danielsimonjr/MathTS/pull/542)). Do not re-implement those PRs.
**Does not include:** Phase 7. A separate planner owns [`docs/plans/CLONES_PHASE_7_PLAN.md`](./CLONES_PHASE_7_PLAN.md). This file does not write that plan, does not run `repo-tools clones`, and does not replace [`docs/roadmap/CLONES_REMAINING.md`](../roadmap/CLONES_REMAINING.md).

## Goal

Three pull requests, merged to `main` in the order below. Each one has an acceptance test. A later PR rebases onto `main` after the previous one merges.

The request's fifth item (any other open PySR roadmap item, TODO, or issue) is recorded at the end of this file. It does not add a fourth PR.

## Roles

| Role     | Model             | Job                                                                                                                                                     |
| -------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builder  | composer-2.5      | Implements one PR from this file. Does not start the next PR. Does not tick B9 on a PR the reviewer has not re-run.                                     |
| Reviewer | claude-sonnet-5-5 | Independent of the builder. Re-runs the PR's commands, greps for a second copy of an algorithm the PR claims to reuse, and approves only with evidence. |

## Definition of Done

Copy §6's B1–B9 into every implementation PR body. Tick a box only with a command and its result, or a file and a line. B9 is the reviewer's box.

PR 1 is docs-only and waives B7: no changeset. It still passes `bun run format:check` and `bun run docs:roadmap-check`.

## Non-goals

- No tag, no GitHub Release, no npm publish, no `package.json` `"version"` edit. Do not push to `changeset-release/main`. Do not edit, retarget, close, or merge PR [#398](https://github.com/danielsimonjr/MathTS/pull/398). Do not set the repository variable `RELEASES_ENABLED`.
- No `<pkg>@<version>` line under `ROADMAP.md` "Recently shipped".
- Do not bump `REPO_TOOLS_VERSION` (`2.2.4` in `.github/workflows/ci.yml`). Clone measurement uses repo-tools 2.3.0 and is the Phase 7 planner's job.
- No Phase 7 design, no regeneration of the clone ledger, no unary `Float64Array` overload generator.
- No second copy of the tangent formula. PR 3 keeps one closed form.
- No redefinition of storage `bit`. No second `ln2` constant and no float `irrational` field on `ExactScale`.
- No new package. No change to `functions/src/wasm/policy.ts`, `GPU_MIN_ELEMENTS`, or `matrix/src/config.ts` `DEFAULT_CONFIG`.

## Already on main

Leave these alone. A PR that rewrites them is out of scope.

| Item                   | Evidence on `9dc97c56`                                                                                                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1, M3, M4 B9          | Recorded review in the roadmap §6, reviewer claude-sonnet-5-5, [#519](https://github.com/danielsimonjr/MathTS/pull/519), reconfirmed at [#528](https://github.com/danielsimonjr/MathTS/pull/528).                                                                                      |
| M2 bridge              | `functions/src/scalar-node-bridge.ts`. Barrel via `export * from './factories/index.js'` (`functions/src/index.ts:21`, comment at line 89). Merged [#440](https://github.com/danielsimonjr/MathTS/pull/440).                                                                           |
| M5 RNG                 | `createSeededRng` / `SeededRng` in `core/src/numeric/rng.ts`. Barrel `core/src/index.ts:262`.                                                                                                                                                                                          |
| M6 gradient            | `compileScalarGradient` in `functions/src/scalar-compile.ts`. Barrel `functions/src/index.ts:51`.                                                                                                                                                                                      |
| M7 fit                 | `fitScalarParameters` in `functions/src/fit-scalar.ts`. Barrel `functions/src/index.ts:402`.                                                                                                                                                                                           |
| M8 equivalence         | `numericallyEquivalent` in `functions/src/numeric-equivalence.ts`. Barrel `functions/src/index.ts:100`.                                                                                                                                                                                |
| Phases 3–5             | [#519](https://github.com/danielsimonjr/MathTS/pull/519)–[#528](https://github.com/danielsimonjr/MathTS/pull/528). Sprint 2R DoD boxes in the roadmap (the two under "Sprint 2R") are `[x]`.                                                                                           |
| Phase 6 builds         | [#532](https://github.com/danielsimonjr/MathTS/pull/532) through [#542](https://github.com/danielsimonjr/MathTS/pull/542), commits `654984e3` through `9dc97c56`. The ledger at `40466a97` (553 near pairs) is the pre-merge measurement. Do not refresh it here.                      |
| Exact unit table       | [#346](https://github.com/danielsimonjr/MathTS/pull/346) (`f31f5ee0`), `core/src/types/unit/unit-table.ts`.                                                                                                                                                                            |
| `ExactScale` and `ln2` | `ExactScale` is `{ num, den, irrationals }`. `NAMED_IRRATIONALS.ln2` is the 120-digit string (`core/src/types/unit/exact-scale.ts`). `LN2_EXACT_SCALE = namedIrrationalScale('ln2')` at line 148. Shipped in `15adc892` (core 0.18.0). Re-exported from `@danielsimonjr/mathts-units`. |
| UPT delegation units   | [#385](https://github.com/danielsimonjr/MathTS/pull/385) (`61426de1`, core 0.19.0, closes [#347](https://github.com/danielsimonjr/MathTS/issues/347)). The block starts at `unit-table.ts` "Units UPT delegates". Published core on `main` is 0.19.0.                                  |
| `tanFamily`            | `core/src/types/complex.ts:11`. [#536](https://github.com/danielsimonjr/MathTS/pull/536) (`9f5a065a`). Bit pin: `core/tests/complex-tan-family-pin.test.ts` (20,729 arguments, `Object.is` on both parts).                                                                             |

## Order

| PR  | Title                                                        | Depends on |
| --- | ------------------------------------------------------------ | ---------- |
| 1   | Record B9 for M2 and M5–M8, and correct the roadmap status   | none       |
| 2   | Residual UPT spellings `d` and `Angstrom`, and the `ln2` pin | none       |
| 3   | P6-5 JavaScriptCore regression, one closed form kept         | none       |

PRs 2 and 3 do not edit the roadmap, so they do not conflict with PR 1. Land them in this order anyway.

## Shared CI bar

Every PR:

- `bun run format:check`.
- `bun run docs:roadmap-check` when a roadmap markdown file changes. Do not add a `<pkg>@<version>` line under `ROADMAP.md` "Recently shipped".
- `repo-tools check . --docs=docs/Architecture` with `@danielsimonjr/repo-tools` **2.2.4** (the pin `REPO_TOOLS_VERSION` in `.github/workflows/ci.yml`). When a Verification cell fails, set it to the number the checker prints. Commit that regeneration. Do not hand-edit `FILE_INVENTORY.md`, `dependency-graph.json`, or the other generated architecture files, and do not bump the pin.
- Linux CI on the PR head is green. The jobs in `.github/workflows/ci.yml` include `compile`, `test`, `coverage`, and `architecture-docs`.
- No tag, release, or publish. PR #398 stays untouched. `RELEASES_ENABLED` stays unset.
- A new `.ts` file makes the pre-commit hook run `bun run docs:deps`. Commit the generated `docs/Architecture/*` diff. Do not bypass the hook (`--no-verify`).

Docs-only PR 1 skips `bun run typecheck`, `bun run lint`, and the changeset.

PRs 2 and 3 also:

- `bun run typecheck` reports 0 errors.
- `bun run lint` (`oxlint --deny-warnings`) reports 0 warnings.
- A changeset (`.changeset/*.md`) for every touched published package. `patch` for a behavior fix. No version bump in `package.json`.
- `node tools/test/check-export-lock.mjs` exits 0. These PRs add no export name, so the lock file stays as it is.
- Package tests run from the package directory. `core` is `bun test --isolate --timeout 30000`. `functions` is `bunx vitest run`. The repo-root `vitest.config.ts` includes only `tests/integration/**` and `tests/wasm/**`, so `bunx vitest run functions/tests/…` from the repo root exits 1 with "No test files found". Core tests import `describe`, `it`, and `expect` from `vitest`, matching the files already in `core/tests/`.

## PR 1 — Record B9 for M2 and M5–M8, and correct the roadmap status

**Size:** S. Docs only. **Depends on:** nothing.

### Outcome

§6 B9 for M2 ([#440](https://github.com/danielsimonjr/MathTS/pull/440)), M5, M6, M7, and M8 changes to Yes, in the same place and the same shape as the M1/M3/M4 record. The reviewer is claude-sonnet-5-5. The builder does not tick the boxes.

The same PR corrects the roadmap sentences that still describe this tree as if Phase 6 had not started and as if Phases 3–5 were still next. §7 stays shut: the clone loop is not clean, and that loop belongs to the Phase 7 plan.

A planning read of the five implementations found no behavior defect, so this plan does not schedule a fix PR. If the reviewer's re-run disagrees with a spec line, that defect is its own PR and lands before B9 for that milestone is ticked. The sign-off PR then records only the milestones whose re-run matched the spec.

### Work

The reviewer re-runs these five commands and pastes each summary line into the new Recorded review block:

```bash
(cd functions && bunx vitest run tests/scalar-node-bridge.test.ts)
(cd core && bun test --isolate --timeout 30000 tests/numeric/rng.test.ts)
(cd functions && bunx vitest run tests/scalar-compile-gradient.test.ts)
(cd functions && bunx vitest run tests/fit-scalar-parameters.test.ts)
(cd functions && bunx vitest run tests/numeric-equivalence.test.ts)
```

The reviewer then checks these reads. Each one is a cell in the new audit table, or a bullet in the Recorded review, the same way the M1 review names `hasOwnProperty` at `scalar-structure.ts:208`.

| Milestone | What the re-run confirms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2        | `functions/src/scalar-node-bridge.ts` contains no `parse(`, `eval(`, or `new Function`. `nodeToScalarImpl` unwraps `ParenthesisNode` at lines 163–166. A node type outside the scalar subset throws `ScalarBuildError` at line 272. `ConditionalNode` is that case: the test file never names it, so the reviewer confirms the throw (quote line 272, and add a test in the sign-off PR only if the throw is missing). Unary minus, `log` / `log10`, and the UPT header keys stay as the M2 acceptance lines (roadmap lines 542–550). |
| M5        | `createSeededRng` calls `mulberry32`. String seeds use FNV-1a (`FNV_OFFSET = 0x811c9dc5` in `core/src/numeric/rng.ts`). There is no second generator. `seedProbabilityRng` and `createRng` are unchanged. `createSeededRng(42)` still matches `MULBERRY32_42_FIRST_8`.                                                                                                                                                                                                                                                                |
| M6        | Unary derivatives in `functions/src/scalar-compile.ts` come from `DUAL_UNARY_RULES`. The only extra calculus is the `^` partial (`Math.log` at line 271).                                                                                                                                                                                                                                                                                                                                                                             |
| M7        | `fit-scalar.ts` calls `levenbergMarquardt`, `bfgs`, `nelderMead`, `pairwiseSum`, and `pairwiseDot`. It does not define another optimizer.                                                                                                                                                                                                                                                                                                                                                                                             |
| M8        | `numeric-equivalence.ts` imports `nearlyEqual` from `@danielsimonjr/mathts-core/internal` and calls `compileScalar`. The TSDoc says the `consistent` verdict is evidence, not proof. `paretoDist` is unrelated and stays out of this review (already recorded for M4).                                                                                                                                                                                                                                                                |

Export lines for the B3 cells: M2 via the factories re-export (`functions/src/index.ts:21` and the comment at line 89); M5 `core/src/index.ts:262`; M6 `functions/src/index.ts:51`; M7 `functions/src/index.ts:402`; M8 `functions/src/index.ts:100`. Usage sections already exist in `docs/api/functions.md` and `docs/api/core.md`; the B4 cell cites them.

### Files

| Path                                    | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/roadmap/PYSR_INFORMED_ROADMAP.md` | Add a second §6 audit table, columns M2, M5, M6, M7, M8, rows B1–B9, immediately after the M1/M3/M4 table. Add a **Recorded review** block after the existing one (the #519 block stays). Tick M2's B9 line (roadmap line 561) in the M1 form: `- [x] B9 reviewer sign-off: claude-sonnet-5-5, [#<this PR>](...)`. M5, M6, M7, and M8 have no B9 line today; add one ticked line to each DoD list, same wording.                                                                     |
| same file, status                       | The status paragraph (line 25) says B9 for M2 and M5–M8 stays open and that Phase 6 (§8) has not started. After this PR the B9 clause is Yes, and the Phase 6 clause records that build PRs [#532](https://github.com/danielsimonjr/MathTS/pull/532)–[#542](https://github.com/danielsimonjr/MathTS/pull/542) are merged and that the loop is not clean. The next measurement and `CLONES_PHASE_7_PLAN.md` belong to the other planner. The paragraph does not say ready to release. |
| same file, "Next, in order"             | Item 1 still says to leave B9 for M5–M8 unchecked. Item 3 says Sprint 2R's two unchecked DoD boxes stay unchecked; those boxes (roadmap lines 980 and 993) are `[x]`. Item 4 still says the next implementation is Phases 3–5. Item 5 is the clone loop. Rewrite the four items so they match the tree: Phases 1–5 are on `main`, B9 for M2 and M5–M8 is this PR, Phase 6's build PRs are merged, and §7 still waits on a clean clone loop owned by the Phase 7 plan.                |
| same file, blockquote after the status  | The blockquote (line 32) still says next is Phases 3–5. Point it at this plan for the three PRs, and at the Phase 7 plan for the clone loop.                                                                                                                                                                                                                                                                                                                                         |
| same file, Phase 6 section              | The heading "Phase 6 and up: clone-reduction loop" appears twice (lines 1405 and 1462) with the same body. Delete the second copy. Keep one.                                                                                                                                                                                                                                                                                                                                         |
| same file, §9                           | Under the `TemplateExpressionSpec` / `D(f)` / `TypeSpec` / `denoise` / feature-selection bullet, record that M13 is on `main` ([#526](https://github.com/danielsimonjr/MathTS/pull/526), [#530](https://github.com/danielsimonjr/MathTS/pull/530)) and that no consumer request was found, so the bullet stays in §9 and does not block §7. Do not build those features.                                                                                                             |

[`docs/plans/PYSR_PHASES_3_5_PLAN.md`](./PYSR_PHASES_3_5_PLAN.md) line 52 ("two unchecked DoD boxes under Sprint 2R stay unchecked") described the tree at `a847be64`. Leave that historical sentence. The live boxes are in the roadmap.

### Acceptance

- The five commands exit 0, and the Recorded review pastes the summary line of each.
- The M1/M3/M4 audit table and its Recorded review are unchanged.
- Each new B9 cell names claude-sonnet-5-5 and this PR, and cites the command that passed.
- `ConditionalNode` hits the line-272 throw. If it does not, B9 for M2 stays open and a fix PR lands first.
- One "Phase 6 and up" section remains. The status paragraph does not say Phase 6 has not started, and it does not say ready to release.
- `bun run format:check` and `bun run docs:roadmap-check` exit 0.

### CI

Shared bar for a docs-only PR.

## PR 2 — Residual UPT spellings `d` and `Angstrom`, and the `ln2` pin

**Package:** `@danielsimonjr/mathts-core` and `@danielsimonjr/mathts-units`. **Size:** S. **Depends on:** nothing.

### Outcome

Every symbol in UPT `data/units.json` (blob `6acf72b69f29e28534fa03dd76b6e41e17a6808b`, 91 units, 104 symbols, default-branch file as read for this plan) parses to the UPT scale and dimension, except storage `bit`, which stays the MathTS storage unit. `readScaleExpression('ln2')` is `LN2_EXACT_SCALE`.

The figure "41 UPT-only units" is the gap from before [#385](https://github.com/danielsimonjr/MathTS/pull/385). On this tree the residual is two spellings:

| Symbol     | UPT scale | UPT dimension   | MathTS today                                                                                                                                                                                                  |
| ---------- | --------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `d`        | `86400`   | time (`T: 1`)   | Missing. `day` is the row at `unit-table.ts:345` with scale `86400`. `d` is the deci prefix (`unit-table.ts` prefix row `['d', 'deci', -1, false]`).                                                          |
| `Angstrom` | `1e-10`   | length (`L: 1`) | Missing. The row key is `angstrom` (`unit-table.ts:268`). Alias `Å` exists. `normalizeUnitSpellings` rewrites `Å` to `angstrom` and does not rewrite the ASCII spelling `Angstrom`. Lookup is case-sensitive. |

`LN2_EXACT_SCALE` is already that constant. This PR pins it. It does not add a constant, and it does not change `ExactScale` to UPT's `{ num, den, irrational: number }` (one `Math.LN2` float).

UPT's own `bit` row is dimensionless with scale `ln2`. MathTS `bit` stays the storage unit (`unit-table.ts:431`, BIT dimension, scale 1, 8 per byte). That was the [#385](https://github.com/danielsimonjr/MathTS/pull/385) decision. An information bit remains `createUnit` of `shannon` as `1 nat` with `exact: 'ln2'`, which `core/tests/types/unit-upt-delegation.test.ts` already pins. Do not redefine `bit`.

### Work

Add two aliases in `UNIT_ROW_ALIASES`. Do not add a second `UNIT_ROWS` entry for either unit. `core/tests/types/unit-exact-definitions.test.ts` resolves an alias to its canonical row and requires a `DEFINITIONS` entry only for that row; `day` and `angstrom` are already defined, so the list stays as it is.

- `d: 'day'`. `_findUnit` (`core/src/types/unit/Unit.ts`, the exact-name check before the prefix scan) already treats an own key of `UNITS` as the unit. Aliases are copied into `UNITS` at startup. Bare `d` is therefore the day, and `dm` stays a decimetre, the same rule the table already documents for `G` / `GPa`, `P`, `M`, and `u`. UPT `prefixLetterUnits.letters` is `T`, `G`, `P`, `h`, `d`, `M`, `u`, `c`; `d` is the letter still missing as an exact name.
- `Angstrom: 'angstrom'`.

Do not re-add the [#385](https://github.com/danielsimonjr/MathTS/pull/385) rows (`nat` through `therm` in the delegation block, plus the aliases under "Issue #347 spellings").

### Files

| Path                                                                                   | Action                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/src/types/unit/unit-table.ts`                                                    | Add the two aliases above.                                                                                                                                                                                                                                                                                                                                                       |
| `core/tests/types/unit-upt-delegation.test.ts`                                         | Extend this file. Assert `new Unit(1, 'd').toNumeric('s')` is `86400`, `new Unit(1, 'dm').toNumeric('m')` is `0.1`, `new Unit(1, 'day')` is unchanged, and `new Unit(1, 'Angstrom').toNumeric('m')` is `1e-10`.                                                                                                                                                                  |
| `core/tests/` fixture                                                                  | Commit a copy of the UPT symbol list (symbol, scale, dimension) taken from that blob, with the blob SHA in the test header. The test does not fetch at runtime. Walk every symbol. After `normalizeUnitSpellings`, each symbol except `bit` parses and its SI value matches the UPT scale. Assert `bit` separately as the storage convention (1 byte = 8 bit), not as `ln2` nat. |
| `core/tests/types/exact-scale-registry-parse.test.ts` and `exact-scale-review.test.ts` | Already pin `readScaleExpression('ln2')` equal to `LN2_EXACT_SCALE` and `exactScaleToNumber(LN2_EXACT_SCALE)` equal to `Math.LN2` (`toBe`, which is `Object.is`). They must stay green. Do not add a second constant to satisfy them.                                                                                                                                            |

`@danielsimonjr/mathts-units` re-exports `Unit` and `LN2_EXACT_SCALE` and has no implementation of its own. A behavior change of `Unit` is a patch changeset on both packages. No new export name.

### Acceptance

```bash
cd core && bun test --isolate --timeout 30000 \
  tests/types/unit-upt-delegation.test.ts \
  tests/types/unit-exact-definitions.test.ts \
  tests/types/exact-scale-registry-parse.test.ts \
  tests/types/exact-scale-review.test.ts
```

- The command exits 0.
- The vendored walk's only allowed disagreement with UPT is `bit`.
- `d` is 86400 seconds and `dm` is 0.1 metres.
- `Angstrom` is `1e-10` metres.
- `readScaleExpression('ln2')` equals `LN2_EXACT_SCALE`, and `exactScaleToNumber` of that scale is `Math.LN2`.
- Storage `bit` is unchanged.

### CI

Shared bar, plus typecheck, lint, and the two patch changesets. `node tools/test/check-export-lock.mjs` exits 0 without `--write`.

## PR 3 — P6-5 JavaScriptCore regression, one closed form kept

**Package:** `@danielsimonjr/mathts-core`. **Size:** S. **Depends on:** nothing.

### Outcome

`Complex.tan`, `cot`, `tanh`, and `coth` stay bit-identical to the pre-P6-5 bodies, and the speed gate passes on Node (V8) and on Bun (JavaScriptCore). The four methods still share one closed form. The public methods keep their names. `Complex` keeps its kind. The export lock does not change.

### Defect

[#536](https://github.com/danielsimonjr/MathTS/pull/536) (`9f5a065a`) replaced four copies with `tanFamily(t, h, cot, hyperbolic)` (`core/src/types/complex.ts:11`). The four methods call it with literal booleans (`tan` / `cot` at lines 505 and 512, `tanh` / `coth` at lines 557 and 564, the hyperbolic pair with the doubled parts swapped).

The committed gate (`tools/benchmark/core/complex-tan-family.bench.mjs`) warms five reps, times old and new alternately (ABBA) over 10⁶ arguments (about 12% past `|arg| > 700`), checks bit-identity first, and exits 1 when any `new/old` ratio exceeds `BENCH_NOISE` (default `0.05`). [#536](https://github.com/danielsimonjr/MathTS/pull/536) recorded:

| new / old                                |   tan |   cot |  tanh |  coth |
| ---------------------------------------- | ----: | ----: | ----: | ----: |
| Node 22 (V8), head of #536               | 1.023 | 0.987 | 0.991 | 0.982 |
| Bun 1.4.2 (JavaScriptCore), head of #536 | 1.052 | 1.112 | 1.077 | 1.009 |

V8 is inside the band. JavaScriptCore misses it on `tan`, `cot`, and `tanh` (about 5% to 11%), and the PR says that pair of runs reproduced. The PR kept the helper under AGENTS.md benchmark rule 10 (dispatch decisions from V8) and said the helper costs a few percent where the engine does not inline it. The two boolean parameters are the live branches a non-inlined call cannot fold. V8 inlines the call and folds the literals. JavaScriptCore leaves the frame and the branches.

### Work

Remove the runtime boolean dispatch from the path JavaScriptCore does not inline. The four methods become straight-line: the sign and the real/imag order are literals in each method, and the arithmetic expression has one source.

A shape that binds `cot` and `hyperbolic` once, when the method is created, and then runs a body with no boolean parameter, is still one source. A shape that pastes the four pre-P6-5 bodies back as independent copies is not.

Measure the shape with the existing bench. If no single-source shape passes the Bun band, stop and report both engines' ratios in the PR. Do not restore four copies to make the bench pass.

The bit pin stays. `core/tests/complex-tan-family-pin.test.ts` replays the pre-P6-5 bodies and requires `Object.is` on both parts. Update it only if a comment names the old helper shape. The compared values stay the pre-P6-5 results.

### Files

| Path                                                | Action                                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `core/src/types/complex.ts`                         | Replace the boolean-parameter hot path. One closed form. Four public methods, same names. |
| `core/tests/complex-tan-family-pin.test.ts`         | Stays the bit-identity oracle.                                                            |
| `tools/benchmark/core/complex-tan-family.bench.mjs` | Unchanged gate. The bench imports `core/dist`, so build `core` before running it.         |

### Acceptance

Build, then run the bench twice on each engine. Paste the four ratios from each of the four runs into the PR body.

```bash
bunx turbo build --filter=@danielsimonjr/mathts-core
node tools/benchmark/core/complex-tan-family.bench.mjs
node tools/benchmark/core/complex-tan-family.bench.mjs
bun tools/benchmark/core/complex-tan-family.bench.mjs
bun tools/benchmark/core/complex-tan-family.bench.mjs
```

Every `new/old` ratio in all four runs is at most `1.05`. The script already exits 1 when a ratio exceeds the band, so each command exits 0.

```bash
cd core && bun test --isolate --timeout 30000 \
  tests/types/complex.test.ts \
  tests/types/complex-coverage.test.ts \
  tests/types/complex-oracle.test.ts \
  tests/complex-tan-family-pin.test.ts
cd functions && bunx vitest run tests/typed-complex.test.ts
```

Both commands exit 0. Results of the four methods stay bit-identical to the pin. One closed form remains (reviewer grep: the arithmetic is not four independent copies).

### CI

Shared bar, plus typecheck, lint, and a patch changeset on `@danielsimonjr/mathts-core`. `node tools/test/check-export-lock.mjs` exits 0 without `--write`.

## Item 5 — recorded, not a PR

These are the other open roadmap items, TODOs, and issues that belong to the PySR phases. None of them is an implementation PR in this plan.

| Item                                                                                                                         | Where                                                                                                                | What this plan does                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Roadmap status, the duplicated Phase 6 section, and the §9 "revisit after M13" bullet                                        | `docs/roadmap/PYSR_INFORMED_ROADMAP.md`                                                                              | Folded into PR 1. M13 is on `main`. No consumer request was found. The features stay in §9.                 |
| Sprint 2R "two unchecked DoD boxes"                                                                                          | Roadmap lines 980 and 993 are `[x]`. The sentence in `PYSR_PHASES_3_5_PLAN.md` is historical.                        | PR 1 corrects the live "Next, in order" item. It does not edit the historical plan.                         |
| §10 question 4, CODATA uncertainties on `functions/src/type/unit/physicalConstants.ts`                                       | Roadmap §10 item 4. Sprint 3R item 3, only if the owner says yes.                                                    | Leave the question open. Do not add an uncertainty field.                                                   |
| §10 question 5, AIC/BIC                                                                                                      | Roadmap §10 item 5. `scoreFront` on the linear scale returns `null` (`functions/src/pareto-front.ts`).               | Leave the question open. Do not add a score.                                                                |
| §9 `TemplateExpressionSpec`, `D(f)`, `TypeSpec`, `denoise`, feature selection                                                | Roadmap §9.                                                                                                          | Stay out of scope. PR 1 records that. Do not build them.                                                    |
| Issue [#426](https://github.com/danielsimonjr/MathTS/issues/426) (audit I-10)                                                | Open. Roadmap §10 item 8 decided no code change: `@danielsimonjr/mathts-typed-function` has no workspace dependents. | Leave the issue open. Do not add a dependent.                                                               |
| Issue [#423](https://github.com/danielsimonjr/MathTS/issues/423) (audit I-7, remaining duplicate algorithms)                 | Open. The remainder of that work is the clone loop.                                                                  | Leave the issue open. Phase 7 owns it. Do not close it from these PRs.                                      |
| Issues [#375](https://github.com/danielsimonjr/MathTS/issues/375)–[#384](https://github.com/danielsimonjr/MathTS/issues/384) | PhysJS kernel requests. Roadmap §11 records that they do not overlap this roadmap.                                   | Outside this plan.                                                                                          |
| `docs/roadmap/BUN_MIGRATION.md` checkboxes                                                                                   | Bun migration, not a PySR phase.                                                                                     | Outside this plan.                                                                                          |
| PR [#398](https://github.com/danielsimonjr/MathTS/pull/398)                                                                  | Open "chore: release packages".                                                                                      | Leave it unmerged. §7 is still shut after these three PRs, because the clone loop is not part of this plan. |
| `RELEASES_ENABLED`                                                                                                           | Unset.                                                                                                               | Stays unset.                                                                                                |

## Hard limits

These apply to this plan and to every PR it names.

- No tags, no GitHub Releases, no npm publishes, no `package.json` version edit.
- Leave PR #398 alone.
- Never set `RELEASES_ENABLED`.
- Keep the architecture-docs CI job green: `repo-tools check . --docs=docs/Architecture` at `@danielsimonjr/repo-tools` 2.2.4. If a Verification cell fails, set it to the number the checker prints and commit the regenerated docs. Do not bump `REPO_TOOLS_VERSION`.
