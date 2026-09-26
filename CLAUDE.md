# CLAUDE.md

> See `AGENTS.md` for tool-agnostic rules (build/test, file boundaries, and a
> "where to find X" navigation map). This file adds Claude-specific invariants
> and the full monorepo reference.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MathTS is a TypeScript rewrite of mathjs with WASM/WebGPU/WebWorker optimization. It uses a Bun-managed npm-workspaces monorepo with Turborepo orchestration. All packages are ESM-only (`"type": "module"`), target ES2022, and use `tsup` for bundling with `vitest` for testing.

It also includes a Scientific Workbook system (`.mtsw` files) for reactive YAML-based notebooks.

## Build & Development Commands

```bash
# From repo root (Bun is the package manager — see docs/roadmap/BUN_MIGRATION.md):
bun install
bun run build               # turbo run build (all packages)
bun run dev                 # turbo run dev (watch mode, all packages)
bun run test                # turbo run test (all packages) — NOT `bun test`
bun run test:coverage       # turbo run test:coverage (coverage scoped to an include-list in vitest.config.ts)
bun run typecheck           # turbo run typecheck (all packages)
bun run lint                # turbo run lint (all packages)
bun run format              # prettier --write all files
bun run format:check        # prettier --check (CI)

# WASM builds. AssemblyScript is the SOLE WASM backend for the whole repo
# (functions + matrix).
bun run build:wasm          # AssemblyScript build (assembly/ package) — the only WASM build
                            # (`bun run build` also runs it first; turbo orders matrix/functions after it)
bun run test:wasm           # AssemblyScript WASM tests
bun run test:wasm:integration  # Cross-package WASM integration tests (tests/wasm/)

# Single package:
bunx turbo build --filter=@danielsimonjr/mathts-core
bunx turbo test --filter=@danielsimonjr/mathts-matrix

# Run specific test file (from repo root):
bunx vitest run core/tests/utils.test.ts
bunx vitest run matrix/tests/DenseMatrix.test.ts

# Run tests for one package directly:
cd core && bunx vitest run
cd matrix && bunx vitest run

# Typecheck a single package:
cd functions && bunx tsc --noEmit

# Coverage measurement is scoped to an explicit include-list in root vitest.config.ts.
# Prefer the script via Bun — it goes through Turbo for caching:
bun run test:coverage
```

## Monorepo Structure

### Workspaces (in `package.json`)

24 npm workspace packages:

```
packages/typed-function/   # @danielsimonjr/mathts-typed-function - forked type dispatch system
packages/workerpool/       # @danielsimonjr/mathts-workerpool - forked worker pool management
core/                      # @danielsimonjr/mathts-core - types, typed-function integration, factory
matrix/                    # @danielsimonjr/mathts-matrix - DenseMatrix, SparseMatrix, backends (JS/WASM/GPU)
gpu/                       # @danielsimonjr/mathts-gpu - shared WebGPU foundation (GPUContext/BufferPool/ShaderManager/detect; no domain kernels)
tensor/                    # @danielsimonjr/mathts-tensor - rank-N dense Tensor (Float64Array-backed)
autograd/                  # @danielsimonjr/mathts-autograd - forward + reverse-mode autodiff over Tensor
functions/                 # @danielsimonjr/mathts-functions - math functions via typed dispatch
parallel/                  # @danielsimonjr/mathts-parallel - ComputePool, WebWorker operations
expression/                # @danielsimonjr/mathts-expression - parser/evaluator
workbook/                  # @danielsimonjr/mathts-workbook - .mtsw notebook runtime + CLI
assembly/                  # @danielsimonjr/mathts-wasm - AssemblyScript WASM (the sole WASM backend; build: asbuild:debug/release)
compat/                    # @danielsimonjr/mathts-compat - mathjs API compatibility shim
plot/                      # @danielsimonjr/mathts-plot - 2D/3D plotting (SVG/TikZ + PNG/PDF render bridge; workbook chart adapter)

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
parallel    → workerpool, core                    # core ONLY for the stable numeric
#                                                  primitives (pairwiseSum/norm2); still NOT matrix
expression  → core
matrix      → core, parallel, gpu
tensor      → core, matrix
autograd    → core, tensor
functions   → core, matrix, parallel, expression
workbook    → core, functions, expression, plot
compat      → core, matrix, parallel, functions
plot        → core, functions, expression

# Same edges read as "← is depended on by":
typed-function ← core
workerpool     ← parallel
core           ← expression, matrix, tensor, autograd, functions, workbook, compat, plot, parallel
parallel       ← matrix, functions, compat
expression     ← functions, plot, workbook
matrix         ← tensor, functions, compat
tensor         ← autograd
gpu            ← matrix

# Focused re-export packages (leaf; depend only on the package they re-export):
core       ← numbers, units
expression ← parser, ast, evaluator
matrix     ← linalg
functions  ← arithmetic, trigonometry, statistics, signal
```

