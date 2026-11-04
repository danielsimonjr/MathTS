import { describe, it, expect } from 'vitest';
import { lombScargle } from '../src/signal/lomb-scargle.js';

/** Small seeded LCG so the uneven sampling is reproducible. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('lombScargle', () => {
  const rnd = lcg(42);
  const t = Array.from({ length: 100 }, () => rnd() * 10);
  const y = t.map((x) => Math.sin(2 * Math.PI * 1 * x));
  const freqs = Array.from({ length: 291 }, (_, k) => 2 * Math.PI * (0.1 + k * 0.01));

  it('peaks at the true angular frequency', () => {
    const p = lombScargle(t, y, freqs);
    let best = 0;
    for (let i = 1; i < p.length; i++) if (p[i] > p[best]) best = i;
    expect(Math.abs(freqs[best] - 2 * Math.PI)).toBeLessThan(0.01 * 2 * Math.PI);
  });

  it('normalized peak is close to 1', () => {
    const p = lombScargle(t, y, freqs, { normalize: true });
    expect(Math.max(...p)).toBeGreaterThan(0.95);
    expect(Math.max(...p)).toBeLessThan(1.05);
  });

  it('constant signal with precenter gives zero power', () => {
    const c = t.map(() => 3);
    const p = lombScargle(t, c, freqs, { precenter: true });
    for (const v of p) expect(Math.abs(v)).toBeLessThan(1e-9);
  });
});
