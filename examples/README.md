# MathTS Examples

This directory contains example code demonstrating MathTS features.

## Examples

### Basic Examples

- [`basic-arithmetic.ts`](./basic-arithmetic.ts) - Basic arithmetic operations
- [`basic-matrix.ts`](./basic-matrix.ts) - Basic matrix operations
- [`basic-workbook.mtsw`](./basic-workbook.mtsw) - Simple workbook example
- [`lightspeed.mtsw`](./lightspeed.mtsw) - Larger workbook demo
- [`lightspeed.html`](./lightspeed.html) - Static HTML companion for the lightspeed notebook

### Advanced Examples

- [`matrix-operations.ts`](./matrix-operations.ts) - Matrix operations
- [`parallel-computing.ts`](./parallel-computing.ts) - Parallel compute pool
- [`mathjs-migration.ts`](./mathjs-migration.ts) - Migrating from mathjs

## Running Examples

Build the monorepo first (`bun install` && `bun run build` from the repo root).

### TypeScript examples

Examples import workspace packages. Use the base tsconfig so resolution hits built `dist/`
(not `src/`, which lacks tsdown `define` replacements such as `__PKG_VERSION__`):

```bash
bun --tsconfig-override=tsconfig.base.json examples/basic-arithmetic.ts
bun --tsconfig-override=tsconfig.base.json examples/basic-matrix.ts
bun --tsconfig-override=tsconfig.base.json examples/parallel-computing.ts
bun --tsconfig-override=tsconfig.base.json examples/matrix-operations.ts
bun --tsconfig-override=tsconfig.base.json examples/mathjs-migration.ts
```

### Workbook examples

```bash
bun workbook/dist/cli.js run examples/basic-workbook.mtsw
bun workbook/dist/cli.js run examples/lightspeed.mtsw
```
