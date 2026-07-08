import { coerce2d } from './coerce.js';
import { viridis } from './palette.js';
import { THEMES } from './svg.js';
import type { PlotOptions } from './types.js';
import type { Prim, Scene } from './scene.js';
import { emit } from './emit.js';

const MARGIN = { top: 34, right: 22, bottom: 30, left: 40 };

/** Heatmap of a 2-D grid z[row][col], colored by viridis over the data range. */
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
