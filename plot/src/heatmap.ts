import { coerce2d } from './coerce.js';
import { viridis } from './palette.js';
import { THEMES, fmt } from './svg.js';
import type { PlotOptions } from './types.js';
import type { Prim, Scene } from './scene.js';
import { emit } from './emit.js';

const MARGIN = { top: 34, right: 84, bottom: 40, left: 48 };

/** Heatmap of a 2-D grid z[row][col], colored by viridis over the data range. */
export function heatmap(z: unknown, opts: PlotOptions = {}): string {
  const width = opts.width ?? 520;
  const height = opts.height ?? 320;
  const theme = THEMES[opts.theme ?? 'light'];
  const grid = coerce2d(z);
  const rows = grid.length;
  const cols = rows ? grid[0].length : 0;
  const colorbar = opts.colorbar !== false;
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
  const innerRight = width - MARGIN.right;
  const cw = (innerRight - MARGIN.left) / cols;
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
  // axes frame
  prims.push({
    k: 'line',
    x1: MARGIN.left,
    y1: MARGIN.top,
    x2: MARGIN.left,
    y2: MARGIN.top + rows * ch,
    stroke: theme.axis,
    w: 1,
  });
  prims.push({
    k: 'line',
    x1: MARGIN.left,
    y1: MARGIN.top + rows * ch,
    x2: MARGIN.left + cols * cw,
    y2: MARGIN.top + rows * ch,
    stroke: theme.axis,
    w: 1,
  });
  const xLabels = opts.xTickLabels ?? Array.from({ length: cols }, (_, c) => String(c + 1));
  const yLabels = opts.yTickLabels ?? Array.from({ length: rows }, (_, r) => String(r + 1));
  for (let c = 0; c < cols; c++) {
    prims.push({
      k: 'text',
      x: MARGIN.left + (c + 0.5) * cw,
      y: MARGIN.top + rows * ch + 16,
      s: xLabels[c] ?? String(c + 1),
      fill: theme.muted,
      anchor: 'middle',
      size: 11,
    });
  }
  for (let r = 0; r < rows; r++) {
    prims.push({
      k: 'text',
      x: MARGIN.left - 8,
      y: MARGIN.top + (r + 0.5) * ch + 4,
      s: yLabels[r] ?? String(r + 1),
      fill: theme.muted,
      anchor: 'end',
      size: 11,
    });
  }
  if (colorbar) {
    const barX = innerRight + 16;
    const barTop = MARGIN.top;
    const barH = height - MARGIN.top - MARGIN.bottom;
    const steps = 32;
    const stripH = barH / steps;
    for (let i = 0; i < steps; i++) {
      const t = 1 - i / (steps - 1);
      prims.push({
        k: 'rect',
        x: barX,
        y: barTop + i * stripH,
        w: 14,
        h: stripH + 0.5,
        fill: viridis(t),
      });
    }
    const tickVals = [hi, lo];
    for (let i = 0; i < tickVals.length; i++) {
      const t = i / (tickVals.length - 1);
      prims.push({
        k: 'text',
        x: barX + 20,
        y: barTop + t * barH + 4,
        s: fmt(tickVals[i]),
        fill: theme.muted,
        anchor: 'start',
        size: 10,
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
