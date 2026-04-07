# Data Types

MathTS supports multiple data types for numeric computation. Native JavaScript types work alongside MathTS-specific types, and most operations accept mixed inputs automatically.

The supported data types are:

- [Number](numbers.md) — JavaScript floating-point (64-bit)
- [BigNumber](bignumbers.md) — arbitrary-precision decimal arithmetic
- [Complex](complex_numbers.md) — complex numbers with real and imaginary parts
- [Fraction](fractions.md) — exact rational arithmetic using bigint
- [Matrix](matrices.md) — DenseMatrix and SparseMatrix with JS/WASM/GPU backends
- [BigInt](bigints.md) — native JavaScript `bigint` for large integers

## Imports

All core numeric types are exported from `@danielsimonjr/mathts-core`:

```ts
import {
  Complex,
  Fraction,
  BigNumber,
} from '@danielsimonjr/mathts-core';
```

Matrix types are in `@danielsimonjr/mathts-matrix`:

```ts
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
```

Math functions (arithmetic, trig, statistics, FFT) are in `@danielsimonjr/mathts-functions`:

```ts
import { add, multiply, sin, fft } from '@danielsimonjr/mathts-functions';
```

## Quick Examples

```ts
import { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

// JavaScript numbers (fastest, ~16 significant digits)
0.1 + 0.2                             // 0.30000000000000004

// BigNumber (arbitrary precision)
BigNumber.parse('0.1').add('0.2')     // BigNumber 0.3 (exact)

// Complex numbers
new Complex(3, 4).abs()               // 5 (Pythagorean triple)

// Exact fractions
new Fraction(1n, 3n).toString()       // '1/3'

// Dense matrix
const m = DenseMatrix.identity(3)     // 3×3 identity
```

## Type Checking

MathTS exports type guard functions for each type:

```ts
import { isComplex, isFraction, isBigNumber } from '@danielsimonjr/mathts-core';

isComplex(new Complex(1, 2))   // true
isFraction(new Fraction(1n))   // true
isBigNumber(BigNumber.parse('3.14')) // true
```
