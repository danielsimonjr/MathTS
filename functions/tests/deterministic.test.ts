import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { isDeterministic, setDeterministic } from '@danielsimonjr/mathts-core';
import { enableGpu, disableGpu } from '@danielsimonjr/mathts-gpu';
import { computePool } from '@danielsimonjr/mathts-parallel';
import { abs, sin } from '../src/index.js';
import { loadWasm } from '../src/wasm/WasmLoader.js';
import {
  DETERMINISTIC_WASM,
  overrideWasmPolicy,
  wasmDispatchPolicy,
  wasmPolicyAllows,
} from '../src/wasm/policy.js';
import { sortF64Dispatch } from '../src/wasm/sort/wasm-bridge.js';
import { implicitGpuAllowed } from '../src/gpu/implicit.js';
import { fftGpuDispatch } from '../src/gpu/fft-gpu.js';
import { elementwiseChainGpuDispatch } from '../src/gpu/elementwise-gpu.js';
import { GPU_MIN_ELEMENTS } from '@danielsimonjr/mathts-gpu';
import { config } from '../src/config-api.js';
import { parallelGaussQuad, parallelRomberg } from '../src/typed/integration.js';
import { normalDist } from '../src/typed/dist-objects.js';

const N = 1 << 20;
function seeded(n: number, lo: number, hi: number, seed: number): Float64Array {
  let s = seed >>> 0;
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    a[i] = lo + ((hi - lo) * s) / 2 ** 32;
  }
  a.set([0, -0, 5e-324, -5e-324, 1e-300, 1e300, Number.NaN], 0);
  return a;
}
const bits = (x: ArrayLike<number>): BigUint64Array =>
  new BigUint64Array(Float64Array.from(x).buffer);
function jsOnly<T>(f: () => T): T {
  const restore = overrideWasmPolicy({ '*': null });
  try {
    return f();
  } finally {
    restore();
  }
}

afterEach(() => {
  setDeterministic(false);
  disableGpu();
  vi.restoreAllMocks();
});

describe('deterministic mode flag', () => {
  it('is off by default and toggles', () => {
    expect(isDeterministic()).toBe(false);
    setDeterministic(true);
    expect(isDeterministic()).toBe(true);
    setDeterministic(false);
    expect(isDeterministic()).toBe(false);
  });
});

describe('config({ deterministic })', () => {
  it('forwards to setDeterministic and reports the mode', () => {
    expect(config().deterministic).toBe(false);
    expect(config({ deterministic: true }).deterministic).toBe(true);
    expect(isDeterministic()).toBe(true);
    expect('deterministic' in (config() as object)).toBe(true);
    config({ deterministic: false });
    expect(isDeterministic()).toBe(false);
  });
});

describe('WASM policy in deterministic mode', () => {
  beforeAll(async () => {
    expect(await loadWasm()).toBe(true);
  });

  it('keeps exactly the measured bit-identical kernels', () => {
    expect([...DETERMINISTIC_WASM].sort()).toEqual(['array_abs_ptr']);
  });

  it('docs/determinism.md List A names the same kernels', () => {
    const doc = readFileSync(new URL('../../docs/determinism.md', import.meta.url), 'utf8');
    const listA = doc.slice(doc.indexOf('## List A'), doc.indexOf('## List B'));
    const named = [...listA.matchAll(/^\| `(\w+)` \|/gm)].map((m) => m[1]);
    expect(named.sort()).toEqual([...DETERMINISTIC_WASM].sort());
  });

  it('refuses every other kernel, even with a policy override', () => {
    setDeterministic(true);
    const restore = overrideWasmPolicy({ '*': { min: 0 } });
    try {
      for (const k of Object.keys(wasmDispatchPolicy())) {
        expect(wasmPolicyAllows(k, N), k).toBe(DETERMINISTIC_WASM.has(k));
      }
      expect(wasmPolicyAllows('welch_psd', N)).toBe(false);
    } finally {
      restore();
    }
  });

  it('abs through WASM equals the JS bits', () => {
    const a = seeded(N, -1e6, 1e6, 1);
    const js = bits(jsOnly(() => abs(a) as Float64Array));
    setDeterministic(true);
    expect(wasmPolicyAllows('array_abs_ptr', N)).toBe(true);
    expect(bits(abs(a) as Float64Array)).toEqual(js);
  });

  it('sort is forced to JS: the WASM sort orders -0 and +0 differently', () => {
    const a = seeded(N, -1e6, 1e6, 2);
    for (let i = 8; i < 4096; i += 2) a[i] = i % 4 === 0 ? 0 : -0;
    const js = bits(jsOnly(() => sortF64Dispatch(a.slice())));
    const restore = overrideWasmPolicy({ sort_f64: { min: 0 } });
    try {
      expect(bits(sortF64Dispatch(a.slice()))).not.toEqual(js);
      setDeterministic(true);
      expect(bits(sortF64Dispatch(a.slice()))).toEqual(js);
    } finally {
      restore();
    }
  });

  it('sin is forced to JS and equals the JS bits', () => {
    const a = seeded(N, -10, 10, 3);
    const js = bits(jsOnly(() => sin(a) as Float64Array));
    // Off: the policy dispatches sin to WASM at this size and the bits differ (measured).
    const restore = overrideWasmPolicy({ array_sin_ptr: { min: 0 } });
    try {
      expect(bits(sin(a) as Float64Array)).not.toEqual(js);
      setDeterministic(true);
      expect(bits(sin(a) as Float64Array)).toEqual(js);
    } finally {
      restore();
    }
  });
});

