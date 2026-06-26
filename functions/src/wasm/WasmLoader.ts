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
 * Security:
 * - Optional SHA-384 integrity verification against a sibling
 *   `wasm-manifest.json`. See `./integrity.ts`. When the manifest is
 *   present any tampered .wasm payload is rejected before instantiation.
 */

import { verifyWasmIntegrity, loadWasmManifest } from './integrity.js';
import { resolvePackagedWasm } from './resolve.js';

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
  // Pointer-style lgamma array kernel (Slice 5.8)
  lgamma_f64: (xsPtr: number, n: number, outPtr: number) => number;

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

  // Signal processing — extended (processing_ext.rs)
  dct_wasm: (inPtr: number, outPtr: number, n: number) => void;
  idct_wasm: (inPtr: number, outPtr: number, n: number) => void;
  dst_wasm: (inPtr: number, outPtr: number, n: number) => void;
  idst_wasm: (inPtr: number, outPtr: number, n: number) => void;
  dwt_wasm: (inPtr: number, approxPtr: number, detailPtr: number, n: number) => void;
  hilbert_wasm: (inRe: number, inIm: number, outRe: number, outIm: number, n: number) => void;
  spectrogram_wasm: (
    inPtr: number,
    outPtr: number,
    n: number,
    windowSize: number,
    hop: number
  ) => number;
  periodogram_wasm: (inPtr: number, outPtr: number, n: number) => void;
  fir_filter_wasm: (
    inPtr: number,
    coeffsPtr: number,
    outPtr: number,
    n: number,
    numCoeffs: number
  ) => void;

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

  // Optimization
  minimize_quadratic_wasm: (hPtr: number, fPtr: number, n: number, xPtr: number) => number;
  least_squares_wasm: (aPtr: number, bPtr: number, m: number, n: number, xPtr: number) => number;
  levenberg_marquardt_wasm: (
    jPtr: number,
    rPtr: number,
    m: number,
    n: number,
    dpPtr: number,
    lambda: number
  ) => void;

  // Matrix analysis (SVD-based)
  condition_number_wasm: (aPtr: number, n: number) => number;
  matrix_rank_wasm: (aPtr: number, m: number, n: number, tol: number) => number;

  // Advanced interpolation
  bezier_eval_wasm: (
    ctrlPtr: number,
    nPoints: number,
    dims: number,
    t: number,
    resultPtr: number
  ) => void;
  bspline_eval_wasm: (
    ctrlPtr: number,
    nPoints: number,
    degree: number,
    t: number,
    resultPtr: number
  ) => void;
  loess_wasm: (xsPtr: number, ysPtr: number, n: number, x: number, bandwidth: number) => number;
  rbf_interp_wasm: (
    pointsPtr: number,
    valuesPtr: number,
    n: number,
    dims: number,
    xiPtr: number,
    ni: number,
    resultPtr: number
  ) => void;
  griddata_wasm: (
    pointsPtr: number,
    valuesPtr: number,
    n: number,
    xiPtr: number,
    yiPtr: number,
    ni: number,
    resultPtr: number
  ) => void;

  // Advanced ODE
  implicit_euler_step_wasm: (
    yPtr: number,
    fPtr: number,
    jPtr: number,
    h: number,
    n: number,
    resultPtr: number
  ) => void;
  ode_system_rk4_step_wasm: (
    yPtr: number,
    kPtrs: number,
    h: number,
    n: number,
    resultPtr: number
  ) => void;

  // Computational geometry
  delaunay_wasm: (ptsPtr: number, n: number, trisPtr: number) => number;
  voronoi_wasm: (
    ptsPtr: number,
    n: number,
    boundsPtr: number,
    vertsPtr: number,
    edgesPtr: number,
    maxVerts: number,
    maxEdges: number
  ) => number;
  kdtree_build_wasm: (ptsPtr: number, n: number, dims: number, treePtr: number) => number;
  kdtree_nearest_wasm: (
    treePtr: number,
    queryPtr: number,
    dims: number,
    treeSize: number
  ) => number;
  // Convex hull 3D (QuickHull incremental — Barber, Dobkin, Huhdanpaa 1996).
  // pts_ptr: interleaved [x0,y0,z0, x1,y1,z1, ...], stride=3, n_pts points.
  // faces_ptr: output buffer for triangle indices (u32); each triple is CCW
  //            when viewed from outside the hull.
  // max_faces: capacity of faces_ptr in triangles.
  // Returns number of triangles written, or -1 on overflow.
  convex_hull_3d_wasm: (
    ptsPtr: number,
    nPts: number,
    facesPtr: number,
    maxFaces: number
  ) => number;

  // Bitwise operations (Int32, elementwise — provided by both Rust and AS
  // backends; binary kernels accept two Int32 pointers + output + length,
  // the per-element shift kernels take (a_ptr, b_ptr, result_ptr, length).
  // Rust uses the *_Array / *_ArrayPerElement naming; AS uses *_i32_array.
  // The dispatch tier in functions/src/typed/bitwise.ts probes for one or
  // the other at runtime.
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
  // AS-backend elementwise bitwise kernels — same semantics, different
  // naming convention so we can keep both backends working from the same
  // interface. The dispatch tier prefers Rust names and falls through to
  // AS names when the binary is the AS one.
  bitAnd_i32_array?: (a: Int32Array, b: Int32Array, result: Int32Array) => void;
  bitOr_i32_array?: (a: Int32Array, b: Int32Array, result: Int32Array) => void;
  bitXor_i32_array?: (a: Int32Array, b: Int32Array, result: Int32Array) => void;
  bitNot_i32_array?: (a: Int32Array, result: Int32Array) => void;
  leftShift_i32_array?: (a: Int32Array, b: Int32Array, result: Int32Array) => void;
  rightArithShift_i32_array?: (a: Int32Array, b: Int32Array, result: Int32Array) => void;
  rightLogShift_i32_array?: (a: Int32Array, b: Int32Array, result: Int32Array) => void;

  // Polynomial hot-loop kernels (Slice 3.7).
  // Rust backend: pointer-style (a_ptr, a_len, b_ptr, b_len, out_ptr) → out_len.
  // AS  backend: typed-array-style (a: Float64Array, b: Float64Array) → Float64Array.
  poly_mul_f64?: (aPtr: number, aLen: number, bPtr: number, bLen: number, outPtr: number) => number;
  poly_div_mod_f64?: (
    numPtr: number,
    numLen: number,
    denPtr: number,
    denLen: number,
    outPtr: number
  ) => number;
  // AS-backend variants (typed-array calling convention).
  poly_mul_f64_as?: (a: Float64Array, b: Float64Array) => Float64Array;
  poly_div_mod_f64_as?: (num: Float64Array, den: Float64Array) => Float64Array;

  // Polynomial scalar kernels (Slice 4.5).
  // Rust backend: pointer-style, returns a scalar f64.
  // AS  backend: typed-array calling convention, returns f64.
  poly_resultant_f64?: (pPtr: number, pLen: number, qPtr: number, qLen: number) => number;
  poly_discriminant_f64?: (pPtr: number, pLen: number) => number;
  // AS-backend variants (typed-array calling convention).
  poly_resultant_f64_as?: (p: Float64Array, q: Float64Array) => number;
  poly_discriminant_f64_as?: (p: Float64Array) => number;

  // Polynomial-fit kernels (Slice 5.4).
  // Rust backend: pointer-style.
  //   poly_fit_f64(xs_ptr, ys_ptr, n, degree, out_ptr) → degree+1 (or -1 on error)
  //   cheb_fit_f64(xs_ptr, ys_ptr, n, degree, out_ptr) → degree+1 (or -1 on error)
  //   legendre_fit_f64(xs_ptr, ys_ptr, n, degree, out_ptr) → degree+1 (or -1 on error)
  // AS backend: typed-array calling convention.
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
  poly_fit_f64_as?: (xs: Float64Array, ys: Float64Array, degree: number) => Float64Array;
  cheb_fit_f64_as?: (xs: Float64Array, ys: Float64Array, degree: number) => Float64Array;
  legendre_fit_f64_as?: (xs: Float64Array, ys: Float64Array, degree: number) => Float64Array;

  // Tridiagonal-solve kernel (Slice 3.10b).
  // Rust backend: pointer-style
  //   (diag_ptr, lower_ptr, upper_ptr, rhs_ptr, n, out_ptr) → n (or -1 on singular).
  // AS  backend: typed-array-style (diag, lower, upper, rhs) → Float64Array.
  tridiag_solve_f64?: (
    diagPtr: number,
    lowerPtr: number,
    upperPtr: number,
    rhsPtr: number,
    n: number,
    outPtr: number
  ) => number;
  // AS-backend variant (typed-array calling convention).
  tridiag_solve_f64_as?: (
    diag: Float64Array,
    lower: Float64Array,
    upper: Float64Array,
    rhs: Float64Array
  ) => Float64Array;

  // Divided-difference kernel (Slice 5.5).
  // Rust backend: pointer-style
  //   divided_difference_f64(xs_ptr, ys_ptr, n, out_ptr) → n (or -1 on duplicate xs).
  // AS  backend: typed-array calling convention.
  //   divided_difference_f64_as(xs, ys) → Float64Array (length 0 on duplicate xs).
  divided_difference_f64?: (xsPtr: number, ysPtr: number, n: number, outPtr: number) => number;
  divided_difference_f64_as?: (xs: Float64Array, ys: Float64Array) => Float64Array;

  // Bessel J/Y array kernels (Slice 3.10c-1) + Airy Ai/Bi (Slice 4.9).
  // Rust backend: pointer-style.
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
  // Rust backend: pointer-style.
  //   elliptic_k_f64(ms_ptr, n, out_ptr) → n (or -1 on error)
  //   elliptic_e_f64(ms_ptr, n, out_ptr) → n (or -1 on error)
  // AS backend: typed-array calling convention.
  //   elliptic_k_f64_as(ms: Float64Array) → Float64Array
  //   elliptic_e_f64_as(ms: Float64Array) → Float64Array
  elliptic_k_f64?: (msPtr: number, n: number, outPtr: number) => number;
  elliptic_e_f64?: (msPtr: number, n: number, outPtr: number) => number;
  elliptic_k_f64_as?: (ms: Float64Array) => Float64Array;
  elliptic_e_f64_as?: (ms: Float64Array) => Float64Array;
  // Carlson symmetric forms + incomplete elliptic integrals (Slice 6.4).
  // Rust backend: pointer-style ABI (all input arrays + count + output pointer).
  //   carlson_rc_f64(xs_ptr, ys_ptr, n, out_ptr)                     → n | -1
  //   carlson_rf_f64(xs_ptr, ys_ptr, zs_ptr, n, out_ptr)             → n | -1
  //   carlson_rd_f64(xs_ptr, ys_ptr, zs_ptr, n, out_ptr)             → n | -1
  //   carlson_rj_f64(xs_ptr, ys_ptr, zs_ptr, ps_ptr, n, out_ptr)     → n | -1
  //   elliptic_f_incomplete_f64(phis_ptr, ms_ptr, n, out_ptr)         → n | -1
  //   elliptic_e_incomplete_f64(phis_ptr, ms_ptr, n, out_ptr)         → n | -1
  //   elliptic_pi_incomplete_f64(ns_ptr, phis_ptr, ms_ptr, n, out)   → n | -1
  // AS backend: typed-array calling convention (_as suffix).
  carlson_rc_f64?: (xsPtr: number, ysPtr: number, n: number, outPtr: number) => number;
  carlson_rf_f64?: (xsPtr: number, ysPtr: number, zsPtr: number, n: number, outPtr: number) => number;
  carlson_rd_f64?: (xsPtr: number, ysPtr: number, zsPtr: number, n: number, outPtr: number) => number;
  carlson_rj_f64?: (xsPtr: number, ysPtr: number, zsPtr: number, psPtr: number, n: number, outPtr: number) => number;
  elliptic_f_incomplete_f64?: (phisPtr: number, msPtr: number, n: number, outPtr: number) => number;
  elliptic_e_incomplete_f64?: (phisPtr: number, msPtr: number, n: number, outPtr: number) => number;
  elliptic_pi_incomplete_f64?: (nsPtr: number, phisPtr: number, msPtr: number, n: number, outPtr: number) => number;
  carlson_rc_f64_as?: (xs: Float64Array, ys: Float64Array) => Float64Array;
  carlson_rf_f64_as?: (xs: Float64Array, ys: Float64Array, zs: Float64Array) => Float64Array;
  carlson_rd_f64_as?: (xs: Float64Array, ys: Float64Array, zs: Float64Array) => Float64Array;
  carlson_rj_f64_as?: (xs: Float64Array, ys: Float64Array, zs: Float64Array, ps: Float64Array) => Float64Array;
  elliptic_f_incomplete_f64_as?: (phis: Float64Array, ms: Float64Array) => Float64Array;
  elliptic_e_incomplete_f64_as?: (phis: Float64Array, ms: Float64Array) => Float64Array;
  elliptic_pi_incomplete_f64_as?: (ns: Float64Array, phis: Float64Array, ms: Float64Array) => Float64Array;
  // AS-backend variants (typed-array calling convention, Slice 4.9).
  bessel_j0_f64_as?: (xs: Float64Array) => Float64Array;
  bessel_j1_f64_as?: (xs: Float64Array) => Float64Array;
  bessel_jn_f64_as?: (n: number, xs: Float64Array) => Float64Array;
  bessel_y0_f64_as?: (xs: Float64Array) => Float64Array;
  bessel_y1_f64_as?: (xs: Float64Array) => Float64Array;
  bessel_yn_f64_as?: (n: number, xs: Float64Array) => Float64Array;
  airy_ai_f64_as?: (xs: Float64Array) => Float64Array;
  airy_bi_f64_as?: (xs: Float64Array) => Float64Array;

  // Spectral signal kernels (Slice 5.6).
  // Rust backend: pointer-style ABI.
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
  apply_window_f64_as?: (samples: Float64Array, windowType: number) => number;
  welch_psd_f64_as?: (
    samples: Float64Array,
    frameLength: number,
    overlap: number,
    windowType: number
  ) => Float64Array;
  bartlett_psd_f64_as?: (samples: Float64Array, frameLength: number) => Float64Array;
  goertzel_f64_as?: (samples: Float64Array, targetFreq: number, sampleRate: number) => number;
  chirp_z_transform_f64_as?: (
    samples: Float64Array,
    m: number,
    phiStartRe: number,
    phiStartIm: number,
    phiStepRe: number,
    phiStepIm: number
  ) => Float64Array;

  // Sort kernels (Slice 5.7a).
  // Rust backend: pointer-style ABI.
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
  // The Rust binary exposes the same algorithms under `luDecomposition` /
  // `qrDecomposition` / `choleskyDecomposition` / `laInv` / `laDet` (see
  // entries above) with raw flat-memory pointer arguments. The AS exports
  // use AS-runtime header references that carry their own length, so the
  // signatures here take `number` headers because calling these through
  // `instance.exports` passes the header pointer, not a JS typed array.
  // The matrix backend (matrix/src/backends/WASMBackend.ts) probes for
  // these at runtime and falls through to JS when the loaded binary is
  // not the AS one.
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

