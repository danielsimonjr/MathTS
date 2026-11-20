/**
 * #1024 (fixer finding F6): two real poles closer than the multiplicity test can separate keep the
 * no closed form (NoClosedFormError); they are never read as one double pole (`t`).
 */
import { describe, it, expect } from 'vitest';
import { inverseLaplace, NoClosedFormError } from '../src/typed/cas.js';

describe('#1024 inverseLaplace: close distinct poles', () => {
  it.each(['1/((s-1e-7)*(s+1e-7))', '1/(s^2-1e-14)'])('%s throws NoClosedFormError', (expr) => {
    expect(() => inverseLaplace(expr, 's', 't')).toThrow(NoClosedFormError);
  });

  it('true double poles keep their transform', () => {
    expect(inverseLaplace('1/(s+1)^2', 's', 't')).toBe('t*exp(-1*t)');
    expect(inverseLaplace('1/((s+1)^2*(s+2)^2)', 's', 't')).toBe(
      '2*exp(-2*t) + t*exp(-2*t) - 2*exp(-1*t) + t*exp(-1*t)'
    );
  });

  it('separated poles give two exponentials', () => {
    expect(inverseLaplace('1/(s^2-1)', 's', 't')).toBe('-0.5*exp(-1*t) + 0.5*exp(1*t)');
  });
});
