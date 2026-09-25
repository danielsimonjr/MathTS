/**
 * WASM Loader - Loads and manages WebAssembly modules
 * Provides a bridge between JavaScript/TypeScript and compiled WASM
 *
 * Optimizations:
 * - Singleton pattern with module caching
 * - Streaming compilation in browsers (WebAssembly.instantiateStreaming)
 * - Compiled module caching for faster re-instantiation
 *
 * Security:
 * - Optional SHA-384 integrity verification against a sibling
 *   `wasm-manifest.json`. See `./integrity.ts`. When the manifest is
 *   present any tampered .wasm payload is rejected before instantiation.
 */

import { verifyWasmIntegrity, loadWasmManifest } from './integrity.js';
import { resolvePackagedWasm, defaultWasmLocation, resolveBrowserWasm } from './resolve.js';
import type { LoadingMetrics } from '@danielsimonjr/mathts-core/internal';
export type { LoadingMetrics };

/**
 * Exports of the AssemblyScript WebAssembly module (`mathts-as.wasm`) that the
 * loader and the per-domain `wasm-bridge.ts` bridges use: kernels and memory
 * helpers.
 */
export interface WasmModule {
  // Signal processing. Raw-export ABI: an AS `Float64Array` parameter arrives as
  // its header pointer.
  fft: (dataPtr: number, n: number, inverse: number) => void;
  rfft: (dataPtr: number, n: number, resultPtr: number) => void;

  // Pointer-style lgamma array kernel (Slice 5.8)
  lgamma_f64: (xsPtr: number, n: number, outPtr: number) => number;

  // AS-backend elementwise bitwise kernels. These are the only bitwise kernels
  // dispatched today; the bridge gates on the AS sentinel and falls back to JS
  // when the loaded binary is not the AS one.
  bitAnd_i32_array?: (a: Int32Array, b: Int32Array, result: Int32Array) => void;
  bitOr_i32_array?: (a: Int32Array, b: Int32Array, result: Int32Array) => void;
  bitXor_i32_array?: (a: Int32Array, b: Int32Array, result: Int32Array) => void;
  bitNot_i32_array?: (a: Int32Array, result: Int32Array) => void;
  leftShift_i32_array?: (a: Int32Array, b: Int32Array, result: Int32Array) => void;
  rightArithShift_i32_array?: (a: Int32Array, b: Int32Array, result: Int32Array) => void;
  rightLogShift_i32_array?: (a: Int32Array, b: Int32Array, result: Int32Array) => void;

  // Polynomial hot-loop kernels (Slice 3.7).
  // Legacy native-pointer ABI (removed): pointer-style (a_ptr, a_len, b_ptr, b_len, out_ptr) → out_len.
  // AS backend (live): typed-array-style (a: Float64Array, b: Float64Array) → Float64Array.
  poly_mul_f64?: (aPtr: number, aLen: number, bPtr: number, bLen: number, outPtr: number) => number;
  poly_div_mod_f64?: (
    numPtr: number,
    numLen: number,
    denPtr: number,
    denLen: number,
    outPtr: number
  ) => number;

  // Polynomial scalar kernels (Slice 4.5).
  // Legacy native-pointer ABI (removed): pointer-style, returns a scalar f64.
  // AS backend (live): typed-array calling convention, returns f64.
  poly_resultant_f64?: (pPtr: number, pLen: number, qPtr: number, qLen: number) => number;
  poly_discriminant_f64?: (pPtr: number, pLen: number) => number;

  // Polynomial-fit kernels (Slice 5.4).
  // Legacy native-pointer ABI (removed): pointer-style.
  //   poly_fit_f64(xs_ptr, ys_ptr, n, degree, out_ptr) → degree+1 (or -1 on error)
  //   cheb_fit_f64(xs_ptr, ys_ptr, n, degree, out_ptr) → degree+1 (or -1 on error)
  //   legendre_fit_f64(xs_ptr, ys_ptr, n, degree, out_ptr) → degree+1 (or -1 on error)
  // AS backend (live): typed-array calling convention.
  //   poly_fit_f64_as(xs, ys, degree) → Float64Array (NaN[1] on error)
  //   cheb_fit_f64_as(xs, ys, degree) → Float64Array (NaN[1] on error)
  //   legendre_fit_f64_as(xs, ys, degree) → Float64Array (NaN[1] on error)
  poly_fit_f64?: (
    xsPtr: number,
    ysPtr: number,
    n: number,
    degree: number,
    outPtr: number
  ) => number;
  cheb_fit_f64?: (
    xsPtr: number,
    ysPtr: number,
    n: number,
    degree: number,
    outPtr: number
  ) => number;
  legendre_fit_f64?: (
    xsPtr: number,
    ysPtr: number,
    n: number,
    degree: number,
    outPtr: number
  ) => number;

