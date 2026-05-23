/**
 * Rust WASM Loader
 *
 * Loads and manages the Rust-compiled WebAssembly module (648 KB).
 * The Rust WASM provides heavy computation: matrix multiply (faer),
 * FFT (rustfft), eigendecomposition, sparse algebra, statistics (statrs),
 * and SIMD-accelerated array operations.
 *
 * Memory model:
 *   The Rust WASM uses `#[no_mangle] extern "C"` raw exports with
 *   a linear memory model. Unlike the AssemblyScript WASM, there is
 *   no managed GC heap (`__new`/`__pin`/`__unpin`/`__collect`).
 *   Instead, JavaScript writes data directly into WASM linear memory
 *   at computed offsets and passes those offsets as pointers.
 *
 * @packageDocumentation
 */

/**
 * Typed interface for Rust WASM exports.
 *
 * This is a subset of the full export surface, covering the operations
 * most useful for the matrix backend. The full module has 150+ exports
 * across algebra, arithmetic, signal, statistics, etc.
 */
export interface RustWasmExports {
  // Linear memory
  memory: WebAssembly.Memory;

  // --- Matrix operations ---
  multiplyDense: (
    aPtr: number,
    aRows: number,
    aCols: number,
    bPtr: number,
    bRows: number,
    bCols: number,
    resultPtr: number
  ) => void;
  multiplyDenseSIMD: (
    aPtr: number,
    aRows: number,
    aCols: number,
    bPtr: number,
    bRows: number,
    bCols: number,
    resultPtr: number
  ) => void;
  multiplyVector: (
    aPtr: number,
    aRows: number,
    aCols: number,
    xPtr: number,
    resultPtr: number
  ) => void;
  transpose: (dataPtr: number, rows: number, cols: number, resultPtr: number) => void;

  // --- Decompositions ---
  /** Thin SVD: writes U (m*k), S (k), V (n*k); k = min(m,n). */
  svd: (
    aPtr: number,
    m: number,
    n: number,
    uPtr: number,
    sPtr: number,
    vPtr: number,
    workPtr: number
  ) => number;
  /** Singular values only: writes S (k); k = min(m,n). */
  singularValues: (aPtr: number, m: number, n: number, sPtr: number, workPtr: number) => number;
  /** Scratch length (in f64s) required by `svd`. */
  svdWorkSize: (m: number, n: number) => number;
  /** Scratch length (in f64s) required by `singularValues`. */
  singularValuesWorkSize: (m: number, n: number) => number;

  // --- Element-wise (SIMD-accelerated) ---
  simdAddF64: (aPtr: number, bPtr: number, resultPtr: number, length: number) => void;
  simdSubF64: (aPtr: number, bPtr: number, resultPtr: number, length: number) => void;
  simdMulF64: (aPtr: number, bPtr: number, resultPtr: number, length: number) => void;
  simdScaleF64: (aPtr: number, scalar: number, resultPtr: number, length: number) => void;
  simdAbsF64: (aPtr: number, resultPtr: number, length: number) => void;
  simdDotF64: (aPtr: number, bPtr: number, length: number) => number;
  simdSumF64: (aPtr: number, length: number) => number;
  simdNormF64: (aPtr: number, length: number) => number;
  simdMatMulF64: (
    aPtr: number,
    bPtr: number,
    cPtr: number,
    m: number,
    k: number,
    n: number
  ) => void;

  // --- Reductions ---
  simdMinF64: (aPtr: number, length: number) => number;
  simdMaxF64: (aPtr: number, length: number) => number;
  simdMeanF64: (aPtr: number, length: number) => number;
  simdVarianceF64: (aPtr: number, length: number, ddof: number) => number;
  simdStdF64: (aPtr: number, length: number, ddof: number) => number;

  // --- Decompositions ---
  luDecomposition: (aPtr: number, n: number, permPtr: number) => number;
  qrDecomposition: (aPtr: number, m: number, n: number, qPtr: number) => void;
  choleskyDecomposition: (aPtr: number, n: number, lPtr: number) => number;
  eigsSymmetric: (
    matrixPtr: number,
    n: number,
    precision: number,
    eigenvaluesPtr: number,
    eigenvectorsPtr: number,
    workPtr: number
  ) => number;

