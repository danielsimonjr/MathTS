import { describe, it, expect } from 'vitest';
import { renderChart } from '../src/svg.js';

describe('renderChart', () => {
  it('renders a self-contained line chart SVG', () => {
    const svg = renderChart(
      { type: 'line', title: 'T', xLabel: 'x', yLabel: 'y' },
      [1, 2, 3],
      [10, 20, 30]
    );
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

describe('renderChart tikz format', () => {
  it('emits a tikzpicture fragment (no <svg>, no standalone documentclass)', () => {
    const out = renderChart({ type: 'line', title: 'T' }, [0, 1, 2], [0, 1, 4], 'tikz');
    expect(out).toContain('\\begin{tikzpicture}');
    expect(out).not.toContain('<svg');
    expect(out).not.toContain('documentclass'); // fragment, embeddable
  });
  it('default format is still svg (backward compatible)', () => {
    expect(renderChart({ type: 'line' }, [0, 1], [0, 1])).toMatch(/^<svg/);
  });
});
