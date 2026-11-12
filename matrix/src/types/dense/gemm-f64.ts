/** Micro-GEMM block size (L1-friendly tiles on typical CPUs). */
export const GEMM_BLOCK = 96;

const BLOCKED_MIN_FLOPS = 48 * 48 * 48;

/**
 * Options for {@link gemmF64}.
 */
export type GemmF64Options = {
  /** When true, skip `aik === 0` (matMul nested-array contract only). */
  skipZeroInA?: boolean;
};

/**
 * Dense matrix multiply C = A · B (row-major f64).
 *
 * @param ad - Row-major A (n×p)
 * @param bd - Row-major B (p×m)
 * @param n - Row count of A / C
 * @param p - Inner dimension
 * @param m - Column count of B / C
 * @param result - Optional output buffer (zeroed when provided)
 * @param options - See {@link GemmF64Options}
 */
export function gemmF64(
  ad: Float64Array,
  bd: Float64Array,
  n: number,
  p: number,
  m: number,
  result?: Float64Array,
  options?: GemmF64Options
): Float64Array {
  const skipZeroInA = options?.skipZeroInA === true;
  const out = result ?? new Float64Array(n * m);
  if (result) out.fill(0);

  if (!skipZeroInA) {
    gemmDot(ad, bd, out, n, p, m);
    return out;
  }

  if (n * p * m < BLOCKED_MIN_FLOPS) {
    gemmIkj(ad, bd, out, n, p, m, 0, n, 0, m, 0, p, skipZeroInA);
    return out;
  }

  const B = GEMM_BLOCK;
  for (let i0 = 0; i0 < n; i0 += B) {
    const i1 = Math.min(i0 + B, n);
    for (let j0 = 0; j0 < m; j0 += B) {
      const j1 = Math.min(j0 + B, m);
      for (let k0 = 0; k0 < p; k0 += B) {
        const k1 = Math.min(k0 + B, p);
        gemmIkj(ad, bd, out, n, p, m, i0, i1, j0, j1, k0, k1, skipZeroInA);
      }
    }
  }
  return out;
}

/**
 * C = A · B by a packed column of B and a contiguous dot with each row of A.
 * Same access pattern as ml-matrix `mmul`, on flat row-major storage.
 */
function gemmDot(
  ad: Float64Array,
  bd: Float64Array,
  out: Float64Array,
  n: number,
  p: number,
  m: number
): void {
  const rows = new Array<number[]>(n);
  for (let i = 0; i < n; i++) {
    const ai = i * p;
    const row = new Array<number>(p);
    for (let k = 0; k < p; k++) row[k] = ad[ai + k]!;
    rows[i] = row;
  }
  const b0 = new Array<number>(p);
  const b1 = new Array<number>(p);
  let j = 0;
  for (; j + 1 < m; j += 2) {
    for (let k = 0; k < p; k++) {
      const bk = k * m + j;
      b0[k] = bd[bk]!;
      b1[k] = bd[bk + 1]!;
    }
    for (let i = 0; i < n; i++) {
      const row = rows[i]!;
      let s0 = 0;
      let s1 = 0;
      for (let k = 0; k < p; k++) {
        const a = row[k]!;
        s0 += a * b0[k]!;
        s1 += a * b1[k]!;
      }
      const oi = i * m + j;
      out[oi] = s0;
      out[oi + 1] = s1;
    }
  }
  if (j < m) {
    for (let k = 0; k < p; k++) b0[k] = bd[k * m + j]!;
    for (let i = 0; i < n; i++) {
      const row = rows[i]!;
      let s = 0;
      for (let k = 0; k < p; k++) s += row[k]! * b0[k]!;
      out[i * m + j] = s;
    }
  }
}

function gemmIkj(
  ad: Float64Array,
  bd: Float64Array,
  result: Float64Array,
  _n: number,
  p: number,
  m: number,
  i0: number,
  i1: number,
  j0: number,
  j1: number,
  k0: number,
  k1: number,
  skipZeroInA: boolean
): void {
  for (let i = i0; i < i1; i++) {
    const ai = i * p;
    const ri = i * m;
    for (let k = k0; k < k1; k++) {
      const aik = ad[ai + k];
      if (skipZeroInA && aik === 0) continue;
      const bk = k * m;
      let j = j0;
      for (; j + 3 < j1; j += 4) {
        result[ri + j] += aik * bd[bk + j];
        result[ri + j + 1] += aik * bd[bk + j + 1];
        result[ri + j + 2] += aik * bd[bk + j + 2];
        result[ri + j + 3] += aik * bd[bk + j + 3];
      }
      for (; j < j1; j++) result[ri + j] += aik * bd[bk + j];
    }
  }
}
