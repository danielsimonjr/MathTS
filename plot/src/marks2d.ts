import { coerce1d } from './coerce.js';
import { circle, polyline } from './svg.js';
import { draw2D, type Frame } from './frame.js';
import type { Layer2D, PlotOptions } from './types.js';

/** x defaults to 0..n-1 when a layer omits it. */
function xy(layer: Layer2D): Array<[number, number]> {
  const ys = coerce1d(layer.y);
  const xs = layer.x ? coerce1d(layer.x) : ys.map((_, i) => i);
  const n = Math.min(xs.length, ys.length);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) pts.push([xs[i], ys[i]]);
  return pts;
}

function renderLine(layer: Layer2D, f: Frame, i: number): string {
  const color = layer.color ?? f.color(i);
  const pts = xy(layer).map(([x, y]) => [f.px(x), f.py(y)] as [number, number]);
  return polyline(pts, color, 2) + pts.map(([x, y]) => circle(x, y, 2.5, color)).join('');
}

/** Dispatch a layer to its renderer (extended in later tasks). */
export function renderLayer(layer: Layer2D, f: Frame, i: number): string {
  switch (layer.type) {
    case 'line':
      return renderLine(layer, f, i);
    default:
      return renderLine(layer, f, i);
  }
}

/** Public: line chart of one or many series. */
export function line(x: Layer2D['x'], y: Layer2D['y'], opts?: PlotOptions): string {
  return draw2D([{ type: 'line', x, y }], opts);
}
