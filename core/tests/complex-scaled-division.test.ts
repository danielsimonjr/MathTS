import { describe, expect, it } from 'vitest';
import { Complex } from '../src/types/complex.js';

describe('complex division at extreme magnitudes (#1363)', () => {
  it.each([1e300, 1e-300, Number.MIN_VALUE])('scales shared magnitudes of %s', (s) => {
    const result = new Complex(s, s).divide(new Complex(s, -s));
    expect(result.re).toBe(0);
    expect(result.im).toBe(1);
  });

  it('retains finite or zero components when another component overflows', () => {
    const result = new Complex(1e300, 1e300).divide(new Complex(1e-300, 1e-300));
    expect(result.re).toBe(Infinity);
    expect(result.im).toBe(0);
  });
});
