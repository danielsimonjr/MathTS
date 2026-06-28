import { describe, it, expect } from 'vitest';
import { parse } from '../src/index.js';
import { toMathML, toHTML, toCSS, markdownToHtml, renderChart } from '@danielsimonjr/mathts-expression';
import type { RenderCell, RenderDoc } from '@danielsimonjr/mathts-expression';

const mm = (s: string): string => toMathML(parse(s));

describe('toMathML (via wired parse)', () => {
  it('wraps output in a <math> element', () => {
    expect(mm('x')).toMatch(/^<math xmlns="http:\/\/www\.w3\.org\/1998\/Math\/MathML" display="block">/);
    expect(mm('x')).toContain('<mi>x</mi>');
  });

  it('renders scientific notation as mantissa × 10^exp', () => {
    const out = mm('8.8541878128e-12');
    expect(out).toContain('<mn>8.8541878128</mn>');
    expect(out).toContain('<mo>&#xD7;</mo>');
    expect(out).toContain('<msup><mn>10</mn><mn>-12</mn></msup>');
  });

  it('maps Greek symbol names to glyphs', () => {
    expect(mm('lambda')).toContain('<mi>λ</mi>');
    expect(mm('nu')).toContain('<mi>ν</mi>');
    expect(mm('mu')).toContain('<mi>μ</mi>');
    expect(mm('x')).toContain('<mi>x</mi>');
  });

  it('renders a single-underscore name as a subscript', () => {
    expect(mm('a_0')).toContain('<msub><mi>a</mi><mn>0</mn></msub>');
    expect(mm('F_net')).toContain('<msub><mi>F</mi><mi>net</mi></msub>');
  });

  it('renders the full Maxwell equation (fraction + radical + equals)', () => {
    const out = mm('c = 1 / sqrt(eps0 * mu0)');
    expect(out).toContain('<mi>c</mi>');
    expect(out).toContain('<mo>=</mo>');
    expect(out).toContain('<mfrac>');
    expect(out).toContain('<msqrt>');
  });

  it('preserves precedence: -x^2 is -(x^2)', () => {
    const out = mm('-x^2');
    expect(out.indexOf('<mo>-</mo>')).toBeLessThan(out.indexOf('<msup>'));
  });

  it('renders sqrt/abs structurally', () => {
    expect(mm('sqrt(x)')).toContain('<msqrt>');
    expect(mm('abs(x)')).toContain('<mo>|</mo>');
  });

  it('escapes text in string constants', () => {
    expect(mm('"a<b"')).toContain('a&lt;b');
  });

  it('renders chained relationals (RelationalNode), not flat text', () => {
    const out = mm('a < b < c');
    expect(out).not.toContain('<mtext>'); // not the fallback
    expect((out.match(/<mo>&lt;<\/mo>/g) ?? []).length).toBe(2);
  });

  it('exposes a .toMathML() node method matching the function', () => {
    const node = parse('x') as unknown as { toMathML(): string };
    expect(node.toMathML()).toBe(mm('x'));
  });
});

function doc(cells: RenderCell[], meta: Partial<RenderDoc> = {}): RenderDoc {
  return { title: 'Test Doc', cells, ...meta };
}

