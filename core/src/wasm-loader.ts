/**
 * Shared WASM-loader runtime logic — SHA-384 integrity verification + packaged
 * artifact path resolution — consolidated here so `functions` and `matrix` build
 * on ONE copy instead of maintaining byte-identical forks.
 *
 * Why core: `matrix` cannot import from `functions` (functions depends on matrix,
 * which would invert the edge and create a cycle), so the historical solution was
 * to duplicate this logic in both packages. Both packages already depend on
 * `core`, so `@danielsimonjr/mathts-core/internal` is a home reachable from both
 * WITHOUT introducing a cycle. Exposed ONLY via the `/internal` subpath (never the
 * browser-facing `.` entry); every filesystem/crypto access uses a LAZY dynamic
 * `import()` so this module stays browser-safe (no static `node:` imports).
 *
 * SECURITY INVARIANT (CLAUDE.md "Security Invariants" #1): the SHA-384
 * hash-and-compare-before-instantiate is preserved BYTE-FOR-BYTE from the former
 * per-package `integrity.ts` copies — same algorithm, same fail-closed/soft-warn
 * behavior. Do NOT bypass, weaken to a non-cryptographic check, or skip on
 * streaming compile paths. Regression-covered by
 * `functions/tests/security/wasm-integrity.test.ts` and
 * `matrix/tests/security/wasm-integrity.test.ts`.
 *
 * The build pipeline writes a JSON manifest beside the .wasm artefact:
 *
 *   {
 *     "mathts-as.wasm": "sha384-<base64-of-binary-digest>"
 *   }
 *
 * At load time the runtime hashes the freshly read buffer with SHA-384 and
 * compares against the manifest. A mismatch throws — preventing silent
 * code-injection if the .wasm artefact is tampered with on disk or in transit
 * (e.g. a CDN/MITM compromise).
 *
 * Browser path uses `crypto.subtle.digest('SHA-384', buf)`.
 * Node path uses `crypto.createHash('sha384').update(buf).digest()`.
 *
 * If the manifest is missing or has no entry for the given file, we emit a
 * console warning and fall through. This keeps existing unsigned builds usable
 * while making signed builds tamper-evident.
 *
 * @module @danielsimonjr/mathts-core/internal (wasm-loader)
 */

import type { LoadingMetrics, WasmManifest } from './types/wasm-loader.js';
export type { WasmManifest };

const ALGO = 'sha384';

/**
 * Compute the SHA-384 digest of a buffer and return base64 encoding,
 * prefixed with "sha384-" to match SRI conventions.
 */
export async function sha384OfBuffer(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;

  let digest: Uint8Array;
  if (isNode) {
    const { createHash } = await import('crypto');
    const hash = createHash(ALGO);
    hash.update(bytes);
    digest = new Uint8Array(hash.digest());
  } else {
    // Browser / web worker — copy into a fresh ArrayBuffer so SharedArrayBuffer
    // backings are accepted by SubtleCrypto (which only takes ArrayBuffer).
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    const out = await crypto.subtle.digest('SHA-384', copy);
    digest = new Uint8Array(out);
  }

  // Convert to base64 (works in both Node and browser).
  let binary = '';
  for (let i = 0; i < digest.length; i++) binary += String.fromCharCode(digest[i]);
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(digest).toString('base64');
  return `sha384-${b64}`;
}

/**
 * Load the manifest sitting next to the .wasm artefact.
 *
 * @param wasmPath Resolved path or URL to the .wasm file.
 * @returns parsed manifest, or `null` if the manifest cannot be located.
 */
export async function loadWasmManifest(wasmPath: string): Promise<WasmManifest | null> {
  const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;
  const manifestPath = wasmPath.replace(/[^/\\]+$/, 'wasm-manifest.json');

  try {
    if (isNode) {
      const fs = await import('fs');
      const { promisify } = await import('util');
      const readFile = promisify(fs.readFile);
      const text = await readFile(manifestPath, 'utf8');
      return JSON.parse(text) as WasmManifest;
    } else {
      const res = await fetch(manifestPath);
      if (!res.ok) return null;
      return (await res.json()) as WasmManifest;
    }
  } catch {
    return null;
  }
}

/**
 * Verify a freshly loaded WASM buffer against the manifest.
 *
 * @throws Error if the buffer's SHA-384 differs from the manifest entry.
 */
