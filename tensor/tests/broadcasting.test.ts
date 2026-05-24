/**
 * Tests for NumPy-style broadcasting in Tensor.add / sub / mul.
 *
 * Broadcasting rules (NumPy-compatible):
 *  1. Right-align the two shapes by axis.
 *  2. A dimension of 1 broadcasts against any other dimension.
 *  3. Missing leading axes are treated as length-1.
 *  4. Shapes that have a non-1 dimension mismatch are incompatible.
 */
import { describe, it, expect } from 'vitest';
import { Tensor } from '../src/Tensor';

// ---------------------------------------------------------------------------
// broadcastShape utility (static)
// ---------------------------------------------------------------------------

describe('Tensor.broadcastShape', () => {
  it('same shape → same shape', () => {
    expect(Tensor.broadcastShape([2, 3], [2, 3])).toEqual([2, 3]);
  });

  it('scalar (empty) with any shape → that shape', () => {
    expect(Tensor.broadcastShape([], [4, 5])).toEqual([4, 5]);
    expect(Tensor.broadcastShape([4, 5], [])).toEqual([4, 5]);
  });

  it('rank-1 (3,) with rank-2 (2,3) → (2,3)', () => {
    expect(Tensor.broadcastShape([3], [2, 3])).toEqual([2, 3]);
  });

  it('(2,1) with (1,3) → (2,3)', () => {
    expect(Tensor.broadcastShape([2, 1], [1, 3])).toEqual([2, 3]);
  });

  it('(4,1,5) with (3,5) → (4,3,5)', () => {
    expect(Tensor.broadcastShape([4, 1, 5], [3, 5])).toEqual([4, 3, 5]);
  });

  it('incompatible shapes throw with both shapes in the message', () => {
    expect(() => Tensor.broadcastShape([2, 3], [2, 4])).toThrow(/2,3/);
    expect(() => Tensor.broadcastShape([2, 3], [2, 4])).toThrow(/2,4/);
  });
});

// ---------------------------------------------------------------------------
// Scalar (number) broadcasting
// ---------------------------------------------------------------------------

