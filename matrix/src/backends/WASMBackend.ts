/**
 * WASM Matrix Backend (AssemblyScript)
 *
 * Implements MatrixBackend using the AssemblyScript-compiled WebAssembly
 * module (`lib/wasm/mathts-as.wasm`, ~42 KB). Falls back to JSBackend when
 * the WASM module is unavailable or for small matrices.
 *
 * ABI:
 *   The AS module exports a managed runtime (`__new` / `__pin` / `__unpin` /
 *   `__collect`) and its matrix/array functions accept managed `Float64Array`
 *   *header* pointers — NOT raw flat-memory pointers. A typed-array header is
 *   a 12-byte block at some offset that stores (buffer, buffer, byteLength).
 *
 *   To call e.g. `matrix_add(a, b, result)` from JS, we have to:
 *     1. `__new(byteLength, 1)` — allocate the data buffer (id=1 = ArrayBuffer)
 *     2. `__pin(buffer)`         — pin so it survives GC while building header
 *     3. `__new(12, 5)`          — allocate the Float64Array header (id=5)
 *     4. Write [buffer, buffer, byteLength] into the header
 *     5. Copy caller data into the buffer
 *     6. `__unpin(buffer)`       — the header now owns the buffer reference
 *
 *   The Rust artifact has no managed runtime and uses a completely different
 *   ABI (camelCase exports, flat-memory raw pointers); for that backend, use
 *   `RustWASMBackend` (from `./RustWASMBackend.ts`).
 *
 * Naming map (Rust ↔ AssemblyScript) — for cross-backend reference:
 *
 *   Op                  Rust (camelCase, flat ptrs)        AS (snake_case, header refs)
 *   ------------------  ---------------------------------  -------------------------------
 *   add                 add(aPtr,bPtr,n,resPtr)            matrix_add(a,b,result)
 *   subtract            subtract(aPtr,bPtr,n,resPtr)       matrix_sub(a,b,result)
 *   multiplyElementwise simdMulF64(aPtr,bPtr,resPtr,n)     matrix_mul_elementwise(a,b,result)
 *   divideElementwise   (none)                              matrix_div_elementwise(a,b,result)
 *   scale               simdScaleF64(aPtr,s,resPtr,n)      matrix_scale(a,scalar,result)
 *   abs                 simdAbsF64(aPtr,resPtr,n)          array_abs(a,result)
 *   negate              simdScaleF64(aPtr,-1,resPtr,n)     matrix_neg(a,result)
 *   multiply            multiplyDense(a,r,c,b,r,c,res)     matrix_multiply(a,aRows,aCols,b,bCols,result)
 *   transpose           transpose(a,r,c,res)               matrix_transpose(a,rows,cols,result)
 *   sum                 simdSumF64(aPtr,n)                 array_sum(a)
 *   norm                simdNormF64(aPtr,n)                array_norm(a)
 *   dot                 dotProduct(aPtr,bPtr,n)            array_dot(a,b)
 *
 *   AssemblyScript has no LU / QR / Cholesky / inverse / determinant exports,
 *   so those operations fall back to the JS implementation. The Rust backend
 *   has them — route those calls through `RustWASMBackend` if you need WASM.
 *
 * @packageDocumentation
 */

import type { MatrixBackend, BackendType } from './Backend.js';
import { DenseMatrix } from '../types/DenseMatrix.js';
import { jsBackend } from './JSBackend.js';
import { detectWasmFeatures, type WasmFeatures } from './wasm/detect.js';

/**
 * Subset of the AssemblyScript module surface this backend uses.
 *
 * The AS module exports ~250 functions total; we only declare the ones the
 * matrix backend actually calls. Anything else lives behind a cast at the
 * call site, but the typed surface here keeps the hot paths honest.
 */
interface AsModule {
  // Managed runtime
  __new: (size: number, id: number) => number;
  __pin: (ptr: number) => number;
  __unpin: (ptr: number) => void;
  __collect: () => void;

  // Linear memory (used to set up typed-array views)
  memory: WebAssembly.Memory;

  // Matrix operations (take Float64Array *header* pointers)
  matrix_add: (aHdr: number, bHdr: number, resultHdr: number) => void;
  matrix_sub: (aHdr: number, bHdr: number, resultHdr: number) => void;
  matrix_mul_elementwise: (aHdr: number, bHdr: number, resultHdr: number) => void;
  matrix_div_elementwise: (aHdr: number, bHdr: number, resultHdr: number) => void;
  matrix_scale: (aHdr: number, scalar: number, resultHdr: number) => void;
  matrix_neg: (aHdr: number, resultHdr: number) => void;
  matrix_multiply: (
    aHdr: number,
    aRows: number,
    aCols: number,
    bHdr: number,
    bCols: number,
    resultHdr: number
  ) => void;
  matrix_transpose: (aHdr: number, rows: number, cols: number, resultHdr: number) => void;
  matrix_norm_frobenius: (aHdr: number) => number;
  matrix_sum: (aHdr: number) => number;

  // Array operations
  array_abs: (aHdr: number, resultHdr: number) => void;
  array_sum: (aHdr: number) => number;
  array_norm: (aHdr: number) => number;
  array_dot: (aHdr: number, bHdr: number) => number;

