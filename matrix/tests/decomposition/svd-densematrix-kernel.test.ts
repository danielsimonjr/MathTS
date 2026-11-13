/**
 * svd(DenseMatrix) must reach the same kernel as svd(number[][]) without an
 * element-wise DenseMatrix -> nested conversion (issue #932).
 *
 * The conversion is counted by wrapping `DenseMatrix.prototype.toArray`, the
 * method that performed it. The wrapper is a plain monkeypatch, so the test runs
 * under both `bun test` and vitest.
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { svd, pinv, lowRankApprox, cond } from '../../src/operations/svd.js';
import { pinv as pinvDense } from '../../src/operations/pinv.js';
import { qrPivoted } from '../../src/operations/qr-pivoted.js';
import { matrixSchur } from '../../src/operations/schur.js';

type ToArrayHost = { toArray: () => number[][] };

/** Run `fn` and count how many times `DenseMatrix.prototype.toArray` was called. */
function countToArrayCalls<T>(fn: () => T): { result: T; calls: number } {
  const proto = DenseMatrix.prototype as unknown as ToArrayHost;
  const original = proto.toArray;
  let calls = 0;
  proto.toArray = function (this: DenseMatrix): number[][] {
    calls++;
    return original.call(this);
  };
  try {
    return { result: fn(), calls };
  } finally {
    proto.toArray = original;
  }
}

/** Deterministic pseudo-random matrix (LCG), so every run uses the same values. */
function seededNested(m: number, n: number, seed: number): number[][] {
  let state = seed >>> 0;
  const next = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296 - 0.5;
  };
  const A: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) row.push(next());
    A.push(row);
  }
  return A;
}

function expectBitIdentical(
  actual: { U: number[][]; S: number[]; V: number[][]; rank: number },
  expected: { U: number[][]; S: number[]; V: number[][]; rank: number }
): void {
  expect(actual.rank).toBe(expected.rank);
  expect(actual.S).toEqual(expected.S);
  expect(actual.U).toEqual(expected.U);
  expect(actual.V).toEqual(expected.V);
}

describe('svd(DenseMatrix) kernel path (#932)', () => {
  it('square full-rank: no toArray conversion, result bit-identical to nested input', () => {
    const nested = seededNested(40, 40, 7);
    const dm = DenseMatrix.fromArray(nested);
    const reference = svd(nested.map((row) => row.slice()));

    const { result, calls } = countToArrayCalls(() => svd(dm));

    expect(calls).toBe(0);
    expectBitIdentical(result, reference);
  });

  it('wide matrix (m < n): no toArray conversion, result bit-identical', () => {
    const nested = seededNested(5, 9, 11);
    const dm = DenseMatrix.fromArray(nested);
    const reference = svd(nested.map((row) => row.slice()));

    const { result, calls } = countToArrayCalls(() => svd(dm));

    expect(calls).toBe(0);
    expectBitIdentical(result, reference);
  });

  it('row-slice view (offset and rowStride): no conversion, matches its nested values', () => {
    const nested = seededNested(30, 12, 23);
    const big = DenseMatrix.fromArray(nested);
    const view = big.slice({ rowStart: 5, rowEnd: 25 });
    const viewNested = view.toArray();
    const reference = svd(viewNested.map((row) => row.slice()));

    const { result, calls } = countToArrayCalls(() => svd(view));

    expect(calls).toBe(0);
    expectBitIdentical(result, reference);
  });

  it('rank-deficient (jacobi fallback): no conversion, matches nested result', () => {
    const base = seededNested(12, 6, 31);
    const nested = base.concat([base[0].slice(), base[3].slice()]); // 14x6, rank 6 but duplicate rows
    const dm = DenseMatrix.fromArray(nested);
    const reference = svd(nested.map((row) => row.slice()));

    const { result, calls } = countToArrayCalls(() => svd(dm));

    expect(calls).toBe(0);
    expectBitIdentical(result, reference);
  });

  it('does not modify the caller input (DenseMatrix or nested)', () => {
    const nested = seededNested(20, 20, 41);
    const snapshot = nested.map((row) => row.slice());
    svd(nested);
    expect(nested).toEqual(snapshot);

    const dm = DenseMatrix.fromArray(nested);
    const before = dm.toArray();
    svd(dm);
    expect(dm.toArray()).toEqual(before);
  });

  it('sibling pinv(DenseMatrix): no conversion', () => {
    const nested = seededNested(16, 10, 53);
    const dm = DenseMatrix.fromArray(nested);
    const reference = pinv(nested.map((row) => row.slice()));

    const { result, calls } = countToArrayCalls(() => pinv(dm));

    expect(calls).toBe(0);
    expect(result).toEqual(reference);
  });

  it('sibling lowRankApprox(DenseMatrix) and cond(DenseMatrix): no conversion', () => {
    const nested = seededNested(14, 9, 67);
    const dm = DenseMatrix.fromArray(nested);
    const refApprox = lowRankApprox(
      nested.map((row) => row.slice()),
      3
    );
    const refCond = cond(nested.map((row) => row.slice()));

    const approx = countToArrayCalls(() => lowRankApprox(dm, 3));
    const condition = countToArrayCalls(() => cond(dm));

    expect(approx.calls).toBe(0);
    expect(approx.result).toEqual(refApprox);
    expect(condition.calls).toBe(0);
    expect(condition.result).toBe(refCond);
  });

  it('sibling DenseMatrix pinv primitive, qrPivoted and matrixSchur: no conversion', () => {
    const nested = seededNested(12, 8, 79);
    const dm = DenseMatrix.fromArray(nested);
    const refPinv = pinvDense(DenseMatrix.fromArray(nested)).toArray();
    const refQr = qrPivoted(nested.map((row) => row.slice()));
    const square = seededNested(9, 9, 89);
    const refSchur = matrixSchur(square.map((row) => row.slice()));
    const sq = DenseMatrix.fromArray(square);

    const p = countToArrayCalls(() => pinvDense(dm));
    const q = countToArrayCalls(() => qrPivoted(dm));
    const s = countToArrayCalls(() => matrixSchur(sq));

    expect(p.calls).toBe(0);
    expect(p.result.toArray()).toEqual(refPinv);
    expect(q.calls).toBe(0);
    expect(q.result.R.toArray()).toEqual(refQr.R.toArray());
    expect(s.calls).toBe(0);
    expect(s.result.T.toArray()).toEqual(refSchur.T.toArray());
  });
});
