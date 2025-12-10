# MathTS

[![npm version](https://img.shields.io/npm/v/@mathts/core.svg)](https://www.npmjs.com/package/@mathts/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)

A high-performance TypeScript mathematics library with WASM/WebGPU/WebWorker acceleration, featuring reactive scientific workbooks for computational physics and tensor mathematics.

## Features

- **Native TypeScript** - Full type safety with compile-time type checking
- **Multi-Backend Acceleration** - Automatic selection between JS, WASM (SIMD), and WebGPU
- **Parallel Execution** - WebWorker-based parallelization for large computations
- **Scientific Workbooks** - YAML-based reactive notebooks (`.mtsw` format)
- **Tree-Shakeable** - Full ESM support for minimal bundle sizes
- **Physics-First** - Built for tensor mathematics and the Universal Physics Tensor Framework (UPTF)

## Installation

```bash
npm install @mathts/core
```

### Optional Packages

```bash
npm install @mathts/matrix      # Matrix operations with backend selection
npm install @mathts/tensor      # Tensor mathematics and Einstein notation
npm install @mathts/symbolic    # Symbolic computation
npm install @mathts/viz         # Three.js/D3 visualization
npm install @mathts/workbook    # Scientific workbook runtime
```

## Quick Start

### Basic Usage

```typescript
import { Matrix, Complex } from '@mathts/core';

// Matrix operations
const A = Matrix.from([
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9]
]);

const det = A.determinant();
const inv = A.inverse();
const eig = A.eigenvalues();

// Complex numbers
const z = new Complex(3, 4);
console.log(z.abs());  // 5
console.log(z.arg());  // 0.927...
```

### Scientific Workbook

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
      import { Matrix } from '@mathts/core';

      const A = Matrix.random(3, 3);
      const eigenvalues = A.eigenvalues();

      console.log('Eigenvalues:', eigenvalues);
      export { A, eigenvalues };
    id: compute

  - visualization: |
      import { plotEigenspectrum } from '@mathts/viz';
      plotEigenspectrum(eigenvalues);
    id: viz
    depends_on: [compute]
```

Run with the CLI:

```bash
npx mtsw run example.mtsw
```

## Architecture

MathTS uses a three-tier backend system for optimal performance:

| Backend | Trigger | Use Case |
|---------|---------|----------|
| **JS** | Default | Small matrices, maximum compatibility |
| **WASM** | >1,000 elements | Medium matrices, SIMD acceleration |
| **WebGPU** | >100,000 elements | Large matrices, GPU compute shaders |

```typescript
import { Matrix, backends } from '@mathts/matrix';

// Automatic backend selection (default)
const result = A.multiply(B);

// Force specific backend
backends.configure({ preferred: 'wasm' });
const wasmResult = A.multiply(B);

// GPU for massive matrices
backends.configure({ preferred: 'gpu' });
const gpuResult = largeA.multiply(largeB);
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

## Performance

Benchmarks vs mathjs (Node.js, Apple M2):

| Operation | Size | mathjs | MathTS (JS) | MathTS (WASM) | MathTS (GPU) |
|-----------|------|--------|-------------|---------------|--------------|
| matmul | 100×100 | 15ms | 12ms | 3ms | - |
| matmul | 1000×1000 | 1.5s | 1.2s | 150ms | 50ms |
| FFT | 1M points | 500ms | 400ms | 50ms | 20ms |
| SVD | 500×500 | 8s | 6s | 1.2s | 400ms |

## Documentation

- [API Reference](./docs/api/)
- [Architecture Guide](./docs/Architecture/)
- [Migration from mathjs](./docs/migration/)
- [Workbook Specification](./docs/Architecture/MATHTS_WORKBOOK_SPECIFICATION.md)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

[MIT](./LICENSE) © Daniel Simon Jr.

## Acknowledgments

- Inspired by [mathjs](https://mathjs.org/)
- Workbook format influenced by [Observable](https://observablehq.com/), [marimo](https://marimo.io/), and [Maple](https://www.maplesoft.com/)
