# Core Concepts

MathTS is a parallel-first TypeScript math library. It exposes numeric types, typed-function dispatch, a factory registry, and matrix backends as separate npm packages.

## Packages

The monorepo publishes **24** npm workspace packages. Commonly used entry points:

| Package                            | Description                                         |
| ---------------------------------- | --------------------------------------------------- |
| `@danielsimonjr/mathts-core`       | Types, typed-function integration, factory registry |
| `@danielsimonjr/mathts-matrix`     | DenseMatrix, SparseMatrix, JS/WASM/GPU backends     |
| `@danielsimonjr/mathts-tensor`     | Rank-N dense Tensor (Float64Array-backed)           |
| `@danielsimonjr/mathts-autograd`   | Forward + reverse-mode autodiff over Tensor         |
| `@danielsimonjr/mathts-functions`  | Math functions via typed dispatch                   |
| `@danielsimonjr/mathts-expression` | Expression parser, AST, compiler                    |
| `@danielsimonjr/mathts-parallel`   | ComputePool, parallel array operations              |
| `@danielsimonjr/mathts-workbook`   | `.mtsw` reactive notebook runtime + CLI             |
| `@danielsimonjr/mathts-compat`     | mathjs-compatible `create(all)` shim                |
| `@danielsimonjr/mathts-numbers`    | Re-export of core numeric types                     |
| `@danielsimonjr/mathts-units`      | Re-export of core `Unit` and unit registry          |

Focused re-export packages (`parser`, `ast`, `evaluator`, `linalg`, `arithmetic`, `trigonometry`, `statistics`, `signal`) wrap a single implementation package. Lower-level pieces include `@danielsimonjr/mathts-gpu`, `@danielsimonjr/mathts-plot`, `@danielsimonjr/mathts-wasm` (AssemblyScript build), `@danielsimonjr/mathts-typed-function` (helper utilities), and `@danielsimonjr/mathts-workerpool` (`MathWorkerPool` wrapper). Core and functions depend on the published `typed-function` and `workerpool` forks via npm aliases, not via those workspace helper packages.

## Usage Patterns

### Direct imports (recommended)

```typescript
import { add, multiply, chain } from '@danielsimonjr/mathts-functions';
import { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

add(1, 2); // 3
add(new Complex(1, 2), new Complex(3, 4)); // Complex(4, 6)
multiply(new Fraction(1, 2), new Fraction(2, 3)); // Fraction(1, 3)
chain(3).add(4).multiply(2).done(); // 14
```

### mathjs-compatible API

For projects migrating from mathjs, use the compat shim:

```typescript
import { create, all } from '@danielsimonjr/mathts-compat';
import { Complex } from '@danielsimonjr/mathts-core';

const math = create(all);
math.add(1, 2); // 3
math.sqrt(math.complex(-1)).toString(); // 'i'
math.sqrt(new Complex(-1, 0)).toString(); // 'i' — use core Complex, not math.Complex
math.chain(3).add(4).multiply(2).done(); // 14
```

### Typed arrays and workers

`Float64Array` inputs use async typed-function signatures and return a `Promise`. Element-wise ops such as `add` and `sin` are pinned to **sequential** execution at practical sizes (`ComputePool` thresholds `'never'` for those ops), so small arrays still run on the main thread:

```typescript
import { add, sin } from '@danielsimonjr/mathts-functions';

const a = new Float64Array([1, 2, 3, 4]);
const b = new Float64Array([10, 20, 30, 40]);

const result = await add(a, b); // Float64Array [11, 22, 33, 44]
const sines = await sin(a); // Promise; sequential for this size
```

Larger workloads use measured per-op thresholds in `@danielsimonjr/mathts-parallel` (not automatic for every array op).

## Core Concepts

- **[Configuration](configuration.md)** — `DEFAULT_CONFIG`, number types, precision, matrix defaults
- **[Extension](extension.md)** — Add custom types and functions via `TypeRegistry` and `mathTyped`
- **[Serialization](serialization.md)** — JSON round-trip for Complex, Fraction, BigNumber

## Key Differences from mathjs

| mathjs                                 | MathTS                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `math.config({ number: 'BigNumber' })` | `create(all, config)` or internal `DEFAULT_CONFIG` via `./internal`      |
| `math.import(myFn)`                    | Direct ESM import; register with `mathTyped`                             |
| `math.chain(x).add(1).done()`          | `chain` from `@danielsimonjr/mathts-functions` or `math.chain` on compat |
| Single-package install                 | Monorepo — install only what you need                                    |
| CommonJS + ESM                         | ESM-only (`"type": "module"`)                                            |

## Type System

MathTS uses typed-function for runtime dispatch. The same function name handles all numeric types:

```typescript
// One function, four numeric types
add(1, 2)                         // number → number
add(1n, 2n)                       // bigint → bigint
add(new Complex(1,2), ...)        // Complex → Complex
add(new Fraction(1,2), ...)       // Fraction → Fraction
await add(Float64Array, Float64Array) // async; Promise<Float64Array>
```

See the [Reference](../reference/index.md) for a full list of classes, constants, and functions.
