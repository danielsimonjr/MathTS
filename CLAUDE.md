# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MathTS is a TypeScript rewrite of mathjs with WASM/WebGPU/WebWorker optimization. It uses an npm workspaces monorepo with Turborepo orchestration. All packages are ESM-only (`"type": "module"`), target ES2022, and use `tsup` for bundling with `vitest` for testing.

It also includes a Scientific Workbook system (`.mtsw` files) for reactive YAML-based notebooks.

## Build & Development Commands

```bash
# From repo root:
npm run build               # turbo run build (all packages)
npm run test                # turbo run test (all packages)
npm run typecheck           # turbo run typecheck (all packages)
npm run lint                # turbo run lint (all packages)
npm run format              # prettier --write all files
npm run format:check        # prettier --check (CI)

# Single package:
npx turbo build --filter=@mathts/core
npx turbo test --filter=@mathts/matrix

# Run specific test file (from repo root):
npx vitest run core/tests/utils.test.ts
npx vitest run matrix/tests/DenseMatrix.test.ts

# Run tests for one package directly:
cd core && npx vitest run
cd matrix && npx vitest run

# Typecheck a single package:
cd functions && npx tsc --noEmit
```

## Monorepo Structure

### Workspaces (in `package.json`)

```
packages/typed-function/   # @mathts/typed-function - forked type dispatch system
packages/workerpool/       # @mathts/workerpool - forked worker pool management
core/                      # @mathts/core - types, typed-function integration, factory
matrix/                    # @mathts/matrix - DenseMatrix, SparseMatrix, backends (JS/WASM/GPU)
functions/                 # @mathts/functions - math functions via typed dispatch
parallel/                  # @mathts/parallel - ComputePool, WebWorker operations
expression/                # @mathts/expression - parser/evaluator (build skipped, incomplete)
workbook/                  # @mathts/workbook - .mtsw notebook runtime + CLI
assembly/                  # WASM source (AssemblyScript, build broken)
compat/                    # @mathts/compat - mathjs API compatibility shim
```

### Dependency Graph

```
typed-function ← core ← matrix ← functions
                   ↑        ↑         ↑
workerpool ← parallel ─────┘         │
                   ↑                  │
                   └──────────────────┘
core ← workbook
core, matrix, functions, parallel ← compat
```

### Package Build Details

All packages use `tsup src/index.ts --format esm --dts --clean` except:
- **functions**: no `--dts` flag (build is `tsup src/index.ts --format esm --clean`)
- **workbook**: builds two entry points (`src/index.ts` and `src/cli.ts`)
- **expression**: build is `echo 'Skipping build'` (incomplete package)

## Architecture

### Two-Layer Code in `functions/`

The functions package has two distinct code layers:

1. **Active typed functions** (`functions/src/typed/`): New parallel-first implementations using `@mathts/core` typed dispatch. These are the only files exported from `functions/src/index.ts`. Includes: `arithmetic.ts`, `trigonometry.ts`, `statistics.ts`, `signal.ts`.

2. **Synced mathjs factories** (`functions/src/{arithmetic,algebra,bitwise,...}/`): ~20 category directories containing factory-pattern functions synced from the mathjs fork (`~/Dropbox/Github/mathjs`). These are **not exported** and not in the build entry point. Support files in `functions/src/{utils,core,plain,type,expression,error,wasm}/`.

Import path difference from mathjs: mathjs uses `../../utils/` (extra `function/` directory level), mathts uses `../utils/`. Import extensions are `.js` in mathts.

### `@mathts/core` Exports

Three main systems:
- **Numeric types**: `Complex`, `Fraction`, `BigNumber` with type guards and constants
- **typed-function integration**: `mathTyped` instance, `createMathTSTyped()`, `TypeRegistry`, type test functions (`isNumber`, `isComplex`, `isMatrix`, etc.)
- **Factory pattern**: `FunctionRegistry`, `createFactory()`, `registry`, `math` singleton, `DEFAULT_CONFIG`

### Matrix Backends

`@mathts/matrix` supports three backends with automatic selection via `BackendManager`:
- **JSBackend** - Pure TypeScript (default, always available)
- **WASMBackend** - AssemblyScript with SIMD (>1K elements)
- **GPUBackend** - WebGPU compute shaders (>100K elements)

