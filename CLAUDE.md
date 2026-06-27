# CLAUDE.md

> See `AGENTS.md` for tool-agnostic rules (build/test, file boundaries, and a
> "where to find X" navigation map). This file adds Claude-specific invariants
> and the full monorepo reference.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MathTS is a TypeScript rewrite of mathjs with WASM/WebGPU/WebWorker optimization. It uses an npm workspaces monorepo with Turborepo orchestration. All packages are ESM-only (`"type": "module"`), target ES2022, and use `tsup` for bundling with `vitest` for testing.

It also includes a Scientific Workbook system (`.mtsw` files) for reactive YAML-based notebooks.

## Build & Development Commands

```bash
# From repo root:
npm run build               # turbo run build (all packages)
npm run dev                 # turbo run dev (watch mode, all packages)
npm run test                # turbo run test (all packages)
npm run test:coverage       # turbo run test:coverage (with whitelist for dormant code)
npm run typecheck           # turbo run typecheck (all packages)
npm run lint                # turbo run lint (all packages)
npm run format              # prettier --write all files
npm run format:check        # prettier --check (CI)

# WASM builds. AssemblyScript is the SOLE WASM backend for the whole repo
# (functions + matrix). The Rust→AS migration is COMPLETE (2026-06-26) and the
# Rust toolchain (`wasm-rust/`) has been removed.
npm run build:wasm          # AssemblyScript build (assembly/ package) — the only WASM build
npm run test:wasm           # AssemblyScript WASM tests
npm run test:wasm:integration  # Cross-package WASM integration tests (tests/wasm/)

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

# Coverage (uses whitelist in root vitest.config.ts to exclude dormant code).
# Prefer the npm script — it goes through Turbo for caching:
npm run test:coverage
```

## Monorepo Structure

### Workspaces (in `package.json`)

22 npm workspace packages:

```
packages/typed-function/   # @danielsimonjr/mathts-typed-function - forked type dispatch system
packages/workerpool/       # @danielsimonjr/mathts-workerpool - forked worker pool management
core/                      # @danielsimonjr/mathts-core - types, typed-function integration, factory
matrix/                    # @danielsimonjr/mathts-matrix - DenseMatrix, SparseMatrix, backends (JS/WASM/GPU)
tensor/                    # @danielsimonjr/mathts-tensor - rank-N dense Tensor (Float64Array-backed)
autograd/                  # @danielsimonjr/mathts-autograd - forward + reverse-mode autodiff over Tensor
functions/                 # @danielsimonjr/mathts-functions - math functions via typed dispatch
parallel/                  # @danielsimonjr/mathts-parallel - ComputePool, WebWorker operations
expression/                # @danielsimonjr/mathts-expression - parser/evaluator
workbook/                  # @danielsimonjr/mathts-workbook - .mtsw notebook runtime + CLI
assembly/                  # @danielsimonjr/mathts-wasm - AssemblyScript WASM (the sole WASM backend; build: asbuild:debug/release)
compat/                    # @danielsimonjr/mathts-compat - mathjs API compatibility shim

# Focused re-export packages (thin entry points; no duplicated implementation):
parser/                    # @danielsimonjr/mathts-parser - expression parser surface (re-exports expression)
ast/                       # @danielsimonjr/mathts-ast - expression AST node constructors (re-exports expression)
evaluator/                 # @danielsimonjr/mathts-evaluator - compile/evaluate (re-exports expression)
units/                     # @danielsimonjr/mathts-units - Unit / dimensional analysis (re-exports core)
numbers/                   # @danielsimonjr/mathts-numbers - Complex/Fraction/BigNumber (re-exports core)
linalg/                    # @danielsimonjr/mathts-linalg - matrix decompositions (re-exports matrix)
arithmetic/                # @danielsimonjr/mathts-arithmetic - arithmetic domain (re-exports functions)
trigonometry/              # @danielsimonjr/mathts-trigonometry - trigonometry domain (re-exports functions)
statistics/                # @danielsimonjr/mathts-statistics - statistics domain (re-exports functions)
signal/                    # @danielsimonjr/mathts-signal - signal-processing domain (re-exports functions)
```

