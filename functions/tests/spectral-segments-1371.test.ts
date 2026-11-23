import { describe, expect, it } from 'vitest';
import { coherence, csd, welchPSD } from '../src/index.js';

const x = [10, 11, 9, 8, 12, 10, 10, 8, 9, 12, 13, 9, 8, 10, 10, 11];
const y = [2, 4, 3, 1, 2, 3, 4, 5, 1, 3, 1, 0, 1, 2, 1, 5];

function expectClose(actual: number[], reference: number[]): void {
  expect(actual).toHaveLength(reference.length);
  for (let i = 0; i < actual.length; i++) expect(actual[i]).toBeCloseTo(reference[i], 12);
}

describe('periodic, mean-detrended spectra (#1371)', () => {
  // SciPy 1.17.0, default periodic Hann and detrend='constant'.
  it('matches SciPy in an odd-length frame with overlap', () => {
    const cross = csd(x, y, { nperseg: 5 });
    const agreement = coherence(x, y, { nperseg: 5 });
    const welch = welchPSD(x, { frameLength: 5 });
    expect(cross.frequencies).toEqual([0, 0.2, 0.4]);
    expect(welch.frequencies).toEqual(cross.frequencies);
    expectClose(cross.power, [0.7486067977499791, 1.4685911460019234, 1.9683883375465923]);
    expectClose(agreement.coherence, [0.4920581523837488, 0.09803636592325907, 0.5731384208759053]);
    expectClose(welch.psd, [1.4722135954999582, 8.06467355335404, 2.6476718867713323]);
  });

  it('matches SciPy at DC and Nyquist with even-length Hann frames', () => {
    expectClose(
      welchPSD(x, { frameLength: 8 }).psd,
      [
        0.5996051788229698, 7.508643977278978, 9.563451979096168, 3.742921277890583,
        1.296841430583757,
      ]
    );
    expectClose(welchPSD(x, { frameLength: 2 }).psd, [1.05, 1.05]);
    expectClose(csd(x, y, { nperseg: 2 }).power, [0.25, 0.25]);
  });

  it('can retain a segment mean and a symmetric window explicitly', () => {
    expect(welchPSD([5, 6], { window: 'rect', detrend: false }).psd).toEqual([60.5, 0.5]);
    expect(() => welchPSD([5, 6], { periodic: false })).toThrow(/all zeros/);
    expect(welchPSD([5, 5, 5, 5]).psd).toEqual([0, 0, 0]);
  });
});
