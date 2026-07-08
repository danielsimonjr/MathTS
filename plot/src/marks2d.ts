import { coerce1dPositional } from './coerce.js';
import { circle, polygon, polyline, rect } from './svg.js';
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
