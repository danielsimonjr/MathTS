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
npm run test:coverage       # turbo run test:coverage (coverage scoped to an include-list in vitest.config.ts)
npm run typecheck           # turbo run typecheck (all packages)
npm run lint                # turbo run lint (all packages)
npm run format              # prettier --write all files
npm run format:check        # prettier --check (CI)

# WASM builds. AssemblyScript is the SOLE WASM backend for the whole repo
# (functions + matrix).
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

# Coverage measurement is scoped to an explicit include-list in root vitest.config.ts.
# Prefer the npm script — it goes through Turbo for caching:
npm run test:coverage
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

All packages use `tsup src/index.ts --format esm --dts --clean` except:

- **functions**: JS bundle via tsup (no `--dts` — rollup-dts can't bundle the graph), then declarations via `tsc -p tsconfig.dts.json` (a `.d.ts` tree). Build is `tsup src/index.ts --format esm --clean && tsc -p tsconfig.dts.json`. It DOES ship types (as of 0.2.4).
- **workbook**: builds two entry points (`src/index.ts` and `src/cli.ts`)
- **assembly**: AssemblyScript build (`asc src/index.ts`) + TypeScript bindings (`tsc -p tsconfig.bindings.json`)

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
- **eslint: repo-wide ZERO** (as of 2026-06-28) — every package's implementation (`src` **and** `tests`) passes `eslint .` with 0 problems, fixed honestly: real types replaced ~3,500 `no-explicit-any` (unions / generics / `unknown`+narrow), no `@ts-nocheck`, no blanket suppressions. Two documented exclusions in `eslint.config.js` (NOT impl code): **(1)** AssemblyScript source under `assembly/src/` (the `algebra`/`ops`/`env`/`types` dirs + top-level `*.ts`) — compiled + type-checked by `asc` (`npm run build:wasm`), exercised by `npm run test:wasm`; typescript-eslint cannot parse its `@inline`/`@operator` decorators or `i32`/`f64`/`usize` value types (the loader bindings under `assembly/src/bindings/` stay linted). **(2)** `**/*.d.ts` ambient declaration files (type-only, tsc-checked). Beware: turbo's lint cache + lint-staged (staged-only) can mask accumulated lint errors — verify with a direct `eslint .` per package, not the cached aggregate.
- Import extensions must be `.js` (ESM resolution) — **exception**: `tensor/src/` uses bare relative imports (`from './Tensor'`); tsup bundles it before runtime so the rule isn't enforced there. Match existing style per package.

## Code Style

- Files: `kebab-case.ts`, Classes: `PascalCase`, Functions/Variables: `camelCase`, Constants: `UPPER_SNAKE_CASE`
- Commit messages: Conventional Commits (`feat(matrix):`, `fix(workbook):`, etc.)
- Pre-commit hook (husky + lint-staged): auto-runs `eslint --fix` + `prettier --write` on staged files, then `check:duplicates:fast` (the cross-package duplicate-symbol gate — fails the commit on any NEW `TRUE_DUPLICATE` beyond `docs/Architecture/duplicate-baseline.json`; see Tools → CDG)

## Syncing from mathjs

**The `.ts→.ts` sync model is dead — do not try to re-sync.** Historically the `functions/` package was bulk-copied from the mathjs fork by `~/.claude/scripts/sync_mathjs_to_mathts.py` (copy `.ts` category/support dirs + standalone files, rewrite import depth/extensions). That script is now **moot**: upstream mathjs performed a TS-split at commit `e62bcd749` (2026-04-10) removing all `.ts` files, so the last real sync was `55dea0d71` (2026-04-02) and nothing further can be pulled as TypeScript. The script file still exists on the maintainer's machine but **should not be run** — running it would do nothing useful and could resurrect deleted dead code.

What this means for the codebase today:

- The **valuable** synced code has been **activated** — wired into the live graph via `functions/src/factories/index.ts` (reachable from `functions/src/index.ts`). That is now first-class active code; edit it like any other source.
- The **dead** synced remnant (unexported AND unreachable AND untested) was **deleted on 2026-06-27**: 455 files / ~58.6k LOC across `functions/` + `core/` (the bulk being the dead `functions/src/expression/` mirror). See "Code in `functions/`" above.
- Future upstream additions require manual JS→TS porting, not syncing — the porting workspace lives in `tools/mathjs-port/` (one-off scaffolding/drafts; not a workspace member, not part of the build).

The **active graph** (everything reachable from each package's `src/index.ts`) is type-clean: `npm run typecheck` reports 0 errors (28/28 tasks), and `functions` emits its published `.d.ts` tree via `tsc -p tsconfig.dts.json`. All packages compile under `strict: true` (see the functions-layer note above for the 2026-06-27 strict-flip root cause).

## Known Issues

- `assembly/` WASM build emits AS235 warnings for exported classes (cosmetic — WASM can only export functions, not classes)
- **Residual dev-only `esbuild` advisory (GHSA-g7r4-m6w7-qqqr, low).** _"esbuild allows arbitrary
  file read when running the development server on Windows."_

  > **Corrected 2026-08-30.** This entry previously named **GHSA-gv7w-rqvm-qjhr**, which is a
  > **WITHDRAWN** advisory, and carried its rationale — that the exploit _"needs a malicious
  > `NPM_CONFIG_REGISTRY` at install time"_. That describes a different vulnerability. A security
  > note reasoning about the wrong advisory is worse than none: it reads as a considered acceptance
  > while covering nothing that is actually open.

  **Why it is accepted:** the vulnerability is in esbuild's **development server**. `tsup` uses
  esbuild's **build API** and never starts that server, so the vulnerable path is unreachable here.
  That is the reachability argument; it is not a claim that the advisory is unfixable.

  **State of the dependency tree** (measured, not assumed):

  ```
  vulnerable range              0.27.3 - 0.28.0
  tsup 8.5.1 requires           esbuild ^0.27.0   =  >=0.27.0 <0.28.0
  node_modules/esbuild          0.28.1   <- root `overrides` reaches this copy
  tsup/node_modules/esbuild     0.27.7   <- the override does NOT reach this one
  ```

  The root `overrides: { esbuild: ^0.28.1 }` patches the top-level copy only; tsup keeps a nested
  0.27.7 because 0.28.1 is outside its declared range.

  **A fix inside tsup's range does exist** — `0.27.0`/`0.27.1`/`0.27.2` are all `^0.27.0`-compatible
  _and_ below the vulnerable floor. Pinning `overrides: { tsup: { esbuild: "0.27.2" } }` is the
  candidate. **Untested:** a full re-resolve to apply it currently fails on an unrelated
  pre-existing `ERESOLVE` (`@typescript-eslint/eslint-plugin@^8.67.0` vs peer
  `@typescript-eslint/parser@8.68.0`), so the experiment is blocked rather than the fix being
  unavailable. Do **not** run `npm audit fix --force` — it "fixes" this by _downgrading_ tsup to
  6.5.0, which is still vulnerable.

- **WASM JS-fallback when no AS binary is built.** Both `functions` and `matrix` load the AssemblyScript binary `mathts-as.wasm` (built by `npm run build:wasm`). If that build has not run, the loaders log an `ENOENT … mathts-as.wasm` and fall back to the pure-JS backend (tests stay green). The AssemblyScript `asc` build and all turbo build tasks succeed on Node 26.3.0.

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

Turbo caches build/test outputs in `node_modules/.cache/turbo/`. `typecheck` depends on `^build` (upstream packages built first). `test` and `test:coverage` depend on **`["^build", "build"]`** — a package's own `build` runs before its tests, so `dist/` artifacts (e.g. the co-located `mathts-as.wasm` that `matrix`/`functions` load) exist; without this, a cold `npm run test` fails the wasm-resolution guards (ENOENT on the un-built binary). Use `--force` to bypass cache when debugging stale results.

## Sprint Planning

Sprint JSON files (historical, all phases complete) are archived in `docs/archive/sprints/`: `PHASE_1_SPRINT_1_TODO.json` through `PHASE_6_SPRINT_28_TODO.json`. Architecture docs in `docs/Architecture/Workbook/`.
