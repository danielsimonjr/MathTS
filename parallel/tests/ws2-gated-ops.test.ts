import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ComputePool } from '../src/index';

/**
 * WS-2 completion: histogram / transpose / matvec / outer previously dispatched
 * to the worker pool UNCONDITIONALLY (no `shouldParallelize` gate), paying worker
 * copy overhead on every call — benchmarked 0.00–0.56× at every size up to 4.2M
 * elements (tools/benchmarks/ws2-missing-ops.mjs). They are now `'never'` in
 * DEFAULT_THRESHOLD_BY_OP with an inline sequential fallback. These tests pin:
 * (a) the inline results are numerically correct (closed-form oracles), and
 * (b) the default path really is sequential (`parallelized: false`).
 */
describe('WS-2 gated ops — inline sequential fallback under the default thresholds', () => {
  let pool: ComputePool;

  beforeAll(async () => {
    pool = new ComputePool();
    await pool.initialize();
  });

  afterAll(async () => {
    await pool.terminate();
  });

  it('histogram: exact counts, not parallelized', async () => {
    // 6 values in [0,3) with 3 bins of width 1 → counts [2, 2, 2]
    const r = await pool.histogram(new Float64Array([0.1, 0.9, 1.1, 1.9, 2.1, 2.9]), 3, 0, 3);
    expect(r.result).toEqual([2, 2, 2]);
    expect(r.parallelized).toBe(false);
  });

  it('histogram: derives min/max when omitted', async () => {
    const r = await pool.histogram(new Float64Array([0, 1, 2, 3]), 2);
    // range [0,3], width 1.5 → bins [0,1.5): {0,1}, [1.5,3]: {2,3}
    expect(r.result).toEqual([2, 2]);
    expect(r.parallelized).toBe(false);
  });

  it('transpose: exact 2×3 → 3×2, not parallelized', async () => {
    // [[1,2,3],[4,5,6]] row-major → transpose [[1,4],[2,5],[3,6]]
    const r = await pool.transpose(new Float64Array([1, 2, 3, 4, 5, 6]), 2, 3);
    expect(Array.from(r.result)).toEqual([1, 4, 2, 5, 3, 6]);
    expect(r.parallelized).toBe(false);
  });

  it('matvec: exact [[1,2],[3,4]]·[5,6] = [17,39], not parallelized', async () => {
    const r = await pool.matvec(new Float64Array([1, 2, 3, 4]), 2, 2, new Float64Array([5, 6]));
    expect(Array.from(r.result)).toEqual([17, 39]);
    expect(r.parallelized).toBe(false);
  });

  it('outer: exact [1,2]⊗[3,4] = [[3,4],[6,8]], not parallelized', async () => {
    const r = await pool.outer(new Float64Array([1, 2]), new Float64Array([3, 4]));
    expect(Array.from(r.result)).toEqual([3, 4, 6, 8]);
    expect(r.parallelized).toBe(false);
  });

  it("the four ops are 'never' by default even at large sizes", async () => {
    const big = new Float64Array(200_000).fill(1);
    const h = await pool.histogram(big, 4, 0, 1);
    expect(h.parallelized).toBe(false);
    const t = await pool.transpose(big, 400, 500);
    expect(t.parallelized).toBe(false);
  });
});

describe("bitwise family — 'never' by default (WS-2 addendum, 2026-07-05)", () => {
  // Previously gated via a NAMELESS shouldParallelize(len) → the untested global
  // 50k threshold. Benchmarked 0.04–0.15× at every size (ws2-bitwise-ops.mjs);
  // now named OpNames set to 'never'. Exact-value pins + default-path checks.
  let pool: ComputePool;

  beforeAll(async () => {
    pool = new ComputePool();
    await pool.initialize();
  });

  afterAll(async () => {
    await pool.terminate();
  });

  it('bitAnd/bitOr/bitXor exact + inline at large size', async () => {
    const a = new Int32Array([0b1100, 0b1010]);
    const b = new Int32Array([0b1010, 0b0110]);
    expect(Array.from((await pool.bitAnd(a, b)).result)).toEqual([0b1000, 0b0010]);
    expect(Array.from((await pool.bitOr(a, b)).result)).toEqual([0b1110, 0b1110]);
    expect(Array.from((await pool.bitXor(a, b)).result)).toEqual([0b0110, 0b1100]);
    const big = new Int32Array(200_000).fill(7);
    expect((await pool.bitAnd(big, big)).parallelized).toBe(false);
  });

  it('bitNot exact + inline at large size', async () => {
    const r = await pool.bitNot(new Int32Array([0, -1, 5]));
    expect(Array.from(r.result)).toEqual([-1, 0, -6]);
    expect((await pool.bitNot(new Int32Array(200_000))).parallelized).toBe(false);
  });

  it('shifts exact + inline at large size', async () => {
    const a = new Int32Array([1, -8, 256]);
    expect(Array.from((await pool.leftShift(a, 2)).result)).toEqual([4, -32, 1024]);
    expect(Array.from((await pool.rightArithShift(a, 2)).result)).toEqual([0, -2, 64]);
    expect(Array.from((await pool.rightLogShift(a, 2)).result)).toEqual([0, 1073741822, 64]);
    expect((await pool.leftShift(new Int32Array(200_000), 1)).parallelized).toBe(false);
  });
});
