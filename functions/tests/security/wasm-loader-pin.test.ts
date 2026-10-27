/**
 * Pins loader behavior merged into core's WasmModuleLoader (G45–G47):
 * integrity on load paths, failed-load cache clearing, getImports abort, precompile cache.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { sha384OfBuffer } from '../../src/wasm/integrity.js';
import { WasmLoader } from '../../src/wasm/WasmLoader.js';
import { AS_WASM_PATH } from '../helpers/wasm-spy.js';

const UNLINKABLE_WASM = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x04, 0x01, 0x60, 0x00, 0x00, 0x02, 0x07,
  0x01, 0x01, 0x6d, 0x01, 0x66, 0x00, 0x00,
]);

function freshLoader(): WasmLoader {
  const loader = WasmLoader.getInstance();
  loader.reset();
  return loader;
}

function getImports(loader: WasmLoader): WebAssembly.Imports {
  return (loader as unknown as { getImports(): WebAssembly.Imports }).getImports();
}

describe('functions WasmLoader — merge pins (G45–G47)', () => {
  beforeEach(() => {
    freshLoader();
  });

  afterEach(() => {
    WasmLoader.getInstance().reset();
    vi.restoreAllMocks();
  });

  it('load() rejects a tampered buffer when a manifest is present', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mathts-fn-loader-tamper-'));
    try {
      const wasm = join(dir, 'fake.wasm');
      const bytes = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
      writeFileSync(wasm, bytes);
      const expected = await sha384OfBuffer(bytes);
      writeFileSync(join(dir, 'wasm-manifest.json'), JSON.stringify({ 'fake.wasm': expected }));
      const tampered = new Uint8Array(bytes);
      tampered[3] ^= 0xff;
      writeFileSync(wasm, tampered);
      expect(await sha384OfBuffer(tampered)).not.toBe(expected);
      const loader = freshLoader();
      await expect(loader.load(wasm)).rejects.toThrow(/WASM integrity check failed/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!AS_WASM_PATH)(
    'load() soft-warns when no manifest is beside the wasm (still attempts compile)',
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'mathts-fn-loader-noman-'));
      try {
        const wasm = join(dir, basename(AS_WASM_PATH!));
        copyFileSync(AS_WASM_PATH!, wasm);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const loader = freshLoader();
        await loader.load(wasm);
        expect(warn.mock.calls.some((c) => String(c[0]).includes('[wasm-integrity]'))).toBe(true);
        expect(loader.isLoaded()).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  );

  it.skipIf(!AS_WASM_PATH)(
    'failed load() clears compiledModule so a later load can succeed',
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'mathts-fn-loader-unlink-'));
      try {
        const wasm = join(dir, 'mathts-as.wasm');
        writeFileSync(wasm, UNLINKABLE_WASM);
        const loader = freshLoader();
        await expect(loader.load(wasm)).rejects.toThrow();
        expect(loader.getCompiledModule()).toBeNull();
        await expect(loader.load(AS_WASM_PATH!)).resolves.toBeDefined();
        expect(loader.isLoaded()).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  );

  it("imports.env.abort throws Error('WASM abort')", () => {
    const loader = freshLoader();
    const imports = getImports(loader);
    expect(() => {
      (imports.env as { abort: (a: number, b: number, c: number, d: number) => void }).abort(
        0,
        0,
        0,
        0
      );
    }).toThrow(new Error('WASM abort'));
  });

  it.skipIf(!AS_WASM_PATH)(
    'precompile() then load() uses cached module without re-reading the file',
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'mathts-fn-loader-precompile-'));
      try {
        const wasm = join(dir, 'mathts-as.wasm');
        copyFileSync(AS_WASM_PATH!, wasm);
        const loader = freshLoader();
        await loader.precompile(wasm);
        expect(loader.isPrecompiled()).toBe(true);
        // Independent of fs spies (vitest cannot spy ESM `fs.readFile`): if load()
        // re-read the path it would throw ENOENT instead of using compiledModule.
        rmSync(wasm);
        await expect(loader.load(wasm)).resolves.toBeDefined();
        expect(loader.getLoadingMetrics()?.fromCache).toBe(true);
        expect(loader.isLoaded()).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  );
});
