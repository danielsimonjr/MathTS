/**
 * Migration Phase 3a — elementwise bridge repointed to the
 * AssemblyScript pointer-ABI kernels (`array_<op>_ptr`).
 *
 * Proves the AS-load path end-to-end for the elementwise bridge:
 *   1. The functions loader can load the AS binary and the loaded module
 *      exports `array_sin_ptr` + the AS managed runtime (`__new`) and does NOT
 *      export the legacy `simd_sin_array`.
 *   2. `elementwiseUnaryDispatch` actually executes the AS `array_<op>_ptr`
 *      kernel (returns a non-null result — JS fallback returns null) and the
 *      result is bit-close to JS `Math.*` for every accelerated op.
 *   3. `elementwiseChainDispatch` (op-fusion) runs the AS kernels in-memory and
 *      matches a sequential JS pass, without mutating the input.
 *   4. Below threshold the dispatch returns null (caller uses JS).
 *
 * RED before the repoint: the bridge probed `simd_<op>_array`, which the AS
 * binary does NOT export, so every dispatch returned null (fails `not.toBeNull`).
 * GREEN after repointing the probe to `array_<op>_ptr`.
 *
 * The test is skipped when no AS artifact is present (e.g. AS not built).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import { resetScratch } from '../src/wasm/bridges/common.js';
import {
  elementwiseUnaryDispatch,
  elementwiseChainDispatch,
  WASM_ELEMENTWISE_THRESHOLD,
  WASM_ELEMENTWISE_OPS,
  type WasmElementwiseOp,
} from '../src/wasm/elementwise/wasm-bridge.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Locate the AS binary (functions' own copy first, then matrix's). */
const AS_PATH = (() => {
  for (const rel of ['../dist/wasm/mathts-as.wasm', '../../matrix/dist/wasm/mathts-as.wasm']) {
    const c = resolve(here, rel);
    if (existsSync(c)) return c;
  }
  return null;
})();
const describeIfAS = AS_PATH ? describe : describe.skip;

/** Per-op domain-safe input generator. */
function gen(op: WasmElementwiseOp, i: number): number {
  switch (op) {
    case 'abs': return (i % 2 ? -1 : 1) * (0.5 + (i % 50) * 0.01);
    case 'log': case 'log2': case 'log10': return 0.1 + (i % 100) * 0.05;
    case 'log1p': return (i % 100) * 0.05;
    case 'atanh': return -0.99 + (i % 199) * 0.01;
    case 'sec': return -1.4 + (i % 280) * 0.01;
    case 'csc': case 'cot': return 0.1 + (i % 130) * 0.01;
    case 'expm1': return -2 + (i % 40) * 0.1;
    case 'exp': return ((i % 40) - 20) * 0.1;
    case 'erfc': return -3 + (i % 120) * 0.05;
    default: return (i % 97) * 0.03;
  }
}

/** Reference Math.* (or reciprocal) for an op; null = no closed-form ref here. */
function ref(op: WasmElementwiseOp): ((x: number) => number) | null {
  switch (op) {
    case 'sec': return (x) => 1 / Math.cos(x);
    case 'csc': return (x) => 1 / Math.sin(x);
    case 'cot': return (x) => 1 / Math.tan(x);
    case 'erfc': return null; // covered by diff-special; here we assert finite-ness only
    default: return (Math as unknown as Record<string, (x: number) => number>)[op] ?? null;
  }
}

