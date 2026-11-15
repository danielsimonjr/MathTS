/**
 * A matrix of a second copy of `@danielsimonjr/mathts-matrix` must pass the type tests. The
 * matrix must also take the same code path as a matrix of the first copy (#1041).
 *
 * The first copy is the package sources. The second copy is a copy of the built bundle, loaded by
 * the shared helper, so it has its own classes and `instanceof` fails across the copies. The helper
 * uses no API of the test runner, so the test runs under bun test and vitest.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as m1 from '../src/index.js';
import { decompositionInputToDenseMatrix } from '../src/operations/as-packed.js';

type M = typeof m1;
let m2: M;

const ENTRIES = [
  { row: 0, col: 0, value: 4 },
  { row: 0, col: 1, value: -1 },
  { row: 1, col: 1, value: 3 },
];

beforeAll(async () => {
  // The helper is untyped, so the test imports it through a URL that the type checker does not read.
  const helper = new URL('../../tools/test/second-package-copy.mjs', import.meta.url).href;
  const { importSecondPackageCopy } = (await import(helper)) as {
    importSecondPackageCopy(dir: string, name: string): Promise<unknown>;
  };
  m2 = (await importSecondPackageCopy('matrix', 'matrix-brand-1041')) as M;
});

describe('#1041 the second copy is a real second copy', () => {
  it('has its own classes', () => {
    expect(m2.DenseMatrix).not.toBe(m1.DenseMatrix);
    expect(m2.SparseMatrix).not.toBe(m1.SparseMatrix);
    expect(m2.DenseMatrix.fromArray([[1]]) instanceof m1.DenseMatrix).toBe(false);
  });
});

describe('#1041 type tests read the brand', () => {
  it('isDenseMatrix and isSparseMatrix accept a matrix of either copy', () => {
    expect(m1.isDenseMatrix(m2.DenseMatrix.fromArray([[1, 2]]))).toBe(true);
    expect(m1.isSparseMatrix(m2.SparseMatrix.fromCOO(2, 2, ENTRIES))).toBe(true);
    expect(m1.isDenseMatrix(m1.DenseMatrix.fromArray([[1, 2]]))).toBe(true);
  });

  it('the two classes do not pass each other test', () => {
    expect(m1.isDenseMatrix(m2.SparseMatrix.fromCOO(2, 2, ENTRIES))).toBe(false);
    expect(m1.isSparseMatrix(m2.DenseMatrix.fromArray([[1]]))).toBe(false);
  });

  it('a look-alike object without the brand does not pass', () => {
    const fake = { type: 'DenseMatrix', rows: 1, cols: 1, get: () => 0 };
    expect(m1.isDenseMatrix(fake)).toBe(false);
    expect(m1.isSparseMatrix({ ...fake, type: 'SparseMatrix' })).toBe(false);
    expect(m1.isDenseMatrix(null)).toBe(false);
    expect(m1.isDenseMatrix(1)).toBe(false);
  });

  it('the brand adds no own key to an instance', () => {
    const d = m1.DenseMatrix.fromArray([[1]]);
    expect(Object.getOwnPropertySymbols(d)).toEqual([]);
    expect(Object.keys(d)).not.toContain('mathts.matrix.DenseMatrix');
  });
});

/** Spy on a private method of the first-copy SparseMatrix prototype. */
function spyOnPrivate(name: 'addSparse' | 'multiplySparse') {
  const proto = m1.SparseMatrix.prototype as unknown as Record<
    string,
    (...args: unknown[]) => unknown
  >;
  return vi.spyOn(proto, name);
}

describe('#1041 SparseMatrix arithmetic with a sparse operand of the second copy', () => {
  const a = () => m1.SparseMatrix.fromCOO(2, 2, ENTRIES);
  const b = () => m2.SparseMatrix.fromCOO(2, 2, ENTRIES);

  it('add takes the sparse path', () => {
    const spy = spyOnPrivate('addSparse');
    const r = a().add(b() as never);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    expect(r.toDense().toArray()).toEqual([
      [8, -2],
      [0, 6],
    ]);
  });

  it('subtract takes the sparse path', () => {
    const spy = spyOnPrivate('addSparse');
    const r = a().subtract(b() as never);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    expect(
      r
        .toDense()
        .toArray()
        .map((row) => row.map((x) => x + 0))
    ).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('multiply takes the sparse path', () => {
    const spy = spyOnPrivate('multiplySparse');
    const r = a().multiply(b() as never);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    expect(r.toDense().toArray()).toEqual([
      [16, -7],
      [0, 9],
    ]);
  });
});

describe('#1041 decomposition input of the second copy', () => {
  it('a sparse matrix of the second copy densifies without a rebuild', () => {
    const d = decompositionInputToDenseMatrix(m2.SparseMatrix.fromCOO(2, 2, ENTRIES) as never);
    expect(m1.isDenseMatrix(d)).toBe(true);
    expect(d.toArray()).toEqual([
      [4, -1],
      [0, 3],
    ]);
  });
});
