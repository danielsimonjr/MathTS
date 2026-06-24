/**
 * WASM Loader - Loads and manages WebAssembly modules
 * Provides a bridge between JavaScript/TypeScript and compiled WASM
 *
 * Optimizations:
 * - Singleton pattern with module caching
 * - Streaming compilation in browsers (WebAssembly.instantiateStreaming)
 * - Memory pooling for frequent allocations
 * - Compiled module caching for faster re-instantiation
 * - Configurable size thresholds for JS fallback
 *
 * Hybrid Rust/AssemblyScript ABI support
 * --------------------------------------
 * The two WASM artifacts shipped by this package use *different* memory
 * models. The loader detects which one is loaded after `load()` resolves
 * and routes allocations through the correct path:
 *
 *  - AssemblyScript artifact (`mathts-as.wasm`): managed runtime. Buffers
 *    are allocated via `__new(byteLength, id)` and the typed-array exports
 *    expect a 12-byte *header* pointer (id=5 for Float64Array, id=4 for
 *    Int32Array). The header holds [dataStart, dataStart, byteLength] in
 *    little-endian u32s. The data block (id=1 = ArrayBuffer) is allocated
 *    separately; we pin both so the GC can't reclaim them.
 *
 *  - Rust artifact (`mathts.wasm`): no managed runtime. The Rust functions
 *    take *flat* linear-memory offsets as pointers. There is no `__new`
 *    export; we manage a JS-side bump allocator anchored at `__heap_base`
 *    so caller buffers sit above Rust's static-data section.
 *
 * Callers receive an opaque `Allocation` handle whose `.ptr` is always the
 * pointer to pass to the WASM function (header pointer on AS, flat offset
 * on Rust) and whose `.array` is a JS view over the data region. Callers
 * do not need to branch on `kind`; only the loader does.
 */

export interface WasmModule {
  // Matrix operations
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
  add: (aPtr: number, bPtr: number, size: number, resultPtr: number) => void;
  subtract: (aPtr: number, bPtr: number, size: number, resultPtr: number) => void;
  scalarMultiply: (aPtr: number, scalar: number, size: number, resultPtr: number) => void;
  dotProduct: (aPtr: number, bPtr: number, size: number) => number;

  // Linear algebra decompositions
  luDecomposition: (aPtr: number, n: number, permPtr: number) => number;
  qrDecomposition: (aPtr: number, m: number, n: number, qPtr: number) => void;
  choleskyDecomposition: (aPtr: number, n: number, lPtr: number) => number;
  schur: (
    aPtr: number,
    n: number,
    maxIter: number,
    tol: number,
    qPtr: number,
    tPtr: number,
    workPtr: number
  ) => number; // returns 1 if successful, 0 if failed
  luSolve: (luPtr: number, n: number, permPtr: number, bPtr: number, xPtr: number) => void;
  luDeterminant: (luPtr: number, n: number, permPtr: number) => number;

  // Linear algebra (linalg module)
  laDet: (aPtr: number, n: number, workPtr: number) => number;
  laInv: (aPtr: number, n: number, resultPtr: number, workPtr: number) => number; // returns 1 if successful, 0 if singular
  laInv2x2: (aPtr: number, resultPtr: number) => number; // returns 0 on success, -1 if singular
  laInv3x3: (aPtr: number, resultPtr: number) => number; // returns 0 on success, -1 if singular
  laCond1: (aPtr: number, n: number, workPtr: number) => number; // 1-norm condition number
  laCondInf: (aPtr: number, n: number, workPtr: number) => number; // infinity-norm condition number
  laKron: (
    aPtr: number,
    aRows: number,
    aCols: number,
    bPtr: number,
    bRows: number,
    bCols: number
  ) => number; // returns ptr to result
  laDot: (aPtr: number, bPtr: number, n: number) => number;
  laCross: (aPtr: number, bPtr: number) => number; // returns ptr to result (3 elements)
  laNorm2: (xPtr: number, n: number) => number;
  laSolve: (aPtr: number, bPtr: number, n: number, resultPtr: number, workPtr: number) => number; // returns 1 if successful, 0 if singular
  laLsolve: (lPtr: number, bPtr: number, n: number, resultPtr: number) => number; // returns 1 if successful, 0 if singular
  laUsolve: (uPtr: number, bPtr: number, n: number, resultPtr: number) => number; // returns 1 if successful, 0 if singular