  // --- Linear algebra ---
  laInv: (aPtr: number, n: number, resultPtr: number, workPtr: number) => number;
  laDet: (aPtr: number, n: number, workPtr: number) => number;
  laSolve: (aPtr: number, bPtr: number, n: number, resultPtr: number, workPtr: number) => number;

  // --- Signal processing ---
  fft: (dataPtr: number, n: number, inverse: number) => void;
  fft2d: (dataPtr: number, rows: number, cols: number, inverse: number) => void;
  convolve: (signalPtr: number, n: number, kernelPtr: number, m: number, resultPtr: number) => void;
  rfft: (dataPtr: number, n: number, resultPtr: number) => void;

  // --- Statistics ---
  statsMean: (aPtr: number, n: number) => number;
  statsMedian: (aPtr: number, n: number) => number;
  statsVariance: (aPtr: number, n: number, ddof: number) => number;
  statsStd: (aPtr: number, n: number, ddof: number) => number;
  statsSum: (aPtr: number, n: number) => number;
  statsMin: (aPtr: number, n: number) => number;
  statsMax: (aPtr: number, n: number) => number;

  // --- Spike probes ---
  rust_mat_mul_2x2: (aPtr: number, bPtr: number, outPtr: number) => void;
  rust_fft_4: (inPtr: number, outPtr: number) => void;
  rust_gamma: (x: number, outPtr: number) => void;

  // Index signature for dynamic access
  [key: string]: unknown;
}

/**
 * Bump allocator for Rust WASM linear memory.
 *
 * The Rust WASM module has no built-in allocator exports (unlike AssemblyScript).
 * We manage a simple bump allocator on the JS side, writing into WASM linear
 * memory and passing offsets as pointers to the Rust functions.
 *
 * The allocator uses a high-water mark. Call `reset()` between operations
 * to reclaim all temporary memory (batch-free pattern).
 */
class BumpAllocator {
  /** Next free byte offset in WASM memory */
  private offset: number;
  /** Minimum offset (base of allocatable region) */
  private readonly base: number;

  constructor(baseOffset: number) {
    // Start allocations after the Rust static data section.
    // Rust no_std WASM typically uses very little static memory.
    // We leave 64 KB headroom for Rust's own stack/statics.
    this.base = baseOffset;
    this.offset = baseOffset;
  }

  /**
   * Allocate `byteLength` bytes, aligned to 8-byte boundary.
   * Returns the byte offset (pointer) into WASM memory.
   */
  alloc(byteLength: number, memory: WebAssembly.Memory): number {
    // Align to 8 bytes (required for f64)
    const aligned = (this.offset + 7) & ~7;
    const end = aligned + byteLength;

    // Grow memory if needed (each page = 64 KB)
    const currentBytes = memory.buffer.byteLength;
    if (end > currentBytes) {
      const pagesNeeded = Math.ceil((end - currentBytes) / 65536);
      memory.grow(pagesNeeded);
    }

    this.offset = end;
    return aligned;
  }

  /**
   * Reset the allocator, reclaiming all temporary memory.
   * Call between independent operations.
   */
  reset(): void {
    this.offset = this.base;
  }

  /** Current high-water mark */
  get highWaterMark(): number {
    return this.offset;
  }
}

/**
 * Loading metrics for performance monitoring
 */
export interface RustLoadingMetrics {
  loadMs: number;
  compileMs: number;
  instantiateMs: number;
  totalMs: number;
  binarySize: number;
}

/**
 * Loader for the Rust-compiled WASM module.
 *
 * Singleton pattern with lazy loading. The WASM binary is loaded
 * on first use and cached for subsequent calls.
 */
export class RustWasmLoader {
  private static instance: RustWasmLoader | null = null;

  private wasmInstance: WebAssembly.Instance | null = null;
  private wasmMemory: WebAssembly.Memory | null = null;
  private allocator: BumpAllocator | null = null;
  private _isLoaded = false;
  private loading: Promise<boolean> | null = null;
  private lastMetrics: RustLoadingMetrics | null = null;

  private constructor() {}

