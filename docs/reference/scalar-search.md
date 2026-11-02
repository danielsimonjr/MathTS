# Scalar search reference

MathTS ships a **ScalarNode** toolkit: build trees with `createScalarBuilder` (`number`, `symbol`, `op`, `call`). `ln` lowers to natural `log`; `log` lowers to `log10`. A formula string is rejected at the builder. This page records the public surface, Pareto scoring and selection, mutation weights, non-goals, and two extension pins (expression nodes and autodiff).

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

`searchScalars` is the shipped evolutionary driver over `ScalarNode` trees; it is not extended here.

## Pareto scores and model selection

Definitions match `functions/src/pareto-front.ts`.

**`scoreFront`** on the log scale walks the array in the order given. It does not sort and it does not drop rows. The first row scores `0`. Each later row with `loss > 0` scores `-Math.log(loss / previousLoss) / (complexity - previousComplexity)`. `loss <= 0` scores `+Infinity`. A zero complexity gap is IEEE division (`NaN` or an infinity); there is no special case. On the linear scale every score is `null`, and a zero loss does not become `+Infinity`. Any other `lossScale` throws `ParetoFrontError`.

**`selectFrontModel`** defaults to `best` with factor `1.5`. `accuracy` is the minimum loss. `score` is the maximum score. `best` keeps rows with `loss <= 1.5 * min(loss)` and then takes the maximum score. If every score is `null`, `score` and `best` both fall back to `accuracy`. A mix of `null` and numeric scores throws. Ties: lower complexity, then the earlier input index. `NaN` is worse than every other score, including `-Infinity`. The return value is the same object as the chosen row.

## Mutation weights

Default mutation weights and draw order live in `functions/src/scalar-mutate.ts` as `DEFAULT_MUTATION_WEIGHTS`. The negation probability on perturbed constants is `MUTATE_CONSTANT_NEGATE_PROBABILITY` (`0.00743`). See that module for the numeric table and operator order.

`searchScalars` documents its own defaults in `functions/src/scalar-search.ts` (population size, tournament parameters, `fractionReplaced`, annealing with `initialTemperature` 3.17, adaptive-parsimony scaling 1040, migrant cap, frequency window, and related options).

## Non-goals

- **`Tensor` is unit-free.** Rank-N tensors carry no SI dimensional analysis. Scalar SI inference (`inferScalarDimension`, `solveParameterDimensions`) applies to `ScalarNode` only. MathTS does not add a `UnitTensor` or tensor-level unit checking.
- **Numerical agreement is not proof.** `numericallyEquivalent` and a `consistent` verdict from sampled rows are evidence only; they do not certify symbolic equality.
- **No embedded foreign runtime for search.** Evolution stays in-tree (`searchScalars`, `enumerateScalars`, mutation operators). MathTS does not ship or require another language’s symbolic-regression package.

## Expression node extension

`createNode({ mathWithTransform })` returns a base class meant to be subclassed for custom AST nodes. A minimal child-plus-tag node exercises `isNode`, `forEach`, `map`, `traverse`, `clone`, `toJSON`, and `_toString`. The regression pin is `expression/tests/node-extension.test.ts`.

## Autodiff and heterogeneous forward ops

`Tape.record` stores input ids, an output size, and a backward closure. The forward op may run in pure JS, on a worker pool, or through a WASM kernel; the tape does not inspect that choice. The pin is `autograd/tests/ad-wasm-interop.test.ts`. `TapedTensor` already includes `matmul` (batched, rank at least 2) along with the elementwise ops.
