# MathTS LaTeX Output — Design Spec

**Features:** (1) `plot` scene/backend refactor + `plot.toTikZ()`; (2) workbook `mtsw export --format tex`.
**Date:** 2026-07-08 · **Status:** approved architecture (Approach A), pre-plan.
**Relates to:** `docs/superpowers/specs/2026-07-07-plotting-design.md` (the plot package this extends).

## Goal

Give MathTS a LaTeX output path that mirrors its HTML one. Two coupled features:

1. **`plot.toTikZ()`** — a second rendering backend for `@danielsimonjr/mathts-plot` that emits **pure TikZ** (`\draw`/`\filldraw`/`\node`) reproducing the _exact geometry_ of the SVG, so any chart can be embedded in LaTeX. Achieved by refactoring plot so all marks emit an intermediate **scene** of drawing primitives, then serializing that scene to either SVG or TikZ (Approach A — scene + pluggable backend).
2. **Workbook LaTeX export** — `mtsw export --format tex` renders a notebook to a standalone (or `--fragment`) `.tex`, using expression `.toTex()` for equations and `plot.toTikZ()` for chart cells, mirroring the existing `toHTML` document exporter.

The `toTikZ` API is designed against its real consumer (the workbook exporter) so its interface is right the first time — no speculative surface, no rework, no dead code.

## DGT validation (grounded in the current graph)

Verified via `npm run docs:deps` + reading `docs/Architecture/*` and the plot source:

- **0 cycles** (runtime + type-only). `plot → core, functions` (17 files, **0 dormant**); `workbook → functions, expression, plot`. The scene/backend split is entirely internal to plot, one-directional (`marks → scene → serializer`) → **no new package edge, no cycle possible**.
- **Refactor surface is exactly 6 files** — those importing svg.ts drawing primitives: `frame.ts`, `render-core.ts`, `heatmap.ts`, `contour.ts`, `three/surface.ts`, `three/points3d.ts`. The geometry/data modules (`scale.ts`, `three/project.ts`, `coerce.ts`, `palette.ts`, `types.ts`) are already backend-agnostic and **do not change**.
- **No future dead code**: the TikZ backend is reachable via the public API (`toTikZ`/`format`) _and_ consumed by the workbook tex exporter — both ends live. The plan's DGT gate re-asserts **0 cycles + 0 dormant** after the refactor, so any orphan fails the gate.

## Non-goals (YAGNI)

- No pgfplots dependency — pure TikZ (only `\usepackage{tikz}`), so output geometry matches the SVG exactly and there is no re-render/re-projection divergence.
- No PNG/PDF rasterization — `.tex`/TikZ text out only; compilation is the user's `pdflatex`/`lualatex` step.
- No new math-typesetting — equations use the expression package's existing `.toTex()` (verified: `parse('sin(x)^2').toTex()` → `{\sin\left( x\right)}^{2}`).
- No CommonMark completeness in `markdownToTex` — the same subset as the existing `markdownToHtml` (headings, bold/italic/code, fenced code, lists, links, hr).

## Architecture — scene + two backends (Approach A)

```
marks (geometry, unchanged math) ──build──▶ Scene ──emit──┬─ emitSVG(scene)        → SVG string  (byte-identical to today)
  frame/draw2D, render-core, heatmap,                      └─ emitTikZ(scene, opts) → TikZ string
  contour, three/surface, three/points3d
```

Today each of those 6 files stringifies shapes as SVG inline (via `svg.ts` builders). After the refactor each builds a `Scene` (a list of primitives in paper coordinates), and a backend stringifies it. "Match SVG" is guaranteed because TikZ renders the **same scene**; "full parity" is guaranteed because every mark flows through one scene, so TikZ gets all 15 marks for free and can never drift.

### `plot/src/scene.ts` (new) — the primitive vocabulary

The primitives are exactly the shapes `svg.ts` already produces (`line/circle/rect/polyline/polygon/text`), plus the two raw-SVG bypasses in `frame.ts` folded in as first-class prims (the rotated y-axis label → a `text` with `rotate`; the hand-written legend `<rect>` → an ordinary `rect`):

```ts
export type Prim =
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; w: number }
  | { k: 'circle'; cx: number; cy: number; r: number; fill: string; opacity?: number }
  | { k: 'rect'; x: number; y: number; w: number; h: number; fill: string }
  | { k: 'polyline'; pts: Array<[number, number]>; stroke: string; w: number }
  | { k: 'polygon'; pts: Array<[number, number]>; fill: string; stroke: string }
  | {
      k: 'text';
      x: number;
      y: number;
      s: string;
      fill: string;
      anchor: 'start' | 'middle' | 'end';
      size: number;
      rotate?: number;
    };

export interface Scene {
  width: number;
  height: number;
  bg: string;
  prims: Prim[];
}
```

