# MathTS

[![npm version](https://img.shields.io/npm/v/@danielsimonjr/mathts-core.svg)](https://www.npmjs.com/package/@danielsimonjr/mathts-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)

A high-performance TypeScript mathematics library with WASM/WebGPU/WebWorker acceleration, featuring reactive scientific workbooks for computational physics and tensor mathematics.

## What's New

All 12 packages are published on npm under the `@danielsimonjr/mathts-*` scope
(independently versioned).

- **500+ math functions** — typed-dispatch + factory layers, plus 52 CODATA physical constants
- **`tensor` + `autograd` packages** — rank-N dense tensors with forward & reverse-mode automatic differentiation
- **Security hardening** — WASM SHA-384 manifest verification, sandboxed expression evaluation, opt-in WorkerPool timeouts
- **Algebra, CAS, Graph Theory, Distribution Objects, Hypothesis Tests, Numerical Methods**
- **String expression evaluation** — `evaluate('sin(pi/2)')` works end-to-end
- **Expression compiler** — full 16-node AST interpreter with `parse()` and `compileExpr()`
- **Dual WASM strategy** — AssemblyScript (SIMD) + Rust WASM (FFT, eigendecomposition, SVD)
- **Symbol-based typed dispatch** — survives minification/esbuild
- **workerpool improvements** — SharedArrayBuffer, eager warmup, p95/throughput metrics
- **Bundle optimization** — 662 KB production total (57% reduction from 1524 KB dev)

## Features

- **Native TypeScript** — Full type safety with compile-time type checking
- **Expression Evaluation** — Parse and evaluate math strings (`evaluate('sin(pi/2)')`)
- **500+ Math Functions** — typed-dispatch exports + mathjs factory functions across 17 categories
- **Computer Algebra** — Symbolic integration, limits, Taylor series, Laplace transforms, Gröbner bases
- **Graph Theory** — Shortest paths, MST, connected components, topological sort
- **Statistical Testing** — t-tests, ANOVA, KS test, Shapiro-Wilk, PCA
- **Distribution Objects** — 12 statistical distributions with pdf/cdf/ppf/sample methods
- **Parallel-First** — WebWorker-based parallelization via ComputePool
- **Dual WASM Acceleration** — AssemblyScript SIMD + Rust WASM for FFT, eig, SVD
- **WebGPU Backend** — Compute shaders for matrices >100K elements
- **mathjs Compatible** — Drop-in replacement with `@danielsimonjr/mathts-compat`
- **Scientific Workbooks** — YAML-based reactive notebooks (`.mtsw` format)
- **Tree-Shakeable** — Full ESM support, 662 KB production bundle
- **Physics-First** — Built for tensor mathematics and the Universal Physics Tensor Framework (UPTF)

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
import { add, multiply, sin, cos, evaluate } from '@danielsimonjr/mathts-functions';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { computePool } from '@danielsimonjr/mathts-parallel';
```

## Quick Start

### Expression Evaluation

```typescript
import { evaluate } from '@danielsimonjr/mathts-functions';

// Evaluate math strings directly
evaluate('sin(pi/2)');           // 1
evaluate('sqrt(2)');             // 1.4142...
evaluate('2^10');                // 1024
evaluate('1 + 2i');             // Complex(1, 2)

// Scoped evaluation
evaluate('x^2 + y', { x: 3, y: 4 });  // 13

// Reusable compiled expressions
import { compileExpr } from '@danielsimonjr/mathts-functions';
const expr = compileExpr('a * b + c');
expr.evaluate({ a: 2, b: 3, c: 1 });  // 7
```

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

| Package | Version | Description |
|---------|---------|-------------|
| `@danielsimonjr/mathts-core` | 0.1.2 | Core types: Complex, Fraction, BigNumber, mathTyped |
| `@danielsimonjr/mathts-functions` | 0.1.3 | 500+ math functions, typed dispatch, `evaluate()` |
| `@danielsimonjr/mathts-matrix` | 0.1.2 | Dense/sparse matrices, JS/WASM/GPU backends, FFT, eig, SVD |
| `@danielsimonjr/mathts-tensor` | 0.1.0 | Rank-N Float64Array-backed dense tensor, einsum/contraction |
| `@danielsimonjr/mathts-autograd` | 0.1.0 | Forward + reverse-mode automatic differentiation over Tensor |
| `@danielsimonjr/mathts-parallel` | 0.1.3 | ComputePool, parallel FFT/eig, Web Workers |
| `@danielsimonjr/mathts-expression` | 0.2.0 | Expression parser, compiler, sandboxed evaluator |
| `@danielsimonjr/mathts-compat` | 0.1.2 | mathjs compatibility layer |
| `@danielsimonjr/mathts-workbook` | 0.1.2 | Scientific workbook runtime (.mtsw) |
| `@danielsimonjr/mathts-wasm` | 0.1.3 | AssemblyScript WASM kernels (SIMD) |
| `@danielsimonjr/mathts-typed-function` | 0.1.2 | Symbol-based typed dispatch (forked, improved) |
| `@danielsimonjr/mathts-workerpool` | 0.1.2 | Worker pool with SharedArrayBuffer, warmup, metrics |

## Architecture

### Factory Activation System

MathTS uses a tiered factory activation system that mirrors mathjs's factory pattern while layering on native TypeScript types:

```
mathjs factory functions (activated across 19 tiers)
         ↓
Factory scope injection (typed-function bridge, expression nodes)
         ↓
@danielsimonjr/mathts-core types (Complex, Fraction, BigNumber)
         ↓
evaluate('sin(pi/2)') → 1
```

The `evaluate()` function walks the activated scope, so all activated factory functions (arithmetic, trigonometry, algebra, matrix operations, statistics, set operations, signal processing, and more) are available as named identifiers in expressions.

### Expression Compiler

The expression package provides a full math expression compiler with 16 AST node types:

| Node Types | | |
|-----------|---|---|
| `ConstantNode` | `SymbolNode` | `OperatorNode` |
| `FunctionNode` | `AssignmentNode` | `FunctionAssignmentNode` |
| `ArrayNode` | `ObjectNode` | `IndexNode` |
| `AccessorNode` | `RangeNode` | `BlockNode` |
| `ConditionalNode` | `ParenthesisNode` | `RelationalNode` |

The compiler (`compileExpr`) produces reusable compiled expressions. The evaluator (`evaluate`) wraps compile + evaluate in a single call with optional scope injection.

### Dual WASM Strategy

| Backend | Technology | Trigger | Operations |
|---------|-----------|---------|------------|
| **AssemblyScript WASM** | SIMD vectors | >1,000 elements | Element-wise, matrix multiply |
| **Rust WASM** | Bump allocator | FFT/eig/SVD | FFT, eigendecomposition, SVD |
| **WebGPU** | Compute shaders | >100,000 elements | Large matrix ops |
| **JavaScript** | Default fallback | Always available | All operations |

The `BackendManager` selects the optimal backend automatically. Both WASM backends fall back gracefully to JavaScript if unavailable.

### Parallel-First Design

```
User Code → ComputePool (workers) → WASM/GPU Backend → Result
```

All large computations dispatch to Web Workers via `ComputePool`. The workerpool package adds:
- **SharedArrayBuffer** — zero-copy transfers for large arrays
- **Eager warmup** — `pool.ready` promise, `warmup()` for pre-initialized workers
- **Enhanced metrics** — `enhancedStats()` with p95 latency, throughput, worker utilization

### Symbol-Based Typed Dispatch

The `typed-function` package uses `Symbol`-based type identification (`TYPED_FUNCTION_TYPE`) that survives minification and esbuild tree-shaking. A multi-strategy fallback (symbol → property → prototype) ensures type tests work across bundlers.

## Performance

Production bundle sizes (662 KB total, minified + tree-shaken):

| Package | Size |
|---------|------|
| mathts-core | ~85 KB |
| mathts-functions | ~180 KB |
| mathts-matrix | ~220 KB |
| mathts-parallel | ~95 KB |
| mathts-compat | ~82 KB |

Benchmark highlights (modern developer machine):

| Operation | Performance |
|-----------|------------|
| Complex construction | ~500K ops/sec |
| Typed dispatch (add) | ~200K ops/sec |
| DenseMatrix 100×100 multiply | ~5K ops/sec |
| FFT (1024 elements, WASM) | ~50K ops/sec |
| Parallel sum (100K elements) | <5ms |

See [Performance Guide](./docs/performance.md) for backend selection thresholds and tuning.

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
mtsw run <file>        # Execute a workbook
mtsw validate <file>   # Validate workbook structure
mtsw graph <file>      # Show the dependency graph
mtsw new <name>        # Create a workbook from a template
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
| `math.evaluate('...')` | `evaluate('...')` |

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Data Types](./docs/datatypes/) — Complex, Fraction, BigNumber, matrices
- [Expression Syntax](./docs/expressions/) — parsing, compilation, security
- [Core Reference](./docs/core/) — configuration, serialization, extension
- [Function Reference](./docs/reference/) — 500+ functions
- [Performance Guide](./docs/performance.md)
- [Backends](./docs/backends.md)
- [API Differences](./docs/migration/api-diff.md)
- [Migration Guide](./docs/migration/guide.md)
- [Workbook Specification](./docs/Architecture/Workbook/MATHTS_WORKBOOK_SPECIFICATION.md)

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

# Production build (minified + tree-shaken)
npm run build:prod
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

[MIT](./LICENSE) © Daniel Simon Jr.

## Acknowledgments

- Inspired by [mathjs](https://mathjs.org/)
- Type dispatch via [typed-function](https://github.com/josdejong/typed-function)
- Workbook format influenced by [Observable](https://observablehq.com/), [marimo](https://marimo.io/), and [Maple](https://www.maplesoft.com/)
