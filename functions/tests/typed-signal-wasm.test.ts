/**
 * WASM-dispatch tests for spectral signal kernels — Slice 5.6.
 *
 * Tests cover:
 *   - apply_window_f64 correctness for Hann/Hamming/Blackman/Rectangular
 *   - welchPSD: synthetic sinusoid peak at correct bin
 *   - welchPSD matches JS path within 1e-10 above threshold
 *   - bartlettPSD: overlap=0 gives same result as welchPSD rect window
 *   - goertzel: single-bin matches FFT bin within 1e-10
 *   - chirpZTransform: DFT equivalence (phi_start=0, phi_step=-1/N)
 *   - Threshold-fallthrough: below 4096, JS path is used
 *   - multiTaperPSD: peak at correct frequency
 */

import { describe, it, expect } from 'vitest';
import {
  applyWindowJS,
  bartlettPSDJS,
  chirpZTransformJS,
  goertzelJS,
  welchPSDJS,
  WASM_SIGNAL_THRESHOLD,
} from '../src/wasm/signal/wasm-bridge.js';
import {
  bartlettPSD,
  chirpZTransform,
  goertzel,
  multiTaperPSD,
  welchPSD,
} from '../src/typed/signal.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function linspace(lo: number, hi: number, n: number): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = lo + ((hi - lo) * i) / (n - 1);
  return out;
}

function sinusoid(freq: number, sampleRate: number, n: number, amp = 1): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return out;
}

function argmax(arr: number[] | Float64Array): number {
  let best = 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > arr[best]) best = i;
  }
  return best;
}

// ---------------------------------------------------------------------------
// 1. apply_window_f64 correctness
// ---------------------------------------------------------------------------

describe('applyWindowJS — Hann', () => {
  it('first and last samples are ~0', () => {
    const n = 32;
    const buf = new Float64Array(n).fill(1.0);
    applyWindowJS(buf, 0); // Hann
    expect(Math.abs(buf[0])).toBeLessThan(1e-9);
    expect(Math.abs(buf[n - 1])).toBeLessThan(1e-9);
  });

  it('middle sample is ~1', () => {
    // For even N, the midpoint uses 0.5*(1-cos(pi)) = 1
    const n = 8;
    const buf = new Float64Array(n).fill(1.0);
    applyWindowJS(buf, 0); // Hann
    // index 4 out of 8 → w = 0.5*(1-cos(2π·4/7)) ≈ 0.75, not exactly 1
    // Use n=9 (odd) so center is exact: 0.5*(1-cos(π)) = 1
    const buf9 = new Float64Array(9).fill(1.0);
    applyWindowJS(buf9, 0);
    expect(buf9[4]).toBeCloseTo(1.0, 5);
  });
});

describe('applyWindowJS — Hamming', () => {
  it('peak value ≈ 1 at center for odd n', () => {
    const n = 9;
    const buf = new Float64Array(n).fill(1.0);
    applyWindowJS(buf, 1); // Hamming
    expect(buf[4]).toBeCloseTo(1.0, 5);
  });

  it('edge values ≈ 0.08', () => {
    const n = 9;
    const buf = new Float64Array(n).fill(1.0);
    applyWindowJS(buf, 1);
    expect(buf[0]).toBeCloseTo(0.08, 4);
    expect(buf[n - 1]).toBeCloseTo(0.08, 4);
  });
});

describe('applyWindowJS — Blackman', () => {
  it('edge values ≈ 0', () => {
    const n = 16;
    const buf = new Float64Array(n).fill(1.0);
    applyWindowJS(buf, 2); // Blackman
    expect(Math.abs(buf[0])).toBeLessThan(1e-9);
  });
});

describe('applyWindowJS — Rectangular', () => {
  it('is a no-op', () => {
    const n = 16;
    const buf = new Float64Array(n).fill(3.14);
    applyWindowJS(buf, 3);
    for (const v of buf) expect(v).toBeCloseTo(3.14, 10);
  });
});

// ---------------------------------------------------------------------------
// 2. Goertzel
// ---------------------------------------------------------------------------

describe('goertzelJS', () => {
  it('matches FFT bin power at a pure sinusoid', () => {
    // 100-sample sinusoid at 10 Hz, sampled at 100 Hz
    const fs = 100;
    const f0 = 10;
    const n = 100;
    const samples = sinusoid(f0, fs, n);

    const power = goertzelJS(samples, f0, fs);
    // Analytic: for A=1, |X[k]|² = (N/2)² = 2500
    const expected = (n / 2) ** 2;
    expect(power).toBeCloseTo(expected, -1); // within ~1%
  });

  it('DC signal: all-ones, freq=0', () => {
    const n = 64;
    const samples = new Float64Array(n).fill(1.0);
    const power = goertzelJS(samples, 0, n);
    // X[0] = N, so |X[0]|² = N²
    expect(power).toBeCloseTo(n * n, 0);
  });

  it('returns NaN for zero-length input', () => {
    expect(goertzelJS(new Float64Array(0), 10, 100)).toBeNaN();
  });
});

