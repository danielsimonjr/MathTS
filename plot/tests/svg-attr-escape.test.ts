import { describe, it, expect } from 'vitest';
import { DOMParser, type Element } from '@xmldom/xmldom';
import { overlay, histogram, line, toTikZ } from '../src/index.js';
import { emitSVG } from '../src/svg.js';
import type { Scene } from '../src/scene.js';

/**
 * Security regression: every attribute value in the SVG output must stay inside its own
 * attribute. Each test feeds a hostile value into one attribute path, PARSES the output
 * with a real XML parser (@xmldom/xmldom, strict: any parse error or warning fails the
 * test), and asserts that the document is well formed, that no foreign element or
 * attribute appeared, and that the hostile value round-trips as the value of its own
 * attribute only.
 */

// A harmless marker that would close the attribute, add an attribute, and open an element
// if it were interpolated without escaping.
const H = `#f00" data-pwn="1"><pwn/><x a='1'`;

const ALLOWED: Record<string, readonly string[]> = {
  svg: ['xmlns', 'viewBox', 'width', 'role'],
  rect: ['x', 'y', 'width', 'height', 'fill'],
  line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width', 'stroke-opacity'],
  circle: ['cx', 'cy', 'r', 'fill', 'fill-opacity'],
  polyline: ['points', 'fill', 'stroke', 'stroke-width'],
  polygon: ['points', 'fill', 'stroke'],
  text: ['x', 'y', 'transform', 'text-anchor', 'font-family', 'font-size', 'fill'],
};

function parseStrict(svg: string): Element {
  const doc = new DOMParser({
    onError: (level: string, msg: string) => {
      throw new Error(`XML ${level}: ${msg}`);
    },
  }).parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root) throw new Error('no document element');
  return root;
}

function allElements(root: Element): Element[] {
  const out: Element[] = [root];
  const walk = (el: Element): void => {
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 1) {
        out.push(n as Element);
        walk(n as Element);
      }
    }
  };
  walk(root);
  return out;
}

/** Well-formed, only known elements, only the allowed attributes on each. */
function assertStructure(svg: string): Element[] {
  const root = parseStrict(svg);
  expect(root.tagName).toBe('svg');
  const els = allElements(root);
  for (const el of els) {
    const allowed = ALLOWED[el.tagName];
    expect(allowed, `unexpected element <${el.tagName}>`).toBeDefined();
    for (let i = 0; i < el.attributes.length; i++) {
      const name = el.attributes[i].name;
      expect(allowed, `unexpected attribute ${name} on <${el.tagName}>`).toContain(name);
    }
  }
  expect(els.filter((e) => e.tagName === 'svg')).toHaveLength(1);
  return els;
}

const byTag = (els: Element[], tag: string): Element[] => els.filter((e) => e.tagName === tag);

describe('SVG attribute escaping: public API paths', () => {
  it('layer color reaches circle fill (scatter)', () => {
    const els = assertStructure(overlay([{ type: 'scatter', x: [0], y: [1], color: H }]));
    const circles = byTag(els, 'circle');
    expect(circles).toHaveLength(1);
    expect(circles[0].getAttribute('fill')).toBe(H);
  });

  it('layer color reaches polyline stroke (line) and polygon fill (area)', () => {
    const els = assertStructure(
      overlay([
        { type: 'step', x: [0, 1], y: [1, 2], color: H },
        { type: 'area', x: [0, 1], y: [1, 2], color: H },
      ])
    );
    const polylines = byTag(els, 'polyline');
    expect(polylines).toHaveLength(2);
    for (const p of polylines) expect(p.getAttribute('stroke')).toBe(H);
    const polygons = byTag(els, 'polygon');
    expect(polygons).toHaveLength(1);
    expect(polygons[0].getAttribute('fill')).toBe(H + '55');
  });

  it('layer color reaches line stroke (errorbar) and legend rect fill', () => {
    const els = assertStructure(
      overlay([{ type: 'errorbar', x: [0], y: [1], yerr: [0.5], color: H, label: 'a' }], {
        legend: true,
      })
    );
    const colored = byTag(els, 'line').filter((l) => l.getAttribute('stroke') === H);
    expect(colored).toHaveLength(3);
    const legend = byTag(els, 'rect').filter((r) => r.getAttribute('fill') === H);
    expect(legend).toHaveLength(1);
  });

  it('histogram palette color reaches bar rect fill', () => {
    const els = assertStructure(histogram([1, 2, 3], { bins: 1, palette: [H] }));
    const bars = byTag(els, 'rect').filter((r) => r.getAttribute('fill') === H);
    expect(bars).toHaveLength(1);
  });

  it('width and height passed as strings reach the svg root and background rect', () => {
    const W = H as unknown as number;
    const els = assertStructure(line([0, 1], [0, 1], { width: W, height: W }));
    const root = byTag(els, 'svg')[0];
    expect(root.getAttribute('viewBox')).toBe(`0 0 ${H} ${H}`);
    const bg = byTag(els, 'rect').filter((r) => r.getAttribute('width') === H);
    expect(bg).toHaveLength(1);
    expect(bg[0].getAttribute('height')).toBe(H);
  });
});

