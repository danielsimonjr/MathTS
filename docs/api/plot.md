# @danielsimonjr/mathts-plot API Reference

Headless, dependency-light SVG 2D/3D plotting for MathTS — expression-aware
(samples MathTS expressions directly) and browser-safe by default.

## Installation

```bash
npm install @danielsimonjr/mathts-plot
```

## Overview

Every plotting function returns a **string** — SVG by default. The main `.`
entry is pure-computation and browser-safe (it passes
`npm run check:browser-safety`). TikZ output ships from this same `.` entry via
`toTikZ()` / `format: 'tikz'` — **there is no `./tex` subpath**. PNG/PDF file
output and LaTeX compilation live only in the Node-only `./render` subpath and
require external tools on PATH; `plot` bundles no image/PDF renderer by design.

```typescript
import { plot, line, scatter, surface, toTikZ } from '@danielsimonjr/mathts-plot';
```

## Entry Points

### plot / toTikZ

Polymorphic — dispatches on argument shape.

```typescript
plot(a, b?, c?: PlotOptions): string
```

| Call form                        | Behaviour                                          |
| -------------------------------- | -------------------------------------------------- |
| `plot(y, opts?)`                 | Line with `x = 0..n-1`                             |
| `plot(x, y, opts?)`              | Line                                               |
| `plot(layers: Layer2D[], opts?)` | Overlay of mixed 2D layers                         |
| `plot(source, opts?)`            | Samples a MathTS expression (line/contour/surface) |

`toTikZ(a, b?, c?)` has the same polymorphism, forced to the TikZ backend. Both
`plot` and `toTikZ` are part of the single `.` entry.

## 2D Marks

All `(x, y, opts?) => string` unless noted:

| Function   | Signature                       | Description  |
| ---------- | ------------------------------- | ------------ |
| `line`     | `(x, y, opts?) => string`       | Line chart   |
| `scatter`  | `(x, y, opts?) => string`       | Scatter plot |
| `bar`      | `(x, y, opts?) => string`       | Bar chart    |
| `area`     | `(x, y, opts?) => string`       | Filled area  |
| `step`     | `(x, y, opts?) => string`       | Step chart   |
| `errorbar` | `(x, y, yerr, opts?) => string` | Error bars   |
| `quiver`   | `(x, y, u, v, opts?) => string` | Vector field |

## Other 2D

| Function    | Signature                                        | Description                                             |
| ----------- | ------------------------------------------------ | ------------------------------------------------------- |
| `histogram` | `(data, opts?: PlotOptions & {bins?}) => string` | Bins via `functions.histogram`, bars at centers         |
| `heatmap`   | `(z, opts?) => string`                           | Viridis colormap over a 2-D grid                        |
| `contour`   | `(z, opts?: PlotOptions & {levels?}) => string`  | Marching squares                                        |
| `overlay`   | `(layers: Layer2D[], opts?) => string`           | Several mixed-type 2D layers on shared auto-scaled axes |

## 3D

| Function    | Signature                            | Description                                          |
| ----------- | ------------------------------------ | ---------------------------------------------------- |
| `surface`   | `(z, opts?) => string`               | Wireframe/filled, painter's algorithm, `azim`/`elev` |
| `scatter3d` | `(x, y, z, opts?: P3Opts) => string` | 3D scatter                                           |
| `curve3d`   | `(x, y, z, opts?: P3Opts) => string` | Parametric 3D curve                                  |

## Utility

`viridis(t: number): string` — colormap lookup, `t ∈ [0, 1]` → `"#rrggbb"`.

## Types

| Type          | Definition                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `Data`        | `unknown`                                                                                                                               |
| `AxisSpec`    | `{ label?, scale?: 'linear' \| 'log' }`                                                                                                 |
| `PlotOptions` | `{ title?, xLabel?, yLabel?, x?, y?, width?, height?, theme?, palette?, legend?, from?, to?, samples?, kind?, scope?, format?, tikz? }` |
| `Layer2D`     | `{ type: 'line' \| 'scatter' \| 'bar' \| 'area' \| 'step' \| 'errorbar' \| 'quiver', x?, y, yerr?, u?, v?, label?, color? }`            |

## Constants

| Constant  | Value     | Description                                                                                                       |
| --------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| `VERSION` | `"0.2.0"` | Exported string constant (stale relative to the npm package version — a version-sync gap, not a functional issue) |

## `./render` — Node-only File Output

A deliberately isolated Node-only bridge so `node:child_process` / `node:fs`
never reach the browser bundle. Both `renderToFile` and `latexToPdf` shell out
to external tools that must be pre-installed on PATH — no bundled renderer.

```typescript
import { renderToFile, latexToPdf, PlotRenderError } from '@danielsimonjr/mathts-plot/render';
```

| Export            | Signature                                                    | Description                                                              |
| ----------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `renderToFile`    | `(svg, outPath, opts?: RenderOptions) => ...`                | SVG → PNG/PDF via `rsvg-convert` or `resvg`                              |
| `latexToPdf`      | `(texSource, outPath, opts?: RenderOptions) => ...`          | TikZ/LaTeX → PDF via `pdflatex` or `tectonic`                            |
| `runTool`         | `(...) => ...`                                               | Low-level external-tool invocation                                       |
| `hasTool`         | `(...) => boolean`                                           | Probe whether a tool is on PATH                                          |
| `latexArgs`       | `(...) => ...`                                               | Build LaTeX engine args                                                  |
| `PlotRenderError` | `extends Error` — `readonly missingTool?: string`            | Plot's one deliberate exception (missing tool or I/O failure)            |
| `RenderOptions`   | `{ tool?, timeoutMs?, density?, background? }`               | Render options                                                           |

> `PlotRenderError` is exported **only** from `./render`, never from the main
> `.` entry.

## Not Part of This Package

- **`.toDOT` / `.toMarkdown`** are methods on the expression-AST `Node` class
  (`@danielsimonjr/mathts-expression`), NOT plot exports.
- There is **no `./tex` subpath** — TikZ ships from the main `.` entry.

## Example

```typescript
import { plot, line, toTikZ, surface } from '@danielsimonjr/mathts-plot';

// Browser-safe SVG string
const svg = line([0, 1, 2, 3], [0, 1, 4, 9], { title: 'y = x²' });

// Sample a MathTS expression directly
const curveSvg = plot('sin(x)', { from: 0, to: 6.28, samples: 200 });

// TikZ from the same entry point
const tikz = toTikZ([0, 1, 2, 3], [0, 1, 4, 9]);

// Node-only PNG/PDF (requires rsvg-convert or resvg on PATH):
import { renderToFile } from '@danielsimonjr/mathts-plot/render';
await renderToFile(svg, 'chart.png');
```
