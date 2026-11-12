import { build2DScene } from './frame.js';
import { emitSVG } from './svg.js';
import type { Prim } from './scene.js';
import type { Layer2D, PlotOptions } from './types.js';

const PLOT_ROOT = 'data-mathts-plot';
const LIVE = 'data-mathts-live';

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

function forEachElement(el: Element, visit: (e: Element) => void): void {
  visit(el);
  for (let i = 0; i < el.childNodes.length; i++) {
    const c = el.childNodes[i];
    if (c.nodeType === 1) forEachElement(c as Element, visit);
  }
}

function findDescendant(el: Element, pred: (e: Element) => boolean): Element | null {
  let found: Element | null = null;
  forEachElement(el, (e) => {
    if (!found && pred(e)) found = e;
  });
  return found;
}

function findPlotSvg(el: Element): Element | null {
  return findDescendant(el, (e) => e.localName === 'svg' && e.getAttribute(PLOT_ROOT) === '1');
}

function parseSvgRoot(markup: string): Element {
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

function mountSvg(el: Element, svgMarkup: string): Element {
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

function canPatchLive(layers: Layer2D[], svg: Element): boolean {
  if (layers.length !== 1 || layers[0]?.type !== 'line') return false;
  return findDescendant(svg, (e) => e.getAttribute(LIVE) === 'line-0-path') !== null;
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function patchLivePrimitives(svg: Element, prims: Prim[]): void {
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
 * On first call, mounts a plot SVG under `el`. Later single-layer `line` calls patch polylines/points
 * without replacing the SVG root; other cases remount the plot SVG in the container.
 */
export function update(el: Element, y: Layer2D['y'], opts?: PlotOptions): void;
export function update(el: Element, x: Layer2D['x'], y: Layer2D['y'], opts?: PlotOptions): void;
export function update(el: Element, layers: Layer2D[], opts?: PlotOptions): void;
export function update(el: Element, a: unknown, b?: unknown, c?: PlotOptions): void {
  const { layers, opts } = resolveLiveLayers(a, b, c);
  const scene = build2DScene(layers, opts);
  const markup = emitSVG(scene);
  const svg = findPlotSvg(el);
  if (!svg) {
    mountSvg(el, markup);
    return;
  }
  if (canPatchLive(layers, svg)) {
    patchLivePrimitives(svg, scene.prims);
    return;
  }
  mountSvg(el, markup);
}
