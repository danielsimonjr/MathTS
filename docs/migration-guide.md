# Migrating from mathjs v15 to MathTS

Audience: users who have an existing codebase that imports from `mathjs` v15.x
and want to move to `@danielsimonjr/mathts-*`.

## TL;DR

- The compat shim (`@danielsimonjr/mathts-compat`) provides `create(all)` so
  the most common mathjs patterns work unchanged: `math.add`, `math.complex`,
  `math.matrix`, `math.evaluate`, `math.simplify`, `math.det`, `math.eigs`.
- The typed-function API (`@danielsimonjr/mathts-functions`) is the recommended
  long-term surface: explicit TypeScript overloads and direct imports (not the
  `create(all)` / `math.*` style). The package still loads one bundled entry that
  activates the factory graph — do not expect per-symbol tree-shaking from that entry.
- The typed `Float64Array` and `Int32Array` overloads (arithmetic, trigonometry, bitwise,
  special functions, distributions) are synchronous: they return a typed array or a number.
  Only the `parallel*` exports (for example `parallelFFT`, `parallelStatSum`) are async.
  Use `ComputePool` or `parallelMap` from `@danielsimonjr/mathts-parallel` for worker threads.
- `Int32Array` bitwise inputs throw `RangeError` when the lengths differ. Bitwise WASM
  kernels are not enabled in `functions/src/wasm/policy.ts`, so the ops run in-process.
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

- **TypeScript types**: each function has explicit overload signatures rather
  than the compat layer's `any`-heavy surface.
- **Direct imports**: call `add`, `derivative`, `evaluate`, and the typed
  dispatch layer without `create(all)` / `math.*` indirection.
- **Single package entry**: `@danielsimonjr/mathts-functions` still builds one
  `dist/index.js` that activates the factory graph at load time, so
  `import { add } from '…/mathts-functions'` does not isolate a smaller
  runtime than importing the compat shim — choose typed imports for the API
  shape, not because the module is tree-shakeable today.

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

### Float64Array overloads (synchronous)

```ts
const a = new Float64Array([1, 2, 3, 4]);
const b = new Float64Array([5, 6, 7, 8]);

const result = add(a, b); // Float64Array([6, 8, 10, 12])
// runs in-thread; for worker threads use computePool.add(a, b)
```

The `Float64Array` overload is present on all element-wise arithmetic and
trigonometry functions, and it is synchronous. For worker threads, call the
`ComputePool` method or `parallelMap` yourself.

### Worker threads for special functions, distributions and FFTs

The `Float64Array` signatures of the special functions and the distributions are synchronous.
To run one of these functions on worker threads, get the kernel source from `workerKernel`.
Give the source to `computePool.applyKernel`:

```ts
import { computePool } from '@danielsimonjr/mathts-parallel';
import { besselK, workerKernel } from '@danielsimonjr/mathts-functions';

await computePool.initialize();
const { result } = await computePool.applyKernel(x, workerKernel('besselK', 1));
// result equals besselK(1, x) bit for bit
```

Give the scalar parameters in the order of the typed signature. Do not give the array. For
example, use `workerKernel('normalCDF', mu, sigma)` for `normalCDF(x, mu, sigma)`. For
`fft2d` and `spectrogram`, put the frames in one buffer and call `computePool.fftBatch`.
The pool uses worker threads when the array has 50 000 elements or more.

`gaussQuad` and `romberg` are synchronous. For the `workerCount` fan-out, call
`parallelGaussQuad` or `parallelRomberg` with the same options. Give a self-contained closure,
for example `(x) => Math.sin(x)`. A built-in function such as `Math.sin` cannot go to a worker.

### Int32Array bitwise overloads (synchronous)

```ts
import { bitAnd, bitOr, bitXor, bitNot, leftShift } from '@danielsimonjr/mathts-functions';

const a = new Int32Array([0b1100, 0b1010]);
const b = new Int32Array([0b1010, 0b0110]);

const r = bitAnd(a, b); // Int32Array([0b1000, 0b0010])
```

The typed bitwise functions are synchronous and return a new `Int32Array`. At or above
`WASM_BITWISE_THRESHOLD` (65 536 elements), the functions ask the WASM bridge first.
Because `wasmPolicyAllows` has no bitwise kernels (see `functions/src/wasm/policy.ts`),
the in-process JS loop runs. A length mismatch throws `RangeError`.

