import { coerce2d } from './coerce.js';
import { viridis } from './palette.js';
import { THEMES, rect, svgDoc, text } from './svg.js';
import type { PlotOptions } from './types.js';

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
    return svgDoc(
      width,
      height,
      text(width / 2, height / 2, 'no data', theme.muted, 'middle', 13),
      theme.bg
    );
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
  const cells: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = grid[r][c];
      const color = Number.isFinite(v) ? viridis((v - lo) / span) : theme.grid;
      cells.push(rect(MARGIN.left + c * cw, MARGIN.top + r * ch, cw + 0.5, ch + 0.5, color));
    }
  }
  const title = opts.title ? text(width / 2, 20, opts.title, theme.fg, 'middle', 14) : '';
  return svgDoc(width, height, cells.join('') + title, theme.bg);
}