  // Tridiagonal-solve kernel (Slice 3.10b).
  // Legacy native-pointer ABI (removed): pointer-style
  //   (diag_ptr, lower_ptr, upper_ptr, rhs_ptr, n, out_ptr) → n (or -1 on singular).
  // AS backend (live): typed-array-style (diag, lower, upper, rhs) → Float64Array.
  tridiag_solve_f64?: (
    diagPtr: number,
    lowerPtr: number,
    upperPtr: number,
    rhsPtr: number,
    n: number,
    outPtr: number
  ) => number;

  // Divided-difference kernel (Slice 5.5).
  // Legacy native-pointer ABI (removed): pointer-style
  //   divided_difference_f64(xs_ptr, ys_ptr, n, out_ptr) → n (or -1 on duplicate xs).
  // AS backend (live): typed-array calling convention.
  //   divided_difference_f64_as(xs, ys) → Float64Array (length 0 on duplicate xs).
  divided_difference_f64?: (xsPtr: number, ysPtr: number, n: number, outPtr: number) => number;

  // Bessel J/Y array kernels (Slice 3.10c-1) + Airy Ai/Bi (Slice 4.9).
  // Legacy native-pointer ABI (removed): pointer-style.
  //   bessel_j0_f64(xs_ptr, n, out_ptr) → n (or -1 on error)
  //   bessel_j1_f64(xs_ptr, n, out_ptr) → n (or -1 on error)
  //   bessel_j_f64(order, xs_ptr, n_elems, out_ptr) → n_elems (or -1)
  //   bessel_y0_f64(xs_ptr, n, out_ptr) → n (or -1 on error)
  //   bessel_y1_f64(xs_ptr, n, out_ptr) → n (or -1 on error)
  //   bessel_y_f64(order, xs_ptr, n_elems, out_ptr) → n_elems (or -1)
  //   airy_ai_f64(xs_ptr, n, out_ptr) → n (or -1 on error)
  //   airy_bi_f64(xs_ptr, n, out_ptr) → n (or -1 on error)
  // AS backend: typed-array calling convention.
  //   bessel_j0_f64_as(xs: Float64Array) → Float64Array
  //   bessel_j1_f64_as(xs: Float64Array) → Float64Array
  //   bessel_jn_f64_as(n: i32, xs: Float64Array) → Float64Array
  //   bessel_y0_f64_as(xs: Float64Array) → Float64Array
  //   bessel_y1_f64_as(xs: Float64Array) → Float64Array
  //   bessel_yn_f64_as(n: i32, xs: Float64Array) → Float64Array
  //   airy_ai_f64_as(xs: Float64Array) → Float64Array
  //   airy_bi_f64_as(xs: Float64Array) → Float64Array
  bessel_j0_f64?: (xsPtr: number, n: number, outPtr: number) => number;
  bessel_j1_f64?: (xsPtr: number, n: number, outPtr: number) => number;
  bessel_j_f64?: (order: number, xsPtr: number, nElems: number, outPtr: number) => number;
  bessel_y0_f64?: (xsPtr: number, n: number, outPtr: number) => number;
  bessel_y1_f64?: (xsPtr: number, n: number, outPtr: number) => number;
  bessel_y_f64?: (order: number, xsPtr: number, nElems: number, outPtr: number) => number;
  airy_ai_f64?: (xsPtr: number, n: number, outPtr: number) => number;
  airy_bi_f64?: (xsPtr: number, n: number, outPtr: number) => number;
  // Elliptic K/E array kernels (Slice 5.3).
  // Legacy native-pointer ABI (removed): pointer-style.
  //   elliptic_k_f64(ms_ptr, n, out_ptr) → n (or -1 on error)
  //   elliptic_e_f64(ms_ptr, n, out_ptr) → n (or -1 on error)
  // AS backend: typed-array calling convention.
  //   elliptic_k_f64_as(ms: Float64Array) → Float64Array
  //   elliptic_e_f64_as(ms: Float64Array) → Float64Array
  elliptic_k_f64?: (msPtr: number, n: number, outPtr: number) => number;
  elliptic_e_f64?: (msPtr: number, n: number, outPtr: number) => number;
  // Carlson symmetric forms + incomplete elliptic integrals (Slice 6.4).
  // Legacy native-pointer ABI (removed): pointer-style (all input arrays + count + output pointer).
  //   carlson_rc_f64(xs_ptr, ys_ptr, n, out_ptr)                     → n | -1
  //   carlson_rf_f64(xs_ptr, ys_ptr, zs_ptr, n, out_ptr)             → n | -1
  //   carlson_rd_f64(xs_ptr, ys_ptr, zs_ptr, n, out_ptr)             → n | -1
  //   carlson_rj_f64(xs_ptr, ys_ptr, zs_ptr, ps_ptr, n, out_ptr)     → n | -1
  //   elliptic_f_incomplete_f64(phis_ptr, ms_ptr, n, out_ptr)         → n | -1
  //   elliptic_e_incomplete_f64(phis_ptr, ms_ptr, n, out_ptr)         → n | -1
  //   elliptic_pi_incomplete_f64(ns_ptr, phis_ptr, ms_ptr, n, out)   → n | -1
  // AS backend: typed-array calling convention (_as suffix).
  carlson_rc_f64?: (xsPtr: number, ysPtr: number, n: number, outPtr: number) => number;
  carlson_rf_f64?: (
    xsPtr: number,
    ysPtr: number,
    zsPtr: number,
    n: number,
    outPtr: number
  ) => number;
  carlson_rd_f64?: (
    xsPtr: number,
    ysPtr: number,
    zsPtr: number,
    n: number,
    outPtr: number
  ) => number;
  carlson_rj_f64?: (
    xsPtr: number,
    ysPtr: number,
    zsPtr: number,
    psPtr: number,
    n: number,
    outPtr: number
  ) => number;
  elliptic_f_incomplete_f64?: (phisPtr: number, msPtr: number, n: number, outPtr: number) => number;
  elliptic_e_incomplete_f64?: (phisPtr: number, msPtr: number, n: number, outPtr: number) => number;
  elliptic_pi_incomplete_f64?: (
    nsPtr: number,
    phisPtr: number,
    msPtr: number,
    n: number,
    outPtr: number
  ) => number;