  // Eigenvalue operations
  eigsSymmetric: (
    matrixPtr: number,
    n: number,
    precision: number,
    eigenvaluesPtr: number,
    eigenvectorsPtr: number,
    workPtr: number
  ) => number; // returns number of iterations, -1 on failure
  powerIteration: (
    matrixPtr: number,
    n: number,
    eigenvaluePtr: number,
    eigenvectorPtr: number,
    workPtr: number,
    maxIterations: number,
    tolerance: number
  ) => number; // returns number of iterations
  spectralRadius: (
    matrixPtr: number,
    n: number,
    workPtr: number,
    maxIterations: number,
    tolerance: number
  ) => number; // returns spectral radius
  inverseIteration: (
    matrixPtr: number,
    n: number,
    shift: number,
    eigenvectorPtr: number,
    workPtr: number,
    maxIterations: number,
    tolerance: number
  ) => number; // returns number of iterations

  // Complex eigenvalue operations
  balanceMatrix: (matrixPtr: number, n: number, scalePtr: number, transformPtr: number) => void;
  reduceToHessenberg: (matrixPtr: number, n: number, transformPtr: number) => void;
  eigenvalues2x2: (
    a: number,
    b: number,
    c: number,
    d: number,
    realPtr: number,
    imagPtr: number
  ) => void;
  qrIterationStep: (matrixPtr: number, n: number, workPtr: number, shift: number) => void;
  qrAlgorithm: (
    matrixPtr: number,
    n: number,
    eigenvaluesRealPtr: number,
    eigenvaluesImagPtr: number,
    workPtr: number,
    maxIterations: number,
    tolerance: number
  ) => number; // returns number of iterations
  hessenbergQRStep: (
    matrixPtr: number,
    n: number,
    startRow: number,
    endRow: number,
    shift: number
  ) => void;

  // Matrix exponential
  expm: (matrixPtr: number, n: number, resultPtr: number, workPtr: number) => number; // returns 0 on success
  expmSmall: (
    matrixPtr: number,
    n: number,
    resultPtr: number,
    workPtr: number,
    terms: number
  ) => void;
  expmv: (
    matrixPtr: number,
    n: number,
    vectorPtr: number,
    resultPtr: number,
    workPtr: number,
    t: number
  ) => void;

  // Matrix square root
  sqrtm: (
    matrixPtr: number,
    n: number,
    resultPtr: number,
    tolerance: number,
    maxIterations: number,
    workPtr: number
  ) => number; // returns 0 on success
  sqrtmNewtonSchulz: (
    matrixPtr: number,
    n: number,
    resultPtr: number,
    workPtr: number,
    maxIterations: number,
    tolerance: number
  ) => number; // returns number of iterations
  sqrtmCholesky: (matrixPtr: number, n: number, resultPtr: number, workPtr: number) => number; // returns 0 on success, -1 if not positive definite

  // Sparse LU decomposition (CSC format)
  sparseLu: (
    valuesPtr: number,
    rowIndPtr: number,
    colPtrPtr: number,
    n: number,
    nnz: number,
    lValuesPtr: number,
    lRowIndPtr: number,
    lColPtrPtr: number,
    uValuesPtr: number,
    uRowIndPtr: number,
    uColPtrPtr: number,
    permPtr: number,
    workPtr: number
  ) => number; // returns 0 on success
  sparseForwardSolve: (
    lValuesPtr: number,
    lRowIndPtr: number,
    lColPtrPtr: number,
    n: number,
    bPtr: number,
    xPtr: number
  ) => void;
  sparseBackwardSolve: (
    uValuesPtr: number,
    uRowIndPtr: number,
    uColPtrPtr: number,
    n: number,
    bPtr: number,
    xPtr: number
  ) => void;
  sparseLuSolve: (
    lValuesPtr: number,
    lRowIndPtr: number,
    lColPtrPtr: number,
    uValuesPtr: number,
    uRowIndPtr: number,
    uColPtrPtr: number,
    n: number,
    permPtr: number,
    bPtr: number,
    xPtr: number,
    workPtr: number
  ) => void;

  // Sparse Cholesky decomposition (CSC format)
  sparseChol: (
    valuesPtr: number,
    rowIndPtr: number,
    colPtrPtr: number,
    n: number,
    nnz: number,
    lValuesPtr: number,
    lRowIndPtr: number,
    lColPtrPtr: number,
    parentPtr: number,
    workPtr: number
  ) => number; // returns 0 on success, -1 if not positive definite
  sparseCholSolve: (
    lValuesPtr: number,
    lRowIndPtr: number,
    lColPtrPtr: number,
    n: number,
    bPtr: number,
    xPtr: number,
    workPtr: number
  ) => void;
  eliminationTree: (rowIndPtr: number, colPtrPtr: number, n: number, parentPtr: number) => void;
  columnCounts: (
    rowIndPtr: number,
    colPtrPtr: number,
    n: number,
    parentPtr: number,
    countsPtr: number,
    workPtr: number
  ) => void;

