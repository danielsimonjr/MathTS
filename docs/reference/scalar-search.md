# Scalar search reference

MathTS ships a **ScalarNode** toolkit: build trees with `createScalarBuilder` (`number`, `symbol`, `op`, `call`). `ln` lowers to natural `log`; `log` lowers to `log10`. A formula string is rejected at the builder. This page records the public surface, Pareto scoring and selection, mutation weights, the ScalarNode bridge conventions, non-goals, and two extension pins (expression nodes and autodiff).

## Export surface

| Area          | Home                                                                                                     | Exports                                                                                                                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structure     | `expression/src/scalar-structure.ts`                                                                     | `forEachScalar`, `mapScalar`, `scalarSize`, `scalarDepth`, `scalarComplexity`, `scalarSymbols`, `scalarCanonical`, `scalarCanonicalKey`, `scalarEquals`, `ScalarComplexityWeights`                                                  |
| Batch and fit | `functions/src/scalar-compile.ts`, `functions/src/fit-scalar.ts`                                         | `compileScalar`, `compileScalarGradient`, `fitScalarParameters`                                                                                                                                                                     |
| Bridge        | `functions/src/scalar-node-bridge.ts`                                                                    | `scalarToNode`, `nodeToScalar`, `simplifyScalar`, `scalarToTex`                                                                                                                                                                     |
| Front         | `functions/src/pareto-front.ts`, `functions/src/front-export.ts`                                         | `paretoFront`, `scoreFront`, `selectFrontModel`, `frontToLatexTable`, `frontToJson`                                                                                                                                                 |
| Compare       | `functions/src/numeric-equivalence.ts`                                                                   | `numericallyEquivalent` (`consistent` is evidence, not proof)                                                                                                                                                                       |
| Dimension     | `functions` scalar-dimension modules, `core/src/types/si-dimension-vector.ts`                            | `inferScalarDimension`, `solveParameterDimensions`, `SiDimensionVector` of seven `Fraction`s in BIPM order `[L, M, T, I, Θ, N, J]`                                                                                                  |
| Search        | `expression/src/scalar-enumerate.ts`, `functions/src/scalar-mutate.ts`, `functions/src/scalar-search.ts` | `enumerateScalars`, the mutation operators, `searchScalars`                                                                                                                                                                         |
| Units         | `core/src/types/unit/unit-table.ts`, `Unit.ts`                                                           | Supplementary units and spellings in the unit table (`nat`, `percent`, `ppm`, `ppb`, `d` as day, `Angstrom`, cycle rates, exact scales, the ISO 80000 solidus). Storage `bit` stays 8 per byte, not an information bit of `ln2` nat |

`searchScalars` is the shipped evolutionary driver over `ScalarNode` trees; it is not extended here. The expansion contract is [`docs/plans/SYMBOLIC_REGRESSION_EXPANSION_PLAN.md`](../plans/SYMBOLIC_REGRESSION_EXPANSION_PLAN.md). This page stays the record of the shipped surface.

## Grammar `admit`

`admit` is an optional predicate on `ScalarGrammar`. `enumerateScalars` already drops trees `admit` rejects. `searchScalars` applies the same check to seeds and to mutation offspring: `scalarGrammarAccepts`, then `grammar.admit(node)` when `admit` is set. A rejected seed is skipped, as a seed that fails the grammar is skipped. A rejected child is a failed mutation attempt and counts toward the existing 10 attempts. `scalarGrammarAccepts` does not call `admit`. Mutation operators still return a tree the grammar structure accepts; the search applies `admit`. `admitMonotone` is left to enumeration; the search does not reimplement pool pruning.

`admit` must be a pure function of the node. The search does not copy it. A predicate that reads a clock or a random stream makes the run unreproducible. When `admit` is omitted, the seed-7 pin is unchanged.

## Pareto scores and model selection

Definitions match `functions/src/pareto-front.ts`.

