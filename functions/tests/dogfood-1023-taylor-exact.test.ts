/**
 * #1023: `taylor`, `series` and `seriesCoefficient` must give exact coefficients.
 *
 * The old Cauchy-contour sum aliased: a_k received + a_(k+N) * r^N + ..., so every
 * coefficient of 1/(1-x) was 1.0000152590 and the center value a_0 was wrong. The
 * coefficients now come from symbolic derivatives evaluated at x0.
 */

import { describe, it, expect } from 'vitest';
import { taylor, series, seriesCoefficient } from '../src/index.js';

describe('#1023 taylor with a singularity near the contour', () => {
  it('taylor(1/(1-x), x, 0, 6) has coefficients of exactly 1', () => {
    expect(taylor('1/(1-x)', 'x', 0, 6)).toBe('1 + x + x^2 + x^3 + x^4 + x^5 + x^6');
  });

  it('taylor(sqrt(1+x), x, 0, 3) has the binomial coefficients', () => {
    expect(taylor('sqrt(1+x)', 'x', 0, 3)).toBe('1 + 0.5*x - 0.125*x^2 + 0.0625*x^3');
  });

  it('series(log(1+x), x, 0, 4) has the alternating harmonic coefficients', () => {
    expect(series('log(1+x)', 'x', 0, 4)).toBe('x - 0.5*x^2 + 0.3333333333*x^3 - 0.25*x^4');
  });

  it('seriesCoefficient(1/(1-x), x, 0, 3) is exactly 1', () => {
    expect(seriesCoefficient('1/(1-x)', 'x', 0, 3)).toBe(1);
  });

  it('seriesCoefficient gives the center value for k = 0', () => {
    expect(seriesCoefficient('1/(1-x)', 'x', 0, 0)).toBe(1);
    expect(seriesCoefficient('cos(x)', 'x', 0, 0)).toBe(1);
  });

  it('a center away from zero uses the shifted terms', () => {
    // 1/(1-x) around x0 = 0.5 is 2 + 4(x-0.5) + 8(x-0.5)^2 + ...
    expect(seriesCoefficient('1/(1-x)', 'x', 0.5, 2)).toBeCloseTo(8, 12);
    expect(taylor('1/(1-x)', 'x', 0.5, 2)).toBe('2 + 4*(x - 0.5) + 8*(x - 0.5)^2');
  });
});

describe('#1023 regressions and guards', () => {
  it('keeps the documented sin(x) example text', () => {
    expect(taylor('sin(x)', 'x', 0, 5)).toBe('x - 0.1666666667*x^3 + 0.008333333333*x^5');
  });

  it('keeps the documented exp(x) example text', () => {
    expect(taylor('exp(x)', 'x', 0, 4)).toBe(
      '1 + x + 0.5*x^2 + 0.1666666667*x^3 + 0.04166666667*x^4'
    );
  });

  it('exp(sin(x)) terminates and gives the first coefficients (derivative growth guard)', () => {
    // exp(sin(x)) = 1 + x + x^2/2 + 0*x^3 - x^4/8 + ...
    expect(seriesCoefficient('exp(sin(x))', 'x', 0, 0)).toBeCloseTo(1, 9);
    expect(seriesCoefficient('exp(sin(x))', 'x', 0, 1)).toBeCloseTo(1, 9);
    expect(seriesCoefficient('exp(sin(x))', 'x', 0, 2)).toBeCloseTo(0.5, 9);
    expect(seriesCoefficient('exp(sin(x))', 'x', 0, 3)).toBeCloseTo(0, 9);
    expect(seriesCoefficient('exp(sin(x))', 'x', 0, 4)).toBeCloseTo(-0.125, 9);
    // the full call at order 8 must still finish and return a polynomial text
    const text = taylor('exp(sin(x))', 'x', 0, 8);
    expect(text.startsWith('1 + x + 0.5*x^2')).toBe(true);
  });
});
