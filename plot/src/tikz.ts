import type { Scene, Prim } from './scene.js';
import type { PlotOptions } from './types.js';

/** Escape the LaTeX specials that break a plain \node/text body. */
export function texEsc(s: string): string {
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

/** A hex color (#rrggbb / #rrggbbaa) or a passthrough tikz color name, with alpha. */
function tikzColor(c: string): { color: string; alpha: number } {
  if (c === 'none') return { color: 'none', alpha: 1 };
  if (c.startsWith('#')) {
    const h = c.slice(1);
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const alpha = h.length >= 8 ? Math.round((parseInt(h.slice(6, 8), 16) / 255) * 100) / 100 : 1;
    return { color: `{rgb,255:red,${r};green,${g};blue,${b}}`, alpha };
  }
  return { color: c, alpha: 1 };
}

const round = (n: number): number => Math.round(n * 100) / 100;
const ANCHOR: Record<'start' | 'middle' | 'end', string> = {
  start: 'base west',
  middle: 'base',
  end: 'base east',
};

function primTikZ(p: Prim, X: (x: number) => number, Y: (y: number) => number, s: number): string {
  const pt = (x: number, y: number): string => `(${X(x)},${Y(y)})`;
  const path = (pts: Array<[number, number]>): string => pts.map(([x, y]) => pt(x, y)).join(' -- ');
  switch (p.k) {
    case 'line': {
      const { color } = tikzColor(p.stroke);
      return `\\draw[color=${color},line width=${round(p.w * s)}pt] ${pt(p.x1, p.y1)} -- ${pt(p.x2, p.y2)};`;
    }
    case 'polyline': {
      const { color } = tikzColor(p.stroke);
      return `\\draw[color=${color},line width=${round(p.w * s)}pt] ${path(p.pts)};`;
    }
    case 'polygon': {
      const f = tikzColor(p.fill);
      const st = tikzColor(p.stroke);
      const drawOpt = p.stroke === 'none' ? 'draw=none' : `draw=${st.color}`;
      const op = f.alpha < 1 ? `,fill opacity=${f.alpha}` : '';
      return `\\filldraw[fill=${f.color},${drawOpt}${op}] ${path(p.pts)} -- cycle;`;
    }
    case 'rect': {
      const f = tikzColor(p.fill);
      const op = f.alpha < 1 ? `[fill opacity=${f.alpha}]` : '';
      return `\\fill${op}[color=${f.color}] ${pt(p.x, p.y)} rectangle ${pt(p.x + p.w, p.y + p.h)};`;
    }
    case 'circle': {
      const f = tikzColor(p.fill);
      const op =
        p.opacity !== undefined && p.opacity < 1 ? `,fill opacity=${round(p.opacity)}` : '';
      return `\\filldraw[fill=${f.color},draw=none${op}] ${pt(p.cx, p.cy)} circle (${round(p.r * s)}pt);`;
    }
    case 'text': {
      const { color } = tikzColor(p.fill);
      const rot = p.rotate !== undefined ? `,rotate=${p.rotate}` : '';
      return `\\node[anchor=${ANCHOR[p.anchor]},text=${color},font=\\fontsize{${round(p.size * s)}}{${round(p.size * s * 1.2)}}\\selectfont${rot}] at ${pt(p.x, p.y)} {${texEsc(p.s)}};`;
    }
  }
}

/** Serialize a Scene to TikZ. Coordinates match the SVG (y-flipped for TikZ's y-up), scaled. */
export function emitTikZ(scene: Scene, opts: PlotOptions = {}): string {
  const s = opts.tikz?.scale ?? 0.75;
  const X = (x: number): number => round(x * s);
  const Y = (y: number): number => round((scene.height - y) * s);
  const bg = tikzColor(scene.bg);
  const body: string[] = [
    `\\fill[color=${bg.color}] (${X(0)},${Y(scene.height)}) rectangle (${X(scene.width)},${Y(0)});`,
    ...scene.prims.map((p) => primTikZ(p, X, Y, s)),
  ];
  const pic = `\\begin{tikzpicture}[x=1pt,y=1pt]\n${body.join('\n')}\n\\end{tikzpicture}`;
  if (opts.tikz?.standalone === false) return pic;
  return `\\documentclass[tikz,border=2pt]{standalone}\n\\begin{document}\n${pic}\n\\end{document}`;
}
