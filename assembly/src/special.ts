/**
 * Bessel J/Y and Airy Ai/Bi functions — AssemblyScript parity port.
 *
 * Mirrors the algorithms in:
 *   wasm-rust/crates/mathts-wasm/src/special/functions.rs  (Bessel scalars)
 *   wasm-rust/crates/mathts-wasm/src/bessel.rs             (array kernels)
 *   wasm-rust/crates/mathts-wasm/src/special/functions.rs  (Airy scalars)
 *
 * All exported functions accept / return Float64Array and use the same
 * typed-array calling convention as the other AS kernels (tridiag.ts, poly.ts).
 *
 * Bessel approximation accuracy:
 *   J0/J1:  ~1e-7 relative error (NR §6.5 polynomial, |x| < 8)
 *   Y0/Y1:  ~1e-4 relative error near x=1 (larger near the log singularity)
 *
 * Airy approximation accuracy:
 *   |x| ≤ 4.5 (power series):  ~1e-10 relative error
 *   |x| > 4.5 (asymptotic):    ~1e-7 relative error
 *
 * Slice 4.9 — companion to Slice 3.10c-1.
 */

// ---------------------------------------------------------------------------
// Bessel J0 scalar
// ---------------------------------------------------------------------------

function _besselJ0(x: f64): f64 {
  const ax: f64 = Math.abs(x);
  if (ax < 8.0) {
    const y: f64 = ax * ax;
    const ans1: f64 =
      57568490574.0 +
      y *
        (-13362590354.0 +
          y * (651619640.7 + y * (-11214424.18 + y * (77392.33017 + y * -184.9052456))));
    const ans2: f64 =
      57568490411.0 +
      y * (1029532985.0 + y * (9494680.718 + y * (59272.64853 + y * (267.8532712 + y))));
    return ans1 / ans2;
  }
  const z: f64 = 8.0 / ax;
  const y: f64 = z * z;
  const xx: f64 = ax - 0.785398164;
  const ans1: f64 =
    1.0 +
    y *
      (-0.001098628627 +
        y * (0.00002734510407 + y * (-0.000002073370639 + y * 0.0000002093887211)));
  const ans2: f64 =
    -0.01562499995 +
    y *
      (0.0001430488765 +
        y * (-0.000006911147651 + y * (0.0000007621095161 - y * 0.0000000934935152)));
  return Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * ans1 - z * Math.sin(xx) * ans2);
}

// ---------------------------------------------------------------------------
// Bessel J1 scalar
// ---------------------------------------------------------------------------

function _besselJ1(x: f64): f64 {
  const sign: f64 = x < 0.0 ? -1.0 : 1.0;
  const ax: f64 = Math.abs(x);
  if (ax < 8.0) {
    const y: f64 = ax * ax;
    const ans1: f64 =
      ax *
      (72362614232.0 +
        y *
          (-7895059235.0 +
            y * (242396853.1 + y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))));
    const ans2: f64 =
      144725228442.0 +
      y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
    return (sign * ans1) / ans2;
  }
  const z: f64 = 8.0 / ax;
  const y: f64 = z * z;
  const xx: f64 = ax - 2.356194491;
  const ans1: f64 =
    1.0 +
    y * (0.00183105 + y * (-0.00003516396496 + y * (0.000002457520174 - y * 0.0000002404127372)));
  const ans2: f64 =
    0.04687499995 +
    y *
      (-0.0002002690873 +
        y * (0.000008449199096 + y * (-0.0000008820898866 + y * 0.0000001057874125)));
  return sign * Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * ans1 - z * Math.sin(xx) * ans2);
}

// ---------------------------------------------------------------------------
// Bessel Y0 scalar (x > 0)
// ---------------------------------------------------------------------------

function _besselY0(x: f64): f64 {
  if (x <= 0.0) return NaN;
  if (x < 8.0) {
    const y: f64 = x * x;
    const ans1: f64 =
      -2957821389.0 +
      y *
        (7062834065.0 +
          y * (-512359803.6 + y * (10879881.29 + y * (-86327.92757 + y * 228.4622733))));
    const ans2: f64 =
      40076544269.0 +
      y * (745249964.8 + y * (7189466.438 + y * (47447.2647 + y * (226.1030244 + y))));
    return ans1 / ans2 + 0.636619772 * _besselJ0(x) * Math.log(x);
  }
  const z: f64 = 8.0 / x;
  const y: f64 = z * z;
  const xx: f64 = x - 0.785398164;
  const ans1: f64 =
    1.0 +
    y *
      (-0.001098628627 +
        y * (0.00002734510407 + y * (-0.000002073370639 + y * 0.0000002093887211)));
  const ans2: f64 =
    -0.01562499995 +
    y *
      (0.0001430488765 +
        y * (-0.000006911147651 + y * (0.0000007621095161 - y * 0.0000000934935152)));
  return Math.sqrt(0.636619772 / x) * (Math.sin(xx) * ans1 + z * Math.cos(xx) * ans2);
}