export async function verifyWasmIntegrity(
  buffer: ArrayBuffer | Uint8Array,
  wasmPath: string,
  options: { manifest?: WasmManifest | null; required?: boolean } = {}
): Promise<void> {
  const fileName = wasmPath.split(/[/\\]/).pop() || wasmPath;
  const manifest =
    options.manifest !== undefined ? options.manifest : await loadWasmManifest(wasmPath);

  if (!manifest) {
    if (options.required) {
      throw new Error(
        `WASM integrity check failed: no manifest at sibling of "${wasmPath}" (required)`
      );
    }
    // Soft warn so unsigned builds keep working.
    if (typeof console !== 'undefined') {
      console.warn(
        `[wasm-integrity] no manifest found beside "${wasmPath}"; ` +
          'skipping SHA-384 verification (set options.required=true to fail closed)'
      );
    }
    return;
  }

  const expected = manifest[fileName];
  if (!expected) {
    if (options.required) {
      throw new Error(`WASM integrity check failed: manifest has no entry for "${fileName}"`);
    }
    return;
  }

  const actual = await sha384OfBuffer(buffer);
  if (actual !== expected) {
    throw new Error(
      `WASM integrity check failed for "${fileName}": ` + `expected ${expected}, got ${actual}`
    );
  }
}

/**
 * Robustly locate a packaged `.wasm` artifact across both the monorepo-source
 * layout and the published-package layout (Node only).
 *
 * The historical loaders hard-coded `../../../lib/wasm/<file>` relative to
 * `import.meta.url`, which only resolved for the monorepo source layout and
 * pointed outside the package once bundled/published — so the wasm was never
 * found and every consumer silently fell back to JS. This walks up from the
 * calling module's directory probing `<dir>/wasm/<file>` and
 * `<dir>/dist/wasm/<file>` at each level, matching bundled dist, unbundled dist,
 * and monorepo source.
 *
 * The caller injects its OWN `metaUrl` (its `import.meta.url`) so resolution is
 * relative to the calling package, not to core.
 *
 * @returns absolute path to the artifact, or `null` if not found.
 */
