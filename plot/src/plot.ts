import { line } from './marks2d.js';
import { overlay } from './overlay.js';
import type { Layer2D, PlotOptions } from './types.js';

function isLayerArray(v: unknown): v is Layer2D[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    typeof v[0] === 'object' &&
    v[0] !== null &&
    'type' in (v[0] as object)
  );
}

/**
 * Generic entry point. Data forms:
 *   plot(y, opts?)            → line, x = 0..n-1
 *   plot(x, y, opts?)         → line
 *   plot(layers[], opts?)     → overlay
 * (Expression-string form added in a later step.)
 */
export function plot(a: unknown, b?: unknown, c?: PlotOptions): string {
  if (isLayerArray(a)) return overlay(a, (b as PlotOptions) ?? {});
  if (Array.isArray(b) || b instanceof Float64Array) return line(a, b as Layer2D['y'], c);
  // single series → indices for x
  return line(undefined, a as Layer2D['y'], (b as PlotOptions) ?? {});
}
