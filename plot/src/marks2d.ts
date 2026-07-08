import { draw2D } from './frame.js';
import type { Layer2D, PlotOptions } from './types.js';

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