  // Sparse AMD ordering
  amd: (colPtrPtr: number, rowIdxPtr: number, n: number, permPtr: number, workPtr: number) => void;
  amdAggressive: (
    colPtrPtr: number,
    rowIdxPtr: number,
    n: number,
    permPtr: number,
    workPtr: number
  ) => void;
  // Symbolic Cholesky (combines elimination tree + column counts)
  symbolicCholesky: (
    indexPtr: number,
    ptrPtr: number,
    n: number,
    parentPtr: number,
    postPtr: number,
    colCountPtr: number,
    workPtr: number
  ) => void;

  // SIMD operations
  simdDotF64: (aPtr: number, bPtr: number, length: number) => number;
  simdSumF64: (aPtr: number, length: number) => number;
  simdSumSquaresF64: (aPtr: number, length: number) => number;
  simdNormF64: (aPtr: number, length: number) => number;
  simdMinF64: (aPtr: number, length: number) => number;
  simdMaxF64: (aPtr: number, length: number) => number;
  simdMeanF64: (aPtr: number, length: number) => number;
  simdVarianceF64: (aPtr: number, length: number, ddof: number) => number;
  simdStdF64: (aPtr: number, length: number, ddof: number) => number;
  simdAddF64: (aPtr: number, bPtr: number, resultPtr: number, length: number) => void;
  simdSubF64: (aPtr: number, bPtr: number, resultPtr: number, length: number) => void;
  simdMulF64: (aPtr: number, bPtr: number, resultPtr: number, length: number) => void;
  simdScaleF64: (aPtr: number, scalar: number, resultPtr: number, length: number) => void;
  simdAbsF64: (aPtr: number, resultPtr: number, length: number) => void;
  simdMatMulF64: (
    aPtr: number,
    bPtr: number,
    cPtr: number,
    m: number,
    k: number,
    n: number
  ) => void;

  // Arithmetic operations (array-oriented)
  gcdArray: (aPtr: number, n: number) => number;
  hypotArray: (aPtr: number, n: number) => number;
  norm1: (aPtr: number, n: number) => number;
  norm2: (aPtr: number, n: number) => number;
  normInf: (aPtr: number, n: number) => number;
  normP: (aPtr: number, n: number, p: number) => number;

  // Special functions (array-accelerated)
  erfArray: (aPtr: number, n: number, resultPtr: number) => void;
  zetaArray: (aPtr: number, n: number, resultPtr: number) => void;
  gammaArray: (aPtr: number, n: number, resultPtr: number) => void;
  lgammaArray: (aPtr: number, n: number, resultPtr: number) => void;

  // Selection algorithms
  partitionSelect: (dataPtr: number, n: number, k: number, workPtr: number) => number;

