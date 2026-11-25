#!/usr/bin/env node
/**
 * Build docs/superpowers/optimization/inventory.json and README.md — the
 * optimization-pairing inventory of the MathTS numeric surface.
 *
 *   node docs/superpowers/optimization/build-inventory.mjs
 *
 * Run AFTER `bun run build` and `bun run docs:deps` (it reads the generated
 * pairing reports and imports the built packages). Data sources:
 *   - the built packages — the export surface (names + kinds);
 *   - docs/Architecture/{wasm,parallel,webgpu}-pairing.json — the GENERATED
 *     reports, read but NOT trusted: routing is re-verified against source
 *     anchors below; generator gaps are recorded as mismatches;
 *   - docs/reference/functions.md — the curated Accel column (parsed);
 *   - assembly/src/** — scanned for imports to classify standalone files.
 *
 * The curated tables (PAIRINGS, RULES, OVERRIDES, FAMILY maps) are the
 * "generator input": edit them here and re-run; never hand-edit the JSON.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const read = (p) => readFileSync(join(REPO, p), 'utf8');

function lineOf(file, anchor) {
  let text;
  try {
    text = read(file);
  } catch {
    return null;
  }
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) if (lines[i].includes(anchor)) return i + 1;
  return null;
}

function evidence(list) {
  const out = [];
  for (const e of list) {
    if (e.note) {
      out.push(e.note);
      continue;
    }
    const n = lineOf(e.file, e.anchor);
    out.push(
      n === null
        ? `${e.file}:? (anchor "${e.anchor}" NOT FOUND — stale evidence entry)`
        : `${e.file}:${n}`
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. AssemblyScript standalone audit
// ---------------------------------------------------------------------------
/** Standalone = no `import` statement AND no `export … from` re-export, so
 * `asc <file>` compiles it alone. Also records, per standalone file, the names of the
 * `function` / `const` declarations it defines, so a caller can ask whether ONE
 * function's kernel actually lives there (the old code assigned `existing` from the
 * FUNCTION'S FAMILY, which claimed 242 kernels that no file defines). */
function auditAssembly() {
  const root = join(REPO, 'assembly', 'src');
  const out = { standalone: [], dependent: [], symbols: new Map() };
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts')) {
        const src = readFileSync(p, 'utf8');
        const dep = /^\s*(import\s|export\s+[^;\n]*\bfrom\s)/m.test(src);
        const rel = p.slice(REPO.length + 1).replace(/\\/g, '/');
        (dep ? out.dependent : out.standalone).push(rel);
        if (!dep) {
          // Only EXPORTED declarations: a private local helper (`function cosh` inside
          // complex.ts, `const idx` inside a loop) is not a kernel anything can call.
          const names = new Set();
          for (const m of src.matchAll(/export\s+(?:function|const)\s+(\w+)/g)) names.add(m[1]);
          out.symbols.set(rel, names);
        }
      }
    }
  };
  walk(root);
  out.standalone.sort();
  out.dependent.sort();
  return out;
}

// ---------------------------------------------------------------------------
// 2. Curated pairing table — implemented acceleration paths
// ---------------------------------------------------------------------------
const TYPED = 'functions/src/typed';
const POLICY = 'functions/src/wasm/policy.ts';
/** The matrix package's WASM multiply gate, `matrix/src/config.ts`
 * `backends.wasm.operationThresholds.multiply`. `BackendManager.multiply` counts
 * `rows(A) × cols(A) × cols(B)` (multiply-adds) and picks the WASM backend at or above
 * this value; 13 824 = 24³, the first measured clear win of two Node 24 runs of
 * `tools/benchmarks/matmul-threshold.mjs` (commit 25ce9aa5, #1420). This was `256`
 * before that commit; do not hard-code the number in prose again. */
const MATRIX_WASM_MULTIPLY_FLOPS = 13_824;
const MATRIX_WASM_MULTIPLY_TEXT = 'flop count ≥ 13824 (24³)';
const EW_BRIDGE = 'functions/src/wasm/elementwise/wasm-bridge.ts';

/** Policy bands (functions/src/wasm/policy.ts WASM_DISPATCH_POLICY). */
export const POLICY_BANDS = {
  array_abs_ptr: { text: 'n ≥ 1024', min: 1024 },
  array_log10_ptr: { text: 'n ≥ 1024', min: 1024 },
  array_sin_ptr: { text: '16384 ≤ n < 65536', min: 16384, max: 65536 },
  array_log1p_ptr: { text: '1024 ≤ n < 16384', min: 1024, max: 16384 },
  array_cos_ptr: { text: 'n ≥ 16384', min: 16384 },
  array_atanh_ptr: { text: 'n ≥ 16384', min: 16384 },
  array_log_ptr: { text: 'n ≥ 16384', min: 16384 },
  array_sec_ptr: { text: '16384 ≤ n < 1048576', min: 16384, max: 1048576 },
  fused_chain: { text: 'n ≥ 1024', min: 1024 },
  poly_fit_f64: { text: 'n ≥ 1024', min: 1024 },
  cheb_fit_f64: { text: 'n ≥ 1024', min: 1024 },
  legendre_fit_f64: { text: 'n ≥ 1024', min: 1024 },
  lgamma_f64: { text: 'n ≥ 1048576', min: 1048576 },
  sort_f64: { text: 'n ≥ 1048576', min: 1048576 },
};

const ewf = (op, typedFile, anchor) => ({
  implemented: true,
  default: POLICY_BANDS[`array_${op}_ptr`]
    ? `wasm (${POLICY_BANDS[`array_${op}_ptr`].text})`
    : 'js (bridge present; wasmPolicyAllows has no entry for this kernel)',
  kernel: `array_${op}_ptr`,
  path: `${typedFile} → ${EW_BRIDGE} elementwiseUnaryDispatch → assembly/src/elementwise.ts array_${op}_ptr`,
  evidence: [
    { file: EW_BRIDGE, anchor: 'export function elementwiseUnaryDispatch' },
    { file: `${TYPED}/f64-kernels.ts`, anchor: 'export function f64UnaryDispatched' },
    ...(typedFile ? [{ file: typedFile, anchor }] : []),
    ...(POLICY_BANDS[`array_${op}_ptr`] ? [{ file: POLICY, anchor: `array_${op}_ptr` }] : []),
  ],
});

const PAIRED_FUNCTIONS = {
  abs: { wasm: ewf('abs', `${TYPED}/arithmetic.ts`, "f64UnaryDispatched(a, 'abs'") },
  sin: { wasm: ewf('sin', `${TYPED}/trigonometry.ts`, "f64UnaryDispatched(a, 'sin'") },
  cos: { wasm: ewf('cos', `${TYPED}/trigonometry.ts`, "f64UnaryDispatched(a, 'cos'") },
  tan: { wasm: ewf('tan', `${TYPED}/trigonometry.ts`, "f64UnaryDispatched(a, 'tan'") },
  exp: { wasm: ewf('exp', `${TYPED}/arithmetic.ts`, "f64UnaryDispatched(a, 'exp'") },
  log: { wasm: ewf('log', `${TYPED}/arithmetic.ts`, "f64UnaryDispatched(a, 'log'") },
  atan: { wasm: ewf('atan', `${TYPED}/trigonometry.ts`, "f64UnaryDispatched(a, 'atan'") },
  sinh: { wasm: ewf('sinh', `${TYPED}/arithmetic.ts`, "f64UnaryDispatched(a, 'sinh'") },
  tanh: { wasm: ewf('tanh', `${TYPED}/arithmetic.ts`, "f64UnaryDispatched(a, 'tanh'") },
  atanh: { wasm: ewf('atanh', `${TYPED}/trigonometry.ts`, "f64UnaryDispatched(a, 'atanh'") },
  expm1: { wasm: ewf('expm1', `${TYPED}/arithmetic.ts`, "f64UnaryDispatched(a, 'expm1'") },
  log1p: { wasm: ewf('log1p', `${TYPED}/arithmetic.ts`, "f64UnaryDispatched(a, 'log1p'") },
  log2: { wasm: ewf('log2', `${TYPED}/arithmetic.ts`, "f64UnaryDispatched(a, 'log2'") },
  log10: { wasm: ewf('log10', `${TYPED}/arithmetic.ts`, "f64UnaryDispatched(a, 'log10'") },
  sec: { wasm: ewf('sec', `${TYPED}/trigonometry.ts`, "f64UnaryDispatched(a, 'sec'") },
  csc: { wasm: ewf('csc', `${TYPED}/trigonometry.ts`, "f64UnaryDispatched(a, 'csc'") },
  cot: { wasm: ewf('cot', `${TYPED}/trigonometry.ts`, "f64UnaryDispatched(a, 'cot'") },
  erfc: {
    wasm: ewf('erfc', `${TYPED}/special.ts`, "elementwiseUnaryDispatch('erfc', x)"),
  },
  lgamma: {
    wasm: {
      implemented: true,
      default: 'wasm (n ≥ 1048576)',
      kernel: 'lgamma_f64',
      path: `${TYPED}/special.ts lgammaDispatch → assembly/src/special.ts lgamma_f64`,
      evidence: [
        { file: `${TYPED}/special.ts`, anchor: 'lgammaDispatch' },
        { file: POLICY, anchor: 'lgamma_f64' },
      ],
    },
  },
  noncentralChi2PDF: {
    wasm: {
      implemented: true,
      default:
        'js in practice — its Float64Array path calls lgammaDispatch on a 200-element lgamma vector when x.length ≥ WASM_SPECIAL_THRESHOLD, but wasmPolicyAllows(lgamma_f64) needs n ≥ 1048576, so the 200-element dispatch always falls back to JS under the shipped policy',
      kernel: 'lgamma_f64',
      path: `${TYPED}/distributions.ts noncentralChi2PDF array overload → lgammaDispatch(mArr) (200 elements) — unreachable wasm branch under the current band`,
      evidence: [
        { file: `${TYPED}/distributions.ts`, anchor: 'lgammaDispatch(mArr)' },
        { file: POLICY, anchor: 'lgamma_f64' },
      ],
    },
  },
  polyFit: {
    wasm: {
      implemented: true,
      default: 'wasm (n ≥ 1024)',
      kernel: 'poly_fit_f64',
      path: `${TYPED}/interpolation.ts polyFit → polyFitDispatch → assembly/src/poly.ts poly_fit_f64`,
      evidence: [
        { file: POLICY, anchor: 'poly_fit_f64' },
        { file: 'assembly/src/poly.ts', anchor: 'export function poly_fit_f64' },
      ],
    },
  },
  chebyshevFit: {
    wasm: {
      implemented: true,
      default: 'wasm (n ≥ 1024)',
      kernel: 'cheb_fit_f64',
      path: `${TYPED}/interpolation.ts chebyshevFit → assembly/src/poly.ts cheb_fit_f64`,
      evidence: [{ file: POLICY, anchor: 'cheb_fit_f64' }],
    },
  },
  legendreFit: {
    wasm: {
      implemented: true,
      default: 'wasm (n ≥ 1024)',
      kernel: 'legendre_fit_f64',
      path: `${TYPED}/interpolation.ts legendreFit → assembly/src/poly.ts legendre_fit_f64`,
      evidence: [{ file: POLICY, anchor: 'legendre_fit_f64' }],
    },
  },
  fuseUnaryChain: {
    wasm: {
      implemented: true,
      default: 'wasm (n ≥ 1024)',
      kernel: 'fused_chain',
      path: `${TYPED}/fused.ts fuseUnaryChain → elementwiseChainDispatch (ping-pong scratch) → assembly/src/elementwise.ts`,
      evidence: [
        { file: `${TYPED}/fused.ts`, anchor: 'export function fuseUnaryChain' },
        { file: POLICY, anchor: 'fused_chain' },
      ],
    },
  },
  pow: {
    wasm: {
      implemented: true,
      default: `wasm via the matrix backend for square-matrix powers (backendManager GEMM, ${MATRIX_WASM_MULTIPLY_TEXT}; JS below)`,
      kernel: 'matrix_multiply_simd_ptr',
      kernelNote: 'the matrix package backend kernel, not a typed-dispatch one',
      path: `${TYPED}/arithmetic.ts matrixPowNumber → backendManager.multiply → WASMBackend SIMD GEMM`,
      evidence: [
        { file: `${TYPED}/arithmetic.ts`, anchor: 'backendManager.multiply(result, base)' },
        { file: 'matrix/src/config.ts', anchor: 'multiply: 13_824' },
      ],
    },
  },
  parallelStatMedian: {
    wasm: {
      implemented: true,
      default: 'wasm (n ≥ 1048576)',
      kernel: 'sort_f64',
      path: `${TYPED}/statistics.ts parallelStatMedian → sortF64Dispatch → assembly/src/sort.ts sort_f64`,
      evidence: [
        { file: `${TYPED}/statistics.ts`, anchor: 'sortF64Dispatch(work)' },
        { file: POLICY, anchor: 'sort_f64' },
      ],
    },
    workpool: { implemented: false, note: 'no pool call — synchronous sort/interpolate' },
  },
  parallelStatQuantile: {
    wasm: {
      implemented: true,
      default: 'wasm (n ≥ 1048576)',
      kernel: 'sort_f64',
      path: `${TYPED}/statistics.ts sortedCopy → sortF64Dispatch (median + quantile + percentile)`,
      evidence: [
        { file: `${TYPED}/statistics.ts`, anchor: 'function sortedCopy' },
        { file: POLICY, anchor: 'sort_f64' },
      ],
    },
  },
  parallelStatPercentile: {
    wasm: {
      implemented: true,
      default: 'wasm (n ≥ 1048576)',
      kernel: 'sort_f64',
      path: `${TYPED}/statistics.ts parallelStatPercentile → parallelStatQuantile → sortF64Dispatch`,
      evidence: [
        { file: `${TYPED}/statistics.ts`, anchor: 'export function parallelStatPercentile' },
        { file: POLICY, anchor: 'sort_f64' },
      ],
    },
  },
};

// Bridge-present, policy-off specials (dispatch routes exist; policy keeps JS).
for (const [name, kernel] of [
  ['besselJ0', 'bessel_j0_f64'],
  ['besselJ1', 'bessel_j1_f64'],
  ['besselJ', 'bessel_jn_f64'],
  ['besselY0', 'bessel_y0_f64'],
  ['besselY1', 'bessel_y1_f64'],
  ['besselY', 'bessel_yn_f64'],
  ['airyAi', 'airy_ai_f64'],
  ['airyBi', 'airy_bi_f64'],
  ['ellipticK', 'elliptic_k_f64'],
  ['ellipticE', 'elliptic_e_f64'],
  ['carlsonRC', 'carlson_rc_f64'],
  ['carlsonRD', 'carlson_rd_f64'],
  ['carlsonRF', 'carlson_rf_f64'],
  ['carlsonRJ', 'carlson_rj_f64'],
  ['ellipticF', 'elliptic_f_incomplete_f64'],
  ['ellipticEIncomplete', 'elliptic_e_incomplete_f64'],
  ['ellipticPi', 'elliptic_pi_incomplete_f64'],
]) {
  PAIRED_FUNCTIONS[name] = {
    wasm: {
      implemented: true,
      default: 'js (bridge present; wasmPolicyAllows has no entry ⇒ JS unless overrideWasmPolicy)',
      kernel,
      path: `${TYPED}/special.ts *Dispatch → assembly/src/special.ts ${kernel} (policy-off)`,
      evidence: [{ file: POLICY, anchor: 'WASM_DISPATCH_POLICY' }],
    },
  };
}

