/**
 * Parallel Acceleration Benchmark Cases
 *
 * Defines the `BenchCase` set for every worker-pool-accelerated operation
 * called out in the acceleration roadmap, grouped by category:
 *
 *  - element-wise:  add, multiply, sin, exp, sign
 *  - special/dist:  normalCDF, erfc, besselJ   (dispatch via applyKernel)
 *  - reductions:    sum, mean, variance, parallelStatProd
 *  - linear algebra: matmul, matrixPower, characteristicPolynomial
 *  - signal:        parallelFFT, spectrogram, fft2d, parallelConv
 *  - geometry:      distanceMatrix
 *
 * Each case allocates fresh inputs per run so the JIT cannot hoist the work.
 * The harness times the same `run` callback under both the sequential and
 * parallel `ComputePool` configurations.
 *
 * All operations are imported from the *built* `dist/` of
 * `@danielsimonjr/mathts-functions`; build it first:
 *
 *   npx turbo build --filter=@danielsimonjr/mathts-functions
 */

import {
  add,
  multiply,
  sin,
  exp,
  sign,
  matmul,
  normalCDF,
  erfc,
  besselJ,
  sum,
  mean,
  variance,
  parallelStatProd,
  parallelFFT,
  parallelConv,
  spectrogram,
  fft2d,
  distanceMatrix,
  characteristicPolynomial,
  matrixPower,
} from '@danielsimonjr/mathts-functions';

import type { BenchCase } from './harness.js';
import { squareLabel } from './harness.js';

// ---------------------------------------------------------------------------
// Input generators
// ---------------------------------------------------------------------------

/** Float64Array filled with pseudo-random values in [0, 1). */
function randFloat64(size: number): Float64Array {
  const out = new Float64Array(size);
  for (let i = 0; i < size; i++) out[i] = Math.random();
  return out;
}

/** Float64Array filled with positive values in (0, 2) — safe for log/bessel. */
function randPositive(size: number): Float64Array {
  const out = new Float64Array(size);
  for (let i = 0; i < size; i++) out[i] = Math.random() * 2 + 1e-6;
  return out;
}

/** Square nested-array matrix of pseudo-random values. */
function randMatrix(dim: number): number[][] {
  const out: number[][] = new Array(dim);
  for (let i = 0; i < dim; i++) {
    const row = new Array(dim);
    for (let j = 0; j < dim; j++) row[j] = Math.random() * 2 - 1;
    out[i] = row;
  }
  return out;
}

