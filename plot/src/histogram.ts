import { histogram as histBins } from '@danielsimonjr/mathts-functions';
import { coerce1d } from './coerce.js';
import { draw2D } from './frame.js';
import type { PlotOptions } from './types.js';

/** Histogram: bins via functions.histogram, then renders bar heights at bin centers. */
export function histogram(data: unknown, opts: PlotOptions & { bins?: number } = {}): string {
  const nums = coerce1d(data);
  if (nums.length === 0) return draw2D([], opts);
  const { counts, edges } = histBins(nums, opts.bins ?? 10) as {
    counts: number[];
    edges: number[];
  };
  const centers = counts.map((_, i) => (edges[i] + edges[i + 1]) / 2);
  return draw2D([{ type: 'bar', x: centers, y: counts, color: opts.palette?.[0] }], {
    yLabel: 'count',
    ...opts,
  });
}