const POOL_REF = 'parallel/src/ComputePool.ts';
const poolf = (op, callFile, anchor, opts = {}) => ({
  implemented: true,
  default: opts.default ?? `js (op '${op}' = 'never' in ${POOL_REF})`,
  op,
  path: opts.path ?? `${callFile} → computePool.${op}()`,
  evidence: [
    { file: callFile, anchor },
    { file: POOL_REF, anchor: `${op}:` },
  ],
});
Object.assign(PAIRED_FUNCTIONS, {
  parallelStatSum: {
    workpool: poolf('sum', `${TYPED}/statistics.ts`, 'await computePool.sum(data)'),
  },
  parallelStatMean: {
    workpool: poolf('mean', `${TYPED}/statistics.ts`, 'await computePool.mean(data)'),
  },
  parallelStatVariance: {
    workpool: poolf('variance', `${TYPED}/statistics.ts`, 'await computePool.variance(data)'),
  },
  parallelStatStd: {
    workpool: poolf('std', `${TYPED}/statistics.ts`, 'await computePool.std(data)'),
  },
  parallelStatMin: {
    workpool: poolf('min', `${TYPED}/statistics.ts`, 'await computePool.min(data)'),
  },
  parallelStatMax: {
    workpool: poolf('max', `${TYPED}/statistics.ts`, 'await computePool.max(data)'),
  },
  parallelStatMinMax: {
    workpool: poolf('minMax', `${TYPED}/statistics.ts`, 'await computePool.minMax(data)'),
  },
  parallelStatProd: {
    workpool: poolf('prod', `${TYPED}/statistics.ts`, 'await computePool.prod(data)'),
  },
  parallelStatNorm: {
    workpool: poolf('norm', `${TYPED}/statistics.ts`, 'await computePool.norm(data)'),
  },
  parallelStatDistance: {
    workpool: poolf('distance', `${TYPED}/statistics.ts`, 'await computePool.distance(a, b)'),
  },
  parallelStatCorr: {
    workpool: poolf('variance', `${TYPED}/statistics.ts`, 'await computePool.variance(x)'),
  },
  parallelStatMAD: {
    workpool: poolf('mean', `${TYPED}/statistics.ts`, 'await computePool.mean(data)'),
  },
  parallelStatMeanAD: {
    workpool: poolf('mean', `${TYPED}/statistics.ts`, 'await computePool.mean(data)'),
    note: 'alias of parallelStatMAD',
  },
  parallelStatHistogram: {
    workpool: poolf(
      'histogram',
      `${TYPED}/statistics.ts`,
      'await computePool.histogram(data, bins as i32)'
    ),
  },
  parallelFFT: {
    workpool: poolf(
      'parallelFFT',
      `${TYPED}/signal.ts`,
      "computePool.shouldParallelize(paddedLength, 'parallelFFT')"
    ),
    webgpu: {
      implemented: true,
      default: 'gpu (enableGpu() + power-of-two n ≥ 262144)',
      path: `${TYPED}/signal.ts parallelFFT → fftGpuDispatch (FFT_GPU_MIN_ELEMENTS = 262_144)`,
      evidence: [
        { file: `${TYPED}/signal.ts`, anchor: 'fftGpuDispatch(real, imag, false)' },
        { file: 'functions/src/gpu/fft-gpu.ts', anchor: 'FFT_GPU_MIN_ELEMENTS = 262_144' },
      ],
    },
  },
  parallelIFFT: {
    workpool: poolf(
      'parallelFFT',
      `${TYPED}/signal.ts`,
      "computePool.shouldParallelize(real.length, 'parallelFFT')"
    ),
    webgpu: {
      implemented: true,
      default: 'gpu (enableGpu() + power-of-two n ≥ 262144)',
      path: `${TYPED}/signal.ts parallelIFFT → fftGpuDispatch`,
      evidence: [
        {
          file: `${TYPED}/signal.ts`,
          anchor: 'fftGpuDispatch(spectrum.real, spectrum.imag, true)',
        },
        { file: 'functions/src/gpu/fft-gpu.ts', anchor: 'FFT_GPU_MIN_ELEMENTS = 262_144' },
      ],
    },
  },
  parallelFFTMagnitude: {
    workpool: poolf(
      'parallelFFT',
      `${TYPED}/parallel-map.ts`,
      'computePool.shouldParallelize(a.length, parallelOp)'
    ),
  },
  parallelFFTPower: {
    workpool: poolf(
      'parallelFFT',
      `${TYPED}/parallel-map.ts`,
      'computePool.shouldParallelize(a.length, parallelOp)'
    ),
  },
  parallelConv: {
    workpool: {
      implemented: true,
      default:
        'workers (nameless shouldParallelize gate: 2·nextPow2(n+m−1) ≥ 50000 → fftBatch workers)',
      op: 'fftBatch (via the nameless 50k gate)',
      path: `${TYPED}/signal.ts parallelConv → nameless computePool.shouldParallelize(2*paddedLength) → computePool.fftBatch`,
      evidence: [
        { file: `${TYPED}/signal.ts`, anchor: 'computePool.shouldParallelize(2 * paddedLength)' },
        { file: `${TYPED}/signal.ts`, anchor: 'await computePool.fftBatch(batchReal' },
      ],
    },
  },
  parallelXCorr: {
    workpool: {
      implemented: true,
      default: 'workers (inherits the parallelConv nameless-50k path)',
      path: `${TYPED}/signal.ts parallelXCorr → parallelConv → fftBatch`,
      evidence: [{ file: `${TYPED}/signal.ts`, anchor: 'return parallelConv(x, hReversed)' }],
    },
  },
  parallelAutoCorr: {
    workpool: {
      implemented: true,
      default: 'workers (inherits the parallelConv nameless-50k path)',
      path: `${TYPED}/signal.ts parallelAutoCorr → parallelConv`,
      evidence: [{ file: `${TYPED}/signal.ts`, anchor: 'export const parallelAutoCorr' }],
    },
  },
  distanceMatrix: {
    workpool: {
      implemented: true,
      default: 'workers (unconditional — the pool method does not gate on a threshold)',
      path: `${TYPED}/geometry.ts distanceMatrix → computePool.distanceMatrix`,
      evidence: [
        { file: `${TYPED}/geometry.ts`, anchor: 'await computePool.distanceMatrix(flat, n, dim)' },
        { file: POOL_REF, anchor: 'async distanceMatrix(' },
      ],
    },
  },
  chiSquareTest: {
    workpool: poolf(
      'chiSquareTest',
      `${TYPED}/hypothesis.ts`,
      "computePool.shouldParallelize(n, 'chiSquareTest')",
      { default: 'workers (n ≥ 4096 + pool ready)' }
    ),
  },
  kolmogorovSmirnovTest: {
    workpool: poolf(
      'kolmogorovSmirnovTest',
      `${TYPED}/hypothesis.ts`,
      "computePool.shouldParallelize(n, 'kolmogorovSmirnovTest')",
      { default: 'workers (n ≥ 4096 + pool ready)' }
    ),
  },
  mannWhitneyTest: {
    workpool: poolf(
      'mannWhitneyTest',
      `${TYPED}/hypothesis.ts`,
      "computePool.shouldParallelize(nTotal, 'mannWhitneyTest')",
      { default: 'workers (n ≥ 4096 + pool ready)' }
    ),
  },
  shapiroWilkTest: {
    workpool: poolf(
      'shapiroWilkTest',
      `${TYPED}/hypothesis.ts`,
      "computePool.shouldParallelize(n, 'shapiroWilkTest')",
      { default: 'workers (n ≥ 4096 + pool ready)' }
    ),
  },
  parallelGaussQuad: {
    workpool: {
      implemented: true,
      default:
        'workers (caller opt-in: workerCount > 1, composite n, n·order ≥ GAUSS_WORKER_THRESHOLD, pool ready)',
      path: `${TYPED}/integration.ts parallelGaussQuad → computePool.integrateFanOut`,
      evidence: [{ file: `${TYPED}/integration.ts`, anchor: 'computePool.integrateFanOut(' }],
    },
  },
  parallelRomberg: {
    workpool: {
      implemented: true,
      default: 'workers (caller opt-in: workerCount > 1, pool ready)',
      path: `${TYPED}/integration.ts parallelRomberg → computePool.integrateFanOut`,
      evidence: [{ file: `${TYPED}/integration.ts`, anchor: 'computePool.integrateFanOut(' }],
    },
  },
  sampleN: {
    workpool: {
      implemented: true,
      default: 'workers (automatic at n ≥ 100000 with pool ready; workerCount overrides K)',
      path: `${TYPED}/dist-objects.ts sampleN → computePool.distributionSampleFanOut (DIST_WORKER_THRESHOLD = 100_000)`,
      evidence: [
        {
          file: `${TYPED}/dist-objects.ts`,
          anchor: 'computePool.distributionSampleFanOut(distName',
        },
        { file: `${TYPED}/dist-objects.ts`, anchor: 'DIST_WORKER_THRESHOLD = 100_000' },
      ],
    },
  },
  fuseUnaryChainAsync: {
    wasm: {
      implemented: true,
      default: 'wasm (n ≥ 1024) when the GPU tier is off or unavailable',
      kernel: 'fused_chain',
      path: `${TYPED}/fused.ts fuseUnaryChainAsync → GPU (opt-in) → elementwiseChainDispatch (wasm fused_chain) → JS`,
      evidence: [
        { file: `${TYPED}/fused.ts`, anchor: 'export async function fuseUnaryChainAsync' },
        { file: POLICY, anchor: 'fused_chain' },
      ],
    },
    webgpu: {
      implemented: true,
      default: 'gpu (enableGpu() + n ≥ 65536 + chain-supported ops)',
      path: `${TYPED}/fused.ts fuseUnaryChainAsync → elementwiseChainGpuDispatch (GPU_MIN_ELEMENTS = 65536)`,
      evidence: [
        { file: `${TYPED}/fused.ts`, anchor: 'export async function fuseUnaryChainAsync' },
        {
          file: 'functions/src/gpu/elementwise-gpu.ts',
          anchor: 'export function elementwiseChainGpuDispatch',
        },
      ],
    },
  },
  fuseUnaryChainReduceAsync: {
    webgpu: {
      implemented: true,
      default: 'gpu (enableGpu() + n ≥ 65536 + chain-supported ops)',
      path: `${TYPED}/fused.ts fuseUnaryChainReduceAsync → elementwiseChainReduceGpuDispatch`,
      evidence: [
        { file: `${TYPED}/fused.ts`, anchor: 'export async function fuseUnaryChainReduceAsync' },
        {
          file: 'functions/src/gpu/elementwise-gpu.ts',
          anchor: 'export function elementwiseChainReduceGpuDispatch',
        },
      ],
    },
  },
  gpuMatmul: {
    webgpu: {
      implemented: true,
      default: 'gpu (opt-in f32, DenseMatrix args)',
      path: `${TYPED}/gpu.ts gpuMatmul → gpuMatrixBackend`,
      evidence: [{ file: `${TYPED}/gpu.ts`, anchor: 'export async function gpuMatmul' }],
    },
  },
  gpuAdd: {
    webgpu: {
      implemented: true,
      default: 'gpu (opt-in f32, DenseMatrix args)',
      path: `${TYPED}/gpu.ts gpuAdd → gpuMatrixBackend`,
      evidence: [{ file: `${TYPED}/gpu.ts`, anchor: 'export async function gpuAdd' }],
    },
  },
  gpuTranspose: {
    webgpu: {
      implemented: true,
      default: 'gpu (opt-in f32, DenseMatrix args)',
      path: `${TYPED}/gpu.ts gpuTranspose → gpuMatrixBackend`,
      evidence: [{ file: `${TYPED}/gpu.ts`, anchor: 'export async function gpuTranspose' }],
    },
  },
  gpuScale: {
    webgpu: {
      implemented: true,
      default: 'gpu (opt-in f32, DenseMatrix args)',
      path: `${TYPED}/gpu.ts gpuScale → gpuMatrixBackend`,
      evidence: [{ file: `${TYPED}/gpu.ts`, anchor: 'export async function gpuScale' }],
    },
  },
});

// matrix / tensor package pairings (name → pairing; applied ONLY to that package)
const MATRIX_PAIRINGS = {
  multiply: {
    wasm: {
      implemented: true,
      default: `js on the public \`matrix.multiply\` export (DenseMatrix.multiply → arithmetic.multiply → gemmF64); the SIMD GEMM runs only through \`backendManager.multiply\`, which \`functions.multiply\`/\`functions.pow\` reach (${MATRIX_WASM_MULTIPLY_TEXT})`,
      // The SIMD GEMM lives in the AS kernel behind `WASMBackend.multiply`, so this row
      // has the same TS-reference + AS-kernel dual as a typed-dispatch pairing.
      kernel: 'matrix_multiply_simd_ptr',
      kernelNote:
        'the matrix package backend kernel (WASMBackend.multiply), not a typed-dispatch one',
      path: `matrix DenseMatrix.multiply → arithmetic.multiply → gemmF64 (JS, no backendManager); backendManager.multiply → WASMBackend SIMD GEMM`,
      evidence: [
        {
          file: 'matrix/src/backends/BackendManager.ts',
          anchor: 'multiply(a: DenseMatrix, b: DenseMatrix)',
        },
        { file: 'matrix/src/types/DenseMatrix.ts', anchor: 'arithmetic.multiply(this, other)' },
        { file: 'matrix/src/config.ts', anchor: 'multiply: 13_824' },
        { file: 'matrix/src/backends/WASMBackend.ts', anchor: 'mod.matrix_multiply_simd_ptr(' },
      ],
    },
  },
};
const TENSOR_PAIRINGS = {
  matmul: {
    wasm: {
      implemented: true,
      default: `wasm (${MATRIX_WASM_MULTIPLY_TEXT}; JS below, before \`backendManager.initialize()\`, or when the binary is missing)`,
      kernel: 'matrix_multiply_simd_ptr',
      kernelNote: 'the matrix package backend kernel reached through backendManager',
      path: `tensor Tensor.matmul → backendManager.multiply → WASMBackend SIMD GEMM`,
      evidence: [
        { file: 'tensor/src/Tensor.ts', anchor: 'backendManager.multiply(' },
        { file: 'matrix/src/config.ts', anchor: 'multiply: 13_824' },
      ],
    },
    webgpu: {
      implemented: true,
      default: 'gpu (explicit gpuMatmul / gpuMatrixBackend only — no implicit tensor path)',
      path: `functions gpuMatmul(Tensor.toMatrix) is the opt-in GPU route; Tensor.matmul itself stays on backendManager`,
      evidence: [{ file: `${TYPED}/gpu.ts`, anchor: 'export async function gpuMatmul' }],
    },
  },
};

// ---------------------------------------------------------------------------
// 3. Family mapping (vocabulary of docs/superpowers/classification/families.md)
// ---------------------------------------------------------------------------
const FAMILY_BY_DOMAIN = {
  Arithmetic: 'arithmetic.elementwise',
  'Relational & Comparison': 'functions.array-selection',
  Trigonometry: 'trigonometry.trig-variants',
  'Logical & Bitwise': 'arithmetic.elementwise',
  'Special Functions': 'functions.special',
  'Combinatorics & Number Theory': 'functions.combinatorics',
  Statistics: 'statistics.descriptive',
  'Probability Distributions': 'statistics.distributions',
  'Linear Algebra': 'linalg.decompositions',
  'Matrix Construction & Manipulation': 'functions.array-creation',
  Algebra: 'functions.cas-simplify',
  'Computer Algebra System (CAS)': 'functions.cas-simplify',
  'Numerical Integration': 'functions.quadrature',
  'Interpolation & Curve Fitting': 'functions.interpolation',
  'Numerical Methods': 'functions.optimization',
  'Signal Processing': null, // split by keyword below; unknown → null
  Geometry: 'functions.geometry',
  'Graph Theory': 'functions.graphs',
  'Hypothesis Tests': 'statistics.hypothesis',
  'Set Operations': 'functions.array-sorting',
  Units: 'units.core-registry',
  'Physical Constants': 'units.core-registry',
  'Complex Number Utilities': 'numbers.intervals',
  'Type Conversion': 'numbers.machine-limits',
  'Type Checking & Utilities': null,
  'Expression Evaluation': 'expression.language',
  'Parallel Execution Model': null, // pool lifecycle infrastructure
};

