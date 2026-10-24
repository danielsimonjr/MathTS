# @danielsimonjr/mathts-core

Core types, utilities, and configuration for MathTS.

## Installation

```bash
npm install @danielsimonjr/mathts-core
```

## Usage

```typescript
import { DEFAULT_CONFIG, isNumber, isMatrix } from '@danielsimonjr/mathts-core';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

// Factory default configuration (MathTSConfig)
const config = { ...DEFAULT_CONFIG, preferredBackend: 'wasm' };

// Type guards
console.log(isNumber(42)); // true
console.log(
  isMatrix([
    [1, 2],
    [3, 4],
  ])
); // false — nested arrays are not matrices
const m = DenseMatrix.fromArray([
  [1, 2],
  [3, 4],
]);
console.log(isMatrix(m)); // true
```

## API

### Types

- `BackendType` - Available backends: `'js' | 'wasm' | 'gpu'`
- `NumericType` - Numeric precision types
- `MathTSConfig` - Configuration interface

### SI dimension vectors

`toSiDimensionVector` returns exact `Fraction` exponents `[L, M, T, I, Θ, N, J]`; use
`vec.map((f) => f.toNumber())` when you need plain numbers (there is no
`toSiDimensionNumbers` helper). `fromSiDimensionVector` accepts `SiDimensionExponent`
(`number | Fraction`) and produces the length-10 `Unit` exponent array.

### Functions

- `mulberry32(seed)` — seeded Mulberry32 PRNG returning U[0, 1) samples (not cryptographically secure)
- `boxMuller(u1, u2)` — Box–Muller pair of N(0, 1) samples from two uniforms
- `rowMajorStrides(shape)` — row-major stride vector for a dense tensor shape
- `DEFAULT_CONFIG` - Default configuration object
- `isNumber(value)` - Type guard for numbers
- `isComplex(value)` - Type guard for complex numbers
- `isMatrix(value)` - Type guard for matrix-like objects (`rows`, `cols`, `get`, `type`)

## License

MIT