  // Dense decompositions — see assembly/src/algebra/decomposition.ts.
  // Optional because older AS artifacts don't expose them; the methods
  // below probe at call time and fall back to JS when absent.
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
}

/** AssemblyScript runtime-info IDs (extracted from `assembly/build/mathts.js`). */
const AS_ID_ARRAY_BUFFER = 1;
const AS_ID_FLOAT64_ARRAY = 5;
const AS_ID_INT32_ARRAY = 6;
const AS_F64_ALIGN_SHIFT = 3; // log2(8 bytes/f64)
const AS_I32_ALIGN_SHIFT = 2; // log2(4 bytes/i32)
const AS_HEADER_BYTES = 12;

/**
 * AssemblyScript-managed Float64Array allocation handle.
 *   - `headerPtr` is what AS exports take.
 *   - `bufferPtr` is the data block.
 *   - `view` is a JS Float64Array over that block (re-bound on each
 *     `acquire()` so it stays valid across `memory.grow()`).
 */
interface AsFloat64Allocation {
  headerPtr: number;
  bufferPtr: number;
  view: Float64Array;
  length: number;
}

/**
 * Per-module allocation cache.
 *
 * Why this is needed: the AS module ships with `--runtime stub`, which is
 * a bump allocator with NO free / NO GC (`__pin`/`__unpin`/`__collect` are
 * no-ops at the WASM level — see `assembly/build/mathts.wat`). Naive
 * allocate-per-call leaks linearly and OOMs after a few thousand iterations.
 *
 * The cache pools handles by `length`. A simple LRU-ish "in-use list"
 * lets multiple buffers of the same size coexist (e.g. for a 3-operand
 * matrix op we hold A, B, and Result simultaneously). On `releaseAll`
 * the buffers go back to the free list without being freed.
 *
 * Net effect: total allocator growth is bounded by `max_size × max_concurrent`
 * across the backend's lifetime — typically just a few MB.
 */
class AsAllocCache {
  private free = new Map<number, AsFloat64Allocation[]>();

  /** Acquire (allocate or reuse) a Float64Array of the requested length. */
  acquire(module: AsModule, length: number): AsFloat64Allocation {
    const pool = this.free.get(length);
    if (pool && pool.length > 0) {
      const alloc = pool.pop()!;
      // memory.buffer may have detached after a foreign `memory.grow()`;
      // re-bind the view so the JS-side reference is current.
      alloc.view = new Float64Array(module.memory.buffer, alloc.bufferPtr, length);
      return alloc;
    }
    return this.allocate(module, length);
  }

  /** Return an allocation to the pool (no free; just marks it reusable). */
  release(alloc: AsFloat64Allocation): void {
    let pool = this.free.get(alloc.length);
    if (!pool) {
      pool = [];
      this.free.set(alloc.length, pool);
    }
    pool.push(alloc);
  }

  private allocate(module: AsModule, length: number): AsFloat64Allocation {
    const byteLength = length << AS_F64_ALIGN_SHIFT;
    // Allocate + pin the data buffer (id=1 = ArrayBuffer).
    const bufferPtr = module.__pin(module.__new(byteLength, AS_ID_ARRAY_BUFFER)) >>> 0;
    // Allocate the Float64Array header (id=5) and pin it too so the AS GC
    // (if it ever wakes up — see comment above; today it doesn't) never
    // reclaims it out from under us.
    const headerPtr = module.__new(AS_HEADER_BYTES, AS_ID_FLOAT64_ARRAY) >>> 0;
    module.__pin(headerPtr);

    // Write the header. Layout: [dataStart, dataStart, byteLength].
    const dv = new DataView(module.memory.buffer);
    dv.setUint32(headerPtr + 0, bufferPtr, true);
    dv.setUint32(headerPtr + 4, bufferPtr, true);
    dv.setUint32(headerPtr + 8, byteLength, true);

    const view = new Float64Array(module.memory.buffer, bufferPtr, length);
    return { headerPtr, bufferPtr, view, length };
  }
}

/** Copy JS data into an existing allocation's view. */
function writeAsFloat64Array(
  cache: AsAllocCache,
  module: AsModule,
  data: Float64Array
): AsFloat64Allocation {
  const alloc = cache.acquire(module, data.length);
  alloc.view.set(data);
  return alloc;
}

/** Allocate without copy. */
function allocAsFloat64Array(
  cache: AsAllocCache,
  module: AsModule,
  length: number
): AsFloat64Allocation {
  return cache.acquire(module, length);
}

/** Read back into a fresh JS Float64Array (copy out before pool reuse). */
function readAsFloat64Array(module: AsModule, alloc: AsFloat64Allocation): Float64Array {
  const view = new Float64Array(module.memory.buffer, alloc.bufferPtr, alloc.length);
  return new Float64Array(view);
}

/**
 * AS-managed Int32Array allocation handle. Same shape as the Float64
 * variant — see `AsFloat64Allocation` above for the rationale.
 *
 * Used by the decomposition kernels (`matrix_lu_decompose` returns the
 * row permutation as an Int32Array). The pool is much simpler than the
 * Float64 case because permutation buffers are tiny (length == n) and
 * allocated at most once per call.
 */
interface AsInt32Allocation {
  headerPtr: number;
  bufferPtr: number;
  view: Int32Array;
  length: number;
}

