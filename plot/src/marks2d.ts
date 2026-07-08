import { coerce1dPositional } from './coerce.js';
import { circle, line as svgLine, polygon, polyline, rect } from './svg.js';
import { draw2D, type Frame } from './frame.js';
import type { Layer2D, PlotOptions } from './types.js';

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

function renderLine(layer: Layer2D, f: Frame, i: number): string {
  const color = layer.color ?? f.color(i);
  const pts = xy(layer).map(([x, y]) => [f.px(x), f.py(y)] as [number, number]);
  return polyline(pts, color, 2) + pts.map(([x, y]) => circle(x, y, 2.5, color)).join('');
}

function renderScatter(layer: Layer2D, f: Frame, i: number): string {
  const color = layer.color ?? f.color(i);
  return xy(layer)
    .map(([x, y]) => circle(f.px(x), f.py(y), 3, color))
    .join('');
}

function renderBar(layer: Layer2D, f: Frame, i: number): string {
  const color = layer.color ?? f.color(i);
  const pts = xy(layer);
  const base = f.py(Math.max(0, f.ydom[0]));
  const bw = pts.length > 1 ? Math.abs(f.px(pts[1][0]) - f.px(pts[0][0])) * 0.7 : 20;
  return pts
    .map(([x, y]) => {
      const yp = f.py(y);
      return rect(f.px(x) - bw / 2, Math.min(yp, base), bw, Math.abs(base - yp), color);
    })
    .join('');
}

function renderArea(layer: Layer2D, f: Frame, i: number): string {
  const color = layer.color ?? f.color(i);
  const pts = xy(layer).map(([x, y]) => [f.px(x), f.py(y)] as [number, number]);
  if (pts.length === 0) return '';
  const base = f.py(Math.max(0, f.ydom[0]));
  const poly: Array<[number, number]> = [[pts[0][0], base], ...pts, [pts[pts.length - 1][0], base]];
  return polygon(poly, color + '55', 'none') + polyline(pts, color, 2);
}

function renderStep(layer: Layer2D, f: Frame, i: number): string {
  const color = layer.color ?? f.color(i);
  const pts = xy(layer).map(([x, y]) => [f.px(x), f.py(y)] as [number, number]);
  const stepped: Array<[number, number]> = [];
  for (let k = 0; k < pts.length; k++) {
    stepped.push(pts[k]);
    if (k < pts.length - 1) stepped.push([pts[k + 1][0], pts[k][1]]);
  }
  return polyline(stepped, color, 2);
}

/**
 * yerr aligned to y by original index (positional; not zipped with xy()'s
 * dropped pairs), so a NaN gap in yerr can't shift onto the wrong point.
 * A non-finite yerr entry falls back to 0 rather than dropping the point.
 */
function renderErrorbar(layer: Layer2D, f: Frame, i: number): string {
  const color = layer.color ?? f.color(i);
  const ys = coerce1dPositional(layer.y);
  const xs = layer.x ? coerce1dPositional(layer.x) : ys.map((_, k) => k);
  const errs = coerce1dPositional(layer.yerr ?? []);
  const n = Math.min(xs.length, ys.length);
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    if (!Number.isFinite(xs[k]) || !Number.isFinite(ys[k])) continue;
    const e = Number.isFinite(errs[k]) ? errs[k] : 0;
    const cx = f.px(xs[k]);
    const top = f.py(ys[k] + e);
    const bot = f.py(ys[k] - e);
    out.push(
      svgLine(cx, top, cx, bot, color, 1.5) +
        svgLine(cx - 3, top, cx + 3, top, color, 1.5) +
        svgLine(cx - 3, bot, cx + 3, bot, color, 1.5) +
        circle(cx, f.py(ys[k]), 3, color)
    );
  }
  return out.join('');
}

/**
 * Positional zip-then-drop across x/y/u/v: a vector is dropped only if ANY
 * of its four components is non-finite, never by shifting the others onto
 * the wrong index (same alignment fix as xy()/renderErrorbar).
 */
function renderQuiver(layer: Layer2D, f: Frame, i: number): string {
  const color = layer.color ?? f.color(i);
  const xs = layer.x ? coerce1dPositional(layer.x) : [];
  const ys = coerce1dPositional(layer.y);
  const us = coerce1dPositional(layer.u ?? []);
  const vs = coerce1dPositional(layer.v ?? []);
  const n = Math.min(xs.length, ys.length, us.length, vs.length);
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    if (![xs[k], ys[k], us[k], vs[k]].every(Number.isFinite)) continue;
    const x0 = f.px(xs[k]);
    const y0 = f.py(ys[k]);
    const x1 = f.px(xs[k] + us[k]);
    const y1 = f.py(ys[k] + vs[k]);
    out.push(svgLine(x0, y0, x1, y1, color, 1.5));
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const ah = 5;
    out.push(
      svgLine(x1, y1, x1 - ah * Math.cos(ang - 0.4), y1 - ah * Math.sin(ang - 0.4), color, 1.5)
    );
    out.push(
      svgLine(x1, y1, x1 - ah * Math.cos(ang + 0.4), y1 - ah * Math.sin(ang + 0.4), color, 1.5)
    );
  }
  return out.join('');
}

/** Dispatch a layer to its renderer (extended in later tasks). */
export function renderLayer(layer: Layer2D, f: Frame, i: number): string {
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

/** Public: line chart of one or many series. */
export function line(x: Layer2D['x'], y: Layer2D['y'], opts?: PlotOptions): string {
  return draw2D([{ type: 'line', x, y }], opts);
}

/** Public: scatter plot of one or many series. */
export function scatter(x: Layer2D['x'], y: Layer2D['y'], opts?: PlotOptions): string {
  return draw2D([{ type: 'scatter', x, y }], opts);
}

/** Public: bar chart of one or many series. */
export function bar(x: Layer2D['x'], y: Layer2D['y'], opts?: PlotOptions): string {
  return draw2D([{ type: 'bar', x, y }], opts);
}

/** Public: filled area under one or many series. */
export function area(x: Layer2D['x'], y: Layer2D['y'], opts?: PlotOptions): string {
  return draw2D([{ type: 'area', x, y }], opts);
}

/** Public: step chart (horizontal-then-vertical) of one or many series. */
export function step(x: Layer2D['x'], y: Layer2D['y'], opts?: PlotOptions): string {
  return draw2D([{ type: 'step', x, y }], opts);
}

/** Public: vertical error bars (whisker + point) for one or many series. */
export function errorbar(
  x: Layer2D['x'],
  y: Layer2D['y'],
  yerr: Layer2D['yerr'],
  opts?: PlotOptions
): string {
  return draw2D([{ type: 'errorbar', x, y, yerr }], opts);
}

/** Public: 2-D vector field (arrows) of one or many series. */
export function quiver(
  x: Layer2D['x'],
  y: Layer2D['y'],
  u: Layer2D['u'],
  v: Layer2D['v'],
  opts?: PlotOptions
): string {
  return draw2D([{ type: 'quiver', x, y, u, v }], opts);
}
