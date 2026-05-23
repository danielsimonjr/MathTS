# Migrating from mathjs v15 to MathTS

Audience: users who have an existing codebase that imports from `mathjs` v15.x
and want to move to `@danielsimonjr/mathts-*`.

## TL;DR

- The compat shim (`@danielsimonjr/mathts-compat`) provides `create(all)` so
  the most common mathjs patterns work unchanged: `math.add`, `math.complex`,
  `math.matrix`, `math.evaluate`, `math.simplify`, `math.det`, `math.eigs`.
- The typed-function API (`@danielsimonjr/mathts-functions`) is the recommended
  long-term surface: better tree-shaking, real TypeScript types, no factory
  indirection.
- `Float64Array` inputs to arithmetic functions are new accelerated paths that
  route through the worker pool; they return `Promise<Float64Array>`.
- `Int32Array` inputs to bitwise functions (`bitAnd`, `bitOr`, etc.) follow a
  three-tier dispatch: WASM above 65,536 elements, worker pool in between,
  in-process otherwise.
- `bigint` is a first-class scalar type for arithmetic and bitwise ops.

---

## Drop-in replacement (compat shim)

Install:

```bash
npm install @danielsimonjr/mathts-compat
```

Replace the import:

```ts
// Before
import { create, all } from 'mathjs';

// After
import { create, all } from '@danielsimonjr/mathts-compat';
```

The rest of the call sites are unchanged:

```ts
const math = create(all);

// Arithmetic
math.add(1, 2); // 3
math.multiply(3, 4); // 12
math.sqrt(2); // 1.4142...

// Complex numbers
math.complex(3, 4); // Complex { re: 3, im: 4 }
math.abs(math.complex(3, 4)); // 5

// Matrices
const A = math.matrix([
  [1, 2],
  [3, 4],
]); // DenseMatrix
math.det(A); // -2
math.eigs(A); // eigenvalues/eigenvectors

// String evaluation
math.evaluate('sin(pi/2)'); // 1
math.evaluate('x^2 + y', { x: 3, y: 4 }); // 13

// Symbolic / CAS
math.simplify('x + x'); // 2x
math.integrate('x^2', 'x'); // x^3/3
```

Behavior parity is the goal. If you find a divergence between mathjs v15
behavior and the compat shim, please file an issue — do not assume differences
are intentional without checking.

One confirmed divergence (see `CHANGELOG.md` audit section):
`divisorSigma(n, k)` — MathTS uses `(n, k=1)` where mathjs uses `(k, n)`
(both required). If your code calls `math.divisorSigma`, verify argument order.

---

## Switching to the typed-function API (recommended)

### Why switch

- **Tree-shaking**: importing `add` alone pulls in only its implementation,
  not the full factory activation chain.
- **TypeScript types**: each function has explicit overload signatures rather
  than the compat layer's `any`-heavy surface.
- **No factory indirection**: functions are plain exports, not factory-pattern
  closures.

### Install

```bash
npm install @danielsimonjr/mathts-core @danielsimonjr/mathts-functions
```

### Import sites

```ts
import {
  add,
  subtract,
  multiply,
  divide,
  sqrt,
  pow,
  abs,
  sin,
  cos,
  tan,
  log,
  exp,
} from '@danielsimonjr/mathts-functions';

import { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';
```

### Scalar dispatch (synchronous)

```ts
add(1, 2); // 3
add(new Complex(1, 2), new Complex(3, 4)); // Complex(4, 6)
add(new Fraction(1, 3), new Fraction(1, 6)); // Fraction(1/2)
add(BigNumber.parse('0.1'), BigNumber.parse('0.2')); // BigNumber('0.3')
add(1n, 2n); // 3n  (bigint)
```

### Float64Array overloads (async, worker pool)

```ts
const a = new Float64Array([1, 2, 3, 4]);
const b = new Float64Array([5, 6, 7, 8]);

const result = await add(a, b); // Float64Array([6, 8, 10, 12])
// routes through ComputePool; threshold controlled by thresholdByOp
```

