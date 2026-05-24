import { describe, it, expect } from 'vitest';
import { Tensor, EinsumSpec } from '../src/Tensor';
import { Index, idx } from '../src/named-index';

// ---------------------------------------------------------------------------
// Helper: compare two Tensors element-wise to within a tolerance.
// ---------------------------------------------------------------------------
function expectClose(a: Tensor, b: Tensor, tol = 1e-10): void {
  expect(a.shape).toEqual([...b.shape]);
  for (let i = 0; i < a.data.length; i++) {
    expect(Math.abs(a.data[i] - b.data[i])).toBeLessThan(tol);
  }
}

// ---------------------------------------------------------------------------
// Helper: build a sequential 3×4 tensor (values 0..11).
// ---------------------------------------------------------------------------
function make3x4(labels?: [Index, Index]): Tensor {
  const data = new Float64Array(12);
  for (let i = 0; i < 12; i++) data[i] = i;
  return new Tensor([3, 4], data, labels);
}

function make4x5(labels?: [Index, Index]): Tensor {
  const data = new Float64Array(20);
  for (let i = 0; i < 20; i++) data[i] = i;
  return new Tensor([4, 5], data, labels);
}

// ---------------------------------------------------------------------------
// Contract tests
// ---------------------------------------------------------------------------

describe('Tensor.contract — basic matrix multiplication', () => {
  it('contracts a 3×4 and 4×5 tensor to a 3×5 result', () => {
    const i = idx(3, 'i');
    const j = idx(4, 'j');
    const k = idx(5, 'k');

    const A = make3x4([i, j]);
    const B = make4x5([j, k]);

    const C = A.contract(B);
    expect(C.shape).toEqual([3, 5]);
  });

  it('result matches the equivalent einsum spec', () => {
    const i = idx(3, 'i');
    const j = idx(4, 'j');
    const k = idx(5, 'k');

    const A = make3x4([i, j]);
    const B = make4x5([j, k]);

    const contractResult = A.contract(B);

    // Build the equivalent EinsumSpec: A[i,j] * B[j,k] -> C[i,k]
    const einsumSpec: EinsumSpec = {
      contractions: [
        {
          pair: [
            [0, 1],
            [1, 0],
          ] as const,
        },
      ],
      free: [
        { operand: 0, axis: 0 }, // i
        { operand: 1, axis: 1 }, // k
      ],
    };
    const einsumResult = Tensor.einsum(einsumSpec, A, B);

    expectClose(contractResult, einsumResult);
  });

  it('result axisLabels are the non-shared indices from this then other', () => {
    const i = idx(3, 'i');
    const j = idx(4, 'j');
    const k = idx(5, 'k');

    const A = make3x4([i, j]);
    const B = make4x5([j, k]);

    const C = A.contract(B);
    expect(C.axisLabels).toBeDefined();
    expect(C.axisLabels!.length).toBe(2);
    // First non-shared from A is i, second non-shared from B is k.
    expect(C.axisLabels![0].matches(i)).toBe(true);
    expect(C.axisLabels![1].matches(k)).toBe(true);
  });

  it('contracts a 2×2 matrix with itself (via a shared index)', () => {
    const i = idx(2, 'i');
    const j = idx(2, 'j');

    const data = new Float64Array([1, 2, 3, 4]);
    const A = new Tensor([2, 2], data, [i, j]);
    const B = new Tensor([2, 2], data.slice(), [j, i]);

    const C = A.contract(B);
    // Both j axes are shared → result has [i from A, i from B] — but they are the same Index object!
    // Actually: i is shared between A's second axis and B's second axis if they match.
    // j matches j, i matches i. Both are shared. Result should be scalar (0 free axes = shape []).
    // Wait: A has [i, j], B has [j, i]. j matches j (axis 1 of A, axis 0 of B). i matches i (axis 0 of A, axis 1 of B).
    // Both indices are shared → result is a scalar (trace-like contraction).
    expect(C.shape).toEqual([]);
    // Value should be A_ij * B_ji = trace(A * B^T) = 1*1 + 2*3 + 3*2 + 4*4 = 1 + 6 + 6 + 16 = 29
    // Actually A_ij * B_ji = sum_i sum_j A[i,j]*B[j,i] = A[0,0]*B[0,0] + A[0,1]*B[1,0] + A[1,0]*B[0,1] + A[1,1]*B[1,1]
    //                      = 1*1 + 2*3 + 3*2 + 4*4 = 1 + 6 + 6 + 16 = 29
    expect(C.data[0]).toBeCloseTo(29, 10);
  });
});

