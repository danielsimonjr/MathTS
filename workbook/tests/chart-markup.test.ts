import { describe, it, expect } from 'vitest';
import { DOMParser, type Element } from '@xmldom/xmldom';
import { toHTML } from '../src/html.js';
import { toTeX } from '../src/tex.js';
import { toIpynb } from '../src/ipynb.js';
import type { RenderCell, RenderDoc } from '../src/html.js';

/**
 * Security regression: a chart cell must not carry caller markup into an export.
 * Chart markup is generated inside the exporter from the chart spec and data, so
 * markup supplied on the cell is never written to the output.
 */
const HOSTILE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" onload="pwn()"><script>pwn()</script>' +
  '<foreignObject><div/></foreignObject><a href="javascript:pwn()"><text>x</text></a></svg>';
const HOSTILE_TIKZ = '\\immediate\\write18{pwn}\\input{/etc/passwd}\\catcode`\\@=11';
const H = `x" onload="pwn()"><script>pwn()</script><x a='1'`;

// A cell as a caller or a loaded file could shape it, including the retired markup fields.
const hostileCell = {
  type: 'chart',
  content: '',
  chartSvg: HOSTILE_SVG,
  chartTikz: HOSTILE_TIKZ,
} as unknown as RenderCell;

const doc = (cells: RenderCell[]): RenderDoc => ({ cells });

function chartFigure(html: string): Element {
  const m = /<figure class="cell cell-chart">[\s\S]*?<\/figure>/.exec(html);
  expect(m).not.toBeNull();
  const parsed = new DOMParser({
    onError: (level: string, msg: string) => {
      throw new Error(`XML ${level}: ${msg}`);
    },
  }).parseFromString(m![0], 'text/xml');
  return parsed.documentElement as Element;
}

function all(root: Element): Element[] {
  const out: Element[] = [root];
  const walk = (el: Element): void => {
    for (let n = el.firstChild; n; n = n.nextSibling)
      if (n.nodeType === 1) {
        out.push(n as Element);
        walk(n as Element);
      }
  };
  walk(root);
  return out;
}

function assertNoActiveContent(root: Element): void {
  for (const el of all(root)) {
    const name = el.localName.toLowerCase();
    expect(name).not.toBe('script');
    expect(name).not.toBe('foreignobject');
    expect(name).not.toBe('pwn');
    for (let i = 0; i < el.attributes.length; i++) {
      const a = el.attributes.item(i)!;
      expect(a.name.toLowerCase().startsWith('on')).toBe(false);
      if (/href$/i.test(a.name)) expect(a.value.startsWith('#')).toBe(true);
    }
  }
}

describe('toHTML chart cell', () => {
  it('does not write markup supplied on the cell', () => {
    const html = toHTML(doc([hostileCell]));
    assertNoActiveContent(chartFigure(html));
    expect(html).not.toContain('pwn()');
  });

  it('renders the chart from the spec, and hostile title and labels stay text', () => {
    const cell: RenderCell = {
      type: 'chart',
      content: '',
      chart: { spec: { type: 'line', title: H, xLabel: H, yLabel: H }, x: [0, 1], y: [1, 2] },
    };
    const root = chartFigure(toHTML(doc([cell])));
    const svg = all(root).find((e) => e.localName === 'svg');
    expect(svg).toBeDefined();
    assertNoActiveContent(root);
  });
});

describe('toTeX chart cell', () => {
  it('does not write TikZ supplied on the cell', () => {
    const tex = toTeX(doc([hostileCell]), { fragment: true });
    expect(tex).not.toContain('\\write18');
    expect(tex).not.toContain('\\input');
    expect(tex).not.toContain('\\catcode');
    expect(tex).not.toContain('pwn');
  });

  it('renders TikZ from the spec', () => {
    const cell: RenderCell = {
      type: 'chart',
      content: '',
      chart: { spec: { type: 'bar', title: 'T' }, x: [1, 2], y: [3, 4] },
    };
    const tex = toTeX(doc([cell]), { fragment: true });
    expect(tex).toContain('\\begin{tikzpicture}');
    expect(tex).not.toContain('\\write18');
  });
});

describe('toIpynb chart cell', () => {
  it('does not write markup supplied on the cell', () => {
    const nb = toIpynb(doc([hostileCell]));
    expect(nb).not.toContain('pwn');
  });
});