The `Float64Array` overload is present on all element-wise arithmetic and
trigonometry functions. For most element-wise operations the default threshold
is `'never'` (in-process is faster at tested sizes). The pool will be used when
`ComputePool.shouldParallelize(n, op)` returns true.

### Int32Array bitwise overloads (async, three-tier)

```ts
import { bitAnd, bitOr, bitXor, bitNot, leftShift } from '@danielsimonjr/mathts-functions';

const a = new Int32Array([0b1100, 0b1010]);
const b = new Int32Array([0b1010, 0b0110]);

const r = await bitAnd(a, b); // Int32Array([0b1000, 0b0010])
```

Dispatch order for `Int32Array` inputs:

1. WASM (Rust or AS) when `length > 65_536`
2. Worker pool (`ComputePool`) above the standard elementwise threshold
3. In-process

---

## Breaking changes from mathjs v15

The following changes affect code that bypasses the compat shim and calls
MathTS packages directly.

### Functions that are now async

Several functions that were synchronous in mathjs are `async` in MathTS because
their internal matrix products are offloaded to the worker pool for large inputs.
Await them or they will return a `Promise` rather than a value.

| Function                   | Package            | Was sync in mathjs                 |
| -------------------------- | ------------------ | ---------------------------------- |
| `characteristicPolynomial` | `mathts-functions` | yes                                |
| `matrixPower`              | `mathts-functions` | yes                                |
| `matrixLog`                | `mathts-functions` | yes                                |
| `polarDecomposition`       | `mathts-functions` | yes                                |
| `jordanForm`               | `mathts-functions` | yes                                |
| `spectrogram`              | `mathts-functions` | yes                                |
| `fft2d`                    | `mathts-functions` | yes                                |
| `parallelIFFT`             | `mathts-functions` | yes (was parallel-prefix but sync) |

`rowReduce`, `matrixRank`, `cholesky`, and `hessenbergForm` are unchanged
(they do not internally multiply matrices).

### New typed overloads for scalar types

`bigint` is a first-class dispatch type for arithmetic and bitwise ops. Code
that passes `BigInt` values and expects them to be coerced to `number` will now
get a `bigint` result instead.

### Matrix constructor signature

`DenseMatrix` takes `(rows, cols, data?)` — not a single data argument.
If your code calls `new DenseMatrix(data)` it will throw "Matrix dimensions
must match". Use `DenseMatrix.fromArray(array)` for the convenience constructor.

### `m.get([row, col])` vs `m.get(row, col)`

mathjs uses `m.get([row, col])` (array index). MathTS `DenseMatrix` uses
`m.get(row, col)` (positional args). The compat shim normalizes this via
`MathJSDenseMatrix`.

### `math.bignumber` vs `BigNumber.parse`

```ts
// mathjs
const bn = math.bignumber('123.456');

// MathTS typed-function path
import { BigNumber } from '@danielsimonjr/mathts-core';
const bn = BigNumber.parse('123.456');

// MathTS compat path
const bn = math.bignumber('123.456'); // still works via compat shim
```

### `bn.toNumber()` alias

`BigNumber.prototype.toNumber()` is now available as an alias of `.valueOf()`.
Earlier MathTS versions only had `.valueOf()`.

### WebGPU operations are opt-in, f32 only

`gpuMatmul`, `gpuAdd`, `gpuTranspose`, `gpuScale` are new async exports in
`@danielsimonjr/mathts-functions`. They are not invoked by the regular
`multiply`/`add` dispatch path. If you need GPU acceleration, call them
explicitly. Be aware they compute in 32-bit float (WGSL has no f64).

---

## Not yet ported

The following mathjs v15 categories have no MathTS typed-function equivalent
yet. The compat shim covers them via the factory activation chain:

- **Units** (`math.unit`, `math.to`) — no dedicated typed layer; available
  through the compat factory scope.
- **Symbolic differentiation** (`math.derivative`) — the CAS layer in
  `functions/src/typed/cas.ts` provides `inverseLaplaceTransform`,
  `integrate`, `simplify`, `taylorSeries`, `groebnerBasis`, etc. but not
  a generic `derivative` function in the typed export. Use `math.derivative`
  via the compat shim.