  // Spectral signal kernels (Slice 5.6).
  // Legacy native-pointer ABI (removed): pointer-style.
  //   apply_window_f64(samples_ptr, n, window_type) → 0 on success, -1 on error
  //   welch_psd_f64(samples_ptr, n, frame_length, overlap, window_type, out_ptr) → 0/-1
  //   bartlett_psd_f64(samples_ptr, n, frame_length, out_ptr) → 0/-1
  //   goertzel_f64(samples_ptr, n, target_freq, sample_rate) → |X[k]|² (f64)
  //   chirp_z_transform_f64(samples_ptr, n, m, ps_re, ps_im, pw_re, pw_im, re_ptr, im_ptr) → 0/-1
  // AS backend: typed-array calling convention.
  //   apply_window_f64_as(samples, window_type) → 0/-1
  //   welch_psd_f64_as(samples, frame_length, overlap, window_type) → Float64Array
  //   bartlett_psd_f64_as(samples, frame_length) → Float64Array
  //   goertzel_f64_as(samples, target_freq, sample_rate) → f64
  //   chirp_z_transform_f64_as(samples, m, ps_re, ps_im, pw_re, pw_im) → Float64Array (interleaved)
  apply_window_f64?: (samplesPtr: number, n: number, windowType: number) => number;
  welch_psd_f64?: (
    samplesPtr: number,
    n: number,
    frameLength: number,
    overlap: number,
    windowType: number,
    outPtr: number
  ) => number;
  bartlett_psd_f64?: (samplesPtr: number, n: number, frameLength: number, outPtr: number) => number;
  goertzel_f64?: (samplesPtr: number, n: number, targetFreq: number, sampleRate: number) => number;
  chirp_z_transform_f64?: (
    samplesPtr: number,
    n: number,
    m: number,
    phiStartRe: number,
    phiStartIm: number,
    phiStepRe: number,
    phiStepIm: number,
    outRePtr: number,
    outImPtr: number
  ) => number;

  // Sort kernels (Slice 5.7a).
  // Legacy native-pointer ABI (removed): pointer-style.
  //   sort_f64(ptr, n)              → n (in-place, NaN-last)
  //   argsort_f64(data_ptr, n, out_ptr) → n
  //   rank_f64(data_ptr, n, out_ptr)    → n
  // AS backend: typed-array ABI (no _as suffix — same name, detected by signature).
  //   sort_f64(data)     → Float64Array
  //   argsort_f64(data)  → Int32Array
  //   rank_f64(data)     → Int32Array
  sort_f64?: (ptr: number, n: number) => number;
  argsort_f64?: (dataPtr: number, n: number, outPtr: number) => number;
  rank_f64?: (dataPtr: number, n: number, outPtr: number) => number;

