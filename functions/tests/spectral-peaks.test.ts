import { describe, it, expect } from 'vitest';
import { findPeaks, peakWidths, stft, istft, decimate } from '../src/index.js';

describe('spectral + peaks', () => {
  it('findPeaks([0,2,0,3,0,1,0]) = [1,3,5]', () => {
    expect(findPeaks([0, 2, 0, 3, 0, 1, 0])).toEqual([1, 3, 5]);
  });
  it('findPeaks height filter keeps only tall peaks', () => {
    expect(findPeaks([0, 2, 0, 3, 0, 1, 0], { height: 2.5 })).toEqual([3]);
  });
  it('findPeaks distance filter merges close peaks (keeps the taller)', () => {
    // peaks at 1(=2) and 3(=3); distance 3 -> keep only index 3
    expect(findPeaks([0, 2, 0, 3, 0, 1, 0], { distance: 3 })).toEqual([3]);
  });
  it('peakWidths returns a positive width per peak', () => {
    const w = peakWidths([0, 1, 3, 1, 0], [2]);
    expect(w).toHaveLength(1);
    expect(w[0]).toBeGreaterThan(0);
  });
  it('istft reconstructs stft on the stable interior (COLA)', () => {
    const x = Array.from({ length: 64 }, (_, i) => Math.sin(i / 3));
    const S = stft(x, { nperseg: 16, noverlap: 8, window: 'hann' });
    const back = istft(S, { nperseg: 16, noverlap: 8, window: 'hann' });
    for (let i = 20; i < 44; i++) expect(back[i]).toBeCloseTo(x[i], 3);
  });
  it('decimate by 2 halves the length (approx)', () => {
    const out = decimate(
      Array.from({ length: 40 }, (_, i) => Math.sin(i / 2)),
      2
    );
    expect(out.length).toBeGreaterThanOrEqual(19);
    expect(out.length).toBeLessThanOrEqual(21);
  });
});
