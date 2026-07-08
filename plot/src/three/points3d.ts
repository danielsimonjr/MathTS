import { coerce1d } from '../coerce.js';
import { project, type Camera } from './project.js';
import { THEMES, circle, polyline, svgDoc, text } from '../svg.js';
import type { PlotOptions } from '../types.js';

const MARGIN = 40;

interface P3Opts extends PlotOptions {
  azim?: number;
  elev?: number;
}

function minOf(a: readonly number[]): number {
  let m = Infinity;
  for (const v of a) if (v < m) m = v;
  return m;
}
function maxOf(a: readonly number[]): number {
  let m = -Infinity;
  for (const v of a) if (v > m) m = v;
  return m;
}

function projectAll(
  x: unknown,
  y: unknown,
  z: unknown,
  cam: Camera
): { screen: Array<[number, number, number]> } {
  const xs = coerce1d(x);
  const ys = coerce1d(y);
  const zs = coerce1d(z);
  const n = Math.min(xs.length, ys.length, zs.length);
  const nx = (a: number[]) => {
    const lo = minOf(a);
    const hi = maxOf(a);
    const s = hi > lo ? hi - lo : 1;
    return (v: number) => ((v - lo) / s) * 2 - 1;
  };
  const fx = nx(xs.slice(0, n));
  const fy = nx(ys.slice(0, n));
  const fz = nx(zs.slice(0, n));
  const screen: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) screen.push(project([fx(xs[i]), fy(ys[i]), fz(zs[i])], cam));
  return { screen };
}

function render(x: unknown, y: unknown, z: unknown, opts: P3Opts, mode: 'points' | 'line'): string {
  const width = opts.width ?? 520;
  const height = opts.height ?? 320;
  const theme = THEMES[opts.theme ?? 'light'];
  const cam: Camera = { azim: opts.azim ?? 45, elev: opts.elev ?? 25 };
  const { screen } = projectAll(x, y, z, cam);
  if (screen.length === 0) {
    return svgDoc(
      width,
      height,
      text(width / 2, height / 2, 'no data', theme.muted, 'middle', 13),
      theme.bg
    );
  }
  let sxlo = Infinity,
    sxhi = -Infinity,
    sylo = Infinity,
    syhi = -Infinity;
  for (const p of screen) {
    if (p[0] < sxlo) sxlo = p[0];
    if (p[0] > sxhi) sxhi = p[0];
    if (p[1] < sylo) sylo = p[1];
    if (p[1] > syhi) syhi = p[1];
  }
  const sxSpan = sxhi > sxlo ? sxhi - sxlo : 1;
  const sySpan = syhi > sylo ? syhi - sylo : 1;
  const toScreen = (p: [number, number, number]): [number, number] => [
    MARGIN + ((p[0] - sxlo) / sxSpan) * (width - 2 * MARGIN),
    height - MARGIN - ((p[1] - sylo) / sySpan) * (height - 2 * MARGIN),
  ];
  const color = theme.series[0];
  let body: string;
  if (mode === 'line') {
    body = polyline(screen.map(toScreen), color, 2);
  } else {
    const depths = screen.map((p) => p[2]);
    const dlo = minOf(depths);
    const dhi = maxOf(depths);
    const dspan = dhi > dlo ? dhi - dlo : 1;
    const sorted = screen.slice().sort((a, b) => b[2] - a[2]); // far (large depth) first — painter's order
    body = sorted
      .map((p) => {
        const [sx, sy] = toScreen(p);
        const near = 1 - (p[2] - dlo) / dspan; // 1 = nearest, 0 = farthest
        const opacity = 0.4 + 0.6 * near; // nearest fully opaque (1.0), farthest 0.4
        return circle(sx, sy, 3, color, opacity);
      })
      .join('');
  }
  const title = opts.title ? text(width / 2, 20, opts.title, theme.fg, 'middle', 14) : '';
  return svgDoc(width, height, body + title, theme.bg);
}

/** 3-D scatter of (x,y,z) point triples, projected to 2-D SVG. */
export function scatter3d(x: unknown, y: unknown, z: unknown, opts: P3Opts = {}): string {
  return render(x, y, z, opts, 'points');
}
/** Parametric 3-D curve through (x,y,z) coordinate arrays. */
export function curve3d(x: unknown, y: unknown, z: unknown, opts: P3Opts = {}): string {
  return render(x, y, z, opts, 'line');
}