  // Geometry operations
  distanceND: (p1Ptr: number, p2Ptr: number, n: number) => number;
  distance2D: (x1: number, y1: number, x2: number, y2: number) => number;
  distance3D: (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => number;
  intersect2DLines: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number,
    resultPtr: number
  ) => void;
  intersect2DInfiniteLines: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number,
    resultPtr: number
  ) => void;
  distancePointToLine2D: (
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) => number;

  // Statistics operations
  statsMean: (aPtr: number, n: number) => number;
  statsMedian: (aPtr: number, n: number) => number;
  statsVariance: (aPtr: number, n: number, ddof: number) => number;
  statsStd: (aPtr: number, n: number, ddof: number) => number;
  statsSum: (aPtr: number, n: number) => number;
  statsProd: (aPtr: number, n: number) => number;
  statsMin: (aPtr: number, n: number) => number;
  statsMax: (aPtr: number, n: number) => number;
  statsCumsum: (aPtr: number, n: number) => void;
  statsMad: (aPtr: number, n: number) => number;
  statsCorrelation: (aPtr: number, bPtr: number, n: number) => number;
  statsCovariance: (aPtr: number, bPtr: number, n: number, ddof: number) => number;

  // Signal processing
  freqz: (
    bPtr: number,
    bLen: number,
    aPtr: number,
    aLen: number,
    wPtr: number,
    wLen: number,
    hRealPtr: number,
    hImagPtr: number
  ) => void;
  fft: (dataPtr: number, n: number, inverse: number) => void;
  fft2d: (dataPtr: number, rows: number, cols: number, inverse: number) => void;
  convolve: (signalPtr: number, n: number, kernelPtr: number, m: number, resultPtr: number) => void;
  rfft: (dataPtr: number, n: number, resultPtr: number) => void;
  irfft: (dataPtr: number, n: number, resultPtr: number) => void;
  isPowerOf2: (n: number) => number;

  // ODE solver vector operations
  vectorAdd: (aPtr: number, bPtr: number, n: number, resultPtr: number) => void;
  vectorScale: (aPtr: number, scalar: number, n: number, resultPtr: number) => void;
  vectorCopy: (srcPtr: number, n: number, dstPtr: number) => void;
  maxError: (errorPtr: number, n: number) => number;
  computeStepAdjustment: (
    maxErr: number,
    tol: number,
    order: number,
    minDelta: number,
    maxDelta: number
  ) => number;
  rk45Step: (
    yPtr: number,
    t: number,
    h: number,
    n: number,
    kPtr: number,
    yNextPtr: number,
    yErrorPtr: number
  ) => void;
  rk23Step: (
    yPtr: number,
    t: number,
    h: number,
    n: number,
    kPtr: number,
    yNextPtr: number,
    yErrorPtr: number
  ) => void;

  // Bitwise operations (Int32, elementwise). See
  // functions/src/wasm/WasmLoader.ts for full notes — kept in sync here
  // because the matrix package ships its own loader interface for the
  // matrix backends, and downstream code (e.g. the WASMBackend) may use
  // either signature. Rust naming uses *_Array / *_ArrayPerElement; AS
  // naming uses *_i32_array.
  bitAndArray?: (aPtr: number, bPtr: number, resultPtr: number, length: number) => void;
  bitOrArray?: (aPtr: number, bPtr: number, resultPtr: number, length: number) => void;
  bitXorArray?: (aPtr: number, bPtr: number, resultPtr: number, length: number) => void;
  bitNotArray?: (inputPtr: number, resultPtr: number, length: number) => void;
  leftShiftArrayPerElement?: (
    aPtr: number,
    bPtr: number,
    resultPtr: number,
    length: number
  ) => void;
  rightArithShiftArrayPerElement?: (
    aPtr: number,
    bPtr: number,
    resultPtr: number,
    length: number
  ) => void;
  rightLogShiftArrayPerElement?: (
    aPtr: number,
    bPtr: number,
    resultPtr: number,
    length: number
  ) => void;
  bitAnd_i32_array?: (a: Int32Array, b: Int32Array, result: Int32Array) => void;
  bitOr_i32_array?: (a: Int32Array, b: Int32Array, result: Int32Array) => void;
  bitXor_i32_array?: (a: Int32Array, b: Int32Array, result: Int32Array) => void;
  bitNot_i32_array?: (a: Int32Array, result: Int32Array) => void;
  leftShift_i32_array?: (a: Int32Array, b: Int32Array, result: Int32Array) => void;
  rightArithShift_i32_array?: (a: Int32Array, b: Int32Array, result: Int32Array) => void;
  rightLogShift_i32_array?: (a: Int32Array, b: Int32Array, result: Int32Array) => void;

  // Dense matrix decompositions exported by the AssemblyScript binary.
  // The Rust binary exposes the same algorithms under `luDecomposition` /
  // `qrDecomposition` / `choleskyDecomposition` / `laInv` / `laDet` (see
  // entries above) with raw flat-memory pointer arguments. The AS exports
  // use AS-runtime header references that carry their own length, so the
  // signatures here take `number` headers because calling these through
  // `instance.exports` (e.g. from WASMBackend.ts) passes the header
  // pointer, not a JS typed array. The matrix/src/backends/WASMBackend.ts
  // dispatch tier probes for these at runtime and falls through to JS
  // when the loaded binary is not the AS one.
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

  // Memory management — present in AS module, absent in Rust module.
  // The loader gates all uses behind a kind discriminant so neither callers
  // nor this interface need an optionality knob; for the Rust module these
  // exports are simply missing and the loader will never invoke them.
  __new: (size: number, id: number) => number;
  __pin: (ptr: number) => number;
  __unpin: (ptr: number) => void;
  __collect: () => void;
  memory: WebAssembly.Memory;
  // Rust modules expose `__heap_base` as a WebAssembly.Global instead of
  // having a managed allocator. The loader reads this when present.
  __heap_base?: WebAssembly.Global | number;
}

/**
 * AssemblyScript managed-runtime ID constants. Mirrored from
 * `assembly/build/mathts.js`; do not change without verifying against the
 * generated AS metadata.
 */
const AS_ID_ARRAY_BUFFER = 1;
const AS_ID_INT32_ARRAY = 4;
const AS_ID_FLOAT64_ARRAY = 5;
const AS_HEADER_BYTES = 12;

/**
 * Discriminator for the loaded WASM artifact's allocator model.
 *  - 'as': AssemblyScript managed runtime (`__new`/`__pin`/`__unpin`).
 *  - 'rust': flat linear memory; we run a JS-side bump allocator.
 */
export type AllocatorKind = 'as' | 'rust';

/**
 * Opaque allocation handle returned by `allocateFloat64Array` and friends.
 *
 * Callers must treat `ptr` as the pointer to pass to WASM functions — on
 * AS that is the typed-array *header* pointer, on Rust it is a flat
 * linear-memory offset. The `array` view is always positioned over the
 * data region so callers can `set()` and read it as JS expects.
 *
 * `kind` is exposed so advanced consumers (e.g. tests) can introspect,
 * but typical callers don't need to branch on it.
 */
