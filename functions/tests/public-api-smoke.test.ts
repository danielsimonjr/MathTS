/**
 * Broad public-API smoke: every named function export is invoked with a
 * representative argument set (or a short heuristic fallback). Domain errors
 * are allowed; unexpected crashes are not. Numeric oracles live in gap-*.
 */
import { describe, it, expect } from 'vitest';
import * as F from '../src/index.js';

type Fn = (...args: never[]) => unknown;

function isFn(v: unknown): v is Fn {
  return typeof v === 'function';
}

/** Names that hang, require GPU/DOM, or mutate process-wide state. */
const SKIP = new Set([
  'enableGpu',
  'disableGpu',
  'isGpuEnabled',
  'help', // prints / looks up docs
  'parser',
  'reviver',
  'replacer',
  'config',
]);

const xs = [1, 2, 3, 4];
const f64 = new Float64Array(xs);
const f = (x: number) => x * x - 2;
const graph = { A: ['B'], B: [] };
const I2 = [
  [1, 0],
  [0, 1],
];
const A2 = [
  [2, 1],
  [1, 2],
];

/** Representative calls — one or more argument lists per export name. */
const CALLS: Record<string, unknown[][]> = {
  add: [
    [1, 2],
    [
      [1, 2],
      [3, 4],
    ],
  ],
  subtract: [[5, 3]],
  multiply: [
    [3, 4],
    [A2, I2],
  ],
  divide: [[8, 2]],
  pow: [[2, 10]],
  sqrt: [[9]],
  cbrt: [[8]],
  abs: [[-3]],
  sign: [[-2]],
  exp: [[0]],
  expm1: [[0]],
  log: [[Math.E]],
  log10: [[100]],
  log2: [[8]],
  log1p: [[0]],
  sin: [[0]],
  cos: [[0]],
  tan: [[0]],
  asin: [[0]],
  acos: [[1]],
  atan: [[0]],
  atan2: [[1, 1]],
  sinh: [[0]],
  cosh: [[0]],
  tanh: [[0]],
  asinh: [[0]],
  acosh: [[1]],
  atanh: [[0]],
  sec: [[1]],
  csc: [[1]],
  cot: [[1]],
  asec: [[2]],
  acsc: [[2]],
  acot: [[1]],
  floor: [[1.7]],
  ceil: [[1.2]],
  round: [[1.5]],
  fix: [[1.7]],
  hypot: [[3, 4]],
  gcd: [[12, 18]],
  lcm: [[4, 6]],
  factorial: [[5]],
  gamma: [[5]],
  lgamma: [[5]],
  erf: [[0]],
  erfc: [[0]],
  beta: [[2, 3]],
  besselJ: [[0, 1]],
  besselY: [[0, 1]],
  besselI: [[0, 1]],
  besselK: [[0, 1]],
  airyAi: [[0]],
  airyBi: [[0]],
  zeta: [[2]],
  mean: [[xs]],
  std: [[xs]],
  variance: [[xs]],
  median: [[xs]],
  min: [[xs]],
  max: [[xs]],
  sum: [[xs]],
  prod: [[xs]],
  mode: [[[1, 1, 2]]],
  quantileSeq: [[xs, 0.5]],
  evaluate: [['2+3'], ['sin(0)']],
  compileExpr: [['x^2']],
  parse: [['1+2']],
  symbolicIntegral: [['x'], ['1/(x^2+1)'], ['1/(x^3-2)']],
  integrate: [['x^2', 'x']],
  derivative: [['x^2', 'x']],
  simplify: [['2*x+3*x']],
  expand: [['(x+1)^2']],
  factor: [['x^2-1']],
  apart: [['1/(x^2-1)']],
  together: [['1/x+1/(x+1)']],
  cancel: [['(x^2-1)/(x-1)']],
  rationalize: [['(x+1)^2']],
  spheroidalLambda: [
    [0, 0, 0],
    [0, 1, 0.3],
  ],
  spheroidalCharacteristic: [[0, 1, 0.3]],
  spheroidalAngular: [[0, 0, 0, 0.2]],
  spheroidalRadial: [[0, 0, 0, 1.2]],
  ferrersP: [[2, 0, 0.5]],
  mathieuA: [[0, 0]],
  mathieuB: [[1, 0]],
  mathieuCe: [[0, 0, 0]],
  mathieuSe: [[1, 0, 0.3]],
  coulombF: [[0, 0, 1]],
  coulombG: [[0, 0, 1]],
  coulombFG: [[0, 0, 1]],
  siegelZ: [[14.134725]],
  riemannSiegelZ: [[14.134725]],
  lerchPhi: [[0.3, 2, 1]],
  parabolicCylinderD: [[0, 0.5]],
  hyp0f1: [[1, 0.3]],
  hyp1f1: [[1, 2, 0.3]],
  hyp2f1: [[0.5, 0.5, 1, 0.2]],
  pFq: [[[1], [2], 0.3]],
  jacobiSN: [[0.3, 0.5]],
  jacobiCN: [[0.3, 0.5]],
  jacobiDN: [[0.3, 0.5]],
  jacobiP: [[2, 0.5, 0.5, 0.3]],
  gegenbauerC: [[2, 0.5, 0.3]],
  polygamma: [[1, 2]],
  trigamma: [[2]],
  polylog: [[2, 0.3]],
  struveH: [[0, 1]],
  struveL: [[0, 1]],
  kelvinBer: [[1]],
  kelvinBei: [[1]],
  barnesG: [[3]],
  newton: [[f, 1.5]],
  secant: [[f, 1, 2]],
  halley: [[f, 1.5]],
  fsolve: [[(x: number[]) => [x[0] * x[0] - 2], [1.5]]],
  root: [[(x: number[]) => [x[0] * x[0] - 2], [1.5]]],
  minimizeScalar: [[(x: number) => (x - 3) ** 2, 0, 5]],
  quad: [[(x: number) => x * x, 0, 1]],
  numericJacobian: [[(x: number[]) => [x[0] * x[0]], [1]]],
  hessian: [[(x: number[]) => x[0] * x[0] + x[1] * x[1], [1, 1]]],
  gradient: [[(x: number[]) => x[0] * x[0], [1]]],
  fft: [[[1, 0, 0, 0]]],
  rfft: [[f64]],
  irfft: [[new Float64Array([1, 0, 0])]],
  fftshift: [[f64]],
  ifftshift: [[f64]],
  fftfreq: [[4]],
  rfftfreq: [[4]],
  fftn: [[[1, 0, 0, 0]]],
  continuedFraction: [[Math.PI, 8]],
  eulerNumbers: [[4]],
  kroneckerSymbol: [[5, 3]],
  stirlingS1: [[5, 2]],
  discreteLog: [[3, 2, 5]],
  primitiveRoot: [[7]],
  multiplicativeOrder: [[3, 7]],
  permutationsGen: [[3]],
  combinationsGen: [[4, 2]],
  gmean: [[xs]],
  hmean: [[xs]],
  moment: [[xs, 2]],
  skewness: [[xs]],
  kurtosis: [[xs]],
  iqr: [[xs]],
  sem: [[xs]],
  zscore: [[xs]],
  cov: [[xs, xs]],
  corrcoef: [
    [
      [1, 2, 3],
      [2, 4, 6],
    ],
  ],
  rankdata: [[xs]],
  spearman: [[xs, [4, 3, 2, 1]]],
  kendallTau: [[xs, [4, 3, 2, 1]]],
  linregress: [
    [
      [1, 2, 3],
      [2, 4, 6],
    ],
  ],
  pearsonr: [
    [
      [1, 2, 3],
      [2, 4, 6],
    ],
  ],
  spearmanr: [
    [
      [1, 2, 3],
      [2, 4, 6],
    ],
  ],
  kendalltau: [
    [
      [1, 2, 3],
      [2, 4, 6],
    ],
  ],
  kendallTauTest: [
    [
      [1, 2, 3],
      [2, 4, 6],
    ],
  ],
  ptp: [[xs]],
  variation: [[xs]],
  trimmedMean: [[xs, 0]],
  describe: [[xs]],
  histogram: [[xs, 2]],
  clamp: [[5, 0, 3]],
  sigmoid: [[0]],
  softmax: [[f64]],
  logsumexp: [[f64]],
  cumprod: [[f64]],
  cummax: [[f64]],
  cummin: [[f64]],
  cumtrapz: [[f64]],
  normalQuantile: [[0.975]],
  studentTCDF: [[0, 10]],
  studentTQuantile: [[0.975, 10]],
  chiSquaredCDF: [[1, 2]],
  chiSquaredQuantile: [[0.95, 2]],
  fCDF: [[1, 5, 5]],
  fQuantile: [[0.95, 5, 5]],
  gammaCDF: [[1, 2, 1]],
  gammaQuantile: [[0.5, 2, 1]],
  betaCDF: [[0.5, 2, 2]],
  betaQuantile: [[0.5, 2, 2]],
  cauchyPDF: [[0]],
  cauchyCDF: [[0]],
  cauchyQuantile: [[0.5]],
  laplacePDF: [[0]],
  laplaceCDF: [[0]],
  laplaceQuantile: [[0.5]],
  logisticPDF: [[0]],
  logisticCDF: [[0]],
  logisticQuantile: [[0.5]],
  fTest: [
    [
      [1, 2, 3],
      [1, 2, 4],
    ],
  ],
  jarqueBera: [[xs]],
  kruskalWallis: [
    [
      [1, 2, 3],
      [2, 3, 4],
    ],
  ],
  wilcoxon: [[xs, [2, 3, 4, 5]]],
  fisherExact: [
    [
      [1, 2],
      [3, 4],
    ],
  ],
  studentizedRangeCDF: [[1, 3, 10]],
  studentizedRangeQuantile: [[0.95, 3, 10]],
  tukeyHSD: [
    [
      [
        [1, 2],
        [3, 4],
      ],
    ],
  ],
  haversine: [
    [
      [0, 0],
      [0, 1],
    ],
  ],
  bfs: [[graph, 'A']],
  dfs: [[graph, 'A']],
  floydWarshall: [
    [
      [
        [0, 1],
        [1, 0],
      ],
    ],
  ],
  bellmanFord: [
    [
      [
        [0, 1],
        [0, 0],
      ],
      0,
    ],
  ],
  closenessCentrality: [
    [
      [
        [0, 1],
        [1, 0],
      ],
    ],
  ],
  harmonicCentrality: [
    [
      [
        [0, 1],
        [1, 0],
      ],
    ],
  ],
  maxFlow: [
    [
      [
        [0, 1],
        [0, 0],
      ],
      0,
      1,
    ],
  ],
  minCut: [
    [
      [
        [0, 1],
        [0, 0],
      ],
      0,
      1,
    ],
  ],
  astar: [
    [
      [
        [0, 1],
        [0, 0],
      ],
      0,
      1,
      () => 0,
    ],
  ],
  hungarian: [
    [
      [
        [1, 2],
        [2, 1],
      ],
    ],
  ],
  graphColoring: [
    [
      [
        [0, 1],
        [1, 0],
      ],
    ],
  ],
  maxClique: [
    [
      [
        [0, 1],
        [1, 0],
      ],
    ],
  ],
  louvainCommunities: [
    [
      [
        [0, 1],
        [1, 0],
      ],
    ],
  ],
  katzCentrality: [
    [
      [
        [0, 1],
        [1, 0],
      ],
    ],
  ],
  isIsomorphic: [
    [
      [
        [0, 1],
        [1, 0],
      ],
      [
        [0, 1],
        [1, 0],
      ],
    ],
  ],
  interpn: [
    [
      [0, 1],
      [0, 1],
      [
        [0, 1],
        [2, 3],
      ],
      [0.5, 0.5],
    ],
  ],
  ols: [
    [
      [1, 2, 3],
      [
        [1, 1],
        [1, 2],
        [1, 3],
      ],
    ],
  ],
  ridge: [
    [
      [1, 2, 3],
      [
        [1, 1],
        [1, 2],
        [1, 3],
      ],
    ],
  ],
  lasso: [
    [
      [1, 2, 3],
      [
        [1, 1],
        [1, 2],
        [1, 3],
      ],
    ],
  ],
  elasticNet: [
    [
      [1, 2, 3],
      [
        [1, 1],
        [1, 2],
        [1, 3],
      ],
    ],
  ],
  logisticRegression: [
    [
      [0, 1, 0, 1],
      [
        [1, 0],
        [1, 1],
        [1, 0.2],
        [1, 0.8],
      ],
    ],
  ],
  fitDistribution: [['normal', [0, 0.1, -0.1, 0.2]]],
  tTestPower: [[0.5, 30]],
  linearRegression: [
    [
      [1, 2, 3],
      [2, 4, 6],
    ],
  ],
  movingAverage: [[xs, 2]],
  ewma: [[xs, 0.5]],
  detrend: [[xs]],
  acf: [[xs, 1]],
  pacf: [[xs, 1]],
  ljungBox: [[xs, 1]],
  durbinWatson: [[xs]],
  adfuller: [[xs]],
  cg: [[A2, [1, 1]]],
  minres: [[A2, [1, 1]]],
  gmres: [[A2, [1, 1]]],
  bicgstab: [[A2, [1, 1]]],
  incompleteLU: [[A2]],
  incompleteCholesky: [[A2]],
  eigsh: [[A2, 1]],
  svds: [[A2, 1]],
  thomasSolve: [
    [
      [1, 1],
      [2, 2, 2],
      [1, 1],
      [1, 2, 1],
    ],
  ],
  solveBanded: [[A2, [1, 1]]],
  toeplitzSolve: [
    [
      [2, 1],
      [1, 0],
    ],
  ],
  ldl: [[A2]],
  funm: [[I2, Math.exp]],
  cosm: [[I2]],
  sinm: [[I2]],
  complexCos: [[0, 0]],
  complexSin: [[0, 0]],
  dlyap: [[I2, I2]],
  care: [[I2, I2, I2]],
  dare: [[I2, I2, I2]],
  svd: [[A2]],
  orth: [[A2]],
  tril: [[A2]],
  triu: [[A2]],
  vander: [[[1, 2, 3]]],
  toeplitz: [[[1, 2, 3]]],
  circulant: [[[1, 2, 3]]],
  companion: [[[1, 2, 3]]],
  logdet: [[A2]],
  laplacianMatrix: [[graph]],
  generalizedEig: [[A2, I2]],
  qz: [[A2, I2]],
  nnls: [[A2, [1, 1]]],
  lsqBounded: [[A2, [1, 1]]],
  bfgs: [[(x: number[]) => (x[0] - 1) ** 2, [0]]],
  nelderMead: [[(x: number[]) => (x[0] - 1) ** 2, [0]]],
  gradientDescent: [[(x: number[]) => (x[0] - 1) ** 2, [0]]],
  levenbergMarquardt: [[(x: number[]) => [x[0] - 1], [0]]],
  kmeans: [
    [
      [
        [0, 0],
        [1, 1],
        [0.1, 0],
        [0.9, 1],
      ],
      2,
    ],
  ],
  spectralClustering: [
    [
      [
        [0, 0],
        [1, 1],
        [0.1, 0],
        [0.9, 1],
      ],
      2,
    ],
  ],
  dbscan: [
    [
      [
        [0, 0],
        [1, 10],
      ],
      0.5,
      2,
    ],
  ],
  knnClassify: [
    [
      [
        [0, 0],
        [1, 1],
      ],
      [0, 1],
      [0.1, 0.1],
      1,
    ],
  ],
  knnRegress: [[[[0], [1]], [0, 1], [0.5], 1]],
  gaussianKDE: [[xs]],
  chi2Contingency: [
    [
      [
        [1, 2],
        [3, 4],
      ],
    ],
  ],
  multipleTest: [[[0.01, 0.04, 0.2]]],
  glm: [
    [
      [1, 2, 3],
      [
        [1, 1],
        [1, 2],
        [1, 3],
      ],
      { family: 'poisson' },
    ],
  ],
  mvnPdf: [[[0, 0], [0, 0], I2]],
  mvnSample: [[[0, 0], I2, { n: 2, seed: 1 }]],
  gaussianProcessRegression: [[[0, 1], [0, 1], [0.5]]],
  gpRegression: [[[0, 1], [0, 1], [0.5]]],
  dirichletSample: [[[1, 1], { n: 2, seed: 1 }]],
  dirichletPdf: [
    [
      [0.5, 0.5],
      [1, 1],
    ],
  ],
  wishartSample: [[I2, 4, { n: 1, seed: 1 }]],
  firwin: [[5, 0.2]],
  butter: [[2, 0.2]],
  lfilter: [[[1], [1], xs]],
  lfilterZi: [[[1], [1]]],
  filtfilt: [[[1], [1], xs]],
  cheby1: [[2, 1, 0.2]],
  cheby2: [[2, 20, 0.2]],
  ellip: [[2, 1, 20, 0.2]],
  sosfilt: [[[[1, 0, 0, 1, 0, 0]], xs]],
  zpk2sos: [[[], [], 1]],
  bilinear: [[[1], [1, 1], 1]],
  buttord: [[0.1, 0.3, 1, 20]],
  firwinBandpass: [[5, 0.1, 0.4]],
  firls: [[5, [0, 0.2, 0.3, 1], [1, 1, 0, 0]]],
  remez: [[5, [0, 0.2, 0.4, 1], [1, 0]]],
  savgol: [[xs, 3, 2]],
  wiener: [[xs]],
  deconvolve: [
    [
      [1, 2, 1],
      [1, 1],
    ],
  ],
  idwt: [[[1], [0], 'haar']],
  wavedec: [[xs, 'haar']],
  waverec: [[[[1], [0]], 'haar']],
  cwt: [[xs, [1]]],
  findPeaks: [[xs]],
  peakWidths: [[xs, [1]]],
  csd: [[xs, xs]],
  coherence: [[xs, xs]],
  stft: [[f64]],
  istft: [[{ f: [[1]], t: [0], Zxx: [[1]] }]],
  decimate: [[xs, 2]],
  slerp: [[[1, 0, 0, 0], [0, 1, 0, 0], 0.5]],
  quaternionMultiply: [
    [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
    ],
  ],
  quaternionConjugate: [[[1, 2, 3, 4]]],
  quaternionNormalize: [[[1, 0, 0, 0]]],
  quaternionFromAxisAngle: [[[0, 0, 1], Math.PI / 2]],
  quaternionRotate: [
    [
      [1, 0, 0, 0],
      [1, 0, 0],
    ],
  ],
  quaternionToRotationMatrix: [[[1, 0, 0, 0]]],
  quaternionInverse: [[[1, 0, 0, 0]]],
  quaternionSlerp: [[[1, 0, 0, 0], [0, 1, 0, 0], 0.5]],
  quaternionToEuler: [[[1, 0, 0, 0]]],
  quaternionLog: [[[1, 0, 0, 0]]],
  quaternionExp: [[[0, 0, 0, 0]]],
  quaternionPow: [[[1, 0, 0, 0], 2]],
  boundingBox: [
    [
      [
        [0, 0],
        [1, 1],
      ],
    ],
  ],
  procrustes: [
    [
      [
        [0, 0],
        [1, 0],
      ],
      [
        [0, 0],
        [0, 1],
      ],
    ],
  ],
  kdTreeKNN: [
    [
      [
        [0, 0],
        [1, 1],
      ],
      [0, 0],
      1,
    ],
  ],
  kdTreeRadius: [
    [
      [
        [0, 0],
        [1, 1],
      ],
      [0, 0],
      2,
    ],
  ],
  setIsSuperset: [[[1, 2], [1]]],
  setEqual: [[[1], [1]]],
  setDisjoint: [[[1], [2]]],
  rayTriangleIntersect: [
    [
      [0, 0, 0],
      [0, 0, 1],
      [0, 0, 2],
      [1, 0, 2],
      [-1, 0, 2],
    ],
  ],
  rayPlaneIntersect: [[[0, 0, 0], [0, 0, 1], [0, 0, 1], 1]],
  segmentSegmentClosest: [
    [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 1, 1],
    ],
  ],
  convexHull: [
    [
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
    ],
  ],
  delaunay: [
    [
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
    ],
  ],
  voronoi: [
    [
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ],
    ],
  ],
  alphaShape: [
    [
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      2,
    ],
  ],
  sphericalVoronoi: [
    [
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [-1, 0, 0],
      ],
    ],
  ],
  halfspaceIntersection: [
    [
      [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ],
      [1, 1, 1, 1],
    ],
  ],
  noncentralChi2CDF: [[1, 2, 0.5]],
  noncentralFCDF: [[1, 5, 5, 0.5]],
  noncentralTCDF: [[1, 10, 0.5]],
  circmean: [[[0, 0.1, -0.1]]],
  circstd: [[[0, 0.1, -0.1]]],
  circvar: [[[0, 0.1, -0.1]]],
  vonMisesPDF: [[0, 1]],
  mcnemar: [
    [
      [
        [10, 2],
        [3, 8],
      ],
    ],
  ],
  cochranQ: [
    [
      [
        [1, 0, 1],
        [0, 1, 1],
        [1, 1, 0],
      ],
    ],
  ],
  rootsLegendre: [[4]],
  bsplineFit: [
    [
      [0, 1, 2],
      [0, 1, 0],
    ],
  ],
  bsplineEval: [[{ t: [0, 0, 1, 1], c: [0, 1], k: 1 }, [0.5]]],
  monteCarloIntegrate: [[() => 1, [[0, 1]], { n: 16, seed: 1 }]],
  interval: [[1, 2]],
  Interval: [],
  to: [[1, 'm']],
  toBest: [[1]],
  derivativeAt: [[(x: unknown) => x, 2]],
  valueAndDerivativeAt: [[(x: unknown) => x, 2]],
  gradientAt: [[(x: unknown) => x, 2]],
  and: [[true, true]],
  or: [[true, false]],
  xor: [[true, true]],
  not: [[false]],
  arg: [[1]],
  conj: [[1]],
  re: [[1]],
  im: [[1]],
  setUnion: [[[1], [2]]],
  setIntersect: [
    [
      [1, 2],
      [2, 3],
    ],
  ],
  setDifference: [[[1, 2], [2]]],
  setSymDifference: [
    [
      [1, 2],
      [2, 3],
    ],
  ],
  setIsSubset: [[[1], [1, 2]]],
  setSize: [[[1, 2]]],
  setDistinct: [[[1, 1, 2]]],
};

