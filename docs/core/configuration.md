# Configuration

MathTS exposes **two** configuration objects with the same export name `DEFAULT_CONFIG` on different entry points. They are intentionally not merged.

| Entry                                 | Type                                   | Role                                                                      |
| ------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| `@danielsimonjr/mathts-core`          | `MathTSConfig`                         | Factory / backend / parallel defaults for direct MathTS use               |
| `@danielsimonjr/mathts-core/internal` | `ConfigOptions` (alias `MathJsConfig`) | mathjs-shaped settings for expression evaluation, comparisons, and compat |

## Factory defaults (`MathTSConfig`)

Imported from the main package:

```typescript
import { DEFAULT_CONFIG } from '@danielsimonjr/mathts-core';
import type { MathTSConfig } from '@danielsimonjr/mathts-core';

console.log(DEFAULT_CONFIG);
// {
//   precision: 64,
//   matrix: 'Matrix',
//   number: 'number',
//   randomSeed: null,
//   epsilon: 1e-12,
//   preferredBackend: 'auto',
//   wasmThreshold: 1000,
//   gpuThreshold: 100000,
//   parallelEnabled: true,
//   parallelThreshold: 50000
// }
```

### Fields

| Field                            | Description                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `precision`                      | Default significant digits for `BigNumber` (default `64`)                                                    |
| `matrix`                         | Default matrix output: `'Matrix'` (DenseMatrix) or `'Array'`                                                 |
| `number`                         | Default numeric type for factories: `'number'`, `'BigNumber'`, or `'Fraction'` (not `'bigint'` on this type) |
| `randomSeed`                     | RNG seed string, or `null` for non-deterministic seeding                                                     |
| `epsilon`                        | Tolerance on this config object (separate from comparison tolerances below)                                  |
| `preferredBackend`               | Matrix backend hint: `'auto'`, `'js'`, `'wasm'`, or `'gpu'`                                                  |
| `wasmThreshold` / `gpuThreshold` | Element-count hints for backend selection                                                                    |
| `parallelEnabled`                | Whether parallel infrastructure may run                                                                      |
| `parallelThreshold`              | Default element count before parallel dispatch is considered                                                 |

`BigNumber.config({ precision: n })` still adjusts global `BigNumber` precision independently.

## Internal / mathjs-shaped defaults (`ConfigOptions`)

Expression parsing, `evaluate`, and comparison helpers such as `equal` read **`relTol` / `absTol`** from the internal config:

```typescript
import { DEFAULT_CONFIG } from '@danielsimonjr/mathts-core/internal';
import type { ConfigOptions } from '@danielsimonjr/mathts-core/internal';

console.log(DEFAULT_CONFIG);
// {
//   relTol: 1e-12,
//   absTol: 1e-15,
//   matrix: 'Matrix',
//   number: 'number',
//   numberFallback: 'number',
//   precision: 64,
//   predictable: false,
//   randomSeed: null,
//   legacySubset: false
// }
```

### `number`

| Value         | Description                            |
| ------------- | -------------------------------------- |
| `'number'`    | JavaScript `number` (default)          |
| `'BigNumber'` | Arbitrary-precision decimal            |
| `'bigint'`    | Native `bigint` (internal config only) |
| `'Fraction'`  | Exact rational                         |

### `numberFallback`

When `number` is `'bigint'` and a value is not an integer, fall back to `'number'` or `'BigNumber'`.

### `relTol` / `absTol`

Used by `equal` and related comparisons in `@danielsimonjr/mathts-core` (reads this internal object, not `MathTSConfig.epsilon`).

### `predictable`

When `true`, output types depend only on input types. When `false` (default), `sqrt(-4)` via the functions/compat stack can return a `Complex` (e.g. `"2i"`) instead of `NaN`.

### `legacySubset`

Legacy matrix subset behavior (mathjs v11 and earlier). Default: `false`.

## Applying configuration

### Compat `create` / `math.config`

Each mathjs-compatible instance owns its own config object. `create(all, config)` and
`math.config(partial)` update **that instance only**; they do not write the process-wide
`DEFAULT_CONFIG` that bare imports from `@danielsimonjr/mathts-functions` read via
`config()` / `evaluate`.

```typescript
import { create, all } from '@danielsimonjr/mathts-compat';
import { evaluate } from '@danielsimonjr/mathts-functions';

const math = create(all, {
  number: 'BigNumber',
  precision: 20,
  predictable: true,
});

math.config().number; // 'BigNumber'
evaluate('e ^ 2'); // still a JS number (singleton unchanged)
```

Instance methods run under a synchronous config overlay (`runWithConfig` in
`@danielsimonjr/mathts-functions`). Overlays are stack-based and do not survive
`await`; nested barrel calls from inside an instance method see the instance overlay
until that call returns.

### Direct imports

Override `MathTSConfig` at startup by spreading `DEFAULT_CONFIG` from the main entry, or set per-type options (`BigNumber.config`, and so on).

## `./internal` subpath

`@danielsimonjr/mathts-core/internal` also exports tree helpers (`deepMap`, `deepForEach`, `reduce`), formatting (`format`, `formatGeneric`, `formatBigNumber`), factory utilities (`factory`, `sortFactories`), error types (`DimensionError`, `IndexError`, `MathjsError`), safe property accessors, and WASM manifest helpers. Prefer the main entry for public types and `mathTyped`; use `./internal` only when you need these mathjs-compat or tooling surfaces.

Those collection helpers accept nested arrays as well as matrices: `deepMap` / `deepForEach` recurse into nested structure, and `reduce` of a one-dimensional array along dimension 0 returns a scalar (not a one-element array). With `skipZeros: true`, `deepMap` leaves numeric zeros as the original value.

`clone`, `extend`, `mapObject`, and `deepFlatten` on `./internal` skip own keys whose names sit on `Object.prototype` (the same rule `deepExtend` already used). Polluting keys are omitted from copies rather than assigned.

## TypeScript types

```typescript
import type { MathTSConfig } from '@danielsimonjr/mathts-core';
import type { ConfigOptions, MathJsConfig } from '@danielsimonjr/mathts-core/internal';
```

`ConfigOptions` and `MathJsConfig` are not exported from the main `.` entry.
