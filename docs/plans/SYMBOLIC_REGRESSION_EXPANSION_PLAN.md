# Plan: Symbolic regression expansion

**Status:** SR-1 through SR-7 implemented. Remaining PRs are planning only. This file is the contract for the implementation PRs below.
**Tree reviewed:** `5db1f780` (`main`, `chore: release packages` #581). Re-read a cited file if `main` has moved. Paths were checked on that commit; line numbers were not used, because they move.
**Source of truth for the shipped surface:** [`docs/reference/scalar-search.md`](../reference/scalar-search.md). This plan does not rewrite that page's defaults, scores, or non-goals. SR-17 adds a walkthrough beside them.
**Goal:** a stronger scalar symbolic-regression engine, landed as small PRs. Every PR merges to `main` on its own. The recommended order is the list below. A later PR does not import a symbol that only an earlier PR adds. New behavior is opt-in. With the new options omitted, the recorded seed-7 front stays byte-identical.

## What this engine is

MathTS symbolic regression is the scalar-search toolkit. There is no separate search package. `expression/src/scalar-enumerate.ts` records that decision: the home of enumeration is `expression`, and the evolutionary driver is `searchScalars` in `functions`. A formula string is rejected. Callers build a `ScalarNode` with `createScalarBuilder` (`number`, `symbol`, `op`, `call`). `ln` lowers to natural `log`; `log` lowers to `log10`.

`searchScalars` is an async generator. It yields a `SearchProgress` after the initial population and after every generation, and it returns a `ScalarSearchResult`. The code comment on the function calls this symbolic regression over scalar expression trees.

## Audit: what exists

### Code

| Area                    | Home                                                               | What it does today                                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builder                 | `expression/src/scalar-builder.ts`                                 | `ScalarNode`: `number`, `symbol`, binary `+ - * / ^`, unary `exp`, `log` (natural), `log2`, `log10`, `sin`, `cos`, `tan`, `sinh`, `cosh`, `tanh`, `abs`.                                                                                                                               |
| Structure               | `expression/src/scalar-structure.ts`                               | Size, depth, weighted `scalarComplexity` (default weight 1, so complexity equals size), symbols, canonical form, `scalarCanonicalKey`, `scalarEquals`.                                                                                                                                 |
| Grammar and enumeration | `expression/src/scalar-enumerate.ts`                               | `ScalarGrammar`: variables, parameters, literals, binary, unary, `maxSize`, `maxDepth`, `argumentLimits`, `nesting`, `admit`, `admitMonotone`. `enumerateScalars` yields distinct trees in non-decreasing size. `scalarGrammarAccepts` checks structure and does **not** call `admit`. |
| Evaluation              | `functions/src/scalar-eval.ts`, `functions/src/scalar-compile.ts`  | `evaluateScalar` and `compileScalar` / `compileScalarGradient`. A non-finite operator or call result is an invalid row on the batch path.                                                                                                                                              |
| Fitting                 | `functions/src/fit-scalar.ts`                                      | `fitScalarParameters`: losses `l2`, `l1`, `huber`, or a function; weights; bounds; `lm`, `bfgs`, `nelder-mead`; restarts. Invalid rows inside the fitter pay `1e8`.                                                                                                                    |
| Mutation                | `functions/src/scalar-mutate.ts`                                   | Eleven weighted operators plus `crossoverSubtrees`. Weights are the table in the reference. Optimize and backsolve are omitted.                                                                                                                                                        |
| Search                  | `functions/src/scalar-search.ts`                                   | Tournament selection, elitist truncation, hall of fame, optional islands, annealing, adaptive parsimony, migration.                                                                                                                                                                    |
| Front                   | `functions/src/pareto-front.ts`, `functions/src/front-export.ts`   | `paretoFront`, `scoreFront`, `selectFrontModel`, LaTeX and JSON export.                                                                                                                                                                                                                |
| Comparison              | `functions/src/numeric-equivalence.ts`                             | Sampled numerical agreement. A `consistent` verdict is evidence, not proof.                                                                                                                                                                                                            |
| Dimension               | `functions/src/scalar-dimension.ts`, `core` `SiDimensionVector`    | `inferScalarDimension`, `solveParameterDimensions`. Seven `Fraction` exponents, BIPM order `[L, M, T, I, Θ, N, J]`.                                                                                                                                                                    |
| Units                   | `core` `Unit`, `toSiDimensionVector`                               | The unit table converts a unit to an SI vector. The search never calls it.                                                                                                                                                                                                             |
| Parallel scoring        | `functions/src/scalar-batch-parallel.ts`, `scalar-batch.worker.ts` | Opt-in worker scoring once `observed` has at least 100 rows.                                                                                                                                                                                                                           |

### What `searchScalars` does

One or more islands evolve by tournament selection and `weightedMutation`. The initial population is the seeds the grammar accepts, then the smallest trees from `enumerateScalars`, dealt round-robin across islands. Each generation breeds `populationSize` offspring per island, scores them, and keeps the best `populationSize` distinct trees of parents and offspring. Distinct means `scalarCanonicalKey`. After each generation except the last, islands exchange migrants. A hall of fame keeps the best finite loss at each stored complexity. The reported front is `scoreFront(paretoFront(...))` on the log scale.

Pinned defaults, from `functions/src/scalar-search.ts` and the reference:

| Knob                          | Default                                                                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `populationSize`              | 27                                                                                                                                                                                 |
| `tournamentSize`              | 15                                                                                                                                                                                 |
| `tournamentP`                 | 0.982                                                                                                                                                                              |
| `optimizeProbability`         | 0.14                                                                                                                                                                               |
| `perturbationFactor`          | 0.25                                                                                                                                                                               |
| `fractionReplaced`            | 0.00036                                                                                                                                                                            |
| Annealing                     | On only when `populations > 1`. Start 3.17, multiply by 0.995 each generation. A single population stays at temperature 1.                                                         |
| Adaptive parsimony            | On only when `populations > 1`. Scaling 1040. Frequency window 100000.                                                                                                             |
| Migrant pool                  | Best 12 trees of the donor.                                                                                                                                                        |
| Mutation attempts             | 10, then the offspring is a copy of the parent.                                                                                                                                    |
| Parameter start               | A vector of ones.                                                                                                                                                                  |
| Refit, when the coin says yes | `fitScalarParameters` with `restarts: 2`, `maxIterations: 8`, the inherited vector as `initial`, and the fitter's default `l2` loss. No bounds, no weights, no algorithm override. |
| Ranking loss                  | Sum of squared errors via `pairwiseSum`. Any invalid row, or a non-finite sum, is `+Infinity`. An infinite loss never enters the hall.                                             |
| Stop                          | `maxEvaluations`, or `maxCandidates` when that cap is the smaller one.                                                                                                             |
| Model selection               | Only when `modelSelection` is set. `selectFrontModel` is called with no factor, so `best` uses 1.5.                                                                                |
| Parallel                      | Omitted: the caller thread. Set: workers at 100 rows or more. Refits and every random draw stay on the caller.                                                                     |

`populations: 1` draws from `rng.fork('population')`. Several islands draw from `rng.fork('island:' + index)` plus a `migration` fork. `options.rng` itself is not advanced. The same seed, problem, and options produce the same front, event by event, including a parallel run against a serial run.

The recorded contract is `PINNED_ROWS` in `functions/tests/scalar-search.test.ts`: seed 7, population 8, tournament 4, 120 evaluations, on `x^2 + x`. Three rows, losses compared with `Object.is`. `populations: 1` must reproduce that front whatever migration is asked for. A second planted law, `x^4 + x^2`, is not in the initial population. The test records that seed 7 finds a loss below `1e-10` at evaluation 162, and it asserts that the find is after evaluation 27 and by evaluation 2000.

### Tests already on `main`

| File                                                                                               | What it locks                                                                                                              |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `functions/tests/scalar-search.test.ts`                                                            | Planted laws, the seed-7 front, budgets, islands, migration, annealing, adaptive parsimony, invalid rows, argument checks. |
| `functions/tests/scalar-search-parallel.test.ts`                                                   | Parallel versus serial with a fake pool, including fitting and islands. `Object.is` on losses and fitted parameters.       |
| `tests/integration/scalar-search-parallel.test.ts`                                                 | The built worker script and a real pool, serial front, timeout, pool shutdown.                                             |
| `functions/tests/scalar-mutate.test.ts`                                                            | Every operator, weights, draw order, grammar rejection, call nodes, crossover.                                             |
| `expression/tests/scalar-enumerate.test.ts`                                                        | Order, depth, argument limits, nesting, `admit`, stop reasons.                                                             |
| `expression/tests/scalar-structure.test.ts`, `scalar-builder.test.ts`                              | Canonical form and the builder.                                                                                            |
| `functions/tests/scalar-eval.test.ts`, `scalar-compile.test.ts`, `scalar-compile-gradient.test.ts` | Evaluation and the analytic parameter gradient.                                                                            |
| `functions/tests/fit-scalar-parameters.test.ts` plus the robust-loss pins                          | The fitter, including `l1` and `huber`.                                                                                    |
| `functions/tests/pareto-front.test.ts`, `front-export.test.ts`                                     | Hall, scores, selection, LaTeX, JSON.                                                                                      |
| `functions/tests/scalar-dimension.test.ts`                                                         | Inference and parameter solving.                                                                                           |
| `functions/tests/numeric-equivalence.test.ts`, `scalar-node-bridge.test.ts`                        | Sampling comparison and the expression-node bridge.                                                                        |
| `functions/tests/scalar-batch-parallel.test.ts`                                                    | The batch worker path.                                                                                                     |
| `tests/integration/scalar-canonical-parity.test.ts`                                                | Canonical keys agree across packages.                                                                                      |

### Docs and examples

- [`docs/reference/scalar-search.md`](../reference/scalar-search.md) is the contract: exports, scores, mutation weights, bridge rules, non-goals.
- `functions/README.md` documents the driver in one paragraph. Its code sample never calls `searchScalars`.
- `expression/README.md` documents `enumerateScalars`.
- Generated indexes list the exports in `docs/reference/functions.md` and `docs/api/functions.md`.
- `examples/` has arithmetic, matrix, workbook, and parallel scripts. It has no scalar-search script.
- The workbook evaluates MathTS expressions. It does not call this TypeScript driver. A `.mtsw` cell is the wrong place for the example.

### Benchmarks

`tools/benchmark/wasm/scalar.bench.ts`, recorded in `docs/BENCHMARK_RESULTS.md` under "`evaluateScalar` vs `compileScalar` (M3 batch evaluator) — 2026-10-25". Command: `node tools/benchmark/wasm/run-node.mjs scalar`. Node v22.23.4 only, two runs. `compileScalar` beat per-row `evaluateScalar` at every measured size. The 100-row worker floor cites that caller-thread comparison. The section says the table did not time a worker round trip, and `scalar-batch-parallel.ts` repeats that nothing there claims a speed-up.

No benchmark times `searchScalars`, mutation, fitting inside the search, or the worker path. No Bun number exists for this engine.

### Gaps this plan closes

These are facts about `5db1f780`, in the order of the PRs.

1. **`admit` does not bind the search.** Closed by SR-1: `initialTrees` and the offspring loop call `scalarGrammarAccepts` and then `grammar.admit` when it is set. `enumerateScalars` already applied `admit`. `scalarGrammarAccepts` still does not call it.
2. **Crossover is not in the loop.** Closed by SR-2: `crossoverProbability` defaults to 0 (no coin). Above 0 the offspring loop may call `crossoverSubtrees` with a second tournament parent.
3. **The ranker and the fitter do not share a loss.** The hall ranks by sum of squares. The fitter can do `l1`, `huber`, weights, and bounds, but the search never passes them. A tree that is invalid on one row is `Infinity` in the hall even when the fitter would have penalized that row and kept going.
4. **The refit budget is a private constant.** `restarts: 2` and `maxIterations: 8` are not options. The start vector is ones. There is no bounds argument.
5. **Complexity weights exist and the search ignores them.** `scalarComplexity(node, weights)` is real. The hall calls `scalarComplexity(node)`. An expensive `sin` costs the same as `+`.
6. **Simplification is almost absent from the search.** `simplifyConstants` is a mutation of weight `0.00209` and only folds numeric subtrees. `simplifyScalar` is the expression simplifier and is not on the search path. Canonical keys already treat `a*a` and `a^2` as the same tree, but the hall keys by the stored tree's complexity, so two stored shapes of one canonical tree can occupy two front rows when their sizes differ.
7. **Dimension and units are a side API.** `inferScalarDimension` and `solveParameterDimensions` are tested and unused by the search. A numeric fit can crown `sin` of a length. `toSiDimensionVector` can read a unit, and the search has no option that takes one.
8. **The unary set is closed.** `sqrt` and `atan` already have primal and derivative rules on `DUAL_UNARY_RULES` in `core/src/types/dual-rules.ts`. They are not `LoweredScalarFn` values, so a grammar cannot name them. `scalar-dimension.ts` treats `abs` as dimension-preserving and every other call as a dimensionless transcendental. A square root of a length has to be written as `^` with exponent `1/2`, and only when that literal is in the grammar.
9. **There is no search benchmark on Node or Bun.** The worker threshold is not a measured worker break-even.
10. **Every tree is compiled again on every score.** `scoreOnProblem` calls `compileScalar` for each tree. A generation of copies recompiles the same structure.
11. **Islands run one after another.** The generation loop `await`s each island before the next. Each island owns its random stream, so the work can overlap, but the hall and the frequency window must still be updated in island-index order or the tie-break changes.
12. **The search cannot be cancelled, and it cannot stop early.** `enumerateScalars` takes an `AbortSignal` and a wall-clock budget. `searchScalars` stops only on the evaluation caps. `SearchProgress.status` is always `'fitted'`.
13. **The call shape is the internal one.** The caller builds a `ScalarGrammar`, a `SeededRng`, and aligned `Float64Array` columns. There is no helper that takes a seed number and a column record and returns the final result. `bestLossFactor` cannot be set from the search options.

## Ranking

| Rank | Improvement                             | PR    | Why this rank                                                                                                      |
| ---- | --------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| 1    | Honor `admit` on seeds and offspring    | SR-1  | **Done.** A constraint the grammar already has; the search now applies it to seeds and offspring.                  |
| 2    | Opt-in subtree crossover                | SR-2  | **Done.** `crossoverProbability` defaults to 0; the operator is unchanged.                                         |
| 3    | One loss for ranking and fitting        | SR-3  | **Done.** `l1`, `huber`, and row weights already exist on the fitter and now also rank the hall.                   |
| 4    | Fit budget, bounds, and a start vector  | SR-4  | **Done.** The constants `2` and `8` and the vector of ones are now `fit` options.                                  |
| 5    | Invalid-row policy                      | SR-5  | **Done.** `invalidRows: 'penalize'` reuses the fitter's penalty in the ranker.                                     |
| 6    | Complexity weights on the hall          | SR-6  | **Done.** The weight type existed; the hall, the tie-break, and parsimony now use it.                              |
| 7    | Simplify before scoring                 | SR-7  | **Done.** `simplify` defaults to `'off'`; the two existing simplifiers run before the grammar check and the score. |
| 8    | One front row per canonical tree        | SR-8  | Dedup in the population does not dedup the hall.                                                                   |
| 9    | Dimensional and unit filter             | SR-9  | Inference and the unit table exist. The search never asks the dimension of a candidate.                            |
| 10   | `sqrt` and `atan`                       | SR-10 | **Done.** Dual rules already existed; bridge derives lowered names from `SCALAR_FUNCTION_LOWERING`.                |
| 11   | Benchmark harness                       | SR-11 | No later speed claim is legal until this exists. It changes no search behavior.                                    |
| 12   | Compile a structure once per generation | SR-12 | The score path recompiles every tree, including copies.                                                            |
| 13   | Overlapped islands, ordered merge       | SR-13 | Islands are sequential even though their random streams are independent.                                           |
| 14   | Worker threshold from a measurement     | SR-14 | The constant 100 is a caller-thread tape result, not a worker result.                                              |
| 15   | Cancel and optional early stop          | SR-15 | Enumeration can abort. The search cannot.                                                                          |
| 16   | `runScalarSearch` and `bestLossFactor`  | SR-16 | The public call is wider than a regression needs to be.                                                            |
| 17   | Walkthrough and example                 | SR-17 | Docs describe the knobs and never run a search.                                                                    |

## Rules for every implementation PR

- **Default-search freeze.** With every new option omitted, this stays true: seed 7, `populationSize: 8`, `tournamentSize: 4`, `tournamentP: 0.982`, `maxEvaluations: 120`, the `x^2 + x` problem in `functions/tests/scalar-search.test.ts`. The front's complexities, `scalarCanonicalKey`s, and losses match `PINNED_ROWS` by `Object.is`. The progress evaluations are `8, 16, …, 120`. `result.seed` is 7. `options.rng` is not advanced. `populations: 1` still matches that front. A parallel run still matches the serial run by `Object.is` on losses and fitted parameters.
- **Do not retune the shipped constants.** Population 27, tournament 15, `tournamentP` 0.982, mutation weights, temperature 3.17, decay 0.995, parsimony 1040, `fractionReplaced` 0.00036, migrant pool 12, and the frequency window stay. A PR that wants a different default is out of this plan.
- **Opt-in means the omitted option takes today's branch.** Tests for the new branch use a fixed seed and assert the new fact. They do not replace `PINNED_ROWS`.
- **Packages.** A public API change in `functions` or `expression` gets a patch changeset for that package. Do not edit `package.json` `"version"` by hand. A tools-only or docs-only PR has no changeset.
- **Exports.** A new runtime export is refreshed with `node tools/test/check-export-lock.mjs --write` in the same PR, and the PR says which names were added. A PR that adds no name runs the checker without `--write`.
- **Gates.** `bun run typecheck` stays at 0 errors. `bun run lint` stays clean. The PR's vitest files pass. After a `functions` or `expression` build change, `node tools/test/check-bundle-budget.mjs` is run; budget drift the PR caused is refreshed with `--write` in that PR.
- **Releases.** No tag, no GitHub Release, no npm publish, no push to `changeset-release/main`. Do not set `RELEASES_ENABLED`. PR #398 is merged (`chore: release packages`, head `changeset-release/main`). Do not push to that branch and do not edit that PR.
- **Measurement.** A speed number in a PR body comes from SR-11's harness, two runs, Node and Bun, the public symbol the caller imports. One run is not a claim. A ratio inside about 5% of 1.00 is noise. The PR drops the change when the gate in that section fails. Do not time two trees in one process and call it the gate.

## SR-1 — Honor `admit` on seeds and offspring

**Status: implemented.** Independent of the other PRs. Touches `functions/src/scalar-search.ts` and `functions/tests/scalar-search.test.ts`.

Add an internal check used by `initialTrees` and by the offspring loop: `scalarGrammarAccepts`, and then `grammar.admit(node)` when `admit` is set. A child that fails is a failed attempt and counts toward the existing 10 attempts. A seed that fails is skipped, as a seed that fails the grammar is skipped today. `enumerateScalars` already applies `admit`, so the enumerated half of the initial population does not change. `scalarGrammarAccepts` stays as documented: it does not call `admit`. Operator functions stay as documented: they return a tree the grammar structure accepts, and the search applies `admit`.

`admit` is part of the caller's contract. It must be a pure function of the node. The search does not copy it. A predicate that reads a clock or a random stream makes the run unreproducible, and the docs say so.

**Acceptance.** The seed-7 pin passes with options omitted. A grammar whose `admit` rejects any tree containing `sin` never reports a `sin` node, including when mutation would have wrapped a subtree in `sin` and when that tree is passed as a seed. Two runs with the same seed and the same `admit` match event by event. A grammar whose `admit` rejects every tree throws the existing `RangeError` (`the grammar admits no tree`) instead of returning an empty unexplained front. `admitMonotone` is left to enumeration; the search does not reimplement pool pruning.

**Tests.** Extend `functions/tests/scalar-search.test.ts`. Run `cd functions && bunx vitest run tests/scalar-search.test.ts`.

## SR-2 — Opt-in subtree crossover

**Status: implemented.** Independent. Touches `functions/src/scalar-search.ts` and `functions/tests/scalar-search.test.ts`. Does not change `DEFAULT_MUTATION_WEIGHTS` or `crossoverSubtrees`.

Add `crossoverProbability`, default `0`, range `[0, 1]`. At `0` the offspring loop is the current loop, so the random draws stay in today's order. Above `0`, each offspring draws a coin on that island's stream. On success it draws a second parent with the same tournament the first parent used, calls `crossoverSubtrees`, and accepts the child when it is non-null and passes the SR-1 check if SR-1 has merged, otherwise `scalarGrammarAccepts`. On failure it falls through to today's mutation attempts. The inherited parameter vector stays the first parent's vector.

**Acceptance.** Omitted probability: seed-7 pin, `Object.is`. Probability `0` is the same pin, because the coin is not drawn. A seeded run with probability `0.5` matches itself event by event and does not advance `options.rng`. A unit-level test with probability `1` and two parents whose only legal crossover is one graft asserts that graft (the operator test already owns the graft shape; this test owns the search wiring). An out-of-range probability throws `RangeError`.

**Tests.** `cd functions && bunx vitest run tests/scalar-search.test.ts tests/scalar-mutate.test.ts`.

## SR-3 — One loss for ranking and fitting

**Status: implemented.** Independent. Touches `functions/src/scalar-search.ts`, `functions/src/fit-scalar.ts` (shared `namedScalarLossTerm` / `rankScalarBatchLoss`), and `functions/tests/scalar-search.test.ts`. Reuse `fitScalarParameters`'s loss names. Do not write a second Huber or L1 formula.

Add `loss?: 'l2' | 'l1' | 'huber'`, default `'l2'`, and optional `rowWeights?: Float64Array`. The hall and the refit both use that loss. `'l2'` with weights omitted is today's sum of squares, including the all-invalid-rows `Infinity` rule. `rowWeights` length must equal `observed.length`, and every weight must be finite and `>= 0`. The refit passes `loss` and `weights` through. The comparison that keeps a refit (`fitted.loss < loss`) uses the same loss on both sides.

**Acceptance.** Omitted `loss`: seed-7 pin, `Object.is`. A fixed tree and a fixed outlier column: `'l1'` and `'huber'` produce a different finite loss than `'l2'`, each stable across two calls. A zero weight removes that row from an `'l2'` loss (the loss equals the SSE of the other rows). A weight vector of the wrong length throws `RangeError`. `optimizeProbability: 0` still leaves parameters at ones.

**Tests.** `cd functions && bunx vitest run tests/scalar-search.test.ts tests/fit-scalar-parameters.test.ts`.

## SR-4 — Fit budget, bounds, and a start vector

**Status: implemented.** Independent. Touches `functions/src/scalar-search.ts` and its test.

Add optional `fit?: { restarts?: number; maxIterations?: number; bounds?: readonly (readonly [number, number])[]; algorithm?: 'lm' | 'bfgs' | 'nelder-mead'; initial?: ArrayLike<number> }`. Omitted fields are today's call: restarts 2, max iterations 8, no bounds, the fitter's default algorithm, initial ones (or the inherited vector when the tree already has one). The values are forwarded to `fitScalarParameters` and not reimplemented.

**Acceptance.** Omitted `fit`: seed-7 pin. `fit: { restarts: 0, maxIterations: 0 }` does not move a parameter off its start. A bound that excludes the planted value `2` in the existing `p * m1 * m2 / r^2` fixture keeps the reported `p` inside the bound. A bad bound (lower `>` upper, or a length other than the parameter count) throws `RangeError`.

**Tests.** `cd functions && bunx vitest run tests/scalar-search.test.ts tests/fit-scalar-parameters.test.ts`.

## SR-5 — Invalid-row policy

**Status: implemented.** Independent. Touches `functions/src/scalar-search.ts`, `functions/src/fit-scalar.ts` only to export the existing penalty constant if it is still private, and the search test.

Add `invalidRows?: 'reject' | 'penalize'`, default `'reject'`. `'reject'` is today's `Infinity` when any row is invalid. `'penalize'` adds the fitter's existing invalid-row penalty times the number of invalid rows, plus the chosen loss on the valid rows, and it does that in the ranker. The refit already penalizes; the ranker must use the same number so a refit is comparable. Do not invent a second penalty.

**Acceptance.** Omitted option: the existing test that an invalid-on-any-row tree ranks below every valid tree still passes, and the seed-7 pin passes. `'penalize'` on a `log` tree that is invalid on one row and exact on the others reports a finite loss equal to that one-row penalty, and that tree ranks ahead of a valid tree whose loss is larger than the penalty. A tree with no valid row reports `penalty * rowCount`. A valid tree whose loss is smaller than that product ranks ahead of it.

**Tests.** `cd functions && bunx vitest run tests/scalar-search.test.ts`.

## SR-6 — Complexity weights on the hall

**Status: implemented.** Independent. Touches `functions/src/scalar-search.ts` and its test. `ScalarComplexityWeights` stays in `expression`.

Add `complexityWeights?: ScalarComplexityWeights`. The hall, truncation's complexity tie-break, and adaptive parsimony's complexity key all call `scalarComplexity(node, weights)`. Omitted weights are `{}`, which is today's size.

**Acceptance.** Omitted weights: seed-7 pin, including the complexities `1, 5, 7`. Weights `{ call: { sin: 5 } }` make a `sin` tree report complexity `scalarComplexity` of that tree with those weights, and a `+`-only tree keep its unweighted complexity. The front stays ordered by that complexity. A non-finite weight throws `RangeError` from the search before the first yield, rather than producing a `NaN` complexity that `paretoFront` would silently drop.

**Tests.** `cd functions && bunx vitest run tests/scalar-search.test.ts` and `cd expression && bunx vitest run tests/scalar-structure.test.ts`.

## SR-7 — Simplify before scoring

**Status: implemented.** Independent. Touches `functions/src/scalar-search.ts` and its test. Reuse `simplifyConstants` and `simplifyScalar`. Do not add a simplifier.

Add `simplify?: 'off' | 'constants' | 'algebraic'`, default `'off'`. `'off'` does not call either function. `'constants'` runs `simplifyConstants` on the offspring before the grammar check and the score. `'algebraic'` runs `simplifyScalar`. If `simplifyScalar` throws `ScalarBuildError` or `RangeError`, or the result fails the grammar (including `admit` once SR-1 has merged), or row-wise evaluation on positively weighted rows disagrees with the original, the offspring keeps the unsimplified tree. Simplification runs once per seed and per bred offspring, before the refit coin, so the scored tree is the tree whose parameters are fitted. Trees from `enumerateScalars` are not simplified.

Algebraic simplification is expensive relative to a mutation. The Phase 7 survey timed expression `simplify` at about 1 ms on a short input. This option stays off by default. SR-12's harness is the place to time it; SR-7 makes no speed claim.

**Acceptance.** Omitted `simplify`: seed-7 pin. `'constants'` folds a numeric subtree in a seed (`(2*3)*x` is scored as the canonical key of `6*x` when the grammar allows that tree). `'algebraic'` scores a seed `a/(b/c)` as the canonical key `simplifyScalar` produces, when that tree is still in the grammar and row-wise evaluation matches. A simplify result that uses an operator the grammar does not list is discarded and the original seed is scored. Domain-changing folds (for example `x/x` at `x=0` under `invalidRows:'reject'`) keep the original. Two runs with the same `simplify` mode and seed match.

**Tests.** `cd functions && bunx vitest run tests/scalar-search.test.ts tests/scalar-node-bridge.test.ts tests/scalar-mutate.test.ts`.

## SR-8 — One front row per canonical tree

**Status: implemented.** Independent. Touches the hall in `functions/src/scalar-search.ts` and the search test.

When two evaluated trees share a `scalarCanonicalKey`, the hall keeps one at add time: the smaller loss, then the smaller stored complexity, then the one recorded first; a better same-key tree evicts the older survivor and frees its complexity slot. Elitist truncation (`truncateDistinct`) already keeps one tree per key in the population with the same loss-first order. Complexity reported for the survivor stays the stored-tree complexity unless SR-6 weights apply; weights do not choose the survivor. Do not switch the default complexity onto the canonical tree; that would change `PINNED_ROWS` even when keys are unique.

**Acceptance.** Run the seed-7 pin. If it passes, the pin stays. If it fails, inspect the trace. Update `PINNED_ROWS` in the same PR only when the sole difference is a dropped row whose key duplicates a row that remains, and quote both fronts in the PR body. If any surviving row's loss changes, revert the hall change. A direct test inserts two stored shapes of one key at two complexities and expects one front row with the better loss. Algebraic `simplify` at seed 7 can still drop the exact loss-0 `x^2+x` row when `(x+1)*x` shares its key at another complexity; that is an open limitation of `simplify:'algebraic'`, not fixed by SR-8 (different keys; the algebraic run never evaluates a zero-loss `x^2+x` tree).

**Tests.** `cd functions && bunx vitest run tests/scalar-search.test.ts`.

## SR-9 — Dimensional and unit filter

**Status:** shipped (review fixes: infer/solve target match, unused-parameter underdetermined handling, `unitToRationalDimension` supplementary units, frozen `dimensions` snapshot).

**Independent.** Touches `functions/src/scalar-dimension.ts`, `functions/src/scalar-search.ts`, `functions/src/index.ts`, and `functions/tests/scalar-dimension.test.ts`, `functions/tests/scalar-search.test.ts`. A patch changeset on `@danielsimonjr/mathts-functions`.

Add `unitToRationalDimension(unitName: string): RationalDimension` next to the dimension helpers. It builds `new Unit(1, unitName)` and returns `toSiDimensionVector` of that unit's dimensions. Supplementary angle and solid-angle exponents map to a dimensionless 7-vector; information (`bit`, `byte`) throws `UnitParseError`. An unknown unit name throws the error `Unit` already throws. No new unit table and no `UnitTensor`.

Add optional `dimensions?: { symbols: Readonly<Record<string, RationalDimension>>; target: RationalDimension; onUnderdetermined?: 'keep' | 'reject' }` on the search. Omitted: no dimension walk, today's search. Set: after the grammar check and before scoring, call `solveParameterDimensions` when the fitted parameter list is non-empty (an empty `problem.parameters` array forces infer mode), otherwise `inferScalarDimension`, and require the root dimension to match `target`.

- A violation (`add-mismatch`, `transcendental-arg-not-dimensionless`, `non-literal-exponent-on-dimensional-base`, `unknown-symbol`) or an `inconsistent` solve scores `Infinity` and does not enter the hall. It still counts as an evaluation.
- `onUnderdetermined` defaults to `'keep'`: the numeric fitter still runs. `'reject'` scores `Infinity`.
- Symbols listed in `symbols` are known dimensions. Parameters omitted from `symbols` are the unknowns the solver already accepts. A variable omitted from `symbols` is `unknown-symbol`.

The check reads the tree that will be scored. If SR-7's `simplify` is on, that is the simplified tree; if SR-7 has not merged, it is the offspring. Either way the PR does not depend on SR-7's types.

**Acceptance.** Omitted `dimensions`: seed-7 pin. With `x` a length and target a length, `x + x` can enter the front and `sin(x)` cannot. `unitToRationalDimension('m')` equals the length vector of seven `Fraction`s. A parameter `p` in `p * x` with target length solves as dimensionless and the tree is scored. `p + x` with `p` fixed dimensionless is `inconsistent` and does not enter the hall. `'reject'` drops an underdetermined tree; the default keeps it. A target that is not seven `Fraction`s throws `TypeError` from the existing validator.

**Tests.** `cd functions && bunx vitest run tests/scalar-search.test.ts tests/scalar-dimension.test.ts`.

## SR-10 — Operators `sqrt` and `atan`

**Status: shipped** (Relay review: merge `main`, bridge sync, gradient valid mask aligned with primal scoring, fitter regression tests).

**Independent of the search-loop PRs.** It extends the scalar subset those PRs already search. Touches the builder lowering table, `evaluateScalar`'s unary map, the compile-tape unary map, `scalar-dimension.ts`, and the tests under those modules. Patch changesets on `@danielsimonjr/mathts-expression` and `@danielsimonjr/mathts-functions`.

Add `sqrt` and `atan` to `SCALAR_FUNCTION_LOWERING` as themselves. `evaluateScalar` and the tape call the existing MathTS `sqrt` and `atan`. The gradient uses `DUAL_UNARY_RULES.sqrt` and `DUAL_UNARY_RULES.atan`, which already exist. Do not add a derivative in this PR.

Dimension: `atan` joins the transcendental set (argument dimensionless, result dimensionless). `sqrt` does not. A dimensionless argument stays dimensionless. A dimensional argument is `scaleForms` by `new Fraction(1n, 2n)`, the same scaling `^` uses after `literalExponent(0.5)`. `sqrt(x)` and `x ^ (1/2)` then infer the same vector when both are legal, including length to the power one half.

A negative `sqrt` argument is a non-finite result. `compileScalar` already marks that row invalid. The search then applies whatever invalid-row policy is on `main`. This PR does not change that policy.

No other unary or binary operator is added. `ConditionalNode` stays outside the scalar subset. Mutation weights do not change; a grammar lists `sqrt` or `atan` in `unary` or it does not.

**Acceptance.** `scalar.call('sqrt', scalar.symbol('x'))` evaluates to 3 at `x = 9` and has a parameter gradient when the tree is `sqrt(a * x)` (compare against `DUAL_UNARY_RULES.sqrt` at that point). `atan(1)` evaluates to `pi/4` within the existing trig tolerance. `inferScalarDimension` of `sqrt` of a length is length to the power one half. `atan` of a length is `transcendental-arg-not-dimensionless`. A grammar that does not list `sqrt` still rejects a `sqrt` node. The seed-7 pin passes, because that grammar's `unary` list does not gain names by itself. Export lock lists the new behavior only if a new export name appears; the builder's existing `call` is the entry, so prefer no new export name.

**Tests.** `cd expression && bunx vitest run tests/scalar-builder.test.ts tests/scalar-enumerate.test.ts` and `cd functions && bunx vitest run tests/scalar-eval.test.ts tests/scalar-compile.test.ts tests/scalar-compile-gradient.test.ts tests/scalar-dimension.test.ts tests/scalar-search.test.ts`.

## SR-11 — Benchmark harness

**Independent. Tools and docs only.** No changeset. No change to `searchScalars`.

Add `tools/benchmark/scalar-search/` and a root script that runs it. The harness follows the benchmarking rules in `AGENTS.md`:

- The public symbols: `searchScalars`, `compileScalar`. Case (3) reaches the internal module `functions/src/scalar-batch-parallel.ts` through its built `dist/scalar-batch-parallel.js` entry (not the functions barrel); no new export or changeset.
- One tree per process. Node via a real `node` (`PERF_NODE` overrides). Bun via `bun --tsconfig-override=tsconfig.base.json` (absolute path in the runner).
- Cases: (1) compile and score the pinned `x^2 + x` population once, (2) the seed-7 pinned search of 120 evaluations, (3) `evaluateScalarPopulation` serial vs an explicit injected `WorkerPool` at row counts 100, 1e3, 1e4, 1e5, on the mid-size tree the M3 bench already uses — not the default `parallel: {}` path inside `searchScalars`. Case (2) checks losses against the shared pinned-rows fixture with `Object.is` before any timing and fails the process on a mismatch. A `null` or a throw fails the case.
- Warm at least 5 reps, then time. Print medians. Do not assert a speedup in this PR.
- An A/A control: two distinct but identical serial closures (same rule as `tools/benchmark/ab`). Its ratio over five runs stays inside ±2%, or the PR reports the wider band and does not tighten it by deleting the control.

Commit the runner and a short note in `docs/BENCHMARK_RESULTS.md` that this harness exists and that it replaces no M3 number. The note records the machine only after the PR author runs it; this plan does not invent those numbers.

**Acceptance.** `node tools/benchmark/scalar-search/run.mjs` and the Bun invocation both exit 0 on the correctness check. `node --test` covers any pure helper the runner extracts (argument parsing, median). The seed-7 search test is unchanged.

## SR-12 — Compile a structure once per generation

**Status:** measured and reverted. SR-11 case (2) (the seed-7 pinned search of 120 evaluations) missed the 1.02 ceiling on every case, so the cache change was reverted and the score path compiles per tree again. **Builder revert run (two runs each, Node and Bun vs uncached base):** about **1.24× to 1.70× slower** — Node **1.45× to 1.70×**, Bun **1.24× to 1.34×**. **Challenger independent reproduction:** about **1.16× to 1.42× slower**. Duplicate work was rare in the builder run (**28** stored-shape hits and **9** canonical-key hits in **120** evaluations), while **`scalarCanonicalKey` cost about 31× one `compileScalar`** on representative trees; an idealized structural-hash cache (no canonical walk, no sharing probe) only broke even. The implemented sharing gate sampled parameter values at **1** (`ones` probe): **`(p·x)²` and `p²·x²` agree at `p = 1` but differ at `p = 0.1`**, so key-only sharing was unsound. Any future cache must compare stored shapes structurally (or prove `Object.is`-identical values on the problem columns for every parameter vector scored) and must not rely on a sampling probe.

**Merges alone.** Its correctness gate does not need SR-11. A speed sentence in the PR body does, and is omitted when SR-11 is not on `main` yet.

Inside one `scoreTrees` call, compile each distinct `scalarCanonicalKey` once and evaluate that tape with each tree's parameter vector. Trees whose stored shapes differ and whose keys match still share a tape only when `compileScalar` of either shape returns `Object.is`-equal values on the problem's columns. When they do not, key the cache by the stored tree (a stable string of the stored node), not by the canonical key. Copies of a parent in the same batch reuse the tape. The refit path may compile again; that compile is outside the batch cache. Results stay on the caller thread or on the workers exactly as `parallel` already decides. The worker task may receive a tape that the caller built, or keep compiling in the worker: pick the one that preserves `Object.is` against the serial batch, and test both orders if both are implemented. Do not implement both.

**Acceptance.** Seed-7 pin, `Object.is`, serial and parallel. A batch of two trees with the same structure and different parameters returns two different losses. A batch that mixes a valid tree and an invalid tree still returns `Infinity` for the invalid one only. After SR-11 is available: two runs, Node and Bun, the pinned search at 120 evaluations. Keep the cache only when every case is at or below 1.02 versus the uncached base and at least the 120-evaluation case is at or below 0.95 on both engines. Otherwise revert the cache and say so in the PR. No speed number is copied into `docs/reference/scalar-search.md`.

**Tests.** `cd functions && bunx vitest run tests/scalar-search.test.ts tests/scalar-search-parallel.test.ts tests/scalar-compile.test.ts` and `bunx vitest run tests/integration/scalar-search-parallel.test.ts`.

## SR-13 — Overlapped islands, ordered merge

**Status: shipped.** The islands' score calls overlap within one generation via `Promise.all` in the search's own process when worker scoring is active; without `parallel`, or below the row threshold, scoring stays on the caller thread and overlap does not increase throughput. The `parallel` worker scoring path is unchanged. Hall updates and population replacement run in island-index order after every island's batch finishes; migration stays after that merge on the `migration` stream. Each island keeps its own `SeededRng`; nothing is shared. One deliberate deviation from this section's prose: the **frequency-window update is recorded at breeding time**, staged per island and flushed at the island boundary (still in island-index and offspring order), not after the merge — the parsimony window is read by the _next island's_ breeding in the same generation. Deferring the update to the merge does **not** break the pinned multi-island trace (seed 2, four islands); it diverges from the sequential schedule in about 50 of 80 seed/`populations` pairs in the differential test. Recording each offspring complexity immediately inside the breeding loop (before the island finishes) diverges as well. The island-boundary flush reproduces the sequential schedule's record sequence, which is what the pinned trace and the bit-identical parallel tests require. `parallel.timeoutMs` is per worker task and includes queue time behind the other islands' submissions in the same generation; scale it with `populations`. The multi-island trace test pins the sequential schedule's fronts (populations 4, seed 2, `x^4 + x^2` grammar, 240 evaluations) event by event, complexities, keys, and `Object.is` losses (including `2.1572822789567526e-31`); `populations: 1` still matches `PINNED_ROWS`; closing the generator early still terminates the pool the search owns.

**Independent.** Touches `functions/src/scalar-search.ts` and the island tests.

Today the generation `await`s island 0, then island 1, and so on. Each island's breeding and scoring uses only that island's `SeededRng`. Overlap the islands' score calls. Apply hall updates, frequency-window updates, and population replacement in island-index order after every island in the generation has finished, using the arrays those calls already return. Migration stays after that merge, on the `migration` stream, unchanged. `populations: 1` does not start a second task.

The overlap is inside one process (`Promise` concurrency), not a second worker pool. Worker scoring from `parallel` stays as it is. Do not share one `rng` across islands.

**Acceptance.** Before changing the schedule, record a multi-island trace in the test from the current code: `populations: 4`, a fixed seed, the `x^4 + x^2` grammar, `maxEvaluations` small enough to finish in the unit budget, complexities, keys, and `Object.is` losses at each progress event. The overlapped schedule matches that trace. `populations: 1` still matches `PINNED_ROWS`. Closing the generator early still terminates a pool the search owns.

**Tests.** `cd functions && bunx vitest run tests/scalar-search.test.ts tests/scalar-search-parallel.test.ts`.

## SR-14 — Worker threshold from a measurement

**Depends on SR-11 being on `main` for the number. The PR still merges as a docs-and-maybe-constant change of its own.**

Run SR-11 case (3) twice on Node and twice on Bun. The candidate threshold is the smallest measured row count where the worker path's median is at or below 0.95 times the serial path in all four runs, and the row count below it is not. If no row on the grid qualifies, leave `SCALAR_PARALLEL_MIN_ROWS` at 100 and write the four runs into `docs/BENCHMARK_RESULTS.md`. If one qualifies, change the constant, quote the four runs in the PR, and keep the bit-identical parallel tests. Do not claim a speedup for `searchScalars` as a whole from this constant alone.

A Bun failure to start `worker_threads` is a result: record it, leave the constant, and do not special-case Bun with a silent fallback that skips the timeout. `WorkerPool` already selects `worker_threads` when `process.versions.node` is set, which Bun sets.

**Acceptance.** The four runs are in the PR body and in `docs/BENCHMARK_RESULTS.md`. The seed-7 pin and the real-worker integration test pass. The constant changes only under the rule above.

**Tests.** The integration file `tests/integration/scalar-search-parallel.test.ts` and `cd functions && bunx vitest run tests/scalar-search-parallel.test.ts`.

## SR-15 — Cancel and optional early stop

**Status: shipped.** `signal` is checked before the initial population (an already-aborted signal returns the empty hall with `evaluations: 0` and `stopReason: 'cancelled'`, before any enumeration or pool start) and between generations — after each yield, before the next batch breeds. A generation already breeding and scoring runs to completion; the cancel then returns that generation's progress as the result. The check reads `signal.aborted` only, so any abort reason behaves the same. `earlyStop`'s streak is taken over the hall after the generation, initial population included: on `x^2 + x` with the default population of 27 the bound `1e-10` is met by the initial hall, so `generations: 1` stops at 27 evaluations and `generations: 2` at 54. The best finite hall loss can only improve, so the streak resets only while the bound has not been reached. A run that never reaches `loss` still ends on `'max-evaluations'` — and when the bound is first met by the final generation, `'early-stop'` wins over the budget reason. The pool the search owns is terminated on cancel as on every other exit; a caller-supplied `pool` is still never terminated.

**Independent.** Touches `functions/src/scalar-search.ts` and its test.

Add `signal?: AbortSignal`. The search checks it before the initial population and between generations, not in the middle of a random draw. Already aborted before the first yield: return a result with an empty front, `evaluations: 0`, and `stopReason: 'cancelled'`. Aborted after a yield: return the last progress as the result with `stopReason: 'cancelled'` and do not start another generation. The pool the search owns is still terminated. `ScalarSearchStopReason` gains `'cancelled'`.

Add `earlyStop?: { loss: number; generations: number }`. Omitted: no early stop. Set: after a generation whose best finite hall loss is `<= loss`, and that has stayed true for `generations` consecutive generations, return `stopReason: 'early-stop'`. `generations` is an integer `>= 1`. `loss` is finite. The check uses the hall after the generation, so a run that never reaches the loss still hits `max-evaluations`.

**Acceptance.** Omitted `signal` and `earlyStop`: seed-7 pin, full 120 evaluations. Aborting before `next()` returns `cancelled` and zero evaluations. Aborting after the first progress returns that front and does not emit another. `earlyStop: { loss: 1e-10, generations: 1 }` on the `x^2 + x` problem, whose law is in the initial population, stops at 27 evaluations with `early-stop` for the default population of 27, and the seed-7 small-population pin is unchanged because that test does not set `earlyStop`. Two uninterrupted runs still match.

**Tests.** `cd functions && bunx vitest run tests/scalar-search.test.ts`.

## SR-16 — `runScalarSearch` and `bestLossFactor`

**Independent.** Touches `functions/src/scalar-search.ts`, `functions/src/index.ts`, the functions README paragraph only if SR-17 has not yet described the helper, and a new `functions/tests/scalar-search-run.test.ts`. Patch changeset on `@danielsimonjr/mathts-functions`. Export lock refreshed for `runScalarSearch`.

`runScalarSearch(problem, options)` consumes the generator and returns the `ScalarSearchResult`. It is a thin wrapper: `options` is `ScalarSearchOptions` plus `seed?: number`. When `seed` is set and `rng` is omitted, the wrapper builds `createSeededRng(seed)` and passes it. When both are set, throw `RangeError`. When neither is set, throw `RangeError`. The wrapper does not reimplement search.

Add `bestLossFactor?: number` on `ScalarSearchOptions`, forwarded to `selectFrontModel` only when `modelSelection` is set. Omitted: 1.5, today's call. A non-finite factor throws `RangeError` before the search starts.

Also accept `columns` as a `Readonly<Record<string, Float64Array>>` on a small input type used by the wrapper, in `variables` order, so a caller can pass `{ x: xs }` together with `variables: ['x']`. The wrapper builds the array `searchScalars` already requires. `searchScalars` itself keeps the array form.

**Acceptance.** `runScalarSearch` with `seed: 7` and the pin options returns the same front, `Object.is` losses, as `searchScalars` with `createSeededRng(7)`. The wrapper's rng is not observable and the result's `seed` is 7. `bestLossFactor: 1` with `modelSelection: 'best'` selects the minimum-loss row. The seed-7 pin does not set `modelSelection`, so it stays put. `node tools/test/check-export-lock.mjs --write` records `runScalarSearch`. `node tools/test/consumer-typecheck.mjs` sees that export as callable in the packed `.d.ts`.

**Tests.** `cd functions && bunx vitest run tests/scalar-search.test.ts tests/scalar-search-run.test.ts tests/pareto-front.test.ts`.

## SR-17 — Walkthrough and example

**Last, and still able to merge on its own against today's `main`.** Docs and one example. No changeset. It documents the public API that is on `main` when the PR is opened. It does not document an option from a PR that has not merged. As the earlier PRs merge, this PR's text grows to include them; do not block those PRs on this page.

- Add a "Running a search" section to `docs/reference/scalar-search.md`: the `x^2 + x` problem, a grammar, `createSeededRng(7)`, `maxEvaluations: 120`, and what the result's `front`, `stopReason`, and `seed` mean. State that a `consistent` verdict from `numericallyEquivalent` is evidence, not proof. State that omitted options are the defaults table already on that page.
- Add `examples/scalar-search.ts` that runs that search and prints each front row's complexity, loss, and `scalarCanonicalKey`. Follow `examples/README.md`: `bun --tsconfig-override=tsconfig.base.json`.
- Point the `functions/README.md` sample at one `searchScalars` call, or at `runScalarSearch` if SR-16 has merged.
- Do not add a workbook cell. The workbook does not run this driver.

**Acceptance.** The example runs against the built packages and prints three rows for the pinned configuration, with the pinned keys. `bun run format:check` passes. No runtime source changes. The reference's default tables are unchanged.

## Risks

- **The pin is the regression net.** Any edit that draws one extra random number before the first mutation, or that changes loss rounding, breaks `Object.is` on `6.317050217590134e-32` and on `0`. The freeze rule exists so that failure is loud.
- **`admit` and `simplify` can empty the initial population.** SR-1 and SR-7 must throw the existing grammar error when nothing remains, not hang and not return a silent empty hall.
- **`simplifyScalar` can leave the scalar subset or add an operator the grammar forbids.** SR-7 keeps the unsimplified tree in that case. Shipping algebraic simplify as the default would also spend milliseconds per offspring and would change the pin.
- **Dimension rejection interacts with invalid rows.** A dimension failure is `Infinity` in the hall, the same bucket as a numerical failure. The progress event does not say which. SR-9 does not add a second status string; the tests distinguish them by which tree is absent.
- **`sqrt` of a negative row looks like a bad model under `'reject'`.** That is the existing invalid-row rule. SR-10's tests use a non-negative column.
- **Overlapped islands need an ordered merge for determinism.** SR-13 records the trace before the schedule change and matches it after. The hall keeps one row per canonical key at add time, so equal losses across islands do not usually show up through `front()`; index-order merge still matches the sequential schedule's hall and population updates.
- **A worker threshold move without four agreeing runs repeats the gap this plan is closing.** SR-14 would rather leave 100 in place.
- **Caching tapes by canonical key can mix two stored shapes that are equal as keys and unequal as numbers** (`scalarCanonical` does not fold `2^3` to `8`, but other stored shapes can share a key and still evaluate differently before simplification). SR-12 falls back to a stored-tree key when values differ.
- **Bun and Node can disagree on worker startup.** The harness records that. It does not paper over it with a path that skips `timeoutMs`.
- **New exports and the consumer `.d.ts` check.** `runScalarSearch` and `unitToRationalDimension` are callable exports. The pack-and-typecheck gate is the one that sees a bad `.d.ts`; the repo `tsc` is not.

## Out of scope

- A new package, a new default population, or a new default mutation weight.
- Retuning annealing, parsimony, tournament pressure, or migration. Those numbers are the recorded search.
- AIC, BIC, or any new score column. `scoreFront` on the linear scale stays `null`. [`docs/plans/COMPLETION_PLAN.md`](./COMPLETION_PLAN.md) left that question open and said not to add a score. This plan does not add one.
- Template expressions, denoising, and feature selection. The completion plan recorded them as deferred. They stay deferred.
- Embedding another language's search runtime. The reference non-goal stands. Evolution stays `searchScalars`, `enumerateScalars`, and the mutation operators.
- A `UnitTensor`, or SI checking on `Tensor`. Dimension checks apply to `ScalarNode` only.
- Conditionals, piecewise trees, custom caller-supplied operators, and any unary beyond `sqrt` and `atan`.
- Multi-output targets, classification, and integer-only search.
- WASM or GPU evaluation of search candidates. The batch tape is the measured fast path for this size of tree, and this plan does not move the search onto a backend that the rest of the repo has measured as slower for similar kernels.
- A workbook cell, a GUI, or a change to the expression sandbox, the WASM SHA-384 check, or the worker-pool timeout plumbing. `timeoutMs` on the scalar pool stays.
- Skipping the re-score of an unchanged offspring. That would skip a refit coin and change the random stream. SR-12 reuses a tape; it still consumes the same draws.
- Tags, GitHub Releases, npm publish, version edits, and any change to PR #398 or `changeset-release/main`.

## Order

Merge in this order. Each PR is reviewed and merged by itself. Skipping one leaves `main` consistent, because every new option defaults to today's behavior. SR-14's decision needs SR-11's harness on `main`. SR-17 is written against whatever subset has merged.

| Order | PR    | One-line contract                                                             |
| ----- | ----- | ----------------------------------------------------------------------------- |
| 1     | SR-1  | `admit` binds seeds and offspring. **Done.**                                  |
| 2     | SR-2  | `crossoverProbability` defaults to 0. **Done.**                               |
| 3     | SR-3  | Ranking loss and refit loss are the same `l2` / `l1` / `huber`. **Done.**     |
| 4     | SR-4  | Fit restarts, iterations, bounds, and the start vector are options. **Done.** |
| 5     | SR-5  | `invalidRows` defaults to `'reject'`. **Done.**                               |
| 6     | SR-6  | `complexityWeights` reach the hall. **Done.**                                 |
| 7     | SR-7  | `simplify` defaults to `'off'`. **Done.**                                     |
| 8     | SR-8  | One hall entry per `scalarCanonicalKey`.                                      |
| 9     | SR-9  | Opt-in SI filter, plus `unitToRationalDimension`.                             |
| 10    | SR-10 | Grammars may name `sqrt` and `atan`. **Done.**                                |
| 11    | SR-11 | Node and Bun harness, no speed claim.                                         |
| 12    | SR-12 | One compile per structure per generation, bit-identical.                      |
| 13    | SR-13 | Islands overlap; merge in index order. **Done.**                              |
| 14    | SR-14 | Worker threshold moves only when four runs agree.                             |
| 15    | SR-15 | `AbortSignal` and opt-in `earlyStop`.                                         |
| 16    | SR-16 | `runScalarSearch` and `bestLossFactor`.                                       |
| 17    | SR-17 | Reference walkthrough and `examples/scalar-search.ts`.                        |