export async function resolvePackagedWasm(
  metaUrl: string,
  wasmFile: string
): Promise<string | null> {
  const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;
  if (!isNode) return null;

  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const { existsSync } = await import('node:fs');

  let dir = dirname(fileURLToPath(metaUrl));
  for (let depth = 0; depth < 8; depth++) {
    const candidates = [join(dir, 'wasm', wasmFile), join(dir, 'dist', 'wasm', wasmFile)];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Canonical fallback location for the packaged wasm when {@link resolvePackagedWasm}
 * finds nothing: `<packageRoot>/dist/wasm/<wasmFile>`, with the package root found
 * by walking up from `metaUrl` to the nearest `package.json`. This replaces the
 * historical `../../../lib/wasm/<file>` fabrication, which was only correct for the
 * pre-bundling source layout. The returned path is where the binary SHOULD be, so
 * the missing-binary warning tells the user exactly what to build.
 *
 * In browser mode (no filesystem) it returns the bundle-relative `./wasm/<file>`
 * URL — correct for a served `dist/`, which is the only layout browsers see.
 */
export async function defaultWasmLocation(
  metaUrl: string,
  wasmFile: string,
  opts?: { browser?: boolean }
): Promise<string> {
  if (opts?.browser) {
    return new URL(`./wasm/${wasmFile}`, metaUrl).href;
  }
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const { existsSync } = await import('node:fs');

  let dir = dirname(fileURLToPath(metaUrl));
  for (let depth = 0; depth < 8; depth++) {
    if (existsSync(join(dir, 'package.json'))) {
      return join(dir, 'dist', 'wasm', wasmFile);
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // No package root found (exotic embedding): fall back to meta-relative wasm/.
  return join(dirname(fileURLToPath(metaUrl)), 'wasm', wasmFile);
}

/**
 * Shared load / instantiate orchestration for the two package-local
 * `WasmLoader` singletons (`functions` and `matrix`). Subclasses keep their own
 * `WasmModule` ABI type, path resolution, and the Node/browser load arms that
 * call {@link verifyWasmIntegrity} before compile/instantiate (G45–G47).
 */
export abstract class WasmModuleLoader<TModule> {
  protected wasmModule: TModule | null = null;
  protected compiledModule: WebAssembly.Module | null = null;
  protected loading: Promise<TModule> | null = null;
  protected isNode: boolean;
  protected lastMetrics: LoadingMetrics | null = null;

  protected constructor() {
    this.isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;
  }

  /**
   * Load the WASM module (cached; concurrent callers share one in-flight promise).
   */
  public async load(wasmPath?: string): Promise<TModule> {
    if (this.wasmModule) {
      return this.wasmModule;
    }

    if (this.loading) {
      return this.loading;
    }

    // Clear the in-flight promise however it settles. Keeping a rejected one
    // would hand the same failure to every later call, so one bad path (or a
    // transient fetch error) would disable WASM for the rest of the process.
    this.loading = this.loadModule(wasmPath);
    try {
      this.wasmModule = await this.loading;
    } catch (error) {
      // Drop a module that compiled but failed to instantiate, too: the next
      // load() would reuse it instead of reading (and verifying) its own binary.
      this.compiledModule = null;
      throw error;
    } finally {
      this.loading = null;
    }
    return this.wasmModule;
  }

  private async loadModule(wasmPath?: string): Promise<TModule> {
    const path = wasmPath || (await this.getDefaultWasmPath());
    const totalStart = performance.now();

    // If precompiled, use cached module
    if (this.compiledModule) {
      const instStart = performance.now();
      const instance = await WebAssembly.instantiate(this.compiledModule, this.getImports());
      this.lastMetrics = {
        fileReadMs: 0,
        compileMs: 0,
        instantiateMs: performance.now() - instStart,
        totalMs: performance.now() - totalStart,
        fromCache: true,
      };
      return instance.exports as unknown as TModule;
    }

    if (this.isNode) {
      return this.loadNodeWasm(path, totalStart);
    }
    return this.loadBrowserWasm(path, totalStart);
  }

  protected abstract getDefaultWasmPath(): Promise<string>;

  public async precompile(wasmPath?: string): Promise<void> {
    if (this.compiledModule) return;

    const path = wasmPath || (await this.getDefaultWasmPath());
    const startTime = performance.now();

    if (this.isNode) {
      const fs = await import('fs');
      const { promisify } = await import('util');
      const readFile = promisify(fs.readFile);
      const buffer = await readFile(path);
      await verifyWasmIntegrity(buffer, path);
      this.compiledModule = await WebAssembly.compile(buffer);
    } else {
      const manifest = await loadWasmManifest(path);
      if (!manifest && typeof WebAssembly.compileStreaming === 'function') {
        this.compiledModule = await WebAssembly.compileStreaming(fetch(path));
      } else {
        const response = await fetch(path);
        const buffer = await response.arrayBuffer();
        await verifyWasmIntegrity(buffer, path, { manifest });
        this.compiledModule = await WebAssembly.compile(buffer);
      }
    }

    this.lastMetrics = {
      fileReadMs: 0,
      compileMs: performance.now() - startTime,
      instantiateMs: 0,
      totalMs: performance.now() - startTime,
      fromCache: false,
    };
  }

  protected async loadNodeWasm(path: string, totalStart: number): Promise<TModule> {
    const fs = await import('fs');
    const { promisify } = await import('util');
    const readFile = promisify(fs.readFile);

    const readStart = performance.now();
    const buffer = await readFile(path);
    const readEnd = performance.now();

    await verifyWasmIntegrity(buffer, path);

    const compileStart = performance.now();
    this.compiledModule = await WebAssembly.compile(buffer);
    const compileEnd = performance.now();

    const instStart = performance.now();
    const instance = await WebAssembly.instantiate(this.compiledModule, this.getImports());
    const instEnd = performance.now();

    this.lastMetrics = {
      fileReadMs: readEnd - readStart,
      compileMs: compileEnd - compileStart,
      instantiateMs: instEnd - instStart,
      totalMs: performance.now() - totalStart,
      fromCache: false,
    };

    return instance.exports as unknown as TModule;
  }

  protected async loadBrowserWasm(path: string, totalStart: number): Promise<TModule> {
    const manifest = await loadWasmManifest(path);

    if (!manifest && typeof WebAssembly.instantiateStreaming === 'function') {
      const instStart = performance.now();
      const result = await WebAssembly.instantiateStreaming(fetch(path), this.getImports());
      this.compiledModule = result.module;
      this.lastMetrics = {
        fileReadMs: 0,
        compileMs: 0,
        instantiateMs: performance.now() - instStart,
        totalMs: performance.now() - totalStart,
        fromCache: false,
      };
      return result.instance.exports as unknown as TModule;
    }

    const readStart = performance.now();
    const response = await fetch(path);
    const buffer = await response.arrayBuffer();
    const readEnd = performance.now();

    await verifyWasmIntegrity(buffer, path, { manifest });

    const compileStart = performance.now();
    this.compiledModule = await WebAssembly.compile(buffer);
    const compileEnd = performance.now();

    const instStart = performance.now();
    const instance = await WebAssembly.instantiate(this.compiledModule, this.getImports());
    const instEnd = performance.now();

    this.lastMetrics = {
      fileReadMs: readEnd - readStart,
      compileMs: compileEnd - compileStart,
      instantiateMs: instEnd - instStart,
      totalMs: performance.now() - totalStart,
      fromCache: false,
    };

    return instance.exports as unknown as TModule;
  }

  protected getImports(): WebAssembly.Imports {
    return {
      env: {
        abort: (msg: number, file: number, line: number, column: number) => {
          console.error('WASM abort', { msg, file, line, column });
          throw new Error('WASM abort');
        },
        seed: () => Date.now(),
      },
      Math: Math as unknown as WebAssembly.ModuleImports,
      Date: Date as unknown as WebAssembly.ModuleImports,
    };
  }
}