export interface Allocation<TArray extends Float64Array | Int32Array> {
  readonly kind: AllocatorKind;
  /** Pointer to pass to WASM functions. */
  readonly ptr: number;
  /** JS-side view of the data region. */
  array: TArray;
  /** Element length (independent of byte-width). */
  readonly length: number;
  /** Internal: the flat data offset (== ptr for Rust; != ptr for AS). */
  readonly dataPtr: number;
}

/**
 * Memory pool entry for reusable allocations.
 *
 * On AS we pool by length and recycle both the header and the data block.
 * On Rust there is no pool — allocations are bump-allocated and reclaimed
 * en masse via `resetRustAllocator()`.
 */
interface PoolEntry {
  ptr: number; // header pointer for AS, flat ptr for Rust (Rust pool is unused today)
  dataPtr: number;
  size: number; // byte length of the data region
  inUse: boolean;
}

/**
 * Bump allocator for Rust linear memory.
 *
 * The Rust WASM has no allocator exports. We manage a JS-side bump
 * allocator anchored at `__heap_base` so caller buffers sit above the
 * Rust static-data section. Reset reclaims everything in O(1).
 */
class RustBumpAllocator {
  private offset: number;
  private readonly base: number;

  constructor(baseOffset: number) {
    this.base = baseOffset;
    this.offset = baseOffset;
  }

  alloc(byteLength: number, memory: WebAssembly.Memory): number {
    // f64 alignment (8 bytes) is the strictest we need; align everything to 8.
    const aligned = (this.offset + 7) & ~7;
    const end = aligned + byteLength;
    const currentBytes = memory.buffer.byteLength;
    if (end > currentBytes) {
      const pagesNeeded = Math.ceil((end - currentBytes) / 65536);
      memory.grow(pagesNeeded);
    }
    this.offset = end;
    return aligned;
  }

  reset(): void {
    this.offset = this.base;
  }

  get highWaterMark(): number {
    return this.offset;
  }
}

/**
 * Loading metrics for performance monitoring
 */
export interface LoadingMetrics {
  fileReadMs: number;
  compileMs: number;
  instantiateMs: number;
  totalMs: number;
  fromCache: boolean;
}

export class WasmLoader {
  private static instance: WasmLoader | null = null;
  private wasmModule: WasmModule | null = null;
  private compiledModule: WebAssembly.Module | null = null;
  private loading: Promise<WasmModule> | null = null;
  private isNode: boolean;
  private lastMetrics: LoadingMetrics | null = null;

  // Discriminant chosen at load() time. Null before load().
  private allocatorKind: AllocatorKind | null = null;
  // Rust path: a bump allocator anchored at __heap_base.
  private rustAllocator: RustBumpAllocator | null = null;

  // Memory pool for AS allocations (Rust does not use these pools).
  private float64Pool: PoolEntry[] = [];
  private int32Pool: PoolEntry[] = [];
  private readonly poolSizeThreshold = 1024 * 1024; // 1MB max per pool entry

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

    this.loading = this.loadModule(wasmPath);
    this.wasmModule = await this.loading;
    this.detectAllocatorKind(this.wasmModule);
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

    const { loadWasmManifest, verifyWasmIntegrity } = await import('./wasm/integrity.js');

