# Plot Scene/Backend + TikZ Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `@danielsimonjr/mathts-plot` so every mark emits an intermediate **Scene** of drawing primitives, add a **TikZ** backend (`emitTikZ` + `toTikZ()` + a `format` option) alongside the existing SVG one, and ship it as **plot 0.2.0** — with SVG output byte-identical to today.

**Architecture:** Approach A (scene + pluggable backend). `scene.ts` defines a `Prim` union + `Scene`. `svg.ts` gains `emitSVG(scene)` (maps prims back through its still-exported builders → byte-identical SVG). `tikz.ts` adds `emitTikZ(scene, opts)` (pure TikZ, same geometry via a deterministic y-flip). A new `emit.ts` dispatches on `opts.format`. The 6 mark files build a Scene and return `emit(scene, opts)`. A golden-master snapshot taken before the refactor guarantees no SVG change.

**Tech Stack:** TypeScript (ESM, ES2022), tsup (`--dts`), vitest (incl. `toMatchSnapshot`), no new runtime deps (pure TikZ needs only the reader's `\usepackage{tikz}`).

## Global Constraints

- ESM-only: all relative imports end in `.js`; `strict: true` (inherit base, no override); eslint-zero across `src` AND `tests` (no `any`, no `@ts-nocheck`, no blanket disables).
- Files kebab-case; types PascalCase; functions/vars camelCase.
- **Behavior-preserving:** the existing plot SVG tests AND the golden-master snapshot (Task 1) must stay green, unchanged, after every refactor task. SVG output is byte-identical.
- **Never-throws** contract preserved: every public function returns a valid document (SVG or TikZ) on any input; empty/NaN/∞ → a "no data" document.
- **Module DAG (no cycle):** `scene.ts` (no imports) ← `svg.ts`, `tikz.ts` (each → scene.ts only) ← `emit.ts` (→ svg.ts + tikz.ts) ← the 6 mark files (→ emit.ts). `svg.ts` and `tikz.ts` MUST NOT import each other. DGT must report 0 cycles + 0 dormant.
- Tests: `import { describe, it, expect } from 'vitest';` explicitly.
- Commit footer on every commit:
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FgHJFoxykNhgQh85uPU2bK
  ```
- Never `--no-verify`/skip hooks. The husky pre-commit hook is SLOW (60–300s+, runs docs:deps): run `git commit` with a ~540000 ms timeout; if it times out, check `git log -1` BEFORE retrying (it usually landed) — only retry if HEAD didn't advance; never amend. Push directly to `main`; verify each push with `git ls-remote origin -h refs/heads/main` (L==R). If the hook regenerates `docs/Architecture/*`, `git add docs/Architecture/` into the same commit.
- Scope: this plan is the plot package ONLY (ships plot 0.2.0). The workbook `--format tex` exporter is Plan 2 — do NOT build it here.

## File Structure

```
plot/src/
  scene.ts        NEW — Prim union + Scene interface (pure types, zero imports)
  svg.ts          MODIFY — keep all builders (still exported/tested); + emitSVG(scene)
  tikz.ts         NEW — emitTikZ(scene, opts) + texEsc + hex→tikz color (→ scene.ts only)
  emit.ts         NEW — emit(scene, opts) dispatch on opts.format (→ svg.ts, tikz.ts)
  frame.ts        MODIFY — draw2D builds a Scene, returns emit(scene, opts)
  render-core.ts  MODIFY — render* return Prim[]; renderLayer returns Prim[]
  heatmap.ts      MODIFY — build Scene, return emit(scene, opts)
  contour.ts      MODIFY — build Scene, return emit(scene, opts)
  three/surface.ts   MODIFY — build Scene, return emit(scene, opts)
  three/points3d.ts  MODIFY — build Scene, return emit(scene, opts)
  types.ts        MODIFY — PlotOptions += format?, tikz?
  plot.ts         MODIFY — pass format through; + toTikZ()
  index.ts        MODIFY — export toTikZ; bump VERSION to 0.2.0
plot/tests/
  golden-svg.test.ts   NEW — snapshot lock of current SVG output (Task 1)
  scene-svg.test.ts    NEW — emitSVG unit + rotate-text prim (Task 2)
  tikz.test.ts         NEW — emitTikZ oracles on hand-built scenes (Task 6)
  tikz-marks.test.ts   NEW — end-to-end TikZ for every mark + parity (Task 7)
```

---

### Task 1: Golden-master SVG snapshot (behavior lock)

**Files:**

- Create: `plot/tests/golden-svg.test.ts` (+ generated `plot/tests/__snapshots__/golden-svg.test.ts.snap`)

**Interfaces:**

- Consumes: the current public plot API (`line/scatter/bar/area/step/histogram/errorbar/quiver/contour/heatmap/surface/scatter3d/curve3d/overlay`).
- Produces: a committed snapshot file that pins the EXACT current SVG output of representative charts. Every later refactor task re-runs this; a diff = a behavior change to fix.

- [ ] **Step 1: Write the snapshot test** — `plot/tests/golden-svg.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  line,
  scatter,
  bar,
  area,
  step,
  histogram,
  errorbar,
  quiver,
  contour,
  heatmap,
  overlay,
  surface,
  scatter3d,
  curve3d,
} from '../src/index.js';

// Fixed inputs → deterministic output. Exercises every mark + legend + xLabel + yLabel
// (the rotated-text bypass) + the alpha area fill + scatter3d depth opacity + no-data.
const grid = [
  [0, 1, 0],
  [1, 2, 1],
  [0, 1, 0],
];

describe('golden SVG output (behavior lock — must not change across the scene refactor)', () => {
  it('line', () =>
    expect(
      line([0, 1, 2, 3], [0, 1, 4, 9], { title: 'sq', xLabel: 'x', yLabel: 'y' })
    ).toMatchSnapshot());
  it('scatter', () => expect(scatter([0, 1, 2], [1, 2, 3])).toMatchSnapshot());
  it('bar', () => expect(bar([0, 1, 2], [3, 1, 2])).toMatchSnapshot());
  it('area', () => expect(area([0, 1, 2], [1, 2, 1])).toMatchSnapshot());
  it('step', () => expect(step([0, 1, 2], [1, 2, 3])).toMatchSnapshot());
  it('histogram', () =>
    expect(histogram([1, 2, 2, 3, 3, 3, 4, 4, 4, 4], { bins: 4 })).toMatchSnapshot());
  it('errorbar', () => expect(errorbar([0, 1, 2], [1, 2, 3], [0.2, 0.2, 0.2])).toMatchSnapshot());
  it('quiver', () => expect(quiver([0, 1], [0, 0], [1, 1], [1, -1])).toMatchSnapshot());
  it('overlay+legend+ylabel', () =>
    expect(
      overlay(
        [
          { type: 'line', x: [0, 1, 2], y: [0, 1, 2], label: 'model' },
          { type: 'scatter', x: [0, 1, 2], y: [0.1, 1.2, 1.8], label: 'data' },
        ],
        { legend: true, xLabel: 'x', yLabel: 'y' }
      )
    ).toMatchSnapshot());
  it('contour', () => expect(contour(grid, { levels: 5 })).toMatchSnapshot());
  it('heatmap', () => expect(heatmap(grid)).toMatchSnapshot());
  it('surface', () =>
    expect(surface(grid, { kind: 'filled', azim: 45, elev: 25 })).toMatchSnapshot());
  it('scatter3d', () => expect(scatter3d([0, 1, 2], [0, 1, 0], [1, 0, 1])).toMatchSnapshot());
  it('curve3d', () => expect(curve3d([0, 1, 2], [0, 1, 0], [0, 0.5, 1])).toMatchSnapshot());
  it('no-data', () => expect(line([], [])).toMatchSnapshot());
});
```

- [ ] **Step 2: Run to generate the snapshot** — `npx vitest run plot/tests/golden-svg.test.ts`
      Expected: PASS (15 tests) — the first run WRITES `plot/tests/__snapshots__/golden-svg.test.ts.snap` capturing current output. Confirm the `.snap` file now exists.

- [ ] **Step 3: Re-run to confirm the lock holds** — `npx vitest run plot/tests/golden-svg.test.ts` → PASS again (now asserting against the written snapshot). Full suite `npx vitest run plot/` → GREEN (56 = 55 + this file... note: golden-svg.test.ts is one FILE with 15 tests, so tests total rises by 15). `cd plot && npx eslint tests` → 0.

- [ ] **Step 4: Commit** (stage the test AND the snapshot; + `docs/Architecture/` if regenerated).

```bash
git add plot/tests/golden-svg.test.ts plot/tests/__snapshots__/ docs/Architecture/
git commit -m "test(plot): golden-master SVG snapshots (behavior lock for scene refactor)"
```

---

### Task 2: `scene.ts` + `emitSVG` + `emit.ts` (additive foundation)

**Files:**

- Create: `plot/src/scene.ts`, `plot/src/emit.ts`
- Modify: `plot/src/svg.ts` (append `emitSVG`; keep everything exported)
- Test: `plot/tests/scene-svg.test.ts`

**Interfaces:**

- Produces:
  - `type Prim` (tagged union: line/circle/rect/polyline/polygon/text) + `interface Scene { width, height, bg, prims: Prim[] }` (scene.ts).
  - `emitSVG(scene: Scene): string` (svg.ts) — maps each Prim through the existing builders, wraps in `svgDoc`.
  - `emit(scene: Scene, opts?: { format?: 'svg' | 'tikz'; tikz?: { standalone?: boolean; scale?: number } }): string` (emit.ts) — for now returns `emitSVG(scene)` regardless of format (the tikz branch is added in Task 7; keeping the signature stable now means the marks are wired once).
- Consumes: nothing new.

- [ ] **Step 1: Write the failing test** — `plot/tests/scene-svg.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import type { Scene } from '../src/scene.js';
import { emitSVG } from '../src/svg.js';
import { emit } from '../src/emit.js';

describe('emitSVG', () => {
  it('serializes prims through the svg builders, wrapped in svgDoc', () => {
    const scene: Scene = {
      width: 100,
      height: 50,
      bg: '#ffffff',
      prims: [
        { k: 'rect', x: 0, y: 0, w: 10, h: 10, fill: '#000000' },
        { k: 'circle', cx: 10, cy: 20, r: 3, fill: '#000' },
        {
          k: 'polyline',
          pts: [
            [0, 0],
            [10, 10],
          ],
          stroke: '#123456',
          w: 2,
        },
        { k: 'text', x: 5, y: 5, s: 'a<b>', fill: '#111', anchor: 'middle', size: 12 },
      ],
    };
    const svg = emitSVG(scene);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('viewBox="0 0 100 50"');
    expect(svg).toContain('<circle cx="10" cy="20" r="3" fill="#000"/>');
    expect(svg).toContain('<polyline points="0,0 10,10"');
    expect(svg).toContain('a&lt;b&gt;'); // text escaped at emit time
  });

  it('rotate on a text prim emits the transform form (matches frame.ts ylabel)', () => {
    const scene: Scene = {
      width: 100,
      height: 50,
      bg: '#fff',
      prims: [
        {
          k: 'text',
          x: 16,
          y: 25,
          s: 'y',
          fill: '#1a1a2e',
          anchor: 'middle',
          size: 12,
          rotate: -90,
        },
      ],
    };
    expect(emitSVG(scene)).toContain(
      '<text transform="translate(16,25) rotate(-90)" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="#1a1a2e">y</text>'
    );
  });

  it('emit() defaults to SVG', () => {
    const scene: Scene = { width: 10, height: 10, bg: '#fff', prims: [] };
    expect(emit(scene)).toBe(emitSVG(scene));
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run plot/tests/scene-svg.test.ts` → FAIL (modules not found).

- [ ] **Step 3: Create `plot/src/scene.ts`**

```ts
/** Backend-agnostic drawing primitives. Marks build these; a backend serializes them. */
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

/** A complete drawable: canvas size, background, and an ordered list of primitives. */
export interface Scene {
  width: number;
  height: number;
  bg: string;
  prims: Prim[];
}
```

- [ ] **Step 3b: Append `emitSVG` to `plot/src/svg.ts`** (leave all existing builders exported and unchanged; add at the end)

```ts
import type { Scene, Prim } from './scene.js';

function primSVG(p: Prim): string {
  switch (p.k) {
    case 'line':
      return line(p.x1, p.y1, p.x2, p.y2, p.stroke, p.w);
    case 'circle':
      return circle(p.cx, p.cy, p.r, p.fill, p.opacity);
    case 'rect':
      return rect(p.x, p.y, p.w, p.h, p.fill);
    case 'polyline':
      return polyline(p.pts, p.stroke, p.w);
    case 'polygon':
      return polygon(p.pts, p.fill, p.stroke);
    case 'text':
      // rotate branch reproduces frame.ts's former hand-written y-label string exactly
      // (no r2 on the translate coords — matches the prior output byte-for-byte).
      return p.rotate !== undefined
        ? `<text transform="translate(${p.x},${p.y}) rotate(${p.rotate})" text-anchor="${p.anchor}" font-family="system-ui,sans-serif" font-size="${p.size}" fill="${p.fill}">${esc(p.s)}</text>`
        : text(p.x, p.y, p.s, p.fill, p.anchor, p.size);
  }
}

/** Serialize a Scene to a self-contained SVG string (reuses the exported builders). */
export function emitSVG(scene: Scene): string {
  return svgDoc(scene.width, scene.height, scene.prims.map(primSVG).join(''), scene.bg);
}
```

Note: the `import type { Scene, Prim } from './scene.js';` line goes at the TOP of svg.ts (grouped with any imports; svg.ts currently has none — add it as the first line).

- [ ] **Step 3c: Create `plot/src/emit.ts`**

```ts
import type { Scene } from './scene.js';
import { emitSVG } from './svg.js';
import type { PlotOptions } from './types.js';

/**
 * Serialize a Scene via the chosen backend. The tikz branch is wired in a later
 * task; today every format returns SVG so callers can be written against emit()
 * once and never re-touched.
 */
export function emit(scene: Scene, _opts: PlotOptions = {}): string {
  return emitSVG(scene);
}
```

(The `_opts` param is intentionally unused for now — the underscore satisfies `noUnusedParameters`. Task 7 replaces the body with the format dispatch and drops the underscore.)

- [ ] **Step 4: Run to verify it passes** — `npx vitest run plot/tests/scene-svg.test.ts` → PASS (3). Full suite `npx vitest run plot/` → GREEN (golden snapshots unchanged — nothing that renders was touched). `cd plot && npx tsc --noEmit` → 0. `cd plot && npx eslint src tests` → 0.

- [ ] **Step 5: Commit.**

```bash
git add plot/src/scene.ts plot/src/emit.ts plot/src/svg.ts plot/tests/scene-svg.test.ts docs/Architecture/
git commit -m "feat(plot): scene primitives + emitSVG + emit() dispatch scaffold"
```

---

### Task 3: Refactor `render-core.ts` + `frame.ts` to the scene model

**Files:**

- Modify: `plot/src/render-core.ts`, `plot/src/frame.ts`
- Test: golden-svg.test.ts + the full suite (regression net — unchanged)

**Interfaces:**

- Consumes: `Prim`/`Scene` (scene.ts), `emit` (emit.ts), `emitSVG` no longer called directly by marks.
- Produces:
  - render-core: `renderLayer(layer, f, i): Prim[]` and each `render*` returns `Prim[]`.
  - frame: `draw2D(layers, opts): string` (signature unchanged) now builds a `Scene` and returns `emit(scene, opts)`. Also export a helper `frameScene(layers, opts): Scene | null` is NOT needed — keep it inline.

- [ ] **Step 1: Confirm the regression net** — `npx vitest run plot/tests/golden-svg.test.ts plot/tests/marks2d.test.ts` → currently GREEN (baseline before edit).

- [ ] **Step 2: Rewrite `plot/src/render-core.ts`** — same geometry, but each renderer returns `Prim[]` (replace each `svg builder call` with the matching prim object). New file:

```ts
import { coerce1dPositional } from './coerce.js';
import type { Theme } from './svg.js';
import type { Layer2D } from './types.js';
import type { Prim } from './scene.js';

export interface Frame {
  px: (x: number) => number;
  py: (y: number) => number;
  xdom: [number, number];
  ydom: [number, number];
  theme: Theme;
  width: number;
  height: number;
  color: (i: number) => string;
}

function xy(layer: Layer2D): Array<[number, number]> {
  const ys = coerce1dPositional(layer.y);
  const xs = layer.x ? coerce1dPositional(layer.x) : ys.map((_, i) => i);
  const n = Math.min(xs.length, ys.length);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) pts.push([xs[i], ys[i]]);
  }
  return pts;
}

