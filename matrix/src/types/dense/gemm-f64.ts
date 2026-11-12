/** Micro-GEMM block size (L1-friendly tiles on typical CPUs). */
export const GEMM_BLOCK = 64;

/** Minimum flop count before using blocked multiplication (naive wins below). */
const BLOCKED_GEMM_MIN_FLOPS = 32 * 32 * 32;

/**
 * Dense matrix multiply C = A · B with optional zero×non-finite semantics.
 *
 * @param ad - Row-major A (n × p)
 * @param bd - Row-major B (p × m)
 * @param n - Rows of A and C
 * @param p - Cols of A / rows of B
 * @param m - Cols of B and C
 * @param result - Optional output buffer (zeroed when provided)
 */
export function gemmF64(
  ad: Float64Array,
  bd: Float64Array,
  n: number,
  p: number,
  m: number,
  result?: Float64Array
): Float64Array {
  const out = result ?? new Float64Array(n * m);
  if (result) out.fill(0);

  const useBlocked = n * p * m >= BLOCKED_GEMM_MIN_FLOPS;
  if (!useBlocked) {
    gemmF64Inner(ad, bd, out, n, p, m, 0, n, 0, m, 0, p);
    return out;
  }

  const B = GEMM_BLOCK;
  for (let i0 = 0; i0 < n; i0 += B) {
    const i1 = Math.min(i0 + B, n);
    for (let j0 = 0; j0 < m; j0 += B) {
      const j1 = Math.min(j0 + B, m);
      for (let k0 = 0; k0 < p; k0 += B) {
        const k1 = Math.min(k0 + B, p);
        gemmF64Inner(ad, bd, out, n, p, m, i0, i1, j0, j1, k0, k1);
      }
    }
  }
  return out;
}

function gemmF64Inner(
  ad: Float64Array,
  bd: Float64Array,
  result: Float64Array,
  n: number,
  p: number,
  m: number,
  i0: number,
  i1: number,
  j0: number,
  j1: number,
  k0: number,
  k1: number
): void {
  for (let i = i0; i < i1; i++) {
    const ai = i * p;
    const ri = i * m;
    for (let k = k0; k < k1; k++) {
      const aik = ad[ai + k];
      const bk = k * m;
      if (aik === 0) {
        for (let j = j0; j < j1; j++) {
          const bij = bd[bk + j];
          if (bij !== 0 && !Number.isFinite(bij)) {
            result[ri + j] += aik * bij;
          }
        }
        continue;
      }
      for (let j = j0; j < j1; j++) result[ri + j] += aik * bd[bk + j];
    }
  }
}