  static getInstance(): RustWasmLoader {
    if (!RustWasmLoader.instance) {
      RustWasmLoader.instance = new RustWasmLoader();
    }
    return RustWasmLoader.instance;
  }

  get isLoaded(): boolean {
    return this._isLoaded;
  }

  /**
   * Load the Rust WASM module.
   * Returns true on success, false if the binary is not available.
   * Safe to call multiple times (idempotent).
   */
  async load(wasmPath?: string): Promise<boolean> {
    if (this._isLoaded) return true;
    if (this.loading) return this.loading;

    this.loading = this.doLoad(wasmPath);
    const result = await this.loading;
    this.loading = null;
    return result;
  }

  private async doLoad(wasmPath?: string): Promise<boolean> {
    const totalStart = performance.now();

    try {
      const path = wasmPath || this.findWasmPath();
      const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;

      let binarySize = 0;

      if (isNode) {
        const loadStart = performance.now();
        const fs = await import('fs');
        const buffer = fs.readFileSync(path);
        binarySize = buffer.byteLength;
        const loadEnd = performance.now();

        const compileStart = performance.now();
        const module = await WebAssembly.compile(buffer);
        const compileEnd = performance.now();

        const instStart = performance.now();
        this.wasmInstance = await WebAssembly.instantiate(module, this.getImports());
        const instEnd = performance.now();

        this.lastMetrics = {
          loadMs: loadEnd - loadStart,
          compileMs: compileEnd - compileStart,
          instantiateMs: instEnd - instStart,
          totalMs: performance.now() - totalStart,
          binarySize,
        };
      } else {
        // Browser: use streaming compilation
        const instStart = performance.now();
        if (typeof WebAssembly.instantiateStreaming === 'function') {
          const result = await WebAssembly.instantiateStreaming(fetch(path), this.getImports());
          this.wasmInstance = result.instance;
        } else {
          const response = await fetch(path);
          const buffer = await response.arrayBuffer();
          binarySize = buffer.byteLength;
          const module = await WebAssembly.compile(buffer);
          this.wasmInstance = await WebAssembly.instantiate(module, this.getImports());
        }
        this.lastMetrics = {
          loadMs: 0,
          compileMs: 0,
          instantiateMs: performance.now() - instStart,
          totalMs: performance.now() - totalStart,
          binarySize,
        };
      }

      this.wasmMemory = this.wasmInstance.exports.memory as WebAssembly.Memory;

      // Anchor the bump allocator at the module's `__heap_base` global so
      // caller buffers sit above the Rust static-data section. This crate's
      // statics span ~1 MB of lookup tables; a fixed 64 KB base would write
      // straight into them. Falls back to 64 KB if the global is absent.
      const heapBaseGlobal = this.wasmInstance.exports.__heap_base as
        | WebAssembly.Global
        | undefined;
      const heapBase =
        heapBaseGlobal && typeof heapBaseGlobal.value === 'number'
          ? (heapBaseGlobal.value as number)
          : 65536;
      this.allocator = new BumpAllocator(heapBase);

      this._isLoaded = true;
      return true;
    } catch (e) {
      console.warn('Rust WASM not available, using JS fallback:', (e as Error).message);
      return false;
    }
  }

  /**
   * Resolve the WASM binary path.
   * Checks several locations relative to the project root.
   */
  private findWasmPath(): string {
    const isNode = typeof process !== 'undefined' && process.versions?.node !== undefined;

    if (isNode) {
      // Resolve relative to this source file rather than process.cwd() so the
      // path is consistent regardless of where Node was launched from.
      //   <repo-root>/matrix/src/backends/RustWasmLoader.ts
      // → <repo-root>/lib/wasm/mathts.wasm  (3 hops up + lib/wasm/)
      const primary = new URL(`../../../lib/wasm/mathts.wasm`, import.meta.url).pathname;
      return primary;
    }

    // Browser: the same logical path, but expressed as a fetch-able URL.
    return new URL(`../../../lib/wasm/mathts.wasm`, import.meta.url).href;
  }

  private getImports(): WebAssembly.Imports {
    return {
      env: {
        abort: () => {
          throw new Error('Rust WASM abort');
        },
      },
    };
  }

