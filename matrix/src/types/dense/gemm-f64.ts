/** Micro-GEMM block size (L1-friendly tiles on typical CPUs). */
export const GEMM_BLOCK = 96;

const BLOCKED_MIN_FLOPS = 48 * 48 * 48;

/**
 * Dense matrix multiply C = A · B (row-major f64).
 */
export type GemmF64Options = {
  /** When true, skip `aik === 0` (matMul nested-array contract only). */
  skipZeroInA?: boolean;
};

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
