/**
 * Pin tests for Sprint 2R clone-merge batch 8 (G40–G41, G48–G50).
 * Independent oracles — not round-trips through the code under test.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chebyshevFit, legendreFit } from '../src/typed/interpolation.js';
import {
  chebFitDispatch,
  legendreFitDispatch,
  WASM_POLY_FIT_THRESHOLD,
  resetPolyWasm,
  chebBasisRow,
  legendreBasisRow,
} from '../src/wasm/poly/wasm-bridge.js';
import {
  asReadReturnedF64,
  asReadReturnedI32,
  withAsF64,
  withAsI32,
  type RawWasm,
} from '../src/wasm/bridges/common.js';
import {
  argsortF64Dispatch,
  rankF64Dispatch,
  WASM_SORT_THRESHOLD,
} from '../src/wasm/sort/wasm-bridge.js';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import { loadWasm } from '../src/index.js';
import { overrideWasmPolicy, wasmPolicyAllows } from '../src/wasm/policy.js';
import { AS_WASM_PATH, AS_WASM_MISSING_MESSAGE } from './helpers/wasm-spy.js';

function linspace(lo: number, hi: number, n: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i < n; i++) xs.push(lo + (i / (n - 1)) * (hi - lo));
  return xs;
}

/** Closed-form Chebyshev T_n, not the three-term recurrence under test. */
function chebClosed(x: number, n: number): number {
  if (n === 0) return 1;
  if (n === 1) return x;
  if (n === 2) return 2 * x * x - 1;
  if (n === 3) return 4 * x * x * x - 3 * x;
  throw new Error(`chebClosed: no closed form for n=${n}`);
}

/** Closed-form Legendre P_n, not the Bonnet recurrence under test. */
function legendreClosed(x: number, n: number): number {
  if (n === 0) return 1;
  if (n === 1) return x;
  if (n === 2) return (3 * x * x - 1) / 2;
  if (n === 3) return (5 * x * x * x - 3 * x) / 2;
  throw new Error(`legendreClosed: no closed form for n=${n}`);
}

describe('G40/G41 — Chebyshev and Legendre basis recovery (JS path)', () => {
  it('chebyshevFit degree 0 recovers constant T_0 on the JS path', () => {
    const xs = [0, 0.25, 0.5, 0.75, 1];
    const ys = xs.map(() => 7);
    expect(xs.length).toBeLessThan(WASM_POLY_FIT_THRESHOLD);
    const coeffs = chebyshevFit(xs, ys, 0);
    expect(coeffs.length).toBe(1);
    expect(Math.abs(coeffs[0] - 7)).toBeLessThan(1e-10);
  });

  it('chebyshevFit degree 2 recovers T_2 on the JS path', () => {
    const T2 = (x: number) => 2 * x * x - 1;
    const xs = linspace(-1, 1, 12);
    const ys = xs.map(T2);
    const coeffs = chebyshevFit(xs, ys, 2);
    expect(coeffs.length).toBe(3);
    expect(Math.abs(coeffs[2] - 1)).toBeLessThan(1e-8);
    expect(Math.abs(coeffs[0])).toBeLessThan(1e-8);
    expect(Math.abs(coeffs[1])).toBeLessThan(1e-8);
  });

  it('legendreFit degree 2 recovers P_2 on the JS path', () => {
    const P2 = (x: number) => (3 * x * x - 1) / 2;
    const xs = linspace(-1, 1, 12);
    const ys = xs.map(P2);
    const coeffs = legendreFit(xs, ys, 2);
    expect(coeffs.length).toBe(3);
    expect(Math.abs(coeffs[2] - 1)).toBeLessThan(1e-8);
  });

  it('chebBasisRow matches closed-form T_0 and T_2 (and k===0 is empty)', () => {
    expect(chebBasisRow(0.25, 0).length).toBe(0);
    expect(Array.from(chebBasisRow(0.25, 1))).toEqual([chebClosed(0.25, 0)]);
    const x = 0.5;
    const k = 3;
    const shared = chebBasisRow(x, k);
    expect(shared.length).toBe(k);
    for (let j = 0; j < k; j++) expect(shared[j]).toBeCloseTo(chebClosed(x, j), 14);
  });

  it('legendreBasisRow matches closed-form P_2 (and k===0 is empty)', () => {
    expect(legendreBasisRow(0.3, 0).length).toBe(0);
    const x = 0;
    const k = 3;
    const shared = legendreBasisRow(x, k);
    expect(shared.length).toBe(k);
    for (let j = 0; j < k; j++) expect(shared[j]).toBeCloseTo(legendreClosed(x, j), 14);
  });
});