describe('Tensor.add/sub/mul — scalar operand', () => {
  const M = Tensor.fromNested(
    [
      [1, 2],
      [3, 4],
    ],
    [2, 2]
  );

  it('add(number) broadcasts the scalar', () => {
    const r = M.add(10);
    expect(r.shape).toEqual([2, 2]);
    expect(r.toNested()).toEqual([
      [11, 12],
      [13, 14],
    ]);
  });

  it('sub(number) broadcasts the scalar', () => {
    const r = M.sub(1);
    expect(r.toNested()).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('mul(number) broadcasts the scalar', () => {
    const r = M.mul(3);
    expect(r.toNested()).toEqual([
      [3, 6],
      [9, 12],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Tensor broadcasting
// ---------------------------------------------------------------------------

describe('Tensor.add — NumPy-style tensor broadcasting', () => {
  it('same-shape (2,3,4) fast path still works', () => {
    const data = new Float64Array(24);
    for (let i = 0; i < 24; i++) data[i] = i + 1;
    const A = new Tensor([2, 3, 4], data);
    const B = new Tensor([2, 3, 4], data.slice());
    const r = A.add(B);
    expect(r.shape).toEqual([2, 3, 4]);
    // each element should be 2*(i+1)
    for (let i = 0; i < 24; i++) {
      expect(r.data[i]).toBe(2 * (i + 1));
    }
  });

  it('rank-1 (3,) + rank-2 (2,3) → rank-2 (2,3)', () => {
    // v broadcasts as row vector across all rows of M
    const v = Tensor.fromNested([1, 2, 3], [3]);
    const M = Tensor.fromNested(
      [
        [10, 20, 30],
        [40, 50, 60],
      ],
      [2, 3]
    );
    const r = M.add(v);
    expect(r.shape).toEqual([2, 3]);
    expect(r.toNested()).toEqual([
      [11, 22, 33],
      [41, 52, 63],
    ]);
  });

  it('rank-2 (2,1) + rank-2 (1,3) → rank-2 (2,3)', () => {
    const col = Tensor.fromNested([[10], [20]], [2, 1]);
    const row = Tensor.fromNested([[1, 2, 3]], [1, 3]);
    const r = col.add(row);
    expect(r.shape).toEqual([2, 3]);
    expect(r.toNested()).toEqual([
      [11, 12, 13],
      [21, 22, 23],
    ]);
  });

  it('rank-3 (4,1,5) + rank-2 (3,5) → rank-3 (4,3,5)', () => {
    // Build tensors with simple values and verify shape + one element.
    const aData = new Float64Array(4 * 1 * 5);
    for (let i = 0; i < aData.length; i++) aData[i] = i + 1; // 1..20
    const A = new Tensor([4, 1, 5], aData);

    const bData = new Float64Array(3 * 5);
    for (let i = 0; i < bData.length; i++) bData[i] = (i + 1) * 10; // 10,20,...,150
    const B = new Tensor([3, 5], bData);

    const r = A.add(B);
    expect(r.shape).toEqual([4, 3, 5]);

    // Check element (0, 0, 0):
    // A broadcast index: i=0, j=0 (broadcast to 0), k=0 → A[0,0,0] = aData[0] = 1
    // B broadcast index: j=0, k=0 → B[0,0] = bData[0] = 10
    expect(r.data[0]).toBe(11);

    // Check element (0, 1, 2):
    // A[0,0,2] = aData[2] = 3
    // B[1,2] = bData[1*5+2] = bData[7] = 80
    // output flat index: (0*3+1)*5+2 = 7
    expect(r.data[7]).toBe(3 + 80);
  });

  it('rank-1 broadcasting with sub', () => {
    const v = Tensor.fromNested([1, 2, 3], [3]);
    const M = Tensor.fromNested(
      [
        [10, 20, 30],
        [40, 50, 60],
      ],
      [2, 3]
    );
    const r = M.sub(v);
    expect(r.shape).toEqual([2, 3]);
    expect(r.toNested()).toEqual([
      [9, 18, 27],
      [39, 48, 57],
    ]);
  });

  it('rank-1 broadcasting with mul', () => {
    const v = Tensor.fromNested([1, 2, 3], [3]);
    const M = Tensor.fromNested(
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      [2, 3]
    );
    const r = M.mul(v);
    expect(r.shape).toEqual([2, 3]);
    expect(r.toNested()).toEqual([
      [1, 4, 9],
      [4, 10, 18],
    ]);
  });

  it('(2,3) + (3,) commutes correctly (B.add(A))', () => {
    const v = Tensor.fromNested([1, 2, 3], [3]);
    const M = Tensor.fromNested(
      [
        [10, 20, 30],
        [40, 50, 60],
      ],
      [2, 3]
    );
    // v.add(M): shape [3] + shape [2,3] → [2,3]
    const r = v.add(M);
    expect(r.shape).toEqual([2, 3]);
    expect(r.toNested()).toEqual([
      [11, 22, 33],
      [41, 52, 63],
    ]);
  });

  it('incompatible shapes throw with a clear message including both shapes', () => {
    const a = Tensor.fromNested([1, 2, 3], [3]);
    const b = Tensor.fromNested([1, 2, 3, 4], [4]);
    expect(() => a.add(b)).toThrow(/cannot be broadcast/);
    // Both shapes must appear in the error message.
    try {
      a.add(b);
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toMatch(/3/);
      expect(msg).toMatch(/4/);
    }
  });

  it('(2,3) + (4,3) throws — first axis is incompatible', () => {
    const A = Tensor.fromNested(
      [
        [1, 2, 3],
        [4, 5, 6],
      ],
      [2, 3]
    );
    const B = new Tensor([4, 3], new Float64Array(12));
    expect(() => A.add(B)).toThrow(/cannot be broadcast/);
  });
});
