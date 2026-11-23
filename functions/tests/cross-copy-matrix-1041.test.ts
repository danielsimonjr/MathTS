/**
 * A matrix of a second copy of `@danielsimonjr/mathts-matrix` must work in the public functions
 * as a matrix of the first copy does (#1041). The second copy is a real copy of the built bundle,
 * with its own classes, so `instanceof` fails across the copies.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import * as m1 from '@danielsimonjr/mathts-matrix';
import { add, dotMultiply, kron, multiply, pinv, subtract, trace } from '../src/index.js';

type M = typeof m1;
let m2: M;
const E = [
  { row: 0, col: 0, value: 2 },
  { row: 1, col: 1, value: 3 },
];
const sparse2 = () => m2.SparseMatrix.fromCOO(2, 2, E);
const dense2 = () =>
  m2.DenseMatrix.fromArray([
    [1, 1],
    [1, 1],
  ]);
const rows = (v: unknown) => (v as { toArray(): number[][] }).toArray();

beforeAll(async () => {
  // The helper is untyped, so the test imports it through a URL that the type checker does not read.
  const helper = new URL('../../tools/test/second-package-copy.mjs', import.meta.url).href;
  const { importSecondPackageCopy } = (await import(helper)) as {
    importSecondPackageCopy(dir: string, name: string): Promise<unknown>;
  };
  m2 = (await importSecondPackageCopy('matrix', 'functions-matrix-1041')) as M;
});

describe('#1041 the second copy is a real second copy', () => {
  it('has its own classes', () => {
    expect(m2.SparseMatrix).not.toBe(m1.SparseMatrix);
    expect(sparse2() instanceof m1.SparseMatrix).toBe(false);
    expect(m1.isSparseMatrix(sparse2())).toBe(true);
    expect(m1.isNativeMatrix(dense2())).toBe(true);
  });
});

describe('#1041 public functions accept a matrix of the second copy', () => {
  it('multiply and add of two sparse matrices pass the operand guard and stay sparse', () => {
    const p = multiply(sparse2() as never, sparse2() as never);
    expect(m1.isSparseMatrix(p)).toBe(true);
    expect(rows(p)).toEqual([
      [4, 0],
      [0, 9],
    ]);
    const s = add(sparse2() as never, sparse2() as never);
    expect(m1.isSparseMatrix(s)).toBe(true);
    expect(rows(s)).toEqual([
      [4, 0],
      [0, 6],
    ]);
  });

  it('a factory function adapts a sparse matrix of the second copy', () => {
    expect(trace(sparse2() as never)).toBe(5);
    const k = kron(sparse2() as never, dense2() as never);
    expect(rows(k)).toEqual([
      [2, 2, 0, 0],
      [2, 2, 0, 0],
      [0, 0, 3, 3],
      [0, 0, 3, 3],
    ]);
    const d = dotMultiply(sparse2() as never, dense2() as never);
    expect(m1.isSparseMatrix(d)).toBe(true);
    expect(rows(d)).toEqual([
      [2, 0],
      [0, 3],
    ]);
    // A sparse and a dense matrix give a dense matrix (mathjs parity, #968), not an Array.
    const diff = subtract(sparse2() as never, dense2() as never);
    expect(Array.isArray(diff)).toBe(false);
    expect(m1.isSparseMatrix(diff)).toBe(false);
    expect(rows(diff)).toEqual([
      [1, -1],
      [-1, 2],
    ]);
  });

  it('pinv of a dense matrix of the second copy takes the numeric path', () => {
    const r = pinv(
      m2.DenseMatrix.fromArray([
        [2, 0],
        [0, 4],
      ]) as never
    );
    expect(m1.isDenseMatrix(r)).toBe(true);
    expect(rows(r)).toEqual([
      [0.5, 0],
      [0, 0.25],
    ]);
  });
});
