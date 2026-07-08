# @danielsimonjr/mathts-plot

Headless SVG 2D/3D plotting for [MathTS](https://github.com/danielsimonjr/mathts).

Pure functions returning self-contained SVG strings — no browser, no canvas, no runtime
dependencies beyond the MathTS bedrock (`core`/`functions`/`expression`). Every function
coerces its input and never throws on bad data: empty, `NaN`, or `Infinity` inputs render a
"no data" placeholder SVG instead of crashing. See
`docs/superpowers/specs/2026-07-07-plotting-design.md` for the design.

## Install

```sh
npm install @danielsimonjr/mathts-plot
```

## Usage

Every function below returns a self-contained SVG string (`<svg ...>...</svg>`) — render it
directly in an `<img src="data:image/svg+xml,...">`, write it to a `.svg` file, or drop it
into HTML.

### `line` — one series, or overlaid with others

```ts
import { line } from '@danielsimonjr/mathts-plot';

const svg = line([0, 1, 2, 3], [0, 1, 4, 9], { title: 'squares', xLabel: 'x', yLabel: 'y' });
// svg === '<svg ...>...</svg>'
```

### `overlay` — combine several layers on shared, auto-scaled axes

```ts
import { overlay } from '@danielsimonjr/mathts-plot';

const svg = overlay(
  [
    { type: 'line', x: [0, 1, 2], y: [0, 1, 2], label: 'model' },
    { type: 'scatter', x: [0, 1, 2], y: [0.1, 1.2, 1.8], label: 'data' },
  ],
  { legend: true }
);
```

### `surface` — 3D surface via orthographic projection + painter's algorithm

```ts
import { surface } from '@danielsimonjr/mathts-plot';

const z = [
  [0, 1, 2],
  [1, 2, 3],
  [2, 3, 4],
]; // z[row][col]
const svg = surface(z, { kind: 'filled', azim: 45, elev: 25 });
```

### `plot` — generic, polymorphic entry point (including expression strings)

```ts
import { plot } from '@danielsimonjr/mathts-plot';

// numeric series → line
plot([0, 1, 4, 9]);
plot([0, 1, 2, 3], [0, 1, 4, 9]);

// expression string, sampled via functions/expression → line
plot('sin(x)', { from: 0, to: Math.PI, samples: 200 });

// two free variables → contour (default) or 3D surface
plot('x^2 + y^2', { from: -2, to: 2 });
plot('x^2 + y^2', { from: -2, to: 2, kind: 'surface' });

// array of Layer2D → overlay
plot([
  { type: 'line', x: [0, 1, 2], y: [0, 1, 2] },
  { type: 'scatter', x: [0, 1, 2], y: [0.1, 1.2, 1.8] },
]);
```

### TikZ / LaTeX output

Every function also accepts `{ format: 'tikz' }` (default is `'svg'`), and there's a
generic `toTikZ()` mirroring `plot()`. The geometry matches the SVG output exactly (a
deterministic y-flip maps SVG's top-left origin to TikZ's bottom-left); only
`\usepackage{tikz}` is required to compile the result.

```ts
import { toTikZ, line, surface } from '@danielsimonjr/mathts-plot';

// generic entry point, expression source → line
const tex = toTikZ('sin(x)', { from: 0, to: Math.PI });

// per-type function via the format option
const tex2 = line([0, 1, 2, 3], [0, 1, 4, 9], { format: 'tikz' });

// standalone: false → a bare tikzpicture for \input, not a compilable document
const z = [
  [0, 1, 2],
  [1, 2, 3],
  [2, 3, 4],
];
const fragment = surface(z, { format: 'tikz', tikz: { standalone: false } });
```

`toTikZ`/`{ format: 'tikz' }` return a LaTeX string, not SVG. With `standalone`
(default `true`) the string is a complete `\documentclass{...}` document you can
compile as-is; `standalone: false` returns just the `tikzpicture` environment, meant
to be pulled in via `\input{...}` from a larger document.

## What it provides

Per-type mark functions, each `(x, y, opts?) => string` unless noted:

- **2D**: `line`, `scatter`, `bar`, `area`, `step`, `errorbar(x, y, yerr, opts?)`,
  `quiver(x, y, u, v, opts?)`.
- **`histogram(data, opts?)`** — bins via `functions.histogram`, then renders bar heights at
  bin centers.
- **`heatmap(z, opts?)`** — viridis-colored grid, `z` as `z[row][col]`.
- **`contour(z, opts?)`** — marching squares over a `z[row][col]` grid.
- **`overlay(layers, opts?)`** — several `Layer2D`s on shared, auto-scaled axes.
- **3D**: `surface(z, opts?)` (wireframe or painter's-algorithm filled),
  `scatter3d(x, y, z, opts?)`, `curve3d(x, y, z, opts?)` — all projected with an orthographic
  camera (`azim`/`elev`).
- **`plot(...)`** — generic polymorphic dispatch over numeric series, layer arrays, and
  expression-source strings (evaluated via `@danielsimonjr/mathts-expression` /
  `@danielsimonjr/mathts-functions`).
- **`viridis(t)`** — the perceptually-uniform colormap used by `heatmap`/`contour`/`surface`,
  exposed for reuse.

Notes:

- Pure ESM, `strict` TypeScript, no runtime dependencies beyond the MathTS bedrock
  (`core`/`functions`/`expression`).
- SVG-only in v1 — no PNG/canvas rendering.
- `workbook` renders its charts through this package (its former private `svg.ts` plotter was
  removed).

## License

MIT (c) Daniel Simon Jr.
