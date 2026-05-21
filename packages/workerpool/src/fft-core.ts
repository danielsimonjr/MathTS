/**
 * Shared radix-2 FFT core for @danielsimonjr/mathts-workerpool.
 *
 * Exported only for internal use by `worker.ts` and `index.ts`. Not part of
 * the package's public API. tsup bundles each entry point independently, so
 * each consumer gets its own bundled copy — the goal here is a single source
 * of truth, not a shared runtime module.
 *
 * NOTE: `functions/src/typed/signal.ts` has its own copy (`fftCoreFloat64`).
 * Pulling that across the package boundary would violate the layering rules,
 * so it is intentionally left separate.
 *
 * @packageDocumentation
 */

/**
 * Bit-reverse an integer over `bits` bits (radix-2 FFT reordering helper).
 */
export function fftBitReverse(x: number, bits: number): number {
  let result = 0;
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (x & 1);
    x >>= 1;
  }
  return result;
}

/**
 * In-place radix-2 Cooley-Tukey FFT over a single frame.
 *
 * Operates on the [`offset`, `offset + n`) slice of `real`/`imag`. `n` must be
 * a power of two. This is a self-contained copy of
 * `functions/src/typed/signal.ts#fftCoreFloat64` — the worker sits below the
 * `functions` package in the dependency graph and cannot import it.
 */
export function fftFrameInPlace(
  real: Float64Array,
  imag: Float64Array,
  offset: number,
  n: number,
  inverse: boolean
): void {
  const bits = Math.log2(n) | 0;

  // Bit-reverse reorder within the frame.
  for (let i = 0; i < n; i++) {
    const j = fftBitReverse(i, bits);
    if (j > i) {
      const tr = real[offset + i];
      real[offset + i] = real[offset + j];
      real[offset + j] = tr;
      const ti = imag[offset + i];
      imag[offset + i] = imag[offset + j];
      imag[offset + j] = ti;
    }
  }

  const direction = inverse ? 1.0 : -1.0;

  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const angle = (direction * 2.0 * Math.PI) / size;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);

    for (let start = 0; start < n; start += size) {
      let tRe = 1.0;
      let tIm = 0.0;

      for (let j = 0; j < halfSize; j++) {
        const evenIdx = offset + start + j;
        const oddIdx = offset + start + j + halfSize;

        const uRe = real[oddIdx] * tRe - imag[oddIdx] * tIm;
        const uIm = real[oddIdx] * tIm + imag[oddIdx] * tRe;

        const eRe = real[evenIdx];
        const eIm = imag[evenIdx];

        real[evenIdx] = eRe + uRe;
        imag[evenIdx] = eIm + uIm;
        real[oddIdx] = eRe - uRe;
        imag[oddIdx] = eIm - uIm;

        const nextTRe = tRe * wRe - tIm * wIm;
        const nextTIm = tRe * wIm + tIm * wRe;
        tRe = nextTRe;
        tIm = nextTIm;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      real[offset + i] /= n;
      imag[offset + i] /= n;
    }
  }
}
