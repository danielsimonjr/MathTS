import { describe, it, expect } from 'vitest';
import { mathMLToSVG } from '../src/svg-math.js';

describe('mathMLToSVG', () => {
  it('wraps a fragment in svg + foreignObject + math', () => {
    const svg = mathMLToSVG('<mi>x</mi>');
    expect(svg).toContain('<svg');
    expect(svg).toContain('<foreignObject');
    expect(svg).toContain('<math');
    expect(svg).toContain('<mi>x</mi>');
  });
  it('does not double-wrap an existing math document', () => {
    const svg = mathMLToSVG('<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>y</mi></math>');
    expect(svg.match(/<math/g)?.length).toBe(1);
  });
  it('honors display=inline and custom padding', () => {
    const svg = mathMLToSVG('<mi>z</mi>', { display: 'inline', padding: 8 });
    expect(svg).toContain('display="inline"');
    expect(svg).toMatch(/width="\d+"/);
    expect(svg).toContain('foreignObject');
  });
  it('sizes the box from the stripped text length', () => {
    const short = mathMLToSVG('<mi>x</mi>');
    const long = mathMLToSVG('<mi>abcdefghij</mi>');
    const w = (s: string) => Number(/width="(\d+)"/.exec(s)?.[1] ?? 0);
    expect(w(long)).toBeGreaterThan(w(short));
  });
});
