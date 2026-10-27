/**
 * Pins loader behavior merged into core's WasmModuleLoader (G45–G47):
 * integrity on load paths, failed-load cache clearing, getImports abort, precompile cache.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha384OfBuffer } from '../../src/backends/wasm/integrity.js';
import { WasmLoader } from '../../src/backends/WasmLoader.js';

const here = dirname(fileURLToPath(import.meta.url));
const asWasmPath = resolve(here, '../../../assembly/build/mathts.wasm');
const asAvailable = existsSync(asWasmPath);

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

describe('matrix WasmLoader — merge pins (G45–G47)', () => {
  beforeEach(() => {
    freshLoader();
  });

  afterEach(() => {
    WasmLoader.getInstance().reset();
    vi.restoreAllMocks();
  });

  it('load() rejects a tampered buffer when a manifest is present', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mathts-mx-loader-tamper-'));
    try {
      const wasm = join(dir, 'fake.wasm');
      const bytes = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
      writeFileSync(wasm, bytes);
      const expected = await sha384OfBuffer(bytes);
      writeFileSync(join(dir, 'wasm-manifest.json'), JSON.stringify({ 'fake.wasm': expected }));
      const tampered = new Uint8Array(bytes);
      tampered[3] ^= 0xff;
      writeFileSync(wasm, tampered);
      const loader = freshLoader();
      await expect(loader.load(wasm)).rejects.toThrow(/WASM integrity check failed/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!asAvailable)('load() soft-warns when no manifest is beside the wasm', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mathts-mx-loader-noman-'));
    try {
      const wasm = join(dir, 'mathts.wasm');
      copyFileSync(asWasmPath, wasm);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const loader = freshLoader();
      await loader.load(wasm);
      expect(warn).toHaveBeenCalled();
      expect(loader.isLoaded()).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!asAvailable)(
    'failed load() clears compiledModule so a later load can succeed',
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'mathts-mx-loader-unlink-'));
      try {
        const wasm = join(dir, 'mathts.wasm');
        writeFileSync(wasm, UNLINKABLE_WASM);
        const loader = freshLoader();
        await expect(loader.load(wasm)).rejects.toThrow();
        expect(loader.getCompiledModule()).toBeNull();
        await expect(loader.load(asWasmPath)).resolves.toBeDefined();
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

  it.skipIf(!asAvailable)(
    'precompile() then load() uses cached module without re-reading the file',
    async () => {
      const loader = freshLoader();
      const fs = await import('node:fs');
      const { promisify } = await import('node:util');
      const readFile = promisify(fs.readFile);
      const readSpy = vi.spyOn(fs.promises, 'readFile').mockImplementation(readFile);
      await loader.precompile(asWasmPath);
      readSpy.mockClear();
      await loader.load(asWasmPath);
      expect(readSpy).not.toHaveBeenCalled();
      expect(loader.getLoadingMetrics()?.fromCache).toBe(true);
    }
  );
});
