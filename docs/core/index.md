# Core Concepts

MathTS is a parallel-first TypeScript math library. It exposes numeric types, typed-function dispatch, a factory registry, and matrix backends as separate npm packages.

## Packages

| Package | Description |
|---|---|
| `@danielsimonjr/mathts-core` | Types, typed-function integration, factory registry |
| `@danielsimonjr/mathts-matrix` | DenseMatrix, SparseMatrix, JS/WASM/GPU backends |
| `@danielsimonjr/mathts-functions` | Math functions via typed dispatch |
| `@danielsimonjr/mathts-parallel` | ComputePool, parallel array operations |
| `@danielsimonjr/mathts-workbook` | `.mtsw` reactive notebook runtime + CLI |
| `@danielsimonjr/mathts-compat` | mathjs-compatible `create(all)` shim |

## Usage Patterns

### Direct imports (recommended)

```typescript
import { add, multiply } from '@danielsimonjr/mathts-functions';
import { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

add(1, 2);                                     // 3
add(new Complex(1, 2), new Complex(3, 4));     // Complex(4, 6)
multiply(new Fraction(1, 2), new Fraction(2, 3)); // Fraction(1, 3)
```

### mathjs-compatible API

For projects migrating from mathjs, use the compat shim:

```typescript
import { create, all } from '@danielsimonjr/mathts-compat';

const math = create(all);
math.add(1, 2);               // 3
math.sqrt(new math.Complex(-1, 0));  // Complex(0, 1)
```

### Parallel operations

All array-typed inputs dispatch automatically to worker threads:

```typescript
import { add, sin } from '@danielsimonjr/mathts-functions';

const a = new Float64Array([1, 2, 3, 4]);
const b = new Float64Array([10, 20, 30, 40]);

const result = await add(a, b);   // runs in parallel workers
const sines  = await sin(a);      // parallel sin over array
```

## Core Concepts

- **[Configuration](configuration.md)** — `DEFAULT_CONFIG`, number types, precision, matrix defaults
- **[Extension](extension.md)** — Add custom types and functions via `TypeRegistry` and `mathTyped`
- **[Serialization](serialization.md)** — JSON round-trip for Complex, Fraction, BigNumber, DenseMatrix

## Key Differences from mathjs

| mathjs | MathTS |
|---|---|
| `math.config({ number: 'BigNumber' })` | Import `DEFAULT_CONFIG` and override at startup |
| `math.import(myFn)` | Direct ESM import; register with `mathTyped` |
| `math.chain(x).add(1).done()` | Not yet available — use direct calls |
| Single-package install | Monorepo — install only what you need |
| CommonJS + ESM | ESM-only (`"type": "module"`) |

## Type System

MathTS uses typed-function for runtime dispatch. The same function name handles all numeric types:

```typescript
// One function, four numeric types
add(1, 2)                         // number → number
add(1n, 2n)                       // bigint → bigint
add(new Complex(1,2), ...)        // Complex → Complex
add(new Fraction(1,2), ...)       // Fraction → Fraction
await add(Float64Array, ...)      // async parallel array
```

See the [Reference](../reference/index.md) for a full list of classes, constants, and functions.