function renderLine(layer: Layer2D, f: Frame, i: number): Prim[] {
  const color = layer.color ?? f.color(i);
  const pts = xy(layer).map(([x, y]) => [f.px(x), f.py(y)] as [number, number]);
  return [
    { k: 'polyline', pts, stroke: color, w: 2 },
    ...pts.map((p): Prim => ({ k: 'circle', cx: p[0], cy: p[1], r: 2.5, fill: color })),
  ];
}

function renderScatter(layer: Layer2D, f: Frame, i: number): Prim[] {
  const color = layer.color ?? f.color(i);
  return xy(layer).map(
    ([x, y]): Prim => ({ k: 'circle', cx: f.px(x), cy: f.py(y), r: 3, fill: color })
  );
}

function renderBar(layer: Layer2D, f: Frame, i: number): Prim[] {
  const color = layer.color ?? f.color(i);
  const pts = xy(layer);
  const base = f.py(Math.max(0, f.ydom[0]));
  const bw = pts.length > 1 ? Math.abs(f.px(pts[1][0]) - f.px(pts[0][0])) * 0.7 : 20;
  return pts.map(([x, y]): Prim => {
    const yp = f.py(y);
    return {
      k: 'rect',
      x: f.px(x) - bw / 2,
      y: Math.min(yp, base),
      w: bw,
      h: Math.abs(base - yp),
      fill: color,
    };
  });
}