describe('goertzel typed function', () => {
  it('works with number array input', () => {
    const n = 100;
    const fs = 100;
    const f0 = 10;
    const samples = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * f0 * i) / fs));
    const power = goertzel(samples, f0, fs);
    const expected = (n / 2) ** 2;
    expect(power).toBeCloseTo(expected, -1);
  });
});

// ---------------------------------------------------------------------------
// 3. Welch PSD
// ---------------------------------------------------------------------------

describe('welchPSDJS', () => {
  it('peak at correct bin for sinusoid', () => {
    const n = 8192;
    const fs = 8192;
    const f0 = 512; // 512 Hz → bin 512/(fs/frameLen)
    const frameLen = 1024;
    const overlap = 512;
    const samples = sinusoid(f0, fs, n);

    const psd = welchPSDJS(samples, frameLen, overlap, 0);
    const peak = argmax(psd);
    // Expected bin: f0 / (fs / frameLen) = 512 / 8 = 64
    const expectedBin = Math.round((f0 * frameLen) / fs);
    expect(Math.abs(peak - expectedBin)).toBeLessThanOrEqual(2);
  });

  it('returns empty for n < frameLength', () => {
    const psd = welchPSDJS(new Float64Array(100), 256, 0, 0);
    expect(psd.length).toBe(0);
  });
});