Text prims carry the **raw** (un-escaped) string; escaping is backend-specific (`emitSVG` → `esc`, `emitTikZ` → `texEsc`). Fill strings may be 6-hex (`#rrggbb`) or 8-hex (`#rrggbbaa`, as area's `color + '55'` produces); `emitTikZ` splits the trailing alpha into `fill opacity`. Coordinates are stored as raw floats; each backend rounds (`emitSVG` keeps svg.ts's `r2` 2-decimal rounding for byte-identical output).

### `emitSVG(scene): string` — in `svg.ts`, behavior-preserving

`svg.ts`'s existing builders (`line/circle/rect/polyline/polygon/text/svgDoc`) **stay exported** (they are asserted directly by `svg.test.ts`, e.g. `circle(10,20,3,'#000') === '<circle .../>'`). `emitSVG` maps each `Prim` back through the corresponding builder and wraps in `svgDoc` — so the emitted SVG is **byte-identical** to today's marks (same builders, same order). The `text`-with-`rotate` case reproduces frame.ts's current `<text transform="translate(..) rotate(-90)">…` string exactly. The 55 existing plot tests are the regression net; **no SVG output changes**.

### `emitTikZ(scene, opts): string` — new `plot/src/tikz.ts`

Serializes the same `Scene` to TikZ:

- **Coordinates:** same pixel space as the SVG (default 520×320), y-flipped for TikZ's y-up origin (`tikz_y = height − svg_y`), inside a `tikzpicture` scaled to a sensible size (`scale` option; a fixed pt-per-px unit by default). Geometry is identical to the SVG.
- **Shapes:** `line` → `\draw[color,line width]`; `polyline` → `\draw ... -- ...`; `polygon` → `\filldraw[fill,draw]`; `circle` → `\filldraw[fill] ... circle`; `rect` → `\filldraw[fill] rectangle`; `text` → `\node[anchor=…]{…}` (rotate → `rotate=`). The background is a filled rectangle prim analog.
- **Colors:** `#rrggbb` → an inline `{rgb,255:red,R;green,G;blue,B}` color; 8-hex alpha and `opacity`/scatter3d depth-opacity → `fill opacity=`/`opacity=`.
- **Anchors:** SVG `start/middle/end` → TikZ `anchor=west/base/east` (baseline-adjusted).
- **Escaping:** `texEsc` escapes LaTeX specials (`& % $ # _ { } ~ ^ \`) in all text prims.
- **Document mode:** `standalone` (default) wraps in `\documentclass{standalone}\usepackage{tikz}…`; `standalone:false`/`--fragment` emits just the `tikzpicture` for `\input`.

### Shared emit dispatch

A tiny `emit(scene, opts): string` returns `opts.format === 'tikz' ? emitTikZ(scene, opts) : emitSVG(scene)`. Every public mark ends with `return emit(scene, opts)`. The standalone marks (`heatmap/contour/surface/points3d`), which build their own scene today via `svgDoc`, do the same.

## Public API (plot)

`PlotOptions` gains:

```ts
format?: 'svg' | 'tikz';            // default 'svg'
tikz?: { standalone?: boolean; scale?: number };  // standalone default true
```

Every one of the 15 marks + `overlay` + `plot()` honors `format` (so `line(x, y, { format: 'tikz' })` and `surface(z, { format: 'tikz', tikz: { standalone: false } })` work — full parity from the shared scene). Plus the friendly generic entry, exported from `index.ts`:

```ts
export function toTikZ(a: unknown, b?: unknown, c?: PlotOptions): string; // = plot(a, b, { ...c, format: 'tikz' })
```

No other public-surface additions; `viridis`, the 15 marks, `overlay`, `plot`, and the 4 types are unchanged.

## Refactor surface (exact)

- **New:** `plot/src/scene.ts`, `plot/src/tikz.ts`.
- **Change (emit prims instead of SVG strings):** `plot/src/frame.ts` (draw2D → builds a Scene; the ylab/legend bypasses become prims), `plot/src/render-core.ts` (the 7 `render*` return `Prim[]`), `plot/src/heatmap.ts`, `plot/src/contour.ts`, `plot/src/three/surface.ts`, `plot/src/three/points3d.ts`.
- **Extend:** `plot/src/svg.ts` (+`emitSVG`, builders retained), `plot/src/types.ts` (+`format`/`tikz`), `plot/src/plot.ts` (+`toTikZ`, `format` pass-through), `plot/src/index.ts` (+`toTikZ`).

## Feature 2 — workbook `mtsw export --format tex`

- **New `workbook/src/tex.ts`:** `toTeX(doc: RenderDoc, opts: { parse?; fragment?: boolean }): string`, mirroring `toHTML`. Cell mapping: markdown → LaTeX (`markdownToTex`), equation → `.toTex()` inside `\[…\]`, code → `lstlisting`/`verbatim`, test → a colored `\textcolor{}` pass/fail/error line, data → `verbatim`, **chart → the TikZ string**. Standalone doc = preamble (`amsmath`, `tikz`, `listings`, `xcolor`) + body; `fragment` = body only.
- **New `markdownToTex(src)`** (in `workbook/src/markdown.ts`, beside `markdownToHtml`): same subset and the same escape-first + `sanitizeHref` allowlist discipline, emitting `\section*`/`\textbf`/`\emph`/`\texttt`/`lstlisting`/`itemize`/`enumerate`/`\href`/`\rule`.
- **Chart plumbing:** `buildRenderDoc` currently renders eagerly to `rc.chartSvg` via `renderChart(spec, x, y)` (cli.ts:546). It becomes **format-aware** — `buildRenderDoc(wb, byId, format)`: the workbook `renderChart` adapter gains a `format: 'svg' | 'tikz'` arg (delegating to `plot.line/scatter/bar` with `{ …, format }`), and the rendered chart string is stored on a format-appropriate `RenderCell` field — **`chartSvg` for html (unchanged)**, a new **`chartTikz` for tex** — which the respective exporter embeds (`toHTML` reads `chartSvg`; `toTeX` reads `chartTikz`). `toHTML`'s behavior is fully preserved (html path calls `buildRenderDoc(wb, byId, 'svg')`).
- **CLI:** `exportCommand` (cli.ts:602, currently rejects non-`html`) accepts `--format tex` and a `--fragment` flag; the tex path writes `.tex` and calls `toTeX(buildRenderDoc(wb, byId, 'tikz'), { parse, fragment })`.

## Error handling

Never-throws is preserved end-to-end: scene builders and both emitters never throw (each mark's try/catch and empty-data guards are unchanged); empty/NaN/∞ → a one-`text`-prim "no data" scene → both backends render a valid "no data" document. The workbook tex exporter degrades like the html one (unresolved chart data → a note; invalid spec → "no data" chart).

## Testing (oracle discipline)

- **Scene oracles (once, shared):** a known series → known `Prim` coordinates (the geometry math is exact; assert prim kinds/counts/coords — e.g. line `[0,10]`→ first/last polyline x at 64/500).
- **`emitSVG` regression:** the existing 55 plot tests stay green unchanged (proves the refactor is behavior-preserving; SVG output byte-identical).
- **`emitTikZ` oracles:** TikZ structure (`\begin{tikzpicture}`, `\draw`, `\node`), geometry-oracle coordinates under the deterministic y-flip, color/anchor/opacity conversion, `texEsc` of LaTeX specials, standalone-vs-fragment shape.
- **Parity test:** the same call yields the same `Scene` regardless of `format` (format only selects the serializer).
- **Workbook tex:** `toTeX` cell-mapping tests (equation → `\[…\]`, code → listings, test → colored line, chart → `tikzpicture`), `markdownToTex` subset + escaping tests, and a CLI `export --format tex`/`--fragment` test. Existing `svg.test.ts`/`export.test.ts` (html path) stay green unchanged.
- All test files `import { describe, it, expect } from 'vitest'` explicitly.

## Sequencing (one spec, two sequenced plans — no branches)

Build order is forced by the dependency (`scene → toTikZ → workbook tex`). Design together (this spec pins the `toTikZ ↔ renderChart(format)` contract); build and ship in two milestones:

- **Plan 1 — plot scene/backend + TikZ** (ships as **plot 0.2.0**, publishable, useful standalone; SVG unchanged): scene refactor (behavior-preserving, 55 tests green) → `emitTikZ`/`toTikZ`/`format` → docs/changeset/DGT gate (0 cycles, 0 dormant) → release.
- **Plan 2 — workbook `--format tex`** (consumes the proven `toTikZ`): `tex.ts` + `markdownToTex` + format-aware chart plumbing + CLI `--format tex`/`--fragment` → tests → DGT gate → release (workbook patch, stays changeset-ignored → versions, doesn't publish).

## Framework conformance

- ESM-only (`.js` import extensions), `strict: true`, eslint-zero across `src` **and** `tests`; kebab-case files, PascalCase types, camelCase fns.
- No new runtime dependency (pure TikZ; no pgfplots). plot stays `→ core, functions`; workbook stays `→ …, plot`.
- **DGT gate** each plan: `npm run build:wasm && npm run docs:deps` → plot/workbook reachable, **0 circular dependencies, 0 orphaned/dormant**, graph docs regenerated and committed.
- Commit footer on every commit (Co-Authored-By: Claude Fable 5 + Claude-Session); never `--no-verify`; push directly to `main`, verify each push `git ls-remote` (L==R).
- Release: Plan 1 changeset `@danielsimonjr/mathts-plot: minor` (→0.2.0). Plan 2 changeset `@danielsimonjr/mathts-plot`? (only if plot changes) + `@danielsimonjr/mathts-workbook: patch` (ignored). npm publish is the maintainer's step (npm auth).

## Open questions

None blocking. TikZ unit scaling (pt-per-px default vs a `scale` factor), the exact `lstlisting` vs `verbatim` choice for code cells, and baseline nudge for `anchor=base` are pinned above and tunable during implementation without changing the architecture.
