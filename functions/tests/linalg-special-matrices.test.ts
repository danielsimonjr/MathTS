import { describe, it, expect } from 'vitest';
import {
  hilbertMatrix,
  invHilbertMatrix,
  hadamardMatrix,
  pascalMatrix,
  dftMatrix,
  hankelMatrix,
  blockDiag,
  khatriRao,
  fiedlerMatrix,
  leslieMatrix,
  helmertMatrix,
} from '../src/linalg-special-matrices.js';

const det = (M: number[][]): number => {
  const A = M.map((r) => r.slice());
  const n = A.length;
  let d = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (A[p][c] === 0) return 0;
    if (p !== c) {
      [A[p], A[c]] = [A[c], A[p]];
      d = -d;
    }
    d *= A[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
    }
  }
  return d;
};

describe('linalg-special-matrices', () => {
  it('invHilbertMatrix(3) is the exact integer inverse', () => {
    expect(invHilbertMatrix(3)).toEqual([
      [9, -36, 30],
      [-36, 192, -180],
      [30, -180, 180],
    ]);
  });

  it('hilbertMatrix(3)[2][2] = 0.2 and H * invH = I', () => {
    const H = hilbertMatrix(3);
    expect(H[2][2]).toBeCloseTo(0.2, 12);
    const Hi = invHilbertMatrix(3);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        let s = 0;
        for (let k = 0; k < 3; k++) s += H[i][k] * Hi[k][j];
        expect(s).toBeCloseTo(i === j ? 1 : 0, 9);
      }
  });

  it('hadamardMatrix(4) matches the Sylvester construction and H H^T = 4I', () => {
    const H = hadamardMatrix(4);
    expect(H).toEqual([
      [1, 1, 1, 1],
      [1, -1, 1, -1],
      [1, 1, -1, -1],
      [1, -1, -1, 1],
    ]);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += H[i][k] * H[j][k];
        expect(s).toBe(i === j ? 4 : 0);
      }
  });

  it('hadamardMatrix throws RangeError when n is not a power of 2', () => {
    expect(() => hadamardMatrix(3)).toThrow(RangeError);
    expect(() => hadamardMatrix(0)).toThrow(RangeError);
  });

  it('pascalMatrix(4) and its determinant', () => {
    const P = pascalMatrix(4);
    expect(P).toEqual([
      [1, 1, 1, 1],
      [1, 2, 3, 4],
      [1, 3, 6, 10],
      [1, 4, 10, 20],
    ]);
    expect(det(P)).toBeCloseTo(1, 9);
  });

  it('pascalMatrix lower/upper kinds', () => {
    expect(pascalMatrix(3, 'lower')).toEqual([
      [1, 0, 0],
      [1, 1, 0],
      [1, 2, 1],
    ]);
    expect(pascalMatrix(3, 'upper')).toEqual([
      [1, 1, 1],
      [0, 1, 2],
      [0, 0, 1],
    ]);
  });

  it('dftMatrix(4)[1] = [1, -i, -1, i]', () => {
    const row = dftMatrix(4)[1];
    const expected = [
      [1, 0],
      [0, -1],
      [-1, 0],
      [0, 1],
    ];
    row.forEach((z, k) => {
      expect(z.re).toBeCloseTo(expected[k][0], 12);
      expect(z.im).toBeCloseTo(expected[k][1], 12);
    });
  });

  it('dftMatrix scale option', () => {
    const z = dftMatrix(4, { scale: 'sqrtn' })[0][0];
    expect(z.re).toBeCloseTo(0.5, 12);
    expect(dftMatrix(4, { scale: 'n' })[1][1].re).toBeCloseTo(0, 12);
  });

  it('hankelMatrix([1,2,3])', () => {
    expect(hankelMatrix([1, 2, 3])).toEqual([
      [1, 2, 3],
      [2, 3, 0],
      [3, 0, 0],
    ]);
  });

  it('hankelMatrix with a last row r', () => {
    expect(hankelMatrix([1, 2, 3], [3, 4, 5])).toEqual([
      [1, 2, 3],
      [2, 3, 4],
      [3, 4, 5],
    ]);
  });

  it('blockDiag([[1]],[[2,3],[4,5]])', () => {
    expect(
      blockDiag(
        [[1]],
        [
          [2, 3],
          [4, 5],
        ]
      )
    ).toEqual([
      [1, 0, 0],
      [0, 2, 3],
      [0, 4, 5],
    ]);
  });

  it('khatriRao([[1,2],[3,4]],[[5,6],[7,8]])', () => {
    expect(
      khatriRao(
        [
          [1, 2],
          [3, 4],
        ],
        [
          [5, 6],
          [7, 8],
        ]
      )
    ).toEqual([
      [5, 12],
      [7, 16],
      [15, 24],
      [21, 32],
    ]);
  });

  it('fiedlerMatrix([0,1,3])', () => {
    expect(fiedlerMatrix([0, 1, 3])).toEqual([
      [0, 1, 3],
      [1, 0, 2],
      [3, 2, 0],
    ]);
  });

  it('leslieMatrix([0.1,2,1],[0.5,0.8])', () => {
    expect(leslieMatrix([0.1, 2, 1], [0.5, 0.8])).toEqual([
      [0.1, 2, 1],
      [0.5, 0, 0],
      [0, 0.8, 0],
    ]);
    expect(() => leslieMatrix([1, 2], [0.5, 0.5])).toThrow(RangeError);
  });

  it('helmertMatrix rows are orthonormal', () => {
    const Hf = helmertMatrix(4, true);
    expect(Hf.length).toBe(4);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += Hf[i][k] * Hf[j][k];
        expect(s).toBeCloseTo(i === j ? 1 : 0, 12);
      }
    const H = helmertMatrix(4);
    expect(H.length).toBe(3);
    expect(H[0][0]).toBeCloseTo(1 / Math.SQRT2, 12);
    expect(H[0][1]).toBeCloseTo(-1 / Math.SQRT2, 12);
  });
});
