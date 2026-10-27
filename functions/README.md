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
- `scalar` / `evaluateScalar` — evaluate a typed scalar tree (`+ - * / ^`, `ln` → natural `log`, `log` → `log10`, and the other scalar calls). A formula string is rejected. `compileScalar` evaluates the same tree over `Float64Array` columns and marks a row invalid where `evaluateScalar` would throw.
- `scalarToNode` / `nodeToScalar` / `simplifyScalar` / `scalarToTex` — convert between scalar trees and wired expression nodes (no formula string); `simplifyScalar` uses the same `simplify` as the expression language.
- `paretoFront` / `scoreFront` / `selectFrontModel` — hall of fame per complexity, PySR log-loss scores, and `accuracy` / `score` / `best` selection.
- `numericallyEquivalent` — sample two scalar trees with `createSeededRng`, evaluate via `compileScalar`, compare with core `nearlyEqual`. **Numerical agreement alone never proves symbolic equivalence;** a `consistent` verdict is evidence, not proof.

```ts
import { createSeededRng } from '@danielsimonjr/mathts-core';
import {
  compileScalar,
  numericallyEquivalent,
  paretoFront,
  scoreFront,
  selectFrontModel,
  scalar,
  simplifyScalar,
  scalarToTex,
} from '@danielsimonjr/mathts-functions';

const node = scalar.op('*', [scalar.symbol('x'), scalar.symbol('x')]);
const quotient = scalar.op('/', [
  scalar.symbol('a'),
  scalar.op('/', [scalar.symbol('b'), scalar.symbol('c')]),
]);
scalarToTex(simplifyScalar(quotient)); // \frac{ a\cdot c}{ b}

const compiled = compileScalar(node, { variables: ['x'] });
compiled.evaluate([new Float64Array([2, 3])]).values; // Float64Array [4, 9]

const front = paretoFront([
  { loss: 0.5, complexity: 1, item: 'x' },
  { loss: 0.1, complexity: 3, item: 'x^3' },
]);
selectFrontModel(scoreFront(front), 'best').item; // 'x^3'

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
