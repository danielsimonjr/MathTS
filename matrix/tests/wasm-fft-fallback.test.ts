import { describe, it, expect } from 'vitest';
import { MatrixWasmBridge } from '../src/backends/MatrixWasmBridge.js';

/**
 * JS radix-2 FFT fallback in MatrixWasmBridge (EXPANSION_PLAN W10).
 * `{ useWasm: false }` forces the pure-JS path.
 */
describe('MatrixWasmBridge JS FFT fallback', () => {
  it('computes the DFT of a constant signal', async () => {
    // signal [1,1,1,1] as interleaved complex (real, imag pairs)
    const data = new Float64Array([1, 0, 1, 0, 1, 0, 1, 0]);
    const out = await MatrixWasmBridge.fft(data, false, {
      useWasm: false,
    } as never);
    expect(out[0]).toBeCloseTo(4, 10); // DC bin = sum
    for (let i = 1; i < 8; i++) expect(out[i]).toBeCloseTo(0, 10);
  });

  it('round-trips forward then inverse FFT', async () => {
    const signal = new Float64Array([
      3, 0, -1, 0, 7, 0, 2, 0, 0, 0, 5, 0, -4, 0, 1, 0,
    ]);
    const fwd = await MatrixWasmBridge.fft(signal, false, {
      useWasm: false,
    } as never);
    const back = await MatrixWasmBridge.fft(fwd, true, {
      useWasm: false,
    } as never);
    for (let i = 0; i < signal.length; i++) {
      expect(back[i]).toBeCloseTo(signal[i], 9);
    }
  });

  it('rejects non-power-of-two lengths', async () => {
    const data = new Float64Array([1, 0, 2, 0, 3, 0]); // n = 3
    await expect(
      MatrixWasmBridge.fft(data, false, { useWasm: false } as never)
    ).rejects.toThrow('power-of-two');
  });
});