/**
 * The public API fixes background, radius, stroke width, font size, text anchor and the
 * rotate transform to internal values, so a caller cannot reach them today. They are
 * tested at the one serializer every public path ends in (emitSVG), so a future option
 * that exposes them cannot reintroduce the bug.
 */
describe('SVG attribute escaping: serializer paths', () => {
  const S = H as unknown as number;
  const scene = (prims: Scene['prims'], bg = '#fff'): Scene => ({
    width: 100,
    height: 100,
    bg,
    prims,
  });

  it('background', () => {
    const els = assertStructure(emitSVG(scene([], H)));
    const rects = byTag(els, 'rect');
    expect(rects).toHaveLength(1);
    expect(rects[0].getAttribute('fill')).toBe(H);
  });

  it('circle r and opacity given as strings', () => {
    const els = assertStructure(
      emitSVG(
        scene([{ k: 'circle', cx: 1, cy: 1, r: S, fill: '#000', opacity: H as unknown as number }])
      )
    );
    const c = byTag(els, 'circle');
    expect(c).toHaveLength(1);
    expect(c[0].getAttribute('r')).toBe(H);
  });

  it('line and polyline stroke-width given as strings', () => {
    const els = assertStructure(
      emitSVG(
        scene([
          { k: 'line', x1: 0, y1: 0, x2: 1, y2: 1, stroke: H, w: S },
          { k: 'polyline', pts: [[0, 0]], stroke: H, w: S },
          { k: 'polygon', pts: [[0, 0]], fill: H, stroke: H },
          { k: 'rect', x: 0, y: 0, w: S, h: S, fill: H },
        ])
      )
    );
    const l = byTag(els, 'line');
    expect(l).toHaveLength(1);
    expect(l[0].getAttribute('stroke-width')).toBe(H);
    expect(l[0].getAttribute('stroke')).toBe(H);
    const p = byTag(els, 'polyline');
    expect(p).toHaveLength(1);
    expect(p[0].getAttribute('stroke-width')).toBe(H);
    expect(byTag(els, 'polygon')[0].getAttribute('stroke')).toBe(H);
    expect(byTag(els, 'rect')).toHaveLength(2);
  });

  it('text font-size, text-anchor and fill given as strings', () => {
    const els = assertStructure(
      emitSVG(
        scene([
          {
            k: 'text',
            x: 1,
            y: 1,
            s: H,
            fill: H,
            anchor: H as 'start',
            size: S,
          },
        ])
      )
    );
    const t = byTag(els, 'text');
    expect(t).toHaveLength(1);
    expect(t[0].getAttribute('font-size')).toBe(H);
    expect(t[0].getAttribute('text-anchor')).toBe(H);
    expect(t[0].getAttribute('fill')).toBe(H);
    expect(t[0].textContent).toBe(H);
  });

  it('rotated text transform given hostile coordinates', () => {
    const els = assertStructure(
      emitSVG(
        scene([
          {
            k: 'text',
            x: S,
            y: 1,
            s: 'y',
            fill: '#000',
            anchor: 'middle',
            size: 12,
            rotate: -90,
          },
        ])
      )
    );
    const t = byTag(els, 'text');
    expect(t).toHaveLength(1);
    expect(t[0].getAttribute('transform')).toBe(`translate(${H},1) rotate(-90)`);
  });
});

describe('TikZ backend: caller color cannot leave its option value', () => {
  const T = 'red] (0,0) circle (1pt); pwn [x';
  it('a hostile named color is replaced, never emitted', () => {
    const out = toTikZ([{ type: 'scatter', x: [0], y: [1], color: T }]);
    expect(out).not.toContain('pwn');
    const circles = out.split('\n').filter((l) => l.includes(' circle ('));
    expect(circles).toHaveLength(1);
  });
  it('ordinary colors are kept (named, xcolor mix, hex)', () => {
    for (const c of ['red', 'red!50!black', 'blue']) {
      const out = toTikZ([{ type: 'scatter', x: [0], y: [1], color: c }]);
      expect(out).toContain(`fill=${c},`);
    }
    expect(toTikZ([{ type: 'scatter', x: [0], y: [1], color: '#ff0000' }])).toContain(
      'fill={rgb,255:red,255;green,0;blue,0}'
    );
  });
});
