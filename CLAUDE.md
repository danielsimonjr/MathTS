# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MathTS is a ground-up TypeScript rewrite of mathjs with WASM/WebGPU/WebWorker optimization. It includes a Scientific Workbook system (`.mtsw` files) for reactive YAML-based notebooks targeting theoretical physics and tensor mathematics, specifically the Universal Physics Tensor Framework (UPTF).

## Build & Development Commands

The workbook package is located in `docs/`:

```bash
cd docs

# Install dependencies
npm install

# Build the project
npm run build           # tsup builds src/index.ts and src/cli.ts

# Development mode (watch)
npm run dev

# Run tests
npm run test            # vitest
npm run test -- --watch # Watch mode

# Run specific test file
npx vitest run path/to/test.ts

# Type checking
npm run typecheck       # tsc --noEmit

# Linting
npm run lint            # eslint src --ext .ts
```

### CLI Tool (mtsw)

```bash
# Run a workbook
mtsw run <file.mtsw>
mtsw run <file.mtsw> -c <cell-id>    # Run specific cell
mtsw run <file.mtsw> -v              # Verbose output

# Watch mode
mtsw watch <file.mtsw>

# Validate workbook structure
mtsw validate <file.mtsw>

# Strip outputs for git
mtsw strip <file.mtsw> -o clean.mtsw

# Show dependency graph
mtsw graph <file.mtsw>               # Text format
mtsw graph <file.mtsw> -f mermaid    # Mermaid diagram

# Create new workbook from template
mtsw new <name> -t basic             # basic | tensor-physics | data-science

# Export to other formats
mtsw export <file.mtsw> -f html      # html | pdf | ipynb | latex
```

## Architecture

### Workbook Runtime (`docs/`)

The workbook package (`@mathts/workbook`) provides a YAML-based reactive notebook system:

- **`types.ts`** - Core type definitions: `Workbook`, `Cell`, `DependencyGraph`, `ExecutionContext`
- **`index.ts`** - YAML parser/serializer: `parseWorkbook()`, `serializeWorkbook()`, `stripOutputs()`
- **`graph.ts`** - Dependency graph: `buildDependencyGraph()`, `topologicalSort()`, `getDependents()`
- **`executor.ts`** - Cell execution: `WorkbookExecutor` class with reactive execution
- **`cli.ts`** - Command-line interface

### Cell Types

The workbook supports 8 cell types, each detected by its primary key:
- `markdown` - Documentation with LaTeX math support
- `code` - TypeScript/JavaScript execution
- `tensor` - Einstein notation for tensor math
- `equation` - LaTeX equations with labels
- `visualization` - Three.js/D3/Plotly rendering
- `data` - YAML/JSON/CSV data cells
- `test` - Assertions with timeout support
- `export` - Publication output generation

### Dependency Resolution

Cells declare dependencies via:
1. Explicit `depends_on: [cell-ids]` field
2. Auto-detection from `import ... from '#cell-id'` patterns

The executor runs cells in topological order, supporting three modes:
- `reactive` - Auto-rerun when dependencies change
- `sequential` - Top-to-bottom execution
- `manual` - Explicit trigger only

### Planned Package Structure (Full MathTS)

```
mathts/
├── packages/
│   ├── typed-function/    # Type dispatch system
│   └── workerpool/        # Worker pool management
├── core/                  # @mathts/core - types, config, factory
├── matrix/                # @mathts/matrix - DenseMatrix, SparseMatrix, backends
├── functions/             # @mathts/functions - arithmetic, algebra, stats
├── parallel/              # @mathts/parallel - ComputePool, workers
└── expression/            # @mathts/expression - parser, evaluator
```

### Backend Selection Strategy

Matrix operations support three backends with automatic selection:
- **JSBackend** - Pure TypeScript (default)
- **WASMBackend** - AssemblyScript with SIMD (>1K elements)
- **GPUBackend** - WebGPU compute shaders (>100K elements)

## Key Patterns

### Workbook Parsing
```typescript
const result = parseWorkbook(yamlContent);
if (result.success && result.workbook) {
  const executor = createExecutor(result.workbook);
  await executor.runAll();
}
```

### Cell References
Cells reference each other using `#cell-id` syntax:
```typescript
import { result } from '#previous-cell';
```

### Event Handling
```typescript
executor.on((event: WorkbookEvent) => {
  switch (event.type) {
    case 'cell:success': // Handle success
    case 'cell:error':   // Handle error
    case 'cell:stale':   // Dependencies changed
  }
});
```

## File Format (.mtsw)

YAML-based workbook format designed for Git-friendliness:
```yaml
version: "1.0"
metadata:
  title: "Workbook Title"
  author: "Author Name"
runtime:
  engine: mathts
  execution: reactive
cells:
  - markdown: |
      # Title
    id: intro
  - code: |
      const x = 42;
      export { x };
    id: compute
```

## Code Style

