import { describe, it, expect } from 'vitest';
// Issue #1036: safe evaluate refused a matrix of the matrix package ("cannot return a host
// object"). `inv(A)`, `pinv(A)`, `A` and `transpose(A)` threw for a DenseMatrix or SparseMatrix A
// in scope. Imported by package name and by `src`, as the other evaluate tests do.
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { evaluate } from '../src/index.js';

type Nested = number[][];

// A matrix result has `toArray`; `pinv` of a SparseMatrix returns a nested array.
function nested(value: unknown): Nested {
  return Array.isArray(value) ? (value as Nested) : (value as { toArray(): Nested }).toArray();
}

function expectClose(actual: Nested, expected: Nested, tolerance = 1e-12): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i].length).toBe(expected[i].length);
    for (let j = 0; j < expected[i].length; j++) {
      expect(Math.abs(actual[i][j] - expected[i][j])).toBeLessThan(tolerance);
    }
  }
}

// inverse of [[1,2],[3,4]]: det = -2, so the inverse is [[-2,1],[1.5,-0.5]]
const INVERSE: Nested = [
  [-2, 1],
  [1.5, -0.5],
];

function makeDense(): DenseMatrix {
  return new DenseMatrix([
    [1, 2],
    [3, 4],
  ]);
}

describe('issue #1036: safe evaluate returns a matrix of the matrix package', () => {
  for (const [label, make] of [
    ['DenseMatrix', () => makeDense()],
    ['SparseMatrix', () => SparseMatrix.fromDense(makeDense())],
  ] as const) {
    describe(label, () => {
      it('inv(A) returns the inverse', () => {
        const A = make();
        const result = evaluate('inv(A)', { A });
        expectClose(nested(result), INVERSE);
      });

      it('pinv(A) returns the inverse of an invertible A', () => {
        const A = make();
        const result = evaluate('pinv(A)', { A });
        expectClose(nested(result), INVERSE, 1e-10);
      });

      it('det(A) is -2 // pin: fixed on main before C2', () => {
        const A = make();
        expect(evaluate('det(A)', { A })).toBeCloseTo(-2, 12);
      });

      it('A and transpose(A) come back', () => {
        const A = make();
        expectClose(nested(evaluate('A', { A })), [
          [1, 2],
          [3, 4],
        ]);
        expectClose(nested(evaluate('transpose(A)', { A })), [
          [1, 3],
          [2, 4],
        ]);
      });

      it('A inside an array literal and an object literal does not throw', () => {
        const A = make();
        expect(() => evaluate('[A]', { A })).not.toThrow();
        expect(() => evaluate('{a: A}', { A })).not.toThrow();
      });
    });
  }

  it('the dense inverse is a DenseMatrix and the sparse inverse is a SparseMatrix', () => {
    const dense = makeDense();
    const sparse = SparseMatrix.fromDense(makeDense());
    expect(evaluate('inv(A)', { A: dense })).toBeInstanceOf(DenseMatrix);
    expect(evaluate('inv(A)', { A: sparse })).toBeInstanceOf(SparseMatrix);
  });

  it('pinv of a SparseMatrix is a nested array, pinv of a DenseMatrix is a DenseMatrix', () => {
    const dense = evaluate('pinv(A)', { A: makeDense() });
    const sparse = evaluate('pinv(A)', { A: SparseMatrix.fromDense(makeDense()) });
    expect(dense).toBeInstanceOf(DenseMatrix);
    expect(Array.isArray(sparse)).toBe(true);
  });
});

describe('issue #1036: the guard still refuses host objects', () => {
  it('refuses process', () => {
    expect(() => evaluate('p', { p: process })).toThrow(/host object/);
  });

  it('refuses a native matrix that carries a host reference', () => {
    const B = new DenseMatrix([[1]]);
    (B as unknown as Record<string, unknown>).extra = process;
    expect(() => evaluate('B', { B })).toThrow(/host object/);
  });

  it('still refuses a typed array at the top level and in a plain object (pin)', () => {
    const x = new Float64Array([1, 2]);
    expect(() => evaluate('x', { x })).toThrow(/host object/);
    expect(() => evaluate('{a: x}', { x })).toThrow(/host object/);
  });
});
