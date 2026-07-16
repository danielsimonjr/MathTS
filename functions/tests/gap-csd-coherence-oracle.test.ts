import { describe, it, expect } from 'vitest';
import { csd, coherence, welchPSD } from '../src/index.js';

/**
 * Implementation-independent invariants for `csd`/`coherence`
 * (`functions/src/signal/spectral-peaks.ts`) — neither was hard-pinned before.
 * A seeded numpy RNG will NOT reproduce JS's PRNG stream, so this pins
 * mathematical invariants any correct Welch cross-spectral estimator must
 * satisfy, rather than exact numbers from an external oracle.
 *
 * The public `csd` only returns the cross-spectrum *magnitude* (`power`), not
 * decomposed re/im parts, so "csd(x,x) is real" and "csd(x,y) = conj(csd(y,x))"
 * are adapted to what's actually observable through the public surface:
 *  - `csd(x,x).power` is compared to `welchPSD` (a second, independently coded
 *    Welch-PSD implementation in this package) via the well-known one-sided
 *    PSD doubling convention (interior bins get x2, DC/Nyquist bins don't).
 *  - conjugate symmetry (`Pxy = conj(Pyx)`) implies equal magnitude, so
 *    `csd(x,y).power` must equal `csd(y,x).power`.
 *  - the real part of `Pxy` is independently recoverable from three
 *    *auto*-spectra via the polarization identity
 *    `Re(Pxy) = (P(x+y,x+y) - Pxx - Pyy) / 2` (linearity of the windowed FFT);
 *    `|Re(Pxy)| <= |Pxy|` must then hold (`|z| >= |Re(z)|` for any complex z).
 *    This links four independently-computed `csd` calls and is not circular.
 */

const N = 1024;
const fs = 256; // chosen so the two test frequencies land on exact FFT bins (nperseg=256 -> df=1Hz)
const OPTS = { nperseg: 256, noverlap: 128, window: 'hann' } as const;

function makeSignal(phase: number): number[] {
  return Array.from(
    { length: N },
    (_, i) =>
      Math.sin((2 * Math.PI * 5 * i) / fs + phase) +
      0.5 * Math.sin((2 * Math.PI * 20 * i) / fs + 0.3) +
      0.2 * Math.cos((2 * Math.PI * 37 * i) / fs)
  );
}

describe('csd/coherence — implementation-independent invariants', () => {
  it('coherence values lie in [0, 1] (up to fp slack) for arbitrary real signals', () => {
    const x = makeSignal(0);
    const y = makeSignal(1.234); // different signal, not a scalar multiple/delay of x
    const { coherence: coh } = coherence(x, y, OPTS);
    expect(coh.length).toBeGreaterThan(0);
    for (const v of coh) {
      expect(v).toBeGreaterThanOrEqual(-1e-9);
      expect(v).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('coherence of a scaled noiseless copy is ~1 at the signal frequency bins', () => {
    const x = makeSignal(0);
    const y = x.map((v) => 3 * v); // perfect linear relation -> unity coherence
    const { coherence: coh } = coherence(x, y, OPTS);
    // bin 5 -> 5 Hz, bin 20 -> 20 Hz (both carry non-negligible power in `x`)
    expect(coh[5]).toBeCloseTo(1, 6);
    expect(coh[20]).toBeCloseTo(1, 6);
  });

  it('csd(x,x) matches welchPSD up to the one-sided doubling convention', () => {
    const x = makeSignal(0);
    const { power } = csd(x, x, OPTS);
    const { psd } = welchPSD(x, {
      frameLength: OPTS.nperseg,
      overlap: OPTS.noverlap,
      window: OPTS.window,
    });
    expect(psd.length).toBe(power.length);

    const last = power.length - 1;
    for (let k = 0; k < power.length; k++) {
      // DC (k=0) and Nyquist (k=last) bins are not doubled by the one-sided
      // PSD convention; every interior bin is.
      const expectedFactor = k === 0 || k === last ? 1 : 2;
      expect(psd[k]).toBeCloseTo(expectedFactor * power[k], 9);
    }
    // Trivially true given `power = hypot(re, im)`, but locks the public
    // contract: csd's magnitude output is always real-valued and non-negative.
    for (const p of power) {
      expect(Number.isFinite(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(0);
    }
  });

  it('csd(x,y) and csd(y,x) have equal magnitude, and |Re(Pxy)| <= |Pxy| (polarization identity)', () => {
    const x = makeSignal(0);
    const y = makeSignal(1.234);
    const s = x.map((v, i) => v + y[i]);

    const Pxy = csd(x, y, OPTS).power;
    const Pyx = csd(y, x, OPTS).power;
    const Pxx = csd(x, x, OPTS).power;
    const Pyy = csd(y, y, OPTS).power;
    const Pss = csd(s, s, OPTS).power;

    expect(Pxy.length).toBe(Pyx.length);
    for (let k = 0; k < Pxy.length; k++) {
      // |Pxy| = |conj(Pyx)| = |Pyx| — magnitude form of conjugate symmetry.
      expect(Pxy[k]).toBeCloseTo(Pyx[k], 9);

      // Re(Pxy) = (P(x+y,x+y) - Pxx - Pyy) / 2, from linearity of the
      // windowed-segment FFT: FFT(x+y) = FFT(x) + FFT(y), so
      // P(x+y,x+y) = Pxx + Pyy + Pxy + conj(Pxy) = Pxx + Pyy + 2*Re(Pxy).
      const reXY = (Pss[k] - Pxx[k] - Pyy[k]) / 2;
      expect(Math.abs(reXY)).toBeLessThanOrEqual(Pxy[k] + 1e-9);
    }
  });
});
