import { describe, it, expect } from 'vitest';
import { lgamma } from '../src/typed/special.js';
import { lgammaNumber } from '../src/plain/number/probability.js';
import { _lgamma } from '../src/wasm/special/scalars.js';

describe('log-gamma contracts (_lgamma vs lgammaNumber)', () => {
  it('_lgamma(-0.5) = ln(2√π)', () => {
    const expected = Math.log(2 * Math.sqrt(Math.PI));
    expect(_lgamma(-0.5)).toBeCloseTo(expected, 14);
    expect(lgamma(-0.5)).toBeCloseTo(expected, 14);
  });

  it('_lgamma(-1) is +Infinity (pole)', () => {
    expect(_lgamma(-1)).toBe(Infinity);
    expect(lgamma(-1)).toBe(Infinity);
  });

  it('lgammaNumber rejects every negative argument with NaN', () => {
    expect(lgammaNumber(-0.5)).toBeNaN();
    expect(lgammaNumber(-1)).toBeNaN();
    expect(lgammaNumber(-2.3)).toBeNaN();
  });

  it('lgammaNumber(0.25) is finite (reflection on (0, 0.5))', () => {
    const v = lgammaNumber(0.25);
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThan(0);
  });
});
