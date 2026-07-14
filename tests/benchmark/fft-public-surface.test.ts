/**
 * The PUBLIC `fft` must not be dramatically slower than the library's own fast core.
 *
 * It was. `functions/src/signal/fft.ts`'s `fftCore` did Complex-OBJECT arithmetic in the
 * butterfly loop — allocating `{re, im}` per twiddle and per butterfly — while a flat
 * Float64Array core (`fftCoreFloat64`) already existed in the same package and was ~8x
 * faster for the identical transform:
 *
 *   n=2^20   public fft 2986.9 ms   |   parallelFFT (Float64Array core) 358.0 ms
 *
 * The Complex[] RETURN TYPE is not the problem — materialising the objects once at the
 * end is cheap. Doing the arithmetic in them is what cost 8x. Both surfaces now share one
 * core; this pins that they stay shared.
 *
 * Wall-clock, so it lives here (single-threaded, `npm run test:bench`) rather than in the
 * aggregate, where it would measure machine contention.
 */
import { describe, it, expect } from 'vitest';
import { fft, ifft } from '../../functions/src/signal/fft.js';

const N = 1 << 18;
const signal = Float64Array.from(
  { length: N },
  (_, i) => Math.sin(i * 0.01) + 0.5 * Math.cos(i * 0.033)
);

/**
 * Budget for a 2^18-point complex FFT returning ComplexNumber[].
 *
 * The flat core does this in ~80 ms; materialising 262,144 objects adds ~20-40 ms. The
 * object-arithmetic version took 607 ms. 250 ms sits ~2x above the fixed implementation
 * and ~2.4x below the regression, so neither noise nor a slow machine can cross it in
 * either direction. Widen only with a named cause.
 */
const BUDGET_MS = 250;

describe('public fft performance', () => {
  it('does not do Complex-object arithmetic in the butterfly loop', () => {
    fft(signal); // warm up

    const REPS = 3;
    const t0 = performance.now();
    for (let r = 0; r < REPS; r++) fft(signal);
    const ms = (performance.now() - t0) / REPS;

    console.log(`[fft] public fft @ ${N}: ${ms.toFixed(1)} ms`);

    expect(
      ms,
      `public fft took ${ms.toFixed(0)}ms for a transform the in-package Float64Array core ` +
        `does in ~80ms. Check that fftCore still delegates to fftCoreFloat64 rather than ` +
        `allocating Complex objects per butterfly.`
    ).toBeLessThan(BUDGET_MS);
  }, 120_000);

  it('still round-trips exactly (the fast core must not change results)', () => {
    const small = [1, 2, 3, 4, 5, 6, 7, 8];
    const spec = fft(small);
    const back = ifft(spec.spectrum, spec.originalLength);
    for (let i = 0; i < small.length; i++) {
      expect(back[i].re).toBeCloseTo(small[i], 10);
      expect(back[i].im).toBeCloseTo(0, 10);
    }
  });
});
