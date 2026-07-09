# MathTS Roadmap

MathTS is a TypeScript rewrite of [mathjs](https://mathjs.org) with WASM / WebGPU /
WebWorker acceleration, plus a reactive YAML-based **Scientific Workbook** (`.mtsw`)
system. This document is **forward-looking**: what's planned and why. Shipped history
lives in per-package `CHANGELOG.md` files and in `TODO.md` (the working tracker).

_Last updated: 2026-07-09._

> **Process:** features follow the lifecycle in [`docs/FEATURE_WORKFLOW.md`](docs/FEATURE_WORKFLOW.md)
> — idea → (lightweight brainstorm + CDG placement probe) → ROADMAP entry →
> (Definition of Ready) → SPEC → PLAN → `TODO.md` → dev-workflow. Run
> `npm run docs:roadmap-check` when reconciling this file.

## Guiding principles

- **Everything builds on `mathts-core`** — shared types, typed-function dispatch, and the
  factory pattern; packages don't reinvent primitives.
- **Zero-dependency where it counts** — the plot core is pure-string SVG/TikZ; heavy or
  native work (rasterization, LaTeX compile, WASM) is opt-in behind subpaths or external
  tools, never bundled into the browser-facing surface.
- **Oracle-pinned correctness** — tests pin to implementation-independent references
  (closed forms, tables, scipy/mpmath), never round-trips against the implementation itself.
- **Repo invariants** — strict TypeScript, ESLint-zero, and **0 dependency-graph cycles**
  (enforced by `npm run docs:deps`) on every change.

## Near-term (active)

### Scientific Workbook capabilities

The `.mtsw` runtime is headless (CLI + JSON-RPC serve); the GUI will sit on top of it.
Remaining deferred capabilities, most-actionable first:

- **Worker-thread run timeout** — sandboxed cell execution is currently synchronous with
  **no hard timeout**; a runaway cell can hang a run. Add a worker-thread execution path
  with a kill-able timeout. _Highest-value robustness gap._
- **`ipynb` export** — Jupyter-notebook export, completing the export matrix
  (`html` · `tex` · `json` · `pdf` · `ipynb`).
- **SVG math typesetting** — render equations as SVG (vs the current MathML) for
  self-contained, font-independent output.
- **Interactive (JS) charts** — client-side interactive chart cells alongside the static
  SVG/TikZ output.
- **Serve enhancements** — multi-doc serve · mid-run event streaming · `--expect-hash`
  optimistic-lock writes.

### Package hardening (audit follow-ups)

Open subset of `BUG_AUDIT_2026-05-25.md`:

- **B-3** — cross-package WASM dist-hop (the built `.wasm` resolution across package
  boundaries).
- **B-5** — mathjs upstream drift tracking (the `.ts→.ts` sync model is dead; new upstream
  work needs manual JS→TS porting via `tools/mathjs-port/`).
- **B-7** — the accepted dev-only `esbuild`/`tsup` advisory (GHSA-gv7w-rqvm-qjhr);
  re-evaluate when `tsup ≥ 8.6` ships `esbuild ^0.28`.

_(B-4 SVD skips, B-8 AssignmentNode FIXME, B-9 `@ts-nocheck` were verified resolved 2026-07-09.)_

## Medium-term

### Electron GUI

The eventual desktop app — **pure presentation over the CLI/serve contract**
(`electron-vite-react` base): every GUI operation maps to a CLI/JSON-RPC operation, so the
runtime stays headless and independently testable. On hold pending workbook release-readiness.

### Workbook release-readiness

`@danielsimonjr/mathts-workbook` is currently **changeset-ignored** — it versions
internally but does not publish to npm — per the explicit 2026-06-29 hold. Publishing is
gated on the CLI/serve contract stabilizing (so external consumers get a stable surface).

## Explicitly out of scope (documented non-decisions)

These are **not** backlog; each has a written rationale and was deliberately not pursued:

- **`eigs` / SVD acceleration** — the correct path is the factory implementation; the
  fast symmetric path was **removed** after it was found to return wrong eigenvalues.
  There is no correct sync speedup left to capture.
- **`polyFit` / `leastSquares`** — deferral re-validated (2026-05-23).
- **Unified f32 WebGPU path** — design spec written; not pursued.

## Candidates / Icebox

Raw ideas not yet promoted to Near-term — one line each, no spec until they pass
the Definition of Ready (see the process doc). Add here so ideas aren't lost.

- _(none yet — add candidates as they surface from CDG gaps, user requests, or upstream drift)_

## Recently shipped

> Short rolling window (most recent first). Full history lives in per-package
> `CHANGELOG.md`; prune this list periodically so ROADMAP stays forward-looking.

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
