# MathTS Roadmap

MathTS is a TypeScript rewrite of [mathjs](https://mathjs.org) with WASM / WebGPU /
WebWorker acceleration, plus a reactive YAML-based **Scientific Workbook** (`.mtsw`)
system. This document is **forward-looking**: what's planned and why. Shipped history
lives in per-package `CHANGELOG.md` files and in `TODO.md` (the working tracker).

_Last updated: 2026-10-22._

> **Process:** features follow the lifecycle in [`docs/FEATURE_WORKFLOW.md`](docs/FEATURE_WORKFLOW.md)
> — idea → (lightweight brainstorm + CDG placement probe) → ROADMAP entry →
> (Definition of Ready) → SPEC → PLAN → `TODO.md` → dev-workflow. Run
> `bun run docs:roadmap-check` when reconciling this file.

## Guiding principles

- **Everything builds on `mathts-core`** — shared types, typed-function dispatch, and the
  factory pattern; packages don't reinvent primitives.
- **Zero-dependency where it counts** — the plot core is pure-string SVG/TikZ; heavy or
  native work (rasterization, LaTeX compile, WASM) is opt-in behind subpaths or external
  tools, never bundled into the browser-facing surface.
- **Oracle-pinned correctness** — tests pin to implementation-independent references
  (closed forms, tables, scipy/mpmath), never round-trips against the implementation itself.
- **Repo invariants** — strict TypeScript, `oxlint --deny-warnings`, and **0 dependency-graph cycles**
  (enforced by `bun run docs:deps`) on every change.

## Near-term (active)

### Scientific Workbook capabilities

The `.mtsw` runtime is headless (CLI + JSON-RPC serve); the GUI will sit on top of it.
Remaining deferred capabilities, most-actionable first:

- **Interactive (JS) charts** — client-side interactive chart cells alongside the static
  SVG/TikZ output.
- **Multi-doc serve** — today `mtsw serve [<file>]` serves one workbook; serving several
  documents from one process is still open. (Mid-run event streaming and `--expect-hash`
  optimistic-lock writes shipped in the workbook CLI.)

### Package hardening (audit follow-ups)

Open subset of `BUG_AUDIT_2026-05-25.md`:

- **B-5** — mathjs upstream drift tracking (the `.ts→.ts` sync model is dead; new upstream
  work needs manual JS→TS porting via `tools/mathjs-port/`).

_(B-3 cross-package WASM dist-hop — resolved: `defaultWasmLocation()` in
`functions/src/wasm/resolve.ts` and `matrix/src/backends/wasm/resolve.ts`.)_

_(B-4 SVD skips, B-8 AssignmentNode FIXME, B-9 `@ts-nocheck` were verified resolved 2026-07-09. B-7, the dev-only `esbuild`/`tsup` advisory, closed when the build moved to `tsdown`: `tsup` and its nested `esbuild` copy left the install tree. `esbuild` is back only as a root dev dependency at `^0.28.1`, for the benchmark runner.)_

## Medium-term

### Electron GUI

The eventual desktop app — **pure presentation over the CLI/serve contract**
(`electron-vite-react` base): every GUI operation maps to a CLI/JSON-RPC operation, so the
runtime stays headless and independently testable. On hold pending workbook release-readiness.

### Workbook release-readiness

`@danielsimonjr/mathts-workbook` publishes to npm (currently **0.4.13**; `.changeset/config.json`
`ignore` is empty). Further hardening focuses on the CLI/serve contract for external consumers.

## Explicitly out of scope (documented non-decisions)

These are **not** backlog; each has a written rationale and was deliberately not pursued:

- **`eigs` / SVD acceleration** — the correct path is the factory implementation; the
  fast symmetric path was **removed** after it was found to return wrong eigenvalues.
  There is no correct sync speedup left to capture.
- **General `polyFit` / `leastSquares` API** — broader least-squares surface beyond the
  measured WASM `poly_fit_f64` / `cheb_fit_f64` / `legendre_fit_f64` dispatch (see
  `functions/src/wasm/policy.ts`) remains a product decision, not a missing kernel.
- **Unified f32 WebGPU path** — design spec written; not pursued as a standalone
  effort. Superseded by the phased WebGPU acceleration design
  (`docs/superpowers/specs/2026-07-10-webgpu-acceleration-design.md`); its first
  slice, Spec 1a (shared GPU foundation extraction), has now landed — see
  Candidates/Icebox below.

## Candidates / Icebox

Raw ideas not yet promoted to Near-term — one line each, no spec until they pass
the Definition of Ready (see the process doc). Add here so ideas aren't lost.

- **PySR-informed symbolic-search primitives (for UPT)**: M1 (`expression/src/scalar-structure.ts`),
  M3 (`functions/src/scalar-compile.ts` / `compileScalar`), and M4 (`functions/src/pareto-front.ts`)
  are in tree; later milestones and the optional search kit remain in
  [`docs/roadmap/PYSR_INFORMED_ROADMAP.md`](docs/roadmap/PYSR_INFORMED_ROADMAP.md) with plans under
  [`docs/plans/PYSR_M1_PLAN.md`](docs/plans/PYSR_M1_PLAN.md),
  [`docs/plans/PYSR_M3_PLAN.md`](docs/plans/PYSR_M3_PLAN.md), and
  [`docs/plans/PYSR_M4_PLAN.md`](docs/plans/PYSR_M4_PLAN.md).

- **WebGPU acceleration tier (browser flag-gated)** — add WebGPU as a THIRD acceleration
  backend behind the existing WASM/parallel dispatch, selected by size **and** an in-browser
  WebGPU-enabled flag (mirroring how the WASM/parallel tiers are chosen today). `matrix`'s
  `GPUBackend.matmul` is the experimental starting point — currently NOT routed by
  `BackendManager` (very high gpu threshold) and not validated. Harness ready:
  `tools/benchmark/gpu/bench-3way.*` (browser via the `claude-in-chrome` plugin). See
  [`project-webgpu-experimental-wasm-real`] memory.
  - **Spec 1a — shared GPU foundation extraction: LANDED (2026-07-10).** `GPUContext`,
    `BufferPool`, `detect`, and a generic `ShaderManager` moved into a new leaf package
    `@danielsimonjr/mathts-gpu`; `matrix`'s `GPUBackend` registers its own
    matmul/transpose/reduce WGSL onto the shared `ShaderManager` at init, and re-exports
    the whole foundation for back-compat. Pure refactor, no routing/behavior change.
  - **Spec 1b — partial.** `enableGpu()` and `GPU_MIN_ELEMENTS` (65,536) ship in
    `@danielsimonjr/mathts-gpu` and are re-exported from `functions`; fused GPU chains and
    FFT dispatch exist behind the flag. Routing through `BackendManager` remains dormant
    (no `'gpu'` backend registered there).
  - **Spec 2+** — `functions` package `*GpuDispatch` bridges for the data-parallel ops
    below, mirroring the existing `*Dispatch` WASM-bridge pattern.
  - **Baseline coverage** (CDG `wasm-pairing`/`parallel-pairing`, 218 functions): **39 WASM ·
    52 parallel-only · 127 none**.
  - **WebGPU targets = data-parallel ops**: elementwise arithmetic/transcendental/special
    functions, reductions (`sum/mean/std/min/max/norm/dot`), `matmul`, FFT — where GPU wins
    at scale. Plus the ~28 GPU-friendly JS-only elementwise (`besselI/K`, distributions
    `*PDF/*CDF/*PMF`, `digamma`, `erfi`, `hermiteH/laguerreL/legendreP`, …).
  - **NOT WebGPU targets** (~39): scalar/structural — relational (`compare/equal/…`),
    number-theory (`gcd/divisors/eulerPhi/…`), combinatorics, complex-scalar (`arg/conj`),
    formatting. Branch-heavy + small; no GPU benefit.

## Recently shipped

> Short rolling window (most recent first). Full history lives in per-package
> `CHANGELOG.md`; prune this list periodically so ROADMAP stays forward-looking.

- **2026-07-10 — WebGPU foundation extraction (Spec 1a).** New leaf package
  `@danielsimonjr/mathts-gpu` (`GPUContext`, `BufferPool`, `detect`, generic
  `ShaderManager`); `matrix`'s `GPUBackend` rewired onto it, full back-compat
  re-export, no behavior change. Design:
  `docs/superpowers/specs/2026-07-10-webgpu-acceleration-design.md`.
- **2026-07-09 — Export-formats expansion.** `plot@0.3.0` Node-only `./render` bridge
  (`renderToFile` SVG→PNG/PDF, `latexToPdf` LaTeX→PDF; external-tool, zero bundled deps,
  shell-escape off by default); `expression@0.6.0` `Node.toMarkdown()` / `Node.toDOT()`;
  workbook `toDOT(graph)` + `graph -f dot` + `export --format json` / `--format pdf`.
- **2026-07-08/09 — LaTeX output.** `plot@0.2.0` `toTikZ()` (scene + pluggable backend);
  workbook `export --format tex`.
- **2026-07 — Plot package** (2D/3D headless SVG), **Unit merge** (one `Unit` in core),
  **stats/prob → matrix parity**, **matrix acceleration** (SIMD matmul, native LU det/inv).

## Output/serialization surface (current)

A quick map of what MathTS can emit today:

| Layer             | Formats                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| expression `Node` | `.toString` · `.toTex` · `.toHTML` · `.toMathML` · `.toMarkdown` · `.toDOT`                                 |
| plot charts       | SVG · TikZ · (via `./render`) PNG · PDF                                                                     |
| workbook document | HTML/CSS · LaTeX (`toTeX`/`toPDF`) · JSON · `.mtsw` round-trip · Graphviz (`toDOT`) · Mermaid (`toMermaid`) |
| workbook CLI      | `mtsw export --format html \| tex \| json \| pdf` · `mtsw graph -f mermaid \| dot`                          |
