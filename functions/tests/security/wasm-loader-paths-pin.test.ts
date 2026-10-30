/**
 * P6-10 pins for the load paths that moved into core's `WasmModuleLoader` (security invariant 1:
 * the SHA-384 compare runs before compile or instantiate).
 *
 * - Node `precompile()` and the browser `precompile()` / `load()` paths reject a tampered binary
 *   when a manifest exists, and call none of `compile`, `instantiate`, `compileStreaming` or
 *   `instantiateStreaming` first.
 * - A manifest forces the buffered path: the streaming APIs are never called when one exists.
 * - Streaming is used only when there is no manifest.
 *
 * The tampered binary is still a valid WebAssembly module (an appended custom section), so a
 * missing check would let it compile and the test would fail on the assertion, not on a parse
 * error. The browser arm is reached by clearing the loader's `isNode` flag; `fetch` is stubbed and
 * the manifest is read from disk beside the file.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha384OfBuffer } from '../../src/wasm/integrity.js';
import { WasmLoader } from '../../src/wasm/WasmLoader.js';

const EMPTY_MODULE = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
// The same module plus a custom section (id 0, size 1, empty name): valid, different bytes.
const TAMPERED_MODULE = new Uint8Array([...EMPTY_MODULE, 0x00, 0x01, 0x00]);

type Counts = {
  compile: number;
  instantiate: number;
  compileStreaming: number;
  instantiateStreaming: number;
};

/** Counts calls on the four WebAssembly entry points and restores them. */
function watchWebAssembly() {
  const wa = WebAssembly as unknown as Record<string, unknown>;
  const names = ['compile', 'instantiate', 'compileStreaming', 'instantiateStreaming'] as const;
  const originals = Object.fromEntries(names.map((n) => [n, wa[n]])) as Record<
    (typeof names)[number],
    (...a: unknown[]) => Promise<unknown>
  >;
  const counts: Counts = {
    compile: 0,
    instantiate: 0,
    compileStreaming: 0,
    instantiateStreaming: 0,
  };
  for (const name of names) {
    wa[name] = async (...args: unknown[]) => {
      counts[name]++;
      if (name === 'compileStreaming') return originals.compile(EMPTY_MODULE);
      if (name === 'instantiateStreaming') {
        const module = (await originals.compile(EMPTY_MODULE)) as WebAssembly.Module;
        const instance = await originals.instantiate(module, args[1]);
        return { module, instance };
      }
      return originals[name](...args);
    };
  }
  return {
    counts,
    restore() {
      for (const name of names) wa[name] = originals[name];
    },
  };
}

interface Fixture {
  dir: string;
  wasm: string;
}

/** Writes `fake.wasm` plus, optionally, a manifest holding the digest of the genuine bytes. */
async function makeFixture(opts: { manifest: boolean; tampered: boolean }): Promise<Fixture> {
  const dir = mkdtempSync(join(tmpdir(), 'mathts-fn-loader-paths-'));
  const wasm = join(dir, 'fake.wasm');
  if (opts.manifest) {
    const expected = await sha384OfBuffer(EMPTY_MODULE);
    writeFileSync(join(dir, 'wasm-manifest.json'), JSON.stringify({ 'fake.wasm': expected }));
  }
  writeFileSync(wasm, opts.tampered ? TAMPERED_MODULE : EMPTY_MODULE);
  return { dir, wasm };
}

function freshLoader(browser: boolean): WasmLoader {
  const loader = WasmLoader.getInstance();
  loader.reset();
  (loader as unknown as { isNode: boolean }).isNode = !browser;
  return loader;
}

