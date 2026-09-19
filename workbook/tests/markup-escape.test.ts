import { describe, it, expect } from 'vitest';
import { DOMParser, type Element } from '@xmldom/xmldom';
import { renderChart } from '../src/svg.js';
import { toTeX } from '../src/tex.js';
import { markdownToTex } from '../src/markdown.js';

/**
 * Security regression for the markup the workbook builds from notebook content.
 * The chart path is parsed with a strict XML parser; the TeX path is checked for
 * verbatim/listings terminators that notebook text could otherwise close early.
 */
const H = `x" data-pwn="1"><pwn/><x a='1'`;

function parseStrict(svg: string): Element {
  const doc = new DOMParser({
    onError: (level: string, msg: string) => {
      throw new Error(`XML ${level}: ${msg}`);
    },
  }).parseFromString(svg, 'image/svg+xml');
  return doc.documentElement as Element;
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

describe('chart SVG from a notebook spec', () => {
  for (const type of ['line', 'scatter', 'bar'] as const) {
    it(`${type}: hostile title and labels stay text`, () => {
      const svg = renderChart({ type, title: H, xLabel: H, yLabel: H }, [0, 1], [1, 2]);
      const els = all(parseStrict(svg));
      expect(els.some((e) => e.tagName === 'pwn' || e.tagName === 'x')).toBe(false);
      for (const e of els)
        for (let i = 0; i < e.attributes.length; i++)
          expect(e.attributes[i].name).not.toBe('data-pwn');
      const texts = els.filter((e) => e.tagName === 'text' && e.textContent === H);
      expect(texts).toHaveLength(3);
    });
  }
  it('string data values are coerced to numbers, never emitted', () => {
    const svg = renderChart({ type: 'scatter' }, [H, 1], [H, 2]);
    expect(svg).not.toContain('pwn');
    parseStrict(svg);
  });
});

describe('TeX verbatim and listings bodies cannot be closed by notebook text', () => {
  const count = (s: string, needle: string): number => s.split(needle).length - 1;

  it('code cell source and output', () => {
    const tex = toTeX(
      {
        cells: [
          { type: 'code', content: 'a \\end{lstlisting} b', output: 'c \\end{verbatim} d' },
          { type: 'data', content: '', output: 'e \\end{verbatim} f' },
          { type: 'other', content: 'g \\end{verbatim} h' },
        ],
      },
      { fragment: true }
    );
    expect(count(tex, '\\begin{lstlisting}')).toBe(1);
    expect(count(tex, '\\end{lstlisting}')).toBe(1);
    expect(count(tex, '\\begin{verbatim}')).toBe(3);
    expect(count(tex, '\\end{verbatim}')).toBe(3);
  });

  it('markdown fenced code', () => {
    const tex = markdownToTex('```\nx \\end{lstlisting} y\n```');
    expect(count(tex, '\\end{lstlisting}')).toBe(1);
  });
});
