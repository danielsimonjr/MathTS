import { coerce1dPositional } from './coerce.js';
import type { Theme } from './svg.js';
import type { Layer2D } from './types.js';
import type { Prim } from './scene.js';

/**
 * Shared rendering context, computed once per `draw2D` call and threaded
 * through every layer's renderer. Lives here (not `frame.ts` or `marks2d.ts`)
 * so both of those modules can depend on it without depending on each other.
 */
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

/**
 * x defaults to 0..n-1 when a layer omits it. x/y are coerced positionally
 * (NaN gaps kept in place, not dropped) so a non-finite entry in one series
 * can't shift the other series' values onto the wrong index — see
 * coerce1dPositional. Pairs are dropped only after zipping, when either side
 * is non-finite.
 */
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

/**
 * yerr aligned to y by original index (positional; not zipped with xy()'s
 * dropped pairs), so a NaN gap in yerr can't shift onto the wrong point.
 * A non-finite yerr entry falls back to 0 rather than dropping the point.
 */
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

/**
 * Positional zip-then-drop across x/y/u/v: a vector is dropped only if ANY
 * of its four components is non-finite, never by shifting the others onto
 * the wrong index (same alignment fix as xy()/renderErrorbar).
 */
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

/** Dispatch a layer to its renderer (extended in later tasks). */
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