function renderArea(layer: Layer2D, f: Frame, i: number): Prim[] {
  const color = layer.color ?? f.color(i);
  const pts = xy(layer).map(([x, y]) => [f.px(x), f.py(y)] as [number, number]);
  if (pts.length === 0) return [];
  const base = f.py(Math.max(0, f.ydom[0]));
  const poly: Array<[number, number]> = [[pts[0][0], base], ...pts, [pts[pts.length - 1][0], base]];
  return [
    { k: 'polygon', pts: poly, fill: color + '55', stroke: 'none' },
    { k: 'polyline', pts, stroke: color, w: 2 },
  ];
}

function renderStep(layer: Layer2D, f: Frame, i: number): Prim[] {
  const color = layer.color ?? f.color(i);
  const pts = xy(layer).map(([x, y]) => [f.px(x), f.py(y)] as [number, number]);
  const stepped: Array<[number, number]> = [];
  for (let k = 0; k < pts.length; k++) {
    stepped.push(pts[k]);
    if (k < pts.length - 1) stepped.push([pts[k + 1][0], pts[k][1]]);
  }
  return [{ k: 'polyline', pts: stepped, stroke: color, w: 2 }];
}

function renderErrorbar(layer: Layer2D, f: Frame, i: number): Prim[] {
  const color = layer.color ?? f.color(i);
  const ys = coerce1dPositional(layer.y);
  const xs = layer.x ? coerce1dPositional(layer.x) : ys.map((_, k) => k);
  const errs = coerce1dPositional(layer.yerr ?? []);
  const n = Math.min(xs.length, ys.length);
  const out: Prim[] = [];
  for (let k = 0; k < n; k++) {
    if (!Number.isFinite(xs[k]) || !Number.isFinite(ys[k])) continue;
    const e = Number.isFinite(errs[k]) ? errs[k] : 0;
    const cx = f.px(xs[k]);
    const top = f.py(ys[k] + e);
    const bot = f.py(ys[k] - e);
    out.push(
      { k: 'line', x1: cx, y1: top, x2: cx, y2: bot, stroke: color, w: 1.5 },
      { k: 'line', x1: cx - 3, y1: top, x2: cx + 3, y2: top, stroke: color, w: 1.5 },
      { k: 'line', x1: cx - 3, y1: bot, x2: cx + 3, y2: bot, stroke: color, w: 1.5 },
      { k: 'circle', cx, cy: f.py(ys[k]), r: 3, fill: color }
    );
  }
  return out;
}

function renderQuiver(layer: Layer2D, f: Frame, i: number): Prim[] {
  const color = layer.color ?? f.color(i);
  const xs = layer.x ? coerce1dPositional(layer.x) : [];
  const ys = coerce1dPositional(layer.y);
  const us = coerce1dPositional(layer.u ?? []);
  const vs = coerce1dPositional(layer.v ?? []);
  const n = Math.min(xs.length, ys.length, us.length, vs.length);
  const out: Prim[] = [];
  for (let k = 0; k < n; k++) {
    if (![xs[k], ys[k], us[k], vs[k]].every(Number.isFinite)) continue;
    const x0 = f.px(xs[k]);
    const y0 = f.py(ys[k]);
    const x1 = f.px(xs[k] + us[k]);
    const y1 = f.py(ys[k] + vs[k]);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const ah = 5;
    out.push(
      { k: 'line', x1: x0, y1: y0, x2: x1, y2: y1, stroke: color, w: 1.5 },
      {
        k: 'line',
        x1,
        y1,
        x2: x1 - ah * Math.cos(ang - 0.4),
        y2: y1 - ah * Math.sin(ang - 0.4),
        stroke: color,
        w: 1.5,
      },
      {
        k: 'line',
        x1,
        y1,
        x2: x1 - ah * Math.cos(ang + 0.4),
        y2: y1 - ah * Math.sin(ang + 0.4),
        stroke: color,
        w: 1.5,
      }
    );
  }
  return out;
}

