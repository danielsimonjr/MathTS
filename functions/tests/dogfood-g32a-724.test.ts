import { describe, it, expect } from 'vitest';
import { substitute, evaluate } from '@danielsimonjr/mathts-functions';

describe('dogfood #724 substitute folds constants', () => {
  it('substitute(x^2+y, {x:2}) -> 4 + y', () => {
    const s = substitute('x^2+y', { x: 2 });
    expect(String(s)).toMatch(/4\s*\+\s*y/);
    expect(evaluate(String(s), { y: 1 })).toBe(5);
  });

  it('substitute(x^2, {x:2}) -> 4', () => {
    expect(String(substitute('x^2', { x: 2 }))).toBe('4');
  });
});
