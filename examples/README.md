# MathTS Examples

This directory contains example code demonstrating MathTS features. The full export list of `@danielsimonjr/mathts-functions` (1,320 exports) is in [`docs/reference/functions.md`](../docs/reference/functions.md) and browsable at <https://danielsimonjr.com/MathTS/>.

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
- [`scalar-search.ts`](./scalar-search.ts) - Symbolic regression over scalar trees (`runScalarSearch`)
- [`scientific-toolkit.ts`](./scientific-toolkit.ts) - Tour of the `functions@0.72.0` additions: weighted statistics and effect sizes, `erfinv`/Wigner 3j/spherical harmonics, tanh-sinh and double integrals, differential evolution, modular arithmetic, Pell/Diophantine/Zeckendorf, Smith normal form, LLL, Sturm real roots, Kaiser window, `tf2ss`, DTW, Hilbert/Hadamard matrices, geometry predicates and polygon clipping

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
bun --tsconfig-override=tsconfig.base.json examples/scalar-search.ts
bun --tsconfig-override=tsconfig.base.json examples/scientific-toolkit.ts
```

### Workbook examples

```bash
bun workbook/dist/cli.js run examples/basic-workbook.mtsw
bun workbook/dist/cli.js run examples/lightspeed.mtsw
```