/**
 * Allocate (and pin) a fresh AS-managed Int32Array. No pooling: the
 * decomposition path holds at most one Int32 buffer in flight per call
 * and each is sized by `n` (a small integer), so the cost is negligible
 * compared to the Float64 buffers that the AS-runtime stub allocator
 * already retains for the duration of the process.
 */
function allocAsInt32Array(module: AsModule, length: number): AsInt32Allocation {
  const byteLength = length << AS_I32_ALIGN_SHIFT;
  const bufferPtr = module.__pin(module.__new(byteLength, AS_ID_ARRAY_BUFFER)) >>> 0;
  const headerPtr = module.__new(AS_HEADER_BYTES, AS_ID_INT32_ARRAY) >>> 0;
  module.__pin(headerPtr);
  const dv = new DataView(module.memory.buffer);
  dv.setUint32(headerPtr + 0, bufferPtr, true);
  dv.setUint32(headerPtr + 4, bufferPtr, true);
  dv.setUint32(headerPtr + 8, byteLength, true);
  const view = new Int32Array(module.memory.buffer, bufferPtr, length);
  return { headerPtr, bufferPtr, view, length };
}

/** Copy the AS-managed Int32 buffer into a fresh JS Int32Array. */
function readAsInt32Array(module: AsModule, alloc: AsInt32Allocation): Int32Array {
  const view = new Int32Array(module.memory.buffer, alloc.bufferPtr, alloc.length);
  return new Int32Array(view);
}

/**
 * Release the Int32 allocation. With `--runtime stub` this is a no-op
 * at the WASM level (the AS bump allocator never frees), but we still
 * call `__unpin` for API hygiene — if a future build switches to a
 * real GC runtime this becomes correctness-relevant.
 */
function releaseAsInt32Array(module: AsModule, alloc: AsInt32Allocation): void {
  module.__unpin(alloc.headerPtr);
  module.__unpin(alloc.bufferPtr);
}

/**
 * WASM Backend configuration
 */
export interface WASMBackendConfig {
  /** Minimum elements to use WASM (default: 100) */
  minElements?: number;
  /** Path to WASM file (defaults to the AS artifact, `lib/wasm/mathts-as.wasm`) */
  wasmPath?: string;
  /** Enable SIMD code paths if the AS module exposes them (currently a no-op
   * — AS export surface does not include `simd*` ops; kept for API stability). */
  useSIMD?: boolean;
}

/**
 * Default WASM backend configuration
 */
const DEFAULT_CONFIG: Required<WASMBackendConfig> = {
  minElements: 100,
  wasmPath: '',
  useSIMD: true,
};

/**
 * WASM Backend for matrix operations (AssemblyScript path).
 *
 * For the Rust path use `RustWASMBackend`. Both implement `MatrixBackend`
 * and report different `type` discriminants ('wasm' vs 'rust-wasm') so that
 * `BackendManager` can route operations to the correct one.
 */
export class WASMBackend implements MatrixBackend {
  readonly type: BackendType = 'wasm';

  private config: Required<WASMBackendConfig>;
  private wasmModule: AsModule | null = null;
  private features: WasmFeatures | null = null;
  private initPromise: Promise<void> | null = null;
  /** Pooled allocations — see `AsAllocCache` for rationale. */
  private allocCache = new AsAllocCache();

  constructor(config: WASMBackendConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  isAvailable(): boolean {
    return typeof WebAssembly !== 'undefined';
  }

  async initialize(): Promise<void> {
    if (this.wasmModule) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('WebAssembly is not available in this environment');
    }

    this.features = await detectWasmFeatures();

    try {
      // Load the AS artifact directly. The shared `WasmLoader` singleton
      // is intentionally avoided here: it caches the first module loaded
      // and returns the same instance regardless of the path argument on
      // subsequent calls, so it would clobber Rust ↔ AS routing in a
      // process that uses both. We compile a fresh AS instance for this
      // backend and let `RustWASMBackend` own the Rust instance.
      const path = this.config.wasmPath || (await this.resolveAsWasmPath());
      const loaded = await this.loadAsModule(path);

      if (typeof loaded.__new !== 'function' || typeof loaded.matrix_multiply !== 'function') {
        console.warn(
          'WASMBackend: loaded module is not the AssemblyScript artifact; falling back to JS. ' +
            'Pass an explicit wasmPath or use RustWASMBackend for the Rust artifact.'
        );
        this.wasmModule = null;
        return;
      }
      this.wasmModule = loaded;
    } catch (error) {
      console.warn('Failed to load AssemblyScript WASM module, falling back to JS:', error);
      this.wasmModule = null;
    }
  }

  /**
   * Resolve the path to the AssemblyScript artifact (`lib/wasm/mathts-as.wasm`).
   *
   * On Windows, `URL.pathname` returns "/C:/foo/bar.wasm" which fs.readFile
   * interprets as drive-relative ("C:\C:\foo\..."). `fileURLToPath` does the
   * platform-correct conversion.
   */
  private async resolveAsWasmPath(): Promise<string> {
    const url = new URL(`../../../lib/wasm/mathts-as.wasm`, import.meta.url);
    const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;
    if (isNode) {
      const { fileURLToPath } = await import('node:url');
      return fileURLToPath(url);
    }
    return url.href;
  }