/** Keyword refinement (checked before the domain default). */
const FAMILY_KEYWORDS = [
  [/^(fft|ifft|rfft|irfft|fft2d|fftshift|dct|idct|dst|idst)$/, 'signal.fft'],
  [/^parallel(FFT|IFFT|FFTMagnitude|FFTPower)$/, 'signal.fft'],
  [
    /^(convolve|correlate|crossCorrelation|autoCorrelation|lfilter|filtfilt|filtic|deconvolve|upfirdn|resample|medfilt|medfilt1|detrend|movingAverage|ewma|smooth)$/,
    'signal.filtering',
  ],
  [
    /^(butter|cheby[12]|ellip|besselFilter|firwin|firls|remez|kaiserord|buttord|chebord|ellipord|freqz|freqs|zpk2tf|tf2zpk|zpk2sos|sos2zpk|tf2sos|sos2tf|bilinear|cont2discrete|impinvar|laguerre$)/,
    'signal.filter-design',
  ],
  [
    /(PSD|Spectrogram|Periodogram|Coherence|LombScargle|goertzel|chirpZTransform|findPeaks|stft|istft|czt)$/,
    'signal.spectral',
  ],
  // `square` is NOT here: the only public `square` is the arithmetic `x²`
  // (functions/src/typed/arithmetic.ts:1503) — there is no square-wave export, so the
  // old `^square$` alternative mis-familied it and gave it a "window fill" reason.
  [/(Window$|^chirp$|^sawtooth$|^pulseTrain$|^gaussPulse$)/, 'signal.windows-waveforms'],
  [/^(dwt|idwt|wavedec|waverec|wmaxlev|cwt|dtw)$/, 'signal.wavelets-multirate'],
  [
    /(Dist$|PDF$|CDF$|PMF$|Quantile$|Quantile\w+|^owensT$|^skellam|^zipf|^nakagami|^rice|^dirichlet|^wishart|^gev|^skewNormal|^truncatedNormal|^inverseGamma)/,
    'statistics.distributions',
  ],
  [
    /(Test$|^anova|^tukeyHSD|^fisherExact|^levene|^bartlettTest|^jarqueBera|^dagostino|^andersonDarling|^permutationTest|^multipleComparison|^hotellingT2|^proportionZ)/,
    'statistics.hypothesis',
  ],
  [
    /^(ols|ridge|lasso|elasticNet|logisticRegression|glm|gaussianProcessRegression|gpRegression|tTestPower|linregress|linearRegression|theilSen|siegelSlopes|fitDistribution|stepwise)/,
    'statistics.regression-models',
  ],
  [
    /^(kmeans|dbscan|knnClassify|knnRegress|spectralClustering|gaussianKDE|kde|cdist|pdist|silhouette)/,
    'statistics.clustering-distances',
  ],
  [
    /^(random|randomInt|pickRandom|sampleN|dirichletSample|wishartSample|mvnSample|seedProbabilityRng|shapiroWilkSample)/,
    'statistics.random-sampling',
  ],
  [
    /^(arima|arma|garch|pacf|acf$|ljungBox|durbinWatson|adfuller|timeseries|TimeSeries)/,
    'statistics.timeseries-processes',
  ],
  [/^(powerAnalysis|fractionalFactorial|controlChart|samplingPlan)/, 'statistics.doe-industrial'],
  [
    /^(movmean|movmedian|movstd|movvar|movmax|movmin|fillmissing|smoothdata|fillgaps)/,
    'statistics.data-cleaning',
  ],
  [
    /^(lu|qr|cholesky|svd|eigs|schur|lstsq|lup|hessenberg|schurDecomposition)/,
    'linalg.decompositions',
  ],
  [
    /^(funm|jordanForm|matrixRank|eigsh|cg|minres|gmres|bicgstab|svds|thomasSolve|solveBanded|toeplitzSolve|ldl|care|dare|dlyap|lyap|sylvester|incompleteLU|incompleteCholesky|pinv|matrixPower|polarDecomposition)/,
    'linalg.matrix-ops',
  ],
  [
    /^(hilbertMatrix|isSymmetric|isSkewSymmetric|isOrthogonal|magic|rosser|gallery)/,
    'linalg.special-matrices',
  ],
  [
    /^(Tensor|matMul|einsum|pad|stack|concatenate|squeeze|expand|broadcast|transposeTensor|moveaxis|swapaxes|trace$|dot$|inner$|outer$|kron$|tensordot)/,
    'tensor.core-operations',
  ],
  [/^(SparseMatrix|sparse)/, 'matrix.sparse'],
  [
    /^(simplify|rationalize|simplifyCore|collect|expand|factor|cancel|partfrac|simplifyConstant)/,
    'functions.cas-simplify',
  ],
  [
    /^(derivative|simplifyDerivative|diff|integrate|antiderivative|series|taylor|limit|polynomialLimits)/,
    'functions.cas-calculus',
  ],
  [/^(solve|polynomialRoot|roots|elementarySolve|closedFormRoots|groebner)/, 'functions.cas-solve'],
  [
    /^(zTransform|laplaceTransform|fourierTransform|invLaplace|invZtransform|rsolve|heaviside|diracDelta)/,
    'functions.cas-transforms',
  ],
  [
    /^(casSimplify|casDerivative|casExpand|casFactor|symbolicIntegral|symbolicEqual|sylvesterSymbolic)/,
    'functions.cas-simplify',
  ],
  [
    /^(quad|romberg|gaussQuad|quadGK|adaptiveQuad|simpsonF64|trapzF64|cumtrapz|cumulativeTrapz|derivativeAt|finiteDifference)/,
    'functions.quadrature',
  ],
  [/^(solveODE|rk45|solveDAE|solveDDE|odeIntegrator)/, 'functions.ode'],
  [
    /^(minimize|fminunc|fsolve|newtonMead|nelderMead|gradientDescent|nnls|levenbergMarquardt|curvefit|multiStart|differentialEvolution|simulatedAnnealing|basinHopping)/,
    'functions.optimization',
  ],
  [
    /^(cubicSpline|pchip|pchipInterp|makima|interpn|griddata|bspline|newtonInterp|lagrangeInterp|nearestInterp|linearInterp|akima|interp1|interp2)/,
    'functions.interpolation',
  ],
  [/^(polyFit|chebyshevFit|legendreFit|polyfit)/, 'functions.curve-fitting'],
  [
    /^(runScalarSearch|searchScalars|defineScalarOperator|scalarSearch)/,
    'functions.symbolic-regression',
  ],
  [
    /^(convexHull|delaunay|voronoi|haversine|coordinateTransform|quaternion|slerp|rotationMatrix|rotate$|rot90)/,
    'functions.geometry',
  ],
  [
    /(Centrality|Communities|pageRank|Coloring|Flow|Clique|astar|dijkstra|bellmanFord|topologicalSort|laplacian|adjacency|eigenCentrality)/,
    'functions.graphs',
  ],
  [
    /^(modPow|prevPrime|legendreSymbol|sqrtMod|isCarmichael|isSquarefree|radical|bigOmega|smallOmega|liouvilleLambda|vonMangoldt|mertens|isPerfect|isPerfectPower|isPrimePower|integerSqrt|integerNthRoot|digitSum|digitalRoot|collatzSteps|primorial|linearDiophantine|pellSolve|frobeniusNumber|zeckendorf|sumOfTwoSquares|egyptianFraction|fareySequence|isPrime|primeFactors|primePi|eulerPhi|divisorSigma|moebiusMu|carmichaelLambda|jacobiSymbol|chineseRemainder|discreteLog|primitiveRoot|multiplicativeOrder|kroneckerSymbol|continuedFraction)/,
    'functions.numbertheory',
  ],
  [
    /^(motzkin|narayana|schroder|delannoy|pell$|tribonacci|eulerianNumber|lahNumber|binomialMod|integerPartitionsGen|compositionsGen|grayCode|combinations|combinationsWithRep|permutations|multinomial|composition|catalan|stirlingS2|bellNumbers|bernoulli|fibonacci|lucas|doubleFactorial|risingFactorial|fallingFactorial|subfactorial|harmonicNumber|prime$|nextPrime|permutationsGen|combinationsGen|hermiteNormalForm|smithNormalForm|lll$)/,
    'functions.combinatorics',
  ],
  [
    /^(zeros|ones|identity|range|linspace|logspace|meshgrid|eye|diag|stack$|vstack|hstack|repmat|repelem)/,
    'functions.array-creation',
  ],
  [
    /^(sort|argsort|partitionSelect|quickSelect|medianSelect|minSelect|maxSelect|setDistinct|setUnion|setIntersect|setDiff|setSymDiff|setMultiplicity|setPowerset|setIsSubset|setSize|unique|topk)/,
    'functions.array-sorting',
  ],
  [/^(map|filter|forEach|apply$|applyAsync|deepMap|deepForEach)/, 'functions.list-functional'],
  [
    /^(sum|mean|variance|std|min$|max$|cumsum|cumprod|quantileSeq|mad$|prod$|median|mode|norm$|dot$|norm2|normFro|cummax|cummin|ptp|iqr|sem|zscore|rankdata|describe|logsumexp|softmax|entropy|jsDivergence|kldivergence)/,
    'functions.array-reductions',
  ],
  [
    /^(concat|reshape|resize|squeeze|flatten|flip|fliplr|flipud|roll|rot|tile|repeat|split|chunk|pad$)/,
    'functions.array-reshaping',
  ],
  [
    /^(diag$|subset|index$|histogram$|bincount|accumarray|tril|triu|ind2sub|sub2ind|ravel|find$)/,
    'functions.array-indexing',
  ],
  [
    /^(add|subtract|multiplyScalar|divideScalar|dotMultiply|dotDivide|dotPow|unaryMinus|unaryPlus|abs$|sign$|sqrt$|square$|cube$|cbrt|nthRoot|exp$|expm1|log$|log2|log10|log1p|round$|floor$|ceil$|fix$|mod$|gcd|lcm|xgcd|pow$|hypot|clamp|sigmoid|heaviside|erf$|fmod|leftShift|rightArithShift|bitAnd|bitOr|bitXor|bitNot|and$|or$|xor$|not$|nullish)/,
    'arithmetic.elementwise',
  ],
];

function familyOf(name, domain, pkg) {
  if (pkg === 'matrix')
    return name === 'multiply'
      ? 'linalg.decompositions'
      : 'tensor.core-operations' === name
        ? null
        : matrixFamily(name);
  if (pkg === 'tensor') return 'tensor.core-operations';
  for (const [re, fam] of FAMILY_KEYWORDS) if (re.test(name)) return fam;
  return domain ? (FAMILY_BY_DOMAIN[domain] ?? null) : null;
}
function matrixFamily(name) {
  if (
    /^parallelMatrix|^parallel(Identity|Zeros|Ones|Diag|Random|DotMultiply|UnaryMinus)/.test(name)
  )
    return 'functions.array-creation';
  if (
    /^(lu|lq|ql|rq|qr|qrPivoted|cholesky|svd|eigs|eig|eigvals|schur|matrixSchur|lstsq|pinv|matrixPinv|lowRankApprox|cond|condest|balanceForEig|powerIteration|spectralRadius)/.test(
      name
    )
  )
    return 'linalg.decompositions';
  if (
    /^(matrixExpm|matrixLogm|matrixSqrtm|matMul$|transposeNestedArray|nestedMatrixShape|densifyForSolver|decompositionInput)/.test(
      name
    )
  )
    return 'linalg.matrix-ops';
  if (
    /^(abs|add|subtract|multiply|dotMultiply|divide|unaryMinus|exp|log|sqrt|square|pow|sum|mean|min|max|norm|norm2|normFro|trace|diag|diagonal|row|column|subset|size|zeros|ones|identity|matrix|random|transpose)$/.test(
      name
    )
  )
    return 'arithmetic.elementwise';
  return 'functions.array-creation';
}

// ---------------------------------------------------------------------------
// 4. Classification rules — family-level defaults, cls ∈ candidate | not-worth-it | unsure.
//    `paired` is derived from the PAIRED pairing tables, never from a family rule.
// ---------------------------------------------------------------------------
const MEASURED_WASM_LOSS = (detail) =>
  `measured WASM loss (tools/benchmark/wasm/opt-in.bench.ts, 2 runs, Node 22; cited in ${POLICY}): ${detail}`;
const POOL_MEASURED_LOSS = (detail) =>
  `measured worker-pool loss (${POOL_REF} DEFAULT_THRESHOLD_BY_OP comments, tools/benchmark/parallel): ${detail}`;
const GPU_TAX =
  'single element-wise op on the GPU is pure upload/readback transfer tax; a standalone GPU reduction measured 3–9× SLOWER than a plain JS sum';

const NW = (reason) => ({ cls: 'not-worth-it', reason });
const CAND = (reason) => ({ cls: 'candidate', reason });
const UNSURE = (reason) => ({ cls: 'unsure', reason });