### Naming Conventions
- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions/Variables**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Types/Interfaces**: `PascalCase`

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
<type>(<scope>): <description>
```
Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

Examples:
```
feat(matrix): add sparse matrix CSR format support
fix(workbook): resolve circular dependency detection
perf(wasm): optimize matmul with SIMD instructions
```

## Implementation Status

Current workbook runtime is implemented. Pending:
- MathTS core library integration
- Three.js visualization bindings
- Web UI (Monaco + reactive rendering)
- LaTeX/PDF export

## Sprint Development Guidelines

### CRITICAL: typed-function and workerpool Integration

**Every sprint MUST integrate typed-function and workerpool.** This is a core architectural requirement.

#### typed-function Integration Pattern

All new types and functions must register with the typed-function system for runtime polymorphic dispatch:

```typescript
// 1. Import the mathTyped instance
import { mathTyped, Complex, Fraction, BigNumber } from '@mathts/core';

// 2. Create polymorphic functions with type signatures
const add = mathTyped('add', {
  'number, number': (a, b) => a + b,
  'Complex, Complex': (a, b) => a.add(b),
  'Fraction, Fraction': (a, b) => a.add(b),
  'BigNumber, BigNumber': (a, b) => a.add(b),
  'Matrix, Matrix': (a, b) => a.add(b),
});

// 3. For new types, add to MATHTS_TYPES in core/src/typed/mathts-typed.ts
export const MATHTS_TYPES: TypeDef[] = [
  { name: 'YourNewType', test: isYourNewType },
  // ...
];

// 4. Add conversions in MATHTS_CONVERSIONS
export const MATHTS_CONVERSIONS: ConversionDef[] = [
  { from: 'number', to: 'YourNewType', convert: (n) => YourNewType.fromNumber(n) },
  // ...
];
```

#### workerpool Integration Pattern

**Use parallel execution whenever possible.** The ComputePool should be the default approach, not just for large datasets. Workers provide isolation, prevent main thread blocking, and enable true concurrency.

```typescript
import { computePool, ComputePool } from '@mathts/parallel';

// 1. Initialize pool (once at startup)
await computePool.initialize();

// 2. ALWAYS prefer parallel execution - use workers by default
const result = await computePool.matmul(a, aRows, aCols, b, bCols);
const sum = await computePool.sum(data);
const mapped = await computePool.map(data, fn);

// 3. Available parallel operations:
await computePool.sum(data);                    // Parallel reduction
await computePool.elementwise(a, b, 'add');     // Element-wise ops
await computePool.matmul(a, aRows, aCols, b, bCols);  // Matrix multiply
await computePool.map(data, fn);                // Parallel map
await computePool.exec('customMethod', params); // Custom worker method

// 4. Batch operations - run multiple independent tasks in parallel
const [result1, result2, result3] = await Promise.all([
  computePool.sum(data1),
  computePool.sum(data2),
  computePool.sum(data3),
]);
```

**Parallel-first philosophy:**
- Use workers for ALL matrix operations regardless of size
- Use workers for ALL array transformations (map, reduce, filter)
- Use workers for ALL numerical computations that can be batched
- Only fall back to sequential for trivial scalar operations
- Leverage `Promise.all()` for independent parallel tasks

#### Sprint Checklist

For each sprint, verify:

- [ ] New numeric types implement `Scalar` interface
- [ ] New types are registered in `MATHTS_TYPES`
- [ ] Type conversions are added to `MATHTS_CONVERSIONS`
- [ ] Type test functions (`isYourType()`) use `instanceof`
- [ ] Functions use `mathTyped()` for polymorphic dispatch
- [ ] ALL operations use `ComputePool` (parallel-first, not just large data)
- [ ] Independent operations use `Promise.all()` for concurrency
- [ ] Tests cover typed-function dispatch and conversions
- [ ] Tests verify parallel execution paths

### Core Type System

MathTS core types in `core/src/types/`:

| Type | File | Interface | Description |
|------|------|-----------|-------------|
| `Complex` | `complex.ts` | `IComplex` | Complex numbers with full arithmetic |
| `Fraction` | `fraction.ts` | `IFraction` | Exact rationals with bigint |
| `BigNumber` | `bignumber.ts` | `IBigNumber` | Arbitrary precision decimals |
| `Matrix` | (pending) | `IMatrix` | Dense/Sparse with backend selection |

### Type Conversion Hierarchy

```
string ──┬──> number ──┬──> Complex
         │             │
bigint ──┴──> Fraction ┴──> BigNumber
```

Conversions flow upward (number → Complex) automatically via typed-function.

### Backend Selection Strategy

**Parallel-first with backend optimization:**

| Backend | Use Case | Notes |
|---------|----------|-------|
| **Workers** | ALL operations | Default for everything - parallel first |
| JS | Scalar-only fallback | Only when workers unavailable |
| WASM | SIMD acceleration | Within workers for vectorized ops |
| GPU | WebGPU compute | Within workers for massive parallelism |

The worker pool is always used. WASM and GPU backends run **inside** workers for additional acceleration:

```
User Code → ComputePool (workers) → WASM/GPU Backend → Result
```

Never bypass workers for "small" operations - the overhead is minimal and consistency matters.

## Sprint Planning Files

Sprint JSON files are in `docs/planning/sprints/`:
- `PHASE_1_SPRINT_1_TODO.json` through `PHASE_6_SPRINT_28_TODO.json`
- Post-v1.0 sprints in `docs/planning/phases/`

Each sprint file contains tasks, dependencies, success criteria, and files to create/modify.
