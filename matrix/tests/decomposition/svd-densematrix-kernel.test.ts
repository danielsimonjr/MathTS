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
import { svd, pinv, lowRankApprox, cond, normFro } from '../../src/operations/svd.js';
import { pinv as pinvDense } from '../../src/operations/pinv.js';
import { qrPivoted } from '../../src/operations/qr-pivoted.js';
import { matrixSchur } from '../../src/operations/schur.js';

/** Properties a kernel may read from a DenseMatrix: raw storage fields, plus the typeof check of the storage guard. */
const ALLOWED_READS = new Set([
  'data',
  'isView',
  'offset',
  'rowStride',
  'rows',
  'cols',
  'toFlatFloat64Array',
]);

/**
 * Run `fn` on a Proxy of `dm`. Every function on the DenseMatrix prototype chain is
 * counted, and every property read on the instance is recorded. A kernel that reads
 * storage directly makes no method call and reads only allowed fields.
 */
function probe<T>(
  dm: DenseMatrix,
  fn: (m: DenseMatrix) => T
): { result: T; methodCalls: string[]; reads: string[] } {
  const methodCalls: string[] = [];
  const reads = new Set<string>();
  const restore: Array<() => void> = [];
  for (let proto = DenseMatrix.prototype as object; proto && proto !== Object.prototype;) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue;
      const desc = Object.getOwnPropertyDescriptor(proto, name);
      const original = desc?.value;
      if (typeof original !== 'function' || !desc?.configurable) continue;
      const host = proto;
      Object.defineProperty(host, name, {
        ...desc,
        value: function (this: unknown, ...args: unknown[]) {
          methodCalls.push(name);
          return original.apply(this, args);
        },
      });
      restore.push(() => Object.defineProperty(host, name, desc));
    }
    proto = Object.getPrototypeOf(proto);
  }
  const proxy = new Proxy(dm, {
    get(target, prop) {
      if (typeof prop === 'string') reads.add(prop);
      return Reflect.get(target, prop, target);
    },
  });
  try {
    const result = fn(proxy);
    return { result, methodCalls, reads: [...reads] };
  } finally {
    for (const r of restore.reverse()) r();
  }
}

/** Assert that a probed run touched storage only, through allowed fields. */
function expectStorageOnly(p: { methodCalls: string[]; reads: string[] }): void {
  expect(p.methodCalls).toEqual([]);
  expect(p.reads.filter((r) => !ALLOWED_READS.has(r))).toEqual([]);
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

    const { result, ...trace } = probe(dm, (m) => svd(m));

    expectStorageOnly(trace);
    expectBitIdentical(result, reference);
  });

  it('wide matrix (m < n): no toArray conversion, result bit-identical', () => {
    const nested = seededNested(5, 9, 11);
    const dm = DenseMatrix.fromArray(nested);
    const reference = svd(nested.map((row) => row.slice()));

    const { result, ...trace } = probe(dm, (m) => svd(m));

    expectStorageOnly(trace);
    expectBitIdentical(result, reference);
  });

  it('row-slice view (offset and rowStride): no conversion, matches its nested values', () => {
    const nested = seededNested(30, 12, 23);
    const big = DenseMatrix.fromArray(nested);
    const view = big.slice({ rowStart: 5, rowEnd: 25 });
    const viewNested = view.toArray();
    const reference = svd(viewNested.map((row) => row.slice()));

    const { result, ...trace } = probe(view, (m) => svd(m));

    expectStorageOnly(trace);
    expectBitIdentical(result, reference);
  });

  it('rank-deficient (jacobi fallback): no conversion, matches nested result', () => {
    const base = seededNested(12, 6, 31);
    const nested = base.concat([base[0].slice(), base[3].slice()]); // 14x6, rank 6 but duplicate rows
    const dm = DenseMatrix.fromArray(nested);
    const reference = svd(nested.map((row) => row.slice()));

    const { result, ...trace } = probe(dm, (m) => svd(m));

    expectStorageOnly(trace);
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

    const { result, ...trace } = probe(dm, (m) => pinv(m));

    expectStorageOnly(trace);
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

    const approx = probe(dm, (m) => lowRankApprox(m, 3));
    const condition = probe(dm, (m) => cond(m));

    expectStorageOnly(approx);
    expect(approx.result).toEqual(refApprox);
    expectStorageOnly(condition);
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

    const p = probe(dm, (m) => pinvDense(m));
    const q = probe(dm, (m) => qrPivoted(m));
    const s = probe(sq, (m) => matrixSchur(m));

    expectStorageOnly(p);
    expect(p.result.toArray()).toEqual(refPinv);
    expectStorageOnly(q);
    expect(q.result.R.toArray()).toEqual(refQr.R.toArray());
    expectStorageOnly(s);
    expect(s.result.T.toArray()).toEqual(refSchur.T.toArray());
  });

  it('normFro(DenseMatrix) and a view: storage only, bit-identical to nested', () => {
    const nested = seededNested(30, 12, 97);
    const dm = DenseMatrix.fromArray(nested);
    const view = dm.slice({ rowStart: 4, rowEnd: 22 });
    const viewNested = view.toArray();

    const full = probe(dm, (m) => normFro(m));
    const part = probe(view, (m) => normFro(m));

    expectStorageOnly(full);
    expectStorageOnly(part);
    expect(full.result).toBe(normFro(nested.map((row) => row.slice())));
    expect(part.result).toBe(normFro(viewNested));
  });

  it('the probe detects a conversion (control)', () => {
    const dm = DenseMatrix.fromArray(seededNested(4, 4, 5));
    const traced = probe(dm, (m) => m.toArray());
    expect(traced.methodCalls).toContain('toArray');
  });

  it('routed functions do not modify a DenseMatrix or its parent storage', () => {
    const nested = seededNested(12, 12, 101);
    const parent = DenseMatrix.fromArray(nested);
    const view = parent.slice({ rowStart: 2, rowEnd: 10 });
    const before = parent.toArray();
    for (const input of [parent, view]) {
      svd(input);
      pinv(input);
      lowRankApprox(input, 2);
      cond(input);
      normFro(input);
      qrPivoted(input);
      pinvDense(input);
    }
    matrixSchur(parent);
    expect(parent.toArray()).toEqual(before);
  });
});