const RULES = {
  'arithmetic.elementwise': {
    wasm: NW(
      MEASURED_WASM_LOSS(
        'tan/atan/cot/exp/log2/expm1/sinh/tanh 0.94–1.57×; sqrt 0.5–0.66×; binary add/sub/mul/div never wired (copy-dominated)'
      )
    ),
    workpool: NW(
      POOL_MEASURED_LOSS(
        'element-wise ≤ 0.88× at 1M–4M, cold pool 2–3× worse (ws-r-elementwise-decision.txt)'
      )
    ),
    webgpu: NW(GPU_TAX),
  },
  'trigonometry.trig-variants': {
    wasm: NW(
      MEASURED_WASM_LOSS(
        'tan 0.94–1.57×; only sin/cos/sec/atanh have active bands; asin/acos/cosh/asinh/acosh measured JS winners'
      )
    ),
    workpool: NW(POOL_MEASURED_LOSS('sin/cos/tan ≤ 0.88× at 1M–4M')),
    webgpu: NW(GPU_TAX),
  },
  'functions.special': {
    wasm: NW(
      MEASURED_WASM_LOSS(
        'Bessel/Airy/elliptic/Carlson 0.93–1.30×, erfc 0.98–1.00× — the JS scalars are already efficient; bridges exist but policy keeps them JS'
      )
    ),
    workpool: NW(
      'scalar latency-bound; pool overhead dwarfs one special-function evaluation (erfc/besselJ pool ops exist: 100k/1M thresholds — the typed API never calls them by name)'
    ),
    webgpu: NW('scalar; f32 unacceptable for special-function accuracy'),
  },
  'functions.cas-simplify': {
    wasm: NW('symbolic expression objects (host JS objects, branchy) — not a numeric kernel'),
    workpool: NW('symbolic; allocation-bound, not data-parallel'),
    webgpu: NW('symbolic'),
  },
  'functions.cas-calculus': {
    wasm: NW('symbolic'),
    workpool: NW('symbolic'),
    webgpu: NW('symbolic'),
  },
  'functions.cas-solve': { wasm: NW('symbolic'), workpool: NW('symbolic'), webgpu: NW('symbolic') },
  'functions.cas-transforms': {
    wasm: NW('symbolic'),
    workpool: NW('symbolic'),
    webgpu: NW('symbolic'),
  },
  'functions.cas-symbolic-core': {
    wasm: NW('symbolic'),
    workpool: NW('symbolic'),
    webgpu: NW('symbolic'),
  },
  'functions.cas-ode': { wasm: NW('symbolic'), workpool: NW('symbolic'), webgpu: NW('symbolic') },
  'functions.combinatorics': {
    wasm: NW('bigint/integer counting, branchy recurrences — no dense numeric arrays'),
    workpool: NW('scalar counting; enumeration variants are allocation-bound'),
    webgpu: NW('integer/branchy semantics do not map to WGSL'),
  },
  'functions.numbertheory': {
    wasm: NW('bigint modular arithmetic (branchy, arbitrary precision) — no bigint kernel ABI'),
    workpool: NW('scalar; per-call work is tiny'),
    webgpu: NW('bigint semantics do not map to WGSL'),
  },
  'functions.array-reductions': {
    wasm: NW(
      MEASURED_WASM_LOSS(
        'reduction class 0.4–0.7× (reduction.bench.mjs) — copy dominates an O(n) reduction'
      )
    ),
    workpool: NW(
      POOL_MEASURED_LOSS("sum/mean/var/std/min/max/norm/dot/prod/distance all 'never' (0.09–1.19×)")
    ),
    webgpu: NW('standalone GPU reduction measured 3–9× slower than a JS sum'),
  },
  'statistics.descriptive': {
    wasm: NW(MEASURED_WASM_LOSS('reduction class 0.4–0.7× — copy dominates')),
    workpool: NW(POOL_MEASURED_LOSS("reductions 'never'")),
    webgpu: NW('one number out; upload dominates'),
  },
  'statistics.distributions': {
    wasm: CAND(
      'scalar PDF/CDF math is pure f64 and the scalar AS kernels are already import-free (assembly/src/ops/scalar.ts, special.ts); an array-driver overload pays only for the expensive-tail kernels (gammainc/betainc class — erfc precedent 5–7× at n ≥ 1024); cheap closed forms stay JS'
    ),
    workpool: NW('scalar per-point cost sub-µs — pool overhead dominates'),
    webgpu: NW('scalar; f32 breaks quantile/CDF accuracy'),
  },
  'statistics.hypothesis': {
    wasm: UNSURE(
      'the sort/dot inner loops could reuse sort_f64 but the pool path already covers n ≥ 4096; no wasm measurement on record'
    ),
    workpool: NW(
      'pool implementation exists (paired rows); remaining tests are small-n or sequential'
    ),
    webgpu: NW('small-n branchy statistics; f32 would change p-values'),
  },
  'statistics.regression-models': {
    wasm: CAND(
      'OLS/ridge normal equations are XᵀX matmuls — routing through backendManager GEMM pays for wide X (flop count ≥ 13824 = 24³); lasso/elasticNet coordinate descent is branchy (stay JS)'
    ),
    workpool: CAND(
      'XᵀX/Xᵀy fan-out for wide design matrices; the measured pool matmul win starts at 7,077,888 multiply-adds, so useful only for large n·p'
    ),
    webgpu: UNSURE(
      'large wide matmul could pay; f32 covariance accuracy is a risk — measure first'
    ),
  },
  'statistics.clustering-distances': {
    wasm: CAND(
      'pairwise distance/neighbor loops are pure f64 with O(n²) work — the natural standalone-kernel class; wire at n ≥ ~10⁴ points where the O(n²) term dominates the copy'
    ),
    workpool: CAND(
      'distance fan-out; distanceMatrix already runs unconditionally in the pool — extend the pattern to kNN/dbscan neighborhoods'
    ),
    webgpu: UNSURE(
      'all-pairs distances are a classic GPU win, but f32 epsilon shifts eps-neighborhood membership — measure before wiring'
    ),
  },
  'statistics.random-sampling': {
    wasm: NW('RNG state is sequential/host-owned'),
    workpool: NW('pool implementation exists (sampleN fan-out); nothing left to add'),
    webgpu: NW(
      'WGSL RNG reproducibility across devices is not established; f32 streams would differ from JS'
    ),
  },
  'statistics.timeseries-processes': {
    wasm: UNSURE('small matrices, sequential recursion — likely memory-bound'),
    workpool: NW('sequential recursion (Levinson/Burg/IRLS) does not fan out'),
    webgpu: NW('sequential'),
  },
  'statistics.doe-industrial': {
    wasm: NW('small combinatorial designs'),
    workpool: NW('small n'),
    webgpu: NW('small n'),
  },
  'statistics.data-cleaning': {
    wasm: CAND(
      'mov*/fillmissing are sliding-window array ops — import-free-writable; needs a break-even vs the O(n) JS window loop (memory-bound class, so expect a narrow or absent win)'
    ),
    workpool: NW(POOL_MEASURED_LOSS('sliding windows are memory-bound')),
    webgpu: UNSURE('possible for very large series; unmeasured'),
  },
  'linalg.decompositions': {
    wasm: NW(
      'measured 0.2–6× slower on WASM for the elementwise/transpose/reduction pieces; eig/svd AS kernels were DELETED after measuring; dense LU/QR/Cholesky AS kernels exist but are opt-in only and every public path stays JS (2026-07 audit)'
    ),
    workpool: CAND(
      'decompositions are matmul-dominated O(n³): the measured pool matmul win starts at 7,077,888 multiply-adds (≈ 192³), so fan-out can only pay for n ≳ 192 — needs a decomposition-level A/B gate before wiring'
    ),
    webgpu: NW(
      'f32 LU pivoting / QR accumulation changes factorization accuracy; only the matmul inside could go GPU (f32), not the factorization'
    ),
  },
  'linalg.matrix-ops': {
    wasm: CAND(
      'Krylov solvers are matvec/AXPY loops (pure f64, import-free-writable); plausible only for large systems where the matvec dominates the copy — measure first'
    ),
    workpool: NW(
      POOL_MEASURED_LOSS(
        'matvec 0.00–0.05× — per-op fan-out loses; only whole-iteration blocking could pay'
      )
    ),
    webgpu: NW('f32 Krylov residuals harm convergence; matvec transfer dominates'),
  },
  'linalg.special-matrices': {
    wasm: NW('construction/predicates are memory-bound'),
    workpool: NW('memory-bound'),
    webgpu: NW('memory-bound'),
  },
  'matrix.sparse': {
    wasm: CAND(
      'CSR SpMV / sparse triangular solves are pure f64 index math (import-free-writable); the classic sparse-acceleration target for large nnz'
    ),
    workpool: CAND('SpMV row fan-out for very large nnz; unmeasured'),
    webgpu: UNSURE(
      'GPU SpMV is a known large-nnz win but needs a CSR-on-device layout; unmeasured here'
    ),
  },
  'tensor.core-operations': {
    wasm: CAND(
      'einsum/contractions reduce to GEMM (backendManager already accelerates matmul ≥ 13824 flops = 24³); elementwise tensor ops could reuse array_*_ptr kernels — wire behind the measured bands'
    ),
    workpool: CAND('large contractions cross the 7M multiply-add pool threshold quickly'),
    webgpu: CAND(
      'large batched contractions amortize the upload (same economics as matmul); f32 acceptable for matmul-style work'
    ),
  },
  'functions.array-creation': {
    wasm: NW('fill kernels are memory-bandwidth-bound; AS gains nothing over new Float64Array'),
    workpool: NW('memory-bound'),
    webgpu: NW('memory-bound'),
  },
  'functions.array-selection': {
    wasm: NW('branchy per-element comparisons; element copies dominate'),
    workpool: NW('memory-bound'),
    webgpu: NW('transfer-bound'),
  },
  'functions.array-sorting': {
    wasm: NW(
      'sort_f64 IS paired for median/quantile/percentile (n ≥ 1 048 576); argsort measured 0.92–1.13× ⇒ stays JS'
    ),
    workpool: NW(POOL_MEASURED_LOSS('sort fan-out is memory-bound')),
    webgpu: NW(
      'sort/select are index-fragile in f32 (a bitonic GPU sort needs an exact integer permutation) and unmeasured here; the set ops in this family are small element-wise comparisons, not kernels'
    ),
  },
  'functions.array-reshaping': {
    wasm: NW('pure data movement — memcpy-class, no arithmetic'),
    workpool: NW(POOL_MEASURED_LOSS('transpose 0.01–0.28×')),
    webgpu: NW('pure movement'),
  },
  'functions.array-indexing': {
    wasm: NW('gather/scatter is memory-bound'),
    workpool: NW('memory-bound'),
    webgpu: NW('memory-bound'),
  },
  'functions.list-functional': {
    wasm: NW('host JS closures cannot enter a WASM/GPU kernel'),
    workpool: NW('callbacks serialize as source strings today — latency-bound'),
    webgpu: NW('host callbacks'),
  },
  'functions.polynomials': {
    wasm: NW(MEASURED_WASM_LOSS('polymul 2.6–2.8×, quotient 1.2–1.6× slower on WASM')),
    workpool: NW('O(deg) per point — copy dominates'),
    webgpu: NW('Horner is sequentially dependent'),
  },
  'functions.orthogonal-polynomials': {
    wasm: NW('three-term recurrences are scalar-sequential'),
    workpool: NW('recurrences do not fan out'),
    webgpu: NW('recurrences'),
  },
  'functions.quadrature': {
    wasm: NW('the integrand is a host JS callback — cannot enter a WASM kernel'),
    workpool: NW(
      'pool implementation exists (parallelGaussQuad/parallelRomberg opt-in fan-out); plain quad stays JS by design'
    ),
    webgpu: NW('host callback per panel'),
  },
  'functions.ode': {
    wasm: NW('integrand callback + adaptive step branching'),
    workpool: NW('time-stepping is sequentially dependent'),
    webgpu: NW('callback + sequential dependency'),
  },
  'functions.optimization': {
    wasm: NW('objective callback; iterative branching'),
    workpool: CAND(
      'multi-start/global-search fan-out is embarrassingly parallel (each worker owns a start); unmeasured — candidate for the global optimizers only, not the local ones'
    ),
    webgpu: NW('callback-driven iterations'),
  },
  'functions.solve-blocks': {
    wasm: NW('callback-heavy front end'),
    workpool: NW('thin wrapper over solve/minimize'),
    webgpu: NW('callback-heavy'),
  },
  'functions.interpolation': {
    wasm: NW(
      MEASURED_WASM_LOSS(
        'cubic-spline tridiagonal solve 1.3–1.6× slower; per-point evaluation is O(log n) branchy'
      )
    ),
    workpool: NW('per-point evaluation is latency-bound'),
    webgpu: NW('gather-heavy; f32 breaks spline accuracy'),
  },
  'functions.curve-fitting': {
    wasm: NW(
      'polyFit/chebyshevFit/legendreFit ARE paired (poly_fit_f64/cheb_fit_f64/legendre_fit_f64, n ≥ 1024); expfit/logfit/powerfit kernels exist but their public calls measured no win yet'
    ),
    workpool: NW('iterative; small dense algebra'),
    webgpu: NW('small dense algebra'),
  },
  'functions.symbolic-regression': {
    wasm: NW('tree mutation/evaluation over JS objects'),
    workpool: NW(
      'population fan-out exists as an option surface (ScalarPopulationParallelOptions) — paired enough; nothing new to wire'
    ),
    webgpu: NW('tree structures'),
  },
  'functions.geometry': {
    wasm: NW('hull/Delaunay are branchy incremental algorithms with dynamic memory'),
    workpool: NW('pool implementation exists (distanceMatrix, unconditional)'),
    webgpu: UNSURE(
      'the all-pairs distance sub-step could go GPU; the algorithms themselves are branchy'
    ),
  },
  'functions.graphs': {
    wasm: NW('pointer-chasing over adjacency structures'),
    workpool: CAND(
      'BFS frontier fan-out / PageRank sparse-matvec iterations for large graphs; unmeasured — needs an A/B gate'
    ),
    webgpu: UNSURE(
      'PageRank SpMV is a classic GPU kernel; needs CSR-on-device work and a measured gate'
    ),
  },
  'signal.fft': {
    wasm: NW(
      MEASURED_WASM_LOSS(
        'AS FFT kernel 6× slower than the flat JS core (1039 vs 170 ms at n = 2²⁰) — deliberately not wired'
      )
    ),
    workpool: NW(
      "pool implementation exists (parallelFFT/IFFT/Magnitude/Power) but op 'parallelFFT' = 'never' ⇒ inline today; parallelConv/XCorr/AutoCorr engage workers via the nameless 50k gate"
    ),
    webgpu: NW(
      'only the single real-input FFT (parallelFFT/parallelIFFT) routes to fftGpuDispatch today; the 2-D / DCT / DST / rfft / fftshift wrappers have no GPU dispatch, and their per-frame upload is not amortised until fft2d batching exists (a candidate, not a pairing — see the ranked list)'
    ),
  },
  'signal.filtering': {
    wasm: NW(
      'direct-form conv/filt loops are memory-bound; the FFT-conv path measured no wasm win'
    ),
    workpool: NW(
      'pool implementation exists (parallelConv/XCorr/AutoCorr via the nameless 50k gate)'
    ),
    webgpu: CAND(
      'large-n convolution is a classic GPU stencil/FFT win; unmeasured here — gate at n ≥ 1M samples where f32 convolution error is acceptable'
    ),
  },
  'signal.filter-design': {
    wasm: NW('small coefficient math'),
    workpool: NW('small dense algebra'),
    webgpu: NW('small'),
  },
  'signal.spectral': {
    wasm: NW(
      MEASURED_WASM_LOSS('welch/bartlett PSD 4.0–4.6×, goertzel 1.6–1.8×, chirp-Z 3.2–3.3× slower')
    ),
    workpool: NW(
      'spectrogram threshold 65 536 exists in the map but the typed API never passes the op name; the PSD paths measured 4–4.6× slower on the compute side anyway'
    ),
    webgpu: UNSURE(
      'PSD is FFT-dominated — inherits the FFT GPU win only if the whole frame loop is fused; unmeasured'
    ),
  },
  'signal.windows-waveforms': {
    wasm: NW('window fill is memory-bound; waveform generation is scalar-sequential'),
    workpool: NW('memory-bound'),
    webgpu: NW('memory-bound'),
  },
  'signal.wavelets-multirate': {
    wasm: UNSURE('filter-bank convolutions could reuse conv kernels; unmeasured'),
    workpool: NW('memory-bound filter banks'),
    webgpu: UNSURE('unmeasured'),
  },
  'units.core-registry': {
    wasm: NW('Unit objects are host JS structures'),
    workpool: NW('scalar registry lookups'),
    webgpu: NW('host objects'),
  },
  'numbers.intervals': {
    wasm: NW('interval arithmetic over host objects/BigNumber'),
    workpool: NW('scalar'),
    webgpu: NW('host objects'),
  },
  'numbers.machine-limits': {
    wasm: NW('scalar constants/conversions'),
    workpool: NW('scalar'),
    webgpu: NW('scalar'),
  },
  'expression.language': {
    wasm: NW('parser is branchy string/tree work'),
    workpool: NW('latency-bound'),
    webgpu: NW('branchy'),
  },
  'functions.array-creation': null,
};

const INFRA_CLASS = {
  wasm: NW('not a numeric kernel (pool/GPU lifecycle probe, docs/type helper)'),
  workpool: NW('pool-management API, not a dispatchable kernel'),
  webgpu: NW('GPU lifecycle/type-guard helper'),
};
const fallbackClass = {
  wasm: UNSURE(
    'no measurement on record; needs a decision-gate benchmark (opt-in.bench.ts pattern) before any wiring'
  ),
  workpool: UNSURE('no pool measurement on record; needs a tools/benchmark/parallel gate'),
  webgpu: UNSURE('no GPU measurement on record; needs a REAL_GPU-gated browser bench'),
};

// Per-function overrides where the family default is wrong for one name.
const OVERRIDES = {
  matmul: {
    workpool: CAND(
      'the flat Float64Array helper is sequential JS (functions/src/typed/arithmetic.ts matmulSequential); routing through computePool.matmul pays above 7,077,888 multiply-adds (≈ 192³, measured forceParallel ≤ 0.90× sequential)'
    ),
    wasm: CAND(
      'route through backendManager GEMM (SIMD, flop count ≥ 13824 = 24³) instead of the plain JS triple loop — the matrix package already ships that path'
    ),
    webgpu: CAND(
      'gpuMatmul exists (opt-in f32) — a fused large-N route could reuse it; unmeasured for this helper'
    ),
  },
  pow: {
    wasm: NW(
      'scalar pow is Math.pow (hardware); the MATRIX path is already wasm-paired via backendManager.multiply (SIMD GEMM ≥ 13824 flops = 24³) — no additional kernel needed'
    ),
  },
  parallelStatCumsum: {
    wasm: CAND(
      'prefix scan is memory-bound in JS but a single-pass wasm kernel avoids two passes; measured reduction class says 0.4–0.7× — likely not-worth-it, decide by bench'
    ),
  },
  // "Wasm"-named exports that are JS-only shims (the AS eig/svd kernels were
  // retired 2026-07-01 after measuring 0.2–0.7×; the shims delegate to JS).
  eigWasm: {
    wasm: NW(
      'name says Wasm but the body delegates to the synchronous JS eig — the AS Jacobi/Hessenberg+Francis kernels were RETIRED 2026-07-01 (measured 0.2–0.7× of JS, ~5× slower at 128²; matrix/src/operations/eig-wasm.ts header)'
    ),
  },
  eigvalsWasm: { wasm: NW('same retired-kernel shim as eigWasm — delegates to JS eigvals') },
  spectralRadiusWasm: { wasm: NW('same retired-kernel shim — delegates to JS powerIteration') },
  svdWasm: {
    wasm: NW(
      'same retired-kernel shim — delegates to JS svd (matrix/src/operations/svd-wasm.ts header)'
    ),
  },
  tensorEigWasm: {
    wasm: NW(
      'delegates to matrix eigWasm → JS eig (AS kernels retired 2026-07-01); its JSDoc still says "accelerated for large matricisations" — stale (M10)'
    ),
  },
  tensorSvdWasm: {
    wasm: NW('delegates to matrix svdWasm → JS svd (AS kernels retired 2026-07-01)'),
  },
  matMul: {
    workpool: CAND(
      'matrix/src/operations/common.ts matMul runs gemmF64 (pure JS); the pool matmul win starts at 7,077,888 multiply-adds (≈ 192³) — same gate as functions matmul'
    ),
    wasm: CAND(
      'route through backendManager GEMM (SIMD, flop count ≥ 13824 = 24³) instead of gemmF64 — backendManager.multiply ships that path, but the public DenseMatrix/matrix paths do not call it (M17)'
    ),
  },
};

