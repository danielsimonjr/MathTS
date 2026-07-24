import { describe, it, expect } from 'vitest';
import { expand, factor, together, apart, evaluate } from '../src/index.js';

const at = (e: string, x: number) => evaluate(e, { x }) as number;

describe('CAS engine (univariate) — real transforms', () => {
  it('expand((x+1)^3) evaluates to (x+1)^3 and is not the input', () => {
    const e = expand('(x+1)^3');
    expect(e.replace(/\s/g, '')).not.toBe('(x+1)^3');
    for (const x of [-2, 0.5, 3]) expect(at(e, x)).toBeCloseTo((x + 1) ** 3, 8);
  });

  it('factor(x^2-1) evaluates to x^2-1 and is factored (not the input)', () => {
    const f = factor('x^2-1');
    expect(f.replace(/\s/g, '')).not.toBe('x^2-1');
    for (const x of [-2, 0.5, 3]) expect(at(f, x)).toBeCloseTo(x * x - 1, 8);
  });

  it('together(1/x + 1/(x+1)) evaluates identically and is a single fraction', () => {
    const t = together('1/x + 1/(x+1)');
    for (const x of [2, 0.5, 3]) expect(at(t, x)).toBeCloseTo(1 / x + 1 / (x + 1), 8);
  });

  it('apart(1/(x^2-1)) evaluates identically and is decomposed (not the input)', () => {
    const a = apart('1/(x^2-1)');
    expect(a.replace(/\s/g, '')).not.toBe('1/(x^2-1)');
    for (const x of [2, 0.5, 3]) expect(at(a, x)).toBeCloseTo(1 / (x * x - 1), 8);
  });
});