**`scoreFront`** on the log scale walks the array in the order given. It does not sort and it does not drop rows. The first row scores `0`. Each later row with `loss > 0` scores `-Math.log(loss / previousLoss) / (complexity - previousComplexity)`. `loss <= 0` scores `+Infinity`. A zero complexity gap is IEEE division (`NaN` or an infinity); there is no special case. On the linear scale every score is `null`, and a zero loss does not become `+Infinity`. Any other `lossScale` throws `ParetoFrontError`.

**`selectFrontModel`** defaults to `best` with factor `1.5` (the `bestLossFactor` option). `accuracy` is the minimum loss. `score` is the maximum score. `best` keeps rows with `loss <= 1.5 * min(loss)` and then takes the maximum score. If every score is `null`, `score` and `best` both fall back to `accuracy`. A mix of `null` and numeric scores throws. Ties: lower complexity, then the earlier input index. `NaN` is worse than every other score, including `-Infinity`. The return value is the same object as the chosen row.

## Mutation weights

`DEFAULT_MUTATION_WEIGHTS` in `functions/src/scalar-mutate.ts` keeps these numbers. Draw order is the module-internal `MUTATION_DRAW_ORDER` (not exported), the same as the object key order. Optimize and backsolve are omitted (weight 0).

| Operator            | Weight     |
| ------------------- | ---------- |
| `rotateTree`        | `4.26`     |
| `addNode`           | `2.47`     |
| `deleteNode`        | `0.87`     |
| `mutateOperator`    | `0.293`    |
| `identity`          | `0.273`    |
| `swapOperands`      | `0.198`    |
| `mutateFeature`     | `0.1`      |
| `mutateConstant`    | `0.0346`   |
| `insertNode`        | `0.0112`   |
| `simplifyConstants` | `0.00209`  |
| `randomizeTree`     | `0.000502` |

The negation probability on perturbed constants is `MUTATE_CONSTANT_NEGATE_PROBABILITY` (`0.00743`).

`searchScalars` defaults in `functions/src/scalar-search.ts`: `populationSize` 27, `tournamentSize` 15, `tournamentP` 0.982, `crossoverProbability` 0, `loss` `'l2'`, `fractionReplaced` 0.00036, annealing `initialTemperature` 3.17 decaying by 0.995 each generation, `adaptiveParsimonyScaling` 1040, migrant pool 12, frequency window 100000.

## Opt-in ranking loss

`loss` is `'l2' | 'l1' | 'huber'` and defaults to `'l2'`. The hall and every parameter refit use that name. `'l2'` with `rowWeights` omitted is today's sum of squares, including `+Infinity` when any row is invalid. `'l1'` and `'huber'` reuse `fitScalarParameters`'s formulas (`namedScalarLossTerm`); there is not a second Huber or L1. `rowWeights`, when set, is a `Float64Array` of length `observed.length` whose entries are finite and `>= 0`. A zero weight drops that row. The comparison that keeps a refit (`fitted.loss < loss`) scores both sides with this loss. Omitted `loss` and omitted `rowWeights` leave the seed-7 pin unchanged.

## Hall dedup (SR-8)

The hall keeps one evaluated tree per `scalarCanonicalKey` at add time: smaller loss, then smaller stored complexity, then the one recorded first; a better same-key arrival evicts the older survivor and frees its complexity slot when that slot held only the evicted tree. Elitist truncation in the population (`truncateDistinct`) already keeps one tree per key with the same loss-first order. The reported front is the Pareto set of the best loss per complexity among those stored trees. Complexity weights change reported complexity only, not which duplicate survives.