  /**
   * Compile + instantiate the AssemblyScript WASM artifact. Each
   * WASMBackend instance owns its own instance — this is intentional so
   * tests and the Rust backend can coexist in the same process.
   */
  private async loadAsModule(path: string): Promise<AsModule> {
    const imports: WebAssembly.Imports = {
      env: {
        abort: (msg: number, file: number, line: number, column: number) => {
          console.error('AS WASM abort', { msg, file, line, column });
          throw new Error('AS WASM abort');
        },
        seed: () => Date.now(),
      },
      Math: Math as unknown as WebAssembly.ModuleImports,
      Date: Date as unknown as WebAssembly.ModuleImports,
    };

    const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;
    const { loadWasmManifest, verifyWasmIntegrity } = await import('./wasm/integrity.js');
    let instance: WebAssembly.Instance;
    if (isNode) {
      const fs = await import('fs');
      const { promisify } = await import('util');
      const readFile = promisify(fs.readFile);
      const buffer = await readFile(path);
      // SHA-384 integrity check against sibling wasm-manifest.json.
      // Throws on tamper; warns and continues when manifest is absent.
      await verifyWasmIntegrity(buffer, path);
      const module = await WebAssembly.compile(buffer);
      instance = await WebAssembly.instantiate(module, imports);
    } else {
      // Browser: streaming compile only when no manifest is present;
      // otherwise materialize so we can verify the bytes before compile.
      const manifest = await loadWasmManifest(path);
      if (!manifest && typeof WebAssembly.instantiateStreaming === 'function') {
        const result = await WebAssembly.instantiateStreaming(fetch(path), imports);
        instance = result.instance;
      } else {
        const response = await fetch(path);
        const buffer = await response.arrayBuffer();
        await verifyWasmIntegrity(buffer, path, { manifest });
        const module = await WebAssembly.compile(buffer);
        instance = await WebAssembly.instantiate(module, imports);
      }
    }
    return instance.exports as unknown as AsModule;
  }

  private shouldUseWasm(elementCount: number): boolean {
    return this.wasmModule !== null && elementCount >= this.config.minElements;
  }

  getFeatures(): WasmFeatures | null {
    return this.features;
  }

  // =========================================================================
  // Element-wise Operations
  // =========================================================================

  add(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;
    if (!this.shouldUseWasm(elementCount)) return jsBackend.add(a, b);

    const mod = this.wasmModule!;
    const aAlloc = writeAsFloat64Array(this.allocCache, mod, a.toFloat64Array());
    const bAlloc = writeAsFloat64Array(this.allocCache, mod, b.toFloat64Array());
    const rAlloc = allocAsFloat64Array(this.allocCache, mod, elementCount);
    try {
      mod.matrix_add(aAlloc.headerPtr, bAlloc.headerPtr, rAlloc.headerPtr);
      const result = readAsFloat64Array(mod, rAlloc);
      return DenseMatrix.fromFlat(a.rows, a.cols, Array.from(result));
    } finally {
      this.allocCache.release(aAlloc);
      this.allocCache.release(bAlloc);
      this.allocCache.release(rAlloc);
    }
  }

  subtract(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;
    if (!this.shouldUseWasm(elementCount)) return jsBackend.subtract(a, b);

    const mod = this.wasmModule!;
    const aAlloc = writeAsFloat64Array(this.allocCache, mod, a.toFloat64Array());
    const bAlloc = writeAsFloat64Array(this.allocCache, mod, b.toFloat64Array());
    const rAlloc = allocAsFloat64Array(this.allocCache, mod, elementCount);
    try {
      mod.matrix_sub(aAlloc.headerPtr, bAlloc.headerPtr, rAlloc.headerPtr);
      const result = readAsFloat64Array(mod, rAlloc);
      return DenseMatrix.fromFlat(a.rows, a.cols, Array.from(result));
    } finally {
      this.allocCache.release(aAlloc);
      this.allocCache.release(bAlloc);
      this.allocCache.release(rAlloc);
    }
  }

  multiplyElementwise(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;
    if (!this.shouldUseWasm(elementCount)) return jsBackend.multiplyElementwise(a, b);

    const mod = this.wasmModule!;
    const aAlloc = writeAsFloat64Array(this.allocCache, mod, a.toFloat64Array());
    const bAlloc = writeAsFloat64Array(this.allocCache, mod, b.toFloat64Array());
    const rAlloc = allocAsFloat64Array(this.allocCache, mod, elementCount);
    try {
      mod.matrix_mul_elementwise(aAlloc.headerPtr, bAlloc.headerPtr, rAlloc.headerPtr);
      const result = readAsFloat64Array(mod, rAlloc);
      return DenseMatrix.fromFlat(a.rows, a.cols, Array.from(result));
    } finally {
      this.allocCache.release(aAlloc);
      this.allocCache.release(bAlloc);
      this.allocCache.release(rAlloc);
    }
  }

