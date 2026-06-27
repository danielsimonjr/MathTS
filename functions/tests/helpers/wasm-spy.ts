/**
 * Shared helpers for the migration Phase 3b AS-execution tests.
 *
 * The bridge tests must prove a dispatch (a) actually executes on the AS wasm
 * binary — NOT the JS fallback — and (b) matches the JS reference. Because the
 * dispatch helpers always return a value (unlike the elementwise bridge, whose
 * JS fallback returns `null`), a correct result alone does not prove the wasm
 * path ran. And WebAssembly export namespaces are frozen, so the exported
 * kernels cannot be wrapped directly.
 *
 * `countExportCalls` works around both: it temporarily swaps `wasmLoader.
 * getModule` for one returning a Proxy that wraps the named export(s) with a
 * call counter, runs the body, and reports how many times each was invoked.
 * A positive count proves the bridge invoked the AS kernel.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { wasmLoader } from '../../src/wasm/WasmLoader.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Locate the AS binary (functions' own dist copy first, then matrix's). */
export const AS_WASM_PATH: string | null = (() => {
  for (const rel of [
    '../../dist/wasm/mathts-as.wasm',
    '../../../matrix/dist/wasm/mathts-as.wasm',
  ]) {
    const c = resolve(here, rel);
    if (existsSync(c)) return c;
  }
  return null;
})();

/**
 * Run `body`, counting how often each export in `names` is invoked through
 * `wasmLoader.getModule()` for the duration. Returns the body's result plus the
 * per-export call counts. Restores the real `getModule` afterward.
 */
export function countExportCalls<T>(
  names: string[],
  body: () => T
): { result: T; counts: Record<string, number> } {
  const real = wasmLoader.getModule();
  const counts: Record<string, number> = {};
  for (const n of names) counts[n] = 0;
  if (!real) {
    return { result: body(), counts };
  }
  // The WebAssembly exports namespace is frozen, so a Proxy cannot return a
  // wrapper for a kernel (the non-configurable-data-property get invariant
  // forbids it). Instead build a writable shallow clone that carries every
  // export by reference (memory, __new, the kernels, …) and override just the
  // counted names with a counter wrapper.
  const clone: Record<string, unknown> = {};
  for (const key of Object.getOwnPropertyNames(real)) {
    const value = (real as Record<string, unknown>)[key];
    if (names.includes(key) && typeof value === 'function') {
      const fn = value as (...a: unknown[]) => unknown;
      clone[key] = (...args: unknown[]) => {
        counts[key]++;
        return fn.apply(real, args);
      };
    } else {
      clone[key] = value;
    }
  }
  const getModule = wasmLoader.getModule.bind(wasmLoader);
  (wasmLoader as unknown as { getModule: () => unknown }).getModule = () => clone;
  try {
    return { result: body(), counts };
  } finally {
    (wasmLoader as unknown as { getModule: () => unknown }).getModule = getModule;
  }
}

/** Largest absolute difference between two equal-length numeric arrays. */
export function maxAbsDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > m) m = d;
  }
  return m;
}
