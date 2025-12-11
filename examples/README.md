# MathTS Examples

This directory contains example code demonstrating MathTS features.

## Examples

### Basic Examples

- [`basic-matrix.ts`](./basic-matrix.ts) - Basic matrix operations
- [`basic-workbook.mtsw`](./basic-workbook.mtsw) - Simple workbook example

### Advanced Examples

- [`tensor-physics.mtsw`](./tensor-physics.mtsw) - Tensor mathematics for physics
- [`eigenvalue-analysis.ts`](./eigenvalue-analysis.ts) - Eigenvalue decomposition

## Running Examples

### TypeScript Examples

```bash
# Using ts-node
npx ts-node examples/basic-matrix.ts

# Or compile and run
npx tsc examples/basic-matrix.ts
node examples/basic-matrix.js
```

### Workbook Examples

```bash
# Run a workbook
npx mtsw run examples/basic-workbook.mtsw

# Watch mode
npx mtsw watch examples/basic-workbook.mtsw
```

## Prerequisites

Make sure you have built the project first:

```bash
npm install
npm run build
```
