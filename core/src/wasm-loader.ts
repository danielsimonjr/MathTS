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
import { importModule } from './node-module-import.js';
import type { CompiledWasmModule } from './platform-types.js';
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
    const { createHash } = (await importModule('node:crypto')) as {
      createHash: (algo: string) => { update: (b: Uint8Array) => void; digest: () => Buffer };
    };
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
      const fs = (await importModule('node:fs')) as typeof import('node:fs');
      const { promisify } = (await importModule('node:util')) as typeof import('node:util');
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

  const { fileURLToPath } = (await importModule('node:url')) as typeof import('node:url');
  const { dirname, join } = (await importModule('node:path')) as typeof import('node:path');
  const { existsSync } = (await importModule('node:fs')) as typeof import('node:fs');

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
  const { fileURLToPath } = (await importModule('node:url')) as typeof import('node:url');
  const { dirname, join } = (await importModule('node:path')) as typeof import('node:path');
  const { existsSync } = (await importModule('node:fs')) as typeof import('node:fs');

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

/** A function export of a loaded binary. */
type WasmFunction = (...args: unknown[]) => unknown;

/**
 * The abort record of the binary (`assembly/src/abort.ts`). The binary has no `env.abort`
 * import (#1019), so an AssemblyScript abort traps as a `WebAssembly.RuntimeError` after it has
 * stored its message, file, line and column in globals.
 */
interface WasmAbortExports {
  memory: { readonly buffer: ArrayBufferLike };
  abort_take(): number | boolean;
  abort_message(): number;
  abort_file(): number;
  abort_line(): number;
  abort_column(): number;
}

/** Read the AssemblyScript string at `pointer` (UTF-16, byte length at `pointer - 4`). */
function readAsString(memory: WasmAbortExports['memory'], pointer: number): string {
  if (!pointer) return '';
  const end = (pointer + new Uint32Array(memory.buffer)[(pointer - 4) >>> 2]!) >>> 1;
  const units = new Uint16Array(memory.buffer);
  let text = '';
  for (let start = pointer >>> 1; start < end; start += 1024) {
    text += String.fromCharCode(...units.subarray(start, Math.min(start + 1024, end)));
  }
  return text;
}

/**
 * The message of the `Error` that the `env.abort` import of {@link WasmModuleLoader} threw before
 * the binary lost its import (#1019). The loaders of `functions` and `matrix` keep this text.
 */
export const WASM_ABORT_TEXT = 'WASM abort';

/**
 * Turn the trap of an AssemblyScript abort into an `Error`. Any other value, and any trap that is
 * not an abort (a division by zero, a memory access out of bounds), is returned as it is. Call it
 * first in the `catch` of a call into the binary, before the next call into it.
 *
 * The record of the abort gives the detail `<message> in <file>:<line>:<column>`, the text that the
 * `env.abort` of the AssemblyScript glue threw. Without `text`, the result is an `Error` with that
 * detail as its message and the trap as its `cause`. With `text`, the result is an `Error` with
 * `text` as its message and the detail `Error` as its `cause`: a loader passes the fixed text that
 * its own `env.abort` threw, so its callers see the same message as before and the detail is not
 * lost.
 *
 * @param error The value that the call threw.
 * @param exports The exports of the binary that made the call.
 * @param text The fixed message of the result; without it, the detail is the message.
 * @returns The `Error` of the abort, or `error` itself.
 */
export function translateWasmAbort(error: unknown, exports: object, text?: string): unknown {
  if (!(error instanceof Error) || error.name !== 'RuntimeError') return error;
  const wasm = exports as Partial<WasmAbortExports>;
  if (typeof wasm.abort_take !== 'function' || !wasm.abort_take()) return error;
  const memory = wasm.memory as WasmAbortExports['memory'];
  const message = readAsString(memory, wasm.abort_message!());
  const file = readAsString(memory, wasm.abort_file!());
  const detail = new Error(
    `${message} in ${file}:${wasm.abort_line!() >>> 0}:${wasm.abort_column!() >>> 0}`,
    { cause: error }
  );
  return text === undefined ? detail : new Error(text, { cause: detail });
}

