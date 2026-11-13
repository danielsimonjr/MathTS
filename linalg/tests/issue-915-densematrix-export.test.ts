import { describe, it, expect } from 'vitest';
// Issue #915: the linalg package must export DenseMatrix. Imported by package
// name, so the test runs against the built dist.
import * as linalg from '@danielsimonjr/mathts-linalg';
import { lu, DenseMatrix } from '@danielsimonjr/mathts-linalg';

describe('issue #915: @danielsimonjr/mathts-linalg exports DenseMatrix', () => {
  it('exports DenseMatrix from the package entry', () => {
    expect(typeof (linalg as Record<string, unknown>).DenseMatrix).toBe('function');
  });

  it('builds a matrix and factorizes it through the linalg entry alone', () => {
    const A = DenseMatrix.fromArray([
      [4, 3],
      [6, 3],
    ]);
    const fac = lu(A);
    expect(fac.L).toBeDefined();
    expect(fac.U).toBeDefined();
  });
});
