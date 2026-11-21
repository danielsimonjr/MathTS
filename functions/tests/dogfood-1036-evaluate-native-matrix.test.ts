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

  it('pinv of a DenseMatrix and of a SparseMatrix give the inverse values', () => {
    // Values only: the container type of the pinv result is not a contract of #1036.
    const inverse = [
      [-2, 1],
      [1.5, -0.5],
    ];
    expectClose(nested(evaluate('pinv(A)', { A: makeDense() })), inverse);
    expectClose(nested(evaluate('pinv(A)', { A: SparseMatrix.fromDense(makeDense()) })), inverse);
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

// Code review F7: the guard and the matrix package read one brand definition (core
// `NATIVE_MATRIX_BRAND`). A rename in one place cannot make the guard refuse a native matrix again.
describe('issue #1036: the guard reads the brand that the matrix classes carry', () => {
  it('DenseMatrix and SparseMatrix prototypes carry core NATIVE_MATRIX_BRAND', async () => {
    const { NATIVE_MATRIX_BRAND } = await import('@danielsimonjr/mathts-core/internal');
    const brandOf = (p: object): unknown => (p as Record<symbol, unknown>)[NATIVE_MATRIX_BRAND];
    expect(brandOf(DenseMatrix.prototype)).toBe(true);
    expect(brandOf(SparseMatrix.prototype)).toBe(true);
    expect(NATIVE_MATRIX_BRAND).toBe(Symbol.for('mathts.matrix.Matrix'));
  });
});
