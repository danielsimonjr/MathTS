# AGENTS.md

> ACFS: v1 · Cross-agent operating guide for **MathTS**.
> Claude Code users: `CLAUDE.md` is auto-loaded and holds Claude-specific
> invariants + the full monorepo reference. This file is the tool-agnostic
> supplement — build/test rules, file boundaries, and a "where to find X" map.
> When they conflict, the more specific/recent source wins; report the conflict.

MathTS is a TypeScript rewrite of mathjs with WASM / WebGPU / WebWorker
acceleration, plus a reactive `.mtsw` Scientific Workbook. npm-workspaces
monorepo (22 packages) orchestrated by Turborepo. All packages are ESM-only,
target ES2022, bundle with `tsup`, test with `vitest`. See `README.md` for the
human-facing overview.

---

## Build / Test / Verify (run from repo root)

| Task | Command | Notes |
|---|---|---|
| Build all | `npm run build` | turbo, respects dep graph |
| Typecheck all | `npm run typecheck` | turbo; **green baseline = 28/28, 0 errors** |
| Test all | `npm run test` | vitest via turbo |
| Lint / format | `npm run lint` · `npm run format` | eslint + prettier |
| Coverage | `npm run test:coverage` | whitelist excludes dormant code |
| One package | `npx turbo <task> --filter=@danielsimonjr/mathts-<pkg>` | |
| One test file | `npx vitest run <path>` | e.g. `core/tests/utils.test.ts` |
| WASM (AS) | `npm run build:wasm` | AssemblyScript — the `functions` backend + matrix basic ops |
| WASM (Rust) | `npm run build:wasm:rust` | matrix heavy ops only (fft/eig/svd/decomp); skipped w/o Rust toolchain → JS fallback |

**Before claiming "done":** run `npm run typecheck` (must stay 0 errors) and the
affected package's tests. Don't bypass the pre-commit hook (`--no-verify`).

---

## The one rule that saves the most time: active vs. dormant code

`functions/` has **two layers**. Editing the wrong one wastes effort.

- ✅ **ACTIVE (built + shipped):** everything reachable from
  `functions/src/index.ts` → `typed/` (typed-dispatch impls), `typed/cas.ts`,
  **`factories/` (activated mathjs leaf factories)**, and the **wired expression
  evaluator** `factories/evaluate.ts` (`evaluate` / `compileExpr` / `parse`).
- 💤 **DORMANT (NOT exported, NOT built):** the ~20 category dirs
  `functions/src/{arithmetic,algebra,bitwise,matrix,...}/` synced from the
  mathjs fork, plus support dirs `functions/src/{utils,core,plain,type,...}/`.
  These carry upstream type errors on purpose (`functions/tsconfig.json` uses
  `strict:false`). **Do not "fix" them or assume they run.**

> ⚠️ The `docs/inventory/` reports (dated 2026-04-10) predate factory
> activation and the evaluator wiring — they still call factories "dormant" and
> the evaluator "stubbed." Trust the **export surface in `functions/src/index.ts`
> + a green typecheck**, not those numbers, until the inventory is refreshed.

---

## Where to find X (navigation hub)

| You want… | Look in |
|---|---|
| Numeric types (Complex/Fraction/BigNumber), typed-function, factory | `core/src/` |
| Dense/Sparse matrix, JS/WASM/GPU backends, BackendManager, decompositions | `matrix/src/` |
| Rank-N Tensor (Float64Array) | `tensor/src/` |
| Autodiff (forward DualTensor, reverse Tape) | `autograd/src/` |
| **Live** math functions (arithmetic, trig, stats, signal, CAS, …) | `functions/src/typed/`, `functions/src/factories/` |
| ComputePool / WebWorker ops | `parallel/src/` |
| Expression parser/compiler/evaluator | `expression/src/` (wired via `functions/src/factories/evaluate.ts`) |
| `.mtsw` notebook runtime (parser, graph, executor) | `workbook/src/` |
| mathjs-compat shim (`create(all)`) | `compat/src/` |
| AssemblyScript WASM source (the `functions` backend + matrix basic ops) | `assembly/src/` |
| Rust WASM source (matrix heavy ops only; migration pending) | `wasm-rust/crates/` |
| Forked typed-function / workerpool | `packages/typed-function/`, `packages/workerpool/` |
| Thin re-export packages (parser, ast, units, linalg, arithmetic, …) | top-level dirs; they re-export, no impl |
| Architecture / API / inventory docs | `docs/Architecture/`, `docs/api/`, `docs/inventory/` |
| Roadmaps, gap analyses, WASM plans | `docs/roadmap/`, `docs/plans/` |
| Standalone tools (dep-graph, benchmarks, mathjs-port) | `tools/` |

