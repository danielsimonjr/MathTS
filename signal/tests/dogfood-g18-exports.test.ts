/**
 * Dogfood #774 — @danielsimonjr/mathts-signal exports fft/ifft aliases.
 */
import { describe, it, expect } from 'vitest';
import * as sig from '../src/index.js';

describe('#774 signal package fft exports', () => {
  it('exports fft and ifft as callable aliases', () => {
    expect(typeof sig.fft).toBe('function');
    expect(typeof sig.ifft).toBe('function');
    expect(sig.fft).toBe(sig.parallelFFT);
    expect(sig.ifft).toBe(sig.parallelIFFT);
  });
});