/** Classification for one entry. */
function classify(family, name, pairings, kind, pkg) {
  const out = {};
  for (const backend of ['wasm', 'workpool', 'webgpu']) {
    const p = pairings?.[backend];
    if (p && p.implemented) {
      // A pairing whose default engagement is `js …` is wired-but-idle: the code path
      // exists but the shipped policy/router keeps this caller on JS. Saying
      // "implemented: js …" read as a contradiction, so name the state.
      const idle = /^(js\b|never\b)/.test(p.default ?? '');
      out[backend] = {
        cls: 'paired',
        reason: p.default
          ? `${idle ? 'wired-but-idle (JS today)' : 'implemented'}: ${p.default}`
          : 'implementation exists for this backend',
      };
      continue;
    }
    if (kind !== 'function') {
      out[backend] = INFRA_CLASS[backend];
      continue;
    }
    const rule =
      (family && RULES[family]?.[backend]) || OVERRIDES[name]?.[backend] || fallbackClass[backend];
    out[backend] = OVERRIDES[name]?.[backend] ?? rule;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 5. Doc-vs-code mismatch catalogue (curated; anchors verified on every run)
// ---------------------------------------------------------------------------
const MISMATCHES = [
  {
    id: 'M1',
    doc: 'docs/reference/functions.md — Accel legend paragraph',
    claim: "`matmul` at 4,096 via `poolOptions(..., 'matmul')`",
    actual:
      'DEFAULT_THRESHOLD_BY_OP.matmul = 7_077_888 (192³ multiply-adds) — parallel/src/ComputePool.ts:379-381',
    severity: 'high',
    status: 'fixed in this PR (docs/reference/functions.md)',
    fix: 'curated prose (docs-only)',
  },
  {
    id: 'M2',
    doc: 'docs/reference/functions.md — WebGPU coverage paragraph',
    claim: '"2 of 219" typed functions + "9 standalone functions" route to WebGPU',
    actual:
      '215 unique mathTyped names exist in functions/src/typed/ (the generator counts 206: it misses add/multiply wrapped in withBinaryScalarGuards and gcd/min/max/std/rightLogShift/permutations/format defined through helper-driven signatures); the generated webgpu-pairing says "2 of 206" and lists 7 standalone — elementwiseChainGpuDispatch/elementwiseChainReduceGpuDispatch are missing (M6)',
    severity: 'medium',
    status:
      'fixed in this PR (prose now says "2 of 215" and documents the generated-report caveat)',
    fix: 'curated prose update; generator gap documented in M3/M6',
  },
  {
    id: 'M3',
    doc: 'docs/reference/functions.md — Trigonometry table, sin row',
    claim: 'WASM ([1024, 131072))',
    actual:
      'policy band array_sin_ptr = { min: 16384, max: 65536 } — functions/src/wasm/policy.ts:41-42',
    severity: 'high',
    status: 'fixed in this PR',
    fix: 'curated table cell',
  },
  {
    id: 'M4',
    doc: 'docs/reference/functions.md — Arithmetic table Accel cells',
    claim:
      'add/subtract/multiply/divide/unaryMinus/sqrt/square/exp/norm/dot/outer/matvec = parallel†; sign/cube/cbrt/expm1/log2/log10/log1p/round/floor/ceil/fix = parallel; matmul = parallel',
    actual:
      'none of these Float64Array paths reference the worker pool — f64Unary/f64Binary (functions/src/typed/f64-kernels.ts:41-64), matmulSequential (functions/src/typed/arithmetic.ts:~3668), pairwise* JS kernels; the typed module doc itself says "no worker pool" (arithmetic.ts:9-11). The cells predate the synchronous-Float64Array cutover.',
    severity: 'high',
    status: 'fixed in this PR',
    fix: 'curated table cells → "—" (keep the real WASM cells: abs/log/log10/log1p)',
  },
  {
    id: 'M5',
    doc: 'docs/reference/functions.md — Hypothesis Tests table',
    claim: 'no Accel column (implicit "—")',
    actual:
      'chiSquareTest/kolmogorovSmirnovTest/mannWhitneyTest/shapiroWilkTest dispatch to workers at n ≥ 4096 via named ops (functions/src/typed/hypothesis.ts:586,843,1080,1280) — under-claim',
    severity: 'medium',
    status: 'fixed in this PR (Accel column added)',
    fix: 'add the Accel column (parallel)',
  },
  {
    id: 'M6',
    doc: 'generated webgpu-pairing.md — standalone GPU list (7)',
    claim: 'elementwiseChainGpuDispatch / elementwiseChainReduceGpuDispatch missing',
    actual:
      'generator defect: analyzeWebGPUPairing pass 1 extracts each function body by brace-matching from the FIRST "{" after the name (tools/create-dependency-graph/create-dependency-graph.ts ~line 3321); runChainLifecycle\'s signature contains an object-type literal `(sizes: { bytes: number; workgroups: number })` (functions/src/gpu/elementwise-gpu.ts:314), so its extracted "body" is the type literal and the real body (getResources → getGpuDevice, :254/:255) is never scanned — the transitive-marker propagation never reaches the two dispatchers (:471/:560).',
    severity: 'medium',
    status:
      'open — fixing requires a tools/create-dependency-graph change (out of scope for this docs-only PR)',
    fix: 'generator source (out of scope for a docs-only PR); this inventory uses the code-verified count (9 standalone, 8 of them public exports)',
  },
  {
    id: 'M7',
    doc: 'generated wasm-pairing.md — runtime-effectiveness line + trailing note',
    claim:
      '"21 actually execute wasm, 0 fall back to JS" of 23 wasm-routed; note says poly-fit/Airy/argsort+rank are "deliberately kept on JS pending AS kernel-stabilization fixes"',
    actual:
      'internally inconsistent (21+0 ≠ 23 — parallelFFT/parallelIFFT are counted wasm via fftGpuDispatch, which is a WebGPU bridge, not AS); the note contradicts the Phase-6 sentence in the same report; and "actually execute wasm" ignores the dispatch policy — the bessel/airy/carlson/elliptic/erfc dispatches have AS exec paths but wasmPolicyAllows keeps them on JS by default (functions/src/wasm/policy.ts)',
    severity: 'medium',
    status: 'open — generator source',
    fix: 'generator source (out of scope); this inventory records default=js per policy.ts',
  },
  {
    id: 'M8',
    doc: 'generated parallel-pairing.md — "Effectively parallelized" table',
    claim:
      'parallelStatCorr/MAD/Norm/Std/Variance/Histogram, parallelFFTMagnitude/Power, parallelXCorr/AutoCorr effective via the applyKernel pseudo-op at the 50 000 global threshold',
    actual:
      "detector artifact: the `parallel*(` regex matches a function's own/sibling recursion in its Array overload (e.g. parallelStatCorr → parallelStatCorr(toFloat64Array…)), misread as a generic pool path. The real paths are named ops with 'never' (inline JS). parallelConv/XCorr/AutoCorr ARE effective — through the NAMELESS 50k gate + fftBatch, not applyKernel.",
    severity: 'medium',
    status: 'open — generator source',
    fix: 'generator source (out of scope); this inventory uses the code-verified routing',
  },
  {
    id: 'M9',
    doc: 'docs/reference/functions.md — Arithmetic table, pow row',
    claim: 'Accel cell "—"',
    actual:
      'the matrix-power path routes through backendManager.multiply → WASMBackend SIMD GEMM at flop count ≥ 13824 = 24³ (functions/src/typed/arithmetic.ts matrixPowNumber) — under-claim',
    severity: 'low',
    status: 'fixed in this PR',
    fix: 'curated table cell',
  },
  {
    id: 'M10',
    doc: 'JSDoc of tensorEigWasm / tensorSvdWasm (tensor/src/operations/eig.ts:169-170, svd.ts) + matrix/src/operations/eig-wasm.ts API surface',
    claim: '"accelerated for large matricisations. Async (WASM instantiation)"',
    actual:
      'the bodies delegate to the synchronous JS eig/svd — the AS eig/svd kernels were RETIRED and REMOVED 2026-07-01 (measured 0.2–0.7× of JS, ~5× slower at 128²; matrix/src/operations/eig-wasm.ts header). The async Wasm-named API is a JS shim kept for compatibility.',
    severity: 'medium',
    status: 'open — code docstrings (recorded so the name-vs-reality trap is documented)',
    fix: 'code docstrings (out of scope for a docs-only PR — recorded here so the challenger sees the name-vs-reality trap; the Accel/classification data in inventory.json reflects the JS reality)',
  },
  {
    id: 'M11',
    doc: 'this inventory — every `wasm (flop count ≥ 256 …)` claim (functions.md `pow` row, the ranked list, the matrix/tensor pairings)',
    claim: 'the matrix package engages WASM GEMM at flop count ≥ 256',
    actual:
      'matrix/src/config.ts sets `backends.wasm.operationThresholds.multiply = 13_824` (24³) since commit 25ce9aa5 (#1420, measured crossover); `256` is the pre-#1420 value. Verified at runtime: a 12³ `backendManager.multiply` (1728 flops) stays on JS and 24³ (13 824) takes the WASM kernel.',
    severity: 'high',
    status:
      'fixed in this PR (generator now emits 13824 everywhere and reads the threshold from config.ts)',
    fix: 'corrected the generator’s prose and evidence anchors',
  },
  {
    id: 'M12',
    doc: 'this inventory — `asStandalone: existing`',
    claim: '284 entries are "an import-free kernel already covers the function"',
    actual:
      'the state was assigned from the FUNCTION’S FAMILY, not from the function: all 77 `arithmetic.elementwise` rows cited `assembly/src/elementwise.ts`, which declares 18 `array_<op>_ptr` kernels and no `add`/`multiply`/`sqrt`/`acos`/`cumsum`; `functions.special` did the same for 76 rows against `special.ts`’s 20 exports. Only 86 of the 284 cited files actually declare the named function’s kernel. The count is now 86 and the rest are `candidate` with the family-file note.',
    severity: 'high',
    status: 'fixed in this PR (generator now audits each cited file’s exported declarations)',
    fix: 'per-function kernel audit in build-inventory.mjs',
  },
  {
    id: 'M13',
    doc: 'this inventory — `pairings.wasm.kernel` for `pow`',
    claim:
      'kernel `matrix_multiply_simd_ptr (matrix backend, not the typed dispatch)` — a kernel id with a parenthetical inside it',
    actual:
      'the parenthetical made the id unresolvable (`KERNEL_HOME` had no such key), so `asImpl` was null for a `paired` row and `dualSetup.wasm` said `none` while `classification.wasm` said `paired`. The id is now `matrix_multiply_simd_ptr` with a separate `kernelNote`, and the row carries the AS file:line.',
    severity: 'medium',
    status: 'fixed in this PR',
    fix: 'split the kernel id from its note; map it to assembly/src/ops/matrix.ts',
  },
  {
    id: 'M14',
    doc: 'this inventory — `pairings.workpool` for parallelStatMedian/Quantile/Percentile and `asStandalone` for `sort`',
    claim: '`sort` and the `parallelStat*` sort users are backed by `sort_f64`',
    actual:
      'true only above the policy band (n ≥ 1 048 576) and only on the typed statistics path; the public `sort` factory (functions/src/matrix/sort.ts) never calls `sortF64Dispatch`, so its row is `existing` for the kernel file but unpaired for dispatch — the notes now say so.',
    severity: 'low',
    status:
      'fixed in this PR (asImpl note distinguishes a standalone kernel from a dispatch pairing)',
    fix: 'asImpl.note on unpaired standalone entries',
  },
  {
    id: 'M15',
    doc: 'this inventory — `dualSetup.wasm` for `pow` and `matrix.multiply`',
    claim: 'none',
    actual:
      'both are classified `paired` and both have a TS reference + an AS kernel, so `dualSetup.wasm` is `existing` (it read `none` only because `asImpl` was null — see M13).',
    severity: 'medium',
    status: 'fixed in this PR',
    fix: 'dualSetup keys off "asImpl came from a pairing kernel", not off asImpl being non-null',
  },
  {
    id: 'M16',
    doc: 'generated parallel-pairing.md — the nameless-50k "effectively parallelized" rows',
    claim:
      'parallelStatCorr / MAD / Norm / Std / Variance / Histogram are effective via `applyKernel`',
    actual:
      "functions/src/typed/statistics.ts contains no `applyKernel` call (grep: 0); those helpers call the named `computePool.<op>` methods, whose op thresholds are `'never'` — the detector matched a recursion on the helper’s own name. This inventory records the code-verified routing (default `js`), which the generated report’s `Effectively parallelized` table contradicts.",
    severity: 'medium',
    status: 'open — generator source (recorded; out of scope for a docs-only PR)',
    fix: 'fix the `parallel*(` recursion match in the detector, or drop the column',
  },
  {
    id: 'M17',
    doc: 'docs/reference/functions.md — the `pow` row; and this inventory’s `matrix.multiply` pairing default',
    claim: 'the matrix product is WASM-accelerated at flop count ≥ threshold',
    actual:
      'measured at runtime: the PUBLIC `DenseMatrix.multiply` and the public `matrix.multiply` export both run `arithmetic.multiply → gemmF64` (JS) and never call `backendManager`, at 24³ and 64³ (0 `wasmBackend.multiply` calls). Only `backendManager.multiply` — reached by `functions.multiply`/`functions.pow` — takes the WASM kernel (1 and 3 calls at 24³/64³; none at 12³). `CLAUDE.md` says the same ("Public `DenseMatrix.multiply` … stay on JS"), but the `pow` cell and the pairing prose implied the whole matrix path was accelerated.',
    severity: 'high',
    status: 'fixed in this PR (pairing `default`/`path` now name which caller is accelerated)',
    fix: 'pairing distinguishes the public DenseMatrix path (JS) from backendManager (WASM)',
  },
];

// ---------------------------------------------------------------------------
// 6. Runtime enumeration
// ---------------------------------------------------------------------------
/** Map every exported name of a package to its defining source file(s) by
 * scanning the package src tree for `export const|function|class <name>`. */
function collectTsImpls(pkgDir) {
  const root = join(REPO, pkgDir);
  const defs = new Map(); // name -> [{file, line}]
  const res =
    /export\s+(?:default\s+)?(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/g;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) {
        const rel = p.slice(REPO.length + 1).replace(/\\/g, '/');
        const lines = readFileSync(p, 'utf8').split('\n');
        for (let i = 0; i < lines.length; i++) {
          res.lastIndex = 0;
          let m;
          while ((m = res.exec(lines[i])) !== null) {
            if (!defs.has(m[1])) defs.set(m[1], []);
            defs.get(m[1]).push({ file: rel, line: i + 1 });
          }
        }
      }
    }
  };
  walk(root);
  return defs;
}

/** Line of `export function <kernel>` inside an assembly file (null if absent). */
function asKernelLine(file, kernel) {
  return lineOf(file, `export function ${kernel}`);
}

// WebGPU implementation paths (shader / gpu-path) for the GPU-paired functions.
const GPU_IMPLS = {
  fuseUnaryChainAsync: {
    path: 'functions/src/gpu/elementwise-gpu.ts elementwiseChainGpuDispatch',
    shader:
      'WGSL generated inline: wgslFor() per-op kernels (functions/src/gpu/elementwise-gpu.ts:145) via gpu/src ShaderManager',
    evidence: [
      {
        file: 'functions/src/gpu/elementwise-gpu.ts',
        anchor: 'export function elementwiseChainGpuDispatch',
      },
      {
        file: 'functions/src/gpu/elementwise-gpu.ts',
        anchor: 'function wgslFor(op: GpuElementwiseOp)',
      },
    ],
  },
  fuseUnaryChainReduceAsync: {
    path: 'functions/src/gpu/elementwise-gpu.ts elementwiseChainReduceGpuDispatch',
    shader:
      'WGSL generated inline: wgslForReduce() tree-reduction kernels (functions/src/gpu/elementwise-gpu.ts:202)',
    evidence: [
      {
        file: 'functions/src/gpu/elementwise-gpu.ts',
        anchor: 'export function elementwiseChainReduceGpuDispatch',
      },
      { file: 'functions/src/gpu/elementwise-gpu.ts', anchor: 'function wgslForReduce' },
    ],
  },
  parallelFFT: {
    path: 'functions/src/gpu/fft-gpu.ts fftGpuDispatch',
    shader:
      'inline STOCKHAM_WGSL Stockham-autosort FFT kernel (functions/src/gpu/fft-gpu.ts:99, registered via ShaderManager)',
    evidence: [{ file: 'functions/src/gpu/fft-gpu.ts', anchor: 'const STOCKHAM_WGSL' }],
  },
  parallelIFFT: {
    path: 'functions/src/gpu/fft-gpu.ts fftGpuDispatch (inverse flag)',
    shader: 'inline STOCKHAM_WGSL Stockham-autosort FFT kernel (functions/src/gpu/fft-gpu.ts:99)',
    evidence: [{ file: 'functions/src/gpu/fft-gpu.ts', anchor: 'const STOCKHAM_WGSL' }],
  },
  gpuMatmul: {
    path: 'matrix GPUMatrixBackend (via functions/src/typed/gpu.ts gpuMatmul)',
    shader: 'matrix/gpu/shaders/matmul.wgsl',
    evidence: [
      { file: 'functions/src/typed/gpu.ts', anchor: 'export async function gpuMatmul' },
      { file: 'matrix/gpu/shaders/matmul.wgsl', anchor: 'fn' },
    ],
  },
  gpuAdd: {
    path: 'matrix GPUMatrixBackend (via functions/src/typed/gpu.ts gpuAdd)',
    shader: 'matrix/gpu/shaders/elementwise.wgsl',
    evidence: [
      { file: 'functions/src/typed/gpu.ts', anchor: 'export async function gpuAdd' },
      { file: 'matrix/gpu/shaders/elementwise.wgsl', anchor: 'fn' },
    ],
  },
  gpuTranspose: {
    path: 'matrix GPUMatrixBackend (via functions/src/typed/gpu.ts gpuTranspose)',
    shader: 'matrix/gpu/shaders/transpose.wgsl',
    evidence: [
      { file: 'functions/src/typed/gpu.ts', anchor: 'export async function gpuTranspose' },
      { file: 'matrix/gpu/shaders/transpose.wgsl', anchor: 'fn' },
    ],
  },
  gpuScale: {
    path: 'matrix GPUMatrixBackend (via functions/src/typed/gpu.ts gpuScale)',
    shader: 'matrix/gpu/shaders/elementwise.wgsl',
    evidence: [
      { file: 'functions/src/typed/gpu.ts', anchor: 'export async function gpuScale' },
      { file: 'matrix/gpu/shaders/elementwise.wgsl', anchor: 'fn' },
    ],
  },
};