  divideElementwise(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;
    if (!this.shouldUseWasm(elementCount)) return jsBackend.divideElementwise(a, b);

    const mod = this.wasmModule!;
    const aAlloc = writeAsFloat64Array(this.allocCache, mod, a.toFloat64Array());
    const bAlloc = writeAsFloat64Array(this.allocCache, mod, b.toFloat64Array());
    const rAlloc = allocAsFloat64Array(this.allocCache, mod, elementCount);
    try {
      mod.matrix_div_elementwise(aAlloc.headerPtr, bAlloc.headerPtr, rAlloc.headerPtr);
      const result = readAsFloat64Array(mod, rAlloc);
      return DenseMatrix.fromFlat(a.rows, a.cols, Array.from(result));
    } finally {
      this.allocCache.release(aAlloc);
      this.allocCache.release(bAlloc);
      this.allocCache.release(rAlloc);
    }
  }

  scale(a: DenseMatrix, scalar: number): DenseMatrix {
    const elementCount = a.rows * a.cols;
    if (!this.shouldUseWasm(elementCount)) return jsBackend.scale(a, scalar);

    const mod = this.wasmModule!;
    const aAlloc = writeAsFloat64Array(this.allocCache, mod, a.toFloat64Array());
    const rAlloc = allocAsFloat64Array(this.allocCache, mod, elementCount);
    try {
      mod.matrix_scale(aAlloc.headerPtr, scalar, rAlloc.headerPtr);
      const result = readAsFloat64Array(mod, rAlloc);
      return DenseMatrix.fromFlat(a.rows, a.cols, Array.from(result));
    } finally {
      this.allocCache.release(aAlloc);
      this.allocCache.release(rAlloc);
    }
  }

  abs(a: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;
    if (!this.shouldUseWasm(elementCount)) return jsBackend.abs(a);

    const mod = this.wasmModule!;
    const aAlloc = writeAsFloat64Array(this.allocCache, mod, a.toFloat64Array());
    const rAlloc = allocAsFloat64Array(this.allocCache, mod, elementCount);
    try {
      // AS has no dedicated matrix_abs; array_abs operates element-wise.
      mod.array_abs(aAlloc.headerPtr, rAlloc.headerPtr);
      const result = readAsFloat64Array(mod, rAlloc);
      return DenseMatrix.fromFlat(a.rows, a.cols, Array.from(result));
    } finally {
      this.allocCache.release(aAlloc);
      this.allocCache.release(rAlloc);
    }
  }

  negate(a: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;
    if (!this.shouldUseWasm(elementCount)) return jsBackend.negate(a);

    const mod = this.wasmModule!;
    const aAlloc = writeAsFloat64Array(this.allocCache, mod, a.toFloat64Array());
    const rAlloc = allocAsFloat64Array(this.allocCache, mod, elementCount);
    try {
      mod.matrix_neg(aAlloc.headerPtr, rAlloc.headerPtr);
      const result = readAsFloat64Array(mod, rAlloc);
      return DenseMatrix.fromFlat(a.rows, a.cols, Array.from(result));
    } finally {
      this.allocCache.release(aAlloc);
      this.allocCache.release(rAlloc);
    }
  }

  // =========================================================================
  // Matrix Operations
  // =========================================================================

  multiply(a: DenseMatrix, b: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols + b.rows * b.cols;
    if (!this.shouldUseWasm(elementCount)) return jsBackend.multiply(a, b);

    const mod = this.wasmModule!;
    const aAlloc = writeAsFloat64Array(this.allocCache, mod, a.toFloat64Array());
    const bAlloc = writeAsFloat64Array(this.allocCache, mod, b.toFloat64Array());
    const rAlloc = allocAsFloat64Array(this.allocCache, mod, a.rows * b.cols);
    try {
      // Note: AS signature is matrix_multiply(a, aRows, aCols, b, bCols, result).
      // aCols == bRows is implied by the math; no bRows arg is needed.
      mod.matrix_multiply(
        aAlloc.headerPtr,
        a.rows,
        a.cols,
        bAlloc.headerPtr,
        b.cols,
        rAlloc.headerPtr
      );
      const result = readAsFloat64Array(mod, rAlloc);
      return DenseMatrix.fromFlat(a.rows, b.cols, Array.from(result));
    } finally {
      this.allocCache.release(aAlloc);
      this.allocCache.release(bAlloc);
      this.allocCache.release(rAlloc);
    }
  }

  transpose(a: DenseMatrix): DenseMatrix {
    const elementCount = a.rows * a.cols;
    if (!this.shouldUseWasm(elementCount)) return jsBackend.transpose(a);

    const mod = this.wasmModule!;
    const aAlloc = writeAsFloat64Array(this.allocCache, mod, a.toFloat64Array());
    const rAlloc = allocAsFloat64Array(this.allocCache, mod, elementCount);
    try {
      mod.matrix_transpose(aAlloc.headerPtr, a.rows, a.cols, rAlloc.headerPtr);
      const result = readAsFloat64Array(mod, rAlloc);
      return DenseMatrix.fromFlat(a.cols, a.rows, Array.from(result));
    } finally {
      this.allocCache.release(aAlloc);
      this.allocCache.release(rAlloc);
    }
  }

  // =========================================================================
  // Reduction Operations
  // =========================================================================

