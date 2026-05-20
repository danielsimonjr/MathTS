# MathTS Examples

This directory contains example code demonstrating MathTS features.

## Examples

### Basic Examples

- [`basic-arithmetic.ts`](./basic-arithmetic.ts) - Basic arithmetic operations
- [`basic-matrix.ts`](./basic-matrix.ts) - Basic matrix operations
- [`basic-workbook.mtsw`](./basic-workbook.mtsw) - Simple workbook example

### Advanced Examples

- [`matrix-operations.ts`](./matrix-operations.ts) - Matrix operations
- [`parallel-computing.ts`](./parallel-computing.ts) - Parallel compute pool
- [`mathjs-migration.ts`](./mathjs-migration.ts) - Migrating from mathjs

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
```

## Prerequisites

Make sure you have built the project first:

```bash
npm install
npm run build
```