describe('toHTML', () => {
  it('produces a self-contained HTML5 document with inlined CSS', () => {
    const out = toHTML(doc([]));
    expect(out).toMatch(/^<!doctype html>/i);
    expect(out).toContain('<html lang="en">');
    expect(out).toContain('<meta charset="utf-8">');
    expect(out).toContain('<style>');
    expect(out).toContain('<title>Test Doc</title>');
    expect(out).not.toMatch(/<link |<script src=|https?:\/\//);
  });

  it('renders each cell type (equations need injected parse)', () => {
    const out = toHTML(
      doc([
        { type: 'markdown', content: '# Hello\n\nWorld **bold**' },
        { type: 'equation', content: 'c = 1 / sqrt(eps0 * mu0)' },
        { type: 'code', content: '1 + 1', output: '2', id: 'x' },
        { type: 'test', content: 'x == 2', passed: true },
        { type: 'data', content: '[1,2,3]', output: '[1, 2, 3]', id: 'd' },
      ]),
      { parse }
    );
    expect(out).toContain('<h1>Hello</h1>');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<math');
    expect(out).toContain('<mfrac>');
    expect(out).toContain('1 + 1');
    expect(out).toContain('cell-output');
    expect(out).toContain('✓');
  });

  it('shows a failing test badge and a code error', () => {
    const out = toHTML(
      doc([
        { type: 'test', content: 'false', passed: false },
        { type: 'code', content: 'boom', error: 'Undefined symbol "boom"' },
      ])
    );
    expect(out).toContain('✗');
    expect(out).toContain('cell-error');
    expect(out).toContain('Undefined symbol');
  });

  it('escapes all user content (XSS-safe)', () => {
    const out = toHTML(
      doc(
        [
          { type: 'markdown', content: '<script>alert(1)</script>' },
          { type: 'code', content: 'a < b', output: '<img src=x onerror=1>' },
        ],
        { title: '<script>evil</script>' }
      ),
      { parse }
    );
    expect(out).not.toContain('<script>alert(1)</script>');
    expect(out).not.toContain('<script>evil</script>');
    expect(out).not.toContain('<img src=x onerror=1>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('degrades an equation to <merror> when no parser is injected', () => {
    expect(toHTML(doc([{ type: 'equation', content: 'x' }]))).toContain('<merror>');
  });

  it('renders a never-run test as a neutral badge, not a fail', () => {
    const out = toHTML(doc([{ type: 'test', content: 'x == 2' }])); // no passed, no error
    expect(out).toContain('cell-test nrun');
    expect(out).not.toContain('cell-test fail');
  });

  it('toCSS is a non-empty stylesheet that cannot break out of <style>', () => {
    expect(toCSS().length).toBeGreaterThan(50);
    expect(toCSS()).not.toContain('</style>');
  });
});

describe('renderChart', () => {
  it('renders a self-contained line chart SVG', () => {
    const svg = renderChart({ type: 'line', title: 'T', xLabel: 'x', yLabel: 'y' }, [1, 2, 3], [10, 20, 30]);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('width="100%"');
    expect(svg).toContain('<polyline');
    expect(svg).toContain('T');
  });

  it('supports scatter (circles) and bar (rects)', () => {
    expect(renderChart({ type: 'scatter' }, [1, 2], [3, 4])).toContain('<circle');
    expect(renderChart({ type: 'bar' }, [1, 2], [3, 4])).toContain('<rect');
  });

  it('coerces Unit-like values (toNumeric) and mathjs Matrix (toArray)', () => {
    const u = (v: number) => ({ toNumeric: () => v });
    expect(renderChart({ type: 'scatter' }, [u(1), u(2)], [u(3), u(4)])).toContain('<circle');
    const matrix = { toArray: () => [1, 2, 3] };
    expect(renderChart({ type: 'line' }, matrix, [4, 5, 6])).toContain('<polyline');
  });

  it('shows a "no data" placeholder for empty/invalid data, never throws', () => {
    expect(renderChart({}, [], [])).toContain('no data');
    expect(renderChart({ type: 'line' }, [1, NaN, 3], [1, 2, Infinity])).toMatch(/^<svg/);
    expect(() => renderChart({}, 'nope', { x: 1 })).not.toThrow();
  });

  it('escapes title and labels', () => {
    const svg = renderChart({ title: '<script>x</script>', xLabel: '<b>' }, [1], [2]);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });
});

describe('markdownToHtml', () => {
  it('renders headings/bold/code/lists/links', () => {
    expect(markdownToHtml('# T')).toContain('<h1>T</h1>');
    expect(markdownToHtml('**b**')).toContain('<strong>b</strong>');
    expect(markdownToHtml('`c`')).toContain('<code>c</code>');
    expect(markdownToHtml('- a\n- b')).toContain('<ul><li>a</li><li>b</li></ul>');
    expect(markdownToHtml('[s](https://example.com)')).toContain('<a href="https://example.com">s</a>');
  });

  it('is XSS-safe (escapes html, drops dangerous links)', () => {
    expect(markdownToHtml('<script>x</script>')).toContain('&lt;script&gt;');
    for (const bad of ['[x](javascript:1)', '[x](data:text/html,1)', '[x](//evil.com)']) {
      expect(markdownToHtml(bad)).not.toContain('<a href');
    }
  });
});