  // Dense matrix decompositions exported by the AssemblyScript binary.
  // The legacy native binary exposed the same algorithms under `luDecomposition` /
  // `qrDecomposition` / `choleskyDecomposition` / `laInv` / `laDet` with raw
  // flat-memory pointer arguments (removed). The live AS exports use AS-runtime header references
  // that carry their own length, so the signatures here take `number` headers
  // because calling these through `instance.exports` passes the header pointer,
  // not a JS typed array. The matrix backend (matrix/src/backends/WASMBackend.ts)
  // probes for these at runtime and falls through to JS when the loaded binary
  // is not the AS one.
  matrix_lu_decompose?: (
    aHdr: number,
    n: number,
    lOutHdr: number,
    uOutHdr: number,
    permOutHdr: number
  ) => number;
  matrix_qr_decompose?: (
    aHdr: number,
    m: number,
    n: number,
    qOutHdr: number,
    rOutHdr: number
  ) => number;
  matrix_cholesky?: (aHdr: number, n: number, lOutHdr: number) => number;
  matrix_inverse?: (aHdr: number, n: number, resultHdr: number, workHdr: number) => number;
  matrix_determinant?: (aHdr: number, n: number, workHdr: number) => number;

  // Memory management
  __new: (size: number, id: number) => number;
  __pin: (ptr: number) => number;
  __unpin: (ptr: number) => void;
  __collect: () => void;
  memory: WebAssembly.Memory;
}

// `LoadingMetrics` consolidated onto `@danielsimonjr/mathts-core/internal`'s
// byte-identical definition, formerly duplicated with
// `matrix/src/backends/WasmLoader.ts` (see
// docs/Architecture/duplicate-symbols.json).

/**
 * Load, integrity-check and cache the WebAssembly module.
 *
 * Use `getInstance` to get the one shared loader.
 */
export class WasmLoader {
  private static instance: WasmLoader | null = null;
  private wasmModule: WasmModule | null = null;
  private compiledModule: WebAssembly.Module | null = null;
  private loading: Promise<WasmModule> | null = null;
  private isNode: boolean;
  private lastMetrics: LoadingMetrics | null = null;

  private constructor() {
    this.isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;
  }

  public static getInstance(): WasmLoader {
    if (!WasmLoader.instance) {
      WasmLoader.instance = new WasmLoader();
    }
    return WasmLoader.instance;
  }

