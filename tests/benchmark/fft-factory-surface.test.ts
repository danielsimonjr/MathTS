/**
 * The PUBLIC `fft` — `import { fft } from '@danielsimonjr/mathts-functions'` — must not be
 * three orders of magnitude slower than the library's own core.
 *
 * It was. The public `fft` is the mathjs-derived FACTORY function, whose JS path is a
 * RECURSIVE Cooley-Tukey built on array spreads (`[..._fft(even), ..._fft(odd)]`) doing its
 * scalar arithmetic through typed-function dispatch on Complex objects. Measured through the
 * PUBLISHED package, n=2^18:
 *
 *   public fft(Array)          10630.7 ms
 *   parallelFFT(Float64Array)     33.5 ms      <- 317x faster, same transform
 *
 * Its power-of-2 fast path existed but pointed at the AssemblyScript WASM kernel, which is
 * itself ~6x SLOWER than the flat JS core. It now routes to the flat core.
 *
 * NOTE the trap this test exists to prevent: an earlier fix benchmarked
 * `functions/src/signal/fft.ts` — a DIFFERENT, non-exported `fft`. Always measure the symbol
 * a consumer actually imports.
 */
import { describe, it, expect } from 'vitest';
import { fft, ifft } from '../../functions/src/index.js';

const N = 1 << 18;
const arr = Array.from({ length: N }, (_, i) => Math.sin(i * 0.01) + 0.5 * Math.cos(i * 0.033));

/**
 * The flat core does a 2^18 transform in ~33 ms; boxing 262,144 Complex objects and the
 * factory's own array plumbing add the rest. 400 ms is ~4x above the fixed path and ~26x
 * below the 10,630 ms regression — far too wide a gap for noise to cross either way.
 */
const BUDGET_MS = 400;

describe('public (factory) fft performance', () => {
  it('routes power-of-2 transforms to the flat core, not the recursive Complex path', () => {
    fft(arr); // warm up

    const t0 = performance.now();
    fft(arr);
    const ms = performance.now() - t0;

    console.log(`[fft] PUBLIC fft(Array) @ ${N}: ${ms.toFixed(1)} ms`);

    expect(
      ms,
      `public fft took ${ms.toFixed(0)}ms for a transform the in-package flat core does in ` +
        `~33ms. Check that _fft still fast-paths power-of-2 input to fftCoreFloat64 instead ` +
        `of recursing through Complex objects (or routing to the SLOWER WASM kernel).`
    ).toBeLessThan(BUDGET_MS);
  }, 180_000);

  it('still round-trips through ifft', () => {
    const small = [1, 2, 3, 4, 5, 6, 7, 8];
    const back = ifft(fft(small)) as Array<{ re: number; im: number }>;
    for (let i = 0; i < small.length; i++) {
      expect(back[i].re).toBeCloseTo(small[i], 8);
      expect(back[i].im).toBeCloseTo(0, 8);
    }
  }, 60_000);
});