export function renderLayer(layer: Layer2D, f: Frame, i: number): Prim[] {
  switch (layer.type) {
    case 'line':
      return renderLine(layer, f, i);
    case 'scatter':
      return renderScatter(layer, f, i);
    case 'bar':
      return renderBar(layer, f, i);
    case 'area':
      return renderArea(layer, f, i);
    case 'step':
      return renderStep(layer, f, i);
    case 'errorbar':
      return renderErrorbar(layer, f, i);
    case 'quiver':
      return renderQuiver(layer, f, i);
    default:
      return renderLine(layer, f, i);
  }
}
```

- [ ] **Step 3: Rewrite `plot/src/frame.ts`** — draw2D builds a Scene (prims in the SAME order draw2D concatenated: grid, axes, xtick labels, ytick labels, title, xlab, ylab, marks, legend), returns `emit(scene, opts)`. New file:

```ts
import { coerce1d } from './coerce.js';
import { extent, linearScale, logScale, niceTicks } from './scale.js';
import { THEMES, type Theme, fmt } from './svg.js';
import type { Layer2D, PlotOptions } from './types.js';
import { renderLayer, type Frame } from './render-core.js';
import type { Prim, Scene } from './scene.js';
import { emit } from './emit.js';

const MARGIN = { top: 34, right: 20, bottom: 46, left: 64 };

function combinedExtent(layers: Layer2D[], pick: (l: Layer2D) => number[]): [number, number] {
  const all: number[] = [];
  for (const l of layers) all.push(...pick(l));
  return extent(all);
}

function noDataScene(width: number, height: number, theme: Theme): Scene {
  return {
    width,
    height,
    bg: theme.bg,
    prims: [
      {
        k: 'text',
        x: width / 2,
        y: height / 2,
        s: 'no data',
        fill: theme.muted,
        anchor: 'middle',
        size: 13,
      },
    ],
  };
}

/** Shared 2-D rendering core: builds a Scene (axes+ticks+grid+labels+legend+marks). Never throws. */
export function draw2D(layers: Layer2D[], opts: PlotOptions = {}): string {
  const width = opts.width ?? 520;
  const height = opts.height ?? 320;
  const theme = THEMES[opts.theme ?? 'light'];
  try {
    const yAll = layers.flatMap((l) => coerce1d(l.y));
    if (yAll.length === 0) return emit(noDataScene(width, height, theme), opts);

    const xdom = combinedExtent(layers, (l) =>
      l.x ? coerce1d(l.x) : coerce1d(l.y).map((_, i) => i)
    );
    const ydom = combinedExtent(layers, (l) => coerce1d(l.y));
    if (!Number.isFinite(xdom[0]) || !Number.isFinite(ydom[0]))
      return emit(noDataScene(width, height, theme), opts);

    const innerX: [number, number] = [MARGIN.left, width - MARGIN.right];
    const innerY: [number, number] = [height - MARGIN.bottom, MARGIN.top];
    const xScaleFn = opts.x?.scale === 'log' ? logScale : linearScale;
    const yScaleFn = opts.y?.scale === 'log' ? logScale : linearScale;
    const px = xScaleFn(xdom, innerX);
    const py = yScaleFn(ydom, innerY);
    const frame: Frame = {
      px,
      py,
      xdom,
      ydom,
      theme,
      width,
      height,
      color: (i: number) => theme.series[i % theme.series.length],
    };

    const prims: Prim[] = [];
    const xticks = niceTicks(xdom[0], xdom[1]).filter((t) => t >= xdom[0] && t <= xdom[1]);
    const yticks = niceTicks(ydom[0], ydom[1]).filter((t) => t >= ydom[0] && t <= ydom[1]);
    // grid
    for (const t of xticks)
      prims.push({
        k: 'line',
        x1: px(t),
        y1: innerY[0],
        x2: px(t),
        y2: innerY[1],
        stroke: theme.grid,
        w: 1,
      });
    for (const t of yticks)
      prims.push({
        k: 'line',
        x1: innerX[0],
        y1: py(t),
        x2: innerX[1],
        y2: py(t),
        stroke: theme.grid,
        w: 1,
      });
    // axes
    prims.push({
      k: 'line',
      x1: MARGIN.left,
      y1: height - MARGIN.bottom,
      x2: width - MARGIN.right,
      y2: height - MARGIN.bottom,
      stroke: theme.axis,
      w: 1,
    });
    prims.push({
      k: 'line',
      x1: MARGIN.left,
      y1: MARGIN.top,
      x2: MARGIN.left,
      y2: height - MARGIN.bottom,
      stroke: theme.axis,
      w: 1,
    });
    // tick labels
    for (const t of xticks)
      prims.push({
        k: 'text',
        x: px(t),
        y: height - MARGIN.bottom + 16,
        s: fmt(t),
        fill: theme.muted,
        anchor: 'middle',
        size: 11,
      });
    for (const t of yticks)
      prims.push({
        k: 'text',
        x: MARGIN.left - 8,
        y: py(t) + 4,
        s: fmt(t),
        fill: theme.muted,
        anchor: 'end',
        size: 11,
      });
    // title + axis labels
    if (opts.title)
      prims.push({
        k: 'text',
        x: width / 2,
        y: 20,
        s: opts.title,
        fill: theme.fg,
        anchor: 'middle',
        size: 14,
      });
    if (opts.xLabel)
      prims.push({
        k: 'text',
        x: MARGIN.left + (width - MARGIN.left - MARGIN.right) / 2,
        y: height - 8,
        s: opts.xLabel,
        fill: theme.fg,
        anchor: 'middle',
        size: 12,
      });
    if (opts.yLabel)
      prims.push({
        k: 'text',
        x: 16,
        y: MARGIN.top + (height - MARGIN.top - MARGIN.bottom) / 2,
        s: opts.yLabel,
        fill: theme.fg,
        anchor: 'middle',
        size: 12,
        rotate: -90,
      });
    // marks
    layers.forEach((l, i) => prims.push(...renderLayer(l, frame, i)));
    // legend
    if (opts.legend && layers.some((l) => l.label)) {
      layers.forEach((l, i) => {
        if (!l.label) return;
        const ly = MARGIN.top + 4 + i * 16;
        const c = l.color ?? frame.color(i);
        prims.push({ k: 'rect', x: width - MARGIN.right - 120, y: ly - 8, w: 10, h: 10, fill: c });
        prims.push({
          k: 'text',
          x: width - MARGIN.right - 106,
          y: ly + 1,
          s: l.label,
          fill: theme.fg,
          anchor: 'start',
          size: 11,
        });
      });
    }

    return emit({ width, height, bg: theme.bg, prims }, opts);
  } catch {
    return emit(noDataScene(width, height, theme), opts);
  }
}
```

- [ ] **Step 4: Run the regression net** — `npx vitest run plot/` → GREEN. The golden snapshot for line/scatter/bar/area/step/histogram/errorbar/quiver/overlay/no-data must be **unchanged** (byte-identical). If any snapshot diffs, the prim order or a value drifted — fix it, do NOT update the snapshot. `cd plot && npx tsc --noEmit` → 0. `cd plot && npx eslint src tests` → 0.

- [ ] **Step 5: Commit.**

```bash
git add plot/src/render-core.ts plot/src/frame.ts docs/Architecture/
git commit -m "refactor(plot): draw2D + 2D marks emit a Scene (SVG byte-identical)"
```

---

### Task 4: Refactor `heatmap.ts` + `contour.ts` to the scene model

**Files:**

- Modify: `plot/src/heatmap.ts`, `plot/src/contour.ts`
- Test: golden-svg.test.ts + heatmap.test.ts + contour.test.ts (regression net)

**Interfaces:**

- Consumes: `Prim`/`Scene`, `emit`, `THEMES`/`text`-free (build prims), `coerce2d`, `viridis`, `linearScale`.
- Produces: `heatmap`/`contour` (signatures unchanged) build a Scene and return `emit(scene, opts)`.

- [ ] **Step 1: Confirm baseline** — `npx vitest run plot/tests/heatmap.test.ts plot/tests/contour.test.ts plot/tests/golden-svg.test.ts` → GREEN.

- [ ] **Step 2: Rewrite `plot/src/heatmap.ts`** (build cells + title as prims; emit):

```ts
import { coerce2d } from './coerce.js';
import { viridis } from './palette.js';
import { THEMES } from './svg.js';
import type { PlotOptions } from './types.js';
import type { Prim, Scene } from './scene.js';
import { emit } from './emit.js';

