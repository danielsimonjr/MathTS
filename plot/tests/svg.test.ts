import { describe, it, expect } from 'vitest';
import { esc, fmt, svgDoc, circle, THEMES } from '../src/svg.js';

describe('svg primitives', () => {
  it('escapes XML special chars', () => {
    expect(esc('a<b>&"')).toBe('a&lt;b&gt;&amp;"');
  });
  it('fmt uses exponential for extreme magnitudes', () => {
    expect(fmt(1234)).toBe('1234');
    expect(fmt(1e7)).toContain('e');
  });
  it('circle emits an SVG circle with the given center', () => {
    expect(circle(10, 20, 3, '#000')).toBe('<circle cx="10" cy="20" r="3" fill="#000"/>');
  });
  it('svgDoc wraps a root with viewBox', () => {
    const s = svgDoc(100, 50, '<g/>', '#fff');
    expect(s).toContain('viewBox="0 0 100 50"');
    expect(s).toContain('<g/>');
  });
  it('provides light and dark themes with a series palette', () => {
    expect(THEMES.light.series.length).toBeGreaterThan(3);
    expect(THEMES.dark.bg).not.toBe(THEMES.light.bg);
  });
});
