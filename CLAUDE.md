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
npx turbo build --filter=@danielsimonjr/mathts-core
npx turbo test --filter=@danielsimonjr/mathts-matrix

# Run specific test file (from repo root):
npx vitest run core/tests/utils.test.ts
npx vitest run matrix/tests/DenseMatrix.test.ts

# Run tests for one package directly:
cd core && npx vitest run
cd matrix && npx vitest run

# Typecheck a single package:
cd functions && npx tsc --noEmit

# Coverage (uses whitelist in root vitest.config.ts to exclude dormant code):
npx vitest run --coverage
```

## Monorepo Structure

### Workspaces (in `package.json`)

```
packages/typed-function/   # @danielsimonjr/mathts-typed-function - forked type dispatch system
packages/workerpool/       # @danielsimonjr/mathts-workerpool - forked worker pool management
core/                      # @danielsimonjr/mathts-core - types, typed-function integration, factory
matrix/                    # @danielsimonjr/mathts-matrix - DenseMatrix, SparseMatrix, backends (JS/WASM/GPU)
functions/                 # @danielsimonjr/mathts-functions - math functions via typed dispatch
parallel/                  # @danielsimonjr/mathts-parallel - ComputePool, WebWorker operations
expression/                # @danielsimonjr/mathts-expression - parser/evaluator
workbook/                  # @danielsimonjr/mathts-workbook - .mtsw notebook runtime + CLI
assembly/                  # WASM source (AssemblyScript, build broken)
compat/                    # @danielsimonjr/mathts-compat - mathjs API compatibility shim
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
- **assembly**: AssemblyScript build (`asc src/index.ts`) + TypeScript bindings (`tsc -p tsconfig.bindings.json`)

## Architecture

### Two-Layer Code in `functions/`

The functions package has two distinct code layers:

1. **Active typed functions** (`functions/src/typed/`): New parallel-first implementations using `@danielsimonjr/mathts-core` typed dispatch. These are the only files exported from `functions/src/index.ts`. Includes: `arithmetic.ts`, `trigonometry.ts`, `statistics.ts`, `signal.ts`.

2. **Synced mathjs factories** (`functions/src/{arithmetic,algebra,bitwise,...}/`): ~20 category directories containing factory-pattern functions synced from the mathjs fork (`~/Dropbox/Github/mathjs`). These are **not exported** and not in the build entry point. Support files in `functions/src/{utils,core,plain,type,expression,error,wasm}/`.

Import path difference from mathjs: mathjs uses `../../utils/` (extra `function/` directory level), mathts uses `../utils/`. Import extensions are `.js` in mathts.

### `@danielsimonjr/mathts-core` Exports

Three main systems:
- **Numeric types**: `Complex`, `Fraction`, `BigNumber` with type guards and constants
- **typed-function integration**: `mathTyped` instance, `createMathTSTyped()`, `TypeRegistry`, type test functions (`isNumber`, `isComplex`, `isMatrix`, etc.)
- **Factory pattern**: `FunctionRegistry`, `createFactory()`, `registry`, `math` singleton, `DEFAULT_CONFIG`

### Matrix Backends

`@danielsimonjr/mathts-matrix` supports three backends with automatic selection via `BackendManager`:
- **JSBackend** - Pure TypeScript (default, always available)
- **WASMBackend** - AssemblyScript with SIMD (>1K elements)
- **GPUBackend** - WebGPU compute shaders (>100K elements)

### `@danielsimonjr/mathts-compat` Pattern

Provides mathjs-compatible API via shims:
```typescript
import { create, all } from '@danielsimonjr/mathts-compat';
const math = create(all);
math.add(1, 2);  // delegates to @danielsimonjr/mathts-core types + operations
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
2. Copies function subdirs: `src/function/shared/` → `functions/src/shared/`
3. Copies support dirs from `~/Dropbox/Github/Mathjs/src/{utils,core,plain,type,expression,error,wasm}/` → `functions/src/`
4. Copies standalone files: `types.ts`, `constants.ts`, `factoriesAny.ts`, `factoriesNumber.ts`, `defaultInstance.ts`
5. Copies `types/` definition directory
4. Transforms imports:
   - Relative depth reduction: `../../utils/` → `../utils/` (removes one `../` for any depth)
   - Standalone file: `../../types.js` → `../types.js`
   - Function segment strip: `../../function/<category>/` → `../../<category>/` (for support dir cross-refs)
   - Scoped packages: `@danielsimonjr/typed-function` → `typed-function`, `@danielsimonjr/workerpool` → `workerpool`
   - Extensions: `.ts` → `.js`, adds `.js` to bare relative imports
7. Skips Dropbox conflict files
8. Only writes files that actually changed

**Last sync**: 2026-04-03 (mathjs v15.3.4, 0 module resolution errors)

**Important**: Synced files are dormant — they are NOT exported from `functions/src/index.ts`. Only `functions/src/typed/` contains active implementations. The synced code has ~700 upstream type errors (missing casts, AssemblyScript types) that exist in mathjs itself — `functions/tsconfig.json` uses `strict: false` to allow compilation.

## Known Issues

- `assembly/` WASM build emits AS235 warnings for exported classes (cosmetic — WASM can only export functions, not classes)

## Tools

`tools/` contains standalone utility packages (not workspace members):
- `create-dependency-graph/` - generates package dependency graphs
- `compress-for-context/` - compresses code for LLM context windows
- `chunking-for-files/` - splits large files into chunks

## Versioning

Uses [Changesets](https://github.com/changesets/changesets) for version management. Config in `.changeset/config.json` with `"access": "public"`. Do NOT run `npm publish` autonomously — it requires 2FA.

## Turbo Caching

Turbo caches build/test outputs in `node_modules/.cache/turbo/`. The `test` and `typecheck` tasks depend on `^build` (upstream packages must build first). Use `--force` to bypass cache when debugging stale results.

## Sprint Planning

Sprint JSON files in `docs/Planning/sprints/`: `PHASE_1_SPRINT_1_TODO.json` through `PHASE_6_SPRINT_28_TODO.json`. Architecture docs in `docs/Architecture/Workbook/`.
