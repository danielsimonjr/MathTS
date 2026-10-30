# @danielsimonjr/mathts-functions

Math functions for [MathTS](https://github.com/danielsimonjr/mathts).

The mathematical function library for MathTS — arithmetic, trigonometry, algebra, statistics, signal processing, and more — dispatched polymorphically via typed-function across number / Complex / Fraction / BigNumber / Matrix.

## Install

```sh
npm install @danielsimonjr/mathts-functions
```

## What it provides

- Hundreds of typed functions (`add`, `sin`, `svd`-aware ops, `parallelFFT`, …).
- A wired `parse` / `evaluate` against the full activated math scope.
- `scalar` / `evaluateScalar` — evaluate a typed scalar tree (`+ - * / ^`, `ln` → natural `log`, `log` → `log10`, and the other scalar calls). A formula string is rejected. `compileScalar` evaluates the same tree over `Float64Array` columns and marks a row invalid where `evaluateScalar` would throw. `compileScalarGradient` reuses that tape to return exact ∂f/∂parameter for each row. `fitScalarParameters` fits those constants to data via `levenbergMarquardt`, `bfgs`, or `nelderMead` (PySR-style restarts and optional bounds).
- `levenbergMarquardt` accepts an optional analytic `jacobian` in `LMOptions`; the default remains forward-difference `numericJacobian`. Stiff `solveODE`, `solveDAE`, and `solveBVP` use the same helper (forward differences; ODE/DAE use `step: { rel: 1e-7, floor: 1e-8 }`, BVP shooting uses `h: 1e-7`).
- `minimize` (Nelder–Mead) delegates to `nelderMead` with an absolute simplex step; `nelderMead` keeps relative defaults for `fitScalarParameters`.
- `scalarToNode` / `nodeToScalar` / `simplifyScalar` / `scalarToTex` — convert between scalar trees and wired expression nodes (no formula string); `simplifyScalar` uses the same `simplify` as the expression language.
- `paretoFront` / `scoreFront` / `selectFrontModel` — hall of fame per complexity, PySR log-loss scores, and `accuracy` / `score` / `best` selection.
- `frontToLatexTable` / `frontToJson` — export a scored front (M15). `frontToLatexTable(scored, { precision })` writes one `tabular` with columns complexity, loss, score, equation and a header row; loss and score are `toPrecision(precision)` text (default 6, an integer from 1 to 100), a `null` score (the linear loss scale) is an empty cell, and each equation cell is `scalarToTex` inside `$…$` because a `tabular` cell is text mode and `\cdot`, `\frac` and `\sin` need math mode (an infinite score is `$\infty$`). `frontToJson(scored)` returns `{ schemaVersion: 1, rows: [{ complexity, loss, score, key, tex }] }` with `key` = `scalarCanonicalKey(item)` and `tex` = `scalarToTex(item)`; a non-finite `loss` or `score` is the string `'Infinity'`, `'-Infinity'` or `'NaN'`, so the report survives `JSON.stringify` and `JSON.parse` (an exact fit scores `Infinity`, and `JSON` would turn that into the linear scale's `null`). A non-finite complexity throws `RangeError`.
- `inferScalarDimension` / `solveParameterDimensions` — SI dimension of a scalar tree with exact `Fraction` exponents on `SiDimensionVector` (`[L,M,T,I,Θ,N,J]`), or one of four named violations with the path of the failing node (`add-mismatch`, `transcendental-arg-not-dimensionless`, `non-literal-exponent-on-dimensional-base`, `unknown-symbol`). `solveParameterDimensions` solves the dimension of each unknown parameter (PySR's `[⋅]` constants) from the equations the tree implies (`+` operands agree, transcendental arguments are dimensionless, the root equals `target`), exactly via `rationalNullspace`; it returns `solved`, `underdetermined`, or `inconsistent`.
- `weightedMutation` / `mutateConstant` / `mutateOperator` / `mutateFeature` / `swapOperands` / `addNode` / `insertNode` / `deleteNode` / `rotateTree` / `randomizeTree` / `simplifyConstants` / `identityMutation` / `crossoverSubtrees` — PySR-style variation of a scalar tree (M12). Each takes `(node, rng, ctx)` with a `SeededRng` and `ctx = { grammar, perturbationFactor, temperature }`, never changes its input, and returns `null` when the mutation does not apply or the result fails `scalarGrammarAccepts`. `weightedMutation(weights?)` picks one operator by `DEFAULT_MUTATION_WEIGHTS` (PySR's table, summing to 8.512392). The identity operator is named `identityMutation` because `identity` is the matrix identity export of this package; its weight key is still `identity`.
- `searchScalars` — PySR-style symbolic regression over scalar trees (M13a), an async generator of `SearchProgress` that returns a `ScalarSearchResult`. One population evolves by tournament selection and `weightedMutation`; it starts from `seeds` plus the smallest trees of `enumerateScalars`, refits `parameters` of a tree with probability `optimizeProbability` (`fitScalarParameters`), and keeps a hall of fame whose Pareto front is reported through `paretoFront` / `scoreFront` (`modelSelection` adds `selectFrontModel`). Loss is the sum of squared errors; a tree that is invalid on any row has loss `Infinity` and never reaches the front. `fittedParameters` gives the values behind each front row's loss. `options.rng` is never advanced, so one seed gives one result. `maxEvaluations` caps evaluations, initial population included. With `populations > 1` (M13b) independent islands (`rng.fork('island:' + index)`) evolve side by side; after every generation each island's worst trees are replaced by copies of other islands' best (`fractionReplaced`, default 0.00036), the constant-perturbation temperature cools from `initialTemperature` (3.17) by 0.995 per generation (`annealing`), and tournaments rank by `loss * exp(adaptiveParsimonyScaling * share)` where `share` is how common the tree's size is (`adaptiveParsimony`, scaling 1040). Annealing and adaptive parsimony default to on only for several islands, so `populations: 1` is the M13a search to the last bit. `parallel: { timeoutMs?, pool? }` (M14) scores each generation's trees on worker threads once `observed` has 100 or more rows (`scalar-batch.worker.js`, a second tsdown entry loaded by URL); parameter refits and every random draw stay on the caller thread, so a parallel run equals the serial run for the same seed, bit for bit. `timeoutMs` (default 30000, must be positive) bounds every worker call, queueing included. A `pool` you pass is yours to terminate; otherwise the search starts one when it first needs it and terminates it when the generator ends or is closed. The 100-row floor comes from the M3 benchmark (the tape against the per-row interpreter, on the caller thread); no worker round trip was timed, so parallel is opt-in and carries no speed-up claim.
- `numericallyEquivalent` — sample two scalar trees with `createSeededRng`, evaluate via `compileScalar`, compare with core `nearlyEqual`. **Numerical agreement alone never proves symbolic equivalence;** a `consistent` verdict is evidence, not proof.

```ts
import { createSeededRng } from '@danielsimonjr/mathts-core';
import {
  compileScalar,
  compileScalarGradient,
  fitScalarParameters,
  numericallyEquivalent,
  frontToJson,
  frontToLatexTable,
  paretoFront,
  scoreFront,
  selectFrontModel,
  scalar,
  simplifyScalar,
  scalarToTex,
} from '@danielsimonjr/mathts-functions';

const node = scalar.op('*', [scalar.symbol('x'), scalar.symbol('x')]);
const linear = scalar.op('+', [
  scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]),
  scalar.symbol('b'),
]);
const gradCompiled = compileScalarGradient(linear, { variables: ['x'], parameters: ['a', 'b'] });
const { values, grad } = gradCompiled.evaluate([new Float64Array([3])], [2, -1]);
values[0]; // 5
[...grad]; // 3, 1 — ∂/∂a = x, ∂/∂b = 1
const quotient = scalar.op('/', [
  scalar.symbol('a'),
  scalar.op('/', [scalar.symbol('b'), scalar.symbol('c')]),
]);
scalarToTex(simplifyScalar(quotient)); // \frac{ a\cdot c}{ b}

const compiled = compileScalar(node, { variables: ['x'] });
compiled.evaluate([new Float64Array([2, 3])]).values; // Float64Array [4, 9]

const slope = scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]);
const xCol = new Float64Array([1, 2, 3]);
const yCol = new Float64Array([2, 4, 6]);
fitScalarParameters(slope, [xCol], yCol, ['x'], { parameters: ['a'], restarts: 0 }).parameters[0]; // 2

const front = paretoFront([
  { loss: 0.5, complexity: 1, item: 'x' },
  { loss: 0.1, complexity: 3, item: 'x^3' },
]);
selectFrontModel(scoreFront(front), 'best').item; // 'x^3'
frontToJson(scoreFront([{ loss: 0.5, complexity: 1, item: scalar.symbol('x') }])).rows[0]!.key; // '{"k":"s","v":"x"}'

const rng = createSeededRng(1);
const id = scalar.op('+', [
  scalar.op('^', [scalar.call('sin', scalar.symbol('x')), scalar.number(2)]),
  scalar.op('^', [scalar.call('cos', scalar.symbol('x')), scalar.number(2)]),
]);
numericallyEquivalent(id, scalar.number(1), { domain: { x: [0, 1] }, rng }).verdict; // 'consistent' — evidence, not proof
```

- Per-domain focused entry points are also published: `@danielsimonjr/mathts-{arithmetic,trigonometry,statistics,signal}`.

## License

MIT (c) Daniel Simon Jr.
