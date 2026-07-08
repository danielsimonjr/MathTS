import { coerce2d } from './coerce.js';
import { linearScale } from './scale.js';
import { viridis } from './palette.js';
import { THEMES } from './svg.js';
import type { PlotOptions } from './types.js';
import type { Prim, Scene } from './scene.js';
import { emit } from './emit.js';

const MARGIN = { top: 34, right: 22, bottom: 30, left: 40 };

/** Contour plot via marching squares over grid z[row][col]. */
export function contour(z: unknown, opts: PlotOptions & { levels?: number } = {}): string {
  const width = opts.width ?? 520;
  const height = opts.height ?? 320;
  const theme = THEMES[opts.theme ?? 'light'];
  const grid = coerce2d(z);
  const rows = grid.length;
  const cols = rows ? grid[0].length : 0;
  if (rows < 2 || cols < 2) {
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
  const nLevels = opts.levels ?? 10;
  const px = linearScale([0, cols - 1], [MARGIN.left, width - MARGIN.right]);
  const py = linearScale([0, rows - 1], [height - MARGIN.bottom, MARGIN.top]);
  const prims: Prim[] = [];
  const span = hi > lo ? hi - lo : 1;
  for (let li = 1; li <= nLevels; li++) {
    const level = lo + (span * li) / (nLevels + 1);
    const color = viridis(li / (nLevels + 1));
    // linear interpolation of the crossing point on a cell edge
    const interp = (va: number, vb: number): number => (level - va) / (vb - va);
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const tl = grid[r][c];
        const tr = grid[r][c + 1];
        const br = grid[r + 1][c + 1];
        const bl = grid[r + 1][c];
        if (![tl, tr, br, bl].every(Number.isFinite)) continue;
        // crossings on the 4 edges (midpoint via interp), collected then paired
        const cross: Array<[number, number]> = [];
        if (tl < level !== tr < level) cross.push([c + interp(tl, tr), r]);
        if (tr < level !== br < level) cross.push([c + 1, r + interp(tr, br)]);
        if (bl < level !== br < level) cross.push([c + interp(bl, br), r + 1]);
        if (tl < level !== bl < level) cross.push([c, r + interp(tl, bl)]);
        for (let k = 0; k + 1 < cross.length; k += 2) {
          const [ax, ay] = cross[k];
          const [bx, by] = cross[k + 1];
          prims.push({
            k: 'line',
            x1: px(ax),
            y1: py(ay),
            x2: px(bx),
            y2: py(by),
            stroke: color,
            w: 1.5,
          });
        }
      }
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
