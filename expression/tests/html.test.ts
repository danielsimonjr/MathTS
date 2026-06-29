import { describe, it, expect } from 'vitest';
import { parse } from './helpers/bootstrap.js';
import { toHTML, toCSS } from '../src/html.js';
import type { RenderCell, RenderDoc } from '../src/html.js';

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

  it('renders each cell type (equations via injected parse)', () => {
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
    expect(out).toContain('<math'); // equation wrapped + rendered
    expect(out).toContain('<mfrac>');
    expect(out).toContain('1 + 1');
    expect(out).toContain('cell-output');
    expect(out).toContain('✓');
  });

  it('shows a failing/never-run test badge and a code error', () => {
    const out = toHTML(
      doc([
        { type: 'test', content: 'false', passed: false },
        { type: 'test', content: 'never ran' }, // no passed -> neutral
        { type: 'code', content: 'boom', error: 'Undefined symbol "boom"' },
      ])
    );
    expect(out).toContain('✗');
    expect(out).toContain('cell-test nrun');
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

  it('toCSS is a non-empty stylesheet that cannot break out of <style>', () => {
    expect(toCSS().length).toBeGreaterThan(50);
    expect(toCSS()).not.toContain('</style>');
  });
});
