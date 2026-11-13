import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ComputePool } from '@danielsimonjr/mathts-parallel';
import { DenseMatrix } from '../src/types/DenseMatrix.js';

/**
 * `ComputePool.matmul` and `DenseMatrix.multiply` keep the same sum order, so they give the
 * same bits for every input: finite, NaN, Infinity and signed zero. The sequential path and the
 * forced worker path both run here.
 */

function fixture(rows: number, cols: number, seed: number, special: boolean): Float64Array {
  const x = new Float64Array(rows * cols);
  for (let i = 0; i < x.length; i++) x[i] = (((i * seed + 3) % 19) - 9) / 7;
  if (special) {
    const marks = [Number.NaN, Infinity, -Infinity, -0, 0];
    for (let i = 0; i < x.length; i += 7) x[i] = marks[(i / 7) % marks.length];
  }
  return x;
}

describe('ComputePool.matmul and DenseMatrix.multiply give the same bits', () => {
  let pool: ComputePool;

  beforeAll(async () => {
    pool = new ComputePool({ maxWorkers: 2 });
    await pool.initialize();
  });

  afterAll(async () => {
    await pool.terminate(true);
  });

  const shapes: Array<[number, number, number]> = [
    [1, 1, 1],
    [2, 3, 1], // bCols = 1: the column pairing has no pair
    [3, 5, 5], // odd bCols: the pairing has a tail column
    [4, 4, 4],
    [7, 1, 9],
    [9, 13, 6],
    [97, 33, 41],
  ];

  for (const special of [false, true]) {
    for (const [m, k, n] of shapes) {
      const label = `${m}x${k} * ${k}x${n}${special ? ' with NaN, Infinity and -0' : ''}`;
      it(`${label}: sequential and forced-parallel equal DenseMatrix.multiply`, async () => {
        const a = fixture(m, k, 3, special);
        const b = fixture(k, n, 5, special);
        const want = new DenseMatrix(m, k, a).multiply(new DenseMatrix(k, n, b)).toFloat64Array();
        for (const force of [{ forceSequential: true }, { forceParallel: true }]) {
          const got = (await pool.matmul(a, m, k, b, n, force)).result;
          expect(got.length).toBe(want.length);
          for (let i = 0; i < want.length; i++) {
            expect(Object.is(got[i], want[i]), `${JSON.stringify(force)} element ${i}`).toBe(true);
          }
        }
      });
    }
  }

  it('a zero in A times an Infinity in B gives NaN on both', async () => {
    const a = Float64Array.of(0);
    const b = Float64Array.of(Infinity);
    const want = new DenseMatrix(1, 1, a).multiply(new DenseMatrix(1, 1, b)).toFloat64Array();
    const got = (await pool.matmul(a, 1, 1, b, 1, { forceSequential: true })).result;
    expect(Number.isNaN(want[0])).toBe(true);
    expect(Number.isNaN(got[0])).toBe(true);
  });
});
