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

## Pareto scores and model selection

Definitions match `functions/src/pareto-front.ts`.

**`scoreFront`** on the log scale walks the array in the order given. It does not sort and it does not drop rows. The first row scores `0`. Each later row with `loss > 0` scores `-Math.log(loss / previousLoss) / (complexity - previousComplexity)`. `loss <= 0` scores `+Infinity`. A zero complexity gap is IEEE division (`NaN` or an infinity); there is no special case. On the linear scale every score is `null`, and a zero loss does not become `+Infinity`. Any other `lossScale` throws `ParetoFrontError`.

**`selectFrontModel`** defaults to `best` with factor `1.5`. `accuracy` is the minimum loss. `score` is the maximum score. `best` keeps rows with `loss <= 1.5 * min(loss)` and then takes the maximum score. If every score is `null`, `score` and `best` both fall back to `accuracy`. A mix of `null` and numeric scores throws. Ties: lower complexity, then the earlier input index. `NaN` is worse than every other score, including `-Infinity`. The return value is the same object as the chosen row.

## Mutation weights

`DEFAULT_MUTATION_WEIGHTS` in `functions/src/scalar-mutate.ts` keeps these numbers. Draw order is `MUTATION_DRAW_ORDER`, the same as the object key order. Optimize and backsolve are omitted (weight 0).

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

`searchScalars` defaults in `functions/src/scalar-search.ts`: `populationSize` 27, `tournamentSize` 15, `tournamentP` 0.982, `fractionReplaced` 0.00036, annealing `initialTemperature` 3.17 decaying by 0.995 each generation, `adaptiveParsimonyScaling` 1040, migrant pool 12, frequency window 100000.

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
