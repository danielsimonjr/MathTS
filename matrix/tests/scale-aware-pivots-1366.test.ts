import { beforeAll, describe, expect, it } from 'vitest';
import { DenseMatrix, matrixLogm, matrixSqrtm } from '../src/index.js';
import { WASMBackend } from '../src/backends/WASMBackend.js';
import { gaussJordanSolve } from '../src/operations/common.js';

const as = new WASMBackend();
const js = new WASMBackend();

beforeAll(async () => {
  await as.initialize();
  expect((as as unknown as { wasmModule: unknown }).wasmModule).toBeTruthy();
});

describe('scale-aware matrix operations (#1366)', () => {
  it('solves systems with small but independent pivots', () => {
    expect(
      gaussJordanSolve(
        [
          [1, 0],
          [0, 1e-100],
        ],
        [[2], [3e-100]]
      )
    ).toEqual([[2], [3]]);
    expect(gaussJordanSolve([[0]], [[1]])).toBeNull();
  });

  it.each([1, 1e-140, 1e140])('keeps the sqrt of a scalar multiple accurate at %s', (s) => {
    const root = matrixSqrtm([
      [2 * s, s],
      [s, 2 * s],
    ]).toArray();
    expect(root[0][0] / Math.sqrt(s)).toBeCloseTo((Math.sqrt(3) + 1) / 2, 12);
    expect(root[0][1] / Math.sqrt(s)).toBeCloseTo((Math.sqrt(3) - 1) / 2, 12);
  });

  it('accepts a small positive eigenvalue supported by the Schur backward error', () => {
    const a = 1e-11;
    // Q diag(a, 3) Q^T with orthonormal columns (0.6, 0.8) and (-0.8, 0.6).
    const base = [
      [0.36 * a + 0.64 * 3, 0.48 * (a - 3)],
      [0.48 * (a - 3), 0.64 * a + 0.36 * 3],
    ];
    for (const s of [1, 1e-5, 1e-80]) {
      const result = matrixLogm(base.map((row) => row.map((x) => s * x))).toArray();
      const small = Math.log(s * a);
      const large = Math.log(s * 3);
      expect(result[0][0]).toBeCloseTo(0.36 * small + 0.64 * large, 4);
      expect(result[0][1]).toBeCloseTo(0.48 * (small - large), 4);
      expect(result[1][1]).toBeCloseTo(0.64 * small + 0.36 * large, 4);
    }
  });

  it.each([
    { backend: js, name: 'JavaScript' },
    { backend: as, name: 'WASM' },
  ])(
    'accumulates a representable determinant after extreme pivots in $name',
    async ({ backend }) => {
      const high = 2 ** 800;
      const low = 2 ** -800;
      for (const diagonal of [
        [high, high, low, low],
        [low, low, high, high],
        [high, low, -high, low],
      ]) {
        const input = DenseMatrix.fromArray(
          diagonal.map((v, i) => diagonal.map((_, j) => (i === j ? v : 0)))
        );
        expect(await backend.determinantWasm(input)).toBe(Math.sign(diagonal[2]));
      }
    }
  );
});
