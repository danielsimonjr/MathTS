import { coerce2d } from '../coerce.js';
import { project, type Camera } from './project.js';
import { viridis } from '../palette.js';
import { THEMES } from '../svg.js';
import type { Prim, Scene } from '../scene.js';
import { emit } from '../emit.js';
import type { PlotOptions } from '../types.js';

const MARGIN = 40;

/** 3-D surface z[row][col], projected to 2-D SVG. Painter's algorithm for `filled`. */
export function surface(
  z: unknown,
  opts: Omit<PlotOptions, 'kind'> & {
    azim?: number;
    elev?: number;
    kind?: 'wireframe' | 'filled';
  } = {}
): string {
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
  const cam: Camera = { azim: opts.azim ?? 45, elev: opts.elev ?? 25 };
  let zlo = Infinity;
  let zhi = -Infinity;
  for (const row of grid)
    for (const v of row)
      if (Number.isFinite(v)) {
        if (v < zlo) zlo = v;
        if (v > zhi) zhi = v;
      }
  const zspan = zhi > zlo ? zhi - zlo : 1;

  // project every grid vertex into screen space; collect for bounds
  const proj: Array<Array<[number, number, number]>> = [];
  let sxlo = Infinity,
    sxhi = -Infinity,
    sylo = Infinity,
    syhi = -Infinity;
  for (let r = 0; r < rows; r++) {
    const prow: Array<[number, number, number]> = [];
    for (let c = 0; c < cols; c++) {
      const wx = (c / (cols - 1)) * 2 - 1;
      const wy = (r / (rows - 1)) * 2 - 1;
      const wz = ((grid[r][c] - zlo) / zspan) * 2 - 1;
      const p = project([wx, wy, wz], cam);
      prow.push(p);
      if (p[0] < sxlo) sxlo = p[0];
      if (p[0] > sxhi) sxhi = p[0];
      if (p[1] < sylo) sylo = p[1];
      if (p[1] > syhi) syhi = p[1];
    }
    proj.push(prow);
  }
  const sxSpan = sxhi > sxlo ? sxhi - sxlo : 1;
  const sySpan = syhi > sylo ? syhi - sylo : 1;
  const toScreen = (p: [number, number, number]): [number, number] => [
    MARGIN + ((p[0] - sxlo) / sxSpan) * (width - 2 * MARGIN),
    height - MARGIN - ((p[1] - sylo) / sySpan) * (height - 2 * MARGIN),
  ];

  const kind = opts.kind ?? 'filled';
  const prims: Prim[] = [];
  if (kind === 'wireframe') {
    for (let r = 0; r < rows; r++)
      prims.push({ k: 'polyline', pts: proj[r].map(toScreen), stroke: theme.series[0], w: 1 });
    for (let c = 0; c < cols; c++)
      prims.push({
        k: 'polyline',
        pts: proj.map((row) => toScreen(row[c])),
        stroke: theme.series[0],
        w: 1,
      });
  } else {
    // build quads, sort back-to-front by mean depth (painter's algorithm)
    const quads: Array<{ depth: number; pts: Array<[number, number]>; shade: number }> = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const corners = [proj[r][c], proj[r][c + 1], proj[r + 1][c + 1], proj[r + 1][c]];
        const depth = (corners[0][2] + corners[1][2] + corners[2][2] + corners[3][2]) / 4;
        const meanZ = (grid[r][c] + grid[r][c + 1] + grid[r + 1][c + 1] + grid[r + 1][c]) / 4;
        quads.push({ depth, pts: corners.map(toScreen), shade: (meanZ - zlo) / zspan });
      }
    }
    quads.sort((a, b) => b.depth - a.depth); // far (large depth) first — painter's: draw far first, near last
    for (const q of quads)
      prims.push({ k: 'polygon', pts: q.pts, fill: viridis(q.shade), stroke: theme.grid });
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
