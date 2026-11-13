import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadWasm, welchPSD, bartlettPSD } from '../src/index.js';
import { overrideWasmPolicy } from '../src/wasm/policy.js';
import { AS_WASM_PATH, AS_WASM_MISSING_MESSAGE, countExportCalls } from './helpers/wasm-spy.js';

/**
 * `welch_psd_f64` and `bartlett_psd_f64` in the AS binary zero-pad each frame to the next power of
 * two, so a frame that is not a power of two puts bin k at k / nextPow2(frame), not at k / frame
 * (#897). The bridge sends only power-of-two frames to the binary; any other frame takes the JS
 * path, which uses an exact-length DFT. The policy is overridden so the binary is allowed at any
 * size and the guard in the bridge is the only thing that keeps a frame of 100 out of it.
 */
describe('#897 — welch and bartlett send only power-of-two frames to the AS kernel', () => {
  let restore: () => void = () => {};
  beforeAll(async () => {
    expect(AS_WASM_PATH, AS_WASM_MISSING_MESSAGE).not.toBeNull();
    await loadWasm();
    restore = overrideWasmPolicy({ '*': { min: 0 } });
  });
  afterAll(() => restore());

  // 5,000 samples: above the 4,096-sample dispatch threshold. Period 100, so bin 4 of a 100-frame.
  const x = Array.from({ length: 5000 }, (_, i) => Math.sin((2 * Math.PI * 4 * i) / 100));
  const peak = (a: number[]): number => a.indexOf(Math.max(...a));

  it('a power-of-two frame reaches the kernel (the spy sees it)', () => {
    const { counts } = countExportCalls(['welch_psd_f64', 'bartlett_psd_f64'], () => {
      welchPSD(x, { frameLength: 128 });
      bartlettPSD(x, { frameLength: 128 });
    });
    expect(counts['welch_psd_f64']).toBeGreaterThan(0);
    expect(counts['bartlett_psd_f64']).toBeGreaterThan(0);
  });

  it('a frame of 100 does not reach the kernel and puts the tone at 4 / 100', () => {
    const { result, counts } = countExportCalls(['welch_psd_f64', 'bartlett_psd_f64'], () => ({
      w: welchPSD(x, { frameLength: 100 }),
      b: bartlettPSD(x, { frameLength: 100 }),
    }));
    expect(counts['welch_psd_f64']).toBe(0);
    expect(counts['bartlett_psd_f64']).toBe(0);
    expect(result.w.frequencies[peak(result.w.psd)]).toBeCloseTo(0.04, 12);
    expect(result.b.frequencies[peak(result.b.psd)]).toBeCloseTo(0.04, 12);
  });
});
