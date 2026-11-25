import { describe, expect, it } from 'vitest';
import { Complex } from '@danielsimonjr/mathts-core';
import { eig } from '@danielsimonjr/mathts-matrix';
import { eigs } from '../src/index.js';

type Value = number | Complex;

function asComplex(value: Value): Complex {
  return typeof value === 'number' ? new Complex(value) : value;
}

describe('eigs preserves eigenvalues beside a large one-way coupling (#1323)', () => {
  it.each([1e8, 1e12, 1e150])('returns three independent eigenvectors for coupling %s', (c) => {
    const input = [
      [3, 0, 0],
      [c, 0, 1],
      [0, -1, 0],
    ];
    expect(eig(input).repeatedEigenvalues).toEqual([]);
    const result = eigs(input) as {
      values: Value[];
      eigenvectors: { value: Value; vector: Value[] }[];
    };
    // #1561: the public `eigs` is the mathjs factory, whose shifted-QR
    // iteration leaves the coupled pair at rounding distance from the exact
    // ±i that the native solver returned for the block-triangular form. The
    // values keep the factory order (the +i member of the pair first); the
    // eigenpair residuals below stay the assertion of substance.
    const gotValues = result.values.map(asComplex);
    expect(gotValues[0].re).toBeCloseTo(0, 12);
    expect(gotValues[0].im).toBeCloseTo(1, 12);
    expect(gotValues[1].re).toBeCloseTo(0, 12);
    expect(gotValues[1].im).toBeCloseTo(-1, 12);
    expect(gotValues[2].re).toBeCloseTo(3, 12);
    expect(gotValues[2].im).toBeCloseTo(0, 12);
    const gotPairValues = result.eigenvectors.map((entry) => asComplex(entry.value));
    expect(gotPairValues[0].sub(gotValues[0]).abs()).toBeLessThanOrEqual(1e-12);
    expect(gotPairValues[1].sub(gotValues[1]).abs()).toBeLessThanOrEqual(1e-12);
    expect(gotPairValues[2].sub(gotValues[2]).abs()).toBeLessThanOrEqual(1e-12);
    const a = input.map((row) => row.map(asComplex));
    const matScale = Math.max(...a.flat().map((entry) => entry.abs()));
    for (const { value, vector } of result.eigenvectors) {
      const lambda = asComplex(value);
      const v = vector.map(asComplex);
      const vnorm = Math.max(...v.map((z) => z.abs()));
      for (let i = 0; i < 3; i++) {
        const terms = a[i].map((entry, j) => entry.mul(v[j]));
        const product = terms.reduce((sum, term) => sum.add(term), new Complex(0));
        const expected = lambda.mul(v[i]);
        const rowScale = terms.reduce((sum, term) => sum + term.abs(), expected.abs());
        // #1561: the factory's eigenvector satisfies A·v = λ·v to a few epsilons
        // of the matrix scale and the vector norm. For a row whose terms cancel
        // to far below that product (row 0 here: v[0] sits at the coupling's
        // inverse), the row-relative bound 1e-13·rowScale of the native solver
        // is below one rounding of the terms, so the bound carries the
        // scale-and-norm floor.
        const floor = 1e-13 * matScale * vnorm;
        expect(product.sub(expected).abs()).toBeLessThanOrEqual(Math.max(1e-13 * rowScale, floor));
      }
    }
  });
});