describe('G40/G41 — fit dispatch JS fallback (no WASM)', () => {
  beforeAll(() => resetPolyWasm());
  afterAll(() => resetPolyWasm());

  it('chebFitDispatch fallback recovers T_2 above threshold without WASM', () => {
    const N = WASM_POLY_FIT_THRESHOLD + 20;
    const xs = new Float64Array(linspace(-1, 1, N));
    const T2 = (x: number) => 2 * x * x - 1;
    const ys = new Float64Array(xs.length);
    for (let i = 0; i < xs.length; i++) ys[i] = T2(xs[i]);
    const coeffs = chebFitDispatch(xs, ys, 2);
    expect(coeffs.length).toBe(3);
    expect(Math.abs(coeffs[2] - 1)).toBeLessThan(1e-6);
  });

  it('legendreFitDispatch fallback recovers P_2 above threshold without WASM', () => {
    const N = WASM_POLY_FIT_THRESHOLD + 20;
    const xs = new Float64Array(linspace(-1, 1, N));
    const P2 = (x: number) => (3 * x * x - 1) / 2;
    const ys = new Float64Array(xs.length);
    for (let i = 0; i < xs.length; i++) ys[i] = P2(xs[i]);
    const coeffs = legendreFitDispatch(xs, ys, 2);
    expect(coeffs.length).toBe(3);
    expect(Math.abs(coeffs[2] - 1)).toBeLessThan(1e-6);
  });
});

describe('G48 — asReadReturned length from byteLength', () => {
  function mockHeader(dataStart: number, byteLength: number): { mod: RawWasm; buf: ArrayBuffer } {
    const buf = new ArrayBuffer(dataStart + byteLength + 32);
    const memory = { buffer: buf } as WebAssembly.Memory;
    const dv = new DataView(buf);
    dv.setUint32(4, dataStart, true);
    dv.setUint32(8, byteLength, true);
    return { mod: { memory }, buf };
  }

  it('byteLength 16 yields 2 float64 elements', () => {
    const dataStart = 32;
    const { mod, buf } = mockHeader(dataStart, 16);
    new Float64Array(buf, dataStart, 2).set([1.5, 2.5]);
    const out = asReadReturnedF64(mod, 0);
    expect(out.length).toBe(2);
    expect(out[0]).toBe(1.5);
    expect(out[1]).toBe(2.5);
  });

  it('byteLength 16 yields 4 int32 elements', () => {
    const dataStart = 32;
    const { mod, buf } = mockHeader(dataStart, 16);
    new Int32Array(buf, dataStart, 4).set([10, 20, 30, 40]);
    const out = asReadReturnedI32(mod, 0);
    expect(out.length).toBe(4);
    expect(Array.from(out)).toEqual([10, 20, 30, 40]);
  });
});

describe('G49 — withAsTyped type ids, byte sizes, finally unpin+reset', () => {
  function mockAsRuntime(): {
    wasm: RawWasm;
    news: { size: number; id: number }[];
    unpins: { count: number };
    resets: { count: number };
  } {
    const buf = new ArrayBuffer(4096);
    const news: { size: number; id: number }[] = [];
    const unpins = { count: 0 };
    const resets = { count: 0 };
    let bump = 64;
    const wasm = {
      memory: { buffer: buf } as WebAssembly.Memory,
      __new(size: number, id: number) {
        news.push({ size, id });
        const ptr = bump;
        bump += ((size + 15) & ~15) + 16;
        return ptr;
      },
      __pin(ptr: number) {
        return ptr;
      },
      __unpin() {
        unpins.count += 1;
      },
      heap_reset() {
        resets.count += 1;
      },
    };
    return { wasm: wasm as unknown as RawWasm, news, unpins, resets };
  }

  it('withAsF64 allocates buffer id 1 at 8 bytes/element and typed-array id 5', () => {
    const { wasm, news } = mockAsRuntime();
    const xs = new Float64Array([1, 2, 3]);
    withAsF64(wasm, [xs], () => 0);
    expect(news).toEqual([
      { size: 24, id: 1 },
      { size: 12, id: 5 },
    ]);
  });

  it('withAsI32 allocates buffer id 1 at 4 bytes/element and typed-array id 6', () => {
    const { wasm, news } = mockAsRuntime();
    const xs = new Int32Array([1, 2, 3, 4]);
    withAsI32(wasm, [xs], () => 0);
    expect(news).toEqual([
      { size: 16, id: 1 },
      { size: 12, id: 6 },
    ]);
  });

  it('a thrown body still unpins and heap_resets, and does not rethrow', () => {
    const { wasm, unpins, resets } = mockAsRuntime();
    const out = withAsF64(wasm, [new Float64Array([1])], () => {
      throw new Error('pin');
    });
    expect(out).toBeNull();
    expect(unpins.count).toBe(2);
    expect(resets.count).toBe(1);
  });
});

