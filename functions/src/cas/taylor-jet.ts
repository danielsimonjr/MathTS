/**
 * Taylor coefficients by truncated power-series ("jet") arithmetic on the syntax tree.
 *
 * Each node gives the coefficients c_0..c_(L-1) of its Taylor series at x0. The rules for a
 * sum, a product, a quotient, a power and the elementary functions are the standard
 * recurrences, so the coefficients have the accuracy of the floating-point arithmetic and no
 * truncation error. The cost is O(L^2) for each node.
 *
 * Each jet also carries a magnitude jet: the same recurrence on the absolute values of the
 * terms, with every subtraction read as an addition. A coefficient that is not larger than
 * {@link JET_NOISE_RATIO} times its magnitude is rounding noise and becomes exactly 0, so
 * `sin(x)` at `pi` has a constant term of 0, not 1.2e-16.
 */

import {
  type AstNode,
  operatorName,
  callName,
  containsSymbol,
  constantValue,
} from './syntax-tree.js';

/** A coefficient at or below this fraction of its magnitude jet is rounding noise. */
export const JET_NOISE_RATIO = 1e-12;

/** A jet: coefficients `v` and the magnitude bound `m` of the terms summed into each. */
interface Jet {
  v: number[];
  m: number[];
}

/** The jet of a constant. */
function constJet(c: number, len: number): Jet {
  const v = new Array<number>(len).fill(0);
  const m = new Array<number>(len).fill(0);
  v[0] = c;
  m[0] = Math.abs(c);
  return { v, m };
}

/** The length that two jets share. */
function lenOf(a: Jet, b: Jet): number {
  return Math.min(a.v.length, b.v.length);
}

/** a + s*b, with s = 1 or -1. */
function addJet(a: Jet, b: Jet, s: number): Jet {
  const len = lenOf(a, b);
  const v = new Array<number>(len);
  const m = new Array<number>(len);
  for (let k = 0; k < len; k++) {
    v[k] = a.v[k] + s * b.v[k];
    m[k] = a.m[k] + b.m[k];
  }
  return { v, m };
}

/** The Cauchy product of two coefficient lists, truncated to `len`. */
function cauchy(a: number[], b: number[], len: number): number[] {
  const c = new Array<number>(len).fill(0);
  for (let k = 0; k < len; k++) {
    let s = 0;
    for (let j = 0; j <= k; j++) s += a[j] * b[k - j];
    c[k] = s;
  }
  return c;
}

/** a * b. */
function mulJet(a: Jet, b: Jet): Jet {
  const len = lenOf(a, b);
  return { v: cauchy(a.v, b.v, len), m: cauchy(a.m, b.m, len) };
}

/**
 * a / b. When the first `z` coefficients of both `a` and `b` are exactly 0, they cancel and the
 * result is `z` coefficients shorter. A coefficient that is rounding noise counts as 0 (`sin(x)/x`). Returns null for a pole.
 */
function divJet(a: Jet, b: Jet): Jet | null {
  let len = lenOf(a, b);
  let z = 0;
  const isZero = (j: Jet, k: number): boolean => Math.abs(j.v[k]) <= JET_NOISE_RATIO * j.m[k];
  while (z < len && isZero(b, z)) {
    if (!isZero(a, z)) return null;
    z++;
  }
  if (z === len) return null;
  const av = a.v.slice(z, len);
  const am = a.m.slice(z, len);
  const bv = b.v.slice(z, len);
  const bm = b.m.slice(z, len);
  len -= z;
  const b0 = bv[0];
  const v = new Array<number>(len);
  const m = new Array<number>(len);
  for (let k = 0; k < len; k++) {
    let s = av[k];
    let sm = am[k];
    for (let j = 1; j <= k; j++) {
      s -= bv[j] * v[k - j];
      sm += bm[j] * m[k - j];
    }
    v[k] = s / b0;
    m[k] = sm / Math.abs(b0);
  }
  return { v, m };
}

