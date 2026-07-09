import type { Scene, Prim } from './scene.js';

export interface Theme {
  fg: string;
  muted: string;
  grid: string;
  axis: string;
  bg: string;
  series: string[];
}

const PALETTE = [
  '#2a4d8f',
  '#c0392b',
  '#27ae60',
  '#8e44ad',
  '#d68910',
  '#16a085',
  '#7f8c8d',
  '#2c3e50',
];

export const THEMES: Record<'light' | 'dark', Theme> = {
  light: {
    fg: '#1a1a2e',
    muted: '#5a5a72',
    grid: '#e6e6ee',
    axis: '#5a5a72',
    bg: '#ffffff',
    series: PALETTE,
  },
  dark: {
    fg: '#e8e8f0',
    muted: '#a0a0b0',
    grid: '#2c2c3a',
    axis: '#a0a0b0',
    bg: '#14141c',
    series: PALETTE,
  },
};

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '';
  const a = Math.abs(n);
  if (a !== 0 && (a < 1e-3 || a >= 1e6)) return n.toExponential(2);
  return String(Math.round(n * 1e6) / 1e6);
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

export function svgDoc(width: number, height: number, body: string, bg: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img">` +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${bg}"/>${body}</svg>`
  );
}

export function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  w = 1,
  opacity?: number
): string {
  const op =
    opacity !== undefined && opacity < 1
      ? ` stroke-opacity="${Math.round(opacity * 1000) / 1000}"`
      : '';
  return `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${stroke}" stroke-width="${w}"${op}/>`;
}
export function circle(cx: number, cy: number, r: number, fill: string, opacity?: number): string {
  const op =
    opacity !== undefined && opacity < 1
      ? ` fill-opacity="${Math.round(opacity * 1000) / 1000}"`
      : '';
  return `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r}" fill="${fill}"${op}/>`;
}
export function rect(x: number, y: number, w: number, h: number, fill: string): string {
  return `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="${fill}"/>`;
}
export function polyline(pts: Array<[number, number]>, stroke: string, w = 2): string {
  const p = pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join(' ');
  return `<polyline points="${p}" fill="none" stroke="${stroke}" stroke-width="${w}"/>`;
}
export function polygon(pts: Array<[number, number]>, fill: string, stroke = 'none'): string {
  const p = pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join(' ');
  return `<polygon points="${p}" fill="${fill}" stroke="${stroke}"/>`;
}
export function text(
  x: number,
  y: number,
  s: string,
  fill: string,
  anchor = 'start',
  size = 12
): string {
  return `<text x="${r2(x)}" y="${r2(y)}" text-anchor="${anchor}" font-family="system-ui,sans-serif" font-size="${size}" fill="${fill}">${esc(s)}</text>`;
}

function primSVG(p: Prim): string {
  switch (p.k) {
    case 'line':
      return line(p.x1, p.y1, p.x2, p.y2, p.stroke, p.w, p.opacity);
    case 'circle':
      return circle(p.cx, p.cy, p.r, p.fill, p.opacity);
    case 'rect':
      return rect(p.x, p.y, p.w, p.h, p.fill);
    case 'polyline':
      return polyline(p.pts, p.stroke, p.w);
    case 'polygon':
      return polygon(p.pts, p.fill, p.stroke);
    case 'text':
      // rotate branch reproduces frame.ts's former hand-written y-label string exactly
      // (no r2 on the translate coords — matches the prior output byte-for-byte).
      return p.rotate !== undefined
        ? `<text transform="translate(${p.x},${p.y}) rotate(${p.rotate})" text-anchor="${p.anchor}" font-family="system-ui,sans-serif" font-size="${p.size}" fill="${p.fill}">${esc(p.s)}</text>`
        : text(p.x, p.y, p.s, p.fill, p.anchor, p.size);
  }
}

/** Serialize a Scene to a self-contained SVG string (reuses the exported builders). */
export function emitSVG(scene: Scene): string {
  return svgDoc(scene.width, scene.height, scene.prims.map(primSVG).join(''), scene.bg);
}