### `@mathts/compat` Pattern

Provides mathjs-compatible API via shims:
```typescript
import { create, all } from '@mathts/compat';
const math = create(all);
math.add(1, 2);  // delegates to @mathts/core types + operations
```

### Workbook Runtime

YAML-based reactive notebook (`.mtsw` files). Key source files in `workbook/src/`:
- `types.ts` - `Workbook`, `Cell`, `DependencyGraph`, `ExecutionContext`
- `parser.ts` / `index.ts` - YAML parsing/serialization
- `graph.ts` - dependency resolution with topological sort
- `executor.ts` - `WorkbookExecutor` with reactive/sequential/manual execution modes

## Testing

**Framework**: Vitest. Root `vitest.config.ts` aggregates all test paths. Individual packages also have their own `vitest.config.ts`.

**Test file locations** (all use `*.test.ts` convention):
- `core/tests/` - type system, factory, typed-function
- `matrix/tests/` - DenseMatrix, SparseMatrix, backends (JS, WASM, GPU), SVD/eig decompositions
- `functions/tests/` - typed arithmetic, signal processing (FFT, convolution), parallel ops
- `parallel/tests/` - ComputePool, chunking, threshold strategies, elementwise/matmul operations
- `compat/tests/` - compatibility layer
- `packages/typed-function/tests/`, `packages/workerpool/tests/`
- `tests/integration/` - cross-package instance and function tests

**Packages without tests**: `expression/`, `workbook/`, `assembly/`

**Gotcha**: Always `import { describe, it, expect } from 'vitest'` explicitly in test files. The `globals` setting is inconsistent across package configs.

## TypeScript Configuration

- `tsconfig.base.json`: strict mode, ES2022 target, ESNext modules, bundler resolution
- Each package extends the base config
- Import extensions must be `.js` (ESM resolution)

## Code Style

- Files: `kebab-case.ts`, Classes: `PascalCase`, Functions/Variables: `camelCase`, Constants: `UPPER_SNAKE_CASE`
- Commit messages: Conventional Commits (`feat(matrix):`, `fix(workbook):`, etc.)
- Pre-commit hook (husky + lint-staged): auto-runs `eslint --fix` + `prettier --write` on staged files

## Syncing from mathjs

The `functions/` package contains synced factory-pattern functions from the mathjs fork.

**Sync script**: `~/.claude/scripts/sync_mathjs_to_mathts.py`
**Run with**: `python -X utf8 ~/.claude/scripts/sync_mathjs_to_mathts.py`

The script:
1. Copies `.ts` files from `~/Dropbox/Github/Mathjs/src/function/<category>/` → `functions/src/<category>/`
2. Copies support dirs from `~/Dropbox/Github/Mathjs/src/{utils,core,plain,type,expression,error,wasm}/` → `functions/src/`
3. Transforms imports: `../../utils/` → `../utils/`, `.ts` → `.js`
4. Skips Dropbox conflict files
5. Only writes files that actually changed

**Last sync**: 2026-04-02 (183 files updated from mathjs v15.3.4, 0 TypeScript errors)

**Important**: Synced files are dormant — they are NOT exported from `functions/src/index.ts`. Only `functions/src/typed/` contains active implementations.

## Known Issues

- `expression/` build is skipped (incomplete package)
- `assembly/` WASM build fails (asc compiler issues)
- Some packages may need `npm i -D @types/node` if missing
- `functions/` has no vitest tests yet (vitest exits with "No test files found")
- mathjs fork now uses `@danielsimonjr/typed-function` and `@danielsimonjr/workerpool` — synced files may reference these

## Tools

`tools/` contains standalone utility packages (not workspace members):
- `create-dependency-graph/` - generates package dependency graphs
- `compress-for-context/` - compresses code for LLM context windows
- `chunking-for-files/` - splits large files into chunks

## Sprint Planning

Sprint JSON files in `docs/Planning/sprints/`: `PHASE_1_SPRINT_1_TODO.json` through `PHASE_6_SPRINT_28_TODO.json`. Architecture docs in `docs/Architecture/Workbook/`.