/** f^p for a non-negative integer p, by repeated squaring. */
function intPowJet(f: Jet, p: number): Jet {
  let result = constJet(1, f.v.length);
  let base = f;
  let e = p;
  while (e > 0) {
    if (e & 1) result = mulJet(result, base);
    e >>= 1;
    if (e > 0) base = mulJet(base, base);
  }
  return result;
}

/** f^p for a constant real p. Needs f_0 > 0 unless p is an integer. */
function powConstJet(f: Jet, p: number): Jet | null {
  if (Number.isInteger(p) && Math.abs(p) <= 1024) {
    if (p >= 0) return intPowJet(f, p);
    return divJet(constJet(1, f.v.length), intPowJet(f, -p));
  }
  const f0 = f.v[0];
  if (!(f0 > 0)) return null;
  const len = f.v.length;
  const v = new Array<number>(len);
  const m = new Array<number>(len);
  v[0] = Math.pow(f0, p);
  m[0] = Math.abs(v[0]);
  for (let k = 1; k < len; k++) {
    let s = 0;
    let sm = 0;
    for (let j = 1; j <= k; j++) {
      const w = (p + 1) * j - k;
      s += w * f.v[j] * v[k - j];
      sm += Math.abs(w) * f.m[j] * m[k - j];
    }
    v[k] = s / (k * f0);
    m[k] = sm / (k * f0);
  }
  return { v, m };
}

/** exp(f). */
function expJet(f: Jet): Jet {
  const len = f.v.length;
  const v = new Array<number>(len);
  const m = new Array<number>(len);
  v[0] = Math.exp(f.v[0]);
  m[0] = Math.abs(v[0]) * Math.max(1, f.m[0]);
  for (let k = 1; k < len; k++) {
    let s = 0;
    let sm = 0;
    for (let j = 1; j <= k; j++) {
      s += j * f.v[j] * v[k - j];
      sm += j * f.m[j] * m[k - j];
    }
    v[k] = s / k;
    m[k] = sm / k;
  }
  return { v, m };
}

/** log(f). Needs f_0 > 0. */
function logJet(f: Jet): Jet | null {
  const f0 = f.v[0];
  if (!(f0 > 0)) return null;
  const len = f.v.length;
  const v = new Array<number>(len);
  const m = new Array<number>(len);
  v[0] = Math.log(f0);
  m[0] = Math.max(Math.abs(v[0]), f.m[0] / f0);
  for (let k = 1; k < len; k++) {
    let s = f.v[k];
    let sm = f.m[k];
    for (let j = 1; j < k; j++) {
      s -= (j * v[j] * f.v[k - j]) / k;
      sm += (j * m[j] * f.m[k - j]) / k;
    }
    v[k] = s / f0;
    m[k] = sm / f0;
  }
  return { v, m };
}

/** [sin(f), cos(f)] (hyperbolic = false) or [sinh(f), cosh(f)] (hyperbolic = true). */
function sinCosJet(f: Jet, hyperbolic: boolean): [Jet, Jet] {
  const len = f.v.length;
  const s = new Array<number>(len);
  const c = new Array<number>(len);
  const sm = new Array<number>(len);
  const cm = new Array<number>(len);
  const f0 = f.v[0];
  s[0] = hyperbolic ? Math.sinh(f0) : Math.sin(f0);
  c[0] = hyperbolic ? Math.cosh(f0) : Math.cos(f0);
  // The argument carries a rounding error of about f.m[0] * eps; sin and cos move by as much.
  const scale = hyperbolic ? Math.cosh(f0) * Math.max(1, f.m[0]) : Math.max(1, f.m[0]);
  sm[0] = Math.max(Math.abs(s[0]), scale);
  cm[0] = Math.max(Math.abs(c[0]), scale);
  const sign = hyperbolic ? 1 : -1;
  for (let k = 1; k < len; k++) {
    let ss = 0;
    let cs = 0;
    let ssm = 0;
    let csm = 0;
    for (let j = 1; j <= k; j++) {
      ss += j * f.v[j] * c[k - j];
      cs += j * f.v[j] * s[k - j];
      ssm += j * f.m[j] * cm[k - j];
      csm += j * f.m[j] * sm[k - j];
    }
    s[k] = ss / k;
    c[k] = (sign * cs) / k;
    sm[k] = ssm / k;
    cm[k] = csm / k;
  }
  return [
    { v: s, m: sm },
    { v: c, m: cm },
  ];
}

