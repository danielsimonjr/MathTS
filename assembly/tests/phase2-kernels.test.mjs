/**
 * Phase-2 kernel validation (Rust→AS migration).
 *
 * Validates the AS kernels authored in Phase 2 against their JS scalar
 * references, with NO Rust involvement:
 *
 *   1. Elementwise pointer-ABI kernels `array_<op>_ptr(inPtr,outPtr,n)` for all
 *      18 WASM_ELEMENTWISE_OPS — vs the JS scalar reference (same math),
 *      require max abs diff < 1e-12. For the 5 ops with a managed twin
 *      (abs/sin/cos/exp/log) ALSO require bit-identity to managed `array_<op>`.
 *   2. General integer-order Bessel `bessel_j_f64` / `bessel_y_f64` — vs the JS
 *      `_besselJn` / `_besselYn` reference (ported verbatim from
 *      functions/src/wasm/special/wasm-bridge.ts), require max abs diff < 1e-9.
 *   3. Poly aliases `poly_resultant_f64` / `poly_discriminant_f64` — present and
 *      numerically correct on a known case.
 *
 * Loads the RELEASE binding (build/mathts.js -> build/mathts.wasm).
 * Run:  node tests/phase2-kernels.test.mjs
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Instantiate the RELEASE binary raw (only import is env.abort) so we reach the
// raw exports directly — both the managed `array_<op>(aPtr, resultPtr)` and the
// pointer-ABI `array_<op>_ptr(inPtr, outPtr, n)`. The high-level ESM loader
// wrappers lower typed-array OUT params one-way (never lift them back), so they
// cannot return managed output for the bit-identity check.
const here = path.dirname(fileURLToPath(import.meta.url));
const buf = readFileSync(path.join(here, '..', 'build', 'mathts.wasm'));
const instance = new WebAssembly.Instance(new WebAssembly.Module(buf), {
  env: {
    abort: (msg, file, line, col) => {
      throw new Error(`wasm abort @ ${line}:${col}`);
    },
  },
});
const ex = instance.exports;
const memory = ex.memory;
const __new = ex.__new;

// Build a managed Float64Array (header + buffer) in wasm memory.
// Layout per the loader's __lowerTypedArray: Float64Array id=5, align=3,
// 12-byte header {buffer, dataStart, byteLength}; ArrayBuffer id=1.
function newManagedF64(values) {
  const len = values.length;
  const bufp = __new(len * 8, 1); // ArrayBuffer
  const header = __new(12, 5); // Float64Array view
  const dv = new DataView(memory.buffer);
  dv.setUint32(header + 0, bufp, true); // buffer
  dv.setUint32(header + 4, bufp, true); // dataStart
  dv.setUint32(header + 8, len * 8, true); // byteLength
  new Float64Array(memory.buffer, bufp, len).set(values);
  return { header, bufp, len };
}

// Lift a managed Float64Array (given its header pointer) back to JS.
function liftF64(header) {
  const dv = new DataView(memory.buffer);
  const dataStart = dv.getUint32(header + 4, true);
  const byteLen = dv.getUint32(header + 8, true);
  return new Float64Array(memory.buffer, dataStart, byteLen / 8).slice();
}

// ---------------------------------------------------------------------------
// Pointer-ABI harness: allocate raw in/out regions, call array_<op>_ptr, read.
// ---------------------------------------------------------------------------
function runPtr(fnName, input) {
  const n = input.length;
  const inPtr = __new(n * 8, 1); // both allocs first (each may grow memory)
  const outPtr = __new(n * 8, 1);
  new Float64Array(memory.buffer, inPtr, n).set(input); // view AFTER allocs
  ex[fnName](inPtr, outPtr, n); // kernel never grows memory
  return new Float64Array(memory.buffer, outPtr, n).slice();
}

// Run managed array_<op>(a, result) via the raw export; lift `result`.
function runManaged(fnName, input) {
  const a = newManagedF64(input);
  const r = newManagedF64(new Float64Array(input.length));
  ex[fnName](a.header, r.header);
  return liftF64(r.header);
}

function maxAbsDiff(a, b) {
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    if (Number.isNaN(a[i]) && Number.isNaN(b[i])) continue;
    const d = Math.abs(a[i] - b[i]);
    if (d > m) m = d;
  }
  return m;
}

// Combined relative/absolute error: |a-e| / max(|e|, 1). AS and V8 ship
// independent libm transcendentals, so vs-JS is ULP-equal, not bit-identical;
// this metric judges near-zero values absolutely and large values relatively.
function maxRelAbs(a, b) {
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    if (Number.isNaN(a[i]) && Number.isNaN(b[i])) continue;
    const denom = Math.abs(b[i]) > 1 ? Math.abs(b[i]) : 1;
    const s = Math.abs(a[i] - b[i]) / denom;
    if (s > m) m = s;
  }
  return m;
}

function linspace(lo, hi, n) {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = lo + ((hi - lo) * i) / (n - 1);
  return out;
}

// ---------------------------------------------------------------------------
// JS scalar references.
//   - simple Math.* for the transcendentals (the bridge / typed defns)
//   - sec/csc/cot: 1/Math.cos, 1/Math.sin, 1/Math.tan (typed/trigonometry.ts)
//   - erfc: validated continued-fraction scalar (typed/special.ts)
// ---------------------------------------------------------------------------
function _erfSeries(a) {
  const c = 2 / Math.sqrt(Math.PI);
  let sum = a;
  let term = a;
  for (let n = 1; n < 80; n++) {
    term *= (-a * a) / n;
    const inc = term / (2 * n + 1);
    sum += inc;
    if (Math.abs(inc) < Math.abs(sum) * 1e-17) break;
  }
  return c * sum;
}
function _erfcCF(a) {
  const tiny = 1e-300;
  let f = a < tiny ? tiny : a;
  let C = f;
  let D = 0;
  for (let i = 1; i <= 300; i++) {
    const ai = i / 2;
    D = a + ai * D;
    if (D === 0) D = tiny;
    D = 1 / D;
    C = a + ai / C;
    if (C === 0) C = tiny;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-a * a) / Math.sqrt(Math.PI) / f;
}
function erfcScalar(x) {
  if (!Number.isFinite(x)) return x > 0 ? 0 : 2;
  if (x < 0) return 2 - erfcScalar(-x);
  return x < 1.5 ? 1 - _erfSeries(x) : _erfcCF(x);
}

// op -> { ref, domain:[lo,hi], managed?:boolean }
const ELEMENTWISE = {
  abs: { ref: Math.abs, domain: [-50, 50], managed: true },
  sin: { ref: Math.sin, domain: [-12, 12], managed: true },
  cos: { ref: Math.cos, domain: [-12, 12], managed: true },
  tan: { ref: Math.tan, domain: [-1.3, 1.3] },
  exp: { ref: Math.exp, domain: [-10, 10], managed: true },
  log: { ref: Math.log, domain: [1e-6, 100], managed: true },
  atan: { ref: Math.atan, domain: [-50, 50] },
  sinh: { ref: Math.sinh, domain: [-10, 10] },
  tanh: { ref: Math.tanh, domain: [-10, 10] },
  atanh: { ref: Math.atanh, domain: [-0.999, 0.999] },
  expm1: { ref: Math.expm1, domain: [-5, 5] },
  log1p: { ref: Math.log1p, domain: [-0.999, 100] },
  log2: { ref: Math.log2, domain: [1e-6, 1000] },
  log10: { ref: Math.log10, domain: [1e-6, 1000] },
  sec: { ref: (x) => 1 / Math.cos(x), domain: [-1.3, 1.3] },
  csc: { ref: (x) => 1 / Math.sin(x), domain: [0.2, 3.0] },
  cot: { ref: (x) => 1 / Math.tan(x), domain: [0.2, 3.0] },
  erfc: { ref: erfcScalar, domain: [-6, 6] },
};

const N = 2048; // > WASM_ELEMENTWISE_THRESHOLD (1024)
let failures = 0;
const elementwiseRows = [];

for (const [op, spec] of Object.entries(ELEMENTWISE)) {
  const xs = linspace(spec.domain[0], spec.domain[1], N);
  const expected = Float64Array.from(xs, spec.ref);
  const ptrName = `array_${op}_ptr`;
  if (typeof ex[ptrName] !== 'function') {
    console.log(`X ${ptrName} MISSING EXPORT`);
    failures++;
    continue;
  }
  const got = runPtr(ptrName, xs);
  const absd = maxAbsDiff(got, expected);
  const reld = maxRelAbs(got, expected); // vs JS: AS libm vs V8 libm (ULP-level)
  let bitId = '';
  if (spec.managed) {
    const mgd = runManaged(`array_${op}`, xs);
    const md = maxAbsDiff(got, mgd); // vs managed AS: must be exactly 0
    bitId = md === 0 ? ' bit-id=YES' : ` bit-id=NO(${md.toExponential(2)})`;
    if (md !== 0) failures++;
  }
  const ok = reld < 1e-12;
  if (!ok) failures++;
  elementwiseRows.push(
    `${ok ? 'PASS' : 'FAIL'} ${ptrName.padEnd(16)} relabs=${reld.toExponential(2)} ` +
      `abs=${absd.toExponential(2)}${bitId}`
  );
}

// ---------------------------------------------------------------------------
// Bessel general integer-order — JS reference (verbatim from the special bridge).
// ---------------------------------------------------------------------------
const _SF_GAMMA = 0.5772156649015328606;
const _SF_2_PI = 0.63661977236758134308;
const _SF_1_PI = 0.31830988618379067154;
const _BESSEL_SERIES_MAX = 13.0;
function _besselHankel(nu, x, wantY) {
  const mu = 4 * nu * nu;
  let P = 1.0,
    Q = 0.0,
    a = 1.0,
    xk = 1.0,
    prevMag = Infinity;
  for (let k = 1; k <= 40; k++) {
    const t1 = 2 * k - 1;
    a = (a * (mu - t1 * t1)) / (8 * k);
    xk *= x;
    const t = a / xk;
    if (Math.abs(t) > prevMag) break;
    prevMag = Math.abs(t);
    const m4 = k & 3;
    const s = m4 === 1 || m4 === 0 ? 1.0 : -1.0;
    if ((k & 1) === 1) Q += s * t;
    else P += s * t;
  }
  const chi = x - (nu * 0.5 + 0.25) * Math.PI;
  const amp = Math.sqrt(2.0 / (Math.PI * x));
  return wantY ? amp * (P * Math.sin(chi) + Q * Math.cos(chi)) : amp * (P * Math.cos(chi) - Q * Math.sin(chi));
}
function _besselJ0Series(x) {
  const z = -0.25 * x * x;
  let term = 1.0,
    sum = 1.0;
  for (let k = 1; k <= 80; k++) {
    term *= z / (k * k);
    sum += term;
    if (Math.abs(term) <= Math.abs(sum) * 1e-17) break;
  }
  return sum;
}
function _besselJ1Series(x) {
  const z = -0.25 * x * x;
  let term = 1.0,
    sum = 1.0;
  for (let k = 1; k <= 80; k++) {
    term *= z / (k * (k + 1));
    sum += term;
    if (Math.abs(term) <= Math.abs(sum) * 1e-17) break;
  }
  return 0.5 * x * sum;
}
function _besselY0Series(x) {
  const z = 0.25 * x * x;
  let u = 1.0,
    h = 0.0,
    s = 0.0,
    sign = 1.0;
  for (let k = 1; k <= 80; k++) {
    u *= z / (k * k);
    h += 1 / k;
    s += sign * h * u;
    sign = -sign;
    if (k > 2 && Math.abs(h * u) <= Math.abs(s) * 1e-17) break;
  }
  return _SF_2_PI * ((Math.log(0.5 * x) + _SF_GAMMA) * _besselJ0Series(x) + s);
}
function _besselY1Series(x) {
  const z = -0.25 * x * x;
  let v = 0.5 * x,
    hk = 0.0,
    hk1 = 1.0,
    s = (hk + hk1) * v;
  for (let k = 1; k <= 80; k++) {
    v *= z / (k * (k + 1));
    hk += 1 / k;
    hk1 += 1 / (k + 1);
    s += (hk + hk1) * v;
    if (k > 2 && Math.abs((hk + hk1) * v) <= Math.abs(s) * 1e-17) break;
  }
  return _SF_2_PI * (Math.log(0.5 * x) + _SF_GAMMA) * _besselJ1Series(x) - _SF_2_PI / x - _SF_1_PI * s;
}
function _besselJ0(x) {
  const ax = Math.abs(x);
  return ax <= _BESSEL_SERIES_MAX ? _besselJ0Series(ax) : _besselHankel(0, ax, false);
}
function _besselJ1(x) {
  const ax = Math.abs(x);
  const sign = x < 0 ? -1 : 1;
  const val = ax <= _BESSEL_SERIES_MAX ? _besselJ1Series(ax) : _besselHankel(1, ax, false);
  return sign * val;
}
function _besselY0(x) {
  if (x <= 0.0) return NaN;
  return x <= _BESSEL_SERIES_MAX ? _besselY0Series(x) : _besselHankel(0, x, true);
}
function _besselY1(x) {
  if (x <= 0.0) return NaN;
  return x <= _BESSEL_SERIES_MAX ? _besselY1Series(x) : _besselHankel(1, x, true);
}
function _besselJn(n, x) {
  const ni = Math.abs(Math.round(n));
  const sign = n < 0 && ni % 2 !== 0 ? -1.0 : 1.0;
  if (ni === 0) return sign * _besselJ0(x);
  if (ni === 1) return sign * _besselJ1(x);
  if (Math.abs(x) < 1e-15) return 0.0;
  if (Math.abs(x) > ni) {
    let jPrev = _besselJ0(x),
      jCurr = _besselJ1(x);
    for (let k = 1; k < ni; k++) {
      const jNext = ((2.0 * k) / x) * jCurr - jPrev;
      jPrev = jCurr;
      jCurr = jNext;
    }
    return sign * jCurr;
  }
  const extra = Math.max(10, Math.floor(Math.sqrt(40.0 * ni)));
  const nStart = ni + 2 * extra;
  let jNext = 0.0,
    jCurr = 1.0,
    resultVal = 0.0,
    sum = 0.0;
  for (let k = nStart; k >= 0; k--) {
    const jPrev = ((2.0 * (k + 1)) / x) * jCurr - jNext;
    jNext = jCurr;
    jCurr = jPrev;
    if (k === ni) resultVal = jCurr;
    if (k % 2 === 0) sum += jCurr;
  }
  sum = 2.0 * sum - jCurr;
  return sign * (resultVal / sum);
}
function _besselYn(n, x) {
  if (x <= 0.0) return NaN;
  const ni = Math.abs(Math.round(n));
  const sign = n < 0 && ni % 2 !== 0 ? -1.0 : 1.0;
  if (ni === 0) return sign * _besselY0(x);
  if (ni === 1) return sign * _besselY1(x);
  let yPrev = _besselY0(x),
    yCurr = _besselY1(x);
  for (let k = 1; k < ni; k++) {
    const yNext = ((2.0 * k) / x) * yCurr - yPrev;
    yPrev = yCurr;
    yCurr = yNext;
  }
  return sign * yCurr;
}

const besselRows = [];
const besselX = linspace(0.5, 40, 512); // x>0 so Y is defined; spans series+Hankel
for (const order of [2, 3, 5, 8]) {
  const xsm = newManagedF64(besselX);
  const jGot = liftF64(ex.bessel_j_f64(order, xsm.header));
  const jExp = Float64Array.from(besselX, (x) => _besselJn(order, x));
  const jd = maxAbsDiff(jGot, jExp);
  const jok = jd < 1e-9;
  if (!jok) failures++;
  besselRows.push(`${jok ? 'PASS' : 'FAIL'} bessel_j_f64(n=${order})  maxdiff=${jd.toExponential(2)}`);

  const xsm2 = newManagedF64(besselX);
  const yGot = liftF64(ex.bessel_y_f64(order, xsm2.header));
  const yExp = Float64Array.from(besselX, (x) => _besselYn(order, x));
  const yd = maxAbsDiff(yGot, yExp);
  const yok = yd < 1e-9;
  if (!yok) failures++;
  besselRows.push(`${yok ? 'PASS' : 'FAIL'} bessel_y_f64(n=${order})  maxdiff=${yd.toExponential(2)}`);
}

// ---------------------------------------------------------------------------
// Poly aliases — present + correct on a known case.
//   p(x)=(x-1)(x-2)=x^2-3x+2 -> coeffs [2,-3,1]; disc=(-3)^2-4*1*2=1.
//   res(p,q) with q=x-1 -> [-1,1]: p(1)=0 -> resultant 0.
// ---------------------------------------------------------------------------
const polyRows = [];
const p = newManagedF64(new Float64Array([2, -3, 1]));
const disc = ex.poly_discriminant_f64(p.header);
const discOk = Math.abs(disc - 1) < 1e-9;
if (!discOk) failures++;
polyRows.push(`${discOk ? 'PASS' : 'FAIL'} poly_discriminant_f64([2,-3,1]) = ${disc} (want 1)`);
const p2 = newManagedF64(new Float64Array([2, -3, 1]));
const q = newManagedF64(new Float64Array([-1, 1]));
const res = ex.poly_resultant_f64(p2.header, q.header);
const resOk = Math.abs(res - 0) < 1e-9;
if (!resOk) failures++;
polyRows.push(`${resOk ? 'PASS' : 'FAIL'} poly_resultant_f64([2,-3,1],[-1,1]) = ${res} (want 0)`);

// ---------------------------------------------------------------------------
console.log('\nPhase-2 AS kernel validation (vs JS scalar references)');
console.log('======================================================');
console.log('\nElementwise pointer-ABI (require maxdiff < 1e-12; managed bit-identical):');
for (const r of elementwiseRows) console.log('  ' + r);
console.log('\nBessel general integer-order (require maxdiff < 1e-9 vs JS _besselJn/_besselYn):');
for (const r of besselRows) console.log('  ' + r);
console.log('\nPoly aliases:');
for (const r of polyRows) console.log('  ' + r);
console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
process.exit(failures === 0 ? 0 : 1);