describeIfAS('elementwise AS pointer-kernel dispatch (Phase 3a)', () => {
  beforeAll(async () => {
    wasmLoader.reset();
    resetScratch();
    await wasmLoader.load(AS_PATH!);
  });

  afterAll(() => {
    wasmLoader.reset();
    resetScratch();
  });

  it('loaded the AS binary (array_sin_ptr + __new present, simd_sin_array absent)', () => {
    const mod = wasmLoader.getModule() as unknown as Record<string, unknown>;
    expect(mod).not.toBeNull();
    expect(typeof mod.array_sin_ptr).toBe('function');
    expect(typeof mod.simd_sin_array).not.toBe('function'); // legacy name — gone
    expect('__new' in mod).toBe(true); // AS managed runtime
  });

  it('routes every accelerated op to array_<op>_ptr and matches JS (not JS-fallback null)', () => {
    const n = Math.max(WASM_ELEMENTWISE_THRESHOLD, 2048);
    const mod = wasmLoader.getModule() as unknown as Record<string, unknown>;
    for (const op of WASM_ELEMENTWISE_OPS) {
      expect(typeof mod[`array_${op}_ptr`], `${op}: AS kernel exported`).toBe('function');
      const xs = new Float64Array(n);
      for (let i = 0; i < n; i++) xs[i] = gen(op, i);
      const out = elementwiseUnaryDispatch(op, xs);
      // Non-null PROVES the AS pointer kernel executed (JS fallback returns null).
      expect(out, `${op}: should execute AS kernel, not fall back to JS`).not.toBeNull();
      expect(out!.length).toBe(n);
      const r = ref(op);
      if (r) {
        let maxRel = 0;
        for (let i = 0; i < n; i++) {
          const e = r(xs[i]);
          maxRel = Math.max(maxRel, Math.abs(out![i] - e) / (Math.abs(e) > 1e-12 ? Math.abs(e) : 1));
        }
        expect(maxRel, `${op}: AS vs JS worst rel`).toBeLessThan(1e-12);
      } else {
        // erfc: at least confirm finite, real output from the kernel.
        for (let i = 0; i < n; i++) expect(Number.isFinite(out![i])).toBe(true);
      }
    }
  });

  it('op-fusion (elementwiseChainDispatch) runs AS kernels in-memory and matches sequential JS', () => {
    const n = 2048;
    const chains: WasmElementwiseOp[][] = [
      ['sin', 'exp', 'log1p', 'tanh'],
      ['abs', 'atan'],
      ['exp', 'log2', 'sin'],
    ];
    const input = new Float64Array(n);
    for (let i = 0; i < n; i++) input[i] = (i % 100) * 0.01;
    const snapshot = Float64Array.from(input);

    for (const chain of chains) {
      const got = elementwiseChainDispatch(chain, input);
      expect(got, `[${chain.join('->')}]: should execute AS kernels, not null`).not.toBeNull();
      const want = Float64Array.from(input);
      for (const op of chain) {
        const f = (Math as unknown as Record<string, (x: number) => number>)[op];
        for (let i = 0; i < want.length; i++) want[i] = f(want[i]);
      }
      let maxRel = 0;
      for (let i = 0; i < n; i++) {
        maxRel = Math.max(
          maxRel,
          Math.abs(got![i] - want[i]) / (Math.abs(want[i]) > 1e-12 ? Math.abs(want[i]) : 1)
        );
      }
      expect(maxRel, `[${chain.join('->')}]: fused vs sequential`).toBeLessThan(1e-12);
    }
    // The chain must not mutate the caller's input.
    expect(Array.from(input)).toEqual(Array.from(snapshot));
  });

  it('returns null below threshold (caller uses JS path)', () => {
    const small = new Float64Array(WASM_ELEMENTWISE_THRESHOLD - 1).fill(0.3);
    expect(elementwiseUnaryDispatch('sin', small)).toBeNull();
    expect(elementwiseChainDispatch(['sin', 'cos'], small)).toBeNull();
  });
});

/**
 * Phase 3a invariant: the functions loader DEFAULTS to the AS binary. We verify
 * the no-arg load resolves to `mathts-as.wasm` (exporting array_sin_ptr).
 * Requires the package's own dist copy (created by scripts/copy-wasm.mjs).
 */
const FUNCTIONS_AS = resolve(here, '../dist/wasm/mathts-as.wasm');
const describeIfDist = existsSync(FUNCTIONS_AS) ? describe : describe.skip;

describeIfDist('functions WASM loader default backend (Phase 3a cutover)', () => {
  afterAll(() => {
    wasmLoader.reset();
    resetScratch();
  });

  it('no-arg load() resolves to the AS binary (mathts-as.wasm)', async () => {
    delete process.env.MATHTS_WASM_BACKEND;
    delete process.env.MATHJS_WASM_BACKEND;
    wasmLoader.reset();
    resetScratch();
    const mod = (await wasmLoader.load()) as unknown as Record<string, unknown>;
    expect(typeof mod.array_sin_ptr).toBe('function'); // AS sentinel
    expect(typeof mod.simd_sin_array).not.toBe('function'); // not the legacy pointer binary
  });
});
