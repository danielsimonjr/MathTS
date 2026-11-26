import { describe, it, expect } from 'vitest';
import { Complex } from '@danielsimonjr/mathts-core';
import { add, multiply } from '@danielsimonjr/mathts-functions';
import { create as createCompat, all as compatAll } from '../../src/index.js';

/**
 * Policy: complex.js wrappers apply only on compat instances. Creating `create(all)`
 * must not mutate native `add`/`multiply` or `Complex` IEEE semantics (#1589).
 */
describe('native Complex IEEE is unchanged after a compat instance is created (#1589)', () => {
  const inf = new Complex(Infinity, Infinity);
  const nan = new Complex(NaN, NaN);
  const two = new Complex(2, 0);

  function snapshot(): { addInf: unknown; mulNan: unknown; addNanInf: unknown } {
    return {
      addInf: add(inf, two),
      mulNan: multiply(nan, two),
      addNanInf: add(nan, inf),
    };
  }

  const before = snapshot();
  createCompat(compatAll, {});
  const after = snapshot();

  it('native add/multiply on non-finite Complex matches the pre-compat snapshot', () => {
    expect(after).toEqual(before);
  });

  it('native results stay IEEE (NaN parts), not complex.js Infinity', () => {
    const a = add(nan, two) as Complex;
    const m = multiply(nan, two) as Complex;
    expect(Number.isNaN(a.re) && Number.isNaN(a.im)).toBe(true);
    expect(Number.isNaN(m.re) && Number.isNaN(m.im)).toBe(true);
  });
});
