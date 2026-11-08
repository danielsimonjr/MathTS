import { describe, it, expect } from 'vitest';
import * as functions from '../src/index.js';
import { studentTTwoSidedP as fromModule } from '../src/distribution-functions.js';

// scipy reference: 2 * scipy.stats.t.sf(|t|, df).
describe('studentTTwoSidedP is on the package surface (plan task M1)', () => {
  it('the index exports the module function', () => {
    expect((functions as Record<string, unknown>).studentTTwoSidedP).toBe(fromModule);
  });

  it('matches scipy in the body and in the far tail', () => {
    const p = (functions as unknown as { studentTTwoSidedP: (t: number, df: number) => number })
      .studentTTwoSidedP;
    expect(Math.abs(p(2.5, 10) - 0.03144684423660882)).toBeLessThan(1e-13);
    expect(Math.abs(p(-2.5, 10) - 0.03144684423660882)).toBeLessThan(1e-13);
    const tail = p(40, 3);
    expect(Math.abs(tail - 3.43806807891585e-5) / 3.43806807891585e-5).toBeLessThan(1e-10);
    expect(p(0, 5)).toBe(1);
  });
});