### Dependency Graph

```
# Per-package dependencies (verified from each package.json — source of truth):
core        → typed-function
parallel    → workerpool                          # low-level; NOT core/matrix
expression  → core
matrix      → core, parallel
tensor      → core, matrix
autograd    → core, tensor
functions   → core, matrix, parallel, expression
workbook    → core, functions
compat      → core, matrix, parallel, functions

# Same edges read as "← is depended on by":
typed-function ← core
workerpool     ← parallel
core           ← expression, matrix, tensor, autograd, functions, workbook, compat
parallel       ← matrix, functions, compat
expression     ← functions
matrix         ← tensor, functions, compat
tensor         ← autograd

# Focused re-export packages (leaf; depend only on the package they re-export):
core       ← numbers, units
expression ← parser, ast, evaluator
matrix     ← linalg
functions  ← arithmetic, trigonometry, statistics, signal
```

> Generated, always-current form: `docs/Architecture/DEPENDENCY_GRAPH.md` (`npm run docs:deps`).

### Package Build Details

All packages use `tsup src/index.ts --format esm --dts --clean` except:

- **functions**: JS bundle via tsup (no `--dts` — rollup-dts can't bundle the graph), then declarations via `tsc -p tsconfig.dts.json` (a `.d.ts` tree). Build is `tsup src/index.ts --format esm --clean && tsc -p tsconfig.dts.json`. It DOES ship types (as of 0.2.4).
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
- **WASMBackend** - AssemblyScript (source: `assembly/src/`, binary `mathts-as.wasm`), engages above ~1000 elements. This is the sole WASM backend for the whole repo — it serves both the elementwise/basic matrix ops and the heavy ops (`svd`/`eig`/`fft` and all dense decompositions). Falls back to JS when no AS binary has been built.
- **GPUBackend** - WebGPU compute shaders (>100K elements)

### `@danielsimonjr/mathts-compat` Pattern

Provides mathjs-compatible API via shims:

```typescript
import { create, all } from '@danielsimonjr/mathts-compat';
const math = create(all);
math.add(1, 2); // delegates to @danielsimonjr/mathts-core types + operations
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
- `tensor/tests/` - rank-N Tensor construction and ops
- `autograd/tests/` - forward-mode DualTensor, reverse-mode Tape/TapedTensor
- `functions/tests/` - typed arithmetic, signal processing (FFT, convolution), parallel ops, WASM SHA-384 integrity
- `parallel/tests/` - ComputePool, chunking, threshold strategies, elementwise/matmul, WorkerPool timeout
- `compat/tests/` - compatibility layer
- `expression/tests/` - compile, evaluate, `security/sandbox.test.ts` (regression guard for safe-access)
- `workbook/tests/` - executor, graph, parser
- `assembly/tests/run.js` - node + `--experimental-wasm-simd` runner (not vitest)
- `packages/typed-function/tests/`, `packages/workerpool/tests/`
- `tests/integration/` - cross-package instance and function tests
- `tests/wasm/` - cross-package WASM integration tests (run via `npm run test:wasm:integration`)

**Gotcha**: Always `import { describe, it, expect } from 'vitest'` explicitly in test files. The `globals` setting is inconsistent across package configs.

## Security Invariants (do not regress)

Three hard rules from the 2026-05-01 security release. Future edits must preserve them.

- **WASM SHA-384 manifest verification.** `functions/src/wasm/WasmLoader.ts` (Node + browser load paths) and `assembly/src/bindings/wasm-loader.ts` both hash the `.wasm` buffer and compare to `wasm-manifest.json` (generated by `tools/generate-wasm-manifest.mjs`) before compile/instantiate. Do not bypass, weaken to a non-cryptographic check, or skip on streaming compile paths. Regression covered by `functions/tests/security/wasm-integrity.test.ts`.
- **Expression sandbox helpers are mandatory.** Any property/method access in `expression/src/` must route through `getSafeProperty` / `setSafeProperty` / `getSafeMethod` from `expression/src/utils/customs.ts`. ~14 call sites today (compiler, nodes, accessors). Direct `obj[name]` access is a sandbox bypass — see `expression/tests/security/sandbox.test.ts`.
- **WorkerPool timeout is opt-in but supported.** `parallel/src/WorkerPool.ts#execute()` accepts `timeoutMs` and terminates + replaces hung workers. Don't remove the timeout/replacement plumbing when refactoring pool code.

## TypeScript Configuration

- `tsconfig.base.json`: strict mode, ES2022 target, ESNext modules, bundler resolution
- Each package extends the base config
- Import extensions must be `.js` (ESM resolution) — **exception**: `tensor/src/` uses bare relative imports (`from './Tensor'`); tsup bundles it before runtime so the rule isn't enforced there. Match existing style per package.

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
6. Transforms imports:
   - Relative depth reduction: `../../utils/` → `../utils/` (removes one `../` for any depth)
   - Standalone file: `../../types.js` → `../types.js`
   - Function segment strip: `../../function/<category>/` → `../../<category>/` (for support dir cross-refs)
   - Scoped packages: `@danielsimonjr/typed-function` → `typed-function`, `@danielsimonjr/workerpool` → `workerpool`
   - Extensions: `.ts` → `.js`, adds `.js` to bare relative imports
7. Skips Dropbox conflict files
8. Only writes files that actually changed

**Last sync**: mathjs commit `55dea0d71` (2026-04-02; commit message marks `[15.3.4]` but the tag was never pushed — `package.json` version was `15.2.0`). Upstream then performed a TS-split at `e62bcd749` (2026-04-10) removing all `.ts` files from mathjs. Post-split, the sync script's `.ts → .ts` model cannot pull mathjs's new work; further upstream additions require JS→TS porting (see `tools/mathjs-port/`).

**Important**: Synced files are dormant — they are NOT exported from `functions/src/index.ts`. Only `functions/src/typed/` (plus the activated `factories/`) is in the build graph. The dormant synced code carries upstream type errors (missing casts, AssemblyScript types) that exist in mathjs itself, so `functions/tsconfig.json` uses `strict: false`. The **active graph** (everything reachable from `src/index.ts`), however, is type-clean: `tsc --noEmit` reports 0 errors, and `tsc -p tsconfig.dts.json` emits the published `.d.ts` tree. (The old "no types, ~700 errors blocks --dts" note was stale — the real blocker was one TS4023 on `evaluate`, fixed via `ReturnType<typeof createEvaluate>`.)

## Known Issues

- `assembly/` WASM build emits AS235 warnings for exported classes (cosmetic — WASM can only export functions, not classes)
- **Residual dev-only `esbuild` advisory (GHSA-gv7w-rqvm-qjhr).** Patched esbuild is `0.28.1`, but the latest `tsup` (8.5.1) pins `esbuild@^0.27.0`, so the root `overrides` (`esbuild: ^0.28.1`) patches `vite`/everything else but cannot force `tsup`'s nested copy without risking the bundler. `npm audit fix --force` "fixes" this by *downgrading* tsup to 6.5.0 (still vulnerable) — do **not** run it. esbuild ships in no published package and the exploit needs a malicious `NPM_CONFIG_REGISTRY` at install time, so this is accepted until tsup supports esbuild 0.28. Re-evaluate when `tsup@>=8.6` (esbuild `^0.28`) ships.
- **WASM JS-fallback when no AS binary is built.** Both `functions` and `matrix` load the AssemblyScript binary `mathts-as.wasm` (built by `npm run build:wasm`). If that build has not run, the loaders log an `ENOENT … mathts-as.wasm` and fall back to the pure-JS backend (tests stay green). The AssemblyScript `asc` build and all turbo build tasks succeed on Node 26.3.0.

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
