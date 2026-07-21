/**
 * Layer 1 rational-function symbolic integration — Task 1: parse a
 * single-variable rational-function expression into exact integer
 * numerator/denominator polynomials, split off the polynomial part via
 * exact-ℚ long division, and integrate a polynomial termwise (power rule).
 *
 * Reuses the univariate expression parser (`polyFromExpression`, from the
 * Gröbner-basis module) for parsing and the bigint dense-polynomial
 * convention (`IntPoly`, index = degree) from the #7 factorization engine
 * for the integer representation.
 *
 * See docs/superpowers/plans/2026-07-20-risch-layer1-rational-integration.md
 * (Task 1). Later tasks build denominator factorization, exact-ℚ partial
 * fractions, and per-factor closed-form integration on top of this module.
 */

import { polyFromExpression, type Poly } from '../typed/polynomial-ideal.js';
import {
  trim as trimIntPoly,
  bigintGcd,
  mul as mulIntPoly,
  exactDivide as exactDivideIntPoly,
  type IntPoly,
} from '../typed/factorization/integer-poly.js';
import { factorUnivariateZ } from '../typed/factorization/zassenhaus.js';

/** Exact rational number, always normalized to lowest terms with a positive denominator. */
export interface Rat {
  num: bigint;
  den: bigint;
}

/** A rational function `numer(x)/denom(x)` with integer dense (`IntPoly`) coefficients. */
export interface RatFunc {
  numer: IntPoly;
  denom: IntPoly;
}

/** Reduces `num/den` to lowest terms with a positive denominator. Throws on a zero denominator. */
function ratNormalize(num: bigint, den: bigint): Rat {
  if (den === 0n) {
    throw new Error('Rat: zero denominator');
  }
  let n = num;
  let d = den;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  if (n === 0n) {
    return { num: 0n, den: 1n };
  }
  const g = bigintGcd(n, d);
  return { num: n / g, den: d / g };
}

