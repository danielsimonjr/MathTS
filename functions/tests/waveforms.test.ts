import { describe, it, expect } from 'vitest';
import {
  chirp,
  squareWave,
  sawtooth,
  gaussPulse,
  unitImpulse,
  sweepPoly,
} from '../src/signal/waveforms.js';

describe('waveforms', () => {
  it('square wave', () => {
    expect(squareWave([0])).toEqual([1]);
    expect(squareWave([Math.PI])).toEqual([-1]);
  });

  it('sawtooth ramps from -1 to +1', () => {
    const s = sawtooth([0, Math.PI]);
    expect(s[0]).toBeCloseTo(-1, 12);
    expect(s[1]).toBeCloseTo(0, 12);
  });

  it('chirp: t=0 gives 1 and constant sweep equals a cosine', () => {
    expect(chirp([0], 1, 1, 10)[0]).toBeCloseTo(1, 12);
    const t = [0, 0.1, 0.2];
    const c = chirp(t, 2, 1, 2);
    t.forEach((x, i) => expect(c[i]).toBeCloseTo(Math.cos(2 * Math.PI * 2 * x), 12));
  });

  it('chirp sweep laws match their closed-form phase at t1', () => {
    // quadratic: f(t) = f0 + beta t^2, beta = (f1 - f0)/t1^2; cycles = f0 t + beta t^3 / 3
    expect(chirp([1], 1, 1, 3, { method: 'quadratic' })[0]).toBeCloseTo(
      Math.cos(2 * Math.PI * (5 / 3)),
      12
    );
    // logarithmic: cycles = f0 t1 (k^(t/t1) - 1) / ln k with k = f1/f0
    expect(chirp([1], 1, 1, 4, { method: 'logarithmic' })[0]).toBeCloseTo(
      Math.cos(2 * Math.PI * (3 / Math.log(4))),
      12
    );
    // hyperbolic: cycles = f0 f1 t1 / (f0 - f1) * ln(((f0 - f1) t + f1 t1) / (f1 t1))
    expect(chirp([1], 1, 1, 2, { method: 'hyperbolic' })[0]).toBeCloseTo(
      Math.cos(2 * Math.PI * 2 * Math.log(2)),
      12
    );
  });

  it('every sweep law degenerates to a cosine when f0 = f1', () => {
    const t = [0, 0.1, 0.3];
    for (const method of ['linear', 'quadratic', 'logarithmic', 'hyperbolic'] as const) {
      const c = chirp(t, 2, 1, 2, { method });
      t.forEach((x, i) => expect(c[i]).toBeCloseTo(Math.cos(2 * Math.PI * 2 * x), 12));
    }
  });

  it('gauss pulse is 1 at t=0', () => {
    expect(gaussPulse([0], 1000)[0]).toBeCloseTo(1, 12);
  });

  it('unit impulse at index and mid', () => {
    expect(unitImpulse(5, 2)).toEqual([0, 0, 1, 0, 0]);
    expect(unitImpulse(5, 'mid')).toEqual([0, 0, 1, 0, 0]);
  });

  it('sweepPoly with constant frequency equals a cosine', () => {
    const t = [0, 0.05, 0.1];
    const y = sweepPoly(t, [3]);
    t.forEach((x, i) => expect(y[i]).toBeCloseTo(Math.cos(2 * Math.PI * 3 * x), 12));
  });
});