const MARGIN = { top: 34, right: 22, bottom: 30, left: 40 };

export function heatmap(z: unknown, opts: PlotOptions = {}): string {
  const width = opts.width ?? 520;
  const height = opts.height ?? 320;
  const theme = THEMES[opts.theme ?? 'light'];
  const grid = coerce2d(z);
  const rows = grid.length;
  const cols = rows ? grid[0].length : 0;
  if (rows === 0 || cols === 0) {
    const scene: Scene = {
      width,
      height,
      bg: theme.bg,
      prims: [
        {
          k: 'text',
          x: width / 2,
          y: height / 2,
          s: 'no data',
          fill: theme.muted,
          anchor: 'middle',
          size: 13,
        },
      ],
    };
    return emit(scene, opts);
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const row of grid)
    for (const v of row)
      if (Number.isFinite(v)) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
  const span = hi > lo ? hi - lo : 1;
  const cw = (width - MARGIN.left - MARGIN.right) / cols;
  const ch = (height - MARGIN.top - MARGIN.bottom) / rows;
  const prims: Prim[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = grid[r][c];
      const color = Number.isFinite(v) ? viridis((v - lo) / span) : theme.grid;
      prims.push({
        k: 'rect',
        x: MARGIN.left + c * cw,
        y: MARGIN.top + r * ch,
        w: cw + 0.5,
        h: ch + 0.5,
        fill: color,
      });
    }
  }
  if (opts.title)
    prims.push({
      k: 'text',
      x: width / 2,
      y: 20,
      s: opts.title,
      fill: theme.fg,
      anchor: 'middle',
      size: 14,
    });
  return emit({ width, height, bg: theme.bg, prims }, opts);
}
```

- [ ] **Step 3: Rewrite `plot/src/contour.ts`** — replace each `svgLine(...)` with a `line` prim and each `text(...)` with a `text` prim, wrap in a Scene, `emit`. Read the current `contour.ts` and mechanically convert: the marching-squares loop pushes `{ k: 'line', x1: px(ax), y1: py(ay), x2: px(bx), y2: py(by), stroke: color, w: 1.5 }` prims; the degenerate/`rows<2||cols<2` guard returns a `no data` text-prim Scene; the optional title becomes a `text` prim; the final return is `emit({ width, height, bg: theme.bg, prims }, opts)`. Keep ALL geometry math (levels, interp, crossings) exactly as-is — only the emission changes. Imports become: `coerce2d`, `linearScale`, `viridis`, `THEMES` (from svg.js), `PlotOptions`, `Prim`/`Scene`, `emit`.

- [ ] **Step 4: Run the regression net** — `npx vitest run plot/` → GREEN; the heatmap/contour golden snapshots unchanged. `cd plot && npx tsc --noEmit` → 0. `cd plot && npx eslint src tests` → 0.

- [ ] **Step 5: Commit.**

```bash
git add plot/src/heatmap.ts plot/src/contour.ts docs/Architecture/
git commit -m "refactor(plot): heatmap + contour emit a Scene (SVG byte-identical)"
```

---

### Task 5: Refactor `three/surface.ts` + `three/points3d.ts` to the scene model

**Files:**

- Modify: `plot/src/three/surface.ts`, `plot/src/three/points3d.ts`
- Test: golden-svg.test.ts + surface.test.ts + points3d.test.ts

**Interfaces:**

- Consumes: `Prim`/`Scene`, `emit` (from `../emit.js`), `project`/`Camera`, `viridis`, `coerce2d`/`coerce1d`, `THEMES` (from `../svg.js`).
- Produces: `surface`/`scatter3d`/`curve3d` (signatures unchanged) build a Scene and return `emit(scene, opts)`.

- [ ] **Step 1: Confirm baseline** — `npx vitest run plot/tests/surface.test.ts plot/tests/points3d.test.ts plot/tests/golden-svg.test.ts` → GREEN.

- [ ] **Step 2: Rewrite `plot/src/three/surface.ts`** — mechanical conversion, geometry unchanged: `polygon(pts, viridis(shade), theme.grid)` → `{ k: 'polygon', pts, fill: viridis(shade), stroke: theme.grid }`; `polyline(row.map(toScreen), theme.series[0], 1)` → `{ k: 'polyline', pts: row.map(toScreen), stroke: theme.series[0], w: 1 }`; the degenerate guard + title → text prims; final `svgDoc(...)` → `emit({ width, height, bg: theme.bg, prims }, opts)`. Keep the projection, painter's-sort (`quads.sort((a,b)=>b.depth-a.depth)`), and shading exactly. Imports: drop `polygon/polyline/svgDoc/text` from `../svg.js` (keep `THEMES`), add `Prim`/`Scene` from `../scene.js` and `emit` from `../emit.js`.

- [ ] **Step 3: Rewrite `plot/src/three/points3d.ts`** — mechanical: `circle(sx, sy, 3, color, opacity)` → `{ k: 'circle', cx: sx, cy: sy, r: 3, fill: color, opacity }`; `polyline(screen.map(toScreen), color, 2)` → `{ k: 'polyline', pts: screen.map(toScreen), stroke: color, w: 2 }`; no-data guard + title → text prims; final → `emit({ width, height, bg: theme.bg, prims }, opts)`. Keep the far-first sort, depth-cued opacity, `minOf/maxOf` helpers, and projection exactly. Imports: drop `circle/polyline/svgDoc/text` from `../svg.js` (keep `THEMES`), add `Prim`/`Scene`, `emit`.

- [ ] **Step 4: Run the regression net** — `npx vitest run plot/` → GREEN; surface/scatter3d/curve3d golden snapshots unchanged. `cd plot && npx tsc --noEmit` → 0. `cd plot && npx eslint src tests` → 0.

- [ ] **Step 5: Commit.**

```bash
git add plot/src/three/surface.ts plot/src/three/points3d.ts docs/Architecture/
git commit -m "refactor(plot): 3D surface + points3d emit a Scene (SVG byte-identical)"
```

> After Task 5, the SVG path is 100% scene-driven and byte-identical (golden snapshots green). No mark imports svg.ts's drawing builders anymore — they live only inside `emitSVG`. Verify: `grep -rn \"from './svg.js'\" plot/src/render-core.ts plot/src/frame.ts plot/src/heatmap.ts plot/src/contour.ts plot/src/three/` should show only `THEMES`/`fmt`/`type Theme` imports, never `line/circle/rect/polyline/polygon/text/svgDoc`.

