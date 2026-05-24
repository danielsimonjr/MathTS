/**
 * Tests for Tensor reduction methods: sum, mean, max, min, prod, norm.
 *
 * NaN propagation note: max and min use the same NaN-propagation behaviour as
 * NumPy's default — if any element in the reduction window is NaN the result
 * is NaN. This is tested explicitly below.
 */
import { describe, it, expect } from 'vitest';
import { Tensor } from '../src/Tensor';
import { idx } from '../src/named-index';

// Tolerance for floating-point comparisons.
const EPS = 1e-12;

function close(a: number, b: number, eps = EPS): boolean {
  return Math.abs(a - b) <= eps;
}

// ---------------------------------------------------------------------------
// Helper: extract the single value from a rank-0 tensor.
// ---------------------------------------------------------------------------
function scalar(t: Tensor): number {
  if (t.shape.length !== 0) throw new Error(`Expected rank-0, got rank-${t.shape.length}`);
  return t.data[0];
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

// 2×3 matrix:
//   [[1, 2, 3],
//    [4, 5, 6]]
const M23 = Tensor.fromNested(
  [
    [1, 2, 3],
    [4, 5, 6],
  ],
  [2, 3]
);

// 2×2 matrix with negatives:
//   [[-1, 2],
//    [ 3,-4]]
const MNeg = Tensor.fromNested(
  [
    [-1, 2],
    [3, -4],
  ],
  [2, 2]
);

// 2×3 matrix with a NaN:
const MNaN = Tensor.fromNested(
  [
    [1, NaN, 3],
    [4, 5, 6],
  ],
  [2, 3]
);

// rank-3 tensor, shape [2, 3, 4] — values are consecutive integers 1..24
const T234 = (() => {
  const data = new Float64Array(24);
  for (let i = 0; i < 24; i++) data[i] = i + 1;
  return new Tensor([2, 3, 4], data);
})();

// ---------------------------------------------------------------------------
// sum
// ---------------------------------------------------------------------------

describe('Tensor.sum', () => {
  it('reduces all axes → rank-0 scalar', () => {
    // 1+2+3+4+5+6 = 21
    expect(scalar(M23.sum())).toBe(21);
    expect(M23.sum().shape).toEqual([]);
  });

  it('reduces a single axis (axis=0)', () => {
    // sum along rows: [1+4, 2+5, 3+6] = [5, 7, 9]
    const r = M23.sum(0);
    expect(r.shape).toEqual([3]);
    expect(r.toNested()).toEqual([5, 7, 9]);
  });

  it('reduces a single axis (axis=1)', () => {
    // sum along cols: [1+2+3, 4+5+6] = [6, 15]
    const r = M23.sum(1);
    expect(r.shape).toEqual([2]);
    expect(r.toNested()).toEqual([6, 15]);
  });

  it('reduces two axes of a rank-3 tensor', () => {
    // T234 shape [2,3,4]; reduce axes [0,2]
    // result shape [3]; for each j: sum over i in [0,1], k in [0..3]
    // element at (i,j,k) = 1 + i*12 + j*4 + k
    // row j sum = sum_{i=0}^{1} sum_{k=0}^{3} (1 + i*12 + j*4 + k)
    //           = sum_{i=0}^{1} [4 + i*48 + j*16 + 6]  (sum_k of 1,k,j*4,i*12)
    // Easier: just hand-compute:
    //   j=0: elements at (0,0,*) = 1,2,3,4  sum=10; at (1,0,*) = 13,14,15,16 sum=58 → 68
    //   j=1: (0,1,*) = 5,6,7,8 sum=26; (1,1,*) = 17,18,19,20 sum=74 → 100
    //   j=2: (0,2,*) = 9,10,11,12 sum=42; (1,2,*) = 21,22,23,24 sum=90 → 132
    const r = T234.sum([0, 2]);
    expect(r.shape).toEqual([3]);
    expect(r.toNested()).toEqual([68, 100, 132]);
  });

  it('keepDims=true preserves axes as length-1', () => {
    const r = M23.sum(0, { keepDims: true });
    expect(r.shape).toEqual([1, 3]);
    expect(r.toNested()).toEqual([[5, 7, 9]]);
  });

  it('keepDims=true on all-axes reduction gives shape of all-1s', () => {
    const r = M23.sum(undefined, { keepDims: true });
    expect(r.shape).toEqual([1, 1]);
    expect(scalar(r.reshape([]))).toBe(21);
  });
});

// ---------------------------------------------------------------------------
// mean
// ---------------------------------------------------------------------------

describe('Tensor.mean', () => {
  it('reduces all axes → rank-0 scalar mean', () => {
    // mean of 1..6 = 3.5
    expect(scalar(M23.mean())).toBe(3.5);
  });

  it('mean along axis=0 matches hand computation', () => {
    // mean along rows: [(1+4)/2, (2+5)/2, (3+6)/2] = [2.5, 3.5, 4.5]
    const r = M23.mean(0);
    expect(r.shape).toEqual([3]);
    const nested = r.toNested() as number[];
    expect(close(nested[0], 2.5)).toBe(true);
    expect(close(nested[1], 3.5)).toBe(true);
    expect(close(nested[2], 4.5)).toBe(true);
  });

  it('mean along axis=1 matches hand computation', () => {
    // mean along cols: [(1+2+3)/3, (4+5+6)/3] = [2, 5]
    const r = M23.mean(1);
    expect(r.shape).toEqual([2]);
    const nested = r.toNested() as number[];
    expect(close(nested[0], 2.0)).toBe(true);
    expect(close(nested[1], 5.0)).toBe(true);
  });

  it('mean keepDims=true preserves rank', () => {
    const r = M23.mean(1, { keepDims: true });
    expect(r.shape).toEqual([2, 1]);
    const nested = r.toNested() as number[][];
    expect(close(nested[0][0], 2.0)).toBe(true);
    expect(close(nested[1][0], 5.0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// max
// ---------------------------------------------------------------------------

describe('Tensor.max', () => {
  it('reduces all axes → global maximum', () => {
    expect(scalar(M23.max())).toBe(6);
  });

  it('max along axis=0', () => {
    // max along rows: [max(1,4), max(2,5), max(3,6)] = [4, 5, 6]
    expect(M23.max(0).toNested()).toEqual([4, 5, 6]);
  });

  it('max along axis=1', () => {
    // max along cols: [max(1,2,3), max(4,5,6)] = [3, 6]
    expect(M23.max(1).toNested()).toEqual([3, 6]);
  });

  it('max with negative numbers', () => {
    // [[-1, 2], [3, -4]] → global max = 3
    expect(scalar(MNeg.max())).toBe(3);
    // max along axis=0: [max(-1,3), max(2,-4)] = [3, 2]
    expect(MNeg.max(0).toNested()).toEqual([3, 2]);
  });

  it('max NaN propagates (matches NumPy default)', () => {
    // column 1 has a NaN — max along axis=0 should propagate NaN for that column
    const r = MNaN.max(0);
    const nested = r.toNested() as number[];
    expect(nested[0]).toBe(4);
    expect(isNaN(nested[1])).toBe(true);
    expect(nested[2]).toBe(6);
  });

  it('max keepDims=true', () => {
    const r = M23.max(0, { keepDims: true });
    expect(r.shape).toEqual([1, 3]);
    expect(r.toNested()).toEqual([[4, 5, 6]]);
  });
});

// ---------------------------------------------------------------------------
// min
// ---------------------------------------------------------------------------

describe('Tensor.min', () => {
  it('reduces all axes → global minimum', () => {
    expect(scalar(M23.min())).toBe(1);
  });

  it('min along axis=0', () => {
    // min along rows: [min(1,4), min(2,5), min(3,6)] = [1, 2, 3]
    expect(M23.min(0).toNested()).toEqual([1, 2, 3]);
  });

  it('min with negative numbers', () => {
    // global min of [[-1,2],[3,-4]] = -4
    expect(scalar(MNeg.min())).toBe(-4);
  });

  it('min NaN propagates', () => {
    // column 1 has a NaN — min along axis=1 for row 0 should be NaN
    const r = MNaN.min(1);
    const nested = r.toNested() as number[];
    expect(isNaN(nested[0])).toBe(true);
    expect(nested[1]).toBe(4);
  });

  it('min keepDims=true', () => {
    const r = M23.min(1, { keepDims: true });
    expect(r.shape).toEqual([2, 1]);
    expect(r.toNested()).toEqual([[1], [4]]);
  });
});

// ---------------------------------------------------------------------------
// prod
// ---------------------------------------------------------------------------

describe('Tensor.prod', () => {
  it('reduces all axes → global product', () => {
    // 1*2*3*4*5*6 = 720
    expect(scalar(M23.prod())).toBe(720);
  });

  it('prod along axis=0', () => {
    // prod along rows: [1*4, 2*5, 3*6] = [4, 10, 18]
    expect(M23.prod(0).toNested()).toEqual([4, 10, 18]);
  });

  it('prod along axis=1', () => {
    // prod along cols: [1*2*3, 4*5*6] = [6, 120]
    expect(M23.prod(1).toNested()).toEqual([6, 120]);
  });

  it('prod keepDims=true', () => {
    const r = M23.prod(0, { keepDims: true });
    expect(r.shape).toEqual([1, 3]);
    expect(r.toNested()).toEqual([[4, 10, 18]]);
  });

  it('prod two-axis reduction', () => {
    // reduce axes [0,1] of M23: prod of all 6 elements = 720 → rank-1 tensor of shape [3]? No.
    // axes [0,1] means we reduce both axis 0 and axis 1 → all elements → rank-0
    // Wait, M23 shape [2,3]; axes [0,1] reduces both → outShape = [] → scalar = 720
    const r = M23.prod([0, 1]);
    expect(r.shape).toEqual([]);
    expect(scalar(r)).toBe(720);
  });
});

// ---------------------------------------------------------------------------
// norm
// ---------------------------------------------------------------------------

describe('Tensor.norm', () => {
  // Use a simple 2×2 matrix: [[3, 4], [0, 0]]
  // p=2 (Frobenius): sqrt(9+16+0+0) = 5
  // p=1: sum |x| = 7
  // p=inf: max|x| = 4
  // p=fro: sqrt(9+16) = 5
  const M = Tensor.fromNested(
    [
      [3, 4],
      [0, 0],
    ],
    [2, 2]
  );

  it('p=2 (default) is the Frobenius / Euclidean norm', () => {
    const n = scalar(M.norm());
    expect(close(n, 5.0)).toBe(true);
  });

  it("p='fro' is equivalent to p=2 on rank-2", () => {
    const n = scalar(M.norm({ p: 'fro' }));
    expect(close(n, 5.0)).toBe(true);
  });

  it('p=1 is the sum of absolute values', () => {
    // |3|+|4|+|0|+|0| = 7
    const n = scalar(M.norm({ p: 1 }));
    expect(close(n, 7.0)).toBe(true);
  });

  it("p='inf' is the max absolute value", () => {
    const n = scalar(M.norm({ p: 'inf' }));
    expect(n).toBe(4);
  });

  it("p='-inf' is the min absolute value", () => {
    // min(|3|,|4|,|0|,|0|) = 0
    const n = scalar(M.norm({ p: '-inf' }));
    expect(n).toBe(0);
  });

  it('p=1 on a vector with negatives matches closed form', () => {
    // [-3, 4] → sum of abs = 7
    const v = Tensor.fromNested([-3, 4], [2]);
    expect(close(scalar(v.norm({ p: 1 })), 7.0)).toBe(true);
  });

  it('p=2 on a vector matches Euclidean length', () => {
    // [3, 4] → 5
    const v = Tensor.fromNested([3, 4], [2]);
    expect(close(scalar(v.norm({ p: 2 })), 5.0)).toBe(true);
  });

  it('norm along axis returns a reduced tensor', () => {
    // [[3,4],[0,0]] norm along axis=1: [sqrt(9+16), sqrt(0+0)] = [5, 0]
    const r = M.norm({ axis: 1 });
    expect(r.shape).toEqual([2]);
    const nested = r.toNested() as number[];
    expect(close(nested[0], 5.0)).toBe(true);
    expect(close(nested[1], 0.0)).toBe(true);
  });

  it('norm keepDims=true along axis', () => {
    const r = M.norm({ axis: 1, keepDims: true });
    expect(r.shape).toEqual([2, 1]);
  });
});

// ---------------------------------------------------------------------------
// axisLabels propagation
// ---------------------------------------------------------------------------

describe('Tensor reduction — axisLabels propagation', () => {
  it('sum drops the reduced axis label', () => {
    const iIdx = idx(2, 'i');
    const jIdx = idx(3, 'j');
    const kIdx = idx(4, 'k');
    const t = new Tensor([2, 3, 4], T234.data.slice(), [iIdx, jIdx, kIdx]);

    // Reduce axis 1 (j).
    const r = t.sum(1);
    expect(r.shape).toEqual([2, 4]);
    // Surviving labels: i (axis 0) and k (axis 2).
    expect(r.axisLabels).toBeDefined();
    expect(r.axisLabels!.length).toBe(2);
    expect(r.axisLabels![0].matches(iIdx)).toBe(true);
    expect(r.axisLabels![1].matches(kIdx)).toBe(true);
  });

  it('keepDims=true does not propagate axisLabels', () => {
    const iIdx = idx(2, 'i');
    const jIdx = idx(3, 'j');
    const t = new Tensor([2, 3], M23.data.slice(), [iIdx, jIdx]);

    const r = t.sum(0, { keepDims: true });
    expect(r.shape).toEqual([1, 3]);
    // With keepDims, label count wouldn't match the new shape (which has
    // a dim-1 placeholder), so axisLabels is dropped.
    expect(r.axisLabels).toBeUndefined();
  });

  it('reducing to rank-0 with labels yields empty axisLabels', () => {
    const iIdx = idx(2, 'i');
    const jIdx = idx(3, 'j');
    const t = new Tensor([2, 3], M23.data.slice(), [iIdx, jIdx]);

    const r = t.sum();
    expect(r.shape).toEqual([]);
    // All axes are reduced, surviving = [] which matches outShape.length = 0.
    expect(r.axisLabels).toBeDefined();
    expect(r.axisLabels!.length).toBe(0);
  });

  it('sum of rank-3 with two-axis reduction preserves one label', () => {
    const iIdx = idx(2, 'i');
    const jIdx = idx(3, 'j');
    const kIdx = idx(4, 'k');
    const t = new Tensor([2, 3, 4], T234.data.slice(), [iIdx, jIdx, kIdx]);

    // Reduce axes 0 and 2 (i and k); surviving = j
    const r = t.sum([0, 2]);
    expect(r.shape).toEqual([3]);
    expect(r.axisLabels).toBeDefined();
    expect(r.axisLabels!.length).toBe(1);
    expect(r.axisLabels![0].matches(jIdx)).toBe(true);
  });
});