  /**
   * Get the typed exports from the WASM instance.
   */
  getExports(): RustWasmExports | null {
    if (!this.wasmInstance) return null;
    return this.wasmInstance.exports as unknown as RustWasmExports;
  }

  /**
   * Get WASM linear memory.
   */
  getMemory(): WebAssembly.Memory | null {
    return this.wasmMemory;
  }

  /**
   * Get loading metrics.
   */
  getLoadingMetrics(): RustLoadingMetrics | null {
    return this.lastMetrics;
  }

  // =========================================================================
  // Memory Management (Bump Allocator)
  // =========================================================================

  /**
   * Write a Float64Array into WASM memory and return the pointer.
   */
  writeF64(data: Float64Array | number[]): number {
    if (!this.wasmMemory || !this.allocator) {
      throw new Error('Rust WASM not loaded');
    }

    const byteLength = (Array.isArray(data) ? data.length : data.length) * 8;
    const ptr = this.allocator.alloc(byteLength, this.wasmMemory);
    const view = new Float64Array(
      this.wasmMemory.buffer,
      ptr,
      Array.isArray(data) ? data.length : data.length
    );
    view.set(data);
    return ptr;
  }

  /**
   * Allocate an empty Float64Array in WASM memory (for output buffers).
   * Returns the pointer.
   */
  allocF64(length: number): number {
    if (!this.wasmMemory || !this.allocator) {
      throw new Error('Rust WASM not loaded');
    }
    return this.allocator.alloc(length * 8, this.wasmMemory);
  }

  /**
   * Write an Int32Array into WASM memory and return the pointer.
   */
  writeI32(data: Int32Array | number[]): number {
    if (!this.wasmMemory || !this.allocator) {
      throw new Error('Rust WASM not loaded');
    }

    const length = Array.isArray(data) ? data.length : data.length;
    const byteLength = length * 4;
    const ptr = this.allocator.alloc(byteLength, this.wasmMemory);
    const view = new Int32Array(this.wasmMemory.buffer, ptr, length);
    view.set(data);
    return ptr;
  }

  /**
   * Allocate an empty Int32Array in WASM memory.
   */
  allocI32(length: number): number {
    if (!this.wasmMemory || !this.allocator) {
      throw new Error('Rust WASM not loaded');
    }
    return this.allocator.alloc(length * 4, this.wasmMemory);
  }

  /**
   * Read a Float64Array from WASM memory.
   * Note: the returned array is a *copy* (safe after memory reset).
   */
  readF64(ptr: number, length: number): Float64Array {
    if (!this.wasmMemory) {
      throw new Error('Rust WASM not loaded');
    }
    const view = new Float64Array(this.wasmMemory.buffer, ptr, length);
    return new Float64Array(view); // Copy out
  }

  /**
   * Read an Int32Array from WASM memory.
   */
  readI32(ptr: number, length: number): Int32Array {
    if (!this.wasmMemory) {
      throw new Error('Rust WASM not loaded');
    }
    const view = new Int32Array(this.wasmMemory.buffer, ptr, length);
    return new Int32Array(view); // Copy out
  }

  /**
   * Reset the bump allocator. Call between independent operations
   * to reclaim temporary memory.
   */
  resetAllocator(): void {
    this.allocator?.reset();
  }

  /**
   * Reset the loader (for testing).
   */
  reset(): void {
    this.wasmInstance = null;
    this.wasmMemory = null;
    this.allocator = null;
    this._isLoaded = false;
    this.loading = null;
    this.lastMetrics = null;
  }

  /**
   * Reset the singleton (for testing).
   */
  static resetInstance(): void {
    if (RustWasmLoader.instance) {
      RustWasmLoader.instance.reset();
    }
    RustWasmLoader.instance = null;
  }
}

/**
 * Global Rust WASM loader instance
 */
export const rustWasmLoader = RustWasmLoader.getInstance();

/**
 * Initialize the Rust WASM module (call once at startup).
 * Returns true if loaded successfully, false if not available.
 */
export async function initRustWasm(wasmPath?: string): Promise<boolean> {
  return rustWasmLoader.load(wasmPath);
}