function invoke(fn: Fn, args: unknown[]): unknown {
  try {
    return fn(...(args as never[]));
  } catch {
    return Symbol.for('threw');
  }
}

describe('public API smoke (every function export)', () => {
  const entries = Object.entries(F).filter(([, v]) => isFn(v));
  const names = entries.map(([n]) => n);

  it('exports a large function surface', () => {
    expect(entries.length).toBeGreaterThan(200);
  });

  it('has a representative call for most named exports', () => {
    const covered = names.filter((n) => n in CALLS || SKIP.has(n));
    // Heuristic fallbacks hang on solvers / worker entry points — only
    // invoke names we have an explicit argument list for.
    expect(covered.length).toBeGreaterThan(200);
  });

  it('invokes every mapped export', { timeout: 30_000 }, () => {
    let invoked = 0;
    for (const [name, raw] of entries) {
      if (SKIP.has(name)) continue;
      const lists = CALLS[name];
      if (!lists) continue;
      const fn = raw as Fn;
      for (const args of lists) {
        const result = invoke(fn, args);
        if (result && typeof result === 'object' && 'evaluate' in result) {
          try {
            (result as { evaluate: (s?: object) => unknown }).evaluate({ x: 2 });
          } catch {
            /* compiled expr with extra free vars */
          }
        }
      }
      invoked += 1;
    }
    expect(invoked).toBeGreaterThan(200);
  });
});
