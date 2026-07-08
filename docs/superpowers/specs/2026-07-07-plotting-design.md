# MathTS Plotting (G5) — Design Spec

**Package:** `@danielsimonjr/mathts-plot` · **Date:** 2026-07-07 · **Status:** approved design, pre-plan
**Supersedes:** the ad-hoc `workbook/src/svg.ts` plotter (folded in and deleted).

## Goal

A **headless, SVG-emitting** 2D/3D plotting library for MathTS — pure functions that
return self-contained SVG strings in Node/CI (no browser, no canvas, no WebGL). Fully
integrated with the bedrock packages (`core`, `functions`, `expression`) rather than a
standalone reinvention, and consumed by `workbook` in place of its private plotter.

## Non-goals (YAGNI)

- No interactive/browser runtime (pan/zoom/hover) — that overlaps the on-hold WebGPU / Workbook-GUI work.
- No PNG/raster output in v1 — pure-Node rasterization needs a dependency; SVG-only keeps the package dependency-light. `toPng()` deferred.
- No registration into the `functions`/`math` singleton (`math.line(...)`) — that would force `functions → plot` and create a cycle. Plot is import-only, strictly downstream of functions.
- No heavy theming system — a light/dark default with explicit colors (legible on any background), matching the existing `svg.ts` contract.

## Placement in the dependency graph (DGT-guided)

`plot` is a **presentation-tier package at the same level as `workbook`** — identical dependency set:

```
plot      →  core, functions, expression
workbook  →  core, functions, expression, plot   (migrates to consume plot)
```

Layering (bedrock → domain → presentation):

```
core ─┬─ expression ─┐
      ├─ matrix ─────┤
      └─ parallel ───┴─ functions ─┬─ workbook ─┐
                                    ├─ plot ─────┴─ (workbook consumes plot)
                                    └─ compat
```

**Acyclic invariant:** `functions` MUST NOT import `plot`; plot is strictly downstream. DGT
(`npm run docs:deps`) must report the new `plot` node reachable, **0 circular dependencies**,
and 0 orphaned/dormant files after implementation.

## Integration with the bedrock (build on, don't reinvent)

- **core** — value coercion routes through core's guards, not ad-hoc duck-typing:
  `isMatrix(v) → v.toArray()`; `isComplex(v)/isBigNumber(v)/isFraction(v) → core.number(v)`;
  plain `number[]`/`number[][]`/`Float64Array` pass through. One `coerce` module wraps this.
- **functions** — dogfood existing numerics instead of duplicating them:
  - the `histogram` mark bins via **`functions.histogram`**,
  - expression sampling uses **`functions.range`**,
  - auto axis-extents may reuse **`functions.describe`**.