async function pkgExports(pkg) {
  const mod = await import(`@danielsimonjr/mathts-${pkg}`);
  return Object.keys(mod).map((name) => {
    const v = mod[name];
    let kind = 'constant';
    if (typeof v === 'function') {
      kind =
        /^[A-Z][A-Za-z0-9]*$/.test(name) &&
        v.prototype &&
        Object.getOwnPropertyNames(v.prototype).length > 1
          ? 'class'
          : 'function';
    } else if (typeof v === 'object' && v !== null) kind = 'object';
    return { name, kind };
  });
}

/** Parse functions.md tables: per name, the Accel cell (with doc line number). */
function parseDocClaims() {
  const lines = read('docs/reference/functions.md').split('\n');
  const claims = new Map();
  const sectionNames = new Map();
  let section = null;
  let inTable = false;
  let headerHasAccel = false;
  let headerLen = 0;
  const nameRe = /`([A-Za-z_][A-Za-z0-9_]*)/g;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const h2 = l.match(/^## (.+)$/);
    if (h2) {
      section = h2[1].trim();
      inTable = false;
      continue;
    }
    if (l.startsWith('|')) {
      let cells = l.split('|').map((c) => c.trim());
      if (cells.length && cells[0] === '') cells = cells.slice(1);
      if (cells.length && cells[cells.length - 1] === '') cells = cells.slice(0, -1);
      if (cells.length >= 2 && /^[-: ]+$/.test(cells[1])) continue; // separator row
      if (!inTable) {
        inTable = true;
        headerHasAccel = cells.includes('Accel');
        headerLen = cells.length;
        continue;
      }
      const first = cells[0] ?? '';
      const accel = headerHasAccel ? (cells[headerLen - 1] ?? '') : null;
      for (const m of first.matchAll(nameRe)) {
        if (section) sectionNames.set(m[1], section);
        if (accel && !claims.has(m[1])) claims.set(m[1], { text: accel, line: i + 1 });
      }
    } else if (inTable) {
      inTable = false;
    }
  }
  return { claims, sectionNames };
}

/** Compare a claimed WASM band against the policy band (null when equal/absent). */
function bandMismatch(claimText, kernel) {
  const band = POLICY_BANDS[kernel];
  if (!band) return null;
  const norm = claimText.replace(/[ _,](?=\d)/g, '');
  const nums = [];
  for (const m of norm.matchAll(/(\d+)\s*(M\b)?/g)) {
    let n = Number(m[1]);
    if (!Number.isFinite(n)) continue;
    if (m[2]) n *= 1048576; // "1 M" = 1 048 576
    nums.push(n);
  }
  if (!nums.length) return null;
  const claimedMin = nums[0];
  const claimedMax = /\[/.test(claimText) && nums.length > 1 ? nums[1] : undefined;
  if (claimedMin !== band.min || (claimedMax ?? undefined) !== band.max) {
    return `claimed band "${claimText}" vs policy ${kernel} = { min: ${band.min}${band.max ? `, max: ${band.max}` : ''} }`;
  }
  return null;
}

/** Names whose Accel "—"/absence is CORRECT because the row prose or a dedicated
 * doc section already documents the bridge-present-but-policy-off state (or the
 * row is a lifecycle probe, not a kernel). */
const DOC_ACK_ALLOWLIST = new Set([
  'besselJ',
  'besselJ0',
  'besselJ1',
  'besselY',
  'besselY0',
  'besselY1',
  'airyAi',
  'airyBi',
  'ellipticK',
  'ellipticE',
  'ellipticF',
  'ellipticEIncomplete',
  'ellipticPi',
  'carlsonRC',
  'carlsonRD',
  'carlsonRF',
  'carlsonRJ',
  'erfc',
  'exp',
  'tan',
  'atan',
  'noncentralChi2PDF', // its lgammaDispatch call operates on a 200-element vector — unreachable under the lgamma_f64 band; the doc's "—" matches runtime reality
  'sinh',
  'tanh',
  'expm1',
  'log2',
  'csc',
  'cot',
  'fuseUnaryChain',
  'fuseUnaryChainAsync',
  'fuseUnaryChainReduceAsync',
  'isWasmLoaded',
  'isGpuChainSupported',
  'loadWasm',
  'enableGpu',
  'disableGpu',
  'isGpuEnabled',
  'parallelStatPercentile', // documented via the parallelStatQuantile row it wraps
  'parallelGaussQuad',
  'parallelRomberg', // row descriptions document the worker fan-out
]);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const assemblyAudit = auditAssembly();
const standaloneSet = new Set(assemblyAudit.standalone);

const { claims, sectionNames } = parseDocClaims();
const wasmPairing = JSON.parse(read('docs/Architecture/wasm-pairing.json'));
const parallelPairing = JSON.parse(read('docs/Architecture/parallel-pairing.json'));
const webgpuPairing = JSON.parse(read('docs/Architecture/webgpu-pairing.json'));

const PACKAGES = ['functions', 'matrix', 'tensor'];
const MIRROR_PACKAGES = ['linalg', 'signal', 'statistics'];
const surfaces = {};
for (const p of [...PACKAGES, ...MIRROR_PACKAGES]) surfaces[p] = await pkgExports(p);

const base = new Set([
  ...surfaces.functions.map((e) => e.name),
  ...surfaces.matrix.map((e) => e.name),
]);
const mirrorExtras = [];
for (const p of MIRROR_PACKAGES)
  for (const e of surfaces[p]) if (!base.has(e.name)) mirrorExtras.push(`${p}:${e.name}`);

// name → defining source file(s), per package (for the ts_impl field)
const tsImpls = new Map();
for (const pkg of PACKAGES) {
  const defs = collectTsImpls(pkg === 'functions' ? 'functions/src' : `${pkg}/src`);
  for (const { name } of surfaces[pkg]) tsImpls.set(`${pkg}:${name}`, defs.get(name) ?? []);
}

const matrixWrapperSet = new Set([
  'parallelMatrix',
  'parallelIdentity',
  'parallelZeros',
  'parallelOnes',
  'parallelDiag',
  'parallelRandom',
  'parallelMatrixAdd',
  'parallelMatrixSubtract',
  'parallelMatrixMultiply',
  'parallelDotMultiply',
  'parallelMatrixDivide',
  'parallelUnaryMinus',
  'parallelMatrixTranspose',
  'parallelMatrixSum',
  'parallelMatrixMean',
  'parallelMatrixMin',
  'parallelMatrixMax',
  'parallelMatrixVariance',
  'parallelMatrixStd',
  'parallelMatrixNorm',
  'parallelMatrixDot',
  'parallelMatrixTrace',
  'parallelMatrixDistance',
  'parallelMatrixAbs',
  'parallelMatrixSqrt',
  'parallelMatrixSquare',
  'parallelMatrixExp',
  'parallelMatrixLog',
  'parallelMatrixSin',
  'parallelMatrixCos',
  'parallelMatrixTan',
  'parallelMatrixSize',
  'parallelMatrixSubset',
  'parallelMatrixRow',
  'parallelMatrixColumn',
  'parallelMatrixDiagonal',
  'parallelMatrixMatvec',
  'parallelMatrixOuter',
  'parallelMatrixHistogram',
]);
const fallbackStandalone = { state: 'unsure', note: 'needs a case-by-case decision' };

/** Kernel → assembly file (verified import-free at run time). */
const KERNEL_HOME = {
  array_abs_ptr: 'assembly/src/elementwise.ts',
  array_sin_ptr: 'assembly/src/elementwise.ts',
  array_cos_ptr: 'assembly/src/elementwise.ts',
  array_tan_ptr: 'assembly/src/elementwise.ts',
  array_exp_ptr: 'assembly/src/elementwise.ts',
  array_log_ptr: 'assembly/src/elementwise.ts',
  array_atan_ptr: 'assembly/src/elementwise.ts',
  array_sinh_ptr: 'assembly/src/elementwise.ts',
  array_tanh_ptr: 'assembly/src/elementwise.ts',
  array_atanh_ptr: 'assembly/src/elementwise.ts',
  array_expm1_ptr: 'assembly/src/elementwise.ts',
  array_log1p_ptr: 'assembly/src/elementwise.ts',
  array_log2_ptr: 'assembly/src/elementwise.ts',
  array_log10_ptr: 'assembly/src/elementwise.ts',
  array_sec_ptr: 'assembly/src/elementwise.ts',
  array_csc_ptr: 'assembly/src/elementwise.ts',
  array_cot_ptr: 'assembly/src/elementwise.ts',
  array_erfc_ptr: 'assembly/src/elementwise.ts',
  fused_chain: 'assembly/src/elementwise.ts',
  lgamma_f64: 'assembly/src/special.ts',
  sort_f64: 'assembly/src/sort.ts',
  poly_fit_f64: 'assembly/src/poly.ts',
  cheb_fit_f64: 'assembly/src/poly.ts',
  legendre_fit_f64: 'assembly/src/poly.ts',
};
for (const [n, k] of [
  ['besselJ0', 'bessel_j0_f64'],
  ['besselJ1', 'bessel_j1_f64'],
  ['besselJ', 'bessel_jn_f64'],
  ['besselY0', 'bessel_y0_f64'],
  ['besselY1', 'bessel_y1_f64'],
  ['besselY', 'bessel_yn_f64'],
  ['airyAi', 'airy_ai_f64'],
  ['airyBi', 'airy_bi_f64'],
  ['ellipticK', 'elliptic_k_f64'],
  ['ellipticE', 'elliptic_e_f64'],
  ['carlsonRC', 'carlson_rc_f64'],
  ['carlsonRD', 'carlson_rd_f64'],
  ['carlsonRF', 'carlson_rf_f64'],
  ['carlsonRJ', 'carlson_rj_f64'],
  ['ellipticF', 'elliptic_f_incomplete_f64'],
  ['ellipticEIncomplete', 'elliptic_e_incomplete_f64'],
  ['ellipticPi', 'elliptic_pi_incomplete_f64'],
])
  KERNEL_HOME[k] = 'assembly/src/special.ts';
KERNEL_HOME['matrix_multiply_simd_ptr'] = 'assembly/src/ops/matrix.ts';

const FAMILY_STANDALONE = {
  'arithmetic.elementwise': { state: 'existing', file: 'assembly/src/elementwise.ts' },
  'trigonometry.trig-variants': { state: 'existing', file: 'assembly/src/elementwise.ts' },
  'functions.special': { state: 'existing', file: 'assembly/src/special.ts' },
  'functions.cas-simplify': {
    state: 'blocked',
    reason: 'symbolic expression objects (host JS) — no f64/i32 kernel ABI',
  },
  'functions.cas-calculus': { state: 'blocked', reason: 'symbolic' },
  'functions.cas-solve': { state: 'blocked', reason: 'symbolic' },
  'functions.cas-transforms': { state: 'blocked', reason: 'symbolic' },
  'functions.cas-symbolic-core': { state: 'blocked', reason: 'symbolic' },
  'functions.cas-ode': { state: 'blocked', reason: 'symbolic' },
  'functions.combinatorics': {
    state: 'blocked',
    reason: 'bigint arithmetic has no AS kernel ABI today',
  },
  'functions.numbertheory': {
    state: 'blocked',
    reason: 'bigint modular arithmetic (f64 subsets like prime sieves could be candidates later)',
  },
  'statistics.descriptive': {
    state: 'candidate',
    note: 'pure f64 reductions — trivially import-free (precedent: assembly/src/ops/f64-buffer.ts), but measured not-worth-it for speed',
  },
  'statistics.distributions': {
    state: 'candidate',
    note: 'scalar PDF/CDF/quantile math is pure f64 — each is a ~40-line import-free kernel (precedent: assembly/src/ops/scalar.ts, 42 kernels)',
  },
  'statistics.hypothesis': { state: 'candidate', note: 'sort/dot inner loops are pure f64' },
  'statistics.regression-models': {
    state: 'candidate',
    note: 'normal equations are dense f64 matmul',
  },
  'statistics.clustering-distances': { state: 'candidate', note: 'distance loops are pure f64' },
  'statistics.random-sampling': {
    state: 'blocked',
    reason:
      'RNG state lives on the host; a kernel needs its own seeded stream (deterministic-mode mismatch)',
  },
  'statistics.timeseries-processes': {
    state: 'candidate',
    note: 'autocorrelation/Levinson loops are pure f64',
  },
  'statistics.doe-industrial': { state: 'candidate', note: 'small dense f64 math' },
  'statistics.data-cleaning': { state: 'candidate', note: 'sliding windows are pure f64' },
  'linalg.decompositions': {
    state: 'candidate',
    note: 'dense f64 factorization loops; AS kernels already exist (assembly/src/ops/linalg.ts is import-free; matrix kernels in ops/matrix.ts need one f64-buffer inline)',
  },
  'linalg.matrix-ops': { state: 'candidate', note: 'matvec/AXPY loops are pure f64' },
  'linalg.special-matrices': { state: 'candidate', note: 'construction loops are pure f64' },
  'matrix.sparse': { state: 'candidate', note: 'CSR SpMV is index+f64 math' },
  'tensor.core-operations': {
    state: 'candidate',
    note: 'elementwise/transpose kernels exist (assembly/src/ops/tensor.ts import-free; matmul kernels in ops/matrix.ts need f64-buffer inlined)',
  },
  'functions.array-creation': {
    state: 'candidate',
    note: 'fill kernels exist in assembly/src/ops/matrix.ts (dependent — imports f64-buffer; inline to make standalone)',
  },
  'functions.array-selection': { state: 'candidate', note: 'per-element compares are pure f64' },
  'functions.array-reductions': { state: 'existing', file: 'assembly/src/ops/f64-buffer.ts' },
  'functions.array-sorting': { state: 'existing', file: 'assembly/src/sort.ts' },
  'functions.array-reshaping': {
    state: 'candidate',
    note: 'memcpy-class; AS gains little but the kernels are trivial',
  },
  'functions.array-indexing': { state: 'candidate', note: 'gather/scatter index math' },
  'functions.list-functional': {
    state: 'blocked',
    reason: 'host JS closures cannot enter a kernel',
  },
  'functions.polynomials': {
    state: 'candidate',
    note: 'power-basis arithmetic is pure f64 (poly.ts exists but imports scaledDiagonalProduct — inline to make standalone)',
  },
  'functions.orthogonal-polynomials': { state: 'candidate', note: 'recurrences are pure f64' },
  'functions.quadrature': { state: 'blocked', reason: 'the integrand is a host JS callback' },
  'functions.ode': { state: 'blocked', reason: 'integrand callback + adaptive branching' },
  'functions.optimization': { state: 'blocked', reason: 'objective callback' },
  'functions.solve-blocks': { state: 'blocked', reason: 'callback-heavy front end' },
  'functions.interpolation': {
    state: 'candidate',
    note: 'tridiag_solve_f64 already exists import-free (assembly/src/tridiag.ts); evaluation kernels writable',
  },
  'functions.curve-fitting': {
    state: 'candidate',
    note: 'expfit/logfit/powerfit already import-free (assembly/src/ops/curvefit.ts); poly_fit_f64 exists in poly.ts (imports one helper)',
  },
  'functions.symbolic-regression': {
    state: 'blocked',
    reason: 'tree structures over host objects',
  },
  'functions.geometry': {
    state: 'candidate',
    note: 'distance/haversine math is pure f64; hulls/Delaunay need dynamic memory (harder)',
  },
  'functions.graphs': {
    state: 'blocked',
    reason:
      'pointer-chasing adjacency structures; an i32-index rewrite is a new kernel family, not a standalone file',
  },
  'signal.fft': { state: 'existing', file: 'assembly/src/ops/fft.ts' },
  'signal.filtering': { state: 'candidate', note: 'direct-form conv/correlate loops are pure f64' },
  'signal.filter-design': { state: 'candidate', note: 'small dense f64 algebra' },
  'signal.spectral': { state: 'existing', file: 'assembly/src/signal.ts' },
  'signal.windows-waveforms': {
    state: 'candidate',
    note: 'window fill is pure f64 (apply_window_f64 already import-free in assembly/src/signal.ts)',
  },
  'signal.wavelets-multirate': {
    state: 'candidate',
    note: 'filter-bank convolutions are pure f64',
  },
  'units.core-registry': { state: 'blocked', reason: 'Unit objects are host JS structures' },
  'numbers.intervals': { state: 'blocked', reason: 'interval/BigNumber host objects' },
  'numbers.machine-limits': { state: 'blocked', reason: 'scalar host conversions' },
  'expression.language': { state: 'blocked', reason: 'parser/tree structures' },
};

/** The names an AS declaration for one public function can take: the export itself
 * (`lgamma_f64`, `sort_f64`), the pointer kernel (`array_abs_ptr`), the i32 array
 * kernel (`bitAnd_i32_array`), or the plain snake name (`tridiag_solve_f64`). */
function kernelNameCandidates(name) {
  const snake = name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  return new Set([`array_${snake}_ptr`, `${snake}_i32_array`, name, `${snake}_f64`, `${name}_f64`]);
}

/** The import-free assembly/src file that defines a kernel for THIS function, or null.
 * Proof is the file's own `function`/`const` declarations (see `auditAssembly`), so a
 * family's kernels never stand in for a function it does not implement.
 *
 * The match is deliberately narrow, because a same-named AS helper is not always the
 * function's kernel: `ops/scalar.ts` holds two-argument scalar helpers (`min_f64`,
 * `max_f64`, `abs_f64`, `clamp_f64`) that a NAMED public array reduction (`min(A)`,
 * `abs(A)`) does not use, and `ops/array.ts` / `ops/matrix.ts` hold binary in-place
 * kernels behind the vectorised ops, not the public elementwise dispatch. Those three
 * files therefore only satisfy the `array_<op>_ptr` form, which IS the elementwise
 * pointer kernel the bridge calls. */
function kernelCoversFunction(name) {
  const scalarHelperFiles = new Set([
    'assembly/src/ops/scalar.ts',
    'assembly/src/ops/array.ts',
    'assembly/src/ops/matrix.ts',
  ]);
  const snake = name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  for (const [file, symbols] of assemblyAudit.symbols) {
    if (symbols.has(`array_${snake}_ptr`) || symbols.has(`${snake}_i32_array`)) return file;
    if (scalarHelperFiles.has(file)) continue;
    if (symbols.has(name) || symbols.has(`${snake}_f64`) || symbols.has(`${name}_f64`)) return file;
  }
  return null;
}

const entries = [];
for (const pkg of PACKAGES) {
  for (const { name, kind } of surfaces[pkg]) {
    const domain = sectionNames.get(name) ?? null;
    const family = familyOf(name, domain, pkg);
    // The Accel column documents the FUNCTIONS package surface; matrix/tensor
    // entries have their own API docs (docs/api/matrix.md, tensor.md), so a
    // same-named functions.md cell would be a false claim for them.
    const claim = pkg === 'functions' ? (claims.get(name) ?? null) : null;
    let pairing =
      pkg === 'functions'
        ? PAIRED_FUNCTIONS[name]
        : pkg === 'matrix'
          ? (MATRIX_PAIRINGS[name] ??
            (matrixWrapperSet.has(name)
              ? {
                  workpool: {
                    implemented: true,
                    default:
                      "workers (direct ComputePool API surface; each op gates per DEFAULT_THRESHOLD_BY_OP — most are 'never')",
                    path: `matrix/src/parallel-matrix.ts ${name} → computePool.*`,
                    evidence: [{ file: 'matrix/src/parallel-matrix.ts', anchor: `const ${name}` }],
                  },
                }
              : null))
          : (TENSOR_PAIRINGS[name] ?? null);

    const classification = classify(family, name, pairing, kind, pkg);
    let sa;
    const kernel = pairing?.wasm?.kernel;
    if (kind !== 'function')
      sa = { state: 'blocked', reason: 'not a function (constant/class/namespace)' };
    else if (kernel && KERNEL_HOME[kernel]) {
      const file = KERNEL_HOME[kernel];
      // `existing` needs the kernel DECLARED in that import-free file, not merely the
      // file to exist. `fused_chain` is a dispatch label, not a declaration: the chain
      // is a sequence of the file's `array_*_ptr` kernels, so it qualifies only when the
      // file declares those pointer kernels.
      const declared =
        assemblyAudit.symbols.get(file)?.has(kernel) ||
        (kernel === 'fused_chain' &&
          [...(assemblyAudit.symbols.get(file) ?? [])].some((n) => n.endsWith('_ptr')));
      sa =
        standaloneSet.has(file) && declared
          ? { state: 'existing', file }
          : {
              state: 'candidate',
              file,
              note: `kernel exists in ${file} but ${
                standaloneSet.has(file)
                  ? 'is not declared there as a callable export'
                  : 'that file imports helpers — inline them for an import-free standalone'
              }`,
            };
    } else if (pairing?.wasm?.implemented) {
      sa = {
        state: 'candidate',
        note: 'wasm path exists through bridge plumbing; a standalone copy of its kernel is writable',
      };
    } else {
      // No pairing kernel: `existing` must be PROVEN for THIS function. The old code
      // trusted FAMILY_STANDALONE, so every `arithmetic.elementwise` row claimed
      // `assembly/src/elementwise.ts` — including 242 rows no assembly file defines
      // (`add`, `multiply`, `acos`, `cumsum`, `besselI`, …). Ask the file's own symbol
      // table instead, and fall back to `candidate` with the true reason.
      const famSa = FAMILY_STANDALONE[family];
      const home = kernelCoversFunction(name, pkg);
      if (home) sa = { state: 'existing', file: home };
      else if (famSa && famSa.state === 'existing')
        sa = {
          state: 'candidate',
          note: `the ${family} family has import-free kernels in ${famSa.file}, but none defines \`${name}\` itself — a new import-free kernel is writable (family-level claim corrected)`,
        };
      else
        sa =
          famSa ??
          (family
            ? fallbackStandalone
            : {
                state: 'blocked',
                reason: 'non-numeric infrastructure (pool lifecycle, docs, constants)',
              });
    }

    // doc-vs-code mismatch per entry
    const mismatch = [];
    if (claim) {
      const t = claim.text;
      const wp = pairing?.workpool;
      const wpWired = wp?.implemented === true;
      if (/parallel/.test(t) && !wpWired && pkg === 'functions' && kind === 'function') {
        mismatch.push(
          /†/.test(t)
            ? `doc claims "${t}" (pool op 'never') but the Float64Array path never consults the pool at all — no computePool/shouldParallelize reference; the honest cell is "—"`
            : `doc claims "${t}" but the Float64Array path has no worker-pool reference (synchronous JS: f64Unary/f64Binary/matmulSequential/pairwise kernels)`
        );
      }
      if (
        /^—$/.test(t.trim()) &&
        !DOC_ACK_ALLOWLIST.has(name) &&
        Object.values(pairing ?? {}).some((v) => v?.implemented)
      ) {
        const backends = Object.entries(pairing)
          .filter(([, v]) => v?.implemented)
          .map(([k]) => k);
        mismatch.push(`doc claims "—" but ${backends.join(' + ')} implemented (under-claim)`);
      }
      if (
        /WASM/.test(t) &&
        !(pairing?.wasm?.implemented ?? false) &&
        !DOC_ACK_ALLOWLIST.has(name)
      ) {
        mismatch.push(`doc claims "${t}" but no WASM dispatch/policy entry was found for ${name}`);
      }
      if (/WASM/.test(t) && pairing?.wasm?.kernel) {
        const bm = bandMismatch(t, pairing.wasm.kernel);
        if (bm) mismatch.push(bm);
      }
    } else if (
      pairing &&
      pkg === 'functions' &&
      kind === 'function' &&
      !DOC_ACK_ALLOWLIST.has(name)
    ) {
      const backends = Object.entries(pairing)
        .filter(([, v]) => v?.implemented)
        .map(([k]) => k);
      if (backends.length)
        mismatch.push(
          `no Accel cell in docs/reference/functions.md but ${backends.join(' + ')} implemented (under-claim)`
        );
    }

    // ts_impl / as_impl / gpu_impl + dual-setup marking
    const defs = tsImpls.get(`${pkg}:${name}`) ?? [];
    const tsImpl = defs.length
      ? {
          file: defs[0].file,
          line: defs[0].line,
          ...(defs.length > 1
            ? { alternates: defs.slice(1).map((d) => `${d.file}:${d.line}`) }
            : {}),
        }
      : null;
    let asImpl = null;
    let asImplFromPairing = false;
    if (pairing?.wasm?.kernel && KERNEL_HOME[pairing.wasm.kernel]) {
      const f = KERNEL_HOME[pairing.wasm.kernel];
      asImplFromPairing = true;
      asImpl = {
        file: f,
        // `fused_chain` is the policy key for a SEQUENCE of pointer kernels, not a
        // declaration of its own: point at the first kernel the chain can run.
        line: asKernelLine(f, pairing.wasm.kernel),
        kernel: pairing.wasm.kernel,
        ...(pairing.wasm.kernel === 'fused_chain'
          ? {
              note: 'a dispatch label, not a declaration: the fused chain runs the file’s array_*_ptr kernels in wasm memory',
              dispatchKernels: [...(assemblyAudit.symbols.get(f) ?? [])].filter((n) =>
                n.endsWith('_ptr')
              ),
            }
          : {}),
        ...(pairing.wasm.kernelNote ? { note: pairing.wasm.kernelNote } : {}),
        importFree: standaloneSet.has(f),
      };
    } else if (sa.state === 'existing') {
      // A kernel this function reaches without a PAIRING kernel (e.g. `welchPSD`'s
      // `welch_psd_f64`): record it so the entry carries the same file:line proof its
      // `asStandalone` claim rests on. It does NOT make this a wasm dual pair — the
      // public path never loads the module — so `dualSetup` still keys off the pairing.
      const kernel = [...(assemblyAudit.symbols.get(sa.file) ?? [])].find((n) =>
        kernelNameCandidates(name).has(n)
      );
      asImpl = {
        file: sa.file,
        ...(kernel ? { line: asKernelLine(sa.file, kernel), kernel } : {}),
        note: kernel
          ? 'import-free standalone kernel that no public dispatch reaches (unpaired: the consumer path stays JS)'
          : 'the file is import-free but declares no kernel of its own for this export',
        importFree: true,
      };
    }
    const gpuImpl = pairing?.webgpu?.implemented
      ? (GPU_IMPLS[name] ?? { path: pairing.webgpu.path })
      : null;

    const dualSetup = {
      wasm: asImplFromPairing
        ? {
            state: 'existing',
            note:
              asImpl.importFree && asImpl.line
                ? 'TS reference/fallback + import-free AS kernel both exist; dispatch = bridge + wasmPolicyAllows band, fallback on null/miss'
                : `TS reference/fallback + AS kernel both exist, but the kernel file (${asImpl.file}) imports helpers — inline them for a standalone file; dispatch = bridge + policy band`,
          }
        : classification.wasm.cls === 'candidate' && kind === 'function'
          ? {
              state: 'recommended',
              note: 'write an import-free AS kernel alongside the TS reference; keep TS as the fallback/dispatch default',
            }
          : { state: 'none', reason: classification.wasm.reason },
      gpu: gpuImpl
        ? {
            state: 'existing',
            note: 'TS reference/fallback + WGSL/GPU path both exist; dispatch = enableGpu() opt-in + size threshold, never-throw null → TS fallback',
          }
        : classification.webgpu.cls === 'candidate' && kind === 'function'
          ? {
              state: 'recommended',
              note: 'a WGSL kernel is a candidate alongside the TS reference — requires a REAL_GPU-gated equivalence bench before wiring',
            }
          : { state: 'none', reason: classification.webgpu.reason },
    };

    entries.push({
      name,
      package: pkg,
      kind,
      domain,
      family,
      accelClaim: claim ? { text: claim.text, docLine: claim.line } : null,
      tsImpl,
      asImpl,
      gpuImpl,
      pairings: pairing ?? {},
      dualSetup,
      classification,
      asStandalone: sa,
      ...(mismatch.length ? { docMismatch: mismatch } : {}),
    });
  }
}

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------
const count = (sel) => entries.filter(sel).length;
const backendCounts = {};
for (const backend of ['wasm', 'workpool', 'webgpu']) {
  backendCounts[backend] = {};
  for (const cls of ['paired', 'candidate', 'not-worth-it', 'unsure'])
    backendCounts[backend][cls] = count((e) => e.classification[backend]?.cls === cls);
}
const standaloneCounts = {};
for (const s of ['existing', 'candidate', 'blocked', 'unsure'])
  standaloneCounts[s] = count((e) => e.asStandalone.state === s);