/** `n` random points in `dim` dimensions, as a nested array. */
function randPoints(n: number, dim = 3): number[][] {
  const out: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = new Array(dim);
    for (let d = 0; d < dim; d++) p[d] = Math.random();
    out[i] = p;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Element-wise operations — size = element count
// ---------------------------------------------------------------------------

const ELEMENTWISE_SIZES = [1e3, 1e4, 1e5, 1e6].map((n) => Math.round(n));

const addBench: BenchCase = {
  operation: 'add',
  category: 'element-wise',
  sizeUnit: 'elements',
  sizes: ELEMENTWISE_SIZES,
  run: async (size) => {
    const a = randFloat64(size);
    const b = randFloat64(size);
    return add(a, b);
  },
};

const multiplyBench: BenchCase = {
  operation: 'multiply',
  category: 'element-wise',
  sizeUnit: 'elements',
  sizes: ELEMENTWISE_SIZES,
  run: async (size) => {
    const a = randFloat64(size);
    const b = randFloat64(size);
    return multiply(a, b);
  },
};

const sinBench: BenchCase = {
  operation: 'sin',
  category: 'element-wise',
  sizeUnit: 'elements',
  sizes: ELEMENTWISE_SIZES,
  run: async (size) => sin(randFloat64(size)),
};

const expBench: BenchCase = {
  operation: 'exp',
  category: 'element-wise',
  sizeUnit: 'elements',
  sizes: ELEMENTWISE_SIZES,
  run: async (size) => exp(randFloat64(size)),
};

const signBench: BenchCase = {
  operation: 'sign',
  category: 'element-wise',
  sizeUnit: 'elements',
  sizes: ELEMENTWISE_SIZES,
  run: async (size) => sign(randFloat64(size)),
};

// ---------------------------------------------------------------------------
// Special / distribution functions — dispatch via computePool.applyKernel
// ---------------------------------------------------------------------------

const normalCDFBench: BenchCase = {
  operation: 'normalCDF',
  category: 'distribution',
  sizeUnit: 'elements',
  sizes: ELEMENTWISE_SIZES,
  run: async (size) => normalCDF(randFloat64(size)),
};

const erfcBench: BenchCase = {
  operation: 'erfc',
  category: 'special',
  sizeUnit: 'elements',
  sizes: ELEMENTWISE_SIZES,
  run: async (size) => erfc(randFloat64(size)),
};

const besselJBench: BenchCase = {
  operation: 'besselJ',
  category: 'special',
  sizeUnit: 'elements',
  sizes: ELEMENTWISE_SIZES,
  run: async (size) => besselJ(0, randPositive(size)),
};

// ---------------------------------------------------------------------------
// Reductions — size = element count
// ---------------------------------------------------------------------------

const sumBench: BenchCase = {
  operation: 'sum',
  category: 'reduction',
  sizeUnit: 'elements',
  sizes: ELEMENTWISE_SIZES,
  run: async (size) => sum(randFloat64(size)),
};

const meanBench: BenchCase = {
  operation: 'mean',
  category: 'reduction',
  sizeUnit: 'elements',
  sizes: ELEMENTWISE_SIZES,
  run: async (size) => mean(randFloat64(size)),
};

const varianceBench: BenchCase = {
  operation: 'variance',
  category: 'reduction',
  sizeUnit: 'elements',
  sizes: ELEMENTWISE_SIZES,
  run: async (size) => variance(randFloat64(size)),
};

const parallelStatProdBench: BenchCase = {
  operation: 'parallelStatProd',
  category: 'reduction',
  sizeUnit: 'elements',
  sizes: ELEMENTWISE_SIZES,
  // Values near 1 keep the running product finite over 1e6 elements.
  run: async (size) => {
    const a = new Float64Array(size);
    for (let i = 0; i < size; i++) a[i] = 1 + (Math.random() - 0.5) * 1e-5;
    return parallelStatProd(a);
  },
};

// ---------------------------------------------------------------------------
// Linear algebra — size = square matrix dimension
// ---------------------------------------------------------------------------

const MATMUL_DIMS = [32, 64, 128, 256, 512];

const matmulBench: BenchCase = {
  operation: 'matmul',
  category: 'linear-algebra',
  sizeUnit: 'matrix dim',
  sizes: MATMUL_DIMS,
  label: squareLabel,
  iterations: (dim) => (dim >= 256 ? 5 : dim >= 128 ? 10 : 20),
  run: async (dim) => {
    const a = randFloat64(dim * dim);
    const b = randFloat64(dim * dim);
    return matmul(a, dim, dim, b, dim);
  },
};

// matrixPower / characteristicPolynomial are O(n^3..n^4) and call matMul
// internally; keep dimensions modest.
const DECOMP_DIMS = [16, 32, 64, 96, 128];

const matrixPowerBench: BenchCase = {
  operation: 'matrixPower',
  category: 'linear-algebra',
  sizeUnit: 'matrix dim',
  sizes: DECOMP_DIMS,
  label: squareLabel,
  iterations: (dim) => (dim >= 96 ? 5 : 12),
  run: async (dim) => matrixPower(randMatrix(dim), 6),
};

const charPolyBench: BenchCase = {
  operation: 'characteristicPolynomial',
  category: 'linear-algebra',
  sizeUnit: 'matrix dim',
  sizes: DECOMP_DIMS,
  label: squareLabel,
  iterations: (dim) => (dim >= 96 ? 4 : 10),
  run: async (dim) => characteristicPolynomial(randMatrix(dim)),
};

// ---------------------------------------------------------------------------
// Signal processing
// ---------------------------------------------------------------------------

// parallelFFT pads to the next power of two; use power-of-two sizes so the
// reported size equals the transform length.
const FFT_SIZES = [1024, 4096, 16384, 65536, 262144];

const parallelFFTBench: BenchCase = {
  operation: 'parallelFFT',
  category: 'signal',
  sizeUnit: 'samples',
  sizes: FFT_SIZES,
  iterations: (n) => (n >= 65536 ? 5 : n >= 16384 ? 9 : 15),
  run: async (n) => parallelFFT(randFloat64(n)),
};

// parallelConv: convolve two equal-length signals. The internal FFT size is
// nextPow2(2n-1); we report the input length n.
const CONV_SIZES = [512, 2048, 8192, 32768, 131072];

const parallelConvBench: BenchCase = {
  operation: 'parallelConv',
  category: 'signal',
  sizeUnit: 'samples',
  sizes: CONV_SIZES,
  iterations: (n) => (n >= 32768 ? 5 : n >= 8192 ? 9 : 15),
  run: async (n) => parallelConv(randFloat64(n), randFloat64(n)),
};

// spectrogram: many independent windowed FFTs. Size = signal length.
const SPECTROGRAM_SIZES = [4096, 16384, 65536, 262144];

const spectrogramBench: BenchCase = {
  operation: 'spectrogram',
  category: 'signal',
  sizeUnit: 'samples',
  sizes: SPECTROGRAM_SIZES,
  iterations: (n) => (n >= 65536 ? 4 : 8),
  run: async (n) => spectrogram(Array.from(randFloat64(n)), { windowSize: 256, hopSize: 128 }),
};

// fft2d: square image. Size axis = side length; element count = side^2.
const FFT2D_SIDES = [32, 64, 128, 256];

const fft2dBench: BenchCase = {
  operation: 'fft2d',
  category: 'signal',
  sizeUnit: 'image side',
  sizes: FFT2D_SIDES,
  label: squareLabel,
  iterations: (s) => (s >= 256 ? 4 : 8),
  run: async (side) => {
    const img: number[][] = new Array(side);
    for (let r = 0; r < side; r++) img[r] = Array.from(randFloat64(side));
    return fft2d(img);
  },
};

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

// distanceMatrix is O(n^2) in points; the internal element count is n*n.
const POINT_COUNTS = [64, 128, 256, 512, 1024];

const distanceMatrixBench: BenchCase = {
  operation: 'distanceMatrix',
  category: 'geometry',
  sizeUnit: 'points',
  sizes: POINT_COUNTS,
  iterations: (n) => (n >= 512 ? 6 : 14),
  run: async (n) => distanceMatrix(randPoints(n, 3)),
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** All benchmark cases, in report order. */
export const ALL_BENCHES: BenchCase[] = [
  // element-wise
  addBench,
  multiplyBench,
  sinBench,
  expBench,
  signBench,
  // special / distribution
  normalCDFBench,
  erfcBench,
  besselJBench,
  // reductions
  sumBench,
  meanBench,
  varianceBench,
  parallelStatProdBench,
  // linear algebra
  matmulBench,
  matrixPowerBench,
  charPolyBench,
  // signal
  parallelFFTBench,
  parallelConvBench,
  spectrogramBench,
  fft2dBench,
  // geometry
  distanceMatrixBench,
];