describe('WasmModuleLoader load paths keep the integrity check first (P6-10)', () => {
  const realFetch = globalThis.fetch;
  let watch: ReturnType<typeof watchWebAssembly>;
  let fetched: string[];
  let fixture: Fixture | null;

  beforeEach(() => {
    watch = watchWebAssembly();
    fetched = [];
    fixture = null;
  });

  afterEach(() => {
    watch.restore();
    globalThis.fetch = realFetch;
    const loader = WasmLoader.getInstance();
    loader.reset();
    (loader as unknown as { isNode: boolean }).isNode = true;
    if (fixture) rmSync(fixture.dir, { recursive: true, force: true });
  });

  function stubFetch(bytes: Uint8Array): void {
    globalThis.fetch = (async (input: unknown) => {
      fetched.push(String(input));
      return {
        ok: true,
        arrayBuffer: async () =>
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
      };
    }) as typeof fetch;
  }

  describe('Node load()', () => {
    it('rejects a tampered but well-formed binary before compiling or instantiating it', async () => {
      fixture = await makeFixture({ manifest: true, tampered: true });
      const loader = freshLoader(false);
      await expect(loader.load(fixture.wasm)).rejects.toThrow(/WASM integrity check failed/);
      expect(watch.counts).toEqual({
        compile: 0,
        instantiate: 0,
        compileStreaming: 0,
        instantiateStreaming: 0,
      });
      expect(loader.isLoaded()).toBe(false);
      expect(loader.getCompiledModule()).toBeNull();
    });

    it('compiles and instantiates the genuine binary once each', async () => {
      fixture = await makeFixture({ manifest: true, tampered: false });
      const loader = freshLoader(false);
      await loader.load(fixture.wasm);
      expect(watch.counts).toEqual({
        compile: 1,
        instantiate: 1,
        compileStreaming: 0,
        instantiateStreaming: 0,
      });
      expect(loader.isLoaded()).toBe(true);
    });
  });

  describe('Node precompile()', () => {
    it('rejects a tampered binary before compiling it', async () => {
      fixture = await makeFixture({ manifest: true, tampered: true });
      const loader = freshLoader(false);
      await expect(loader.precompile(fixture.wasm)).rejects.toThrow(/WASM integrity check failed/);
      expect(watch.counts).toEqual({
        compile: 0,
        instantiate: 0,
        compileStreaming: 0,
        instantiateStreaming: 0,
      });
      expect(loader.isPrecompiled()).toBe(false);
      expect(loader.getCompiledModule()).toBeNull();
    });

    it('compiles the genuine binary once and caches it', async () => {
      fixture = await makeFixture({ manifest: true, tampered: false });
      const loader = freshLoader(false);
      await loader.precompile(fixture.wasm);
      expect(watch.counts.compile).toBe(1);
      expect(loader.isPrecompiled()).toBe(true);
      await loader.precompile(fixture.wasm);
      expect(watch.counts.compile).toBe(1);
    });
  });

  describe('browser precompile()', () => {
    it('rejects a tampered binary and never streams when a manifest exists', async () => {
      fixture = await makeFixture({ manifest: true, tampered: true });
      stubFetch(TAMPERED_MODULE);
      const loader = freshLoader(true);
      await expect(loader.precompile(fixture.wasm)).rejects.toThrow(/WASM integrity check failed/);
      expect(watch.counts).toEqual({
        compile: 0,
        instantiate: 0,
        compileStreaming: 0,
        instantiateStreaming: 0,
      });
      expect(fetched).toEqual([fixture.wasm]);
      expect(loader.isPrecompiled()).toBe(false);
    });

    it('buffers, verifies and compiles the genuine binary when a manifest exists', async () => {
      fixture = await makeFixture({ manifest: true, tampered: false });
      stubFetch(EMPTY_MODULE);
      const loader = freshLoader(true);
      await loader.precompile(fixture.wasm);
      expect(watch.counts).toEqual({
        compile: 1,
        instantiate: 0,
        compileStreaming: 0,
        instantiateStreaming: 0,
      });
      expect(loader.isPrecompiled()).toBe(true);
    });

    it('streams only when there is no manifest', async () => {
      fixture = await makeFixture({ manifest: false, tampered: false });
      stubFetch(EMPTY_MODULE);
      const loader = freshLoader(true);
      await loader.precompile(fixture.wasm);
      expect(watch.counts).toEqual({
        compile: 0,
        instantiate: 0,
        compileStreaming: 1,
        instantiateStreaming: 0,
      });
      expect(fetched).toEqual([fixture.wasm]);
      expect(loader.isPrecompiled()).toBe(true);
    });
  });

  describe('browser load()', () => {
    it('rejects a tampered binary before compile or instantiate, and never streams', async () => {
      fixture = await makeFixture({ manifest: true, tampered: true });
      stubFetch(TAMPERED_MODULE);
      const loader = freshLoader(true);
      await expect(loader.load(fixture.wasm)).rejects.toThrow(/WASM integrity check failed/);
      expect(watch.counts).toEqual({
        compile: 0,
        instantiate: 0,
        compileStreaming: 0,
        instantiateStreaming: 0,
      });
      expect(fetched).toEqual([fixture.wasm]);
      expect(loader.isLoaded()).toBe(false);
      expect(loader.getCompiledModule()).toBeNull();
    });

    it('with a manifest and the genuine binary: fetch, verify, compile, instantiate, no streaming', async () => {
      fixture = await makeFixture({ manifest: true, tampered: false });
      stubFetch(EMPTY_MODULE);
      const loader = freshLoader(true);
      await loader.load(fixture.wasm);
      expect(watch.counts).toEqual({
        compile: 1,
        instantiate: 1,
        compileStreaming: 0,
        instantiateStreaming: 0,
      });
      expect(fetched).toEqual([fixture.wasm]);
      expect(loader.isLoaded()).toBe(true);
    });

    it('streams (instantiateStreaming) only when there is no manifest', async () => {
      fixture = await makeFixture({ manifest: false, tampered: false });
      stubFetch(EMPTY_MODULE);
      const loader = freshLoader(true);
      await loader.load(fixture.wasm);
      expect(watch.counts).toEqual({
        compile: 0,
        instantiate: 0,
        compileStreaming: 0,
        instantiateStreaming: 1,
      });
      expect(fetched).toEqual([fixture.wasm]);
      expect(loader.isLoaded()).toBe(true);
    });

    it('a rejected tamper does not poison the next load of a genuine binary', async () => {
      fixture = await makeFixture({ manifest: true, tampered: true });
      stubFetch(TAMPERED_MODULE);
      const loader = freshLoader(true);
      await expect(loader.load(fixture.wasm)).rejects.toThrow(/WASM integrity check failed/);
      writeFileSync(fixture.wasm, EMPTY_MODULE);
      stubFetch(EMPTY_MODULE);
      await loader.load(fixture.wasm);
      expect(loader.isLoaded()).toBe(true);
    });
  });
});
