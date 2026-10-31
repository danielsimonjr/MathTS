import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '../src/types/DenseMatrix.js';
import { jsBackend } from '../src/backends/JSBackend.js';

describe('DenseMatrix.multiply zero×non-finite', () => {
  it('propagates 0×Infinity as NaN like JSBackend', () => {
    const a = DenseMatrix.fromArray([[0]]);
    const b = DenseMatrix.fromArray([[Infinity]]);
    expect(a.multiply(b).get(0, 0)).toBeNaN();
    expect(jsBackend.multiply(a, b).get(0, 0)).toBeNaN();
  });
});