// ---------------------------------------------------------------------------
// Bessel Y1 scalar (x > 0)
// ---------------------------------------------------------------------------

function _besselY1(x: f64): f64 {
  if (x <= 0.0) return NaN;
  if (x < 8.0) {
    const y: f64 = x * x;
    const ans1: f64 =
      x *
      (-4900604943000.0 +
        y *
          (1275274390000.0 +
            y * (-51534381390.0 + y * (734926455.1 + y * (-4237922.726 + y * 8511.937935)))));
    const ans2: f64 =
      24909857380000.0 +
      y *
        (424441966400.0 +
          y *
            (3733650367.0 + y * (22459040.02 + y * (102042.605 + y * (354.9632885 + y)))));
    return ans1 / ans2 + 0.636619772 * (_besselJ1(x) * Math.log(x) - 1.0 / x);
  }
  const z: f64 = 8.0 / x;
  const y: f64 = z * z;
  const xx: f64 = x - 2.356194491;
  const ans1: f64 =
    1.0 +
    y * (0.00183105 + y * (-0.00003516396496 + y * (0.000002457520174 - y * 0.0000002404127372)));
  const ans2: f64 =
    0.04687499995 +
    y *
      (-0.0002002690873 +
        y * (0.000008449199096 + y * (-0.0000008820898866 + y * 0.0000001057874125)));
  return Math.sqrt(0.636619772 / x) * (Math.sin(xx) * ans1 + z * Math.cos(xx) * ans2);
}

// ---------------------------------------------------------------------------
// Bessel Jn scalar (general integer order, forward/backward recurrence)
// ---------------------------------------------------------------------------

function _besselJn(n: i32, x: f64): f64 {
  const ni: i32 = n < 0 ? -n : n;
  const sign: f64 = n < 0 && ni % 2 != 0 ? -1.0 : 1.0;
  if (ni == 0) return sign * _besselJ0(x);
  if (ni == 1) return sign * _besselJ1(x);
  if (Math.abs(x) < 1e-15) return 0.0;
  if (ni <= 20 || Math.abs(x) > <f64>ni) {
    // Forward recurrence
    let jPrev: f64 = _besselJ0(x);
    let jCurr: f64 = _besselJ1(x);
    for (let k: i32 = 1; k < ni; k++) {
      const jNext: f64 = (2.0 * <f64>k / x) * jCurr - jPrev;
      jPrev = jCurr;
      jCurr = jNext;
    }
    return sign * jCurr;
  }
  // Miller backward recurrence
  const isqrt: i32 = <i32>Math.sqrt(40.0 * <f64>ni);
  const extra: i32 = isqrt < 10 ? 10 : isqrt;
  const nStart: i32 = ni + 2 * extra;
  let jNext: f64 = 0.0;
  let jCurr: f64 = 1.0;
  let resultVal: f64 = 0.0;
  let sum: f64 = 0.0;
  for (let k: i32 = nStart; k >= 0; k--) {
    const jPrev: f64 = (2.0 * <f64>(k + 1) / x) * jCurr - jNext;
    jNext = jCurr;
    jCurr = jPrev;
    if (k == ni) resultVal = jNext;
    if (k % 2 == 0) sum += jCurr;
  }
  sum = 2.0 * sum - jCurr;
  return sign * (resultVal / sum);
}

// ---------------------------------------------------------------------------
// Bessel Yn scalar (general integer order, forward recurrence; x > 0)
// ---------------------------------------------------------------------------

function _besselYn(n: i32, x: f64): f64 {
  if (x <= 0.0) return NaN;
  const ni: i32 = n < 0 ? -n : n;
  const sign: f64 = n < 0 && ni % 2 != 0 ? -1.0 : 1.0;
  if (ni == 0) return sign * _besselY0(x);
  if (ni == 1) return sign * _besselY1(x);
  let yPrev: f64 = _besselY0(x);
  let yCurr: f64 = _besselY1(x);
  for (let k: i32 = 1; k < ni; k++) {
    const yNext: f64 = (2.0 * <f64>k / x) * yCurr - yPrev;
    yPrev = yCurr;
    yCurr = yNext;
  }
  return sign * yCurr;
}

// ---------------------------------------------------------------------------
// Airy scalars — power series + asymptotic expansion
//
// Algorithm follows wasm-rust/crates/mathts-wasm/src/special/functions.rs.
// c_k coefficients: c_k = Γ(3k+1/2) / (54^k · k! · Γ(k+1/2))  (DLMF §9.7.1)
//
// Ai(0) = c1 ≈ 0.35502805388781724
// −Ai'(0) = c2 ≈ 0.25881940379280680
// ---------------------------------------------------------------------------

