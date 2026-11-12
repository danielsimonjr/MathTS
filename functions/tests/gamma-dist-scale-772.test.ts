import { describe, it, expect } from 'vitest';
import { gammaDist } from '../src/typed/dist-objects.js';

/** Issue #772 — gammaDist rate vs SciPy scale. */
describe('#772 gammaDist rate vs SciPy scale', () => {
  it('rate parameterization: gammaDist(2, 2).pdf(1) matches SciPy scale=0.5', () => {
    const d = gammaDist(2, 2);
    expect(d.pdf(1)).toBeCloseTo(0.5413411329464507, 12);
    expect(d.mean).toBe(1);
    expect(d.variance).toBe(0.5);
  });

  it('scale option: gammaDist(2, { scale: 2 }).pdf(1) matches SciPy', () => {
    const d = gammaDist(2, { scale: 2 });
    expect(d.pdf(1)).toBeCloseTo(0.15163266492815836, 12);
    expect(d.mean).toBe(4);
    expect(d.variance).toBe(8);
  });

  it('scale option object form gammaDist({ shape: 2, scale: 2 })', () => {
    const d = gammaDist({ shape: 2, scale: 2 });
    expect(d.pdf(1)).toBeCloseTo(0.15163266492815836, 12);
    expect(d.mean).toBe(4);
    expect(d.variance).toBe(8);
  });
});
