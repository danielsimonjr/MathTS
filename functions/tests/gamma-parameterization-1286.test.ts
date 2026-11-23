import { describe, expect, it } from 'vitest';
import { gammaCDF, gammaQuantile } from '../src/distribution-functions.js';
import { gammaDist } from '../src/typed/dist-objects.js';
import { gammaPDF } from '../src/typed/distributions.js';

describe('gamma helper rate convention (#1286)', () => {
  it.each([0.5, 2, 5])('matches the density and derivative of the CDF at shape %s', (shape) => {
    const x = 1;
    const h = 1e-5;
    const rate = 2;
    const cdfSlope = (gammaCDF(x + h, shape, rate) - gammaCDF(x - h, shape, rate)) / (2 * h);
    const density = gammaDist(shape, { rate }).pdf(x);
    expect(gammaPDF(x, shape, rate)).toBeCloseTo(cdfSlope, 8);
    expect(gammaPDF(x, shape, { scale: 0.5 })).toBe(density);
    expect(gammaPDF(new Float64Array([x]), shape, { rate })).toEqual(new Float64Array([density]));
    expect(gammaCDF(x, shape, { rate })).toBe(gammaCDF(x, shape, { scale: 0.5 }));
    expect(gammaQuantile(0.75, shape, { rate })).toBe(gammaQuantile(0.75, shape, { scale: 0.5 }));
  });

  it('preserves old positional-scale values through explicit scale', () => {
    expect(gammaPDF(1, 2, { scale: 2 })).toBeCloseTo(0.15163266492815836, 15);
    expect(gammaPDF(1, 2, 2)).toBeCloseTo(0.5413411329464508, 15);
    expect(gammaPDF(1, 2)).toBe(gammaPDF(1, 2, 1));
  });

  it('rejects simultaneous rate and scale options', () => {
    expect(() => gammaPDF(1, 2, { rate: 1, scale: 1 })).toThrow(/not both/);
  });
});
