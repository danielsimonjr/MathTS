import { describe, it, expect } from 'vitest';
import { sin, cos, tan, atan2 } from '../src/index.js';

/**
 * Re-export of the trigonometry typed-function domain from
 * `@danielsimonjr/mathts-functions`. Functions are callable, so these compute
 * real results. Full behaviour is covered by the functions package.
 */
describe('@danielsimonjr/mathts-trigonometry', () => {
  it('computes trig at known points', () => {
    expect(cos(0)).toBe(1);
    expect(sin(0)).toBe(0);
    expect(Math.abs(tan(0))).toBeLessThan(1e-12);
    expect(Math.abs(atan2(0, 1))).toBeLessThan(1e-12);
  });
});