`invalidRows` is `'reject' | 'penalize'` and defaults to `'reject'`, today's `+Infinity` on any invalid row, so such a tree never enters the hall. `'penalize'` scores `INVALID_ROW_PENALTY` (`1e8`) times each invalid row that has positive weight, plus the chosen `loss` on the valid rows; a zero-weight row is dropped on both sides, so it is neither penalized nor scored. A tree with no valid row reports the penalty times the number of positively weighted rows (with uniform weights that is `observed.length`). The penalty is absolute, not scaled to the target, so very large-magnitude targets can outrank trees that are invalid on every row. The ranker adds that sum on top of the valid-row loss; the fitter's reported `loss` counts only valid rows and, under LM, squares the frozen invalid-row residual — the objectives differ. Refit acceptance compares the pre-refit rank and the refit with the same ranking function (`fitted.loss < loss` after both are scored on the problem). Under `'penalize'`, the advisory refit still runs when no row is valid (SR-4's try/catch discards a fit that throws `no valid rows to fit`). Omitted `invalidRows` leaves the seed-7 pin unchanged.

## Opt-in crossover

`crossoverProbability` is in `[0, 1]` and defaults to `0`. At `0` (or when omitted) the offspring loop does not draw a coin, so the island random stream matches a mutation-only search and the seed-7 pin is unchanged. Above `0`, each offspring draws a coin on that island's stream. On success the search draws a second parent with the same tournament, calls `crossoverSubtrees`, and keeps the child when it is non-null and the grammar (including `admit`) accepts it. On failure it falls through to the existing mutation attempts. The inherited parameter vector is the first parent's. `DEFAULT_MUTATION_WEIGHTS` and `crossoverSubtrees` are unchanged.

## Opt-in fit options

`fit` forwards refit knobs to `fitScalarParameters`; the values are not reimplemented. `fit.algorithm` is `'lm' | 'bfgs' | 'nelder-mead'`. An omitted field is today's call: `restarts` 2, `maxIterations` 8, no bounds, the fitter's default algorithm (`'lm'` for `'l2'`, `'bfgs'` otherwise), and `initial` set to the tree's inherited vector (ones at the initial population). `bounds` is one `[lo, hi]` pair per parameter, endpoints finite or `±Infinity`, `lo <= hi`, length equal to the parameter count; `initial` must have that length and finite values. `fit` must be a plain object when set. Each bounds entry must be a two-element array. `fit.algorithm` `'lm'` requires `loss` `'l2'`. A bad bound, length, algorithm, restart count, or start vector throws `RangeError` before the first yield. When bounds are set, every reported parameter vector is clamped into those bounds and rescored with the ranking loss. A refit that the fitter cannot run (`no valid rows to fit`) is discarded and the inherited vector is kept, like any other unfittable tree. Omitted `fit` leaves the seed-7 pin unchanged.

## Opt-in complexity weights

`complexityWeights` is a `ScalarComplexityWeights` (defined in `expression/src/scalar-structure.ts`, exported by `@danielsimonjr/mathts-expression`): per-node weights with optional `op` (per `ScalarOperator`), `call` (per lowered name), `number`, and `symbol` (one number or a per-name record) fields; an omitted field weighs 1. The hall, the elitist-truncation complexity tie-break, and adaptive parsimony's complexity key all call `scalarComplexity(node, weights)`. An omitted option, or `{}`, is today's node count, so the seed-7 pin is unchanged. Before the first yield the search normalizes caller weights into a frozen snapshot: the top level and every `op`, `call`, or per-name `symbol` record must be a plain data object (prototype `Object.prototype` or `null` — not `Map`, typed arrays, `Date`, or class instances). Each own key is read once with `Reflect.ownKeys`; non-enumerable own keys and accessor properties throw `RangeError`. Every weight that is set must be a finite number `>= 0`; weights that would make a tree of `grammar.maxSize` raw nodes sum to a non-finite value also throw before the first yield, rather than silently emptying the hall via `+Infinity` complexity. Zero weights are accepted — they are summed and `Math.round`ed like any other weight, and the front stays ordered by the resulting complexity; rounding can merge distinct trees into one hall slot. Hall dedup by canonical key uses loss first, not weighted complexity. An explicitly `undefined` data property is the omitted weight. Keys on nested records must use lowered call names (`ln` is stored as `log`); keys with no matching node kind are kept but ignored at scoring time. `grammar.maxSize` limits raw node count in the grammar, not weighted complexity. The weights change no loss and no random draw: with the same seed, a weighted run equals itself event by event and equals a parallel run of itself.

## Opt-in simplify before scoring

`simplify` is `'off' | 'constants' | 'algebraic'` and defaults to `'off'`: neither simplifier runs, and the seed-7 pin is unchanged. `'constants'` runs `simplifyConstants` on each seed and each bred offspring before the grammar check and the score; `'algebraic'` runs `simplifyScalar` (the expression `simplify` through the scalar bridge). Simplification runs once per seed or bred offspring, before the refit coin, so the scored tree is the tree whose parameters are fitted. When `simplifyScalar` throws `ScalarBuildError` or `RangeError`, or its result fails the grammar (including `admit`), or it would change the valid/invalid pattern or values on a positively weighted row relative to the original, the tree keeps its unsimplified shape. A fold to a non-finite constant is refused by `simplifyConstants`, which also keeps the original. `grammar.literals` is a sampling pool for `randomizeTree`, not a whitelist of allowed numeric nodes. Trees that come out of `enumerateScalars` are not simplified. Simplification draws no random numbers, but different accepted trees can change how many mutation attempts succeed, so a run with `simplify` on may diverge from `'off'`; two runs that share the same `simplify` mode and seed still match. Progress event count stays budget-driven (`maxEvaluations`). When the simplified tree’s canonical key differs, `admit` sees that folded tree first; a no-op fold (same key) is checked once. `ScalarSearchResult.simplifyFallbacks` counts how often the unsimplified tree was kept for the reasons above. The reported complexity is the stored (simplified) tree’s, under `complexityWeights` when those are set. Algebraic simplification at seed 7 can drop the exact loss-0 `x^2+x` hall row when a folded `(x+1)*x` shares its key at another complexity; that is an open limitation of `simplify:'algebraic'` (the run never evaluates a zero-loss `x^2+x` tree), not something SR-8 hall dedup fixes. Algebraic simplification costs milliseconds per tree, so the option stays off by default, and this page makes no speed claim (SR-11’s harness is the place for one).

## ScalarNode ↔ expression Node

`scalarToNode` / `nodeToScalar` live in `functions/src/scalar-node-bridge.ts`. A round trip keeps `scalarCanonicalKey`. Natural `log` becomes expression `log(x)`; `log10` stays `log10(x)`. Unary minus is `(-1)*x`. `ParenthesisNode` unwraps; any other node type, including `ConditionalNode`, throws `ScalarBuildError`. `simplifyScalar` does not round-trip through a formula string; `a/(b/c)` and `a·c/b`, and `a·a` and `a²`, share keys after simplify. The pin is `functions/tests/scalar-node-bridge.test.ts`.

## Non-goals

- **`Tensor` is unit-free.** Rank-N tensors carry no SI dimensional analysis. Scalar SI inference (`inferScalarDimension`, `solveParameterDimensions`) applies to `ScalarNode` only. MathTS does not add a `UnitTensor` or tensor-level unit checking.
- **Numerical agreement is not proof.** `numericallyEquivalent` and a `consistent` verdict from sampled rows are evidence only; they do not certify symbolic equality.
- **No embedded foreign runtime for search.** Evolution stays in-tree (`searchScalars`, `enumerateScalars`, mutation operators). MathTS does not ship or require another language’s symbolic-regression package.

## Expression node extension

`createNode({ mathWithTransform })` returns a base class meant to be subclassed for custom AST nodes. A minimal child-plus-tag node exercises `isNode`, `forEach`, `map`, `traverse`, `clone`, `toJSON`, and `_toString`. The regression pin is `expression/tests/node-extension.test.ts`.

## Autodiff and heterogeneous forward ops

`Tape.record` stores input ids, an output size, and a backward closure. The forward op may run in pure JS, on a worker pool, or through a WASM kernel; the tape does not inspect that choice. The pin is `autograd/tests/ad-wasm-interop.test.ts`. `TapedTensor` already includes `matmul` (batched, rank at least 2) along with the elementwise ops.