describe('Tensor.contract — prime-level distinction', () => {
  it('does NOT contract a tensor with i against a tensor carrying i.prime()', () => {
    const i = idx(3, 'i');
    const j = idx(4, 'j');
    const k = idx(5, 'k');

    const A = make3x4([i, j]);
    const B = make4x5([i.prime(), k]); // B uses i' not i, and j not shared

    // A has [i, j], B has [i', k]. No index matches j or i in B (i' ≠ i, k ≠ j, i' ≠ j).
    expect(() => A.contract(B)).toThrow(/no shared indices/);
  });

  it('i.prime() only contracts with another i.prime()', () => {
    const i = idx(3, 'i');
    const j = idx(4, 'j');
    const k = idx(5, 'k');
    const ip = i.prime();

    const A = make3x4([i, ip]); // A has [i, i']
    const B = make4x5([ip, k]); // B has [i', k]

    // ip in A (axis 1) matches ip in B (axis 0) → shared axis dim=4 matches 4 ✓
    const C = A.contract(B);
    expect(C.shape).toEqual([3, 5]);
    expect(C.axisLabels![0].matches(i)).toBe(true);
    expect(C.axisLabels![1].matches(k)).toBe(true);
  });
});

describe('Tensor.contract — three-tensor chain', () => {
  it('A.contract(B).contract(C) produces the same result as the equivalent einsum', () => {
    const i = idx(2, 'i');
    const j = idx(3, 'j');
    const k = idx(4, 'k');
    const l = idx(5, 'l');

    // A: [i, j] shape [2, 3]
    const dataA = new Float64Array(6);
    for (let x = 0; x < 6; x++) dataA[x] = x + 1;
    const A = new Tensor([2, 3], dataA, [i, j]);

    // B: [j, k] shape [3, 4]
    const dataB = new Float64Array(12);
    for (let x = 0; x < 12; x++) dataB[x] = x + 1;
    const B = new Tensor([3, 4], dataB, [j, k]);

    // C: [k, l] shape [4, 5]
    const dataC = new Float64Array(20);
    for (let x = 0; x < 20; x++) dataC[x] = x + 1;
    const C = new Tensor([4, 5], dataC, [k, l]);

    const chain = A.contract(B).contract(C);
    expect(chain.shape).toEqual([2, 5]);

    // Verify via einsum: A[i,j] * B[j,k] * C[k,l] -> D[i,l]
    const spec1: EinsumSpec = {
      contractions: [
        {
          pair: [
            [0, 1],
            [1, 0],
          ] as const,
        },
      ],
      free: [
        { operand: 0, axis: 0 },
        { operand: 1, axis: 1 },
      ],
    };
    const AB = Tensor.einsum(spec1, A, B); // shape [2, 4]

    const spec2: EinsumSpec = {
      contractions: [
        {
          pair: [
            [0, 1],
            [1, 0],
          ] as const,
        },
      ],
      free: [
        { operand: 0, axis: 0 },
        { operand: 1, axis: 1 },
      ],
    };
    const ABC = Tensor.einsum(spec2, AB, C); // shape [2, 5]

    expectClose(chain, ABC);
  });

  it('three-tensor chain axisLabels propagate correctly', () => {
    const i = idx(2, 'i');
    const j = idx(3, 'j');
    const k = idx(4, 'k');
    const l = idx(5, 'l');

    const dataA = new Float64Array(6);
    for (let x = 0; x < 6; x++) dataA[x] = x + 1;
    const A = new Tensor([2, 3], dataA, [i, j]);

    const dataB = new Float64Array(12);
    for (let x = 0; x < 12; x++) dataB[x] = x + 1;
    const B = new Tensor([3, 4], dataB, [j, k]);

    const dataC = new Float64Array(20);
    for (let x = 0; x < 20; x++) dataC[x] = x + 1;
    const C = new Tensor([4, 5], dataC, [k, l]);

    const result = A.contract(B).contract(C);
    expect(result.axisLabels).toBeDefined();
    expect(result.axisLabels!.length).toBe(2);
    expect(result.axisLabels![0].matches(i)).toBe(true);
    expect(result.axisLabels![1].matches(l)).toBe(true);
  });
});