const entriesWithMismatch = entries.filter((e) => e.docMismatch?.length);
const dualCounts = {
  wasm: {},
  gpu: {},
};
for (const k of ['existing', 'recommended', 'none']) {
  dualCounts.wasm[k] = count((e) => e.dualSetup.wasm.state === k);
  dualCounts.gpu[k] = count((e) => e.dualSetup.gpu.state === k);
}
// AS kernels compiled into the binary but not called by any JS bridge (wiring backlog).
const unwiredAsKernels = [
  {
    file: 'assembly/src/ops/scalar.ts',
    importFree: standaloneSet.has('assembly/src/ops/scalar.ts'),
    kernels: 42,
    note: '42 import-free f64 scalar kernels (add/sub/mul/div/mod/neg/sqrt/pow/square/cube/cbrt/nthRoot/exp/expm1/log/log1p/log10/log2/sin/cos/tan/asin/acos/atan/atan2/sinh/cosh/tanh/asinh/acosh/atanh/abs/floor/ceil/round/trunc/sign/min/max/clamp/isNaN/isFinite) are exported from the AS entry (assembly/src/index.ts:34+) and compiled into mathts-as.wasm, but no JS bridge calls any of them — the public scalar paths are plain JS. Wiring backlog, not a pairing.',
  },
  {
    file: 'assembly/src/ops/bitwise.ts',
    importFree: standaloneSet.has('assembly/src/ops/bitwise.ts'),
    kernels: 7,
    note: 'bit*_i32_array kernels exist and the bridges reference them, but the policy keeps bitwise on JS (measured 2.4–3.3× slower) — wired-but-idle.',
  },
];

const summary = {
  generated: new Date().toISOString().split('T')[0],
  entryCount: entries.length,
  byPackage: Object.fromEntries(PACKAGES.map((p) => [p, surfaces[p].length])),
  mirrorCheck: {
    packages: MIRROR_PACKAGES,
    extrasOutsideFunctionsAndMatrix: mirrorExtras,
    note: 'linalg/signal/statistics are thin re-export packages; their export sets are contained in functions ∪ matrix, so their numeric hot paths are the entries above (verified at generation time)',
  },
  classificationCounts: backendCounts,
  asStandaloneCounts: standaloneCounts,
  dualSetupCounts: dualCounts,
  unwiredAsKernels,
  assemblyFiles: assemblyAudit,
  generatedPairingReports: {
    wasm: {
      total: wasmPairing.total,
      wasmRouted: wasmPairing.acceleratedCount,
      parallelOnly: wasmPairing.parallelOnlyCount,
      jsOnly: wasmPairing.jsOnlyCount,
      wasmEffective: wasmPairing.wasmEffectiveCount,
      jsFallback: wasmPairing.jsFallbackCount,
    },
    parallel: {
      total: parallelPairing.total,
      effective: parallelPairing.effectiveCount,
      disabled: parallelPairing.disabledCount,
      nonParallel: parallelPairing.nonParallelCount,
    },
    webgpu: {
      total: webgpuPairing.total,
      typedGpu: webgpuPairing.gpuAcceleratedCount,
      standaloneGpu: webgpuPairing.standaloneAcceleratedCount,
    },
  },
  mismatchCount: MISMATCHES.length,
  entriesWithMismatch: entriesWithMismatch.length,
  mismatches: MISMATCHES,
};

writeFileSync(
  join(HERE, 'inventory.json'),
  JSON.stringify({ summary, functions: entries }, null, 2) + '\n'
);
console.log(
  `inventory.json: ${entries.length} entries (functions ${surfaces.functions.length}, matrix ${surfaces.matrix.length}, tensor ${surfaces.tensor.length})`
);
console.log(
  'mirror extras (should be none):',
  mirrorExtras.length ? mirrorExtras.join(', ') : 'none'
);
console.log('classification:', JSON.stringify(backendCounts));
console.log('as_standalone:', JSON.stringify(standaloneCounts));
console.log('dualSetup:', JSON.stringify(dualCounts));
console.log(
  'assembly standalone/dependent:',
  assemblyAudit.standalone.length,
  '/',
  assemblyAudit.dependent.length
);
console.log('entries with docMismatch:', entriesWithMismatch.length);

// ---------------------------------------------------------------------------
// README.md — generated so counts can never drift from inventory.json
// ---------------------------------------------------------------------------
const pct = (n) => (100 * n) / entries.length;
const table = (rows) => rows.map((r) => `| ${r.join(' | ')} |`).join('\n');

