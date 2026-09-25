/**
 * The public opt-in to the AssemblyScript tier: `loadWasm()` / `isWasmLoaded()`.
 *
 * Nothing loads the AS binary on its own, so until `loadWasm()` resolves `true`
 * every function runs its JavaScript path. These tests pin the contract:
 * a missing binary resolves `false`, a binary that fails its SHA-384 manifest
 * check rejects, a failed attempt does not stop a later one from succeeding,
 * and once loaded, public functions really execute AS kernels.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadWasm, isWasmLoaded, bitAnd } from '../src/index.js';
import { wasmLoader } from '../src/wasm/WasmLoader.js';
import { WASM_BITWISE_THRESHOLD } from '../src/wasm/bitwise/wasm-bridge.js';
import { AS_WASM_PATH, AS_WASM_MISSING_MESSAGE, countExportCalls } from './helpers/wasm-spy.js';

it('the AS wasm binary is present (a missing binary fails here, not as a silent skip)', () => {
  expect(AS_WASM_PATH, AS_WASM_MISSING_MESSAGE).not.toBeNull();
});

describe('loadWasm() — opt-in to the AssemblyScript tier', () => {
  beforeEach(() => {
    wasmLoader.reset();
  });

  afterAll(() => {
    wasmLoader.reset();
  });

  it('nothing is loaded until the caller opts in', () => {
    expect(isWasmLoaded()).toBe(false);
  });

  it('resolves false (and loads nothing) when the binary is missing', async () => {
    const missing = join(tmpdir(), 'mathts-no-such-dir', 'mathts-as.wasm');
    await expect(loadWasm(missing)).resolves.toBe(false);
    expect(isWasmLoaded()).toBe(false);
  });

  it('a failed attempt does not stop a later attempt from loading', async () => {
    const missing = join(tmpdir(), 'mathts-no-such-dir', 'mathts-as.wasm');
    await expect(loadWasm(missing)).resolves.toBe(false);
    await expect(loadWasm(AS_WASM_PATH!)).resolves.toBe(true);
    expect(isWasmLoaded()).toBe(true);
  });

  it('loads the packaged binary by default and is idempotent', async () => {
    await expect(loadWasm()).resolves.toBe(true);
    const first = wasmLoader.getModule();
    await expect(loadWasm()).resolves.toBe(true);
    expect(wasmLoader.getModule()).toBe(first);
  });

  it('rejects a binary whose SHA-384 does not match its manifest', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mathts-tampered-'));
    try {
      const wasm = join(dir, 'mathts-as.wasm');
      copyFileSync(AS_WASM_PATH!, wasm);
      writeFileSync(
        join(dir, 'wasm-manifest.json'),
        JSON.stringify({ 'mathts-as.wasm': 'sha384-' + 'A'.repeat(64) })
      );
      await expect(loadWasm(wasm)).rejects.toThrow(/integrity check failed/);
      expect(isWasmLoaded()).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('after loading, a public function executes its AS kernel', async () => {
    await expect(loadWasm()).resolves.toBe(true);
    const n = WASM_BITWISE_THRESHOLD + 1;
    const a = new Int32Array(n).map((_, i) => i * 7);
    const b = new Int32Array(n).map((_, i) => i * 3);
    const { result, counts } = countExportCalls(['bitAnd_i32_array'], () => bitAnd(a, b));
    const out = (await result) as Int32Array;
    expect(counts.bitAnd_i32_array).toBeGreaterThan(0);
    for (let i = 0; i < n; i += 997) expect(out[i]).toBe(a[i] & b[i]);
  });
});