Dependency graph and per-package details live in **`CLAUDE.md` → Monorepo
Structure**. Don't duplicate it here — reference it.

> **⚠️ WASM direction of travel (read before touching `wasm-rust/` or AS).**
> *Today (Rust→AS migration Phase 5, functions cutover COMPLETE):* the
> **`functions` package is AssemblyScript-only** — it loads `mathts-as.wasm` and
> its dispatch is **AS→JS** (the Rust-pointer branches were removed from the 7
> `functions/src/wasm` bridges). **`matrix` still uses the Rust binary**
> (`lib/wasm/mathts.wasm`) via `RustWASMBackend`/`RustWasmLoader` for the heavy ops
> (`fft`/`eig`/`svd`/`decomposition`) and large matrices, so `wasm-rust/` +
> `build:wasm:rust` **remain**. *Remaining work:* migrate `matrix` to AS, then
> delete Rust (a separate, pending slice — see
> `docs/roadmap/RUST_TO_AS_MIGRATION_PHASE5.md`). Four `functions` AS kernels are
> on a JS fallback pending Phase 6 fixes (poly fit/cheb/legendre, Airy Ai/Bi for
> |x|>5, argsort/rank+slow sort). Don't invest new work in Rust `functions`
> kernels; for matrix, check the plan before adding Rust.

---

## File boundaries & conventions

- **Import extensions:** use `.js` (ESM resolution). Exception: `tensor/src/`
  uses bare relative imports (tsup bundles it). Match the existing style per
  package — check a sibling file before adding imports.
- **Naming:** files `kebab-case.ts`, classes `PascalCase`, functions/vars
  `camelCase`, constants `UPPER_SNAKE_CASE`.
- **Commits:** Conventional Commits (`feat(matrix):`, `fix(workbook):`). Atomic.
- **Re-export packages** (`parser/`, `ast/`, `evaluator/`, `units/`, `numbers/`,
  `linalg/`, `arithmetic/`, `trigonometry/`, `statistics/`, `signal/`) contain
  **no implementation** — edit the source package they re-export, not these.
- **Don't `npm publish`** (2FA-gated). Versioning is via Changesets.

---

## Security invariants — DO NOT REGRESS

From the 2026-05-01 security release. Any change touching these must preserve them
(regression tests guard each):

1. **WASM SHA-384 verification.** `functions/src/wasm/WasmLoader.ts` and
   `assembly/src/bindings/wasm-loader.ts` hash the `.wasm` buffer against
   `wasm-manifest.json` before instantiate. Never weaken/skip — even on streaming
   compile. Test: `functions/tests/security/wasm-integrity.test.ts`.
2. **Expression sandbox.** All property/method access in `expression/src/` must
   go through `getSafeProperty`/`setSafeProperty`/`getSafeMethod`
   (`expression/src/utils/customs.ts`). No direct `obj[name]`. Test:
   `expression/tests/security/sandbox.test.ts`.
3. **WorkerPool timeout.** `parallel/src/WorkerPool.ts#execute()` `timeoutMs` +
   hung-worker replacement plumbing must stay.

---

## Testing protocol

- Always `import { describe, it, expect } from 'vitest'` explicitly (the
  `globals` setting is inconsistent across package configs).
- Test files: `*.test.ts` colocated in each package's `tests/`.
  Cross-package: `tests/integration/`, `tests/wasm/`.
- `assembly/tests/run.js` is a node runner (not vitest), needs
  `--experimental-wasm-simd`.

---

## Context File Suite

This project uses the Agentic Context File Suite (ACFS):

- `README.md` — Project identity (human-facing)
- `AGENTS.md` — This file. Cross-agent behavior rules.
- `CLAUDE.md` — Claude-specific invariants + full monorepo reference. Complements
  this file (auto-loaded by Claude Code).
- `CHANGELOG.md` — Project history. Consult before breaking changes.
- `docs/` — Architecture, API, inventory, roadmaps, plans.

There is no project-scoped `memory/` or `wiki/` yet (Standard/Full tiers).
Add them via the `documentation` skill if multi-session memory becomes useful.

### Context File Maintenance

| File | Update trigger | Who |
|---|---|---|
| `README.md` | Major project changes | Human |
| `AGENTS.md` | New conventions/tools/agent feedback | Human + agent |
| `CLAUDE.md` | Claude-specific invariants, structure changes | Human + agent |
| `CHANGELOG.md` | Every release | Human + agent |
| `docs/inventory/` | After large feature/activation waves (currently stale) | Agent |
