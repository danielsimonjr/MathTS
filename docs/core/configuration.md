# Configuration

MathTS configuration is managed through the `DEFAULT_CONFIG` object exported from `@danielsimonjr/mathts-core`. Unlike mathjs, there is no runtime `math.config()` call — configuration is applied at import time or passed explicitly to factory functions.

## Reading the Defaults

```typescript
import { DEFAULT_CONFIG } from '@danielsimonjr/mathts-core';

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

## Configuration Options

### `number`

The default numeric type used when parsing string expressions.

| Value | Description |
|---|---|
| `'number'` | JavaScript `number` (default) |
| `'BigNumber'` | Arbitrary-precision via `BigNumber` class |
| `'bigint'` | Native JavaScript `bigint` |
| `'Fraction'` | Exact rational via `Fraction` class |

For most functions, the output type is inferred from the input type — `add(1, 2)` always returns a `number`. The `number` setting affects expression evaluation and factory-created instances.

### `numberFallback`

When `number` is `'bigint'` and a value cannot be represented (e.g. `2.3`), fall back to this type.

- `'number'` (default)
- `'BigNumber'`

### `matrix`

Default matrix output type when no matrix input is present.

- `'Matrix'` (default) — returns a `DenseMatrix`
- `'Array'` — returns a plain JavaScript array

### `precision`

Number of significant digits for `BigNumber` operations. Default: `64`.

```typescript
import { BigNumber } from '@danielsimonjr/mathts-core';

BigNumber.config({ precision: 128 });  // configure globally
const x = new BigNumber('1.23456789012345678901234567890');
```

### `relTol` / `absTol`

Tolerances used by comparison functions (`equal`, `smallerEq`, etc.).

- `relTol` — minimum relative difference. Default: `1e-12`.
- `absTol` — minimum absolute difference. Default: `1e-15`.

### `predictable`

When `true`, output types depend only on input types (never on values). When `false` (default), `sqrt(-4)` returns `Complex(0, 2)` rather than `NaN`.

### `randomSeed`

Seed for pseudo-random number generation. `null` = randomly seeded each run.

### `legacySubset`

Legacy matrix subset behavior (mathjs v11 and earlier). Default: `false`.

## Applying Custom Configuration

There is no global setter. Pass a config object to the compat factory:

```typescript
import { create, all } from '@danielsimonjr/mathts-compat';

const math = create(all, {
  number: 'BigNumber',
  precision: 128,
  predictable: true
});
```

For direct imports, configure per-type:

```typescript
import { BigNumber } from '@danielsimonjr/mathts-core';

// Configure BigNumber precision globally
BigNumber.config({ precision: 128 });
```

## TypeScript Type

```typescript
import type { ConfigOptions } from '@danielsimonjr/mathts-core';
```

`ConfigOptions` (also exported as `MathJsConfig` for compatibility) contains all fields above as required properties.
