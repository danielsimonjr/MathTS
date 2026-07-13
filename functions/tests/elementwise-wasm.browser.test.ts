/**
 * Browser WASM gate for the elementwise chain-fusion bridge.
 *
 * History (2026-07-13): the WASM acceleration tier was DEAD IN THE BROWSER.
 * `elementwiseChainDispatch` returned `null` for every input, no matter how
 * large, because `wasmLoader.load()` rejected with
 * `TypeError: HTTP status code is not ok` — the browser branch of
 * `WasmLoader#getDefaultWasmPath` (via `defaultWasmLocation(..., { browser:
 * true })`) took a SINGLE relative-URL guess, `./wasm/<file>` next to the
 * running module. That guess is only correct once tsup has bundled
 * `WasmLoader.ts` into a single `dist/index.js` sitting next to `dist/wasm/`
 * — it 404s for any other layout, including this very test file, which Vite
 * serves directly from unbundled `src/` (so `import.meta.url` for
 * `WasmLoader.ts` pointed at `functions/src/wasm/`, one directory short of
 * where `mathts-as.wasm` actually lives: `functions/dist/wasm/`).
 *
 * Root-cause fix: `resolveBrowserWasm` (functions/src/wasm/resolve.ts) walks
 * up from the calling module's URL — the same two relative shapes Node's
 * `resolvePackagedWasm` checks (`wasm/<file>`, `dist/wasm/<file>`) — probing
 * each candidate with `fetch(..., { method: 'HEAD' })` since browsers have no
 * filesystem. `WasmLoader#getDefaultWasmPath` now calls it for the browser
 * branch instead of the old single-hop guess.
 *
 * The SHA-384 manifest check (`verifyWasmIntegrity`, functions/src/wasm/integrity.ts)
 * is untouched — it still runs against whichever path is resolved, so this
 * fix only changes WHERE the loader looks, never whether the tamper check
 * runs.
 *
 * This test is skipped if the AS wasm hasn't been built/copied (no
 * `functions/dist/wasm/mathts-as.wasm`), matching the Node-side WASM tests'
 * convention of skipping rather than failing when the artifact is absent.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import { resetScratch } from '../src/wasm/bridges/common.js';
import {
  elementwiseChainDispatch,
  elementwiseUnaryDispatch,
  WASM_ELEMENTWISE_THRESHOLD,
  type WasmElementwiseOp,
} from '../src/wasm/elementwise/wasm-bridge.js';

// Top-level await: resolve WASM availability at module-collection time so
// `describe.skipIf` (evaluated synchronously during collection, before any
// `beforeAll` runs) sees the real result rather than a not-yet-set default.
wasmLoader.reset();
resetScratch();
let loaded = false;
try {
  await wasmLoader.load();
  loaded = wasmLoader.getModule() !== null;
} catch {
  loaded = false;
}

/** Independent JS oracle — deliberately NOT the code under test. */
function jsChain(ops: WasmElementwiseOp[], xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    let v = xs[i];
    for (const op of ops) {
      switch (op) {
        case 'sin':
          v = Math.sin(v);
          break;
        case 'exp':
          v = Math.exp(v);
          break;
        case 'tanh':
          v = Math.tanh(v);
          break;
        case 'log1p':
          v = Math.log1p(v);
          break;
        default:
          throw new Error(`jsChain: unhandled op ${op}`);
      }
    }
    out[i] = v;
  }
  return out;
}

/** Domain-safe sample: stays away from log1p's x <= -1 singularity. */
function sample(n: number): Float64Array {
  return Float64Array.from({ length: n }, (_, i) => 0.05 + (0.9 * (i % 977)) / 977);
}

afterAll(() => {
  wasmLoader.reset();
  resetScratch();
});

describe.skipIf(!loaded)('elementwiseChainDispatch actually engages WASM in the browser', () => {
  it('loaded a real AS module (array_sin_ptr + __new present)', () => {
    expect(loaded, 'WASM module failed to load in the browser — see beforeAll').toBe(true);
    const mod = wasmLoader.getModule() as unknown as Record<string, unknown>;
    expect(typeof mod.array_sin_ptr).toBe('function');
    expect('__new' in mod).toBe(true);
  });

  it('returns a NON-NULL, correct result for 65,536 elements (above the 1024 threshold)', () => {
    const n = 65_536;
    expect(n).toBeGreaterThanOrEqual(WASM_ELEMENTWISE_THRESHOLD);
    const xs = sample(n);
    const ops: WasmElementwiseOp[] = ['sin', 'exp', 'tanh', 'log1p'];

    const got = elementwiseChainDispatch(ops, xs);
    expect(got, 'elementwiseChainDispatch returned null — WASM did not engage').not.toBeNull();

    const want = jsChain(ops, xs);
    let maxAbsErr = 0;
    for (let i = 0; i < n; i++) maxAbsErr = Math.max(maxAbsErr, Math.abs(got![i] - want[i]));
    expect(maxAbsErr).toBeLessThan(1e-9);
  });

  it('single-op dispatch also engages WASM and matches the oracle', () => {
    const n = 65_536;
    const xs = sample(n);
    const got = elementwiseUnaryDispatch('sin', xs);
    expect(got, 'elementwiseUnaryDispatch returned null — WASM did not engage').not.toBeNull();
    for (let i = 0; i < n; i += 997) {
      expect(got![i]).toBeCloseTo(Math.sin(xs[i]), 9);
    }
  });

  it('returns null below the threshold (caller falls back to JS) — contract unchanged', () => {
    const xs = sample(WASM_ELEMENTWISE_THRESHOLD - 1);
    expect(elementwiseChainDispatch(['sin'], xs)).toBeNull();
  });
});