  sum(a: DenseMatrix): number {
    const elementCount = a.rows * a.cols;
    if (!this.shouldUseWasm(elementCount)) return jsBackend.sum(a) as number;

    const mod = this.wasmModule!;
    const aAlloc = writeAsFloat64Array(this.allocCache, mod, a.toFloat64Array());
    try {
      return mod.matrix_sum(aAlloc.headerPtr);
    } finally {
      this.allocCache.release(aAlloc);
    }
  }

  sumAxis(a: DenseMatrix, axis: 0 | 1): DenseMatrix {
    return jsBackend.sumAxis(a, axis);
  }

  norm(a: DenseMatrix): number {
    const elementCount = a.rows * a.cols;
    if (!this.shouldUseWasm(elementCount)) return jsBackend.norm(a);

    const mod = this.wasmModule!;
    const aAlloc = writeAsFloat64Array(this.allocCache, mod, a.toFloat64Array());
    try {
      return mod.matrix_norm_frobenius(aAlloc.headerPtr);
    } finally {
      this.allocCache.release(aAlloc);
    }
  }

  dot(a: DenseMatrix, b: DenseMatrix): number {
    const elementCount = a.rows * a.cols;
    if (!this.shouldUseWasm(elementCount)) return jsBackend.dot(a, b) as number;

    const mod = this.wasmModule!;
    const aAlloc = writeAsFloat64Array(this.allocCache, mod, a.toFloat64Array());
    const bAlloc = writeAsFloat64Array(this.allocCache, mod, b.toFloat64Array());
    try {
      return mod.array_dot(aAlloc.headerPtr, bAlloc.headerPtr);
    } finally {
      this.allocCache.release(aAlloc);
      this.allocCache.release(bAlloc);
    }
  }

  // =========================================================================
  // LU / QR / Cholesky / Inverse / Determinant
  // -------------------------------------------------------------------------
  // AssemblyScript now exports these alongside the Rust binary (see
  // assembly/src/algebra/decomposition.ts). Each method dispatches to
  // the AS export when the loaded module exposes it; otherwise it falls
  // back to the in-process JS implementation that previously handled
  // every call. The probe is per-call (not per-instance) so older AS
  // binaries that predate this addition keep working — they just hit
  // the JS path until the artifact is rebuilt.
  // =========================================================================