const AIRY_C0: f64 = 1.0;
const AIRY_C1: f64 = 5.0 / 72.0;
const AIRY_C2: f64 = 385.0 / 10368.0;
const AIRY_C3: f64 = 85085.0 / 2239488.0;
const AIRY_C4: f64 = 37182145.0 / 644972544.0;
const AIRY_C5: f64 = 5765760010.25 / 61917364224.0;
const AIRY_C6: f64 = 1519768071625.0 / 8918845788160.0;

// Ai(0)
const AI0: f64 = 0.35502805388781723926;
// −Ai′(0)
const AI_PRIME0: f64 = 0.25881940379280679841;
// threshold for switching to asymptotic
const XBIG: f64 = 4.5;

function _airyAiAsymptoteLargePos(x: f64): f64 {
  const xp: f64 = Math.pow(x, 0.25);
  const x32: f64 = x * Math.sqrt(x);
  const zeta: f64 = (2.0 / 3.0) * x32;
  // alternating asymptotic series Σ (-1)^k c_k / ζ^k
  let p: f64 = AIRY_C0;
  let zk: f64 = zeta;
  p -= AIRY_C1 / zk; zk *= zeta;
  p += AIRY_C2 / zk; zk *= zeta;
  p -= AIRY_C3 / zk; zk *= zeta;
  p += AIRY_C4 / zk; zk *= zeta;
  p -= AIRY_C5 / zk; zk *= zeta;
  p += AIRY_C6 / zk;
  return Math.exp(-zeta) * p / (2.0 * Math.sqrt(Math.PI) * xp);
}

function _airyAiAsymptoteLargeNeg(x: f64): f64 {
  const ax: f64 = Math.abs(x);
  const axp: f64 = Math.pow(ax, 0.25);
  const ax32: f64 = ax * Math.sqrt(ax);
  const zeta: f64 = (2.0 / 3.0) * ax32;
  // theta = ζ - π/4 for Ai
  const theta: f64 = zeta - Math.PI / 4.0;
  let p: f64 = AIRY_C0; // even terms
  let q: f64 = 0.0;     // odd terms
  let zk: f64 = zeta;
  // k=1 odd: -c1/ζ
  q -= AIRY_C1 / zk; zk *= zeta;
  // k=2 even: +c2/ζ²
  p += AIRY_C2 / zk; zk *= zeta;
  // k=3 odd: -c3/ζ³
  q -= AIRY_C3 / zk; zk *= zeta;
  // k=4 even: +c4/ζ⁴
  p += AIRY_C4 / zk; zk *= zeta;
  // k=5 odd: -c5/ζ⁵
  q -= AIRY_C5 / zk; zk *= zeta;
  // k=6 even: +c6/ζ⁶
  p += AIRY_C6 / zk;
  return (Math.sin(theta) * p + Math.cos(theta) * q) / (Math.sqrt(Math.PI) * axp);
}

function _airyBiAsymptoteLargePos(x: f64): f64 {
  const xp: f64 = Math.pow(x, 0.25);
  const x32: f64 = x * Math.sqrt(x);
  const zeta: f64 = (2.0 / 3.0) * x32;
  // all-positive series Σ c_k / ζ^k for Bi growing branch
  let p: f64 = AIRY_C0;
  let zk: f64 = zeta;
  p += AIRY_C1 / zk; zk *= zeta;
  p += AIRY_C2 / zk; zk *= zeta;
  p += AIRY_C3 / zk; zk *= zeta;
  p += AIRY_C4 / zk; zk *= zeta;
  p += AIRY_C5 / zk; zk *= zeta;
  p += AIRY_C6 / zk;
  return Math.exp(zeta) * p / (Math.sqrt(Math.PI) * xp);
}

function _airyBiAsymptoteLargeNeg(x: f64): f64 {
  const ax: f64 = Math.abs(x);
  const axp: f64 = Math.pow(ax, 0.25);
  const ax32: f64 = ax * Math.sqrt(ax);
  const zeta: f64 = (2.0 / 3.0) * ax32;
  // theta = ζ + π/4 for Bi (DLMF §9.7.5)
  const theta: f64 = zeta + Math.PI / 4.0;
  let p: f64 = AIRY_C0;
  let q: f64 = 0.0;
  let zk: f64 = zeta;
  q -= AIRY_C1 / zk; zk *= zeta;
  p += AIRY_C2 / zk; zk *= zeta;
  q -= AIRY_C3 / zk; zk *= zeta;
  p += AIRY_C4 / zk; zk *= zeta;
  q -= AIRY_C5 / zk; zk *= zeta;
  p += AIRY_C6 / zk;
  return (Math.cos(theta) * p + Math.sin(theta) * q) / (Math.sqrt(Math.PI) * axp);
}