/**
 * Wrap one function export of a binary. The `length` of an exported WebAssembly function is its
 * exact parameter count, and an argument that a call does not pass reads as `undefined`, which the
 * call converts as it converts a missing one. So a wrapper with the same number of parameters
 * calls the export in the same way. It costs 1-7 ns on `add_f64` (6.5 to 12 ns raw), where a
 * wrapper that takes the rest of the arguments costs 12-25 ns more. An export of more than six
 * parameters takes the rest form.
 */
function guardFunction(fn: WasmFunction, exports: object, text?: string): WasmFunction {
  const fail = (error: unknown): never => {
    throw translateWasmAbort(error, exports, text);
  };
  switch (fn.length) {
    case 0:
      return () => {
        try {
          return fn();
        } catch (error) {
          return fail(error);
        }
      };
    case 1:
      return (a) => {
        try {
          return fn(a);
        } catch (error) {
          return fail(error);
        }
      };
    case 2:
      return (a, b) => {
        try {
          return fn(a, b);
        } catch (error) {
          return fail(error);
        }
      };
    case 3:
      return (a, b, c) => {
        try {
          return fn(a, b, c);
        } catch (error) {
          return fail(error);
        }
      };
    case 4:
      return (a, b, c, d) => {
        try {
          return fn(a, b, c, d);
        } catch (error) {
          return fail(error);
        }
      };
    case 5:
      return (a, b, c, d, e) => {
        try {
          return fn(a, b, c, d, e);
        } catch (error) {
          return fail(error);
        }
      };
    case 6:
      return (a, b, c, d, e, f) => {
        try {
          return fn(a, b, c, d, e, f);
        } catch (error) {
          return fail(error);
        }
      };
    default:
      return (...args) => {
        try {
          return fn(...args);
        } catch (error) {
          return fail(error);
        }
      };
  }
}

/**
 * Wrap each function export of a loaded binary so that an abort reaches the caller as the `Error`
 * of {@link translateWasmAbort}. The runtime helpers (`__new`, ...) are wrapped too: `__new`
 * aborts for a size above the limit of the runtime, and an abort that no wrapper reads stays
 * pending, so the next trap of another kind would get its record. Only the abort accessors stay as
 * they are. A binary without the abort accessors is returned unchanged. A wrapper adds a few ns to
 * a call (`guardFunction`).
 *
 * @param exports The `exports` of a `WebAssembly.Instance`.
 * @param text The fixed message of the abort `Error` (see {@link translateWasmAbort}).
 * @returns A copy with guarded functions; every other export is the same object.
 */
export function guardWasmAborts<T extends object>(exports: T, text?: string): T {
  if (typeof (exports as Partial<WasmAbortExports>).abort_take !== 'function') return exports;
  const guarded: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(exports)) {
    guarded[key] =
      typeof value === 'function' && !key.startsWith('abort_')
        ? guardFunction(value as WasmFunction, exports, text)
        : value;
  }
  return guarded as T;
}

/**
 * Shared load / instantiate orchestration for the two package-local
 * `WasmLoader` singletons (`functions` and `matrix`). Subclasses keep their own
 * `WasmModule` ABI type and path resolution; the Node and browser load arms
 * (`precompile`, `loadNodeWasm`, `loadBrowserWasm`) live here and call
 * {@link verifyWasmIntegrity} before every compile/instantiate (G45–G47, P6-10).
 */