export function ratAdd(a: Rat, b: Rat): Rat {
  return ratNormalize(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function ratSub(a: Rat, b: Rat): Rat {
  return ratNormalize(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function ratMul(a: Rat, b: Rat): Rat {
  return ratNormalize(a.num * b.num, a.den * b.den);
}

export function ratDiv(a: Rat, b: Rat): Rat {
  if (b.num === 0n) {
    throw new Error('Rat: division by zero');
  }
  return ratNormalize(a.num * b.den, a.den * b.num);
}

export function ratFromBigint(n: bigint): Rat {
  return { num: n, den: 1n };
}

const RAT_ZERO: Rat = { num: 0n, den: 1n };

/**
 * A quadratic surd `a + b·√Δ` for a fixed positive non-square radicand `Δ`
 * (Δ > 0, non-square — a perfect-square Δ never occurs here since it would
 * already have split into rational linear factors). `Δ` is NOT stored on the
 * `Surd` itself: surds produced within one computation share a single `Δ`,
 * and every op that needs it (`surdMul`, `surdDiv`, `surdRender`) takes it as
 * an explicit parameter. `surdAdd`/`surdSub`/`surdNeg`/`surdFromRat` are
 * Δ-independent (componentwise on `a`/`b`), so they don't take it.
 *
 * See docs/superpowers/specs/2026-07-21-risch-layer2-quadratic-surd-design.md
 * (Architecture §1).
 */
export interface Surd {
  a: Rat;
  b: Rat;
}

/** Lifts a rational number to a surd with zero `√Δ` component. */
export function surdFromRat(r: Rat): Surd {
  return { a: r, b: RAT_ZERO };
}

/** Negates a surd componentwise. */
export function surdNeg(s: Surd): Surd {
  return { a: ratNeg(s.a), b: ratNeg(s.b) };
}

/** Componentwise surd addition (Δ-independent). */
export function surdAdd(x: Surd, y: Surd): Surd {
  return { a: ratAdd(x.a, y.a), b: ratAdd(x.b, y.b) };
}

/** Componentwise surd subtraction (Δ-independent). */
export function surdSub(x: Surd, y: Surd): Surd {
  return { a: ratSub(x.a, y.a), b: ratSub(x.b, y.b) };
}

/**
 * Surd multiplication: `(a+b√Δ)(c+d√Δ) = (ac+bdΔ) + (ad+bc)√Δ`, using exact
 * `Rat` arithmetic throughout (`Δ` lifted to a `Rat` via `ratFromBigint`).
 */
export function surdMul(x: Surd, y: Surd, delta: bigint): Surd {
  const d = ratFromBigint(delta);
  return {
    a: ratAdd(ratMul(x.a, y.a), ratMul(ratMul(x.b, y.b), d)),
    b: ratAdd(ratMul(x.a, y.b), ratMul(x.b, y.a)),
  };
}

/**
 * Surd division, rationalized by the conjugate: `(a+b√Δ)/(c+d√Δ) =
 * (a+b√Δ)(c−d√Δ) / (c²−d²Δ)`, where `c²−d²Δ` is a plain rational scalar.
 * Throws when `y` is zero (both components zero).
 */
export function surdDiv(x: Surd, y: Surd, delta: bigint): Surd {
  if (y.a.num === 0n && y.b.num === 0n) {
    throw new Error('surdDiv: division by zero surd');
  }
  const d = ratFromBigint(delta);
  const scale = ratSub(ratMul(y.a, y.a), ratMul(ratMul(y.b, y.b), d));
  const conj: Surd = { a: y.a, b: ratNeg(y.b) };
  const numer = surdMul(x, conj, delta);
  return { a: ratDiv(numer.a, scale), b: ratDiv(numer.b, scale) };
}

/**
 * Renders a surd as a readable, evaluable string `a + b*sqrt(Δ)`: a zero `a`
 * or zero `b` component is omitted, `b = 1`/`b = -1` render as bare
 * `sqrt(Δ)`/`- sqrt(Δ)`, and integer `Rat`s print without a `/1`. Exact
 * format is non-contractual (correctness is verified by differentiation
 * elsewhere); this only needs to stay evaluable and readable.
 */
export function surdRender(s: Surd, delta: bigint): string {
  const parts: string[] = [];
  if (s.a.num !== 0n) {
    parts.push(ratToStr(s.a));
  }
  if (s.b.num !== 0n) {
    const neg = s.b.num < 0n;
    const absB = neg ? ratNeg(s.b) : s.b;
    const sqrtPart = `sqrt(${delta})`;
    const term = absB.num === absB.den ? sqrtPart : `${ratToStr(absB)}*${sqrtPart}`;
    if (parts.length === 0) {
      parts.push(neg ? `- ${term}` : term);
    } else {
      parts.push(neg ? `- ${term}` : `+ ${term}`);
    }
  }
  if (parts.length === 0) {
    return '0';
  }
  return parts.join(' ');
}

/**
 * Splits `expr` at the first top-level (paren-depth 0) `/`, yielding
 * numerator/denominator substrings. When no top-level `/` is present, `expr`
 * is a bare polynomial: numerator = `expr`, denominator = `'1'`.
 */
function splitTopLevelDivision(expr: string): { numerStr: string; denomStr: string } {
  let depth = 0;
  for (let i = 0; i < expr.length; i += 1) {
    const c = expr[i];
    if (c === '(') {
      depth += 1;
    } else if (c === ')') {
      depth -= 1;
    } else if (c === '/' && depth === 0) {
      return { numerStr: expr.slice(0, i), denomStr: expr.slice(i + 1) };
    }
  }
  return { numerStr: expr, denomStr: '1' };
}

/** Dense ascending coefficients (index = power) of a single-variable `Poly`. */
function denseFromPoly(p: Poly): number[] {
  let maxPow = 0;
  for (const t of p) {
    maxPow = Math.max(maxPow, t.powers[0] ?? 0);
  }
  const dense = new Array<number>(maxPow + 1).fill(0);
  for (const t of p) {
    dense[t.powers[0]] += t.coeff;
  }
  return dense;
}

const INT_EPS = 1e-7;

function isCloseToInteger(x: number): boolean {
  return Math.abs(x - Math.round(x)) < INT_EPS;
}

/** Smallest `k` in `[1, LIMIT]` such that `k*c` is (numerically) an integer for every `c`, or `null`. */
function commonDenominator(coeffs: number[]): number | null {
  const LIMIT = 100_000;
  for (let k = 1; k <= LIMIT; k += 1) {
    if (coeffs.every((c) => isCloseToInteger(c * k))) {
      return k;
    }
  }
  return null;
}

/**
 * Parses a single-variable expression `numerExpr/denomExpr` (or a bare
 * polynomial, denominator `[1n]`) into integer numerator/denominator dense
 * polynomials. Rational coefficients are cleared by the LCM of their
 * denominators (numerator and denominator are each cleared independently,
 * then cross-scaled by the other's factor so the represented ratio
 * `numer(x)/denom(x)` is unchanged).
 *
 * Returns `null` when `expr` is not a rational function of `v`: it contains
 * a transcendental call (`sin`/`exp`/... — any identifier other than `v`),
 * more than one variable, a zero denominator, or coefficients that cannot be
 * cleared to integers.
 */
export function parseRationalFunction(expr: string, v: string): RatFunc | null {
  const { numerStr, denomStr } = splitTopLevelDivision(expr);

  let numerPoly: Poly;
  let denomPoly: Poly;
  try {
    numerPoly = polyFromExpression(numerStr, [v]);
    denomPoly = polyFromExpression(denomStr, [v]);
  } catch {
    return null;
  }

  const numerDense = denseFromPoly(numerPoly);
  const denomDense = denseFromPoly(denomPoly);
  if (denomDense.every((c) => c === 0)) {
    return null; // zero denominator: not a rational function
  }

  const kNumer = commonDenominator(numerDense);
  const kDenom = commonDenominator(denomDense);
  if (kNumer === null || kDenom === null) {
    return null;
  }
  const scale = kNumer * kDenom;

  const toIntPoly = (dense: number[]): IntPoly | null => {
    const out: bigint[] = new Array<bigint>(dense.length);
    for (let i = 0; i < dense.length; i += 1) {
      const scaled = dense[i] * scale;
      if (!isCloseToInteger(scaled)) {
        return null;
      }
      out[i] = BigInt(Math.round(scaled));
    }
    return trimIntPoly(out);
  };

  const numer = toIntPoly(numerDense);
  const denom = toIntPoly(denomDense);
  if (numer === null || denom === null || denom.length === 0) {
    return null;
  }

  return { numer, denom };
}

/** Trims trailing (highest-degree) zero `Rat` coefficients. */
function trimRat(p: Rat[]): Rat[] {
  let n = p.length;
  while (n > 0 && p[n - 1].num === 0n) {
    n -= 1;
  }
  return p.slice(0, n);
}

/**
 * Exact-ℚ polynomial long division of `rf.numer` by `rf.denom`:
 * `numer = quotient·denom + remainder`, `deg(remainder) < deg(denom)`.
 * Division is performed over ℚ (so a non-monic denominator is handled
 * correctly); the result is converted back to `bigint` coefficients, which
 * requires every intermediate `Rat` to reduce to an integer denominator —
 * true whenever the division is itself exact-integer, as it is for a
 * genuine rational-function reduction. Throws if it is not (a caller that
 * expects a non-integer quotient/remainder is out of this module's scope).
 */
export function polynomialPart(rf: RatFunc): { quotient: IntPoly; remainder: IntPoly } {
  const denom = trimIntPoly(rf.denom);
  if (denom.length === 0) {
    throw new Error('polynomialPart: zero denominator');
  }
  const db = denom.length - 1;
  const lb = ratFromBigint(denom[db]);
  const denomRat = denom.map(ratFromBigint);

  let rem = trimRat(trimIntPoly(rf.numer).map(ratFromBigint));
  const dq = rem.length - 1 - db;
  const quotient: Rat[] = new Array<Rat>(Math.max(dq + 1, 0)).fill(RAT_ZERO);

  while (rem.length > 0 && rem.length - 1 >= db) {
    const dr = rem.length - 1;
    const shift = dr - db;
    const coeff = ratDiv(rem[dr], lb);
    quotient[shift] = coeff;
    const next = rem.slice();
    for (let i = 0; i <= db; i += 1) {
      next[shift + i] = ratSub(next[shift + i], ratMul(coeff, denomRat[i]));
    }
    rem = trimRat(next);
  }

  const toExactIntPoly = (rs: Rat[]): IntPoly =>
    trimIntPoly(
      rs.map((r) => {
        if (r.den !== 1n) {
          throw new Error('polynomialPart: division introduced a non-integer coefficient');
        }
        return r.num;
      })
    );

  return { quotient: toExactIntPoly(quotient), remainder: toExactIntPoly(rem) };
}

/** Renders a single power-rule term `r * varPart` (`r` already reduced) in the existing rational-rendering style. */
function formatRatTerm(r: Rat, varPart: string): string {
  const sign = r.num < 0n ? '-' : '';
  const absNum = r.num < 0n ? -r.num : r.num;
  const coeffPart = absNum === 1n ? '' : `${absNum}*`;
  const denPart = r.den === 1n ? '' : `/${r.den}`;
  return `${sign}${coeffPart}${varPart}${denPart}`;
}

/**
 * Termwise power rule: the coefficient `c` at degree `n` in `p` integrates
 * to `c/(n+1) · v^(n+1)`. Renders a readable (not contractual beyond
 * containing the expected power) string, e.g. `x^2/2`, `2*x`.
 */
export function integratePolynomial(p: IntPoly, v: string): string {
  const trimmed = trimIntPoly(p);
  const terms: string[] = [];
  for (let i = 0; i < trimmed.length; i += 1) {
    const c = trimmed[i];
    if (c === 0n) {
      continue;
    }
    const n = i + 1;
    const coeff = ratNormalize(c, BigInt(n));
    const varPart = n === 1 ? v : `${v}^${n}`;
    terms.push(formatRatTerm(coeff, varPart));
  }
  if (terms.length === 0) {
    return '0';
  }
  return terms.join(' + ').replace(/\+ -/g, '- ');
}

/**
 * An irreducible factor of a rational function's denominator, classified for
 * closed-form integration:
 *   - `'linear'` (degree 1) → a `log`;
 *   - `'quadratic-neg'` (degree 2, discriminant `b²−4ac < 0`, complex roots) →
 *     a `log` + `atan` pair (Layer 1);
 *   - `'quadratic-pos'` (degree 2, discriminant `> 0`, real irrational roots,
 *     multiplicity 1) → a pair of real `log`s with quadratic-surd coefficients
 *     (Layer 2, see the quadratic-surd design doc).
 * Degree-≥3 irreducible factors, and repeated positive-discriminant quadratics,
 * are out of scope (see `factorDenominator`, which returns `null` for them).
 */
export interface DenFactor {
  poly: IntPoly;
  mult: number;
  kind: 'linear' | 'quadratic-neg' | 'quadratic-pos';
}

/**
 * Factors `denom` completely over ℤ/ℚ via the #7 factorization engine
 * (`factorUnivariateZ`) and classifies each irreducible factor by degree.
 *
 * A degree-1 factor is `'linear'`. A degree-2 factor, having survived complete
 * factorization over ℚ, is irreducible over ℚ — but that does NOT fix its
 * discriminant sign: `disc = b²−4ac < 0` (complex roots, e.g. x²+1) is
 * `'quadratic-neg'` (Layer 1 arctan path); `disc > 0` (real irrational roots,
 * a non-square disc, e.g. x²−2) with **multiplicity 1** is `'quadratic-pos'`
 * (Layer 2 quadratic-surd path).
 *
 * Returns `null` when a factor is out of scope: any irreducible factor of
 * degree ≥ 3, or a **repeated** positive-discriminant quadratic (`disc > 0`,
 * `mult > 1`) — the reduction formula for repeated real-root quadratics is
 * Layer 3. The caller then falls back to the `integral(...)` marker.
 */
export function factorDenominator(denom: IntPoly): DenFactor[] | null {
  const { factors } = factorUnivariateZ(trimIntPoly(denom));
  const out: DenFactor[] = [];
  for (const { poly, mult } of factors) {
    const deg = trimIntPoly(poly).length - 1;
    if (deg === 1) {
      out.push({ poly, mult, kind: 'linear' });
    } else if (deg === 2) {
      const q = trimIntPoly(poly);
      const disc = q[1] * q[1] - 4n * q[2] * q[0];
      if (disc < 0n) {
        // Complex roots → the arctan closed form (Layer 1), any multiplicity.
        out.push({ poly, mult, kind: 'quadratic-neg' });
      } else if (mult === 1) {
        // Real irrational roots (disc > 0, non-square) → real logs with
        // quadratic-surd coefficients (Layer 2). Only power 1 is in scope.
        out.push({ poly, mult, kind: 'quadratic-pos' });
      } else {
        // Repeated positive-discriminant quadratic → Layer 3, decline.
        return null;
      }
    } else {
      return null;
    }
  }
  return out;
}

/**
 * A single partial-fraction term `numer(x) / factor(x)^power`. `numer` is a
 * `Rat[]` of fixed length `deg(factor)` (index = degree, ascending — the same
 * convention as `IntPoly`): length 1 (a constant) over a linear factor,
 * length 2 (`[E, D]` meaning `D*x + E`) over a quadratic factor.
 */
export interface PFTerm {
  factor: IntPoly;
  power: number;
  numer: Rat[];
}

/** Column vector of `coeff(x^shift * poly, x^row)` for `row` in `[0, size)`. */
function shiftedColumn(poly: IntPoly, shift: number, size: number): Rat[] {
  const col: Rat[] = new Array<Rat>(size).fill(RAT_ZERO);
  for (let i = 0; i < poly.length; i += 1) {
    const row = i + shift;
    if (row < size) {
      col[row] = ratFromBigint(poly[i]);
    }
  }
  return col;
}

/**
 * Solves the square linear system `matrix * x = rhs` exactly over ℚ via
 * Gauss–Jordan elimination with `Rat` arithmetic throughout (row-swap
 * partial pivoting on "any nonzero entry" — exact arithmetic needs no
 * numerical-stability pivot choice). Throws if the system is singular; the
 * partial-fraction system built by `partialFractions` is square and
 * non-singular by construction for a proper `remainder/denom`.
 */
function solveLinearSystemRat(matrix: readonly Rat[][], rhs: readonly Rat[]): Rat[] {
  const n = rhs.length;
  const rows: Rat[][] = matrix.map((row, r) => [...row, rhs[r]]);
  for (let col = 0; col < n; col += 1) {
    let pivotRow = -1;
    for (let r = col; r < n; r += 1) {
      if (rows[r][col].num !== 0n) {
        pivotRow = r;
        break;
      }
    }
    if (pivotRow === -1) {
      throw new Error('partialFractions: singular partial-fraction linear system');
    }
    if (pivotRow !== col) {
      const tmp = rows[col];
      rows[col] = rows[pivotRow];
      rows[pivotRow] = tmp;
    }
    const pivotVal = rows[col][col];
    rows[col] = rows[col].map((v) => ratDiv(v, pivotVal));
    for (let r = 0; r < n; r += 1) {
      if (r === col) {
        continue;
      }
      const factor = rows[r][col];
      if (factor.num === 0n) {
        continue;
      }
      const pivotRowVals = rows[col];
      rows[r] = rows[r].map((v, c) => ratSub(v, ratMul(factor, pivotRowVals[c])));
    }
  }
  return rows.map((row) => row[n]);
}

/**
 * Exact-ℚ partial-fraction decomposition of `remainder(x) / ∏ factorᵢ(x)^multᵢ`
 * (`deg(remainder) < deg(∏ factorᵢ^multᵢ)`, as produced by `polynomialPart`)
 * into the standard form: for each irreducible factor `qᵢ` with multiplicity
 * `mᵢ`, terms `A_{i,k}(x) / qᵢ(x)^k` for `k = 1..mᵢ`, `deg A_{i,k} < deg qᵢ`.
 *
 * Solved by clearing denominators: multiplying the ansatz by the full
 * denominator `D = ∏ factorⱼ^multⱼ` turns each unknown numerator coefficient
 * into a linear unknown whose column is the polynomial
 * `x^j · qᵢ(x)^{mᵢ−k} · ∏_{j≠i} factorⱼ(x)^multⱼ` (a plain integer polynomial
 * product — no division is ever needed, since `mᵢ−k ≥ 0`). Equating
 * coefficients of `remainder(x)` on both sides gives a square (`deg D` ×
 * `deg D`) rational linear system, solved exactly via `solveLinearSystemRat`.
 */
export function partialFractions(remainder: IntPoly, factors: DenFactor[]): PFTerm[] {
  const trimmedRemainder = trimIntPoly(remainder);

  // factorPowers[fi][p] = factors[fi].poly ^ p, for p = 0..factors[fi].mult.
  const factorPowers: IntPoly[][] = factors.map((f) => {
    const powers: IntPoly[] = [[1n]];
    let acc: IntPoly = [1n];
    for (let p = 1; p <= f.mult; p += 1) {
      acc = mulIntPoly(acc, f.poly);
      powers.push(acc);
    }
    return powers;
  });

  // othersProduct[fi] = the product of every OTHER factor raised to its full
  // multiplicity: ∏_{j≠fi} factorⱼ^multⱼ.
  const othersProduct: IntPoly[] = factors.map((_f, fi) => {
    let acc: IntPoly = [1n];
    for (let fj = 0; fj < factors.length; fj += 1) {
      if (fj === fi) {
        continue;
      }
      acc = mulIntPoly(acc, factorPowers[fj][factors[fj].mult]);
    }
    return acc;
  });

  const degOf = (fi: number): number => trimIntPoly(factors[fi].poly).length - 1;

  interface UnknownRef {
    fi: number;
    k: number;
    j: number;
  }
  const unknowns: UnknownRef[] = [];
  for (let fi = 0; fi < factors.length; fi += 1) {
    const di = degOf(fi);
    for (let k = 1; k <= factors[fi].mult; k += 1) {
      for (let j = 0; j < di; j += 1) {
        unknowns.push({ fi, k, j });
      }
    }
  }
  const n = unknowns.length;

  const columns: Rat[][] = unknowns.map(({ fi, k, j }) => {
    const remainingPower = factors[fi].mult - k;
    const coPoly = mulIntPoly(othersProduct[fi], factorPowers[fi][remainingPower]);
    return shiftedColumn(coPoly, j, n);
  });

  const rows: Rat[][] = [];
  for (let r = 0; r < n; r += 1) {
    rows.push(columns.map((col) => col[r]));
  }

  const rhs: Rat[] = new Array<Rat>(n)
    .fill(RAT_ZERO)
    .map((_, idx) => ratFromBigint(idx < trimmedRemainder.length ? trimmedRemainder[idx] : 0n));

  const solution = n === 0 ? [] : solveLinearSystemRat(rows, rhs);

  const terms: PFTerm[] = [];
  let idx = 0;
  for (let fi = 0; fi < factors.length; fi += 1) {
    const di = degOf(fi);
    for (let k = 1; k <= factors[fi].mult; k += 1) {
      const numer: Rat[] = [];
      for (let j = 0; j < di; j += 1) {
        numer.push(solution[idx]);
        idx += 1;
      }
      terms.push({ factor: factors[fi].poly, power: k, numer });
    }
  }
  return terms;
}

/** Negates a `Rat` (result stays normalized: the denominator is untouched). */
function ratNeg(r: Rat): Rat {
  return { num: -r.num, den: r.den };
}

/** Renders a reduced `Rat` as a bare expression string, e.g. `3`, `-3/2`. */
function ratToStr(r: Rat): string {
  return r.den === 1n ? `${r.num}` : `${r.num}/${r.den}`;
}

/**
 * Renders `coeff * rest` in a readable, evaluable form: `1` drops the factor,
 * `-1` becomes a leading minus, otherwise `n/d*rest` (integer denominators are
 * omitted). `rest` must be a fully-parenthesized sub-expression so operator
 * precedence is preserved (e.g. `rest = '(2*x)/(x^2 + (1))^(1)'`).
 */
function renderCoeffTimes(r: Rat, rest: string): string {
  const neg = r.num < 0n;
  const absNum = neg ? -r.num : r.num;
  const sign = neg ? '-' : '';
  if (absNum === r.den) {
    return `${sign}${rest}`;
  }
  const denPart = r.den === 1n ? '' : `/${r.den}`;
  return `${sign}${absNum}${denPart}*${rest}`;
}

/** Renders `x - a` (`a` a `Rat` root), simplifying the sign: `x - 1`, `x + 2`, `x`. */
function renderXMinus(a: Rat, v: string): string {
  if (a.num === 0n) {
    return v;
  }
  if (a.num > 0n) {
    return `${v} - ${ratToStr(a)}`;
  }
  return `${v} + ${ratToStr(ratNeg(a))}`;
}

/** Monic quadratic core `x^2 + (b)*x + (c)` (`b`/`c` `Rat`; the `x` term is dropped when `b = 0`). */
function renderQuadraticCore(b: Rat, c: Rat, v: string): string {
  let s = `${v}^2`;
  if (b.num !== 0n) {
    s += ` + (${ratToStr(b)})*${v}`;
  }
  s += ` + (${ratToStr(c)})`;
  return s;
}

/** `2*x + (b)` (the constant is dropped when `b = 0`). */
function renderTwoXPlusB(b: Rat, v: string): string {
  let s = `2*${v}`;
  if (b.num !== 0n) {
    s += ` + (${ratToStr(b)})`;
  }
  return s;
}

/** Joins already-signed antiderivative terms with ` + `, collapsing ` + -` to ` - `. */
function joinTerms(parts: string[]): string {
  if (parts.length === 0) {
    return '0';
  }
  return parts.join(' + ').replace(/\+ -/g, '- ');
}

/**
 * Closed-form integral of `A / (x - a)^k` where the (possibly non-monic)
 * linear factor is `factor = [p0, p1]` (`p1*x + p0`) and `numer = [A0]`.
 * Normalizes to monic by absorbing `p1^k`: root `a = -p0/p1`, `A = A0/p1^k`.
 *   - `k = 1`: `A·log|x - a|`.
 *   - `k > 1`: `-A/((k-1)) · (x - a)^{-(k-1)}`.
 */
function integrateLinearTerm(factor: IntPoly, k: number, numer: Rat[], v: string): string {
  const p0 = factor[0];
  const p1 = factor[1];
  const a = ratNeg(ratDiv(ratFromBigint(p0), ratFromBigint(p1)));
  const A = ratDiv(numer[0], ratFromBigint(p1 ** BigInt(k)));
  if (A.num === 0n) {
    return '0';
  }
  const xMinus = renderXMinus(a, v);
  if (k === 1) {
    return renderCoeffTimes(A, `log(abs(${xMinus}))`);
  }
  const coeff = ratNeg(ratDiv(A, ratFromBigint(BigInt(k - 1))));
  return renderCoeffTimes(coeff, `(${xMinus})^(${-(k - 1)})`);
}

/** Rational-part + `atan`-multiplier decomposition of `∫ dx/(x^2+bx+c)^k`. */
interface InverseQuadraticPower {
  /** `Σ coeff · (2x+b)/(x^2+bx+c)^power` — the rational part. */
  terms: Array<{ coeff: Rat; power: number }>;
  /** Coefficient multiplying `I_1 = (2/√(4c-b²))·atan((2x+b)/√(4c-b²))`. */
  atanCoeff: Rat;
}

/**
 * Applies the standard reduction formula for `I_k = ∫ dx/(x^2+bx+c)^k`
 * (disc `b²-4c < 0`, so `D2 = 4c-b² > 0`), exactly over ℚ, down to `I_1`:
 *
 *   I_k = (2x+b)/((k-1)·D2·q^{k-1}) + (2(2k-3)/((k-1)·D2))·I_{k-1}.
 *
 * Returns the accumulated rational-part coefficients plus the scalar
 * multiplying `I_1` (which the caller renders as the `atan` term).
 */
function integrateInverseQuadraticPower(k: number, b: Rat, c: Rat): InverseQuadraticPower {
  if (k === 1) {
    return { terms: [], atanCoeff: ratFromBigint(1n) };
  }
  const prev = integrateInverseQuadraticPower(k - 1, b, c);
  const d2 = ratSub(ratMul(ratFromBigint(4n), c), ratMul(b, b));
  const denomFactor = ratMul(ratFromBigint(BigInt(k - 1)), d2);
  const newTermCoeff = ratDiv(ratFromBigint(1n), denomFactor);
  const propagate = ratDiv(ratFromBigint(BigInt(2 * (2 * k - 3))), denomFactor);
  const terms = prev.terms.map((t) => ({ coeff: ratMul(t.coeff, propagate), power: t.power }));
  terms.push({ coeff: newTermCoeff, power: k - 1 });
  return { terms, atanCoeff: ratMul(prev.atanCoeff, propagate) };
}

/**
 * Closed-form integral of `(D·x + E) / (x^2+bx+c)^k` for an irreducible
 * quadratic factor (`disc < 0`). The (possibly non-monic) factor
 * `factor = [q0, q1, q2]` is normalized to monic by absorbing `q2^k`
 * (`b = q1/q2`, `c = q0/q2`, `D = D0/q2^k`, `E = E0/q2^k`). Splitting
 * `Dx+E = (D/2)(2x+b) + (E - Db/2)`:
 *   - the `(D/2)(2x+b)` part integrates by `u = x^2+bx+c` → `(D/2)·log(q)`
 *     (`k=1`) or `-(D/2)/(k-1)·q^{-(k-1)}` (`k>1`);
 *   - the constant part `K = E - Db/2` uses `K·I_k` (reduction formula),
 *     yielding rational `(2x+b)/q^j` terms plus the `atan` term.
 */
function integrateQuadraticTerm(factor: IntPoly, k: number, numer: Rat[], v: string): string {
  const q0 = factor[0];
  const q1 = factor[1];
  const q2 = factor[2];
  const b = ratDiv(ratFromBigint(q1), ratFromBigint(q2));
  const c = ratDiv(ratFromBigint(q0), ratFromBigint(q2));
  const leadPow = ratFromBigint(q2 ** BigInt(k));
  const D = ratDiv(numer[1], leadPow);
  const E = ratDiv(numer[0], leadPow);
  const d2 = ratSub(ratMul(ratFromBigint(4n), c), ratMul(b, b));
  const K = ratSub(E, ratMul(D, ratDiv(b, ratFromBigint(2n))));
  const qCore = renderQuadraticCore(b, c, v);
  const twoXb = renderTwoXPlusB(b, v);
  const parts: string[] = [];

  // Part 1: the (D/2)(2x+b) piece — a pure rational/log part via u = q.
  if (D.num !== 0n) {
    const half = ratDiv(D, ratFromBigint(2n));
    if (k === 1) {
      parts.push(renderCoeffTimes(half, `log(${qCore})`));
    } else {
      const coeff = ratNeg(ratDiv(half, ratFromBigint(BigInt(k - 1))));
      parts.push(renderCoeffTimes(coeff, `(${qCore})^(${-(k - 1)})`));
    }
  }

  // Part 2: the constant part K = E - Db/2, integrated via K·I_k.
  if (K.num !== 0n) {
    const ik = integrateInverseQuadraticPower(k, b, c);
    for (const t of ik.terms) {
      const coeff = ratMul(K, t.coeff);
      if (coeff.num === 0n) {
        continue;
      }
      parts.push(renderCoeffTimes(coeff, `(${twoXb})/(${qCore})^(${t.power})`));
    }
    const atanCoeff = ratMul(ratMul(K, ik.atanCoeff), ratFromBigint(2n));
    if (atanCoeff.num !== 0n) {
      const d2s = ratToStr(d2);
      parts.push(renderCoeffTimes(atanCoeff, `atan((${twoXb})/sqrt(${d2s}))/sqrt(${d2s})`));
    }
  }

  return joinTerms(parts);
}

/**
 * Closed-form integral of `(D·x + E) / (a·x² + b·x + c)` for a POSITIVE-
 * discriminant irreducible quadratic factor (`factor = [c, b, a]`, power 1,
 * `R = b²−4ac > 0` a non-square integer). The factor splits over the quadratic
 * surd `√R` into `a·(x − r₁)(x − r₂)` with real irrational roots
 * `r₁,₂ = (−b ± √R)/(2a)`, and real partial fractions give
 *   `(Dx+E)/(a(x−r₁)(x−r₂)) = A/(x−r₁) + B/(x−r₂)`,
 *   `A = (D·r₁+E)/(a·(r₁−r₂))`,  `B = (D·r₂+E)/(a·(r₂−r₁))`,
 * where `a·(r₁−r₂) = √R` and `a·(r₂−r₁) = −√R` exactly. The integral is
 * `A·log|x−r₁| + B·log|x−r₂|`, rendered with `log(abs(...))` (the log arguments
 * are real and can be negative). All arithmetic is exact `Surd` over `√R`;
 * correctness is verified by differentiation (the string form is not
 * contractual).
 */
function integrateQuadraticPosTerm(factor: IntPoly, numer: Rat[], v: string): string {
  const c = factor[0];
  const b = factor[1];
  const a = factor[2];
  const R = b * b - 4n * a * c; // discInt > 0, non-square (guaranteed by factorDenominator)
  const D = numer[1] ?? RAT_ZERO;
  const E = numer[0] ?? RAT_ZERO;

  const twoA = ratFromBigint(2n * a);
  const negBOver2A = ratDiv(ratFromBigint(-b), twoA); // −b/(2a)
  const inv2A = ratDiv(ratFromBigint(1n), twoA); // 1/(2a)
  const r1: Surd = { a: negBOver2A, b: inv2A }; // (−b + √R)/(2a)
  const r2: Surd = { a: negBOver2A, b: ratNeg(inv2A) }; // (−b − √R)/(2a)

  // a·(r₁−r₂) = √R, a·(r₂−r₁) = −√R (the leading `a` cancels the 1/a in rᵢ).
  const sqrtR: Surd = { a: RAT_ZERO, b: ratFromBigint(1n) };
  const Dsurd = surdFromRat(D);
  const Esurd = surdFromRat(E);
  const numA = surdAdd(surdMul(Dsurd, r1, R), Esurd); // D·r₁ + E
  const numB = surdAdd(surdMul(Dsurd, r2, R), Esurd); // D·r₂ + E
  const A = surdDiv(numA, sqrtR, R);
  const B = surdDiv(numB, surdNeg(sqrtR), R);

  const parts: string[] = [];
  const emit = (coeff: Surd, root: Surd): void => {
    if (coeff.a.num === 0n && coeff.b.num === 0n) {
      return;
    }
    parts.push(`(${surdRender(coeff, R)})*log(abs(${v} - (${surdRender(root, R)})))`);
  };
  emit(A, r1);
  emit(B, r2);
  return joinTerms(parts);
}

/**
 * Integrates a single partial-fraction term in closed form. Dispatches on the
 * degree of `term.factor` and, for a quadratic, on its discriminant sign:
 *   - degree 1 → `log` (+ rational part for a repeated factor);
 *   - degree 2, `disc < 0` (complex roots) → `log`/rational part + `atan`;
 *   - degree 2, `disc > 0` (real irrational roots, power 1) → a pair of real
 *     `log`s with quadratic-surd coefficients (Layer 2).
 * The produced string is evaluable by the expression engine (`log`, `atan`,
 * `sqrt`, `abs`, `^`, `*`); its exact form is not contractual — correctness is
 * verified by differentiation. Throws on any other factor degree, or on a
 * positive-discriminant quadratic with power > 1 (both unreachable for a
 * `factorDenominator`-classified factor).
 */
export function integratePFTerm(term: PFTerm, v: string): string {
  const factor = trimIntPoly(term.factor);
  const deg = factor.length - 1;
  if (deg === 1) {
    return integrateLinearTerm(factor, term.power, term.numer, v);
  }
  if (deg === 2) {
    const disc = factor[1] * factor[1] - 4n * factor[2] * factor[0];
    if (disc < 0n) {
      return integrateQuadraticTerm(factor, term.power, term.numer, v);
    }
    if (term.power !== 1) {
      throw new Error('integratePFTerm: repeated positive-discriminant quadratic is out of scope');
    }
    return integrateQuadraticPosTerm(factor, term.numer, v);
  }
  throw new Error(`integratePFTerm: unsupported factor degree ${deg}`);
}

/**
 * Full Layer-1 rational-function integration pipeline. Parses `expr` into an
 * exact integer rational function, splits off and integrates the polynomial
 * part, factors the denominator into linear + irreducible-quadratic factors,
 * decomposes into exact-ℚ partial fractions, and integrates each term in
 * closed form (rational part + `log` + `atan`).
 *
 * Returns `null` when `expr` is not a rational function of `v`
 * (`parseRationalFunction` declines), when the denominator has a degree-≥3
 * irreducible factor (`factorDenominator` declines — Layer 2 territory), or
 * when any internal step throws (e.g. a non-integer polynomial-part division),
 * so callers get a clean decline rather than an exception.
 */
export function integrateRationalFunction(expr: string, v: string): string | null {
  try {
    const rf = parseRationalFunction(expr, v);
    if (rf === null) {
      return null;
    }
    const factors = factorDenominator(rf.denom);
    if (factors === null) {
      return null;
    }
    const { quotient, remainder } = polynomialPart(rf);
    const terms = partialFractions(remainder, factors);

    // `factorDenominator` (via `factorUnivariateZ`) returns the PRIMITIVE
    // irreducible factors, dropping the integer leading constant, so
    // `∏ factorᵢ^{multᵢ}` may differ from the true `denom` by a bigint scale
    // (e.g. `2*x^2+2 = 2·(x^2+1)`). The partial fractions above are therefore a
    // decomposition of `remainder / (denom/scale)`; divide every term's
    // numerator by `scale` to recover `remainder / denom`. Without this,
    // content-> 1 denominators integrate to `scale ×` the correct answer.
    let prod: IntPoly = [1n];
    for (const { poly, mult } of factors) {
      for (let k = 0; k < mult; k += 1) prod = mulIntPoly(prod, poly);
    }
    const scalePoly = exactDivideIntPoly(rf.denom, prod);
    if (scalePoly !== null && scalePoly.length === 1 && scalePoly[0] !== 1n) {
      const scale = ratFromBigint(scalePoly[0]);
      for (const term of terms) {
        term.numer = term.numer.map((c) => ratDiv(c, scale));
      }
    }

    const parts: string[] = [];
    const polyPart = integratePolynomial(quotient, v);
    if (polyPart !== '0') {
      parts.push(polyPart);
    }
    for (const term of terms) {
      const s = integratePFTerm(term, v);
      if (s !== '0') {
        parts.push(s);
      }
    }
    return joinTerms(parts);
  } catch {
    return null;
  }
}