function _airyAiSeries(x: f64): f64 {
  const x3: f64 = x * x * x;
  let f: f64 = 1.0;
  let g: f64 = x;
  let fTerm: f64 = 1.0;
  let gTerm: f64 = x;
  let factF: f64 = 1.0; // (3k)!
  let factG: f64 = 1.0; // (3k+1)!
  let prodF: f64 = 1.0; // Π(3j-2)
  let prodG: f64 = 1.0; // Π(3j-1)
  for (let k: i32 = 1; k <= 30; k++) {
    const kf: f64 = <f64>k;
    factF *= (3.0 * kf - 2.0) * (3.0 * kf - 1.0) * (3.0 * kf);
    factG *= (3.0 * kf - 1.0) * (3.0 * kf) * (3.0 * kf + 1.0);
    prodF *= 3.0 * kf - 2.0;
    prodG *= 3.0 * kf - 1.0;
    fTerm *= x3;
    gTerm *= x3;
    const df: f64 = fTerm * prodF / factF;
    const dg: f64 = gTerm * prodG / factG;
    f += df;
    g += dg;
    if (Math.abs(df) < Math.abs(f) * 1e-16 && Math.abs(dg) < Math.abs(g) * 1e-16) break;
  }
  return AI0 * f - AI_PRIME0 * g;
}

function _airyBiSeries(x: f64): f64 {
  const x3: f64 = x * x * x;
  let f: f64 = 1.0;
  let g: f64 = x;
  let fTerm: f64 = 1.0;
  let gTerm: f64 = x;
  let factF: f64 = 1.0;
  let factG: f64 = 1.0;
  let prodF: f64 = 1.0;
  let prodG: f64 = 1.0;
  for (let k: i32 = 1; k <= 30; k++) {
    const kf: f64 = <f64>k;
    factF *= (3.0 * kf - 2.0) * (3.0 * kf - 1.0) * (3.0 * kf);
    factG *= (3.0 * kf - 1.0) * (3.0 * kf) * (3.0 * kf + 1.0);
    prodF *= 3.0 * kf - 2.0;
    prodG *= 3.0 * kf - 1.0;
    fTerm *= x3;
    gTerm *= x3;
    const df: f64 = fTerm * prodF / factF;
    const dg: f64 = gTerm * prodG / factG;
    f += df;
    g += dg;
    if (Math.abs(df) < Math.abs(f) * 1e-16 && Math.abs(dg) < Math.abs(g) * 1e-16) break;
  }
  return Math.sqrt(3.0) * (AI0 * f + AI_PRIME0 * g);
}

function _airyAi(x: f64): f64 {
  if (x > XBIG) return _airyAiAsymptoteLargePos(x);
  if (x < -XBIG) return _airyAiAsymptoteLargeNeg(x);
  return _airyAiSeries(x);
}

function _airyBi(x: f64): f64 {
  if (x > XBIG) return _airyBiAsymptoteLargePos(x);
  if (x < -XBIG) return _airyBiAsymptoteLargeNeg(x);
  return _airyBiSeries(x);
}

// ===========================================================================
// Array exports — Bessel
// ===========================================================================

/** Apply J0 element-wise.  Returns zero-length array if xs is empty. */
export function bessel_j0_f64(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i: i32 = 0; i < xs.length; i++) out[i] = _besselJ0(xs[i]);
  return out;
}

/** Apply J1 element-wise. */
export function bessel_j1_f64(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i: i32 = 0; i < xs.length; i++) out[i] = _besselJ1(xs[i]);
  return out;
}

/** Apply J_n element-wise (fixed integer order n). */
export function bessel_jn_f64(n: i32, xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i: i32 = 0; i < xs.length; i++) out[i] = _besselJn(n, xs[i]);
  return out;
}

/** Apply Y0 element-wise (NaN for x ≤ 0). */
export function bessel_y0_f64(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i: i32 = 0; i < xs.length; i++) out[i] = _besselY0(xs[i]);
  return out;
}

/** Apply Y1 element-wise (NaN for x ≤ 0). */
export function bessel_y1_f64(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i: i32 = 0; i < xs.length; i++) out[i] = _besselY1(xs[i]);
  return out;
}

/** Apply Y_n element-wise (fixed integer order n; NaN for x ≤ 0). */
export function bessel_yn_f64(n: i32, xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i: i32 = 0; i < xs.length; i++) out[i] = _besselYn(n, xs[i]);
  return out;
}

// ===========================================================================
// Array exports — Airy
// ===========================================================================

/** Apply Ai(x) element-wise. */
export function airy_ai_f64(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i: i32 = 0; i < xs.length; i++) out[i] = _airyAi(xs[i]);
  return out;
}

/** Apply Bi(x) element-wise. */
export function airy_bi_f64(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i: i32 = 0; i < xs.length; i++) out[i] = _airyBi(xs[i]);
  return out;
}
