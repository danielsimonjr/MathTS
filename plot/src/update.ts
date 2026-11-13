import { build2DScene } from './frame.js';
import { emitSVG } from './svg.js';
import type { Prim, Scene } from './scene.js';
import type { Layer2D, PlotOptions } from './types.js';

const PLOT_ROOT = 'data-mathts-plot';
const LIVE = 'data-mathts-live';

/**
 * The DOM `Element` when the compiling project has the DOM lib, and a minimal handle when it
 * has not. The published declarations must load in a project with neither the DOM lib nor
 * `@types/node` (`skipLibCheck: false`).
 */
export type PlotHostElement = typeof globalThis extends { Element: { prototype: infer E } }
  ? E
  : { readonly nodeType: number };

/** Axes and live-node identity for the SVG we last mounted or patched. Not retained after the node is discarded. */
const frameOf = new WeakMap<PlotHostElement, string>();

function isLayerArray(v: unknown): v is Layer2D[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    typeof v[0] === 'object' &&
    v[0] !== null &&
    'type' in (v[0] as object)
  );
}

function resolveLiveLayers(
  a: unknown,
  b?: unknown,
  c?: PlotOptions
): { layers: Layer2D[]; opts: PlotOptions } {
  if (isLayerArray(a)) return { layers: a, opts: (b as PlotOptions) ?? {} };
  if (Array.isArray(b) || b instanceof Float64Array) {
    return {
      layers: [{ type: 'line', x: a as Layer2D['x'], y: b as Layer2D['y'] }],
      opts: c ?? {},
    };
  }
  return { layers: [{ type: 'line', y: a as Layer2D['y'] }], opts: (b as PlotOptions) ?? {} };
}

function forEachElement(el: PlotHostElement, visit: (e: PlotHostElement) => void): void {
  visit(el);
  for (let i = 0; i < el.childNodes.length; i++) {
    const c = el.childNodes[i];
    if (c.nodeType === 1) forEachElement(c as PlotHostElement, visit);
  }
}

function findDescendant(
  el: PlotHostElement,
  pred: (e: PlotHostElement) => boolean
): PlotHostElement | null {
  let found: PlotHostElement | null = null;
  forEachElement(el, (e) => {
    if (!found && pred(e)) found = e;
  });
  return found;
}

function findPlotSvg(el: PlotHostElement): PlotHostElement | null {
  return findDescendant(el, (e) => e.localName === 'svg' && e.getAttribute(PLOT_ROOT) === '1');
}

function parseSvgRoot(markup: string): PlotHostElement {
  const DOMParserCtor = (
    globalThis as {
      DOMParser?: { new (): { parseFromString: (s: string, t: string) => Document } };
    }
  ).DOMParser;
  if (!DOMParserCtor) {
    throw new TypeError('update: DOMParser is required to mount plot SVG');
  }
  const doc = new DOMParserCtor().parseFromString(markup, 'image/svg+xml');
  return doc.documentElement;
}

function mountSvg(el: PlotHostElement, svgMarkup: string): PlotHostElement {
  if ('innerHTML' in el && typeof (el as HTMLElement).innerHTML === 'string') {
    (el as HTMLElement).innerHTML = svgMarkup;
  } else {
    while (el.firstChild) el.removeChild(el.firstChild);
    const root = parseSvgRoot(svgMarkup);
    const node = el.ownerDocument?.importNode ? el.ownerDocument.importNode(root, true) : root;
    el.appendChild(node);
  }
  const svg = findPlotSvg(el);
  if (!svg) throw new TypeError('update: plot SVG failed to mount');
  return svg;
}

function canPatchLive(layers: Layer2D[], svg: PlotHostElement): boolean {
  if (layers.length !== 1 || layers[0]?.type !== 'line') return false;
  return findDescendant(svg, (e) => e.getAttribute(LIVE) === 'line-0-path') !== null;
}

/**
 * Identity of everything except series coordinates. Equal keys mean the existing
 * SVG's axes, title, colors, and point nodes are still the right chart.
 */
function frameKey(scene: Scene): string {
  const parts: string[] = [`${scene.width}x${scene.height}:${scene.bg}`];
  for (const p of scene.prims) {
    if (p.k === 'polyline' && p.live) {
      parts.push(`live:${p.live}:${p.stroke}:${p.w}`);
    } else if (p.k === 'circle' && p.live) {
      parts.push(`live:${p.live}:${p.fill}:${p.r ?? ''}`);
    } else if (!('live' in p) || !p.live) {
      parts.push(JSON.stringify(p));
    }
  }
  return parts.join('\n');
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function patchLivePrimitives(svg: PlotHostElement, prims: Prim[]): void {
  for (const p of prims) {
    if (!('live' in p) || !p.live) continue;
    const live = p.live;
    const node = findDescendant(svg, (e) => e.getAttribute(LIVE) === live);
    if (!node) continue;
    if (p.k === 'polyline') {
      const pts = p.pts.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ');
      node.setAttribute('points', pts);
    } else if (p.k === 'circle') {
      node.setAttribute('cx', fmt(p.cx));
      node.setAttribute('cy', fmt(p.cy));
    }
  }
}

/**
 * Update an existing plot DOM subtree in place for live dashboards (same container between frames).
 * On first call, mounts a plot SVG under `el`. A later single-layer line call patches
 * polyline and point nodes when the axes, size, title, and point count are unchanged.
 * A different layer type, a shorter or longer series, or a new data range replaces the
 * plot SVG in the container so stale nodes are not left behind and points stay on the axes.
 */
export function update(el: PlotHostElement, y: Layer2D['y'], opts?: PlotOptions): void;
export function update(
  el: PlotHostElement,
  x: Layer2D['x'],
  y: Layer2D['y'],
  opts?: PlotOptions
): void;
export function update(el: PlotHostElement, layers: Layer2D[], opts?: PlotOptions): void;
export function update(el: PlotHostElement, a: unknown, b?: unknown, c?: PlotOptions): void {
  const { layers, opts } = resolveLiveLayers(a, b, c);
  const scene = build2DScene(layers, opts);
  const markup = emitSVG(scene);
  const key = frameKey(scene);
  const svg = findPlotSvg(el);
  if (svg && canPatchLive(layers, svg) && frameOf.get(svg) === key) {
    patchLivePrimitives(svg, scene.prims);
    return;
  }
  const mounted = mountSvg(el, markup);
  frameOf.set(mounted, key);
}