/** The derivative of a jet (one coefficient shorter, padded with 0 to keep the length). */
function derivJet(f: Jet): Jet {
  const len = f.v.length;
  const v = new Array<number>(len).fill(0);
  const m = new Array<number>(len).fill(0);
  for (let k = 0; k + 1 < len; k++) {
    v[k] = (k + 1) * f.v[k + 1];
    m[k] = (k + 1) * f.m[k + 1];
  }
  return { v, m };
}

/** The antiderivative of `h` with constant term `g0` (its magnitude `g0m`). */
function integrateJet(h: Jet, g0: number, g0m: number, len: number): Jet {
  const v = new Array<number>(len);
  const m = new Array<number>(len);
  v[0] = g0;
  m[0] = g0m;
  for (let k = 1; k < len; k++) {
    v[k] = h.v[k - 1] / k;
    m[k] = h.m[k - 1] / k;
  }
  return { v, m };
}

/** atan(f) = integral of f'/(1+f^2). */
function atanJet(f: Jet): Jet | null {
  const len = f.v.length;
  const h = divJet(derivJet(f), addJet(constJet(1, len), mulJet(f, f), 1));
  if (h === null || h.v.length < len - 1) return null;
  const g0 = Math.atan(f.v[0]);
  return integrateJet(h, g0, Math.max(Math.abs(g0), f.m[0]), len);
}

/** asin(f) = integral of f'/sqrt(1-f^2). Needs |f_0| < 1. */
function asinJet(f: Jet): Jet | null {
  const len = f.v.length;
  if (!(Math.abs(f.v[0]) < 1)) return null;
  const root = powConstJet(addJet(constJet(1, len), mulJet(f, f), -1), 0.5);
  if (root === null) return null;
  const h = divJet(derivJet(f), root);
  if (h === null || h.v.length < len - 1) return null;
  const g0 = Math.asin(f.v[0]);
  return integrateJet(h, g0, Math.max(Math.abs(g0), f.m[0]), len);
}

/** A jet whose values are all finite, or null. */
function finite(j: Jet | null): Jet | null {
  if (j === null) return null;
  for (let k = 0; k < j.v.length; k++) {
    if (!Number.isFinite(j.v[k]) || !Number.isFinite(j.m[k])) return null;
  }
  return j;
}