  /**
   * Load the WASM module
   */
  public async load(wasmPath?: string): Promise<WasmModule> {
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
    } finally {
      this.loading = null;
    }
    return this.wasmModule;
  }

  /**
   * Precompile the WASM module without instantiation
   * Useful for build-time or startup optimization
   */
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

  private async loadModule(wasmPath?: string): Promise<WasmModule> {
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
      return instance.exports as unknown as WasmModule;
    }

    if (this.isNode) {
      return this.loadNodeWasm(path, totalStart);
    } else {
      return this.loadBrowserWasm(path, totalStart);
    }
  }

  /**
   * Get the WASM binary path.
   *
   * AssemblyScript is the sole WASM backend (`mathts-as.wasm`); the legacy
   * native WASM toolchain was removed (migration complete 2026-06-26).
   *
   * Returns an async result because the Node branch dynamically imports
   * `node:url` (fileURLToPath) so the path is resolved relative to this
   * source file's location rather than process.cwd(). The browser branch
   * probes candidate URLs with `fetch(..., { method: 'HEAD' })` for the same
   * reason Node walks the filesystem — see {@link resolveBrowserWasm}.
   */
  private async getDefaultWasmPath(): Promise<string> {
    const wasmFile = 'mathts-as.wasm';

    if (this.isNode) {
      // Prefer the wasm co-located in the package (dist/wasm/), which works in
      // both the monorepo and the published layout. Fall back to the legacy
      // monorepo-relative path if the packaged copy isn't present.
      const packaged = await resolvePackagedWasm(import.meta.url, wasmFile);
      if (packaged) return packaged;
      // No packaged copy found anywhere up-tree: return the canonical expected
      // location so the missing-binary warning is actionable (run the build).
      return defaultWasmLocation(import.meta.url, wasmFile);
    }
    return resolveBrowserWasm(import.meta.url, wasmFile);
  }

  private async loadNodeWasm(path: string, totalStart: number): Promise<WasmModule> {
    const fs = await import('fs');
    const { promisify } = await import('util');
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
    const instance = await WebAssembly.instantiate(this.compiledModule, this.getImports());
    const instEnd = performance.now();

    this.lastMetrics = {
      fileReadMs: readEnd - readStart,
      compileMs: compileEnd - compileStart,
      instantiateMs: instEnd - instStart,
      totalMs: performance.now() - totalStart,
      fromCache: false,
    };

    return instance.exports as unknown as WasmModule;
  }

  private async loadBrowserWasm(path: string, totalStart: number): Promise<WasmModule> {
    // Look for the manifest *before* deciding whether to stream. If a
    // manifest exists we must materialize the buffer to compute its hash
    // before compilation — streaming would let an attacker race the
    // bytes past WebAssembly.compile without being checked.
    const manifest = await loadWasmManifest(path);

    if (!manifest && typeof WebAssembly.instantiateStreaming === 'function') {
      // No manifest -> preserve fast streaming path (legacy compat).
      const instStart = performance.now();
      const result = await WebAssembly.instantiateStreaming(fetch(path), this.getImports());
      this.compiledModule = result.module;
      this.lastMetrics = {
        fileReadMs: 0, // Combined with compile in streaming
        compileMs: 0, // Combined in streaming
        instantiateMs: performance.now() - instStart,
        totalMs: performance.now() - totalStart,
        fromCache: false,
      };
      return result.instance.exports as unknown as WasmModule;
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
    const instance = await WebAssembly.instantiate(this.compiledModule, this.getImports());
    const instEnd = performance.now();

    this.lastMetrics = {
      fileReadMs: readEnd - readStart,
      compileMs: compileEnd - compileStart,
      instantiateMs: instEnd - instStart,
      totalMs: performance.now() - totalStart,
      fromCache: false,
    };

    return instance.exports as unknown as WasmModule;
  }

  private getImports(): WebAssembly.Imports {
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

  /**
   * Get the loaded WASM module
   */
  public getModule(): WasmModule | null {
    return this.wasmModule;
  }

  /**
   * Get the compiled WASM module (for caching/serialization)
   */
  public getCompiledModule(): WebAssembly.Module | null {
    return this.compiledModule;
  }

  /**
   * Check if WASM is loaded
   */
  public isLoaded(): boolean {
    return this.wasmModule !== null;
  }

  /**
   * Check if WASM is precompiled
   */
  public isPrecompiled(): boolean {
    return this.compiledModule !== null;
  }

  /**
   * Get loading performance metrics
   */
  public getLoadingMetrics(): LoadingMetrics | null {
    return this.lastMetrics;
  }

  /**
   * Run garbage collection
   */
  public collect(): void {
    const module = this.wasmModule;
    if (!module) return;

    module.__collect();
  }

  /**
   * Reset the loader (for testing)
   */
  public reset(): void {
    this.wasmModule = null;
    this.compiledModule = null;
    this.loading = null;
    this.lastMetrics = null;
  }
}

/**
 * Global WASM loader instance
 */
export const wasmLoader = WasmLoader.getInstance();

/** Prefix of every error `verifyWasmIntegrity` throws for a binary it rejects. */
const INTEGRITY_FAILURE = 'WASM integrity check failed';

/**
 * Opt in to the AssemblyScript WASM tier.
 *
 * Nothing loads the binary on its own: until this resolves `true`, every function
 * runs its JavaScript path. Afterwards each function whose WASM bridge has a
 * measured win dispatches to AssemblyScript above that bridge's size threshold,
 * and falls back to JavaScript below it.
 *
 * The binary's SHA-384 is checked against the `wasm-manifest.json` beside it
 * before it is instantiated.
 *
 * @param wasmPath Path (Node) or URL (browser) of `mathts-as.wasm`. Defaults to the
 *   copy shipped in this package.
 * @returns `true` once the module is loaded (or already was); `false` when the
 *   binary cannot be found, read or instantiated. A later call may retry.
 * @throws When the binary fails its integrity check. A tampered binary is never
 *   ignored silently.
 */
export async function loadWasm(wasmPath?: string): Promise<boolean> {
  try {
    await wasmLoader.load(wasmPath);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(INTEGRITY_FAILURE)) throw error;
    return false;
  }
}

/** Whether `loadWasm()` has loaded the AssemblyScript module. */
export function isWasmLoaded(): boolean {
  return wasmLoader.isLoaded();
}
