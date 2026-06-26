/**
 * Tests for WASM-accelerated FFT operations
 *
 * Tests the JavaScript fallback path since the Rust WASM binary may not
 * be available in CI. The FFT correctness tests verify both forward and
 * inverse transforms, convolution, and spectral analysis.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  fftJS,
  isPowerOf2,
  nextPowerOf2,
  magnitudeSpectrum,
  phaseSpectrum,
  convolve,
  fft,
  ifft,
  rfft,
  powerSpectrum,
} from '../../src/backends/wasm/fft-wasm.js';
import { wasmLoader } from '../../src/backends/WasmLoader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Phase 7b: the matrix loader defaults to the AssemblyScript binary. Gate the
// live-WASM round-trip on the AS artifact the loader actually resolves
// (matrix/dist/wasm/mathts-as.wasm), not the retired Rust copy.
const asWasmPath = path.resolve(here, '../../dist/wasm/mathts-as.wasm');
const wasmAvailable = fs.existsSync(asWasmPath);

// =============================================================================
// Utility: isPowerOf2 / nextPowerOf2
// =============================================================================

describe('isPowerOf2', () => {
  it('returns true for powers of 2', () => {
    expect(isPowerOf2(1)).toBe(true);
    expect(isPowerOf2(2)).toBe(true);
    expect(isPowerOf2(4)).toBe(true);
    expect(isPowerOf2(8)).toBe(true);
    expect(isPowerOf2(256)).toBe(true);
    expect(isPowerOf2(1024)).toBe(true);
  });

  it('returns false for non-powers of 2', () => {
    expect(isPowerOf2(0)).toBe(false);
    expect(isPowerOf2(3)).toBe(false);
    expect(isPowerOf2(5)).toBe(false);
    expect(isPowerOf2(6)).toBe(false);
    expect(isPowerOf2(7)).toBe(false);
    expect(isPowerOf2(100)).toBe(false);
  });
});

describe('nextPowerOf2', () => {
  it('returns next power of 2', () => {
    expect(nextPowerOf2(1)).toBe(1);
    expect(nextPowerOf2(2)).toBe(2);
    expect(nextPowerOf2(3)).toBe(4);
    expect(nextPowerOf2(5)).toBe(8);
    expect(nextPowerOf2(100)).toBe(128);
    expect(nextPowerOf2(1000)).toBe(1024);
  });
});

// =============================================================================
// FFT Core (JS Fallback)
// =============================================================================

describe('fftJS', () => {
  it('handles empty input', () => {
    const result = fftJS(new Float64Array(0), new Float64Array(0));
    expect(result.real.length).toBe(0);
    expect(result.imag.length).toBe(0);
  });

  it('handles single element', () => {
    const result = fftJS(new Float64Array([5.0]), new Float64Array([0.0]));
    expect(result.real[0]).toBeCloseTo(5.0);
    expect(result.imag[0]).toBeCloseTo(0.0);
  });

  it('computes FFT of DC signal', () => {
    const n = 8;
    const real = new Float64Array(n).fill(1.0);
    const imag = new Float64Array(n).fill(0.0);

    const result = fftJS(real, imag);

    // DC component should equal n, all others should be 0
    expect(result.real[0]).toBeCloseTo(n);
    expect(result.imag[0]).toBeCloseTo(0.0);
    for (let i = 1; i < n; i++) {
      expect(result.real[i]).toBeCloseTo(0.0, 10);
      expect(result.imag[i]).toBeCloseTo(0.0, 10);
    }
  });

  it('computes FFT of impulse signal', () => {
    const n = 8;
    const real = new Float64Array(n);
    const imag = new Float64Array(n);
    real[0] = 1.0; // impulse at t=0

    const result = fftJS(real, imag);

    // FFT of impulse should be flat spectrum (all 1s)
    for (let i = 0; i < n; i++) {
      expect(result.real[i]).toBeCloseTo(1.0, 10);
      expect(result.imag[i]).toBeCloseTo(0.0, 10);
    }
  });

  it('computes FFT of sine wave and finds correct peak', () => {
    const n = 256;
    const freq = 10;
    const real = new Float64Array(n);
    const imag = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      real[i] = Math.sin((2 * Math.PI * freq * i) / n);
    }

    const result = fftJS(real, imag);

    // Find peak magnitude
    const mag = magnitudeSpectrum(result.real, result.imag);
    let maxIdx = 0;
    let maxVal = 0;
    for (let i = 1; i < n / 2; i++) {
      if (mag[i] > maxVal) {
        maxVal = mag[i];
        maxIdx = i;
      }
    }

    expect(maxIdx).toBe(freq);
    expect(maxVal).toBeCloseTo(n / 2, 5); // Amplitude of n/2 for sine
  });

  it('roundtrips through FFT -> IFFT', () => {
    const n = 64;
    const real = new Float64Array(n);
    const imag = new Float64Array(n);

    // Create a test signal
    for (let i = 0; i < n; i++) {
      real[i] = Math.sin((2 * Math.PI * 3 * i) / n) + 0.5 * Math.cos((2 * Math.PI * 7 * i) / n);
    }

    const spectrum = fftJS(real, imag, false);
    const reconstructed = fftJS(spectrum.real, spectrum.imag, true);

    for (let i = 0; i < n; i++) {
      expect(reconstructed.real[i]).toBeCloseTo(real[i], 10);
      expect(reconstructed.imag[i]).toBeCloseTo(0.0, 10);
    }
  });

  it('throws for non-power-of-2 length', () => {
    expect(() => {
      fftJS(new Float64Array(3), new Float64Array(3));
    }).toThrow('power of 2');
  });
});

// =============================================================================
// High-level fft/ifft (auto backend selection, falls back to JS)
// =============================================================================

describe('fft (auto backend)', () => {
  it('computes FFT with JS backend for small arrays', () => {
    const n = 16;
    const real = new Float64Array(n);
    const imag = new Float64Array(n);
    real[0] = 1.0;

    const result = fft(real, imag, { backend: 'js' });

    for (let i = 0; i < n; i++) {
      expect(result.real[i]).toBeCloseTo(1.0, 10);
      expect(result.imag[i]).toBeCloseTo(0.0, 10);
    }
  });

  it('computes IFFT correctly', () => {
    const n = 32;
    const real = new Float64Array(n);
    const imag = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      real[i] = Math.sin((2 * Math.PI * 5 * i) / n);
    }

    const spectrum = fft(real, imag);
    const reconstructed = ifft(spectrum.real, spectrum.imag);

    for (let i = 0; i < n; i++) {
      expect(reconstructed.real[i]).toBeCloseTo(real[i], 10);
    }
  });
});

// =============================================================================
// rfft (real FFT)
// =============================================================================

describe('rfft', () => {
  it('computes real FFT (same as fft with zero imaginary)', () => {
    const n = 64;
    const data = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      data[i] = Math.cos((2 * Math.PI * 8 * i) / n);
    }

    const result = rfft(data, { backend: 'js' });
    const expected = fft(data, new Float64Array(n), { backend: 'js' });

    for (let i = 0; i < n; i++) {
      expect(result.real[i]).toBeCloseTo(expected.real[i], 10);
      expect(result.imag[i]).toBeCloseTo(expected.imag[i], 10);
    }
  });
});

// =============================================================================
// Spectral Analysis
// =============================================================================

describe('powerSpectrum', () => {
  it('computes |X[k]|^2', () => {
    const real = new Float64Array([3, 4, 0, 0]);
    const imag = new Float64Array([0, 0, 1, -1]);

    const result = powerSpectrum(real, imag);

    expect(result[0]).toBeCloseTo(9);
    expect(result[1]).toBeCloseTo(16);
    expect(result[2]).toBeCloseTo(1);
    expect(result[3]).toBeCloseTo(1);
  });
});

describe('magnitudeSpectrum', () => {
  it('computes |X[k]|', () => {
    const real = new Float64Array([3, 0]);
    const imag = new Float64Array([4, 0]);

    const result = magnitudeSpectrum(real, imag);

    expect(result[0]).toBeCloseTo(5.0);
    expect(result[1]).toBeCloseTo(0.0);
  });
});

describe('phaseSpectrum', () => {
  it('computes angle(X[k])', () => {
    const real = new Float64Array([1, 0, -1, 0]);
    const imag = new Float64Array([0, 1, 0, -1]);

    const result = phaseSpectrum(real, imag);

    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(Math.PI / 2);
    expect(result[2]).toBeCloseTo(Math.PI);
    expect(result[3]).toBeCloseTo(-Math.PI / 2);
  });
});

// =============================================================================
// Convolution
// =============================================================================

describe('convolve', () => {
  it('convolves two simple signals', () => {
    const signal = new Float64Array([1, 2, 3]);
    const kernel = new Float64Array([1, 1]);

    const result = convolve(signal, kernel, { backend: 'js' });

    // conv([1,2,3], [1,1]) = [1, 3, 5, 3]
    expect(result.length).toBe(4);
    expect(result[0]).toBeCloseTo(1);
    expect(result[1]).toBeCloseTo(3);
    expect(result[2]).toBeCloseTo(5);
    expect(result[3]).toBeCloseTo(3);
  });

  it('convolves impulse with signal (identity)', () => {
    const signal = new Float64Array([1, 2, 3, 4]);
    const impulse = new Float64Array([1]);

    const result = convolve(signal, impulse, { backend: 'js' });

    expect(result.length).toBe(4);
    for (let i = 0; i < 4; i++) {
      expect(result[i]).toBeCloseTo(signal[i]);
    }
  });

  it('handles empty inputs', () => {
    const empty = new Float64Array(0);
    const signal = new Float64Array([1, 2, 3]);

    expect(convolve(empty, signal).length).toBe(0);
    expect(convolve(signal, empty).length).toBe(0);
  });

  it('convolves longer signals correctly', () => {
    const n = 64;
    const signal = new Float64Array(n);
    const kernel = new Float64Array(8);

    for (let i = 0; i < n; i++) signal[i] = Math.sin((2 * Math.PI * i) / n);
    for (let i = 0; i < 8; i++) kernel[i] = 1.0 / 8; // moving average

    const result = convolve(signal, kernel, { backend: 'js' });
    expect(result.length).toBe(n + 8 - 1);
    // Result should be a smoothed sine -- just verify it's finite
    for (let i = 0; i < result.length; i++) {
      expect(isFinite(result[i])).toBe(true);
    }
  });
});

// =============================================================================
// Parseval's Theorem Verification
// =============================================================================

// =============================================================================
// WASM Backend Round-Trip (exercises the previously-dead bridge path).
// Before the Rust/AS hybrid-allocator fix landed, these tests crashed in
// `wasmLoader.allocateFloat64Array` because the Rust artifact (the default)
// has no `__new` export. They are the live regression guard for that bug.
// =============================================================================

describe('fft (wasm backend)', () => {
  beforeAll(async () => {
    if (!wasmAvailable) return;
    wasmLoader.reset();
    // No path arg → loader resolves the AS binary (its Phase 7b default).
    await wasmLoader.load();
  });

  it.runIf(wasmAvailable)('loads the AssemblyScript binary (allocator kind "as")', () => {
    expect(wasmLoader.getAllocatorKind()).toBe('as');
    const mod = wasmLoader.getModule();
    expect(mod).not.toBeNull();
    expect(typeof mod!.fft).toBe('function');
  });

  it.runIf(wasmAvailable)('fft + ifft round-trip with WASM backend', () => {
    const n = 64;
    const real = new Float64Array(n);
    const imag = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      real[i] = Math.cos((2 * Math.PI * 4 * i) / n);
    }

    const spectrum = fft(real, imag, { backend: 'wasm' });
    expect(spectrum.real.length).toBe(n);
    expect(spectrum.imag.length).toBe(n);

    const recon = ifft(spectrum.real, spectrum.imag, { backend: 'wasm' });
    for (let i = 0; i < n; i++) {
      expect(recon.real[i]).toBeCloseTo(real[i], 8);
      expect(recon.imag[i]).toBeCloseTo(0, 8);
    }
  });

  it.runIf(wasmAvailable)('wasm-backend fft matches js-backend fft for the same input', () => {
    const n = 32;
    const real = new Float64Array(n);
    const imag = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      real[i] = Math.sin((2 * Math.PI * 5 * i) / n) + 0.25 * Math.cos((2 * Math.PI * 11 * i) / n);
    }

    const jsSpec = fft(real, imag, { backend: 'js' });
    const wasmSpec = fft(real, imag, { backend: 'wasm' });

    for (let i = 0; i < n; i++) {
      expect(wasmSpec.real[i]).toBeCloseTo(jsSpec.real[i], 8);
      expect(wasmSpec.imag[i]).toBeCloseTo(jsSpec.imag[i], 8);
    }
  });
});

describe('Parseval theorem', () => {
  it('energy in time domain equals energy in frequency domain', () => {
    const n = 128;
    const real = new Float64Array(n);
    const imag = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      real[i] = Math.sin((2 * Math.PI * 5 * i) / n) + Math.cos((2 * Math.PI * 13 * i) / n);
    }

    // Time-domain energy
    let timeDomainEnergy = 0;
    for (let i = 0; i < n; i++) {
      timeDomainEnergy += real[i] * real[i];
    }

    // Frequency-domain energy
    const spectrum = fft(real, imag, { backend: 'js' });
    const power = powerSpectrum(spectrum.real, spectrum.imag);
    let freqDomainEnergy = 0;
    for (let i = 0; i < n; i++) {
      freqDomainEnergy += power[i];
    }
    freqDomainEnergy /= n; // Parseval's theorem: sum |X|^2 / N

    expect(freqDomainEnergy).toBeCloseTo(timeDomainEnergy, 8);
  });
});
