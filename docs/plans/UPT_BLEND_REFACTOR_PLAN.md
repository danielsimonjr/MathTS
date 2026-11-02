# Plan: fold the external-project layer into MathTS

**Status:** planning only. This file is the contract for later implementation PRs. It does not change runtime source.
**Tree reviewed:** `8b0192cb` (`fix(matrix): DenseMatrix multiply 0×Infinity (#561)`), which is `origin/main` at the time of this plan.
**Program:** every useful behavior that arrived for Universal Physics Tensor (UPT) or from the PySR-informed roadmap stays, under MathTS names and MathTS docs. The names, the consumer contract, and the physics-framework wishlist leave. No release, no tag, no version bump.

This plan file itself matches the acceptance search. [PR 9](#pr-9--delete-this-plan) deletes it after the other PRs land. Git history keeps it. Do not rewrite history to scrub old commits.

## Judgment

Three verdicts, applied per file below.

**Generalize.** The behavior is a MathTS feature. Keep the code, the tests, and the public names. Rewrite comments and docs so they describe that feature and do not name UPT, UPTF, PySR, or `universal-physics-tensor`.

**Rename.** A file name, a test title, a fixture key, or a pending changeset summary is the only thing carrying the old name. The bytes of the test stay. Pending changesets are not release notes: their summary is what a future version PR would write into a changelog, so the summary is rewritten now and the version PR is not run.

**Drop.** The file exists to talk to, or about, the other project. Delete it after any still-true MathTS fact has a home that does not use those names. Git history is the archive. Do not move the file to `docs/archive/`: a copy under `docs/` would still match the search.

A fourth flag, **misfit**, is not a deletion of shipped numerics. It marks designs that are a physics framework rather than this library. Do not implement them. Where a live doc presents them as MathTS work, restate them as out of scope.

Public names that already fit MathTS stay. That includes `upToConstant` (a scale freedom on `numericallyEquivalent`), `physicsScope` (bare `e` as the elementary charge), `ScalarNode`, `searchScalars`, `paretoFront`, `scoreFront`, `selectFrontModel`, `fitScalarParameters`, `inferScalarDimension`, `solveParameterDimensions`, and `DEFAULT_MUTATION_WEIGHTS`. None of those identifiers are the other project's name.

## What the code already is

The scalar toolkit is a MathTS API. Callers build a `ScalarNode` (`number`, `symbol`, `op`, `call`) with `createScalarBuilder`. `ln` lowers to natural `log` and `log` lowers to `log10`. A formula string is rejected. The shipped surface, all of which stays:

| Area          | Home                                                                                                     | Exports that stay                                                                                                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Structure     | `expression/src/scalar-structure.ts`                                                                     | `forEachScalar`, `mapScalar`, `scalarSize`, `scalarDepth`, `scalarComplexity`, `scalarSymbols`, `scalarCanonical`, `scalarCanonicalKey`, `scalarEquals`, `ScalarComplexityWeights`                                                         |
| Batch and fit | `functions/src/scalar-compile.ts`, `functions/src/fit-scalar.ts`                                         | `compileScalar`, `compileScalarGradient`, `fitScalarParameters`                                                                                                                                                                            |
| Bridge        | `functions/src/scalar-node-bridge.ts`                                                                    | `scalarToNode`, `nodeToScalar`, `simplifyScalar`, `scalarToTex`                                                                                                                                                                            |
| Front         | `functions/src/pareto-front.ts`, `functions/src/front-export.ts`                                         | `paretoFront`, `scoreFront`, `selectFrontModel`, `frontToLatexTable`, `frontToJson`                                                                                                                                                        |
| Compare       | `functions/src/numeric-equivalence.ts`                                                                   | `numericallyEquivalent` (`consistent` is evidence, not proof)                                                                                                                                                                              |
| Dimension     | `functions` scalar-dimension modules, `core/src/types/si-dimension-vector.ts`                            | `inferScalarDimension`, `solveParameterDimensions`, `SiDimensionVector` of seven `Fraction`s in BIPM order `[L, M, T, I, Θ, N, J]`                                                                                                         |
| Search        | `expression/src/scalar-enumerate.ts`, `functions/src/scalar-mutate.ts`, `functions/src/scalar-search.ts` | `enumerateScalars`, the mutation operators, `searchScalars`                                                                                                                                                                                |
| Units         | `core/src/types/unit/unit-table.ts`, `Unit.ts`                                                           | The supplementary units and spellings already in the table (`nat`, `percent`, `ppm`, `ppb`, `d` as day, `Angstrom`, cycle rates, exact scales, the ISO 80000 solidus). Storage `bit` stays 8 per byte, not an information bit of `ln2` nat |

`searchScalars` is the one shipped feature that is a search driver rather than a numeric primitive. It stays. This program does not extend it.

The score and the selection rule are MathTS definitions. [PR 6](#pr-6--maths-reference-then-delete-the-named-docs) writes them down without an external citation:

- `scoreFront` on the log scale walks the array in the order given. It does not sort and it does not drop rows. The first row scores `0`. Each later row with `loss > 0` scores `-Math.log(loss / previousLoss) / (complexity - previousComplexity)`. `loss <= 0` scores `+Infinity`. A zero complexity gap is IEEE division (`NaN` or an infinity); there is no special case. On the linear scale every score is `null`, and a zero loss does not become `+Infinity`. Any other `lossScale` throws `ParetoFrontError`.
- `selectFrontModel` defaults to `best` with factor `1.5`. `accuracy` is the minimum loss. `score` is the maximum score. `best` keeps rows with `loss <= 1.5 * min(loss)` and then takes the maximum score. If every score is `null`, `score` and `best` both fall back to `accuracy`. A mix of `null` and numeric scores throws. Ties: lower complexity, then the earlier input index. `NaN` is worse than every other score, including `-Infinity`. The return value is the same object as the chosen row.
- `DEFAULT_MUTATION_WEIGHTS` in `functions/src/scalar-mutate.ts` keeps its numbers and its draw order. The comment stops pointing at a roadmap section. `MUTATE_CONSTANT_NEGATE_PROBABILITY` stays `0.00743`. The comment on that constant cites "Roadmap §2.5" and does not contain a forbidden token; [PR 3](#pr-3--functions-comments-hand-docs-pending-changesets) still rewrites it, or the deleted roadmap leaves a dangling pointer.

## Baseline

Two searches, both from the repo root, both with `--hidden` and `--no-ignore`, skipping `.git`, `node_modules`, `dist`, `.turbo`, and `build`.

The inventory search the request named:

```bash
rg -i -n --hidden --no-ignore \
  --glob '!.git/**' --glob '!node_modules/**' --glob '!**/dist/**' \
  --glob '!**/.turbo/**' --glob '!**/build/**' \
  -e 'upt|universal.physics|pysr' .
```

On `8b0192cb` that is **666 matches, 550 lines, 120 files**. Most of the extra lines are not the other project. They are the substring `upt` inside ordinary words. Those files are listed under [Do not edit](#do-not-edit). A later PR that "cleans" them will break public APIs and sparse-matrix code.

The search that must be empty at the end of the program, except the [historical release notes](#historical-release-notes) and, until PR 9, this file:

```bash
rg -n --hidden \
  --glob '!.git/**' --glob '!node_modules/**' --glob '!**/dist/**' \
  --glob '!**/.turbo/**' --glob '!**/build/**' \
  -e '(^|[^A-Za-z])UPTF([^A-Za-z]|$)' \
  -e '(^|[^A-Za-z])UPT([^A-Za-z]|$)' \
  -e '(^|[^A-Za-z])Upt[A-Za-z]' \
  -e '(^|[^A-Za-z])upt[A-Z]' \
  -e '(^|[^A-Za-z])upt([^A-Za-z]|$)' \
  -e 'PySR' -e 'pysr' -e 'PYSR' -e 'Pysr' \
  -e 'universal-physics' -e 'Universal-Physics' \
  -e 'Universal Physics' -e 'universal physics' \
  -e 'Universal-Physics-Tensor' -e 'universal-physics-tensor' \
  .
```

On `8b0192cb` that is **555 matches in 81 files**. A bare `UPT` pattern is wrong: it matches the last three letters of `INTERRUPT`. `upt[A-Z]` without the left-hand boundary is also wrong: it matches `interruptExecution`. The command above has neither bug. It does not match `upToConstant`, `upToYotta`, `roundUpToPowerOf2`, `expectCloseUpToPermutation`, `uptr`, `uPtr`, `corrupt`, or `upto`.

Filenames, separate from file contents (`git ls-files`):

```text
.changeset/upt-residual-unit-spellings.md
core/tests/fixtures/upt-units-symbols.json
core/tests/types/unit-upt-delegation.test.ts
core/tests/types/unit-upt-symbols.test.ts
docs/integration/upt.md
docs/plans/PYSR_M1_PLAN.md
docs/plans/PYSR_M3_PLAN.md
docs/plans/PYSR_M4_PLAN.md
docs/plans/PYSR_PHASES_3_5_PLAN.md
docs/roadmap/PYSR_INFORMED_ROADMAP.md
functions/tests/upt-review-2-2026-10-15.test.ts
functions/tests/upt-review-2026-10-15.test.ts
```

After PR 9, `git ls-files | rg -i 'upt|pysr|universal-physics'` prints nothing. `git log` will still contain the old words. That is the record. Do not filter the log and do not rebase published history.

Benchmarks: `tools/benchmark/` and `tests/benchmark/` have no matches of either search. The final command still covers them.

## Do not edit

These are hits of the inventory regex only. Leave the identifiers alone.

| Class       | Why it matched                         | Examples to leave                                                                                                                                                                                                                                                                                                                                               |
| ----------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `upTo…`     | `upt` is the start of `upTo`           | `upToConstant` on `numericallyEquivalent`; `upToYotta` in `unit-table.ts` and `unit-exact-definitions.test.ts`; `roundUpToPowerOf2` in `gpu/src/BufferPool.ts`; `expectCloseUpToPermutation` in `tensor/tests/contraction-sequence.test.ts`                                                                                                                     |
| Sparse LU   | `uptr` / `uPtr` / `luPtr`              | `functions/src/algebra/decomposition/lup.ts`, `functions/src/algebra/sparse/csLu.ts`, `matrix/src/backends/WasmLoader.ts`, the signature in `docs/Planning/MATHTS_BUILDING_PLAN.md`                                                                                                                                                                             |
| `interrupt` | the word ends in those three letters   | `INTERRUPT_CHECK_INTERVAL` in `expression/src/scalar-enumerate.ts`; `interruptExecution` / `interruptCell` / `interruptAll` in `docs/Architecture/Workbook/MATHTS_WORKBENCH_SPECIFICATION.md` (the tag on line 137 is a real hit and is [PR 7](#pr-7--workbook-branding-and-planning-misfits)); `workbook/src/timeout-runner.ts`; `matrix/tests/config.test.ts` |
| `corrupt`   | `corrupt` contains those three letters | FFT, SVD, poly, autograd, workerpool, GPU tests, changelog sentences about corrupted state. The real changelog lines are listed separately and are not these sentences                                                                                                                                                                                          |
| `upto`      | one comment                            | `expression/src/parse.ts` ("View upto `length` characters")                                                                                                                                                                                                                                                                                                     |

`expression/src/scalar-enumerate.ts` is only the interrupt false positive. Do not rename that constant.

## Historical release notes

Leave these lines. They are versioned notes for commits that already shipped (`61426de`, `4e4acae`, `0d7853a`, and the 2026-05 autograd and tensor release headings). Rewriting them rewrites the published record. They are the only matches allowed after PR 9.

| File                     | Line on `8b0192cb` | Heading                            | Recommendation                                                                               |
| ------------------------ | ------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `CHANGELOG.md`           | 4194               | `## [autograd 0.1.0] - 2026-05-15` | Leave. The package is MathTS autodiff; the note names why 0.1.0 was cut.                     |
| `CHANGELOG.md`           | 4208               | `## [tensor 0.1.0] - 2026-05-14`   | Leave. Same for the tensor package.                                                          |
| `core/CHANGELOG.md`      | 7                  | `## 0.19.0`                        | Leave. The units, the solidus, and `createUnit`'s exact scale are the change.                |
| `core/CHANGELOG.md`      | 13                 | `## 0.18.1`                        | Leave. The numeric fixes are the change; the last sentence names the review that found them. |
| `units/CHANGELOG.md`     | 7                  | `## 0.5.0`                         | Leave. Same sentence as core 0.19.0, because the units package re-exports that release.      |
| `functions/CHANGELOG.md` | 45                 | `## 0.68.4`                        | Leave. Same review sentence as core 0.18.1.                                                  |
| `functions/CHANGELOG.md` | 53                 | `## 0.68.3`                        | Leave. `gammaincp`, `findRoot`, and `quad` are the change.                                   |

Do not add a committed allowlist file that repeats these sentences. That file would itself match the search. The reviewer of PR 9 diffs the command's output against this table. Line numbers will drift if `[Unreleased]` grows; match on the heading and the commit hash, not only the line number.

`CHANGELOG.md` line 97 is under the first `## [Unreleased]` (line 8). It is not a release note. [PR 5](#pr-5--release-gate-prose) rewrites "the three PySR merges" so the sentence no longer names that roadmap. The fact stays: the architecture-docs job exists because three merges left six documents' counts stale.

`functions/CHANGELOG.md` has an `## Unreleased` section. On this tree it does not contain these names. Leave it.

## Misfits

These do not belong in MathTS as product surface. The numeric primitives underneath them stay.

| Misfit                                                                                                                                                | Where it shows up                                                                                                                                                                                                                                                                                                                                             | What to do                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A physics framework on top of tensors: `MetricTensor`, Christoffel symbols, Riemann / Ricci / Einstein tensors, geodesic integrators as a library API | `docs/Planning/MATHTS_PRIORITY_IMPLEMENTATION_GUIDE.md` "Phase 2: UPTF Core"; `docs/Planning/MATHTS_PRIORITY_IMPLEMENTATION_GUIDE_PART2.md` (no forbidden token; the whole file is that sketch); `docs/Architecture/Workbook/MATHTS_ENHANCEMENT_ROADMAP.md` tiers marked critical for that framework; `autograd/src/forward-grad.ts` citing metric call-sites | Do not add those types. PR 7 strips the framework name and marks the sketches out of scope. PR 4 drops the call-site sentence. PART2 has nothing for the search to find; do not edit it and do not build it. `@danielsimonjr/mathts-tensor` as it exists (rank-N `Float64Array`, einsum, contraction) stays. |
| Many-body and quantum-number tensor storage: MPS/MPO, DMRG/TEBD/TDVP, fermionic anticommutation, quantum-number block-sparse storage                  | `docs/roadmap/ITENSOR_PARITY.md`, `docs/roadmap/FUNCTION_GAPS_AUDIT.md`, `TODO.md` around line 2433                                                                                                                                                                                                                                                           | Already decided out of scope. PR 8 says that in MathTS words and deletes the downstream-project name. Do not add the features.                                                                                                                                                                               |
| Dimensional analysis on `Tensor`                                                                                                                      | `docs/integration/upt.md` Q2, repeated in the roadmap                                                                                                                                                                                                                                                                                                         | `Tensor` stays unit-free. Scalar SI dimensions stay. PR 6 writes the non-goal into the scalar-search reference and deletes the integration note. Do not add `UnitTensor`.                                                                                                                                    |
| Adjudication of bridge equations, epistemic status, falsifiers, holdout policy                                                                        | The deleted roadmap's division of labour                                                                                                                                                                                                                                                                                                                      | Not a MathTS module. The scalar evaluator does not grow a status verdict.                                                                                                                                                                                                                                    |
| A foreign symbolic-regression runtime (Python, Julia, a vendored copy of another search package)                                                      | The deleted roadmap's non-goals                                                                                                                                                                                                                                                                                                                               | Still a non-goal. `searchScalars` is the in-tree driver.                                                                                                                                                                                                                                                     |
| Release gating tied to that roadmap                                                                                                                   | `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `MEMORY.md`, `.github/workflows/release.yml`, `.github/workflows/publish.yml`                                                                                                                                                                                                                                    | The switch is the repository variable `RELEASES_ENABLED`, exactly `true`, otherwise off. PR 5 says that and stops naming the roadmap. This program does not set the variable, does not merge the version PR, and does not delete the workflows.                                                              |
| Schwarzschild workbooks as a framework demo                                                                                                           | `docs/Architecture/Workbook/schwarzschild-geodesics.mtsw`, `schwarzschild_example.mtsw`                                                                                                                                                                                                                                                                       | The geodesic example can stay as a workbook sample. PR 7 removes the framework name from titles and tags. Do not grow a general-relativity package from it.                                                                                                                                                  |

## Rules for every implementation PR

- Branch from current `main`. Do not stack these PRs. Land them in the numbered order so a later PR does not put a deleted name back. Rebase if `main` moved.
- No changeset added. No edit to a `package.json` `"version"`. No tag, no GitHub Release, no `npm publish`, no `changeset version`, no `changeset publish`. Do not set `RELEASES_ENABLED`. Do not merge the "chore: release packages" PR.
- Behavior and public signatures stay. A test rename keeps the same assertions. Prefer a comment rewrite that keeps the file's line count, so the architecture verification tables do not move.
- Generated docs are not hand-edited. A changed leading comment under `src/` is regenerated with `bun run docs:deps` (the pre-commit hook does this when `src/` or a non-src `.ts` file changes). `docs/Architecture/dependency-graph.json`, `dependency-graph.yaml`, `DEPENDENCY_GRAPH.md`, `FILE_INVENTORY.md`, and `file-inventory.json` come from that command. `docs/reference/functions.html` is the embed of `docs/reference/functions.md`; edit the markdown above `<!-- BEGIN GENERATED EXPORT INDEX`, then `bun run docs:functions`. Do not edit inside the generated-index markers. Do not bypass the hook.
- Architecture gate, from `.github/workflows/ci.yml` job `architecture-docs`: Node 22, `npm install --global @danielsimonjr/repo-tools@2.2.4`, then `repo-tools check . --docs=docs/Architecture`. The pin is 2.2.4. If a `.ts` line count did change, set each failing verification cell to the number the checker prints. A markdown-only PR outside `docs/Architecture` does not move those counts; run the check anyway when the PR touches `docs/Architecture`.
- When `ROADMAP.md` or `docs/roadmap/` changes, `bun run docs:roadmap-check` exits 0. When the function reference changes, `bun run docs:functions:check` exits 0.
- Tests: the vitest files named in the PR, via `bunx vitest run <paths>`. Comment-only PRs still run the tests that import the edited modules. Do not claim a full `bun run test` unless it was run.
- Acceptance for that PR: those tests green, `repo-tools check` green, and the acceptance search finds no forbidden token in a file the PR owns. The global empty result is PR 9, not each PR.

## Pull requests

### PR 1 — supplementary units, comments and names

**Package:** `core`, plus the pending units changeset. **Verdict:** generalize the units, rename the wrappers.

The units and the `d` / `Angstrom` aliases are already on `main` (core 0.19.0 and the residual-spelling tests). Do not add them again. Do not change storage `bit`.

| File                                           | Action                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/src/types/unit/unit-table.ts`            | The comment "Units UPT delegates (issue #347)" becomes a MathTS comment: supplementary units and astronomical spellings, scales as written in this table. Leave `upToYotta`.                                                                                                                 |
| `core/src/types/unit/Unit.ts`                  | "Dimension vectors of the units added for UPT" becomes "derived dimension vectors; each is a product of the ten base dimensions above".                                                                                                                                                      |
| `core/src/types/si-dimension-vector.ts`        | The 7-vector is BIPM order. Delete the Buckingham-routine clause.                                                                                                                                                                                                                            |
| `core/tests/types/si-dimension-vector.test.ts` | Header cites BIPM order only.                                                                                                                                                                                                                                                                |
| `core/tests/types/unit-upt-delegation.test.ts` | Rename to `core/tests/types/unit-supplementary.test.ts`. Describe titles say what they assert (`d` is the day, `dm` stays a decimetre, `Angstrom` is `1e-10` m).                                                                                                                             |
| `core/tests/types/unit-upt-symbols.test.ts`    | Rename to `core/tests/types/unit-symbol-oracle.test.ts`. Rename `UptSymbolRow`, `uptFixture`, `UPT_DIMENSION_ORDER`, `UPT_REGISTRY_SCALES`, `uptScaleResolver`, `uptScaleNumber` to neutral names. The walk, the `bit` exception, and the angle / solid-angle / information allow-list stay. |
| `core/tests/fixtures/upt-units-symbols.json`   | Rename to `core/tests/fixtures/unit-symbol-oracle.json`. Remove the `source` string that names the other repository. Keep `blob` as an opaque oracle id and keep every symbol row. The test still does not fetch.                                                                            |
| `.changeset/upt-residual-unit-spellings.md`    | Rename to `.changeset/supplementary-unit-spellings.md`. Rewrite the summary without the old name. Keep the frontmatter (`core` and `units`, both patch).                                                                                                                                     |

`bun run docs:deps` refreshes `FILE_INVENTORY.md` and `file-inventory.json` for the renamed tests. Do not hand-edit those.

```bash
bunx vitest run \
  core/tests/types/unit-supplementary.test.ts \
  core/tests/types/unit-symbol-oracle.test.ts \
  core/tests/types/si-dimension-vector.test.ts
repo-tools check . --docs=docs/Architecture
```

### PR 2 — expression scalar comments

**Package:** `expression`. **Verdict:** generalize.

| File                                 | Action                                                                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expression/src/scalar-builder.ts`   | The header describes the builder and the `ln` / `log` lowering. It does not say another project lowers an `ExprNode` onto it.                                  |
| `expression/src/index.ts`            | The barrel comment says scalar trees, no formula string.                                                                                                       |
| `expression/src/scalar-structure.ts` | Weights default to 1. The total is rounded with `Math.round`. `scalarComplexity`'s number-node field is "weight of one number node". No external project name. |
| `docs/api/expression.md`             | The `scalarCanonical` row says "canonical form and stable dedup key". That row sits above the generated-index marker.                                          |
| `docs/Architecture/OVERVIEW.md`      | The scalar-structure bullet describes flattening and the rewrite rules. Drop the "PySR-style" adjective.                                                       |

Do not edit `expression/src/scalar-enumerate.ts`.

Regenerate the dependency graph so the `scalar-structure.ts` description matches the new header. Run the scalar-structure tests and the node tests that import the builder.

```bash
bunx vitest run expression/tests/scalar-structure.test.ts
repo-tools check . --docs=docs/Architecture
```

### PR 3 — functions comments, hand docs, pending changesets

**Package:** `functions`. **Verdict:** generalize. **Changesets:** rename nothing; rewrite the summary sentence. Same bumps.

| File                                                                                                                                  | Action                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions/src/index.ts`                                                                                                              | Barrel comment: scalar trees. `ln` lowers to natural `log`, `log` to `log10`. A formula string is rejected.                                                                                                                                             |
| `functions/src/pareto-front.ts`                                                                                                       | Header and TSDoc state the score and selection rules from [What the code already is](#what-the-code-already-is). Delete the link to `pysr/sr.py` and the commit pin.                                                                                    |
| `functions/src/scalar-mutate.ts`                                                                                                      | "Default mutation weights" and the negation-probability comment. No roadmap section number.                                                                                                                                                             |
| `functions/src/scalar-search.ts`                                                                                                      | The generator's options (`seeds`, `fractionReplaced`, `initialTemperature` 3.17, adaptive-parsimony scaling 1040, migrant cap, frequency window) are documented as this function's defaults.                                                            |
| `functions/src/scalar-compile.ts`                                                                                                     | The constants comment says fitted constants are still `symbol` nodes, passed through to each `evaluate`.                                                                                                                                                |
| `functions/src/numeric-equivalence.ts`                                                                                                | Header: sampling comparison; agreement is evidence, not proof. Do not rename `upToConstant`.                                                                                                                                                            |
| `functions/src/front-export.ts`                                                                                                       | Header: LaTeX tabular and JSON for a scored front.                                                                                                                                                                                                      |
| `functions/README.md`                                                                                                                 | The five bullets that name the external project describe the same exports without that name.                                                                                                                                                            |
| `functions/tests/pareto-front.test.ts`                                                                                                | Header: scores were computed from the formula in the module comment and checked with `Object.is`.                                                                                                                                                       |
| `functions/tests/scalar-dimension.test.ts`                                                                                            | The two titles become the concrete system: `M * c`, `M` in kilograms, target `m s^-2 kg`, solved `c` is `m s^-2`; `dimensionlessOnly` makes that system inconsistent.                                                                                   |
| `docs/api/functions.md`                                                                                                               | Section "Scalar evaluation & Pareto selection", above the generated index. "PySR-oriented helpers", "PySR log-loss scores", and "Row plus PySR score" become MathTS descriptions. Leave the `upToConstant?` row; that cell is the false-positive class. |
| `docs/reference/functions.md`                                                                                                         | The `scoreFront` description above the generated index. Then `bun run docs:functions` so `docs/reference/functions.html` matches.                                                                                                                       |
| `docs/Architecture/DATAFLOW.md`                                                                                                       | Section title "1b. ScalarNode compile and Pareto selection". Drop the parenthetical.                                                                                                                                                                    |
| `.changeset/pareto-front-m4.md`, `scalar-mutate-m12.md`, `scalar-search-m13.md`, `fit-scalar-parameters-m7.md`, `front-export-m15.md` | One summary sentence each, same behavior, no external name. Frontmatter unchanged.                                                                                                                                                                      |

`s2r-regression-roots-functions.md` names a test file that PR 4 renames. Leave it for PR 4.

Regenerate the dependency graph from the new headers (`front-export.ts`, `numeric-equivalence.ts`, `pareto-front.ts`, `scalar-mutate.ts`, `scalar-search.ts`).

```bash
bunx vitest run \
  functions/tests/pareto-front.test.ts \
  functions/tests/scalar-dimension.test.ts \
  functions/tests/numeric-equivalence.test.ts \
  functions/tests/scalar-compile.test.ts \
  functions/tests/scalar-search.test.ts \
  functions/tests/scalar-mutate.test.ts \
  functions/tests/front-export.test.ts
bun run docs:functions:check
repo-tools check . --docs=docs/Architecture
```

If a listed test path does not exist under that exact name, run the file that already covers that module. Do not add a test to satisfy the path.

### PR 4 — review tests, node extension, autodiff comments

**Verdict:** generalize. The tests pin real defects and a real extension point. The stories around them go.

| File                                                                                                                                                      | Action                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions/tests/upt-review-2026-10-15.test.ts`                                                                                                           | Rename to `functions/tests/numeric-tail-review-2026-10-15.test.ts`. Header states the bugs (`gammaincp` far tail, `findRoot` `NaN` endpoint, `quad` `atol`) without a review attribution.                                                               |
| `functions/tests/upt-review-2-2026-10-15.test.ts`                                                                                                         | Rename to `functions/tests/symbolic-equal-tail-review-2026-10-15.test.ts`. Header states `symbolicEqual`, the Student-t tail, `ols` equilibration, and `Fraction.fromNumber`.                                                                           |
| `functions/tests/linear-regression-stderr.test.ts`, `solveodesystem-fixed-step-count.test.ts`, `gauss-legendre4.test.ts`, `propagate-uncertainty.test.ts` | Keep the numeric claim. Delete the sentence that names the other project. Gauss–Legendre stays cited as Hairer/Lubich/Wanner and Sanz-Serna. The uncertainty example stays `x*y` at `(2, 3)` with those sigmas.                                         |
| `expression/tests/node-extension.test.ts`                                                                                                                 | The test still subclasses `createNode` and checks `isNode`, `forEach`, `map`, `traverse`, `clone`, `toJSON`, `_toString`. The stand-in class is a generic child-plus-tag node, not a bridge-equation type. The header describes that, and nothing else. |
| `autograd/tests/ad-wasm-interop.test.ts`                                                                                                                  | Describe title: AD over a forward op that did not run on the tape. Drop the proposal section number.                                                                                                                                                    |
| `autograd/src/forward-grad.ts`                                                                                                                            | Delete the sentence about metric call-sites. Keep the statement that a function of `add` / `sub` / `mul` / `scale` stays on the traced path. Match the old line count.                                                                                  |
| `.changeset/s2r-regression-roots-functions.md`                                                                                                            | The summary names the new test filename. No other edit.                                                                                                                                                                                                 |

`docs:deps` updates the file census for the two renames.

```bash
bunx vitest run \
  functions/tests/numeric-tail-review-2026-10-15.test.ts \
  functions/tests/symbolic-equal-tail-review-2026-10-15.test.ts \
  functions/tests/linear-regression-stderr.test.ts \
  functions/tests/solveodesystem-fixed-step-count.test.ts \
  functions/tests/gauss-legendre4.test.ts \
  functions/tests/propagate-uncertainty.test.ts \
  expression/tests/node-extension.test.ts \
  autograd/tests/ad-wasm-interop.test.ts
repo-tools check . --docs=docs/Architecture
```

### PR 5 — release-gate prose

**Verdict:** generalize the gate, drop the roadmap as its reason. **No workflow behavior change.** `RELEASES_ENABLED` stays the only switch. The version-PR step still runs. Tagging, GitHub Releases, and publish stay off while the variable is unset.

| File                                                             | Action                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`                      | Replace "until the PySR roadmap is done" with: leave the version PR unmerged; do not set `RELEASES_ENABLED` as part of this work; do not tag or publish by hand. Keep the rest of the release paragraph (secret name `NPM`, `NODE_AUTH_TOKEN`, no provenance). |
| `MEMORY.md`                                                      | Same sentence in "Release discipline". The "Where to look" bullet points at `expression/src/scalar-structure.ts`, `functions/src/scalar-compile.ts`, and `functions/src/pareto-front.ts`. It does not point at a roadmap file.                                 |
| `.github/workflows/release.yml`, `.github/workflows/publish.yml` | The header comments say the same thing. Do not change job logic, `if:` conditions, or secrets.                                                                                                                                                                 |
| `CHANGELOG.md` line 97                                           | Under `[Unreleased]`. "three earlier merges left the counts of six documents stale". Do not touch lines 4194 and 4208.                                                                                                                                         |

This PR does not add `docs/reference/scalar-search.md`. That file arrives in PR 6. Pointing MEMORY at source files keeps PR 5 from depending on it.

No vitest. `repo-tools check` is unchanged because these files are not in the architecture verification set. Run it if a hook touched `docs/Architecture`.

### PR 6 — MathTS reference, then delete the named docs

**Verdict:** drop the six documents. Generalize the three facts that are still true of MathTS.

Write `docs/reference/scalar-search.md` first, with none of the forbidden tokens. It contains:

- The export table from [What the code already is](#what-the-code-already-is).
- The score, the selection rule, and the mutation-weight pointer, as specified there.
- Three non-goals: `Tensor` is unit-free and has no dimensional analysis; a `consistent` numerical comparison is not a proof; MathTS does not embed another language runtime to search.
- One paragraph on node extension: `createNode({ mathWithTransform })` returns a class meant to be subclassed; `expression/tests/node-extension.test.ts` is the pin. No consumer name.
- One paragraph on autodiff: `Tape.record` stores input ids, an output size, and a backward closure. The forward op can be JS, a worker, or a WASM kernel. The tape does not read that choice. `autograd/tests/ad-wasm-interop.test.ts` is the pin. `TapedTensor` already includes `matmul` (batched, rank at least 2) along with the elementwise ops. The integration note's caveat that `matmul` is missing is stale; do not copy it.

Then delete:

- `docs/roadmap/PYSR_INFORMED_ROADMAP.md` (145 matches)
- `docs/plans/PYSR_M1_PLAN.md`
- `docs/plans/PYSR_M3_PLAN.md`
- `docs/plans/PYSR_M4_PLAN.md`
- `docs/plans/PYSR_PHASES_3_5_PLAN.md`
- `docs/integration/upt.md` (29 matches)

Retarget every remaining link to those paths. The sentence that remains does not use a forbidden token and does not claim the deleted file still exists.

| File                                                                    | Action                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                                             | Remove the integration-notes row.                                                                                                                                                                                                                                                                                                                   |
| `docs/README.md`                                                        | Remove the integration row and the five roadmap/plan rows. Add one row for `docs/reference/scalar-search.md`.                                                                                                                                                                                                                                       |
| `ROADMAP.md`                                                            | Delete the icebox bullet. The work is shipped; an icebox entry is the wrong list. Do not add a new roadmap.                                                                                                                                                                                                                                         |
| `docs/plans/COMPLETION_PLAN.md`                                         | This plan's unit work and its review sign-off are already on `main`. Replace source-of-truth links with "scalar-search reference and the unit table". Leave the historical sentence that names a line in a deleted plan only if it can be rewritten without the token; otherwise delete that sentence. Do not open a new implementation PR from it. |
| `docs/plans/CORE_SPRINT_PLAN.md`                                        | The sprint is done. "Returns to" and the status-paragraph instruction no longer name a roadmap. Do not edit milestone checkboxes that are not in this file.                                                                                                                                                                                         |
| `docs/plans/CLONES_PHASE_6_PLAN.md`, `docs/roadmap/CLONES_REMAINING.md` | The clone procedure is the text already in those files plus `CLONES_REFACTOR_PLAN.md`. Delete the pointer at the removed roadmap, including the note about a duplicated section inside it.                                                                                                                                                          |
| `docs/audit/2026-10-22-codebase-audit.md`                               | Keep the findings (five Mulberry32 copies, the reuse map, the open decisions that were later implemented). Section 7's title and the sentences that name the external projects become "scalar-search milestones M1, M3, M4, as of this audit". Do not restatus the audit; it is a 2026-10-22 snapshot.                                              |
| `docs/api/expression.md`                                                | Add the node-extension paragraph if PR 2 did not already leave the table accurate. One section, no token.                                                                                                                                                                                                                                           |
| `docs/Architecture/DATAFLOW.md`                                         | One sentence under section 1b: the tape does not inspect the forward implementation. Only if PR 3's heading edit has landed; otherwise include the heading edit here.                                                                                                                                                                               |

`bun run docs:roadmap-check` after the `ROADMAP.md` edit. `repo-tools check` after any edit under `docs/Architecture`. No vitest unless a code fence in the new reference is wrong; the reference has no executable fence that imports a deleted module.

### PR 7 — workbook branding and planning misfits

**Verdict:** drop the framework name. Generalize the workbook format. Flag the geometry sketches as misfits and do not build them.

| File                                                           | Action                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/Architecture/Workbook/schwarzschild-geodesics.mtsw`      | Title and tags describe Schwarzschild geodesics. Remove the framework name and the `UPTF` tag. Keep the cells.                                                                                                                                                                    |
| `docs/Architecture/Workbook/schwarzschild_example.mtsw`        | Institution and tags drop the framework name.                                                                                                                                                                                                                                     |
| `docs/Architecture/Workbook/MATHTS_WORKBOOK_SPECIFICATION.md`  | The format sentence names theoretical physics research and tensor mathematics. It does not name a framework.                                                                                                                                                                      |
| `docs/Architecture/Workbook/MATHTS_WORKBENCH_SPECIFICATION.md` | The tags on the sample metadata drop `UPTF`. Do not edit `interruptExecution`, `interruptCell`, or `interruptAll`.                                                                                                                                                                |
| `docs/Architecture/Workbook/MATHTS_ENHANCEMENT_ROADMAP.md`     | Tensor work that matches the shipped `tensor` package stays described as MathTS. Rows whose priority was the framework (differential geometry, curvature, "UPTF critical", the closing sentence about powering that framework) are marked out of scope. Do not add those modules. |
| `docs/Planning/MATHTS_PRIORITY_IMPLEMENTATION_GUIDE.md`        | "Phase 2: UPTF Core" is retitled and closed: `MetricTensor`, Christoffel, and curvature sketches are not a MathTS API and are not scheduled. The expression-tree phase is untouched.                                                                                              |

`docs/Planning/MATHTS_PRIORITY_IMPLEMENTATION_GUIDE_PART2.md` has no forbidden token. Leave the file. Do not implement it.

`repo-tools check` after the workbook architecture docs change. If a verification count moves because a heading changed, set the cell to the printed number. No vitest; these `.mtsw` files are samples in the architecture tree, not the workbook test suite. If `workbook/tests` loads either sample, run that file.

### PR 8 — out-of-scope restatements

**Verdict:** generalize the non-goal. Do not add the physics features.

| File                                  | Action                                                                                                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/roadmap/ITENSOR_PARITY.md`      | MPS/MPO, DMRG/TEBD/TDVP, fermionic anticommutation, and quantum-number block-sparse storage stay out of `mathts-tensor`. Say that. Delete the downstream-project name (five matches).                                                 |
| `docs/roadmap/FUNCTION_GAPS_AUDIT.md` | The same non-goals, plus the "interface declarations consumed downstream" sentence, which becomes "public type exports used outside this repository".                                                                                 |
| `docs/roadmap/FUNCTION_GAPS.md`       | The landed AD and decomposition work is described as MathTS work. "Direct unblock for UPT Proposal 8" becomes "closes reductions and elementwise AD for a loss". "not blockers for UPT" becomes "not blockers for the landed slices". |
| `TODO.md`                             | The out-of-scope sentence near the ITensor proposal (MPS/MPO and quantum-number storage) matches PR 8's wording in `ITENSOR_PARITY.md`. The other `TODO.md` hits of the naive regex are `corrupt` and stay.                           |

`bun run docs:roadmap-check`. No vitest.

### PR 9 — delete this plan

**Verdict:** drop. After PRs 1–8, the acceptance search matches this file and the seven historical release-note lines, and nothing else.

Delete `docs/plans/UPT_BLEND_REFACTOR_PLAN.md`. It is not linked from `docs/README.md` (this PR did not add a row). If a later edit added a row, delete the row in this same commit.

Then run the acceptance search. The only hits are the seven lines in [Historical release notes](#historical-release-notes), under those version headings. `git ls-files | rg -i 'upt|pysr|universal-physics'` is empty.

```bash
repo-tools check . --docs=docs/Architecture
bun run docs:roadmap-check
```

## File inventory

Every file the acceptance search hits on `8b0192cb`, with its match count. "Both" means the naive regex also hits a false-positive class in the same file; only the real tokens are in scope.

| File                                                           | Matches | Verdict                                              | PR                                     |
| -------------------------------------------------------------- | ------: | ---------------------------------------------------- | -------------------------------------- |
| `docs/roadmap/PYSR_INFORMED_ROADMAP.md`                        |     145 | drop                                                 | 6                                      |
| `docs/integration/upt.md`                                      |      29 | drop, after the three facts move                     | 6                                      |
| `core/tests/types/unit-upt-symbols.test.ts`                    |      25 | rename; both (`upTo` is not in this count)           | 1                                      |
| `docs/plans/COMPLETION_PLAN.md`                                |      23 | rename the pointers; the unit work is done           | 6                                      |
| `docs/plans/PYSR_PHASES_3_5_PLAN.md`                           |      16 | drop                                                 | 6                                      |
| `docs/plans/PYSR_M4_PLAN.md`                                   |      14 | drop                                                 | 6                                      |
| `functions/src/scalar-search.ts`                               |      10 | generalize                                           | 3                                      |
| `functions/src/pareto-front.ts`                                |       9 | generalize                                           | 3                                      |
| `docs/plans/CORE_SPRINT_PLAN.md`                               |       8 | rename the pointers                                  | 6                                      |
| `docs/audit/2026-10-22-codebase-audit.md`                      |       8 | generalize the findings, rename the section          | 6                                      |
| `docs/Architecture/Workbook/MATHTS_ENHANCEMENT_ROADMAP.md`     |       8 | drop the framework priority; misfit for geometry     | 7                                      |
| `expression/tests/node-extension.test.ts`                      |       7 | generalize                                           | 4                                      |
| `docs/README.md`                                               |       6 | drop the rows, add the scalar-search row             | 6                                      |
| `ROADMAP.md`                                                   |       5 | drop the icebox bullet                               | 6                                      |
| `functions/README.md`                                          |       5 | generalize                                           | 3                                      |
| `docs/roadmap/ITENSOR_PARITY.md`                               |       5 | generalize the non-goal; misfit                      | 8                                      |
| `docs/plans/PYSR_M1_PLAN.md`                                   |       5 | drop                                                 | 6                                      |
| `docs/Architecture/dependency-graph.yaml`                      |       5 | regenerate, do not hand-edit                         | 3                                      |
| `docs/Architecture/DEPENDENCY_GRAPH.md`                        |       5 | regenerate, do not hand-edit                         | 3                                      |
| `docs/Architecture/dependency-graph.json`                      |       5 | regenerate, do not hand-edit                         | 3                                      |
| `functions/src/scalar-mutate.ts`                               |       4 | generalize                                           | 3                                      |
| `expression/src/scalar-structure.ts`                           |       4 | generalize                                           | 2                                      |
| `docs/roadmap/FUNCTION_GAPS.md`                                |       4 | generalize                                           | 8                                      |
| `docs/Architecture/FILE_INVENTORY.md`                          |       4 | regenerate on test renames                           | 1, 4                                   |
| `docs/Architecture/file-inventory.json`                        |       4 | regenerate on test renames                           | 1, 4                                   |
| `docs/roadmap/FUNCTION_GAPS_AUDIT.md`                          |       3 | generalize the non-goal; misfit                      | 8                                      |
| `docs/plans/CLONES_PHASE_6_PLAN.md`                            |       3 | rename the pointer                                   | 6                                      |
| `docs/Architecture/Workbook/schwarzschild-geodesics.mtsw`      |       3 | rename titles and tags                               | 7                                      |
| `docs/api/functions.md`                                        |       3 | generalize the hand section; both for `upToConstant` | 3                                      |
| `core/tests/types/unit-upt-delegation.test.ts`                 |       3 | rename                                               | 1                                      |
| `CHANGELOG.md`                                                 |       3 | rewrite the Unreleased bullet; leave 4194 and 4208   | 5, and never for the two release lines |
| `autograd/tests/ad-wasm-interop.test.ts`                       |       3 | generalize                                           | 4                                      |
| `MEMORY.md`                                                    |       2 | generalize the gate                                  | 5                                      |
| `functions/tests/scalar-dimension.test.ts`                     |       2 | generalize titles                                    | 3                                      |
| `functions/CHANGELOG.md`                                       |       2 | leave; historical                                    | —                                      |
| `docs/roadmap/CLONES_REMAINING.md`                             |       2 | rename the pointer                                   | 6                                      |
| `docs/plans/PYSR_M3_PLAN.md`                                   |       2 | drop                                                 | 6                                      |
| `docs/Architecture/Workbook/schwarzschild_example.mtsw`        |       2 | rename tags                                          | 7                                      |
| `core/CHANGELOG.md`                                            |       2 | leave; historical                                    | —                                      |
| `AGENTS.md`                                                    |       2 | generalize the gate                                  | 5                                      |
| `units/CHANGELOG.md`                                           |       1 | leave; historical                                    | —                                      |
| `TODO.md`                                                      |       1 | generalize; both for `corrupt`                       | 8                                      |
| `README.md`                                                    |       1 | drop the row                                         | 6                                      |
| `.github/workflows/release.yml`                                |       1 | generalize the comment                               | 5                                      |
| `.github/workflows/publish.yml`                                |       1 | generalize the comment                               | 5                                      |
| `functions/tests/upt-review-2-2026-10-15.test.ts`              |       1 | rename                                               | 4                                      |
| `functions/tests/upt-review-2026-10-15.test.ts`                |       1 | rename                                               | 4                                      |
| `functions/tests/solveodesystem-fixed-step-count.test.ts`      |       1 | generalize the header                                | 4                                      |
| `functions/tests/propagate-uncertainty.test.ts`                |       1 | generalize the header                                | 4                                      |
| `functions/tests/pareto-front.test.ts`                         |       1 | generalize the header                                | 3                                      |
| `functions/tests/linear-regression-stderr.test.ts`             |       1 | generalize the header                                | 4                                      |
| `functions/tests/gauss-legendre4.test.ts`                      |       1 | generalize the header                                | 4                                      |
| `functions/src/scalar-compile.ts`                              |       1 | generalize                                           | 3                                      |
| `functions/src/numeric-equivalence.ts`                         |       1 | generalize; both for `upToConstant`                  | 3                                      |
| `functions/src/index.ts`                                       |       1 | generalize                                           | 3                                      |
| `functions/src/front-export.ts`                                |       1 | generalize                                           | 3                                      |
| `expression/src/scalar-builder.ts`                             |       1 | generalize                                           | 2                                      |
| `expression/src/index.ts`                                      |       1 | generalize                                           | 2                                      |
| `docs/reference/functions.md`                                  |       1 | generalize, then regenerate the html                 | 3                                      |
| `docs/reference/functions.html`                                |       1 | regenerate from the markdown                         | 3                                      |
| `docs/Planning/MATHTS_PRIORITY_IMPLEMENTATION_GUIDE.md`        |       1 | misfit; close the phase                              | 7                                      |
| `docs/Architecture/Workbook/MATHTS_WORKBOOK_SPECIFICATION.md`  |       1 | generalize the format sentence                       | 7                                      |
| `docs/Architecture/Workbook/MATHTS_WORKBENCH_SPECIFICATION.md` |       1 | drop the tag; both for `interrupt*`                  | 7                                      |
| `docs/Architecture/OVERVIEW.md`                                |       1 | generalize                                           | 2                                      |
| `docs/Architecture/DATAFLOW.md`                                |       1 | generalize                                           | 3                                      |
| `docs/api/expression.md`                                       |       1 | generalize                                           | 2                                      |
| `core/tests/types/si-dimension-vector.test.ts`                 |       1 | generalize                                           | 1                                      |
| `core/tests/fixtures/upt-units-symbols.json`                   |       1 | rename; drop the `source` string                     | 1                                      |
| `core/src/types/unit/Unit.ts`                                  |       1 | generalize                                           | 1                                      |
| `core/src/types/unit/unit-table.ts`                            |       1 | generalize; both for `upToYotta`                     | 1                                      |
| `core/src/types/si-dimension-vector.ts`                        |       1 | generalize                                           | 1                                      |
| `CONTRIBUTING.md`                                              |       1 | generalize the gate                                  | 5                                      |
| `CLAUDE.md`                                                    |       1 | generalize the gate                                  | 5                                      |
| `.changeset/upt-residual-unit-spellings.md`                    |       1 | rename                                               | 1                                      |
| `.changeset/scalar-search-m13.md`                              |       1 | rename the summary                                   | 3                                      |
| `.changeset/scalar-mutate-m12.md`                              |       1 | rename the summary                                   | 3                                      |
| `.changeset/s2r-regression-roots-functions.md`                 |       1 | rename the test path in the summary                  | 4                                      |
| `.changeset/pareto-front-m4.md`                                |       1 | rename the summary                                   | 3                                      |
| `.changeset/front-export-m15.md`                               |       1 | rename the summary                                   | 3                                      |
| `.changeset/fit-scalar-parameters-m7.md`                       |       1 | rename the summary                                   | 3                                      |
| `autograd/src/forward-grad.ts`                                 |       1 | generalize; both for `corrupt` on another line       | 4                                      |

81 files. Counts are `rg -c` matches, so one line with two tokens counts twice (`AGENTS.md` is the roadmap name and the filename on the next line).

## End state

After PR 9:

- The acceptance search prints only the seven historical release-note lines.
- `git ls-files` has no `upt`, `pysr`, or `universal-physics` in a path.
- `upToConstant`, `physicsScope`, the scalar exports, the supplementary units, and `searchScalars` still exist and still pass their tests.
- `repo-tools check . --docs=docs/Architecture` exits 0 at pin 2.2.4.
- `bun run docs:roadmap-check` and `bun run docs:functions:check` exit 0.
- No package version changed. No tag. No publish. `RELEASES_ENABLED` is untouched.