export abstract class WasmModuleLoader<TModule> {
  protected wasmModule: TModule | null = null;
  protected compiledModule: CompiledWasmModule | null = null;
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
      const instance = await WebAssembly.instantiate(
        this.compiledModule,
        this.getImports() as WebAssembly.Imports
      );
      this.lastMetrics = {
        fileReadMs: 0,
        compileMs: 0,
        instantiateMs: performance.now() - instStart,
        totalMs: performance.now() - totalStart,
        fromCache: true,
      };
      return guardWasmAborts(instance.exports, WASM_ABORT_TEXT) as unknown as TModule;
    }

    if (this.isNode) {
      return this.loadNodeWasm(path, totalStart);
    }
    return this.loadBrowserWasm(path, totalStart);
  }

  protected abstract getDefaultWasmPath(): Promise<string>;

  /**
   * Precompile the WASM module without instantiation.
   * Useful for build-time or startup optimization.
   *
   * Same integrity rule as `load()`: the bytes are hashed against the manifest before
   * `WebAssembly.compile`. The browser arm streams only when no manifest exists.
   */
  public async precompile(wasmPath?: string): Promise<void> {
    if (this.compiledModule) return;

    const path = wasmPath || (await this.getDefaultWasmPath());
    const startTime = performance.now();

    if (this.isNode) {
      const fs = (await importModule('node:fs')) as typeof import('node:fs');
      const { promisify } = (await importModule('node:util')) as typeof import('node:util');
      const readFile = promisify(fs.readFile);
      const buffer = await readFile(path);
      await verifyWasmIntegrity(buffer, path);
      this.compiledModule = await WebAssembly.compile(buffer);
    } else {
      // Streaming compile cannot be hashed first, so it is allowed only when there is
      // no manifest to check against.
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
    const fs = (await importModule('node:fs')) as typeof import('node:fs');
    const { promisify } = (await importModule('node:util')) as typeof import('node:util');
    const readFile = promisify(fs.readFile);

    const readStart = performance.now();
    const buffer = await readFile(path);
    const readEnd = performance.now();

    // SHA-384 integrity check against sibling wasm-manifest.json.
    // Throws on tamper; warns and continues when manifest is absent.
    await verifyWasmIntegrity(buffer, path);

    const compileStart = performance.now();
    this.compiledModule = await WebAssembly.compile(buffer);
    const compileEnd = performance.now();

    const instStart = performance.now();
    const instance = await WebAssembly.instantiate(
      this.compiledModule,
      this.getImports() as WebAssembly.Imports
    );
    const instEnd = performance.now();

    this.lastMetrics = {
      fileReadMs: readEnd - readStart,
      compileMs: compileEnd - compileStart,
      instantiateMs: instEnd - instStart,
      totalMs: performance.now() - totalStart,
      fromCache: false,
    };

    return guardWasmAborts(instance.exports, WASM_ABORT_TEXT) as unknown as TModule;
  }

  protected async loadBrowserWasm(path: string, totalStart: number): Promise<TModule> {
    // Look for the manifest *before* deciding whether to stream. If a
    // manifest exists we must materialize the buffer to compute its hash
    // before compilation — streaming would let an attacker race the
    // bytes past WebAssembly.compile without being checked.
    const manifest = await loadWasmManifest(path);

    if (!manifest && typeof WebAssembly.instantiateStreaming === 'function') {
      // No manifest -> preserve fast streaming path (legacy compat).
      const instStart = performance.now();
      const result = await WebAssembly.instantiateStreaming(
        fetch(path),
        this.getImports() as WebAssembly.Imports
      );
      this.compiledModule = result.module;
      this.lastMetrics = {
        fileReadMs: 0, // Combined with compile in streaming
        compileMs: 0, // Combined in streaming
        instantiateMs: performance.now() - instStart,
        totalMs: performance.now() - totalStart,
        fromCache: false,
      };
      return guardWasmAborts(result.instance.exports, WASM_ABORT_TEXT) as unknown as TModule;
    }

    // Manifest-present (or older browser): fetch buffer, verify, compile.
    const readStart = performance.now();
    const response = await fetch(path);
    const buffer = await response.arrayBuffer();
    const readEnd = performance.now();

    await verifyWasmIntegrity(buffer, path, { manifest });

    const compileStart = performance.now();
    this.compiledModule = await WebAssembly.compile(buffer);
    const compileEnd = performance.now();

    const instStart = performance.now();
    const instance = await WebAssembly.instantiate(
      this.compiledModule,
      this.getImports() as WebAssembly.Imports
    );
    const instEnd = performance.now();

    this.lastMetrics = {
      fileReadMs: readEnd - readStart,
      compileMs: compileEnd - compileStart,
      instantiateMs: instEnd - instStart,
      totalMs: performance.now() - totalStart,
      fromCache: false,
    };

    return guardWasmAborts(instance.exports, WASM_ABORT_TEXT) as unknown as TModule;
  }

  /**
   * The import object of the binary. The binary has no import (#1019): its abort is a trap that
   * {@link guardWasmAborts} turns into the `Error` of {@link WASM_ABORT_TEXT}, so the object is
   * empty.
   */
  protected getImports(): Record<string, object> {
    return {};
  }
}
