# MathTS

[![npm version](https://img.shields.io/npm/v/@danielsimonjr/mathts-core.svg)](https://www.npmjs.com/package/@danielsimonjr/mathts-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)

A high-performance TypeScript mathematics library with WASM/WebGPU/WebWorker acceleration, featuring reactive scientific workbooks for computational physics and tensor mathematics.

## Features

- **Native TypeScript** - Full type safety with compile-time type checking
- **Parallel-First** - WebWorker-based parallelization via ComputePool
- **Multi-Backend Acceleration** - Automatic selection between JS, WASM (SIMD), and WebGPU
- **mathjs Compatible** - Drop-in replacement with `@danielsimonjr/mathts-compat`
- **Scientific Workbooks** - YAML-based reactive notebooks (`.mtsw` format)
- **Tree-Shakeable** - Full ESM support for minimal bundle sizes
- **Physics-First** - Built for tensor mathematics and the Universal Physics Tensor Framework (UPTF)

## Installation

### For mathjs Users (Quickest Migration)

```bash
npm install @danielsimonjr/mathts-compat
```

```typescript
import { create, all } from '@danielsimonjr/mathts-compat';
const math = create(all);

// Use familiar mathjs API
math.add(1, 2);              // 3
math.complex(3, 4);          // Complex(3, 4)
math.matrix([[1,2],[3,4]]);  // DenseMatrix
math.sin(Math.PI / 2);       // 1
```

### For New Projects

```bash
npm install @danielsimonjr/mathts-core @danielsimonjr/mathts-functions @danielsimonjr/mathts-matrix @danielsimonjr/mathts-parallel
```

```typescript
import { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';
import { add, multiply, sin, cos } from '@danielsimonjr/mathts-functions';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { computePool } from '@danielsimonjr/mathts-parallel';
```

## Quick Start

### Complex Numbers

```typescript
import { Complex, I } from '@danielsimonjr/mathts-core';

const z = new Complex(3, 4);
console.log(z.abs());       // 5
console.log(z.arg());       // 0.927... radians
console.log(z.conjugate()); // Complex(3, -4)

// Using imaginary unit
const w = z.add(I);         // Complex(3, 5)
```

### Fractions

```typescript
import { Fraction } from '@danielsimonjr/mathts-core';

const f = new Fraction(1, 3);
const g = new Fraction(1, 6);
const sum = f.add(g);       // Fraction(1, 2) - auto-simplified
console.log(sum.toString()); // "1/2"
```

### BigNumbers

```typescript
import { BigNumber } from '@danielsimonjr/mathts-core';

const a = BigNumber.parse('0.1');
const b = BigNumber.parse('0.2');
const sum = a.add(b);
console.log(sum.toString()); // "0.3" - exact, no floating point errors
```

### Matrices

```typescript
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

const A = DenseMatrix.fromArray([
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9]
]);

const B = DenseMatrix.identity(3);
const C = A.multiply(B);
const T = A.transpose();

console.log(A.rows, A.cols); // 3, 3
console.log(A.get(0, 1));    // 2
```

### Parallel Operations

```typescript
import { computePool } from '@danielsimonjr/mathts-parallel';

// Initialize once at app startup
await computePool.initialize();

// Parallel operations on large arrays
const data = new Float64Array(100000);
for (let i = 0; i < data.length; i++) data[i] = Math.random();

const sum = await computePool.sum(data);
const mean = await computePool.mean(data);
const { variance, std } = (await computePool.variance(data)).result;

// Parallel matrix multiplication
const A = new Float64Array([1, 2, 3, 4]);
const B = new Float64Array([5, 6, 7, 8]);
const C = await computePool.matmul(A, 2, 2, B, 2);

// Cleanup on app shutdown
await computePool.terminate();
```

### Typed Functions

```typescript
import { add, multiply, sin } from '@danielsimonjr/mathts-functions';
import { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';

// Automatic type dispatch
add(1, 2);                                    // 3
add(new Complex(1, 2), new Complex(3, 4));   // Complex(4, 6)
add(new Fraction(1, 2), new Fraction(1, 3)); // Fraction(5, 6)
add(BigNumber.parse('0.1'), BigNumber.parse('0.2')); // BigNumber(0.3)

// Works with mixed types too (automatic conversion)
sin(0);                   // 0
sin(Math.PI / 2);         // 1
sin(new Complex(0, 1));   // Complex sinh(1)
```

## Packages

| Package | Description |
|---------|-------------|
| `@danielsimonjr/mathts-core` | Core types: Complex, Fraction, BigNumber, mathTyped |
| `@danielsimonjr/mathts-functions` | Mathematical functions with typed dispatch |
| `@danielsimonjr/mathts-matrix` | Dense and sparse matrices with backend selection |
| `@danielsimonjr/mathts-parallel` | Parallel execution via ComputePool (Web Workers) |
| `@danielsimonjr/mathts-compat` | mathjs compatibility layer |
| `@danielsimonjr/mathts-workbook` | Scientific workbook runtime (.mtsw) |

## Architecture

### Parallel-First Design

MathTS uses Web Workers for all large computations:

```
User Code → ComputePool (workers) → WASM/GPU Backend → Result
```

### Backend Selection

| Backend | Trigger | Use Case |
|---------|---------|----------|
| **JS** | Default | Small matrices, maximum compatibility |
| **WASM** | >1,000 elements | Medium matrices, SIMD acceleration |
| **WebGPU** | >100,000 elements | Large matrices, GPU compute shaders |

## Scientific Workbook

Create a file `example.mtsw`:

```yaml
version: "1.0"
metadata:
  title: "Matrix Analysis"
runtime:
  engine: mathts
  execution: reactive

cells:
  - markdown: |
      # Matrix Eigenvalue Analysis
    id: intro

  - code: |
      import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

      const A = DenseMatrix.random(3, 3);
      console.log('Matrix A:', A.toArray());
      export { A };
    id: compute

  - test: |
      import { A } from '#compute';
      assert(A.rows === 3);
      assert(A.cols === 3);
    id: verify
    depends_on: [compute]
```

Run with the CLI:

```bash
npx mtsw run example.mtsw
```

## Workbook CLI

```bash
mtsw run <file>              # Execute workbook
mtsw run <file> -c <cell>    # Run specific cell
mtsw watch <file>            # Watch and re-run on changes
mtsw validate <file>         # Validate structure
mtsw graph <file>            # Show dependency graph
mtsw export <file> -f html   # Export to HTML/PDF/LaTeX
mtsw new <name> -t physics   # Create from template
```

## Migration from mathjs

See the [Migration Guide](./docs/migration/guide.md) for detailed instructions.

### Quick Migration

1. Install: `npm install @danielsimonjr/mathts-compat`
2. Replace import: `import { create, all } from '@danielsimonjr/mathts-compat'`
3. Continue using `math.*` API

### Key Differences

| mathjs | MathTS |
|--------|--------|
| `math.complex(3, 4)` | `new Complex(3, 4)` |
| `math.matrix([[1,2]])` | `DenseMatrix.fromArray([[1,2]])` |
| `math.bignumber('123')` | `BigNumber.parse('123')` |
| `bn.toNumber()` | `bn.valueOf()` |
| `m.get([row, col])` | `m.get(row, col)` |

## Documentation

- [API Differences](./docs/migration/api-diff.md)
- [Migration Guide](./docs/migration/guide.md)
- [Workbook Specification](./docs/Architecture/MATHTS_WORKBOOK_SPECIFICATION.md)
- [Architecture Guide](./docs/Architecture/)

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Type check
npm run typecheck
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

[MIT](./LICENSE) © Daniel Simon Jr.

## Acknowledgments

- Inspired by [mathjs](https://mathjs.org/)
- Type dispatch via [typed-function](https://github.com/josdejong/typed-function)
- Workbook format influenced by [Observable](https://observablehq.com/), [marimo](https://marimo.io/), and [Maple](https://www.maplesoft.com/)
