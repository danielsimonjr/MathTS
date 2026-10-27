/**
 * Pin tests for Sprint 2R clone-merge batch 8 (G40–G41, G48–G50).
 * Independent oracles — not round-trips through the code under test where avoidable.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chebyshevFit, legendreFit } from '../src/typed/interpolation.js';
import {
  chebFitDispatch,
  legendreFitDispatch,
  WASM_POLY_FIT_THRESHOLD,
  resetPolyWasm,
} from '../src/wasm/poly/wasm-bridge.js';
import {
  asReadReturnedF64,
  asReadReturnedI32,
  withAsF64,
  type RawWasm,
} from '../src/wasm/bridges/common.js';
import {
  argsortF64Dispatch,
  rankF64Dispatch,
  argsortF64JS,
  rankF64JS,
} from '../src/wasm/sort/wasm-bridge.js';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import { loadWasm } from '../src/index.js';
import { overrideWasmPolicy } from '../src/wasm/policy.js';
import { AS_WASM_PATH, AS_WASM_MISSING_MESSAGE } from './helpers/wasm-spy.js';

function linspace(lo: number, hi: number, n: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i < n; i++) xs.push(lo + (i / (n - 1)) * (hi - lo));
  return xs;
}

/** Independent Chebyshev-T row (power basis oracle for pin comparisons). */
function chebBasisOracle(x: number, k: number): number[] {
  const row = new Array<number>(k);
  let tPrev = 1;
  let tCurr = x;
  row[0] = tPrev;
  if (k > 1) row[1] = tCurr;
  for (let j = 2; j < k; j++) {
    const tNext = 2 * x * tCurr - tPrev;
    row[j] = tNext;
    tPrev = tCurr;
    tCurr = tNext;
  }
  return row;
}

/** Independent Legendre-P row. */
function legendreBasisOracle(x: number, k: number): number[] {
  const row = new Array<number>(k);
  let pPrev = 1;
  let pCurr = x;
  row[0] = pPrev;
  if (k > 1) row[1] = pCurr;
  for (let n = 1; n < k - 1; n++) {
    const pNext = ((2 * n + 1) * x * pCurr - n * pPrev) / (n + 1);
    row[n + 1] = pNext;
    pPrev = pCurr;
    pCurr = pNext;
  }
  return row;
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

  it('independent Chebyshev basis oracle: T_2(0.5) = -0.5', () => {
    const row = chebBasisOracle(0.5, 3);
    expect(row[0]).toBe(1);
    expect(row[1]).toBe(0.5);
    expect(row[2]).toBeCloseTo(-0.5, 14);
  });

  it('independent Legendre basis oracle: P_2(0) = -0.5', () => {
    const row = legendreBasisOracle(0, 3);
    expect(row[0]).toBe(1);
    expect(row[1]).toBe(0);
    expect(row[2]).toBeCloseTo(-0.5, 14);
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

describe('G50 — argsort/rank stable ties and NaN-last (dispatch matches JS)', () => {
  it('argsortF64Dispatch preserves stable order for equal values', () => {
    const data = new Float64Array([3, 1, 3, 2, 1, 3]);
    const js = argsortF64JS(data);
    const disp = argsortF64Dispatch(data);
    expect(Array.from(disp)).toEqual(Array.from(js));
  });

  it('rankF64Dispatch preserves stable ranks for equal values', () => {
    const data = new Float64Array([5, 5, 1, 5, 2]);
    const js = rankF64JS(data);
    const disp = rankF64Dispatch(data);
    expect(Array.from(disp)).toEqual(Array.from(js));
  });

  it('argsort puts NaN indices last (dispatch matches JS)', () => {
    const data = new Float64Array([NaN, 2, NaN, 1]);
    const js = argsortF64JS(data);
    const disp = argsortF64Dispatch(data);
    expect(Array.from(disp)).toEqual(Array.from(js));
    expect(Number.isNaN(data[js[js.length - 1]])).toBe(true);
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