  async luDecomposition(a: DenseMatrix): Promise<{
    lu: DenseMatrix;
    perm: Int32Array;
    singular: boolean;
  }> {
    const n = a.rows;
    if (n !== a.cols) {
      throw new Error('LU decomposition requires a square matrix');
    }
    const mod = this.wasmModule;
    if (!mod || typeof mod.matrix_lu_decompose !== 'function') {
      return this.luDecompositionJS(a);
    }

    const aAlloc = writeAsFloat64Array(this.allocCache, mod, a.toFloat64Array());
    const lAlloc = allocAsFloat64Array(this.allocCache, mod, n * n);
    const uAlloc = allocAsFloat64Array(this.allocCache, mod, n * n);
    const permAlloc = allocAsInt32Array(mod, n);
    try {
      const status = mod.matrix_lu_decompose!(
        aAlloc.headerPtr,
        n,
        lAlloc.headerPtr,
        uAlloc.headerPtr,
        permAlloc.headerPtr
      );
      if (status !== 0) {
        // Singular — match the JS contract: return zeros with singular=true.
        return {
          lu: DenseMatrix.zeros(n, n),
          perm: readAsInt32Array(mod, permAlloc),
          singular: true,
        };
      }
      // Reconstruct the combined LU storage the JS contract returns: the L
      // factor below the diagonal, U on/above. The new AS kernel emits L
      // and U separately, so we recombine here to keep callers stable.
      const lFlat = readAsFloat64Array(mod, lAlloc);
      const uFlat = readAsFloat64Array(mod, uAlloc);
      const combined = new Float64Array(n * n);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          combined[i * n + j] = i > j ? lFlat[i * n + j] : uFlat[i * n + j];
        }
      }
      const perm = readAsInt32Array(mod, permAlloc);
      return { lu: DenseMatrix.fromFlat(n, n, Array.from(combined)), perm, singular: false };
    } finally {
      this.allocCache.release(aAlloc);
      this.allocCache.release(lAlloc);
      this.allocCache.release(uAlloc);
      releaseAsInt32Array(mod, permAlloc);
    }
  }

  private luDecompositionJS(a: DenseMatrix): {
    lu: DenseMatrix;
    perm: Int32Array;
    singular: boolean;
  } {
    const n = a.rows;
    if (n !== a.cols) {
      throw new Error('LU decomposition requires a square matrix');
    }

    const data = new Float64Array(a.toFloat64Array());
    const perm = new Int32Array(n);

    for (let i = 0; i < n; i++) perm[i] = i;

    for (let k = 0; k < n - 1; k++) {
      let maxVal = Math.abs(data[k * n + k]);
      let pivotRow = k;

      for (let i = k + 1; i < n; i++) {
        const val = Math.abs(data[i * n + k]);
        if (val > maxVal) {
          maxVal = val;
          pivotRow = i;
        }
      }

      if (maxVal < 1e-14) {
        return { lu: DenseMatrix.fromFlat(n, n, Array.from(data)), perm, singular: true };
      }

      if (pivotRow !== k) {
        for (let j = 0; j < n; j++) {
          const temp = data[k * n + j];
          data[k * n + j] = data[pivotRow * n + j];
          data[pivotRow * n + j] = temp;
        }
        const temp = perm[k];
        perm[k] = perm[pivotRow];
        perm[pivotRow] = temp;
      }

      const pivot = data[k * n + k];
      for (let i = k + 1; i < n; i++) {
        const factor = data[i * n + k] / pivot;
        data[i * n + k] = factor;
        for (let j = k + 1; j < n; j++) {
          data[i * n + j] -= factor * data[k * n + j];
        }
      }
    }

    return { lu: DenseMatrix.fromFlat(n, n, Array.from(data)), perm, singular: false };
  }

  async qrDecomposition(a: DenseMatrix): Promise<{ q: DenseMatrix; r: DenseMatrix }> {
    const m = a.rows;
    const n = a.cols;
    const mod = this.wasmModule;
    // AS Householder QR assumes m >= n; fall back to JS for wide matrices
    // (the JS path handles both shapes correctly).
    if (!mod || typeof mod.matrix_qr_decompose !== 'function' || m < n) {
      return this.qrDecompositionJS(a);
    }

    const aAlloc = writeAsFloat64Array(this.allocCache, mod, a.toFloat64Array());
    const qAlloc = allocAsFloat64Array(this.allocCache, mod, m * m);
    const rAlloc = allocAsFloat64Array(this.allocCache, mod, m * n);
    try {
      mod.matrix_qr_decompose!(aAlloc.headerPtr, m, n, qAlloc.headerPtr, rAlloc.headerPtr);
      const qFlat = readAsFloat64Array(mod, qAlloc);
      const rFlat = readAsFloat64Array(mod, rAlloc);
      return {
        q: DenseMatrix.fromFlat(m, m, Array.from(qFlat)),
        r: DenseMatrix.fromFlat(m, n, Array.from(rFlat)),
      };
    } finally {
      this.allocCache.release(aAlloc);
      this.allocCache.release(qAlloc);
      this.allocCache.release(rAlloc);
    }
  }

  private qrDecompositionJS(a: DenseMatrix): { q: DenseMatrix; r: DenseMatrix } {
    const m = a.rows;
    const n = a.cols;
    const aData = a.toFloat64Array();
    const r = new Float64Array(m * n);
    const q = new Float64Array(m * m);

    for (let i = 0; i < m * n; i++) r[i] = aData[i];
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) q[i * m + j] = i === j ? 1.0 : 0.0;
    }

    const minDim = Math.min(m, n);

    for (let k = 0; k < minDim; k++) {
      let norm = 0.0;
      for (let i = k; i < m; i++) {
        const val = r[i * n + k];
        norm += val * val;
      }
      norm = Math.sqrt(norm);

      if (norm < 1e-14) continue;

      const sign = r[k * n + k] >= 0.0 ? 1.0 : -1.0;
      const u1 = r[k * n + k] + sign * norm;

      const v = new Float64Array(m - k);
      v[0] = 1.0;
      for (let i = 1; i < m - k; i++) v[i] = r[(k + i) * n + k] / u1;

      let vDotV = 0.0;
      for (let i = 0; i < m - k; i++) vDotV += v[i] * v[i];
      const tau = 2.0 / vDotV;

      for (let j = k; j < n; j++) {
        let vDotCol = 0.0;
        for (let i = 0; i < m - k; i++) vDotCol += v[i] * r[(k + i) * n + j];
        const factor = tau * vDotCol;
        for (let i = 0; i < m - k; i++) r[(k + i) * n + j] -= factor * v[i];
      }

      for (let j = 0; j < m; j++) {
        let vDotCol = 0.0;
        for (let i = 0; i < m - k; i++) vDotCol += v[i] * q[(k + i) * m + j];
        const factor = tau * vDotCol;
        for (let i = 0; i < m - k; i++) q[(k + i) * m + j] -= factor * v[i];
      }
    }

    return {
      q: DenseMatrix.fromFlat(m, m, Array.from(q)),
      r: DenseMatrix.fromFlat(m, n, Array.from(r)),
    };
  }

  async inverse(a: DenseMatrix): Promise<{ inverse: DenseMatrix; singular: boolean }> {
    const n = a.rows;
    if (n !== a.cols) {
      throw new Error('Matrix inverse requires a square matrix');
    }
    const mod = this.wasmModule;
    if (!mod || typeof mod.matrix_inverse !== 'function') {
      return this.inverseJS(a);
    }

    const aAlloc = writeAsFloat64Array(this.allocCache, mod, a.toFloat64Array());
    const resultAlloc = allocAsFloat64Array(this.allocCache, mod, n * n);
    const workAlloc = allocAsFloat64Array(this.allocCache, mod, n * n);
    try {
      const status = mod.matrix_inverse!(
        aAlloc.headerPtr,
        n,
        resultAlloc.headerPtr,
        workAlloc.headerPtr
      );
      if (status !== 0) {
        return { inverse: DenseMatrix.zeros(n, n), singular: true };
      }
      const result = readAsFloat64Array(mod, resultAlloc);
      return { inverse: DenseMatrix.fromFlat(n, n, Array.from(result)), singular: false };
    } finally {
      this.allocCache.release(aAlloc);
      this.allocCache.release(resultAlloc);
      this.allocCache.release(workAlloc);
    }
  }

  private inverseJS(a: DenseMatrix): { inverse: DenseMatrix; singular: boolean } {
    const n = a.rows;
    const { lu, perm, singular } = this.luDecompositionJS(a);

    if (singular) {
      return { inverse: DenseMatrix.zeros(n, n), singular: true };
    }

    const luData = lu.toFloat64Array();
    const result = new Float64Array(n * n);
    const b = new Float64Array(n);
    const x = new Float64Array(n);

    for (let col = 0; col < n; col++) {
      for (let i = 0; i < n; i++) b[i] = i === col ? 1.0 : 0.0;

      for (let i = 0; i < n; i++) {
        let sum = b[perm[i]];
        for (let j = 0; j < i; j++) sum -= luData[i * n + j] * x[j];
        x[i] = sum;
      }

      for (let i = n - 1; i >= 0; i--) {
        let sum = x[i];
        for (let j = i + 1; j < n; j++) sum -= luData[i * n + j] * x[j];
        x[i] = sum / luData[i * n + i];
      }

      for (let i = 0; i < n; i++) result[i * n + col] = x[i];
    }

    return { inverse: DenseMatrix.fromFlat(n, n, Array.from(result)), singular: false };
  }

  async determinantWasm(a: DenseMatrix): Promise<number> {
    const n = a.rows;
    if (n !== a.cols) {
      throw new Error('Determinant requires a square matrix');
    }
    const mod = this.wasmModule;
    if (!mod || typeof mod.matrix_determinant !== 'function') {
      return this.determinantJS(a);
    }

    const aAlloc = writeAsFloat64Array(this.allocCache, mod, a.toFloat64Array());
    const workAlloc = allocAsFloat64Array(this.allocCache, mod, n * n);
    try {
      return mod.matrix_determinant!(aAlloc.headerPtr, n, workAlloc.headerPtr);
    } finally {
      this.allocCache.release(aAlloc);
      this.allocCache.release(workAlloc);
    }
  }

  private determinantJS(a: DenseMatrix): number {
    const n = a.rows;
    const { lu, perm, singular } = this.luDecompositionJS(a);

    if (singular) return 0.0;

    const luData = lu.toFloat64Array();
    let det = 1.0;
    for (let i = 0; i < n; i++) det *= luData[i * n + i];

    // Permutation parity via cycle decomposition: sign(P) = (-1)^(n - cycles).
    // Counting positions where perm[i] !== i is only correct when every cycle
    // is a 2-cycle; a 3-cycle has three non-fixed-points (even) but odd parity.
    const visited = new Uint8Array(n);
    let cycles = 0;
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      cycles++;
      let j = i;
      while (!visited[j]) {
        visited[j] = 1;
        j = perm[j];
      }
    }
    return (n - cycles) % 2 === 0 ? det : -det;
  }

  async choleskyDecomposition(a: DenseMatrix): Promise<{
    l: DenseMatrix;
    positiveDefinite: boolean;
  }> {
    const n = a.rows;
    if (n !== a.cols) {
      throw new Error('Cholesky decomposition requires a square matrix');
    }
    const mod = this.wasmModule;
    if (!mod || typeof mod.matrix_cholesky !== 'function') {
      return this.choleskyDecompositionJS(a);
    }

    const aAlloc = writeAsFloat64Array(this.allocCache, mod, a.toFloat64Array());
    const lAlloc = allocAsFloat64Array(this.allocCache, mod, n * n);
    try {
      const status = mod.matrix_cholesky!(aAlloc.headerPtr, n, lAlloc.headerPtr);
      if (status !== 0) {
        return { l: DenseMatrix.zeros(n, n), positiveDefinite: false };
      }
      const result = readAsFloat64Array(mod, lAlloc);
      return { l: DenseMatrix.fromFlat(n, n, Array.from(result)), positiveDefinite: true };
    } finally {
      this.allocCache.release(aAlloc);
      this.allocCache.release(lAlloc);
    }
  }

  private choleskyDecompositionJS(a: DenseMatrix): {
    l: DenseMatrix;
    positiveDefinite: boolean;
  } {
    const n = a.rows;
    if (n !== a.cols) {
      throw new Error('Cholesky decomposition requires a square matrix');
    }

    const aData = a.toFloat64Array();
    const l = new Float64Array(n * n);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = aData[i * n + j];

        for (let k = 0; k < j; k++) {
          sum -= l[i * n + k] * l[j * n + k];
        }

        if (i === j) {
          if (sum <= 0.0) {
            return { l: DenseMatrix.zeros(n, n), positiveDefinite: false };
          }
          l[i * n + j] = Math.sqrt(sum);
        } else {
          l[i * n + j] = sum / l[j * n + j];
        }
      }
    }

    return { l: DenseMatrix.fromFlat(n, n, Array.from(l)), positiveDefinite: true };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<WASMBackendConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<WASMBackendConfig> {
    return { ...this.config };
  }
}

/**
 * Global WASM backend instance (AssemblyScript path)
 */
export const wasmBackend = new WASMBackend();

/**
 * Create a WASM backend (AssemblyScript path) with custom configuration
 */
export function createWASMBackend(config?: WASMBackendConfig): WASMBackend {
  return new WASMBackend(config);
}