### Beyond mathjs: the scientific layer

The typed package is a superset of mathjs. `functions@0.72.0` closed a verified gap analysis
against SciPy/NumPy/SymPy/MATLAB (`docs/roadmap/GAP_ANALYSIS_2026-11-04.md`): 1,320 exports
in 27 categories, including weighted/robust statistics and effect sizes, extra distributions and
nonparametric tests, `erfinv`/`erfcx`/`dawson`, spherical Bessel and Wigner/Clebsch–Gordan
coefficients, tanh-sinh and Clenshaw–Curtis quadrature, `dblquad`/`tplquad`, differential
evolution and simulated annealing, modular arithmetic and Diophantine solvers, HNF/SNF/LLL,
Sturm real roots, Lomb–Scargle, `tf2ss`/`cont2discrete`, DTW, special matrices and
computational-geometry predicates. None of these exist in mathjs; browse them at
<https://danielsimonjr.com/MathTS/> or in [`docs/reference/functions.md`](./reference/functions.md).

---

## Breaking changes from mathjs v15

The following changes affect code that bypasses the compat shim and calls
MathTS packages directly.

### Functions that are async

`parallelIFFT` is `async` in MathTS (it was synchronous in mathjs). Await it, or it
returns a `Promise` rather than a value.

`characteristicPolynomial`, `matrixPower`, `matrixLog`, `polarDecomposition`,
`jordanForm`, `spectrogram` and `fft2d` were async in earlier MathTS releases. These functions are
synchronous again, as in mathjs. Code that awaits these functions still works. `.then` on
the return value does not work.

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

Everything mathjs v15 exposes now has a typed-function equivalent on
`@danielsimonjr/mathts-functions`, including the two categories that were
compat-only in earlier releases:

- **Units** — `unit`, `to`, `toBest`, `createUnit`, `splitUnit` are typed exports
  (`import { unit, to } from '@danielsimonjr/mathts-functions'`); the `Unit` class
  lives in `@danielsimonjr/mathts-core` (also re-exported by `@danielsimonjr/mathts-units`).
- **Chaining API** — `chain(3).add(4).done()` is a typed export (`chain`).

The compat shim still covers both through `math.unit` / `math.chain`.

Symbolic differentiation is on the typed surface: `import { derivative } from
'@danielsimonjr/mathts-functions'` (`derivative('x^2', 'x').toString()` →
`'2 * x'`). Same for `integrate`, `simplify`, and the rest of the CAS exports.

If a function you need is missing from the typed layer, the compat shim should
cover it. If neither covers it, please file an issue.

---

## Performance migration path

### When to use the parallel/WASM tier

The typed `Float64Array` overloads run on the calling thread. They do not use the worker
pool by themselves. To use workers, call `ComputePool` directly. For `computePool.matmul`,
the `matmul` entry of `thresholdByOp` (default 4,096 elements, 64x64) sets the size at which
the call goes to the workers. The `erfc`, `besselJ`, `spectrogram`, `fft2d`, `normalCDF`,
`matrixPower` and `characteristicPolynomial` entries remain in the type for compatibility,
but no function reads them.

A 2026-05-23 CI run found the `matmul` break-even at 64x64. A 2026-11-09 run on a
developer machine under load found no break-even up to 512x512. In that run,
`computePool.matmul` was 0.49-1.06x the speed of the synchronous `matmul`. The two were
about equal near 96x96 to 128x128 (3 runs).
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

`WASM_BITWISE_THRESHOLD` exists in `functions/src/wasm/bitwise/wasm-bridge.ts`, but
`wasmPolicyAllows` has no bitwise entries, so those kernels never run on WASM today.
Worker-pool bitwise ops (`bitAnd`, `bitOr`, …) are `'never'` in `DEFAULT_THRESHOLD_BY_OP`.
Treat `Int32Array` bitwise calls as in-process JS. `overrideWasmPolicy` exists in
`policy.ts` for tests but is not a public `functions` export; changing production
dispatch requires editing policy after re-measuring with
`tools/benchmark/wasm/opt-in.bench.ts`.

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
// add(Float64Array, Float64Array): Float64Array
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
- [Function reference site](https://danielsimonjr.com/MathTS/) — searchable per-function pages generated from `docs/reference/functions.md`
