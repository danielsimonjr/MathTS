/**
 * Pins loader behavior merged into core's WasmModuleLoader (G45–G47):
 * integrity on load paths, failed-load cache clearing, abort translation, precompile cache.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha384OfBuffer } from '../../src/backends/wasm/integrity.js';
import { WasmLoader } from '../../src/backends/WasmLoader.js';
import { WASMBackend } from '../../src/backends/WASMBackend.js';

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
      expect(await sha384OfBuffer(tampered)).not.toBe(expected);
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
      expect(warn.mock.calls.some((c) => String(c[0]).includes('[wasm-integrity]'))).toBe(true);
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

  it('getImports() is empty: the binary has no import (#1019)', () => {
    expect(getImports(freshLoader())).toEqual({});
  });

  it.skipIf(!asAvailable)(
    "an abort of the binary throws Error('WASM abort'), the text of origin/main (matrix)",
    async () => {
      const loader = freshLoader();
      const wasm = (await loader.load(asWasmPath)) as unknown as Record<
        string,
        (...args: number[]) => number
      >;
      const thrownBy = (call: () => unknown): unknown => {
        try {
          call();
        } catch (error) {
          return error;
        }
        return undefined;
      };
      // legendreP aborts above its order limit. On origin/main the `env.abort` of the loader threw
      // `Error('WASM abort')`; the message and the position of the abort are now its `cause`.
      const abort = thrownBy(() => wasm.legendreP!(5e9, 0.5)) as Error;
      expect(abort).toBeInstanceOf(Error);
      expect(abort.name).toBe('Error');
      expect(abort.message).toBe('WASM abort');
      expect((abort.cause as Error).message).toMatch(
        /exceeds the supported maximum in .+:\d+:\d+$/
      );
      // The trap is not sticky: the next call works.
      expect(wasm.legendreP!(2, 0.5)).toBeCloseTo(-0.125, 12);
      // An abort of a runtime helper has the same text (`__new` above the size limit of the
      // runtime), and its record does not reach a later trap of another kind.
      const tooLarge = thrownBy(() => wasm.__new!(0x7fffffff, 1)) as Error;
      expect(tooLarge.message).toBe('WASM abort');
      const outOfBounds = thrownBy(() => wasm.array_sum!(0x7ffffff0)) as Error;
      expect(outOfBounds.name).toBe('RuntimeError');
      expect(outOfBounds.message).not.toBe('WASM abort');
    }
  );

  it.skipIf(!asAvailable)(
    'precompile() then load() uses cached module without re-reading the file',
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'mathts-mx-loader-precompile-'));
      try {
        const wasm = join(dir, 'mathts.wasm');
        copyFileSync(asWasmPath, wasm);
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

describe('WASMBackend: abort text (#1019)', () => {
  it.skipIf(!asAvailable)(
    "an abort of the binary throws Error('AS WASM abort'), the text of origin/main",
    async () => {
      const backend = new WASMBackend();
      await backend.initialize();
      const wasm = (
        backend as unknown as { wasmModule: Record<string, (...args: number[]) => number> | null }
      ).wasmModule;
      expect(wasm).not.toBeNull();
      let abort: unknown;
      try {
        wasm!.legendreP!(5e9, 0.5);
      } catch (error) {
        abort = error;
      }
      // On origin/main the `env.abort` of `loadAsModule` threw `Error('AS WASM abort')`; the
      // message and the position of the abort are now its `cause`.
      expect(abort).toBeInstanceOf(Error);
      expect((abort as Error).name).toBe('Error');
      expect((abort as Error).message).toBe('AS WASM abort');
      expect(((abort as Error).cause as Error).message).toMatch(
        /^legendreP: order exceeds the supported maximum in src\/ops\/special\.ts:\d+:\d+$/
      );
      expect(wasm!.legendreP!(2, 0.5)).toBeCloseTo(-0.125, 12);
    }
  );
});
