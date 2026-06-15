/**
 * Tests for the BROWSER load paths of matrix/src/backends/WasmLoader.ts.
 *
 * The loader chooses Node vs browser at construction time from `process`.
 * Under vitest's node environment the browser branches (loadBrowserWasm,
 * the streaming-compile path, precompile()'s browser arm) never run. Here we
 * flip the private `isNode` flag to false and stub `fetch` +
 * `WebAssembly.instantiateStreaming` / `compileStreaming` so those branches
 * execute against the real AS artifact bytes. The integrity manifest sits
 * beside the artifact, so the verify-before-compile (non-streaming) path is
 * what runs when a manifest is present — matching production browser behavior.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WasmLoader } from '../../src/backends/WasmLoader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const asWasmPath = path.resolve(here, '../../../assembly/build/mathts.wasm');
const manifestPath = path.resolve(here, '../../../assembly/build/wasm-manifest.json');
const asAvailable = fs.existsSync(asWasmPath) && fs.existsSync(manifestPath);

let wasmBytes: Uint8Array;
let manifestText: string;

/**
 * Install a fake browser `fetch` that serves the AS artifact bytes for the
 * .wasm path and the manifest JSON for the sibling manifest path.
 */
function installFetch() {
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).endsWith('.json')) {
      return { ok: true, json: async () => JSON.parse(manifestText) } as unknown as Response;
    }
    return {
      ok: true,
      arrayBuffer: async () => wasmBytes.buffer.slice(0),
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** A loader whose private isNode flag is forced to the browser value. */
function browserLoader(): WasmLoader {
  const loader = WasmLoader.getInstance();
  loader.reset();
  (loader as unknown as { isNode: boolean }).isNode = false;
  return loader;
}

describe('WasmLoader — browser load path (mocked fetch)', () => {
  beforeAll(() => {
    if (!asAvailable) return;
    wasmBytes = new Uint8Array(fs.readFileSync(asWasmPath));
    manifestText = fs.readFileSync(manifestPath, 'utf8');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    WasmLoader.getInstance().reset();
  });

  it.runIf(asAvailable)(
    'verifies + compiles via fetch when a manifest is present (no streaming)',
    async () => {
      const fetchMock = installFetch();
      const loader = browserLoader();
      const mod = await loader.load(asWasmPath);
      expect(mod.memory).toBeInstanceOf(WebAssembly.Memory);
      // The manifest-present browser path materializes the buffer (no streaming),
      // so fetch is called for both the manifest and the wasm.
      expect(fetchMock).toHaveBeenCalled();
      const metrics = loader.getLoadingMetrics();
      expect(metrics).not.toBeNull();
      expect(metrics!.totalMs).toBeGreaterThanOrEqual(0);
    }
  );

  it.runIf(asAvailable)('precompile() takes the browser arm and caches the module', async () => {
    installFetch();
    const loader = browserLoader();
    await loader.precompile(asWasmPath);
    expect(loader.isPrecompiled()).toBe(true);
    expect(loader.getCompiledModule()).not.toBeNull();
    // A subsequent precompile() short-circuits on the cached module.
    await expect(loader.precompile(asWasmPath)).resolves.toBeUndefined();
  });

  it.runIf(asAvailable)(
    'uses the streaming path when no manifest is present and streaming is available',
    async () => {
      // Copy the wasm to a temp dir with NO sibling manifest so loadWasmManifest
      // (which reads from disk in Node) returns null and the loader takes the
      // streaming branch. fetch is stubbed for completeness.
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mathts-stream-'));
      const tmpWasm = path.join(tmpDir, 'mathts.wasm');
      fs.writeFileSync(tmpWasm, wasmBytes);
      const fetchMock = vi.fn(async () => {
        return {
          ok: true,
          arrayBuffer: async () => wasmBytes.buffer.slice(0),
        } as unknown as Response;
      });
      vi.stubGlobal('fetch', fetchMock);
      const streamingMock = vi.fn(async () => {
        const module = await WebAssembly.compile(wasmBytes);
        const instance = await WebAssembly.instantiate(module, {
          env: { abort: () => {}, seed: () => Date.now() },
          Math,
          Date,
        });
        return { module, instance };
      });
      // Add instantiateStreaming onto the real WebAssembly object so the
      // `typeof WebAssembly.instantiateStreaming === 'function'` gate passes,
      // then remove it afterwards.
      const had = 'instantiateStreaming' in WebAssembly;
      const prev = (WebAssembly as Record<string, unknown>).instantiateStreaming;
      (WebAssembly as Record<string, unknown>).instantiateStreaming = streamingMock;
      try {
        const loader = browserLoader();
        const mod = await loader.load(tmpWasm);
        expect(mod.memory).toBeInstanceOf(WebAssembly.Memory);
        expect(streamingMock).toHaveBeenCalled();
      } finally {
        if (had) (WebAssembly as Record<string, unknown>).instantiateStreaming = prev;
        else delete (WebAssembly as Record<string, unknown>).instantiateStreaming;
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  );
});
