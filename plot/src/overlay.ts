import { draw2D } from './frame.js';
import type { Layer2D, PlotOptions } from './types.js';

/** Draw several 2-D layers (of any mix of types) on shared auto-scaled axes. */
export function overlay(layers: Layer2D[], opts?: PlotOptions): string {
  return draw2D(layers, opts);
}
