import { describe, it, expect } from 'vitest';
import { lgamma, gamma } from '../src/index.js';
import { Complex } from '@danielsimonjr/mathts-core';

/**
 * GC6 — complex log-gamma branch. lgamma previously accepted only number /
 * Float64Array. Reference values from mpmath.loggamma (dps=50).
 */
describe('GC6: lgamma(Complex)', () => {
  // [re, im, loggamma.re, loggamma.im] from mpmath.loggamma
  const refs: [number, number, number, number][] = [
    [1.5, 2.0, -1.4991963725850954, 0.7332806816909979],
    [3.0, 1.0, 0.5003693505574093, 0.9474054360100591],
    [0.5, 4.0, -5.3642467619574, 1.555632880698],
    [2.5, -3.0, -1.470954605, -2.822615636],
  ];

  it('matches mpmath.loggamma for complex arguments', () => {
    for (const [re, im, lre, lim] of refs) {
      const r = lgamma(new Complex(re, im)) as Complex;
      expect(r.re).toBeCloseTo(lre, 6);
      expect(r.im).toBeCloseTo(lim, 6);
    }
  });

  it('is consistent with log(gamma(z)) on the principal branch (Re(z) > 0)', () => {
    for (const [re, im] of refs) {
      if (re <= 0.5) continue;
      const g = gamma(new Complex(re, im)) as Complex;
      const viaGamma = g.log();
      const direct = lgamma(new Complex(re, im)) as Complex;
      expect(direct.re).toBeCloseTo(viaGamma.re, 8);
      expect(direct.im).toBeCloseTo(viaGamma.im, 8);
    }
  });
});

// mpmath.loggamma, 60 decimal digits, rounded here to binary64.
it.each([
  [-2.3, 0.2, 0.11519970679426499, -8.833177370956799],
  [-2.3, -0.2, 0.11519970679426499, 8.833177370956799],
  [-10.9, 1, -18.51690596800722, -33.37784633942664],
  [-10.9, -1, -18.51690596800722, 33.37784633942664],
  [-2.5, 0, -0.056243716497674054, -9.42477796076938],
  [-3.5, 0, -1.309006684993042, -12.566370614359172],
  [-2, 1e-12, 26.937873935368604, -7.85398163397356],
  [-4.25, 300, -497.41312251286473, 1403.635996103122],
])('keeps the analytic phase of lgamma(%s + %si)', (re, im, expectedRe, expectedIm) => {
  const result = lgamma(new Complex(re, im)) as Complex;
  expect(result.re).toBeCloseTo(expectedRe, 9);
  expect(result.im).toBeCloseTo(expectedIm, 9);
});