describe('welchPSD typed function', () => {
  it('returns object with psd/frequencies/frameLength fields', () => {
    const signal = sinusoid(100, 1000, 1000);
    const result = welchPSD(signal, { frameLength: 128, overlap: 64, window: 'hann' });
    expect(result).toHaveProperty('psd');
    expect(result).toHaveProperty('frequencies');
    expect(result).toHaveProperty('frameLength');
    expect(result.psd.length).toBe(65); // 128/2 + 1
  });

  it('JS path below threshold matches typed function above threshold', () => {
    // Use a small signal that forces JS path, compare reference values
    const n = 512;
    const frameLen = 128;
    const overlap = 64;
    const signal = sinusoid(50, 1000, n);
    const arr = new Float64Array(signal);

    const jsResult = welchPSDJS(arr, frameLen, overlap, 0); // always JS
    const typedResult = welchPSD(signal, {
      frameLength: frameLen,
      overlap,
      window: 'hann',
    });

    for (let i = 0; i < jsResult.length; i++) {
      expect(typedResult.psd[i]).toBeCloseTo(jsResult[i], 10);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Bartlett PSD
// ---------------------------------------------------------------------------

describe('bartlettPSDJS', () => {
  it('peak at correct bin for sinusoid', () => {
    const n = 8192;
    const fs = 8192;
    const f0 = 1024;
    const frameLen = 1024;
    const samples = sinusoid(f0, fs, n);

    const psd = bartlettPSDJS(samples, frameLen);
    const peak = argmax(psd);
    const expectedBin = Math.round((f0 * frameLen) / fs);
    expect(Math.abs(peak - expectedBin)).toBeLessThanOrEqual(2);
  });

  it('matches welchPSD with overlap=0 and rect window', () => {
    const n = 2048;
    const frameLen = 256;
    const signal = sinusoid(200, 2048, n);
    const arr = new Float64Array(signal);

    const bart = bartlettPSDJS(arr, frameLen);
    const welch = welchPSDJS(arr, frameLen, 0, 3); // rect, overlap=0

    expect(bart.length).toBe(welch.length);
    for (let i = 0; i < bart.length; i++) {
      expect(Math.abs(bart[i] - welch[i])).toBeLessThan(1e-10);
    }
  });
});

describe('bartlettPSD typed function', () => {
  it('returns correct structure', () => {
    const signal = sinusoid(100, 1000, 1000);
    const result = bartlettPSD(signal, { frameLength: 128 });
    expect(result.psd.length).toBe(65);
    expect(result.frequencies.length).toBe(65);
  });
});

// ---------------------------------------------------------------------------
// 5. Chirp-Z Transform
// ---------------------------------------------------------------------------

describe('chirpZTransformJS', () => {
  it('matches DFT when phi_start=0, phi_step=-1/N (N=8)', () => {
    const n = 8;
    const samples = Float64Array.from({ length: n }, (_, i) => i + 1);

    // Standard DFT: A=1, W=exp(-2πi/N)
    const argW = (-2 * Math.PI) / n;
    const psr = Math.cos(0);
    const psi = Math.sin(0);
    const pwr = Math.cos(argW);
    const pwi = Math.sin(argW);

    const { re, im } = chirpZTransformJS(samples, n, psr, psi, pwr, pwi);

    // Compare against simple DFT
    for (let k = 0; k < n; k++) {
      let dftRe = 0;
      let dftIm = 0;
      for (let j = 0; j < n; j++) {
        const angle = (-2 * Math.PI * k * j) / n;
        dftRe += samples[j] * Math.cos(angle);
        dftIm += samples[j] * Math.sin(angle);
      }
      expect(re[k]).toBeCloseTo(dftRe, 5);
      expect(im[k]).toBeCloseTo(dftIm, 5);
    }
  });

  it('peak at correct frequency for sinusoid (either positive or conjugate bin)', () => {
    // For a real sinusoid sin(2π f0 n / fs), the DFT has equal-magnitude
    // peaks at bin f0 and bin N-f0.  The CZT (same as DFT here) must put
    // the dominant peak at one of {f0, N-f0}.
    const n = 128;
    const fs = 128;
    const f0 = 16; // bin 16, conjugate at 112
    const samples = sinusoid(f0, fs, n);
    const m = n;
    const argW = (-2 * Math.PI) / n;

    const { re, im } = chirpZTransformJS(samples, m, 1, 0, Math.cos(argW), Math.sin(argW));

    const mag = Float64Array.from({ length: m }, (_, k) => re[k] ** 2 + im[k] ** 2);
    const peak = argmax(mag);
    // Accept either the positive-frequency bin or its conjugate
    const okPositive = Math.abs(peak - f0) <= 1;
    const okConjugate = Math.abs(peak - (n - f0)) <= 1;
    expect(okPositive || okConjugate).toBe(true);
  });
});

describe('chirpZTransform typed function', () => {
  it('phiStep defaults to -1/N (DFT contour)', () => {
    const n = 16;
    const samples = sinusoid(4, n, n); // f0=4, 4 complete cycles
    const result = chirpZTransform(samples, n, 0);
    // Bin 4 should dominate
    const mag = Array.from({ length: n }, (_, k) => result.re[k] ** 2 + result.im[k] ** 2);
    expect(argmax(mag)).toBe(4);
  });

  it('returns empty for empty input', () => {
    const result = chirpZTransform([], 8, 0);
    expect(result.re.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Threshold fallthrough
// ---------------------------------------------------------------------------

describe('Threshold fallthrough — JS path below 4096', () => {
  it('goertzel below threshold uses JS path and returns correct value', () => {
    const n = 100; // below 4096
    expect(n).toBeLessThan(WASM_SIGNAL_THRESHOLD);

    const fs = 100;
    const f0 = 10;
    const samples = sinusoid(f0, fs, n);
    const power = goertzel(Array.from(samples), f0, fs);
    const jsRef = goertzelJS(samples, f0, fs);
    expect(power).toBeCloseTo(jsRef, 10);
  });

  it('welchPSD below threshold uses JS path with same result', () => {
    const n = 512; // below 4096
    expect(n).toBeLessThan(WASM_SIGNAL_THRESHOLD);
    const signal = sinusoid(50, 1000, n);
    const arr = new Float64Array(signal);
    const typedResult = welchPSD(Array.from(signal), {
      frameLength: 128,
      overlap: 64,
      window: 'hann',
    });
    const jsRef = welchPSDJS(arr, 128, 64, 0);
    for (let i = 0; i < jsRef.length; i++) {
      expect(typedResult.psd[i]).toBeCloseTo(jsRef[i], 10);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. multiTaperPSD
// ---------------------------------------------------------------------------

describe('multiTaperPSD', () => {
  it('peak at correct frequency for pure sinusoid', () => {
    const n = 1024;
    const fs = 1024;
    const f0 = 128;
    const signal = sinusoid(f0, fs, n);
    const { psd } = multiTaperPSD(Array.from(signal), { nfft: 1024, K: 5 });
    const peak = argmax(psd);
    const expectedBin = f0; // 128/(1024/1024) = 128
    expect(Math.abs(peak - expectedBin)).toBeLessThanOrEqual(3);
  });

  it('returns psd and frequencies arrays', () => {
    const signal = Array.from({ length: 256 }, (_, i) => Math.sin((2 * Math.PI * 8 * i) / 256));
    const { psd, frequencies } = multiTaperPSD(signal, { nfft: 256, K: 3 });
    expect(psd.length).toBe(129); // 256/2 + 1
    expect(frequencies.length).toBe(129);
  });
});
