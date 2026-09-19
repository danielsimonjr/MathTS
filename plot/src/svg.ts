import type { Scene, Prim } from './scene.js';

/** Color scheme for SVG chart output: foreground, muted, grid, axis and background colors, and an ordered list of data-series colors. */
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

/** Replace `&`, `<` and `>` in a string with their XML entities. Quote characters stay unchanged, so use the result as element text only. Attribute values go through `escAttr`. */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Format a number as a tick label. A non-finite value gives an empty string. A non-zero value with magnitude below 1e-3 or at or above 1e6 uses exponential notation with two decimals. Other values are rounded to six decimal places. */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '';
  const a = Math.abs(n);
  if (a !== 0 && (a < 1e-3 || a >= 1e6)) return n.toExponential(2);
  return String(Math.round(n * 1e6) / 1e6);
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

const ATTR_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape a value for use inside a quoted XML attribute. Replaces `&`, `<`, `>`, `"` and `'` with entities. A number is converted with `String` first, so a value typed `number` but passed as a string at run time cannot end the attribute. */
export function escAttr(v: string | number): string {
  return String(v).replace(/[&<>"']/g, (c) => ATTR_ENTITIES[c]);
}

/** Attribute list for `el`, in output order. An entry whose value is `undefined` is left out. */
type Attrs = ReadonlyArray<readonly [name: string, value: string | number | undefined]>;

/**
 * Build one SVG element. This is the only place that writes an attribute, and it passes
 * every value through `escAttr`, so no builder can interpolate a raw value. Attribute names
 * are compile-time constants. `body` is markup that the caller already escaped; when it is
 * `undefined` the element is self-closing.
 */
function el(tag: string, attrs: Attrs, body?: string): string {
  let s = `<${tag}`;
  for (const [name, value] of attrs) if (value !== undefined) s += ` ${name}="${escAttr(value)}"`;
  return body === undefined ? `${s}/>` : `${s}>${body}</${tag}>`;
}

/** An opacity attribute value, or `undefined` (attribute left out) when the opacity is absent or at least 1. */
const opacityAttr = (opacity?: number): number | undefined =>
  opacity !== undefined && opacity < 1 ? Math.round(opacity * 1000) / 1000 : undefined;

const points = (pts: Array<[number, number]>): string =>
  pts.map(([x, y]) => `${r2(x)},${r2(y)}`).join(' ');

/** Wrap SVG body markup in a complete `<svg>` document of the given size, with a full-size background rectangle and the `img` ARIA role. Every attribute value is escaped with `escAttr`. */
export function svgDoc(width: number, height: number, body: string, bg: string): string {
  return el(
    'svg',
    [
      ['xmlns', 'http://www.w3.org/2000/svg'],
      ['viewBox', `0 0 ${width} ${height}`],
      ['width', '100%'],
      ['role', 'img'],
    ],
    el('rect', [
      ['x', 0],
      ['y', 0],
      ['width', width],
      ['height', height],
      ['fill', bg],
    ]) + body
  );
}

/** Make an SVG `<line>` element between two points. Coordinates are rounded to two decimals. The `stroke-opacity` attribute is added only when the opacity is below 1. Every attribute value is escaped with `escAttr`. */
export function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  w = 1,
  opacity?: number
): string {
  return el('line', [
    ['x1', r2(x1)],
    ['y1', r2(y1)],
    ['x2', r2(x2)],
    ['y2', r2(y2)],
    ['stroke', stroke],
    ['stroke-width', w],
    ['stroke-opacity', opacityAttr(opacity)],
  ]);
}
/** Make an SVG `<circle>` element. The `fill-opacity` attribute is added only when the opacity is below 1. Every attribute value is escaped with `escAttr`. */
export function circle(cx: number, cy: number, r: number, fill: string, opacity?: number): string {
  return el('circle', [
    ['cx', r2(cx)],
    ['cy', r2(cy)],
    ['r', r],
    ['fill', fill],
    ['fill-opacity', opacityAttr(opacity)],
  ]);
}
/** Make a filled SVG `<rect>` element. Position and size are rounded to two decimals. Every attribute value is escaped with `escAttr`. */
export function rect(x: number, y: number, w: number, h: number, fill: string): string {
  return el('rect', [
    ['x', r2(x)],
    ['y', r2(y)],
    ['width', r2(w)],
    ['height', r2(h)],
    ['fill', fill],
  ]);
}
/** Make an SVG `<polyline>` element with no fill from a list of [x, y] points. Every attribute value is escaped with `escAttr`. */
export function polyline(pts: Array<[number, number]>, stroke: string, w = 2): string {
  return el('polyline', [
    ['points', points(pts)],
    ['fill', 'none'],
    ['stroke', stroke],
    ['stroke-width', w],
  ]);
}
/** Make an SVG `<polygon>` element from a list of [x, y] vertices. The stroke is `none` by default. Every attribute value is escaped with `escAttr`. */
export function polygon(pts: Array<[number, number]>, fill: string, stroke = 'none'): string {
  return el('polygon', [
    ['points', points(pts)],
    ['fill', fill],
    ['stroke', stroke],
  ]);
}
/** Make an SVG `<text>` element. The text content is escaped with `esc`, and every attribute value with `escAttr`. When `transform` is given it replaces the `x`/`y` attributes. */
export function text(
  x: number,
  y: number,
  s: string,
  fill: string,
  anchor = 'start',
  size = 12,
  transform?: string
): string {
  const pos: Attrs =
    transform === undefined
      ? [
          ['x', r2(x)],
          ['y', r2(y)],
        ]
      : [['transform', transform]];
  return el(
    'text',
    [
      ...pos,
      ['text-anchor', anchor],
      ['font-family', 'system-ui,sans-serif'],
      ['font-size', size],
      ['fill', fill],
    ],
    esc(s)
  );
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
        ? text(
            p.x,
            p.y,
            p.s,
            p.fill,
            p.anchor,
            p.size,
            `translate(${p.x},${p.y}) rotate(${p.rotate})`
          )
        : text(p.x, p.y, p.s, p.fill, p.anchor, p.size);
  }
}

/** Serialize a Scene to a self-contained SVG string (reuses the exported builders). */
export function emitSVG(scene: Scene): string {
  return svgDoc(scene.width, scene.height, scene.prims.map(primSVG).join(''), scene.bg);
}
