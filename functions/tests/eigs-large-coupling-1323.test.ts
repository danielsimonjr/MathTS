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
    expect(result.values.map(String)).toEqual(['-i', 'i', '3']);
    expect(result.eigenvectors.map((entry) => String(entry.value))).toEqual(['-i', 'i', '3']);
    const a = input.map((row) => row.map(asComplex));
    for (const { value, vector } of result.eigenvectors) {
      const lambda = asComplex(value);
      const v = vector.map(asComplex);
      for (let i = 0; i < 3; i++) {
        const terms = a[i].map((entry, j) => entry.mul(v[j]));
        const product = terms.reduce((sum, term) => sum.add(term), new Complex(0));
        const expected = lambda.mul(v[i]);
        const rowScale = terms.reduce((sum, term) => sum + term.abs(), expected.abs());
        expect(product.sub(expected).abs()).toBeLessThanOrEqual(1e-13 * rowScale);
      }
    }
  });
});