    if (this.isNode) {
      const fs = await import('fs');
      const { promisify } = await import('util');
      const readFile = promisify(fs.readFile);
      const buffer = await readFile(path);
      await verifyWasmIntegrity(buffer, path);
      this.compiledModule = await WebAssembly.compile(buffer);
    } else {
      // Browser: streaming compile only when no manifest is present;
      // otherwise materialize so we can verify the bytes before compile.
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
   * Get the WASM binary path based on the selected backend.
   * Set MATHTS_WASM_BACKEND=assemblyscript to use the AS binary.
   * Default is Rust (after migration cutover).
   *
   * The path is resolved relative to this source file's location so it is
   * CWD-independent.  This file lives at:
   *   <repo-root>/matrix/src/backends/WasmLoader.ts
   * so the repo root is three directories up, and the artifact is at
   *   <repo-root>/lib/wasm/mathts[‑as].wasm
   *
   * Both branches use `new URL(relative, import.meta.url)` to resolve a
   * file: URL. In Node we convert via `fileURLToPath` (which correctly
   * strips the leading slash on Windows so the drive letter is not
   * doubled); in the browser we keep the full `.href` for fetch().
   */
  private async getDefaultWasmPath(): Promise<string> {
    const useAS =
      typeof process !== 'undefined' && process.env?.MATHTS_WASM_BACKEND === 'assemblyscript';

    const wasmFile = useAS ? 'mathts-as.wasm' : 'mathts.wasm';

    if (this.isNode) {
      // Preferred: package-relative artifact (dist/wasm/), robust across
      // monorepo-source and published layouts (see wasm/resolve.ts).
      const { resolvePackagedWasm } = await import('./wasm/resolve.js');
      const found = await resolvePackagedWasm(import.meta.url, wasmFile);
      if (found) return found;
      // Legacy monorepo fallback: <repo-root>/lib/wasm/<file>.
      // `.pathname` on Windows yields "/C:/foo/bar.wasm", which fs.readFile
      // interprets as drive-relative ("C:\C:\foo\..."). fileURLToPath does
      // the platform-correct conversion (and decodes %-escapes).
      const { fileURLToPath } = await import('node:url');
      return fileURLToPath(new URL(`../../../lib/wasm/${wasmFile}`, import.meta.url));
    }
    return new URL(`../../../lib/wasm/${wasmFile}`, import.meta.url).href;
  }

  private async loadNodeWasm(path: string, totalStart: number): Promise<WasmModule> {
    const fs = await import('fs');
    const { promisify } = await import('util');
    const readFile = promisify(fs.readFile);
    const { verifyWasmIntegrity } = await import('./wasm/integrity.js');

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
    const { loadWasmManifest, verifyWasmIntegrity } = await import('./wasm/integrity.js');
    // Look for the manifest before deciding whether to stream. If a manifest
    // exists we must materialize the buffer to compute its hash before
    // compilation - streaming would let an attacker race the bytes past
    // WebAssembly.compile without being checked.
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

    // Either a manifest is present (must verify) or streaming is unavailable.
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
   * Inspect a freshly loaded module and set up the allocator path.
   *
   * Discriminant: the AssemblyScript managed runtime exports `__new`. The
   * Rust artifact does not. We branch on that exactly once at load time and
   * cache the result so the hot path doesn't have to re-detect.
   */
  private detectAllocatorKind(module: WasmModule): void {
    const hasManagedRuntime =
      typeof (module as unknown as { __new?: unknown }).__new === 'function';
    if (hasManagedRuntime) {
      this.allocatorKind = 'as';
      this.rustAllocator = null;
      return;
    }

    this.allocatorKind = 'rust';
    // Anchor the bump allocator at __heap_base when present (the Rust crate
    // has ~1 MB of static-data tables; a fixed 64 KB base would write into
    // them). Fall back to a 64 KB base for modules that omit the global.
    const heapBaseGlobal = (module as unknown as { __heap_base?: WebAssembly.Global | number })
      .__heap_base;
    let heapBase = 65536;
    if (typeof heapBaseGlobal === 'number') {
      heapBase = heapBaseGlobal;
    } else if (heapBaseGlobal && typeof heapBaseGlobal.value === 'number') {
      heapBase = heapBaseGlobal.value;
    }
    this.rustAllocator = new RustBumpAllocator(heapBase);
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
   * Allocator kind (rust/as) chosen at load-time.
   * Returns null before load() has resolved.
   */
  public getAllocatorKind(): AllocatorKind | null {
    return this.allocatorKind;
  }

  /**
   * Reset the Rust bump allocator's high-water mark.
   *
   * This is a coarse batch-free for the Rust path: every previously
   * allocated pointer becomes invalid. Use only when no pointers are still
   * in flight (e.g. between matrix operations that explicitly free their
   * own scratch).
   *
   * No-op on the AS path; AS uses per-allocation pin/unpin via release().
   */
  public resetRustAllocator(): void {
    if (this.allocatorKind === 'rust' && this.rustAllocator) {
      this.rustAllocator.reset();
    }
  }

  /**
   * Get loading performance metrics
   */
  public getLoadingMetrics(): LoadingMetrics | null {
    return this.lastMetrics;
  }

  // ===========================================================================
  // Allocation API
  // ---------------------------------------------------------------------------
  // All allocation methods branch on `allocatorKind`. The returned handle's
  // `ptr` is always the value that should be passed to WASM functions.
  // ===========================================================================

  /**
   * Allocate Float64Array in WASM memory and copy `data` into it.
   * Uses memory pooling on the AS path.
   */
  public allocateFloat64Array(data: number[] | Float64Array): Allocation<Float64Array> {
    const module = this.wasmModule;
    if (!module) throw new Error('WASM module not loaded');
    const length = data.length;

    if (this.allocatorKind === 'rust') {
      const alloc = this.allocateRustFloat64(module, length);
      alloc.array.set(data);
      return alloc;
    }

    const alloc = this.allocateAsFloat64(module, length);
    alloc.array.set(data);
    return alloc;
  }

  /**
   * Allocate Float64Array without copying data (for output buffers)
   */
  public allocateFloat64ArrayEmpty(length: number): Allocation<Float64Array> {
    const module = this.wasmModule;
    if (!module) throw new Error('WASM module not loaded');

    if (this.allocatorKind === 'rust') {
      return this.allocateRustFloat64(module, length);
    }
    return this.allocateAsFloat64(module, length);
  }

  /**
   * Allocate Int32Array in WASM memory and copy `data` into it.
   */
  public allocateInt32Array(data: number[] | Int32Array): Allocation<Int32Array> {
    const module = this.wasmModule;
    if (!module) throw new Error('WASM module not loaded');
    const length = data.length;

    if (this.allocatorKind === 'rust') {
      const alloc = this.allocateRustInt32(module, length);
      alloc.array.set(data);
      return alloc;
    }

    const alloc = this.allocateAsInt32(module, length);
    alloc.array.set(data);
    return alloc;
  }

  /**
   * Allocate Int32Array without copying data (for output buffers)
   */
  public allocateInt32ArrayEmpty(length: number): Allocation<Int32Array> {
    const module = this.wasmModule;
    if (!module) throw new Error('WASM module not loaded');

    if (this.allocatorKind === 'rust') {
      return this.allocateRustInt32(module, length);
    }
    return this.allocateAsInt32(module, length);
  }

  // ---- Rust path (flat memory + bump allocator) --------------------------

  private allocateRustFloat64(module: WasmModule, length: number): Allocation<Float64Array> {
    const allocator = this.rustAllocator;
    if (!allocator) throw new Error('Rust allocator not initialized');
    const byteLength = length * 8;
    const ptr = allocator.alloc(byteLength, module.memory);
    const array = new Float64Array(module.memory.buffer, ptr, length);
    return { kind: 'rust', ptr, dataPtr: ptr, array, length };
  }

  private allocateRustInt32(module: WasmModule, length: number): Allocation<Int32Array> {
    const allocator = this.rustAllocator;
    if (!allocator) throw new Error('Rust allocator not initialized');
    const byteLength = length * 4;
    const ptr = allocator.alloc(byteLength, module.memory);
    const array = new Int32Array(module.memory.buffer, ptr, length);
    return { kind: 'rust', ptr, dataPtr: ptr, array, length };
  }

  // ---- AS path (managed runtime + header pointers) -----------------------

  private allocateAsFloat64(module: WasmModule, length: number): Allocation<Float64Array> {
    const byteLength = length * 8;

    // Try to recycle a pooled allocation of the same data-byte size.
    if (byteLength <= this.poolSizeThreshold) {
      const recycled = this.acquireFromAsPool(this.float64Pool, byteLength);
      if (recycled) {
        const array = new Float64Array(module.memory.buffer, recycled.dataPtr, length);
        return {
          kind: 'as',
          ptr: recycled.ptr,
          dataPtr: recycled.dataPtr,
          array,
          length,
        };
      }
    }
    return this.makeAsFloat64(module, length);
  }

  private allocateAsInt32(module: WasmModule, length: number): Allocation<Int32Array> {
    const byteLength = length * 4;
    if (byteLength <= this.poolSizeThreshold) {
      const recycled = this.acquireFromAsPool(this.int32Pool, byteLength);
      if (recycled) {
        const array = new Int32Array(module.memory.buffer, recycled.dataPtr, length);
        return {
          kind: 'as',
          ptr: recycled.ptr,
          dataPtr: recycled.dataPtr,
          array,
          length,
        };
      }
    }
    return this.makeAsInt32(module, length);
  }

  private makeAsFloat64(module: WasmModule, length: number): Allocation<Float64Array> {
    const byteLength = length * 8;
    const bufferPtr = module.__pin(module.__new(byteLength, AS_ID_ARRAY_BUFFER)) >>> 0;
    const headerPtr = module.__new(AS_HEADER_BYTES, AS_ID_FLOAT64_ARRAY) >>> 0;
    module.__pin(headerPtr);
    // Write header: [dataStart, dataStart, byteLength] (little-endian u32s).
    const dv = new DataView(module.memory.buffer);
    dv.setUint32(headerPtr + 0, bufferPtr, true);
    dv.setUint32(headerPtr + 4, bufferPtr, true);
    dv.setUint32(headerPtr + 8, byteLength, true);
    const array = new Float64Array(module.memory.buffer, bufferPtr, length);
    return { kind: 'as', ptr: headerPtr, dataPtr: bufferPtr, array, length };
  }

  private makeAsInt32(module: WasmModule, length: number): Allocation<Int32Array> {
    const byteLength = length * 4;
    const bufferPtr = module.__pin(module.__new(byteLength, AS_ID_ARRAY_BUFFER)) >>> 0;
    const headerPtr = module.__new(AS_HEADER_BYTES, AS_ID_INT32_ARRAY) >>> 0;
    module.__pin(headerPtr);
    const dv = new DataView(module.memory.buffer);
    dv.setUint32(headerPtr + 0, bufferPtr, true);
    dv.setUint32(headerPtr + 4, bufferPtr, true);
    dv.setUint32(headerPtr + 8, byteLength, true);
    const array = new Int32Array(module.memory.buffer, bufferPtr, length);
    return { kind: 'as', ptr: headerPtr, dataPtr: bufferPtr, array, length };
  }

  /**
   * Find a pool entry whose data region is large enough; returns null when
   * no suitable entry is available.
   */
  private acquireFromAsPool(pool: PoolEntry[], requestedSize: number): PoolEntry | null {
    let bestFit: PoolEntry | null = null;
    let bestFitWaste = Infinity;
    for (const entry of pool) {
      if (!entry.inUse && entry.size >= requestedSize) {
        const waste = entry.size - requestedSize;
        if (waste < bestFitWaste && entry.size <= requestedSize * 2) {
          bestFit = entry;
          bestFitWaste = waste;
        }
      }
    }
    if (bestFit) bestFit.inUse = true;
    return bestFit;
  }

  /**
   * Return an allocation to the pool for reuse.
   *
   * `isFloat64` exists for backwards compatibility — callers can still
   * pass it positionally to disambiguate the pool to use on the AS path.
   * Prefer `releaseAllocation` for new code, which discovers the pool
   * automatically.
   */
  public release(ptr: number, isFloat64: boolean = true): void {
    if (this.allocatorKind === 'rust') {
      // Rust path: individual release is a no-op. Buffers are reclaimed
      // en masse via `resetRustAllocator()` after the operation completes.
      return;
    }
    const pool = isFloat64 ? this.float64Pool : this.int32Pool;
    const entry = pool.find((e) => e.ptr === ptr);
    if (entry) {
      entry.inUse = false;
      return;
    }
    // Not in pool: drop it on the floor (matches prior behaviour — the AS
    // managed runtime in `--runtime stub` does not really free anyway).
    this.free(ptr);
  }

  /**
   * Free allocated memory (immediate, bypasses pool).
   *
   * - Rust path: no-op (use `resetRustAllocator`).
   * - AS path: unpin the header pointer.
   */
  public free(ptr: number): void {
    const module = this.wasmModule;
    if (!module) return;

    if (this.allocatorKind === 'rust') {
      // Nothing to do — bump allocator reclaims via `resetRustAllocator`.
      return;
    }

    // Remove from pools if present.
    this.float64Pool = this.float64Pool.filter((e) => e.ptr !== ptr);
    this.int32Pool = this.int32Pool.filter((e) => e.ptr !== ptr);

    if (typeof module.__unpin === 'function') {
      module.__unpin(ptr);
    }
  }

  /**
   * Clear the memory pool
   */
  public clearPool(): void {
    const module = this.wasmModule;
    if (!module) return;

    if (this.allocatorKind === 'as' && typeof module.__unpin === 'function') {
      for (const entry of this.float64Pool) {
        module.__unpin(entry.ptr);
      }
      for (const entry of this.int32Pool) {
        module.__unpin(entry.ptr);
      }
    }

    this.float64Pool = [];
    this.int32Pool = [];

    if (this.allocatorKind === 'rust' && this.rustAllocator) {
      this.rustAllocator.reset();
    }
  }

  /**
   * Get pool statistics
   */
  public getPoolStats(): {
    float64: { total: number; inUse: number; totalBytes: number };
    int32: { total: number; inUse: number; totalBytes: number };
  } {
    const f64InUse = this.float64Pool.filter((e) => e.inUse).length;
    const f64Bytes = this.float64Pool.reduce((sum, e) => sum + e.size, 0);
    const i32InUse = this.int32Pool.filter((e) => e.inUse).length;
    const i32Bytes = this.int32Pool.reduce((sum, e) => sum + e.size, 0);

    return {
      float64: {
        total: this.float64Pool.length,
        inUse: f64InUse,
        totalBytes: f64Bytes,
      },
      int32: {
        total: this.int32Pool.length,
        inUse: i32InUse,
        totalBytes: i32Bytes,
      },
    };
  }

  /**
   * Run garbage collection (AS path only).
   */
  public collect(): void {
    const module = this.wasmModule;
    if (!module) return;
    if (this.allocatorKind === 'as' && typeof module.__collect === 'function') {
      module.__collect();
    }
    // Rust path: nothing to collect.
  }

  /**
   * Reset the loader (for testing)
   */
  public reset(): void {
    this.clearPool();
    this.wasmModule = null;
    this.compiledModule = null;
    this.loading = null;
    this.lastMetrics = null;
    this.allocatorKind = null;
    this.rustAllocator = null;
  }
}

/**
 * Global WASM loader instance
 */
export const wasmLoader = WasmLoader.getInstance();

/**
 * Initialize WASM module (call once at startup)
 */
export async function initWasm(wasmPath?: string): Promise<WasmModule> {
  return wasmLoader.load(wasmPath);
}
