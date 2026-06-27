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
| WASM (AS) | `npm run build:wasm` | AssemblyScript — the **sole** WASM backend (functions + matrix); falls back to JS if not built |

**Before claiming "done":** run `npm run typecheck` (must stay 0 errors) and the
affected package's tests. Don't bypass the pre-commit hook (`--no-verify`).

---

## functions/ is now a single active graph (the dormant layer was deleted)

There used to be a "two-layer" rule here (active vs. dormant). **It no longer
applies.** On 2026-06-27 the dormant layer — unexported, unreachable, untested
synced-mathjs code — was deleted (**455 files / ~58.6k LOC** across `functions/`
+ `core/`, the bulk being the dead `functions/src/expression/` mirror). The
`.ts→.ts` mathjs sync model that produced it is dead (upstream TS-split,
2026-04-10).

What remains in `functions/src/` is **all reachable from
`functions/src/index.ts`** — one active graph:

- ✅ `typed/` (typed-dispatch impls) + `typed/cas.ts`
- ✅ `factories/` — **activated** mathjs leaf factories, re-exported from
  `index.ts` (these import the surviving category dirs `arithmetic/`, `algebra/`,
  `type/`, `utils/`, `plain/`, … — those are now ACTIVE, edit them normally)
- ✅ `wasm/` bridges (`*Dispatch`, `WasmLoader`, `integrity`) + the wired
  expression evaluator `factories/evaluate.ts` (`evaluate` / `compileExpr` /
  `parse`, backed by the `expression` package)

A few legacy synced files were intentionally KEPT because direct tests exercise
them: `functions/src/signal/{fft,conv}.ts`, `functions/src/type/local/Decimal.ts`,
and the `functions/src/wasm/**` bindings reached via `wasm/index.ts` ←
`tests/wasm/typescript-integration.test.ts`.

`functions/tsconfig.json` still uses `strict:false`, but **not** because of
dormant code anymore — the active graph (activated factories + path-mapped
`expression`/`core`) has ~430 pre-existing strict violations (a separate
cleanup). Trust the **export surface in `functions/src/index.ts` + a green
`npm run typecheck`** as the source of truth.

> ⚠️ The `docs/inventory/` reports (dated 2026-04-10) are stale: they predate
> factory activation, evaluator wiring, AND this dormant purge. Do not trust
> their file counts or the active/dormant framing in `02-synced-factories.md`.

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
| AssemblyScript WASM source (the sole WASM backend — functions + matrix) | `assembly/src/` |
| Forked typed-function / workerpool | `packages/typed-function/`, `packages/workerpool/` |
| Thin re-export packages (parser, ast, units, linalg, arithmetic, …) | top-level dirs; they re-export, no impl |
| Architecture / API / inventory docs | `docs/Architecture/`, `docs/api/`, `docs/inventory/` |
| Roadmaps, gap analyses, WASM plans | `docs/roadmap/` (active); dated one-off plans archived in `docs/archive/plans/` |
| Standalone tools (dep-graph, benchmarks, mathjs-port) | `tools/` |

Dependency graph and per-package details live in **`CLAUDE.md` → Monorepo
Structure**. Don't duplicate it here — reference it.

> **✅ WASM backend.** AssemblyScript is the
> **sole WASM backend** for the whole repo. Both `functions` and `matrix` load
> the AssemblyScript binary `mathts-as.wasm` (source `assembly/src/`); dispatch is
> **AS→JS**. The legacy native-WASM path and its toolchain have been removed.
> SHA-384 integrity verification of the AS binary is
> retained. A few kernels (poly fits, Airy Ai/Bi, argsort/rank) deliberately stay
> on JS where their AS kernels are still being stabilized.

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