describe('G50 — argsort/rank stable ties and NaN-last (independent oracles)', () => {
  it('argsort keeps original order for equal values', () => {
    // values 1 at idx 1,4; 2 at 3; 3 at 0,2,5
    const data = new Float64Array([3, 1, 3, 2, 1, 3]);
    expect(Array.from(argsortF64Dispatch(data))).toEqual([1, 4, 3, 0, 2, 5]);
  });

  it('rank is the inverse of a stable argsort for equal values', () => {
    // argsort of [5,5,1,5,2] is [2, 4, 0, 1, 3] → rank [2, 3, 0, 4, 1]
    const data = new Float64Array([5, 5, 1, 5, 2]);
    expect(Array.from(rankF64Dispatch(data))).toEqual([2, 3, 0, 4, 1]);
  });

  it('argsort puts NaN indices last, preserving NaN input order', () => {
    // 1 at 3, 2 at 1, NaNs at 0 then 2
    const data = new Float64Array([NaN, 2, NaN, 1]);
    expect(Array.from(argsortF64Dispatch(data))).toEqual([3, 1, 0, 2]);
  });

  it('rank_f64 stays off the public WASM path (no policy band; n≤5000 is below 16384)', () => {
    expect(WASM_SORT_THRESHOLD).toBe(16384);
    expect(wasmPolicyAllows('rank_f64', 5000)).toBe(false);
    expect(wasmPolicyAllows('rank_f64', 16384)).toBe(false);
    expect(wasmPolicyAllows('argsort_f64', 16384)).toBe(false);
  });
});

const describeIfAS = AS_WASM_PATH ? describe : describe.skip;

it('the AS wasm binary is present (a missing binary fails here, not as a silent skip)', () => {
  expect(AS_WASM_PATH, AS_WASM_MISSING_MESSAGE).not.toBeNull();
});

describeIfAS('G49 — withAsF64 heap_reset after calls', () => {
  let restorePolicy: () => void = () => {};

  beforeAll(async () => {
    wasmLoader.reset();
    expect(await loadWasm(AS_WASM_PATH!)).toBe(true);
    restorePolicy = overrideWasmPolicy({ '*': { min: 0 } });
  });

  afterAll(() => {
    restorePolicy();
    wasmLoader.reset();
  });

  function memoryBytes(): number {
    const mod = wasmLoader.getModule() as unknown as { memory: WebAssembly.Memory };
    return mod.memory.buffer.byteLength;
  }

  it('two withAsF64 calls do not grow linear memory', async () => {
    const wasm = wasmLoader.getModule() as unknown as RawWasm;
    const xs = Float64Array.from([1, 2, 3]);
    for (let i = 0; i < 2; i++) {
      withAsF64(wasm, [xs], () => 1);
    }
    const before = memoryBytes();
    for (let i = 0; i < 50; i++) {
      withAsF64(wasm, [xs], () => 1);
    }
    expect(memoryBytes() - before).toBeLessThanOrEqual(256 * 1024);
  });

  it('withAsF64 still resets heap when body throws', () => {
    const wasm = wasmLoader.getModule() as unknown as RawWasm;
    const xs = Float64Array.from([1]);
    const before = memoryBytes();
    for (let i = 0; i < 30; i++) {
      withAsF64(wasm, [xs], () => {
        throw new Error('pin');
      });
    }
    expect(memoryBytes() - before).toBeLessThanOrEqual(256 * 1024);
  });
});