/**
 * Memory pool entry for reusable allocations
 */
interface PoolEntry {
  ptr: number;
  size: number;
  inUse: boolean;
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

  // Memory pool for reusable allocations
  private float64Pool: PoolEntry[] = [];
  private int32Pool: PoolEntry[] = [];
  private readonly maxPoolSize = 32;
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
      return instance.exports as any as WasmModule;
    }

    if (this.isNode) {
      return this.loadNodeWasm(path, totalStart);
    } else {
      return this.loadBrowserWasm(path, totalStart);
    }
  }

  /**
   * Get the WASM binary path based on the selected backend.
   *
   * Default is the **AssemblyScript** binary (`mathts-as.wasm`) as of the
   * Rust→AS migration Phase 3a cutover. Set MATHTS_WASM_BACKEND=rust (legacy:
   * MATHJS_WASM_BACKEND=rust) to load the legacy Rust binary (`mathts.wasm`)
   * instead — kept available until the Rust toolchain is removed in Phase 5.
   * The historical `=assemblyscript` value is still honoured (now a no-op, since
   * AS is the default).
   *
   * Filenames were renamed from mathjs.wasm / mathjs-as.wasm during the
   * mathjs-to-MathTS rebrand; the legacy MATHJS_WASM_BACKEND env var
   * still works for backward compatibility.
   *
   * Returns an async result because the Node branch dynamically imports
   * `node:url` (fileURLToPath) so the path is resolved relative to this
   * source file's location rather than process.cwd().
   */
  private async getDefaultWasmPath(): Promise<string> {
    const useRust =
      typeof process !== 'undefined' &&
      (process.env?.MATHTS_WASM_BACKEND === 'rust' ||
        process.env?.MATHJS_WASM_BACKEND === 'rust');

    const wasmFile = useRust ? 'mathts.wasm' : 'mathts-as.wasm';

    if (this.isNode) {
      // Prefer the wasm co-located in the package (dist/wasm/), which works in
      // both the monorepo and the published layout. Fall back to the legacy
      // monorepo-relative path if the packaged copy isn't present.
      const packaged = await resolvePackagedWasm(import.meta.url, wasmFile);
      if (packaged) return packaged;
      const { fileURLToPath } = await import('node:url');
      return fileURLToPath(new URL(`../../../lib/wasm/${wasmFile}`, import.meta.url));
    }
    return new URL(`../../../lib/wasm/${wasmFile}`, import.meta.url).href;
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

    return instance.exports as any as WasmModule;
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
      return result.instance.exports as any as WasmModule;
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

    return instance.exports as any as WasmModule;
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
      Math: Math as any,
      Date: Date as any,
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
   * Allocate Float64Array in WASM memory
   * Uses memory pooling for frequently reused sizes
   */
  public allocateFloat64Array(data: number[] | Float64Array): {
    ptr: number;
    array: Float64Array;
  } {
    const module = this.wasmModule;
    if (!module) throw new Error('WASM module not loaded');

    const length = data.length;
    const byteLength = length * 8; // 8 bytes per f64

    // Try to get from pool if size is reasonable
    let ptr: number;
    if (byteLength <= this.poolSizeThreshold) {
      const poolEntry = this.getFromPool(this.float64Pool, byteLength);
      if (poolEntry) {
        ptr = poolEntry.ptr;
        poolEntry.inUse = true;
      } else {
        ptr = module.__new(byteLength, 2);
      }
    } else {
      ptr = module.__new(byteLength, 2);
    }

    const array = new Float64Array(module.memory.buffer, ptr, length);
    array.set(data);

    return { ptr, array };
  }

  /**
   * Allocate Float64Array without copying data (for output buffers)
   */
  public allocateFloat64ArrayEmpty(length: number): {
    ptr: number;
    array: Float64Array;
  } {
    const module = this.wasmModule;
    if (!module) throw new Error('WASM module not loaded');

    const byteLength = length * 8;

    let ptr: number;
    if (byteLength <= this.poolSizeThreshold) {
      const poolEntry = this.getFromPool(this.float64Pool, byteLength);
      if (poolEntry) {
        ptr = poolEntry.ptr;
        poolEntry.inUse = true;
      } else {
        ptr = module.__new(byteLength, 2);
      }
    } else {
      ptr = module.__new(byteLength, 2);
    }

    const array = new Float64Array(module.memory.buffer, ptr, length);
    return { ptr, array };
  }

  /**
   * Allocate Int32Array in WASM memory
   * Uses memory pooling for frequently reused sizes
   */
  public allocateInt32Array(data: number[] | Int32Array): {
    ptr: number;
    array: Int32Array;
  } {
    const module = this.wasmModule;
    if (!module) throw new Error('WASM module not loaded');

    const length = data.length;
    const byteLength = length * 4; // 4 bytes per i32

    let ptr: number;
    if (byteLength <= this.poolSizeThreshold) {
      const poolEntry = this.getFromPool(this.int32Pool, byteLength);
      if (poolEntry) {
        ptr = poolEntry.ptr;
        poolEntry.inUse = true;
      } else {
        ptr = module.__new(byteLength, 1);
      }
    } else {
      ptr = module.__new(byteLength, 1);
    }

    const array = new Int32Array(module.memory.buffer, ptr, length);
    array.set(data);

    return { ptr, array };
  }

  /**
   * Allocate Int32Array without copying data (for output buffers)
   */
  public allocateInt32ArrayEmpty(length: number): {
    ptr: number;
    array: Int32Array;
  } {
    const module = this.wasmModule;
    if (!module) throw new Error('WASM module not loaded');

    const byteLength = length * 4;

    let ptr: number;
    if (byteLength <= this.poolSizeThreshold) {
      const poolEntry = this.getFromPool(this.int32Pool, byteLength);
      if (poolEntry) {
        ptr = poolEntry.ptr;
        poolEntry.inUse = true;
      } else {
        ptr = module.__new(byteLength, 1);
      }
    } else {
      ptr = module.__new(byteLength, 1);
    }

    const array = new Int32Array(module.memory.buffer, ptr, length);
    return { ptr, array };
  }

  /**
   * Get a suitable entry from the memory pool
   */
  private getFromPool(pool: PoolEntry[], requestedSize: number): PoolEntry | null {
    // Find best fit: smallest available entry that's >= requested size
    let bestFit: PoolEntry | null = null;
    let bestFitWaste = Infinity;

    for (const entry of pool) {
      if (!entry.inUse && entry.size >= requestedSize) {
        const waste = entry.size - requestedSize;
        // Accept if exact match or within 2x size (avoid excessive waste)
        if (waste < bestFitWaste && entry.size <= requestedSize * 2) {
          bestFit = entry;
          bestFitWaste = waste;
        }
      }
    }

    return bestFit;
  }

  /**
   * Return allocation to pool for reuse
   */
  public release(ptr: number, isFloat64: boolean = true): void {
    const pool = isFloat64 ? this.float64Pool : this.int32Pool;

    // Find entry in pool
    const entry = pool.find((e) => e.ptr === ptr);
    if (entry) {
      entry.inUse = false;
      return;
    }

    // If not in pool, we could add it (but respect max pool size)
    // For now, just unpin it
    this.free(ptr);
  }

  /**
   * Free allocated memory (immediate, bypasses pool)
   */
  public free(ptr: number): void {
    const module = this.wasmModule;
    if (!module) return;

    // Remove from pools if present
    this.float64Pool = this.float64Pool.filter((e) => e.ptr !== ptr);
    this.int32Pool = this.int32Pool.filter((e) => e.ptr !== ptr);

    module.__unpin(ptr);
  }

  /**
   * Clear the memory pool
   */
  public clearPool(): void {
    const module = this.wasmModule;
    if (!module) return;

    for (const entry of this.float64Pool) {
      module.__unpin(entry.ptr);
    }
    for (const entry of this.int32Pool) {
      module.__unpin(entry.ptr);
    }

    this.float64Pool = [];
    this.int32Pool = [];
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
    this.clearPool();
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

/**
 * Initialize WASM module (call once at startup)
 */
export async function initWasm(wasmPath?: string): Promise<WasmModule> {
  return wasmLoader.load(wasmPath);
}