describe('implicit GPU in deterministic mode', () => {
  it('follows the flag and the option when off', () => {
    expect(implicitGpuAllowed()).toBe(false);
    expect(implicitGpuAllowed({ gpu: true })).toBe(true);
    enableGpu();
    expect(implicitGpuAllowed()).toBe(true);
    expect(implicitGpuAllowed({ gpu: false })).toBe(false);
  });
  it('the FFT and chain dispatchers ask for a device when off, not when on', async () => {
    const requestAdapter = vi.fn().mockResolvedValue(null);
    vi.stubGlobal('navigator', { gpu: { requestAdapter } });
    try {
      const n = 1 << 20;
      const run = async (): Promise<void> => {
        await fftGpuDispatch(new Float64Array(n), new Float64Array(n), false, { gpu: true });
        await elementwiseChainGpuDispatch(['sin'], new Float64Array(GPU_MIN_ELEMENTS), {
          gpu: true,
        });
      };
      setDeterministic(true);
      await run();
      expect(requestAdapter).not.toHaveBeenCalled();
      setDeterministic(false);
      await run();
      expect(requestAdapter).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('is refused when on, even with gpu: true', () => {
    enableGpu();
    setDeterministic(true);
    expect(implicitGpuAllowed()).toBe(false);
    expect(implicitGpuAllowed({ gpu: true })).toBe(false);
  });
});

describe('worker fan-outs in deterministic mode', () => {
  const f = (x: number): number => x * x;
  it('parallelGaussQuad fans out when off, not when on', async () => {
    vi.spyOn(computePool, 'isReady').mockReturnValue(true);
    const fan = vi.spyOn(computePool, 'integrateFanOut').mockResolvedValue(42);
    expect(await parallelGaussQuad(f, 0, 1, 64, 5, { workerCount: 4 })).toBe(42);
    expect(fan).toHaveBeenCalledTimes(1);
    setDeterministic(true);
    const v = await parallelGaussQuad(f, 0, 1, 64, 5, { workerCount: 4 });
    expect(fan).toHaveBeenCalledTimes(1);
    expect(bits([v])).toEqual(bits([await parallelGaussQuad(f, 0, 1, 64, 5, { workerCount: 1 })]));
  });
  it('parallelRomberg fans out when off, not when on', async () => {
    vi.spyOn(computePool, 'isReady').mockReturnValue(true);
    const fan = vi.spyOn(computePool, 'integrateFanOut').mockResolvedValue(42);
    expect(await parallelRomberg(f, 0, 1, 1e-10, { workerCount: 4 })).toBe(42);
    setDeterministic(true);
    const v = await parallelRomberg(f, 0, 1, 1e-10, { workerCount: 4 });
    expect(fan).toHaveBeenCalledTimes(1);
    expect(bits([v])).toEqual(bits([await parallelRomberg(f, 0, 1, 1e-10, { workerCount: 1 })]));
  });
  it('sampleN fans out when off, not when on', async () => {
    const n = 100_000;
    const ref = await normalDist(0, 1).sampleN(n, { seed: 7 });
    vi.spyOn(computePool, 'isReady').mockReturnValue(true);
    const fan = vi
      .spyOn(computePool, 'distributionSampleFanOut')
      .mockResolvedValue(new Float64Array(n));
    await normalDist(0, 1).sampleN(n, { seed: 7 });
    expect(fan).toHaveBeenCalledTimes(1);
    setDeterministic(true);
    const v = await normalDist(0, 1).sampleN(n, { seed: 7 });
    expect(fan).toHaveBeenCalledTimes(1);
    expect(bits(v)).toEqual(bits(ref));
  });
});