> Generated, always-current form: `docs/Architecture/DEPENDENCY_GRAPH.md` (`npm run docs:deps`).

### Package Build Details

Every package builds JS with tsup and declarations with tsc: `tsup src/index.ts --format esm --clean && tsc -p tsconfig.dts.json` (a `.d.ts` tree, emitted under `nodenext` via `tsconfig.dts.base.json` so relative specifiers carry `.js`). **Never pass `--dts` to tsup**: its rollup-plugin-dts drives the TypeScript JS API (`ts.sys`), which TypeScript 7 — the native Go port — does not have, so it crashes with `undefined is not an object (evaluating 'ts2.sys.useCaseSensitiveFileNames')`. Variations:

- **core / workbook / plot**: config-driven `tsup` (`tsup.config.ts` holds the entries; workbook builds `src/index.ts`, `src/cli.ts`, `src/run-worker.ts`).
- **matrix / functions**: then `node scripts/copy-wasm.mjs`, which co-locates the AS binary as `dist/wasm/mathts-as.wasm` and FAILS if it is missing.
- **packages/workerpool**: then `node scripts/postbuild.mjs` (ships the ambient `workerpool` shim).
- **assembly**: AssemblyScript build (`asc src/index.ts`) + TypeScript bindings (`tsc -p tsconfig.bindings.json`).
- **`build:prod`** is `build` with `--minify --treeshake` on the tsup step; **`dev`** is the tsup step with `--watch --onSuccess "<the rest of build>"`. Keep all three in step when a build changes.

## Architecture

### Code in `functions/` (single active graph)

Everything remaining in `functions/src/` is reachable from `functions/src/index.ts` — there is **one** active code graph, not the old active/dormant split:

- **Typed functions** (`functions/src/typed/`): parallel-first implementations using `@danielsimonjr/mathts-core` typed dispatch (e.g. `arithmetic.ts`, `trigonometry.ts`, `statistics.ts`, `signal.ts`, `cas.ts`). Exported directly from `index.ts`.
- **Activated mathjs factories** (`functions/src/factories/index.ts` + the category dirs it imports — `arithmetic/`, `algebra/`, `type/`, `utils/`, `plain/`, etc.): factory-pattern functions that originated from the mathjs fork and have since been **wired into the live graph** via `factories/index.ts` (re-exported from `index.ts`). These ARE built and shipped.
- **WASM bridges** (`functions/src/wasm/`): the `*Dispatch`/`wasm-bridge.ts` bridges imported by `typed/` (`elementwise/`, `special/`, `sort/`, `signal/`, `poly/`, `interpolation/`, `bitwise/`), the shared `bridges/common.ts`, the canonical `special/scalars.ts` (imported by both `typed/special.ts` and the special bridge), plus `WasmLoader.ts` / `integrity.ts` / `resolve.ts`. The real WASM backend is `assembly/src/` (built by `npm run build:wasm`); these are only the JS-side dispatch/loader surface.

> **History (2026-06-27 dormant purge):** functions/ previously carried a large _second_ layer — unexported, unreachable synced-mathjs code that the (now-dead) `.ts→.ts` sync model dumped in. After the mathjs TS-split broke syncing, that dormant remnant was deleted: **455 files / ~58.6k LOC** across `functions/` + `core/`, the largest single chunk being the entire dead `functions/src/expression/` mirror (313 files — the real expression evaluator lives in the `expression` package, wired via `factories/evaluate.ts`). A handful of legacy synced files were KEPT because they are exercised by their own direct tests (`functions/src/signal/{fft,conv}.ts`, `functions/src/type/local/Decimal.ts`).