---

### Task 6: `tikz.ts` — `emitTikZ` + helpers (oracle-tested on hand-built scenes)

**Files:**

- Create: `plot/src/tikz.ts`
- Test: `plot/tests/tikz.test.ts`

**Interfaces:**

- Produces: `emitTikZ(scene: Scene, opts?: PlotOptions): string`, plus internal `texEsc`, `tikzColor`.
- Consumes: `Scene`/`Prim` (scene.ts), `PlotOptions` (types.ts — the `tikz` sub-option is added in Task 7; until then emitTikZ reads `opts.tikz?` via an optional shape).

- [ ] **Step 1: Write the failing test** — `plot/tests/tikz.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import type { Scene } from '../src/scene.js';
import { emitTikZ } from '../src/tikz.js';

const scene = (prims: Scene['prims']): Scene => ({ width: 100, height: 50, bg: '#ffffff', prims });

describe('emitTikZ', () => {
  it('wraps a standalone document by default', () => {
    const out = emitTikZ(scene([]));
    expect(out).toContain('\\documentclass');
    expect(out).toContain('standalone');
    expect(out).toContain('\\begin{tikzpicture}');
    expect(out).toContain('\\end{document}');
  });

  it('fragment mode emits only the tikzpicture', () => {
    const out = emitTikZ(scene([]), { tikz: { standalone: false } });
    expect(out).toContain('\\begin{tikzpicture}');
    expect(out).not.toContain('\\documentclass');
  });

  it('flips y and scales coordinates (geometry oracle)', () => {
    // A line from (0,0) to (100,50) in SVG space, scale 1 → TikZ (0, 50) to (100, 0).
    const out = emitTikZ(
      scene([{ k: 'line', x1: 0, y1: 0, x2: 100, y2: 50, stroke: '#000000', w: 1 }]),
      {
        tikz: { standalone: false, scale: 1 },
      }
    );
    expect(out).toContain('(0,50)');
    expect(out).toContain('(100,0)');
    expect(out).toMatch(/\\draw/);
  });

  it('converts hex color to a tikz rgb color', () => {
    const out = emitTikZ(scene([{ k: 'circle', cx: 10, cy: 10, r: 3, fill: '#2a4d8f' }]), {
      tikz: { standalone: false, scale: 1 },
    });
    expect(out).toContain('{rgb,255:red,42;green,77;blue,143}');
    expect(out).toMatch(/circle/);
  });

  it('splits an 8-hex fill into color + fill opacity', () => {
    const out = emitTikZ(
      scene([
        {
          k: 'polygon',
          pts: [
            [0, 0],
            [10, 0],
            [10, 10],
          ],
          fill: '#2a4d8f55',
          stroke: 'none',
        },
      ]),
      { tikz: { standalone: false, scale: 1 } }
    );
    expect(out).toContain('fill opacity=0.33'); // 0x55/255 ≈ 0.333
  });

  it('escapes LaTeX specials in text', () => {
    const out = emitTikZ(
      scene([
        { k: 'text', x: 5, y: 5, s: 'a_b% & $x$', fill: '#111111', anchor: 'middle', size: 12 },
      ]),
      { tikz: { standalone: false, scale: 1 } }
    );
    expect(out).toContain('a\\_b\\% \\& \\$x\\$');
    expect(out).toMatch(/\\node/);
  });

  it('rotates a text node', () => {
    const out = emitTikZ(
      scene([
        { k: 'text', x: 5, y: 5, s: 'y', fill: '#111111', anchor: 'middle', size: 12, rotate: -90 },
      ]),
      { tikz: { standalone: false, scale: 1 } }
    );
    expect(out).toContain('rotate=-90');
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run plot/tests/tikz.test.ts` → FAIL (module not found).

- [ ] **Step 3: Create `plot/src/tikz.ts`**

```ts
import type { Scene, Prim } from './scene.js';
import type { PlotOptions } from './types.js';

/** Escape the LaTeX specials that break a plain \node/text body. */
export function texEsc(s: string): string {
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

/** A hex color (#rrggbb / #rrggbbaa) or a passthrough tikz color name, with alpha. */
function tikzColor(c: string): { color: string; alpha: number } {
  if (c === 'none') return { color: 'none', alpha: 1 };
  if (c.startsWith('#')) {
    const h = c.slice(1);
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const alpha = h.length >= 8 ? Math.round((parseInt(h.slice(6, 8), 16) / 255) * 100) / 100 : 1;
    return { color: `{rgb,255:red,${r};green,${g};blue,${b}}`, alpha };
  }
  return { color: c, alpha: 1 };
}

const round = (n: number): number => Math.round(n * 100) / 100;
const ANCHOR: Record<'start' | 'middle' | 'end', string> = {
  start: 'base west',
  middle: 'base',
  end: 'base east',
};

function primTikZ(p: Prim, X: (x: number) => number, Y: (y: number) => number, s: number): string {
  const pt = (x: number, y: number): string => `(${X(x)},${Y(y)})`;
  const path = (pts: Array<[number, number]>): string => pts.map(([x, y]) => pt(x, y)).join(' -- ');
  switch (p.k) {
    case 'line': {
      const { color } = tikzColor(p.stroke);
      return `\\draw[color=${color},line width=${round(p.w * s)}pt] ${pt(p.x1, p.y1)} -- ${pt(p.x2, p.y2)};`;
    }
    case 'polyline': {
      const { color } = tikzColor(p.stroke);
      return `\\draw[color=${color},line width=${round(p.w * s)}pt] ${path(p.pts)};`;
    }
    case 'polygon': {
      const f = tikzColor(p.fill);
      const st = tikzColor(p.stroke);
      const drawOpt = p.stroke === 'none' ? 'draw=none' : `draw=${st.color}`;
      const op = f.alpha < 1 ? `,fill opacity=${f.alpha}` : '';
      return `\\filldraw[fill=${f.color},${drawOpt}${op}] ${path(p.pts)} -- cycle;`;
    }
    case 'rect': {
      const f = tikzColor(p.fill);
      const op = f.alpha < 1 ? `[fill opacity=${f.alpha}]` : '';
      return `\\fill${op}[color=${f.color}] ${pt(p.x, p.y)} rectangle ${pt(p.x + p.w, p.y + p.h)};`;
    }
    case 'circle': {
      const f = tikzColor(p.fill);
      const op =
        p.opacity !== undefined && p.opacity < 1 ? `,fill opacity=${round(p.opacity)}` : '';
      return `\\filldraw[fill=${f.color},draw=none${op}] ${pt(p.cx, p.cy)} circle (${round(p.r * s)}pt);`;
    }
    case 'text': {
      const { color } = tikzColor(p.fill);
      const rot = p.rotate !== undefined ? `,rotate=${p.rotate}` : '';
      return `\\node[anchor=${ANCHOR[p.anchor]},text=${color},font=\\fontsize{${round(p.size * s)}}{${round(p.size * s * 1.2)}}\\selectfont${rot}] at ${pt(p.x, p.y)} {${texEsc(p.s)}};`;
    }
  }
}

/** Serialize a Scene to TikZ. Coordinates match the SVG (y-flipped for TikZ's y-up), scaled. */
export function emitTikZ(scene: Scene, opts: PlotOptions = {}): string {
  const s = opts.tikz?.scale ?? 0.75;
  const X = (x: number): number => round(x * s);
  const Y = (y: number): number => round((scene.height - y) * s);
  const bg = tikzColor(scene.bg);
  const body: string[] = [
    `\\fill[color=${bg.color}] (${X(0)},${Y(scene.height)}) rectangle (${X(scene.width)},${Y(0)});`,
    ...scene.prims.map((p) => primTikZ(p, X, Y, s)),
  ];
  const pic = `\\begin{tikzpicture}[x=1pt,y=1pt]\n${body.join('\n')}\n\\end{tikzpicture}`;
  if (opts.tikz?.standalone === false) return pic;
  return `\\documentclass[tikz,border=2pt]{standalone}\n\\begin{document}\n${pic}\n\\end{document}`;
}
```