- **expression** — the generic `plot` accepts an **expression source string**, parsed/compiled
  and evaluated via **`functions.evaluate`/`functions.parse`** (which are `expression`-backed).
  Free-variable count (from the parsed AST's symbol nodes) selects the default mark.

## Public API

All functions return a self-contained SVG **string**. All **never throw**: bad/empty/NaN/∞/mismatched
data yields a "no data" SVG (inherits the `svg.ts` contract).

### Generic entry — `plot`

Polymorphic on the first argument; the friendly one-liner that also subsumes expression plotting
(there is no separate `plotExpr`).

```ts
plot(source: string, opts?: PlotOptions): string   // expression → sampled + auto-selected mark
plot(y: Data, opts?: PlotOptions): string           // single series (x = 0..n-1)
plot(x: Data, y: Data, opts?: PlotOptions): string  // x/y → line by default
plot(series: Series[], opts?: PlotOptions): string   // multi-series → delegates to overlay
```

- `Data = number[] | number[][] | Float64Array | Matrix | Complex[] | …` (coerced via core).
- **Expression dispatch** (`typeof source === 'string'`):
  - 1 free variable (e.g. `'sin(x)^2'`) → sample over `[opts.from, opts.to]` (`opts.samples`, default 200) → `line`.
  - 2 free variables (e.g. `'x^2 + y^2'`) → evaluate on a grid → **`contour`** by default, or `surface` when `opts.kind === '3d' | 'surface'`.
  - Free variables are read from the parsed AST; unknown symbols resolve against `opts.scope`.
- `PlotOptions` (shared by all marks where meaningful): `{ from, to, samples, kind, type, title, xLabel, yLabel, xScale:'linear'|'log', yScale, width, height, theme:'light'|'dark', palette, legend, scope }`.

### Per-type functions (explicit surface, the chosen primary API)

```
2D essentials:   line · scatter · bar · area · step · histogram
2D scientific:   contour · heatmap · errorbar · quiver
3D (projected):  surface · scatter3d · curve3d
combinator:      overlay([...])   // shared auto-scaled axes for mixed-type layers
```

- Multi-series of the same type → pass an array: `line([{x,y,label}, {x,y,label}])`.
- Mixed-type shared-axes overlay → `overlay([{type:'line',…},{type:'scatter',…},{type:'errorbar',…}], opts)`; it computes shared scales across all layers and draws one axes frame.

## Module structure (small, single-purpose units)

```
plot/src/
  index.ts            public re-exports (plot, per-type fns, overlay, types)
  plot.ts             generic polymorphic entry + expression dispatch
  coerce.ts           core-guard-based value → number[] / grid
  scale.ts            linear/log scales, nice-ticks, extents
  frame.ts            axes/ticks/grid/legend/title SVG scaffold
  svg.ts              low-level SVG element builders + escaping
  palette.ts          color cycle + colormaps (viridis for heatmap/contour)
  marks2d/            line, scatter, bar, area, step, histogram, errorbar, quiver
  marks-sci/          contour (marching-squares), heatmap
  three/
    project.ts        3D→2D camera (azimuth/elevation; ortho default, perspective opt)
    surface.ts        wireframe + filled with painter's-algorithm depth sort
    scatter3d.ts      curve3d.ts
  overlay.ts          shared-frame combinator
```

## 3D approach (static, projected — no WebGL)

`three/project.ts` rotates points by azimuth/elevation and projects (orthographic default,
perspective optional) to 2D SVG coordinates. `surface` builds quads/triangles from a Z-grid,
**sorts faces back-to-front (painter's algorithm)**, fills with a simple light-model shade plus
wireframe. `scatter3d`/`curve3d` project points/polylines with depth-cued opacity. Fully
deterministic → snapshot- and geometry-testable.

## Data coercion & robustness

One `coerce` module using core guards produces `number[]` (1-D) or `number[][]` (grid); non-finite
entries are dropped (1-D) or treated as gaps (grid). Empty or all-invalid input short-circuits to
the "no data" SVG. No function in the package throws on data input.

## Testing (structural + geometry oracles, not pixels)

SVG is text; tests assert structure and geometry, never rendered pixels:

- **Counts/structure:** N points → N `<circle>`; N points → N−1 line segments; correct `viewBox`; axis-tick label values equal the computed nice-ticks.
- **Geometry oracles:** a known series maps to hand-computed pixel coords (scale math is exact); marching-squares on `z = x² + y²` yields the expected number of closed contour rings; a projected unit cube's 8 vertices land at hand-computed screen coordinates for a fixed camera.
- **Expression path:** `plot('sin(x)', {from:0,to:π})` samples the right count and its extents match `sin`; a 2-var source auto-selects contour.
- **Robustness:** empty / NaN / ∞ / mismatched-length → asserted "no data" SVG.
- Test files under `plot/tests/*.test.ts`, `import { describe, it, expect } from 'vitest'` explicitly.

## Workbook migration

`workbook/src/svg.ts` is deleted. `renderChart(spec, x, y)` becomes a thin adapter mapping the
existing `ChartSpec` (`type: 'line'|'scatter'|'bar'`, `title`, `xLabel`, `yLabel`) onto
`plot.line/scatter/bar` — behavior-preserving for the HTML export and `visualization` cells.
`workbook/package.json` gains a `@danielsimonjr/mathts-plot` dependency (`workbook → plot`).
Existing workbook chart tests must stay green unchanged.

## Framework conformance checklist

- ESM-only (`"type":"module"`), ES2022, `tsup src/index.ts --format esm --dts --clean`, vitest.
- `strict: true`; eslint-zero (`src` **and** `tests`); `.js` import extensions; kebab-case files, PascalCase types, camelCase fns.
- Added to root `package.json` workspaces + Turbo pipeline.
- Generated `functions.md`-style export index for the new package via the reference generator; README with example SVGs; CHANGELOG entry.
- **DGT gate:** `npm run build:wasm && npm run docs:deps` → `plot` reachable, **0 cycles**, 0 orphaned/dormant, dep-graph docs regenerated and committed.
- Release: changeset `@danielsimonjr/mathts-plot` (new, `0.1.0`) + `@danielsimonjr/mathts-workbook` (patch, stays publish-ignored per the standing workbook hold).

## Open questions

None blocking. Perspective-vs-ortho default, contour-vs-surface default for 2-var expressions, and
the exact colormap set are pinned above and adjustable during implementation without changing the
architecture.