describe('Tensor.contract — error cases', () => {
  it('throws when this has no axisLabels', () => {
    const j = idx(4, 'j');
    const k = idx(5, 'k');
    const A = make3x4(); // no axisLabels
    const B = make4x5([j, k]);

    expect(() => A.contract(B)).toThrow(/requires axisLabels on both operands/);
  });

  it('throws when other has no axisLabels', () => {
    const i = idx(3, 'i');
    const j = idx(4, 'j');
    const A = make3x4([i, j]);
    const B = make4x5(); // no axisLabels

    expect(() => A.contract(B)).toThrow(/requires axisLabels on both operands/);
  });

  it('throws when neither operand has axisLabels', () => {
    const A = make3x4();
    const B = make4x5();
    expect(() => A.contract(B)).toThrow(/requires axisLabels on both operands/);
  });

  it('throws when there are no shared indices', () => {
    const i = idx(3, 'i');
    const j = idx(4, 'j');
    const k = idx(4, 'k');
    const l = idx(5, 'l');

    const A = make3x4([i, j]); // has i, j
    const B = make4x5([k, l]); // has k, l — no overlap

    expect(() => A.contract(B)).toThrow(/no shared indices/);
  });

  it('throws on dimension mismatch for a shared index', () => {
    const j = idx(4, 'j'); // dim=4

    // A: shape [3, 4] with axis 1 = j
    const i = idx(3, 'i');
    const A = make3x4([i, j]);

    // B: shape [3, 5] with axis 0 = j but dim=3 ≠ 4
    const jWrongDim = new Index(3, { name: 'j' });
    // We need the same id as j to get a match; we'll use replaceIndex trick:
    // Actually, to create a dimension-mismatch we need same id but different dim.
    // Index doesn't expose a way to do that via public API alone.
    // Instead, create B with the SAME j index (so dims match) and manually build
    // a scenario where dims disagree by constructing the tensor with a shape that
    // doesn't match the dim stored in the Index label.
    //
    // The easiest approach: create two Index objects with the same id by using
    // prime/noprime — but that changes primeLevel. Instead, we reflect on the
    // internal mechanism: j's dim=4 but we put it on an axis of size 3.
    // The contract method validates using `this.shape[selfAxis]` vs `other.shape[otherAxis]`,
    // not Index.dim. So we need j to appear at axis positions with different shapes.
    const k = idx(5, 'k');
    // B has shape [3, 5] but axis 0 is labelled j (dim stored as 4 in the Index, but shape[0]=3)
    const dataB = new Float64Array(15);
    const B = new Tensor([3, 5], dataB, [j, k]);
    // A.shape[1] = 4 (axis j), B.shape[0] = 3 (axis j) → mismatch → should throw
    expect(() => A.contract(B)).toThrow(/dimension/);
  });
});

describe('Tensor.contract — replaceIndex and axisOf', () => {
  it('axisOf returns the correct position of an index', () => {
    const i = idx(3, 'i');
    const j = idx(4, 'j');
    const A = make3x4([i, j]);
    expect(A.axisOf(i)).toBe(0);
    expect(A.axisOf(j)).toBe(1);
  });

  it('axisOf throws if the index is not in axisLabels', () => {
    const i = idx(3, 'i');
    const j = idx(4, 'j');
    const k = idx(5, 'k');
    const A = make3x4([i, j]);
    expect(() => A.axisOf(k)).toThrow();
  });

  it('axisOf throws if there are no axisLabels', () => {
    const i = idx(3, 'i');
    const A = make3x4();
    expect(() => A.axisOf(i)).toThrow();
  });

  it('replaceIndex swaps an index and returns a new Tensor', () => {
    const i = idx(3, 'i');
    const j = idx(4, 'j');
    const k = idx(4, 'k'); // same dim as j

    const A = make3x4([i, j]);
    const B = A.replaceIndex(j, k);

    // Original unchanged
    expect(A.axisLabels![1].matches(j)).toBe(true);
    // New tensor has k instead of j
    expect(B.axisLabels![0].matches(i)).toBe(true);
    expect(B.axisLabels![1].matches(k)).toBe(true);
    // Data is same
    expect(B.data).toEqual(A.data);
  });

  it('replaceIndex throws when the old index is not in axisLabels', () => {
    const i = idx(3, 'i');
    const j = idx(4, 'j');
    const k = idx(5, 'k');

    const A = make3x4([i, j]);
    expect(() => A.replaceIndex(k, idx(5, 'l'))).toThrow();
  });

  it('contract works after replaceIndex remapping', () => {
    const i = idx(3, 'i');
    const j = idx(4, 'j');
    const k = idx(5, 'k');
    const jPrime = idx(4, 'jPrime');

    // A: [i, j], B originally [jPrime, k]
    const A = make3x4([i, j]);
    const dataB = new Float64Array(20);
    for (let x = 0; x < 20; x++) dataB[x] = x;
    let B = new Tensor([4, 5], dataB, [jPrime, k]);

    // Replace jPrime with j so they can contract
    B = B.replaceIndex(jPrime, j);
    const C = A.contract(B);
    expect(C.shape).toEqual([3, 5]);
    expect(C.axisLabels![0].matches(i)).toBe(true);
    expect(C.axisLabels![1].matches(k)).toBe(true);
  });
});
