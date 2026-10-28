/**
 * Pin tests for clone batch M11 (runUnaryPtr / runChainPtr pointer ABI).
 * Independent oracles — not round-trips through the code under test.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  runUnaryPtr,
  runChainPtr,
  resetScratch,
  type PtrUnaryKernel,
} from '../src/wasm/bridges/common.js';

/** Independent copy of the unary scratch algorithm (pre-merge reference). */
function referenceUnaryPtr(
  mem: WebAssembly.Memory,
  fn: PtrUnaryKernel,
  xs: Float64Array
): Float64Array | null {
  const n = xs.length;
  try {
    let scratchBase = mem.buffer.byteLength;
    const need = 2 * n * 8;
    if (scratchBase + need > mem.buffer.byteLength) {
      mem.grow(Math.ceil((scratchBase + need - mem.buffer.byteLength) / 65536));
    }
    const inOff = scratchBase;
    const outOff = scratchBase + n * 8;
    new Float64Array(mem.buffer, inOff, n).set(xs);
    fn(inOff, outOff, n);
    const result = new Float64Array(n);
    result.set(new Float64Array(mem.buffer, outOff, n));
    return result;
  } catch {
    return null;
  }
}

function freshMem(initialPages = 1): WebAssembly.Memory {
  return new WebAssembly.Memory({ initial: initialPages });
}

describe('M11 — runUnaryPtr pointer ABI (mock memory)', () => {
  beforeEach(() => resetScratch());

  it('matches the independent unary reference on a non-trivial buffer', () => {
    const mem = freshMem(2);
    const scale2: PtrUnaryKernel = (inPtr, outPtr, n) => {
      const viewIn = new Float64Array(mem.buffer, inPtr, n);
      const viewOut = new Float64Array(mem.buffer, outPtr, n);
      for (let i = 0; i < n; i++) viewOut[i] = viewIn[i] * 2;
    };
    const xs = new Float64Array([1, -2, 3.5, 0, Math.PI]);
    const saved = referenceUnaryPtr(mem, scale2, xs);
    resetScratch();
    const out = runUnaryPtr(mem, scale2, xs);
    expect(out).not.toBeNull();
    expect(Array.from(out!)).toEqual(Array.from(saved!));
  });

  it('n = 0 returns an empty Float64Array', () => {
    const mem = freshMem(1);
    const noop: PtrUnaryKernel = () => {};
    const out = runUnaryPtr(mem, noop, new Float64Array());
    expect(out).not.toBeNull();
    expect(out!.length).toBe(0);
  });

  it('returns null when the kernel throws', () => {
    const mem = freshMem(1);
    const boom: PtrUnaryKernel = () => {
      throw new Error('kernel');
    };
    expect(runUnaryPtr(mem, boom, new Float64Array([1]))).toBeNull();
  });

  it('re-acquires views after mem.grow', () => {
    resetScratch();
    const mem = freshMem(1);
    const memRef = mem;
    const add1: PtrUnaryKernel = (inPtr, outPtr, n) => {
      const viewIn = new Float64Array(memRef.buffer, inPtr, n);
      const viewOut = new Float64Array(memRef.buffer, outPtr, n);
      for (let i = 0; i < n; i++) viewOut[i] = viewIn[i] + 1;
    };
    const n = 8192;
    const xs = new Float64Array(n);
    for (let i = 0; i < n; i++) xs[i] = i * 0.001;
    const out = runUnaryPtr(mem, add1, xs);
    expect(out).not.toBeNull();
    expect(out![0]).toBeCloseTo(1, 12);
    expect(out![n - 1]).toBeCloseTo(xs[n - 1] + 1, 12);
  });
});

describe('M11 — runChainPtr pointer ABI (mock memory)', () => {
  beforeEach(() => resetScratch());

  it('applies two kernels in sequence (square then add one)', () => {
    const mem = freshMem(2);
    const memRef = mem;
    const square: PtrUnaryKernel = (inPtr, outPtr, n) => {
      const viewIn = new Float64Array(memRef.buffer, inPtr, n);
      const viewOut = new Float64Array(memRef.buffer, outPtr, n);
      for (let i = 0; i < n; i++) viewOut[i] = viewIn[i] * viewIn[i];
    };
    const addOne: PtrUnaryKernel = (inPtr, outPtr, n) => {
      const viewIn = new Float64Array(memRef.buffer, inPtr, n);
      const viewOut = new Float64Array(memRef.buffer, outPtr, n);
      for (let i = 0; i < n; i++) viewOut[i] = viewIn[i] + 1;
    };
    const xs = new Float64Array([0, 1, 2, -3]);
    const expected = Float64Array.from(xs, (x) => x * x + 1);
    const out = runChainPtr(mem, [square, addOne], xs);
    expect(out).not.toBeNull();
    expect(Array.from(out!)).toEqual(expected);
  });

  it('n = 0 with an empty chain returns empty output', () => {
    const mem = freshMem(1);
    const out = runChainPtr(mem, [], new Float64Array());
    expect(out).not.toBeNull();
    expect(out!.length).toBe(0);
  });

  it('returns null when any kernel in the chain throws', () => {
    const mem = freshMem(1);
    const memRef = mem;
    const ok: PtrUnaryKernel = (inPtr, outPtr, n) => {
      new Float64Array(memRef.buffer, outPtr, n).set(new Float64Array(memRef.buffer, inPtr, n));
    };
    const boom: PtrUnaryKernel = () => {
      throw new Error('chain');
    };
    expect(runChainPtr(mem, [ok, boom], new Float64Array([2]))).toBeNull();
  });
});

describe('M11 — unary via single-kernel chain equivalence', () => {
  beforeEach(() => resetScratch());

  it('runChainPtr([fn], xs) matches saved unary reference bit for bit', () => {
    const mem = freshMem(2);
    const memRef = mem;
    const fn: PtrUnaryKernel = (inPtr, outPtr, n) => {
      const viewIn = new Float64Array(memRef.buffer, inPtr, n);
      const viewOut = new Float64Array(memRef.buffer, outPtr, n);
      for (let i = 0; i < n; i++) viewOut[i] = Math.sin(viewIn[i]);
    };
    const xs = new Float64Array([0, 0.1, 1, -2.5, 10]);
    resetScratch();
    const saved = referenceUnaryPtr(mem, fn, xs);
    resetScratch();
    const viaChain = runChainPtr(mem, [fn], xs);
    expect(viaChain).not.toBeNull();
    expect(Array.from(viaChain!)).toEqual(Array.from(saved!));
  });
});