/** The jet of `node`, or null when a rule does not apply. */
function jetOf(node: AstNode, variable: string, x0: number, len: number): Jet | null {
  if (node.type === 'ParenthesisNode' && node.content)
    return jetOf(node.content, variable, x0, len);
  if (node.type === 'SymbolNode' && node.name === variable) {
    const j = constJet(x0, len);
    if (len > 1) {
      j.v[1] = 1;
      j.m[1] = 1;
    }
    return j;
  }
  if (!containsSymbol(node, variable)) {
    const c = constantValue(node);
    return c === null ? null : constJet(c, len);
  }
  const args = node.args ?? [];
  const sub = (i: number): Jet | null => (args[i] ? jetOf(args[i], variable, x0, len) : null);
  const op = operatorName(node);
  if (op !== null) {
    if ((op === 'unaryMinus' || op === 'unaryPlus') && args.length === 1) {
      const a = sub(0);
      if (a === null) return null;
      return op === 'unaryPlus' ? a : { v: a.v.map((c) => -c), m: a.m };
    }
    if (args.length !== 2) return null;
    if (op === 'pow' && !containsSymbol(args[1], variable)) {
      const p = constantValue(args[1]);
      const a = sub(0);
      return p === null || a === null ? null : finite(powConstJet(a, p));
    }
    const a = sub(0);
    const b = sub(1);
    if (a === null || b === null) return null;
    switch (op) {
      case 'add':
        return addJet(a, b, 1);
      case 'subtract':
        return addJet(a, b, -1);
      case 'multiply':
        return mulJet(a, b);
      case 'divide':
        return finite(divJet(a, b));
      case 'pow': {
        // f^g = exp(g * log(f))
        const l = logJet(a);
        return l === null ? null : finite(expJet(mulJet(b, l)));
      }
      default:
        return null;
    }
  }
  const fn = callName(node);
  if (fn === null) return null;
  if (fn === 'log' && args.length === 2) {
    const a = sub(0);
    const base = sub(1);
    if (a === null || base === null) return null;
    const la = logJet(a);
    const lb = logJet(base);
    return la === null || lb === null ? null : finite(divJet(la, lb));
  }
  if (args.length !== 1) return null;
  const f = sub(0);
  if (f === null) return null;
  switch (fn) {
    case 'exp':
      return finite(expJet(f));
    case 'log':
      return finite(logJet(f));
    case 'sqrt':
      return finite(powConstJet(f, 0.5));
    case 'sin':
      return finite(sinCosJet(f, false)[0]);
    case 'cos':
      return finite(sinCosJet(f, false)[1]);
    case 'tan': {
      const [s, c] = sinCosJet(f, false);
      return finite(divJet(s, c));
    }
    case 'sinh':
      return finite(sinCosJet(f, true)[0]);
    case 'cosh':
      return finite(sinCosJet(f, true)[1]);
    case 'tanh': {
      const [s, c] = sinCosJet(f, true);
      return finite(divJet(s, c));
    }
    case 'atan':
      return finite(atanJet(f));
    case 'asin':
      return finite(asinJet(f));
    case 'acos': {
      const g = asinJet(f);
      if (g === null) return null;
      return finite({ v: g.v.map((c, k) => (k === 0 ? Math.PI / 2 - c : -c)), m: g.m });
    }
    default:
      return null;
  }
}

/** Extra orders that a quotient may consume when it cancels leading zeros. */
const JET_EXTRA_ORDERS = [0, 4, 16];

/**
 * The Taylor coefficients c_0..c_n of `tree` in `variable` at `x0` by jet arithmetic, or null
 * when a node has no jet rule (an unknown function, a pole, a non-finite value). A coefficient
 * that is rounding noise (see {@link JET_NOISE_RATIO}) is exactly 0.
 */
export function jetCoefficients(
  tree: AstNode,
  variable: string,
  x0: number,
  n: number
): number[] | null {
  for (const extra of JET_EXTRA_ORDERS) {
    const j = jetOf(tree, variable, x0, n + 1 + extra);
    if (j === null) return null;
    if (j.v.length < n + 1) continue;
    const out: number[] = [];
    for (let k = 0; k <= n; k++) {
      out.push(Math.abs(j.v[k]) <= JET_NOISE_RATIO * j.m[k] ? 0 : j.v[k]);
    }
    return out;
  }
  return null;
}

/**
 * True when the value of `tree` at `x0` is 0 or rounding noise: its size is at most `ratio`
 * times the magnitude of the terms that the evaluation summed (`sin(pi)` is noise, the
 * constant `1e-30` is not). Returns null when `tree` has no jet rule.
 */
export function jetValueIsZero(
  tree: AstNode,
  variable: string,
  x0: number,
  ratio: number
): boolean | null {
  const j = jetOf(tree, variable, x0, 1);
  if (j === null) return null;
  return Math.abs(j.v[0]) <= ratio * j.m[0];
}