> This references `opts.tikz` before Task 7 adds it to `PlotOptions`. To keep tsc green now, Task 6 ALSO adds the `tikz?` field to `PlotOptions` (see Task 7's types edit) as part of this task — do the `types.ts` `tikz?` + `format?` additions here so `tikz.ts` type-checks. (The `emit()` dispatch + `toTikZ` still come in Task 7.)

- [ ] **Step 3b: Add to `plot/src/types.ts` `PlotOptions`** (needed for tikz.ts to compile):

```ts
  format?: 'svg' | 'tikz';
  tikz?: { standalone?: boolean; scale?: number };
```

- [ ] **Step 4: Run to verify it passes** — `npx vitest run plot/tests/tikz.test.ts` → PASS (7). Full suite `npx vitest run plot/` → GREEN (SVG untouched). `cd plot && npx tsc --noEmit` → 0. `cd plot && npx eslint src tests` → 0.

- [ ] **Step 5: Commit.**

```bash
git add plot/src/tikz.ts plot/src/types.ts plot/tests/tikz.test.ts docs/Architecture/
git commit -m "feat(plot): TikZ backend (emitTikZ) + format/tikz options on PlotOptions"
```

---

### Task 7: Wire `format` end-to-end + `toTikZ()` + index export

**Files:**

- Modify: `plot/src/emit.ts` (add the tikz branch), `plot/src/plot.ts` (add `toTikZ`), `plot/src/index.ts` (export `toTikZ`; bump VERSION)
- Test: `plot/tests/tikz-marks.test.ts`

**Interfaces:**

- Consumes: `emitSVG` (svg.ts), `emitTikZ` (tikz.ts), `plot` (plot.ts), `PlotOptions.format`.
- Produces:
  - `emit(scene, opts)` dispatches: `opts.format === 'tikz' ? emitTikZ(scene, opts) : emitSVG(scene)`.
  - `toTikZ(a, b?, c?): string` = `plot(a, b, { ...(c ?? {}), format: 'tikz' })` (generic mirror of `plot()`), exported from index.
  - Every mark now honors `format` (via `emit`) — full parity, no per-mark change needed.

- [ ] **Step 1: Write the failing test** — `plot/tests/tikz-marks.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { toTikZ, line, surface, overlay } from '../src/index.js';

describe('TikZ end-to-end (format option + toTikZ)', () => {
  it('line with format:tikz emits a tikzpicture, no <svg>', () => {
    const out = line([0, 1, 2, 3], [0, 1, 4, 9], { format: 'tikz', title: 'sq' });
    expect(out).toContain('\\begin{tikzpicture}');
    expect(out).not.toContain('<svg');
    expect(out).toMatch(/\\draw/);
  });
  it('toTikZ("sin(x)") samples + emits a tikz line', () => {
    const out = toTikZ('sin(x)', { from: 0, to: Math.PI, samples: 30 });
    expect(out).toContain('\\begin{tikzpicture}');
    expect(out).toMatch(/\\draw/);
  });
  it('toTikZ of a 2-var expr as a surface emits filled polygons', () => {
    const out = toTikZ('x^2 + y^2', { from: -2, to: 2, samples: 8, kind: 'surface' });
    expect(out).toContain('\\filldraw');
  });
  it('surface fragment mode has no documentclass', () => {
    const z = [
      [0, 1, 0],
      [1, 2, 1],
      [0, 1, 0],
    ];
    const out = surface(z, { format: 'tikz', tikz: { standalone: false } });
    expect(out).toContain('\\begin{tikzpicture}');
    expect(out).not.toContain('\\documentclass');
  });
  it('overlay tikz preserves both layers (draws + nodes for legend)', () => {
    const out = overlay(
      [
        { type: 'line', x: [0, 1], y: [0, 1], label: 'a' },
        { type: 'scatter', x: [0, 1], y: [1, 0], label: 'b' },
      ],
      { format: 'tikz', legend: true }
    );
    expect(out).toMatch(/\\draw/);
    expect(out).toMatch(/\\filldraw/); // scatter circles
    expect(out).toContain('a'); // legend label a
  });
  it('SVG remains the default (no format)', () => {
    expect(line([0, 1], [0, 1])).toMatch(/^<svg/);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run plot/tests/tikz-marks.test.ts` → FAIL (`toTikZ` not exported; format ignored → still SVG).

- [ ] **Step 3: Replace `plot/src/emit.ts` body** with the dispatch:

```ts
import type { Scene } from './scene.js';
import { emitSVG } from './svg.js';
import { emitTikZ } from './tikz.js';
import type { PlotOptions } from './types.js';

/** Serialize a Scene via the backend chosen by opts.format (default 'svg'). */
export function emit(scene: Scene, opts: PlotOptions = {}): string {
  return opts.format === 'tikz' ? emitTikZ(scene, opts) : emitSVG(scene);
}
```

- [ ] **Step 3b: Add `toTikZ` to `plot/src/plot.ts`** (after the existing `plot` function).

`toTikZ` mirrors `plot()`'s four dispatch shapes (string / layers[] / x+y / single-series) and injects `format:'tikz'` into the correct opts slot for each — so `format` lands in whichever opts object `plot()` actually uses:

```ts
/** Generic TikZ entry — same polymorphism as plot(), forced to the TikZ backend. */
export function toTikZ(a: unknown, b?: unknown, c?: PlotOptions): string {
  if (typeof a === 'string') return plot(a, { ...((b as PlotOptions) ?? {}), format: 'tikz' });
  if (
    Array.isArray(a) &&
    a.length > 0 &&
    typeof a[0] === 'object' &&
    a[0] !== null &&
    'type' in (a[0] as object)
  )
    return plot(a, { ...((b as PlotOptions) ?? {}), format: 'tikz' });
  if (Array.isArray(b) || b instanceof Float64Array)
    return plot(a as never, b as never, { ...(c ?? {}), format: 'tikz' });
  return plot(a as never, { ...((b as PlotOptions) ?? {}), format: 'tikz' });
}
```

This mirrors `plot()`'s own four dispatch shapes (string / layers / x+y / single-series), injecting `format:'tikz'` into the correct opts slot each time. (`plot` and `PlotOptions` are already imported in plot.ts.)

- [ ] **Step 3c: Update `plot/src/index.ts`** — export `toTikZ`, bump VERSION:

```ts
export const VERSION = '0.2.0';
// ...existing exports...
export { plot, toTikZ } from './plot.js';
```

(Change the existing `export { plot } from './plot.js';` line to include `toTikZ`.)

- [ ] **Step 4: Run to verify it passes** — `npx vitest run plot/tests/tikz-marks.test.ts` → PASS (6). Full suite `npx vitest run plot/` → GREEN (golden SVG snapshots STILL unchanged — the default path is unaffected). `cd plot && npx tsc --noEmit` → 0. `cd plot && npx eslint src tests` → 0.

- [ ] **Step 5: Commit.**

```bash
git add plot/src/emit.ts plot/src/plot.ts plot/src/index.ts plot/tests/tikz-marks.test.ts docs/Architecture/
git commit -m "feat(plot): wire format dispatch + toTikZ() generic entry (VERSION 0.2.0)"
```

---

### Task 8: Docs + changeset + DGT gate + release prep

**Files:**

- Modify: `plot/README.md`, `CHANGELOG.md`; create `.changeset/plot-tikz.md`; regen `docs/Architecture/*`.

- [ ] **Step 1: CHANGELOG** — add under `## [Unreleased]` in root `CHANGELOG.md`:

```markdown
### Added — @danielsimonjr/mathts-plot TikZ backend (0.2.0)

`plot` now renders to **TikZ** as well as SVG. Internals refactored to Approach A
(scene + pluggable backend): every mark emits an intermediate scene of drawing
primitives, serialized by `emitSVG` (SVG output byte-identical to 0.1.0, locked by
golden-master snapshots) or the new `emitTikZ`. New public surface: a `format:
'svg' | 'tikz'` option on all functions, a `tikz: { standalone, scale }` option, and a
generic `toTikZ()` entry mirroring `plot()`. Pure TikZ (only `\usepackage{tikz}`);
geometry matches the SVG via a deterministic y-flip. All 15 marks supported.
```

- [ ] **Step 2: README** — append a "TikZ / LaTeX output" section to `plot/README.md` with runnable snippets: `toTikZ('sin(x)', { from: 0, to: Math.PI })`, `line(x, y, { format: 'tikz' })`, `surface(z, { format: 'tikz', tikz: { standalone: false } })`. Note it returns a LaTeX string; `standalone` (default true) is compilable as-is, `standalone: false` is a `tikzpicture` for `\input`; only `\usepackage{tikz}` is required.

- [ ] **Step 3: Changeset** — `.changeset/plot-tikz.md`:

```markdown
---
'@danielsimonjr/mathts-plot': minor
---

Add a TikZ rendering backend: `format: 'tikz'` on all functions, a `tikz` option, and a generic `toTikZ()` entry. Internals refactored to a scene + pluggable backend; SVG output is byte-identical (golden-master locked).
```

- [ ] **Step 4: Full gate + graph regen.**

```bash
npm run build            # all packages incl plot build green
npm run typecheck        # 30/30, 0 errors
cd plot && npx tsc --noEmit && npx eslint src tests && cd ..   # 0, 0
npm run build:wasm && npm run docs:deps    # regen dependency graph
npx vitest run plot/     # full plot suite GREEN (SVG golden snapshots unchanged + all TikZ tests)
```

Assert in the DGT output: **0 circular dependencies**, `plot` reachable, **0 orphaned/dormant** in plot (scene.ts, tikz.ts, emit.ts all reachable — `emit`←marks, `emitTikZ`←emit, `scene`←everything, `toTikZ`←index). If anything shows dormant, wire it or remove it (no dead code). Fix any failure at root before committing (RFL Rule 2).

- [ ] **Step 5: Commit + push (NO publish — npm auth is the maintainer's step).**

```bash
git add CHANGELOG.md plot/README.md .changeset/plot-tikz.md docs/Architecture/ docs/reference/ 2>/dev/null
git commit -m "docs(plot): TikZ backend README + CHANGELOG + changeset + graph regen"
git push origin main
# verify L==R:
git ls-remote origin -h refs/heads/main   # must equal local HEAD
```

Release (after review, maintainer runs npm auth): `npx changeset version` → `npm run build` → `npx changeset publish` → `git push origin main --follow-tags`. Verify live (second method): `npm view @danielsimonjr/mathts-plot dist-tags` → `latest: 0.2.0`, and a fresh-install smoke: `node -e "import('@danielsimonjr/mathts-plot').then(p=>console.log(p.toTikZ('sin(x)').slice(0,20)))"` → starts `\documentclass`.

---

## Self-Review

**1. Spec coverage.** Every spec section maps to a task: scene/backend architecture → Tasks 2–5; `emitSVG` behavior-preserving → Tasks 1 (lock) + 2–5 (refactor, snapshots green); `emitTikZ` (coords/colors/text/anchors/escape/standalone-fragment) → Task 6; `format`/`toTikZ`/`tikz` public API → Tasks 6 (types) + 7 (wire); never-throws → preserved (guards unchanged; emit never throws); testing (scene oracles, emitSVG regression = golden, emitTikZ oracles, parity) → Tasks 1, 6, 7; DGT gate (0 cycles, 0 dormant) → Task 8; release (plot minor 0.2.0) → Task 8. The workbook tex exporter is explicitly out of scope (Plan 2).

**2. Placeholder scan.** No TBD/vague steps — every code step has complete bodies; the two "mechanical conversion" tasks (4 step 3, 5 steps 2–3) give the exact prim mapping for each builder call plus the exact imports to change, against the current files. No "handle edge cases" hand-waves.

**3. Type consistency.** `Prim`/`Scene` (Task 2) are used identically by every mark (Tasks 3–5) and both emitters (Tasks 2, 6). `emit(scene, opts)` signature is stable from Task 2 (svg-only) through Task 7 (dispatch) — marks are written against it once. `Frame` (render-core) unchanged in shape. `PlotOptions.format`/`tikz` defined in Task 6, consumed by `emit`/`emitTikZ`/`toTikZ` (Tasks 6–7). `renderLayer` returns `Prim[]` consistently (Task 3) and is consumed only by draw2D. `toTikZ` signature matches `plot`'s arg shapes.

**Known contingency (flagged, not a gap):** the golden-master snapshots (Task 1) assume `toMatchSnapshot()` writes to `plot/tests/__snapshots__/` on first run and that the file is committed; if the repo's vitest is configured with `--ci` (which makes a missing snapshot FAIL instead of write), generate once with `npx vitest run -u plot/tests/golden-svg.test.ts` (the `-u`/update flag), then commit. Byte-identity is the intent; the true gate is the snapshot + the existing 55 assertions all green.