const rankedCandidates = [
  {
    rank: 1,
    name: 'matmul (functions flat helper)',
    backend: 'wasm (route through backendManager GEMM) + workpool (≥ 7M multiply-adds)',
    gain: 'SIMD GEMM ≈ 2–4× vs the plain JS triple loop at flop count ≥ 13824 = 24³ (the matrix package ships and measures this path); pool fan-out ≤ 0.90× sequential at ≥ 192³ multiply-adds',
    why: 'the public `matmul(a, aRows, aCols, b, bCols)` helper runs `matmulSequential` (functions/src/typed/arithmetic.ts:3668) while the SAME operation is wasm-accelerated one layer down (DenseMatrix.multiply → backendManager). Wiring is a delegation, not a kernel.',
  },
  {
    rank: 2,
    name: 'Tensor.einsum / large tensor contractions',
    backend: 'wasm (decompose to GEMM via backendManager) · workpool for very large contractions',
    gain: 'O(n^k) contractions become GEMM calls: the ≥ 13824-flop SIMD threshold engages almost immediately; expect 2–4× per contraction pair',
    why: 'Tensor.matmul already routes through backendManager (tensor/src/Tensor.ts:1156); einsum does not — it is the highest-arithmetic-intensity export with no acceleration',
  },
  {
    rank: 3,
    name: 'lu / qr / cholesky (public DenseMatrix paths)',
    backend:
      'workpool at n ≳ 192 (matmul ≥ 7,077,888 multiply-adds, measured 0.90×); AS dense kernels exist but are opt-in only',
    gain: 'matmul-dominated factorizations inherit the measured pool matmul win; expected ≈ 1.1–1.5× at n ≥ 192, growing with n',
    why: 'public paths are pure JS (2026-07 audit); a decomposition-level A/B gate is the missing measurement',
  },
  {
    rank: 4,
    name: 'kmeans / dbscan / knn pairwise-distance phase',
    backend: 'wasm standalone distance kernels (import-free-writable)',
    gain: 'O(n²) distance work vs O(n) copy: wins grow with n; plausible ≥ 2× for n ≥ ~10⁴ points',
    why: 'distance loops are pure f64 (FAMILY candidate); distanceMatrix already proves the pool route; the wasm kernel is a ~40-line standalone',
  },
  {
    rank: 5,
    name: 'expensive-tail distribution/quantile batch overloads',
    backend:
      'wasm array drivers over the existing import-free scalar kernels (assembly/src/ops/scalar.ts, special.ts)',
    gain: 'erfc precedent 5–7× at n ≥ 1024 for continued-fraction scalars; applies to gammainc/betainc-class tails only',
    why: 'the scalar kernels already exist import-free; only an array driver + per-kernel decision-gate bench is missing',
  },
  {
    rank: 6,
    name: 'pageRank / eigenvectorCentrality (sparse matvec iterations)',
    backend: 'wasm CSR SpMV standalone kernel · workpool row fan-out',
    gain: 'O(iter·nnz) compute vs O(nnz) copy — wins at large nnz (≥ ~10⁶)',
    why: 'pointer-chasing in JS; SpMV is the classic sparse kernel; unmeasured — needs the A/B gate',
  },
  {
    rank: 7,
    name: 'large-n convolution (sync convolve / correlate)',
    backend: 'webgpu stencil/FFT kernel (candidate) · wasm not-worth-it (measured)',
    gain: 'GPU conv at n ≥ 1M samples; f32 acceptable for most filtering',
    why: 'same amortization economics as the FFT GPU win (2.2–3.4× measured); unmeasured for conv',
  },
  {
    rank: 8,
    name: 'fft2d / batched FFT on GPU',
    backend: 'webgpu (new kernel — extend fftGpuDispatch to row/column batches)',
    gain: 'log₂(n) passes amortize the upload per frame — the single-FFT GPU precedent (2.2–3.4×) carries to batches',
    why: 'STOCKHAM_WGSL exists but `fft2d` (`functions/src/matrix/fft.ts`) has no GPU dispatch today; frame-batching is new shader work, so this is a candidate, not a pairing',
  },
  {
    rank: 9,
    name: 'theilSen / kendallTau O(n²) statistics',
    backend: 'workpool fan-out over pairs',
    gain: 'embarrassingly parallel pairwise loop; useful at n ≥ ~5×10³ (O(n²) work beats 50k-element copy overhead)',
    why: 'pure f64 pairwise math; unmeasured — A/B gate first',
  },
  {
    rank: 10,
    name: 'Tensor elementwise ops',
    backend: 'wasm (reuse array_*_ptr kernels behind the measured bands)',
    gain: '1.35–5× in the measured bands (elementwise.bench), for free — the kernels and bridge already exist',
    why: 'Tensor stores Float64Array data; the elementwise bridge is one delegation away',
  },
  {
    rank: 11,
    name: 'CSR sparse solve / SpMV (SparseMatrix)',
    backend: 'wasm standalone',
    gain: 'large-nnz SpMV ≥ 2× plausible; index math is i32/f64 only',
    why: 'import-free-writable; unmeasured',
  },
  {
    rank: 12,
    name: 'interpn / regular-grid interpolation',
    backend: 'wasm standalone gather kernel',
    gain: 'gather is memory-bound — modest win, only at very large grids; unsure',
    why: 'pure f64 math but memory-bound class (measure first)',
  },
  {
    rank: 13,
    name: 'OLS/ridge normal equations for wide X',
    backend: 'wasm GEMM via backendManager · workpool fan-out',
    gain: 'XᵀX is a matmul — inherits the measured ≥ 13824-flop SIMD win for wide design matrices',
    why: 'today the regression paths hand-roll the accumulations in JS',
  },
  {
    rank: 14,
    name: 'global optimizers (multi-start fan-out)',
    backend: 'workpool',
    gain: 'embarrassingly parallel across starts; useful when each start costs ≥ ~ms',
    why: 'the objective must be serializable (closure source validation already exists for quad fan-out)',
  },
  {
    rank: 15,
    name: 'welch/bartlett PSD fused GPU pipeline',
    backend: 'webgpu (fuse windowing+FFT+accumulate on-device)',
    gain: 'unclear — the WASM version lost 4.0–4.6× on copy; only a fully-fused GPU pipeline could flip it',
    why: 'listed LAST because the measured evidence points against easy wins; requires f32-PSD accuracy validation',
  },
];

const readme = `# Optimization inventory — functions × backends

**Generated** by \`docs/superpowers/optimization/build-inventory.mjs\` (run \`bun run build\` + \`bun run docs:deps\` first). Do not edit \`inventory.json\` by hand — edit the script's curated tables and re-run. Generated: ${summary.generated}.

## What this is

One entry per exported function of \`@danielsimonjr/mathts-functions\` (${surfaces.functions.length} exports), plus the numeric surface of \`matrix\` (${surfaces.matrix.length}) and \`tensor\` (${surfaces.tensor.length}) — **${entries.length} entries**. \`linalg\`, \`signal\` and \`statistics\` are thin re-export packages whose export sets are contained in functions ∪ matrix (verified at generation time), so their hot paths are these entries.

Each entry records:

- **family** — the controlled vocabulary of \`docs/superpowers/classification/families.md\`;
- **pairings** — what is ACTUALLY implemented in code, per backend (\`wasm\` / \`workpool\` / \`webgpu\`), with \`file:line\` evidence and the default engagement (e.g. \`wasm (n ≥ 1024)\` vs \`js (bridge present; policy keeps JS)\`);
- **tsImpl / asImpl / gpuImpl** — the TypeScript reference path and the AssemblyScript / WebGPU implementation paths where they exist;
- **dualSetup** — whether the dual (TS reference + accelerator) setup exists, is recommended, or does not apply;
- **classification** — \`paired\` / \`candidate\` / \`not-worth-it\` / \`unsure\` per backend, with the measured evidence or the threshold reasoning;
- **asStandalone** — \`existing\` (path to an import-free assembly/src file), \`candidate\` (import-free-writable), or \`blocked\` (reason);
- **accelClaim + docMismatch** — what \`docs/reference/functions.md\` claims today and where that disagrees with the code.

## Counts

Backend × classification (of ${entries.length} entries):

| Backend | paired | candidate | not-worth-it | unsure |
| --- | --: | --: | --: | --: |
${table([
  [
    'wasm',
    backendCounts.wasm.paired,
    backendCounts.wasm.candidate,
    backendCounts.wasm['not-worth-it'],
    backendCounts.wasm.unsure,
  ],
  [
    'workpool',
    backendCounts.workpool.paired,
    backendCounts.workpool.candidate,
    backendCounts.workpool['not-worth-it'],
    backendCounts.workpool.unsure,
  ],
  [
    'webgpu',
    backendCounts.webgpu.paired,
    backendCounts.webgpu.candidate,
    backendCounts.webgpu['not-worth-it'],
    backendCounts.webgpu.unsure,
  ],
])}

"paired" = an implementation for that backend exists in code. Some paired rows engage **never by default** (threshold \`'never'\` or a missing \`wasmPolicyAllows\` entry) — the entry's \`pairings.<backend>.default\` states which; those are wired-but-idle, kept so a threshold retune or \`overrideWasmPolicy\` can switch them on without code churn.

## Dual-setup contract (TS reference + accelerator)

${dualCounts.wasm.existing} entries have an existing wasm dual (TS + AS), ${dualCounts.wasm.recommended} are recommended to get one, ${dualCounts.gpu.existing} have an existing WebGPU dual, ${dualCounts.gpu.recommended} are recommended for one.

Every dual pair carries two obligations:

1. **Equivalence test.** The accelerator and the TS reference must be proven to agree — same results within the stated tolerance — before the pair ships:
   - WASM (f64): bit-identical is the bar for deterministic mode (\`DETERMINISTIC_WASM\` in \`functions/src/wasm/policy.ts\` pins exactly which kernels qualify — today only \`array_abs_ptr\`); everything else is validated element by element — **1e-9 absolute** for the elementwise suite (\`functions/tests/elementwise-wasm.browser.test.ts:115\`), **1e-12 relative** for the special/interpolation/signal suites (\`special-as-wasm.test.ts:116\`, \`interpolation-as-wasm.test.ts:66\`, \`signal-as-wasm.test.ts:71\`; the Airy kernels assert 1e-9) against the JS path or mpmath (precedent: \`functions/tests/diff-special.test.mjs\`, whose golden \`target_rel\` is 1e-9).
   - WebGPU (f32): tolerance comes from the WGSL spec, not from a dev card — \`sin\`/\`cos\` are only promised 2⁻¹¹ absolute; use the adapter-gated \`F32_REL_TOL\` / \`PEAK_REL_TOL\` helpers and gate perf assertions on \`REAL_GPU\` (\`F32_REL_TOL\`/\`REAL_GPU\` in \`functions/tests/helpers/gpu-hardware.ts\`; \`PEAK_REL_TOL\` in \`functions/tests/gpu-fft.browser.test.ts\`). WGSL leaves \`log(x<=0)\`, \`atanh(|x|>=1)\` and division by zero indeterminate — guard them or the GPU disagrees with JS.
   - A validation error does NOT throw on the GPU: it invalidates the command buffer and the zero-initialized staging buffer reads back as zeros. Every GPU entry point must check error scopes and funnel through the shared \`serializeGpu\`.
2. **Dispatch rules.** The doc must state when the accelerated path is used: the \`loadWasm()\` gate + \`wasmPolicyAllows(kernel, n)\` band for WASM; \`enableGpu()\` opt-in + size threshold (\`GPU_MIN_ELEMENTS\` 65 536; FFT 262 144) + device/adapter availability for WebGPU; and the never-throw \`null\` → TS-fallback contract in every case.

## as_standalone — import-free AssemblyScript files

${assemblyAudit.standalone.length} of the ${assemblyAudit.standalone.length + assemblyAudit.dependent.length} files under \`assembly/src/\` are import-free (no \`import\`, no \`export … from\`) and compile directly to WASM: ${assemblyAudit.standalone.map((f) => '`' + f + '`').join(', ')}.

The ${assemblyAudit.dependent.length} dependent files (and what blocks them): ${assemblyAudit.dependent.map((f) => '`' + f + '`').join(', ')} — each imports small f64 helpers (\`ops/f64-buffer.ts\`) or \`algebra/diagonal-product.ts\`; inlining those helpers makes them standalone.

Counts across entries: ${standaloneCounts.existing} existing (an import-free kernel already covers the function), ${standaloneCounts.candidate} candidate (import-free-writable), ${standaloneCounts.blocked} blocked, ${standaloneCounts.unsure} unsure.

\`existing\` is a per-function claim: the cited file must DECLARE that function's kernel (its \`array_<op>_ptr\` pointer kernel, its \`<op>_i32_array\` kernel, or its \`<op>_f64\` / export-named kernel). A family whose file has kernels does not make its other members \`existing\` — they are \`candidate\` with a note saying the family file exists but does not define them. This replaces the earlier family-level assignment, which claimed 284 \`existing\` where only 86 of the cited files actually define the function (all 77 \`arithmetic.elementwise\` rows pointed at \`elementwise.ts\`, which has no \`add\`/\`multiply\`/\`sqrt\` kernel).

**Unwired AS kernels (wiring backlog):**
${unwiredAsKernels.map((k) => `- \`${k.file}\` (${k.kernels} kernels): ${k.note}`).join('\n')}

## Ranked candidate list (highest expected gain first)

${rankedCandidates.map((c) => `${c.rank}. **${c.name}** — ${c.backend} · Expected gain: ${c.gain} · Why: ${c.why}`).join('\n\n')}

## Doc-vs-code mismatches found

${MISMATCHES.map((m) => `- **${m.id} (${m.severity})** ${m.doc}\n  - Docs claim: ${m.claim}\n  - Code says: ${m.actual}\n  - Fix: ${m.fix}`).join('\n')}

Entry-level mismatches (per-function Accel-cell errors) are recorded on the entries themselves (\`docMismatch\`); ${entriesWithMismatch.length} entries carry at least one.

## Relationship to the generated pairing reports

The \`docs/Architecture/{wasm,parallel,webgpu}-pairing.{md,json}\` reports (generated by \`bun run docs:deps\`, not committed) are the starting point but were NOT trusted: this inventory re-verifies routing against source anchors and records where the generator under/over-reports (mismatches M2, M6, M7, M8, M16). The generated reports are regenerated on every \`docs:deps\` run, so they always match the code AS THE DETECTOR SEES IT — the mismatches above are detector limitations, not stale output.

### What the challenger changed (review of this inventory)

- **\`asStandalone\` is now audited per function** (M12). The first draft assigned \`existing\` from the entry's FAMILY, so 284 rows claimed an import-free kernel; only 86 cited a file that actually declares that function's kernel. The rest are now \`candidate\` with a note naming the family file.
- **The matrix WASM threshold is read from \`matrix/src/config.ts\`** (M11). Every \`256\` became the measured \`13 824 = 24³\` of #1420, and the two \`paired\` matrix rows cite \`multiply: 13_824\` instead of the bare \`256\`.
- **\`pow\` and \`matrix.multiply\` now carry a real \`asImpl\` and \`dualSetup.wasm: existing\`** (M13, M15). \`pow\`'s \`kernel\` was \`matrix_multiply_simd_ptr (matrix backend, …)\`, a string no \`KERNEL_HOME\` key matched.
- **\`atanh\`'s evidence path is \`trigonometry.ts\`**, not \`arithmetic.ts\` (the dispatch anchor did not resolve).
- **A new mismatch (M16)** records that the generated \`parallel-pairing.md\` lists \`parallelStat*\` helpers as pool-effective although \`statistics.ts\` has no \`applyKernel\` call.
- **Verified, not changed:** the generator is reproducible byte-for-byte; the class counts (wasm 47/161/1064/347, workpool 67/211/1082/259, webgpu 8/41/1126/444) and \`dualSetup\` (wasm 47 existing after M13/M15, wasm 161 recommended, gpu 8 existing, gpu 41 recommended) match the code; every \`paired\` row's evidence anchors resolve to a real \`file:line\`; all 8 WebGPU pairings dispatch through the named \`*GpuDispatch\`; the \`policy.ts\` bands in the generator equal \`WASM_DISPATCH_POLICY\`; and \`docs:functions:check\` passes.
`;

writeFileSync(join(HERE, 'README.md'), readme);
console.log('README.md written');

// Keep the generated artifacts prettier-clean (CI runs `prettier --check` on every file).
try {
  execSync('npx prettier --write inventory.json README.md build-inventory.mjs', {
    cwd: HERE,
    stdio: 'pipe',
  });
} catch (e) {
  console.error('prettier pass failed (non-fatal):', String(e.stdout ?? e));
}