> **History (2026-06-27 vestigial WASM-source purge):** a _second_ dead layer under `functions/src/wasm/` — pre-migration AssemblyScript source written as `.ts` (using AS intrinsics `usize`/`i32`/`f64`/`load`/`store`/`v128`) — was deleted: **26 files / ~14k LOC** (`matrix/`, `algebra/`, `complex/`, `geometry/`, `logical/`, `numeric/`, `plain/`, `relational/`, `set/`, `signal/{fft,processing}.ts`, `simd/`, `special/functions.ts`, `statistics/`, `string/`, `utils/workPtrValidation.ts`) plus the `wasm/index.ts` aggregator that re-exported them. They were unreachable from `functions/src/index.ts` and only soft-imported by the `tests/wasm/typescript-integration.test.ts` skip-on-fail smoke test (since trimmed). The real WASM backend is `assembly/src/`; these `.ts` copies generated ~9k false `no-undef` lint warnings on AS intrinsics.

`functions/tsconfig.json` now uses `strict: true` (flipped 2026-06-27). The former ~430 strict-mode violations across the active graph (activated factories like `arithmetic/floor.ts`, `algebra/simplify.ts`, plus the path-mapped `expression`/`core` sources) were fixed honestly — no blanket `any`/`@ts-ignore`. The single largest root cause was typed-function dispatch: the published `SignatureFunction` (`(...args: unknown[]) => unknown`) rejected concrete-typed implementations under `strictFunctionTypes` (params are contravariant); the fix introduced `MathTSTyped`/`SignatureImpl` in `core/src/typed/mathts-typed.ts` (and mirrored input-position types in `functions/src/core/function/typed.ts`) using the `never[]` top-type for "any function" in input positions, collapsing ~300 errors. The remainder were genuine null-safety guards / narrowing (and two CSparse port typos in `csChol`/`csSqr` fixed at root).

Import path difference from mathjs: mathjs uses `../../utils/` (extra `function/` directory level), mathts uses `../utils/`. Import extensions are `.js` in mathts.

### `@danielsimonjr/mathts-core` Exports

Three main systems:

- **Numeric types**: `Complex`, `Fraction`, `BigNumber` with type guards and constants
- **typed-function integration**: `mathTyped` instance, `createMathTSTyped()`, `TypeRegistry`, type test functions (`isNumber`, `isComplex`, `isMatrix`, etc.)
- **Factory pattern**: `FunctionRegistry`, `createFactory()`, `registry`, `math` singleton, `DEFAULT_CONFIG`

### Matrix Backends

`@danielsimonjr/mathts-matrix` supports three backends with automatic selection via `BackendManager`:

- **JSBackend** - Pure TypeScript (default, always available)
- **WASMBackend** - AssemblyScript (source: `assembly/src/`, binary `mathts-as.wasm`; the repo's one AS binary). **Scoped by the 2026-07 WASM audit to where SIMD actually wins:** matrix **multiply** (SIMD `f64x2` kernel, engages ≥256 elements) and the dense **LU/QR/Cholesky/inverse/determinant** decompositions. Element-wise ops, transpose, reductions, `eig`, and `svd` run on **JS** — they were measured 0.2–6× _slower_ on WASM (memory-bound, or scalar iterative kernels), so their WASM paths were retired and the eig/svd AS kernels deleted (see CHANGELOG / `tools/benchmarks/`). Falls back to JS when no AS binary has been built. (FFT/signal WASM is a separate `functions/src/wasm/signal/` path, not this backend.)
- **GPUBackend** - WebGPU compute shaders (>100K elements). The generic foundation (`GPUContext` device/adapter lifecycle, `BufferPool`, capability `detect`, and the generic `ShaderManager` compile/cache/pipeline API) now lives in the shared leaf package `@danielsimonjr/mathts-gpu`; matrix re-exports the whole foundation for back-compat and keeps only its own domain kernels (`BUILTIN_SHADERS` — matmul/transpose/reduce WGSL), registering them onto the shared `ShaderManager` at `GPUBackend` init.

### `@danielsimonjr/mathts-compat` Pattern

Provides mathjs-compatible API via shims:

```typescript
import { create, all } from '@danielsimonjr/mathts-compat';
const math = create(all);
math.add(1, 2); // delegates to @danielsimonjr/mathts-core types + operations
```

### Workbook Runtime

Headless runtime for YAML notebooks (`.mtsw` files). Code/test cells evaluate
**MathTS expressions** via the sandboxed engine (not TypeScript); a GUI is a
separate future project. Key source files in `workbook/src/`:

- `types.ts` - `Workbook`, `Cell`, `DependencyGraph`, `CellResult`, `RunResult`
- `parser.ts` - `.mtsw` → `Workbook` (validates ids/types/deps); `serializeWorkbook` (round-trip serialize, commit `9d978f5`) + `importWorkbook`
- `yaml-safe.ts` - shared hardened YAML parse (core schema, merges off) + prototype-pollution guard, used by parser and data cells
- `graph.ts` - dependency resolution, topological sort, cycle detection, `toMermaid`
- `executor.ts` - `WorkbookExecutor`: `runCell`/`runAll` (event stream, throws on error) and `runReport` (continue-on-error, structured report); `test` cells are boolean assertions
- `formatter.ts` - `formatResult` (crash-proof rendering of cell results)
- `cli.ts` - `mtsw` CLI (`run`/`validate`/`graph`); handlers return `{stdout,stderr,exitCode}`

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

**CI gates beyond pass/fail** (both run locally with `node`, never `bun run`):

- **Skip budget** (`node tools/test/check-skip-budget.mjs test-output.log`, after `bun run test 2>&1 | tee test-output.log`): fails when any suite skips more tests than `tools/test/skip-baseline.json` allows, skips fewer (lower the baseline in the same change), or prints no summary. Nine WASM-tier suites once skipped on every machine for months, 57 tests, while every gate stayed green.
- **Consumer type check** (`node tools/test/consumer-typecheck.mjs [--module-resolution=NodeNext] [--skip-build]`): packs every public package, installs the tarballs into a fresh project, type-checks every entry point with `skipLibCheck: false`, asserts that each runtime-function export is callable in its `.d.ts` (about 2,300), and checks that the shipped `mathts-as.wasm` is present, valid, and matches its SHA-384 manifest. The monorepo's own `tsc` cannot see these failures: it reads `src`, not the emitted `.d.ts`, and it resolves `typed-function` through the in-repo ambient shim (`core/src/typed-function.d.ts`), while consumers get the published fork's declarations. So a type exported only by the shim, such as `SignatureImpl`, must not be imported from `'typed-function'` in shipped code.

## Security Invariants (do not regress)

Three hard rules from the 2026-05-01 security release. Future edits must preserve them.

- **WASM SHA-384 manifest verification.** The canonical hash-and-compare logic (`sha384OfBuffer` / `verifyWasmIntegrity`) lives in **`core/src/wasm-loader.ts`** (exported via `@danielsimonjr/mathts-core/internal`; consolidated there 2026-07-18 — was duplicated in functions + matrix). It is re-exported and invoked by `functions/src/wasm/WasmLoader.ts` + `matrix/src/backends/WasmLoader.ts` (Node + browser load paths) and independently by `assembly/src/bindings/wasm-loader.ts`, which all hash the `.wasm` buffer and compare to `wasm-manifest.json` (generated by `tools/generate-wasm-manifest.mjs`) before compile/instantiate. Do not bypass, weaken to a non-cryptographic check, or skip on streaming compile paths. Regression covered by `functions/tests/security/wasm-integrity.test.ts`.
- **Expression sandbox helpers are mandatory.** Any property/method access in `expression/src/` must route through `getSafeProperty` / `setSafeProperty` / `getSafeMethod` from `expression/src/utils/customs.ts`. ~14 call sites today (compiler, nodes, accessors). Direct `obj[name]` access is a sandbox bypass — see `expression/tests/security/sandbox.test.ts`.
- **WorkerPool timeout is opt-in but supported.** `parallel/src/WorkerPool.ts#execute()` accepts `timeoutMs` and terminates + replaces hung workers. Don't remove the timeout/replacement plumbing when refactoring pool code.

## TypeScript Configuration

- `tsconfig.base.json`: strict mode, ES2022 target, ESNext modules, bundler resolution
- Each package extends the base config
- **All packages compile under `strict: true`** (as of 2026-06-27 — `functions` and `expression` were the last holdouts; no package overrides `strict` to `false`).
- **No package relaxes `noUnusedLocals` / `noUnusedParameters` / `noImplicitReturns` / `noFallthroughCasesInSwitch`** either (as of 2026-06-27 — `functions` and `expression` were the last holdouts here too); all four inherit base's `true`. Note: TypeScript (unlike ESLint) does **not** honor `// falls through` comments — switch fallthrough is only allowed from an _empty_ case clause.
- **Lint: oxlint, repo-wide ZERO, warnings included** (`bun run lint` = `oxlint --deny-warnings .`, config `.oxlintrc.json`; ESLint and typescript-eslint are gone from the tree). The 2026-06-28 ESLint campaign replaced ~3,500 `no-explicit-any` with real types (unions / generics / `unknown`+narrow). After the move to oxlint, 38 warnings accumulated unseen because plain `oxlint` exits 0 on warnings; they were fixed 2026-09-25 and `--deny-warnings` now keeps it at zero. No `@ts-nocheck`, no blanket suppressions; a justified one-line exception is `// eslint-disable-next-line <rule> -- <reason>` (oxlint honours it). Two documented ignore groups in `.oxlintrc.json` (NOT impl code): **(1)** AssemblyScript source under `assembly/src/` (the `algebra`/`ops`/`env`/`types` dirs + top-level `*.ts`) — compiled + type-checked by `asc` (`bun run build:wasm`), exercised by `bun run test:wasm`; its `@inline`/`@operator` decorators and `i32`/`f64`/`usize` value types are not TypeScript (the loader bindings under `assembly/src/bindings/` stay linted). **(2)** `**/*.d.ts` ambient declaration files (type-only, tsc-checked). Test files are linted everywhere and **type-checked in every TypeScript package** (23 of 24; `assembly` is AssemblyScript, tested by `tests/run.js`): each has a `tsconfig.test.json` (`noEmit`), and its `typecheck` script is `tsc --noEmit && tsc -p tsconfig.test.json`. Typed functions return `unknown` by design, so tests narrow results at the point of use (`as number[]`); a cast to pass a deliberately partial mock sits at one commented choke point per file. Turning it on (2026-09-25) found public typing bugs that a source-only check cannot see, because a test is the first caller: `BigNumberValue` accepted no real BigNumber, compat's `Chain` could not chain, `MathJSConfig` hid `relTol`/`absTol`, `createSafeConversion` rejected typed constructors, 131 `functions` exports were not callable, seven expression node classes lacked the base `Node` members, `parse('x')` returned a union, the hypothesis tests returned an unnarrowable union without `bootstrap`, `solveODE`/`freqz`/`zpk2tf` were published as `any`, and the unit-valued physical constants were typed as a one-field stub. All are fixed; `tools/test/consumer-typecheck.mjs` now asserts that every runtime-function export is callable in the packed `.d.ts`.
- Import extensions must be `.js` (ESM resolution) — **exception**: `tensor/src/` uses bare relative imports (`from './Tensor'`); tsup bundles it before runtime so the rule isn't enforced there. Match existing style per package.

## Code Style

- Files: `kebab-case.ts`, Classes: `PascalCase`, Functions/Variables: `camelCase`, Constants: `UPPER_SNAKE_CASE`
- Commit messages: Conventional Commits (`feat(matrix):`, `fix(workbook):`, etc.)
- Pre-commit hook (husky + lint-staged): auto-runs `oxlint --fix` + `prettier --write` on staged files, then `check:duplicates:fast` (the cross-package duplicate-symbol gate — fails the commit on any NEW `TRUE_DUPLICATE` beyond `docs/Architecture/duplicate-baseline.json`; see Tools → CDG)

## Syncing from mathjs

**The `.ts→.ts` sync model is dead — do not try to re-sync.** Historically the `functions/` package was bulk-copied from the mathjs fork by `~/.claude/scripts/sync_mathjs_to_mathts.py` (copy `.ts` category/support dirs + standalone files, rewrite import depth/extensions). That script is now **moot**: upstream mathjs performed a TS-split at commit `e62bcd749` (2026-04-10) removing all `.ts` files, so the last real sync was `55dea0d71` (2026-04-02) and nothing further can be pulled as TypeScript. The script file still exists on the maintainer's machine but **should not be run** — running it would do nothing useful and could resurrect deleted dead code.

What this means for the codebase today:

- The **valuable** synced code has been **activated** — wired into the live graph via `functions/src/factories/index.ts` (reachable from `functions/src/index.ts`). That is now first-class active code; edit it like any other source.
- The **dead** synced remnant (unexported AND unreachable AND untested) was **deleted on 2026-06-27**: 455 files / ~58.6k LOC across `functions/` + `core/` (the bulk being the dead `functions/src/expression/` mirror). See "Code in `functions/`" above.
- Future upstream additions require manual JS→TS porting, not syncing — the porting workspace lives in `tools/mathjs-port/` (one-off scaffolding/drafts; not a workspace member, not part of the build).

The **active graph** (everything reachable from each package's `src/index.ts`) is type-clean: `bun run typecheck` reports 0 errors (33/33 tasks; the count includes `@danielsimonjr/mathts-wasm#build`, which the `matrix`/`functions` build edges pull into the graph), and `functions` emits its published `.d.ts` tree via `tsc -p tsconfig.dts.json`. All packages compile under `strict: true` (see the functions-layer note above for the 2026-06-27 strict-flip root cause).

## Known Issues

- **Bun `--tsconfig-override` prints a spurious internal error.** `docs:functions` / `docs:functions:check` run Bun with `--tsconfig-override=tsconfig.base.json` so the tool imports each package's built `dist` instead of the root `paths` (`src`). Bun 1.4.2 honours the override but prints `Internal error: directory mismatch for directory ".../tsconfig.base.json", fd 3. You don't need to do anything, but this indicates a bug.` for ANY file path passed to it (measured: repo file, `./` prefix, absolute path, a `tsconfig.json` elsewhere). Harmless upstream Bun bug; the check's exit code and output are unaffected.
- **`bun install --frozen-lockfile` does not detect a lock that violates its own `overrides`.** The committed lock resolved `esbuild@0.27.7` under `overrides: { esbuild: ^0.28.1 }` for weeks, keeping GHSA-g7r4-m6w7-qqqr (esbuild dev server, low) open while CI stayed green. Fixed 2026-09-25 with `bun update esbuild` (a 27-line lock change: esbuild + its platform binaries to 0.28.2; tsup declares `^0.27.0`, so the bundles were diffed against 0.27.7 output — identical apart from esbuild's own `__esm`/`__commonJS` error-handling fixes and chunk hashes — and the full suite, dist smoke test and both consumer type checks passed). `bun audit` now reports 0 at every level. After editing `overrides`, re-resolve the affected package with `bun update <pkg>`, and run `bun audit` without `--audit-level`: CI's high+ floor cannot see a low.
- **The build requires the AS binary; the runtime does not.** `bun run build` compiles `assembly/` first (turbo.json orders `matrix#build` and `functions#build` after `@danielsimonjr/mathts-wasm#build`) and both `copy-wasm.mjs` scripts fail when the binary is missing. Before 2026-09-25 they warned and exited 0 with no ordering edge, so the copy raced `asc` and Turbo cached a wasm-less `dist` that it replayed even after the wasm existed: a cold `bun install && bun run build && bun run test` failed `wasm-resolve.test.ts`. At runtime, consumers still fall back to pure JS when the binary cannot be loaded.
- **`functions`' WASM tier is opt-in and follows a measured dispatch policy.** Nothing loads the AS binary until the consumer calls `await loadWasm()` (exported; `isWasmLoaded()` reports it). Once loaded, each bridge still consults `functions/src/wasm/policy.ts` (`wasmPolicyAllows(kernel, n)`), keyed by AS export name: a kernel dispatches only in the size band where `tools/benchmark/wasm/opt-in.bench.ts` measured the public call faster in two Node runs (2026-09-26). That is the fused chain, the three least-squares fits, `abs`/`log10`/`sin`/`log1p`/`cos`/`atanh`/`log`/`sec` in bands, and `lgamma`/`sort_f64` from 1M. Every other kernel keeps its JS path, because WASM measured slower (welch/bartlett PSD 4.0-4.6x, resultant/discriminant and Newton/Lagrange about 4x, chirp-Z 3.3x, bitwise 2.4-3.3x, polymul 2.7x, ...). To change an entry, re-run the benchmark twice (`node tools/benchmark/wasm/run-node.mjs opt-in`) and cite both runs in the comment. Tests that prove a kernel itself opt in with `overrideWasmPolicy({ '*': { min: 0 } })`, so they keep exercising it. `applyWindowDispatch`, `rankF64Dispatch` and `shapiroWilkTest`'s WASM sort (n is capped at 5,000, and the threshold is 16,384) are unreachable from the public API.
- **The AS binary's stub runtime never frees; keep module state off its heap.** `--runtime stub` is a bump allocator, and `__unpin` does nothing, so every `__new` is permanent. The `functions` bridges call the binary's `heap_reset` (`assembly/src/heap.ts`) after each managed call. That is safe only because no AS module state lives on the heap (every module-level binding is a scalar constant), so a heap-allocated global would be silently overwritten. `matrix` does not reset: it pools its buffers, and its decomposition kernels work in caller-provided scratch (`matrix_qr_decompose`'s `v_work`, `matrix_inverse`'s `work` of n·n + n). A kernel must not `new` scratch that a caller could pass. Before this was fixed (2026-09-26), 200 `welchPSD` calls grew memory by 403 MiB and 300 matrix LUs by 16 MiB; the regression tests are `functions/tests/wasm-heap-bounded.test.ts` and `matrix/tests/backends/wasm-memory-bounded.test.ts`.
- **`polynomialGCD` on non-integer inputs still uses floating-point Euclid.** Since 2026-09-25, inputs whose coefficients are all safe integers take an exact bigint primitive PRS (`polyGcdZ`); that fixed the measured failure (GCD of a degree-266 polynomial and a random integer cubic was wrong in 53/300 draws). Other inputs keep float Euclid, where `xⁿ mod b` is dominated by `λⁿ·b(x)/(x−λ)` (λ the largest root of `b`), so a coprime high-degree pair can still come back with a spurious low-degree factor. Scale rational coefficients to integers when exactness matters.
- **core's `deepMap` / `deepForEach` / `reduce` (`/internal`) are typed for flat arrays.** They take `T[] | Matrix<T>` with `T` tied to the callback's element type, but recurse into nested arrays, their normal input; `functions`' `sum`/`max` cast around it and tests use one commented cast. The honest signature is `NestedArray<T> | Matrix<T>` with a nested result type, which changes return types at ~40 import sites, so it is a follow-up rather than a drive-by.
- **The pre-commit `docs:functions` step reads each package's built `dist`.** It is build-free: it runs with `--tsconfig-override=tsconfig.base.json` so it imports the dist, not `src`. After changing a package's exports, rebuild before committing, or the hook regenerates the function reference from the stale dist and `functions`' docs-completeness test fails on the new export.

## Tools

`tools/` contains standalone utility packages (not workspace members):

- `create-dependency-graph/` (**CDG**) - generates package dependency graphs (reachable vs dormant analysis; `npm run docs:deps`). _**CDG** and the legacy nickname **DGT** are shorthand for this same tool — prefer CDG._ Also emits the classification-aware **cross-package duplicate-symbol** report (`docs/Architecture/duplicate-symbols.{json,md}`, `detectDuplicateSymbols`): every own-defined export grouped by name across packages, tagged `TRUE_DUPLICATE` / `DISPATCH_VARIANT` / `ALIAS_DELEGATION` / `ALLOWLISTED` (allowlist: `tools/create-dependency-graph/duplicate-allowlist.json`, each entry carries a reason; intentional reimplementations are pinned by a parity/oracle test — see `feedback-allowlist-needs-parity-guard`). The 2026-07 dedup campaign drove `TRUE_DUPLICATE` **253 → 0**; the `check:duplicates`(`:fast`) gate (baseline `docs/Architecture/duplicate-baseline.json`) keeps it there by failing commits that add new duplicates. Also emits a **complete file census** (`docs/Architecture/FILE_INVENTORY.md` + `file-inventory.json`, `buildFileInventory`): EVERY tracked `.ts` in the repo — package `src/` + `tests/`, the repo-ROOT cross-package `tests/`, `tools/`, build/test `*.config.ts`, `examples/`, `docs/` — tagged `reachable`/`build-entry`/`test-only`/`orphan`/`test`/`tool`/`config`/`example` (inclusion over exclusion; no silent allowlist). **1768 files** as of 2026-07-21 (== git-tracked `.ts`; excludes only `node_modules`/`dist`/`*.d.ts`/dot-dirs) — this number moves with every added `.ts`, so read the live count from `npm run check:file-census` rather than trusting it here. The **self-check gate** (`verifyFileCensus`) uses a MAXIMAL, location-agnostic repo walk (`walkRepoTsFiles`) as ground truth — deliberately BROADER than the census's enumerated discovery, so it catches a scoping gap the census would miss (a `.ts` in a new top-level dir), plus any `orphan`. It HARD-FAILS `npm run docs:deps` (non-zero exit) inside the regen path, and there's a standing no-regen gate `npm run check:file-census` (`--check-census`, like `check:duplicates:fast`) that fails if a `.ts` was added anywhere in the repo since the last `docs:deps`. (An earlier version scoped both census AND gate per-package, so the gate shared the census's blind spot and missed 11 repo-root tests — fixed by making the gate's walk maximal.) Build roots are detected from build-script strings AND, for config-driven `tsup` (bare `tsup` script), from `<pkg>/tsup.config.ts`'s `entry:[…]` array (`tsupConfigEntries`).
- `roadmap-check/` - advisory feature-lifecycle consistency gate (`npm run docs:roadmap-check`): verifies ROADMAP "Recently Shipped" `pkg@version` claims against the live npm registry + flags unchecked TODO items whose referenced file already exists. See `docs/FEATURE_WORKFLOW.md`.
- `query-dependency-graph/` (**QDG**) - query surface + derived reports over CDG's `dependency-graph.json` (no re-parse; the read-only consumer counterpart to `create-dependency-graph`). Emits `dependency-reverse.json` (reverse edges) + `node-safety.json` (node:-taint + browser-safety leaks) as part of `npm run docs:deps`. **Consult it before grepping for structure** (`npm run docs:graph -- <query>`):
  - `dependents <file>` — who imports this file (intra-package)
  - `symbol-users <symbol>` — who imports this symbol (any package, cross-package)
  - `is-public <pkg> <symbol>` — is it in the package's public export surface?
  - `node-safety [pkg]` — node:-using files reachable from a browser-safe `.` entry
  - `cycles` — circular dependencies
  - Gate: `npm run check:browser-safety` (exit 1 if plot's `.` entry reaches node: code).
- `compress-for-context/` - compresses code for LLM context windows
- `chunking-for-files/` - splits large files into chunks
- `mathjs-port/` - one-off JS→TS porting scaffolding/drafts for pulling new upstream mathjs work now that the `.ts→.ts` sync model is dead (see "Syncing from mathjs"). Not a workspace member; not built.

## Versioning

Uses [Changesets](https://github.com/changesets/changesets) for version management. Config in `.changeset/config.json` with `"access": "public"`.

## Turbo Caching

Turbo caches build/test outputs in `.turbo/cache/` (Turbo 2). `matrix#build` and `functions#build` also depend on `@danielsimonjr/mathts-wasm#build`, which orders them after `asc` and folds the wasm build's hash into theirs; a cache hit restores `assembly/build/` too. `typecheck` depends on `^build` (upstream packages built first). `test` and `test:coverage` depend on **`["^build", "build"]`** — a package's own `build` runs before its tests, so `dist/` artifacts (e.g. the co-located `mathts-as.wasm` that `matrix`/`functions` load) exist; without this, a cold `npm run test` fails the wasm-resolution guards (ENOENT on the un-built binary). Use `--force` to bypass cache when debugging stale results.

## Sprint Planning

Sprint JSON files (historical, all phases complete) are archived in `docs/archive/sprints/`: `PHASE_1_SPRINT_1_TODO.json` through `PHASE_6_SPRINT_28_TODO.json`. Architecture docs in `docs/Architecture/Workbook/`.