- **Chaining API** (`math.chain(3).add(4).done()`) — not exposed on the
  typed layer; available via compat.

If a function you need is missing from the typed layer, the compat shim should
cover it. If neither covers it, please file an issue.

---

## Performance migration path

### When to use the parallel/WASM tier

The `Float64Array` overloads on arithmetic and trigonometry functions will
automatically use the worker pool when the input is large enough, based on the
per-op `thresholdByOp` map in `ComputePool`. You do not need to do anything
special — just pass `Float64Array` instead of `number[]`.

For most element-wise operations (add, subtract, multiply, sin, exp, …) the
default threshold is `'never'`, meaning the in-process path is used because
transfer overhead dominates at tested sizes. The parallel path wins for:

| Operation                  | Break-even threshold    |
| -------------------------- | ----------------------- |
| `matmul`                   | 64x64 (4,096 elements)  |
| `matrixPower`              | ~96x96 (9,216 elements) |
| `characteristicPolynomial` | ~96x96 (9,216 elements) |
| `spectrogram`              | 65,536 samples          |
| `erfc`                     | 100,000 elements        |
| `besselJ`                  | 1,000,000 elements      |

These defaults were measured on a noisy CI container (2026-05-23).
Run `npm run bench:parallel` on your target hardware to get representative
numbers, then override via `thresholdByOp`:

```ts
import { ComputePool } from '@danielsimonjr/mathts-parallel';

const pool = new ComputePool({
  thresholdElements: 50_000,
  thresholdByOp: {
    matmul: 1_024, // smaller threshold if you have faster workers
    erfc: 'never', // disable parallel erfc for this instance
  },
});
```

### Bitwise WASM threshold

For `Int32Array` bitwise operations, WASM activates at
`WASM_BITWISE_THRESHOLD = 65_536` elements. Below that, the worker pool is
used above the standard elementwise threshold, and in-process below it. You
cannot currently override the WASM threshold from userland without modifying
`functions/src/wasm/bitwise/wasm-bridge.ts`.

---

## Type-checking

If your existing code does:

```ts
import * as math from 'mathjs';
math.add(1, 2); // typed as any
```

switching to the typed-function path gives you precise IntelliSense and
compile-time overload resolution:

```ts
import { add } from '@danielsimonjr/mathts-functions';
// add(number, number): number
// add(Complex, Complex): Complex
// add(BigNumber, BigNumber): BigNumber
// add(Float64Array, Float64Array): Promise<Float64Array>
```

The compat shim (`@danielsimonjr/mathts-compat`) uses a broader `any`-heavy
surface for the `math.*` namespace because it must mirror mathjs's dynamic
factory system. For full IntelliSense, prefer the typed-function imports.

---

## Workbook and expression evaluation

`@danielsimonjr/mathts-expression` provides:

- `parse(expr)` — returns an AST (16 node types)
- `compileExpr(expr)` — returns a reusable compiled expression
- `evaluate(expr, scope?)` — parse + evaluate in one call
- `parser()` — stateful parser that retains scope across calls

`@danielsimonjr/mathts-workbook` provides a YAML-based reactive notebook
runtime (`.mtsw` files) with a CLI (`mtsw run <file>`). Cells evaluate via
`evaluate()` from `mathts-functions` with expression-sandbox access controls.

If you used `math.parse` / `math.compile` / `math.evaluate` directly, these
packages are the MathTS equivalents. Their own READMEs (when written) will
document the full API.

---

## See also

- [`CHANGELOG.md`](../CHANGELOG.md) — detailed record of all changes
- [`docs/Architecture/OVERVIEW.md`](./Architecture/OVERVIEW.md) — full package
  and metrics overview
- [`docs/reference/functions.md`](./reference/functions.md) — complete
  typed-function export reference with acceleration column
- [`docs/migration/api-diff.md`](./migration/api-diff.md) — API-level diff
  table (mathjs name vs MathTS equivalent)
