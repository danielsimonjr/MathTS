/**
 * Tests for the WASM-backed branches of matrix/src/backends/wasm/fft-wasm.ts.
 *
 * The AS artifact loaded here does not export `fft`/`rfft`/`powerSpectrum`
 * (those were legacy-backend exports, not built in this environment), so
 * isWasmFFTAvailable() is false and fft/ifft/rfft/powerSpectrum all take the
 * JS fallback (covered by fft-wasm.test.ts). To exercise the WASM-dispatch
 * code (memory marshalling, in-place transform, re-read from a possibly-grown
 * buffer, free/reset), we inject a fake module backed by a real
 * WebAssembly.Memory whose `fft` performs a genuine in-place radix-2 FFT.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { wasmLoader } from '../../src/backends/WasmLoader.js';
import {
  fft,
  ifft,
  rfft,
  powerSpectrum,
  fftJS,
  isWasmFFTAvailable,
} from '../../src/backends/wasm/fft-wasm.js';

/** In-place interleaved-complex FFT computed via the reference JS transform. */
function inPlaceFFT(buf: Float64Array, n: number, inverse: boolean): void {
  const real = new Float64Array(n);
  const imag = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    real[i] = buf[i * 2];
    imag[i] = buf[i * 2 + 1];
  }
  const r = fftJS(real, imag, inverse);
  for (let i = 0; i < n; i++) {
    buf[i * 2] = r.real[i];
    buf[i * 2 + 1] = r.imag[i];
  }
}

function installFakeFFT(extra: Record<string, unknown> = {}) {
  const memory = new WebAssembly.Memory({ initial: 4 });
  let bump = 1024;
  const allocateFloat64Array = vi.fn((data: number[] | Float64Array) => {
    const length = data.length;
    const offset = bump;
    bump += length * 8 + 8;
    const view = new Float64Array(memory.buffer, offset, length);
    view.set(data);
    return { ptr: offset, dataPtr: offset, array: view, length, kind: 'as' as const };
  });
  const allocateFloat64ArrayEmpty = vi.fn((length: number) => {
    const offset = bump;
    bump += length * 8 + 8;
    return {
      ptr: offset,
      dataPtr: offset,
      array: new Float64Array(memory.buffer, offset, length),
      length,
      kind: 'as' as const,
    };
  });

  const fakeModule = {
    memory,
    fft: (dataPtr: number, n: number, inverse: number) => {
      const buf = new Float64Array(memory.buffer, dataPtr, n * 2);
      inPlaceFFT(buf, n, inverse === 1);
    },
    ...extra,
  };

  vi.spyOn(wasmLoader, 'getModule').mockReturnValue(fakeModule as never);
  vi.spyOn(wasmLoader, 'allocateFloat64Array').mockImplementation(allocateFloat64Array as never);
  vi.spyOn(wasmLoader, 'allocateFloat64ArrayEmpty').mockImplementation(
    allocateFloat64ArrayEmpty as never
  );
  vi.spyOn(wasmLoader, 'free').mockImplementation(() => {});
  return { fakeModule, allocateFloat64Array };
}

describe('fft-wasm — WASM-backed branches (mocked module)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('isWasmFFTAvailable() is true once a module exporting fft is present', () => {
    installFakeFFT();
    expect(isWasmFFTAvailable()).toBe(true);
  });

  it('fft({backend:"wasm"}) routes through the WASM core and matches the JS FFT', () => {
    installFakeFFT();
    const n = 16;
    const real = new Float64Array(n);
    const imag = new Float64Array(n);
    for (let i = 0; i < n; i++) real[i] = Math.sin((2 * Math.PI * 3 * i) / n);

    const w = fft(real, imag, { backend: 'wasm' });
    const j = fftJS(real, imag, false);
    for (let i = 0; i < n; i++) {
      expect(w.real[i]).toBeCloseTo(j.real[i], 8);
      expect(w.imag[i]).toBeCloseTo(j.imag[i], 8);
    }
  });

  it('ifft({backend:"wasm"}) inverts fft({backend:"wasm"})', () => {
    installFakeFFT();
    const n = 32;
    const real = new Float64Array(n);
    const imag = new Float64Array(n);
    for (let i = 0; i < n; i++) real[i] = Math.cos((2 * Math.PI * 5 * i) / n);

    const spec = fft(real, imag, { backend: 'wasm' });
    const recon = ifft(spec.real, spec.imag, { backend: 'wasm' });
    for (let i = 0; i < n; i++) {
      expect(recon.real[i]).toBeCloseTo(real[i], 8);
      expect(recon.imag[i]).toBeCloseTo(0, 8);
    }
  });

  it('fftWasmCore returns empty for a zero-length input on the wasm path', () => {
    installFakeFFT();
    const r = fft(new Float64Array(0), new Float64Array(0), { backend: 'wasm' });
    expect(r.real.length).toBe(0);
    expect(r.imag.length).toBe(0);
  });

  it('rfft uses the dedicated WASM rfft export when present', () => {
    const n = 16;
    installFakeFFT({
      rfft: (dataPtr: number, len: number, resultPtr: number) => {
        // Read input, FFT it, write interleaved result.
        const mod = wasmLoader.getModule()! as unknown as { memory: WebAssembly.Memory };
        const data = new Float64Array(mod.memory.buffer, dataPtr, len);
        const imag = new Float64Array(len);
        const r = fftJS(new Float64Array(data), imag, false);
        const out = new Float64Array(mod.memory.buffer, resultPtr, len * 2);
        for (let i = 0; i < len; i++) {
          out[i * 2] = r.real[i];
          out[i * 2 + 1] = r.imag[i];
        }
      },
    });
    const data = new Float64Array(n);
    for (let i = 0; i < n; i++) data[i] = Math.cos((2 * Math.PI * 2 * i) / n);

    const w = rfft(data, { backend: 'wasm' });
    const j = fftJS(new Float64Array(data), new Float64Array(n), false);
    for (let i = 0; i < n; i++) {
      expect(w.real[i]).toBeCloseTo(j.real[i], 8);
      expect(w.imag[i]).toBeCloseTo(j.imag[i], 8);
    }
  });

  it('rfft falls back to standard fft when no dedicated rfft export exists', () => {
    installFakeFFT(); // no rfft on the module
    const n = 8;
    const data = new Float64Array(n);
    data[0] = 1;
    const w = rfft(data, { backend: 'wasm' });
    // FFT of an impulse is a flat spectrum of 1s.
    for (let i = 0; i < n; i++) expect(w.real[i]).toBeCloseTo(1, 8);
  });

  it('powerSpectrum uses the WASM export when present', () => {
    installFakeFFT({
      powerSpectrum: (dataPtr: number, len: number, resultPtr: number) => {
        const mod = wasmLoader.getModule()! as unknown as { memory: WebAssembly.Memory };
        const data = new Float64Array(mod.memory.buffer, dataPtr, len * 2);
        const out = new Float64Array(mod.memory.buffer, resultPtr, len);
        for (let i = 0; i < len; i++) {
          out[i] = data[i * 2] * data[i * 2] + data[i * 2 + 1] * data[i * 2 + 1];
        }
      },
    });
    const real = new Float64Array([3, 4, 0, 0]);
    const imag = new Float64Array([0, 0, 1, -1]);
    const p = powerSpectrum(real, imag);
    expect(p[0]).toBeCloseTo(9);
    expect(p[1]).toBeCloseTo(16);
    expect(p[2]).toBeCloseTo(1);
    expect(p[3]).toBeCloseTo(1);
  });
});
