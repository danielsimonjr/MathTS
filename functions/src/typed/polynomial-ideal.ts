/**
 * Exact multivariate polynomial arithmetic + Buchberger's algorithm (B-5).
 *
 * Replaces the former groebnerBasis internals, which (a) extracted coefficients
 * by evaluating at unit points — unable to distinguish `x` from `x²` (both are 1
 * at x = 1) — and (b) never ran Buchberger at all (the "basis" was the parsed
 * inputs). Polynomials are parsed EXACTLY from the expression AST (`parse`), so
 * coefficients are never inferred numerically; division and S-polynomial
 * reduction use graded-free lex order (first variable most significant).
 *
 * Scope: small systems (the CAS surface's documented target). Iteration and
 * basis-size caps throw an honest error instead of returning wrong results.
 */

/** One monomial: coefficient × Π varsᵢ^powersᵢ (dense exponent vector). */
export interface Term {
  coeff: number;
  powers: number[];
}

/** A polynomial: combined, lex-sorted (descending), no near-zero coefficients. */
export type Poly = Term[];

const EPS = 1e-10;

/** Lex compare on exponent vectors: positive when a > b. */
function cmpPowers(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** Combine like terms, drop |coeff| ≤ EPS, sort lex-descending. */
export function normalize(p: Poly): Poly {
  const byKey = new Map<string, Term>();
  for (const t of p) {
    const key = t.powers.join(',');
    const existing = byKey.get(key);
    if (existing) existing.coeff += t.coeff;
    else byKey.set(key, { coeff: t.coeff, powers: [...t.powers] });
  }
  const out: Poly = [];
  for (const t of byKey.values()) {
    if (Math.abs(t.coeff) > EPS) {
      out.push(t);
    }
  }
  return out.sort((a, b) => cmpPowers(b.powers, a.powers));
}

export function polyAdd(a: Poly, b: Poly): Poly {
  return normalize([...a, ...b]);
}

export function polyNeg(a: Poly): Poly {
  const out: Poly = [];
  for (let i = 0; i < a.length; i++) {
    out.push({ coeff: -a[i].coeff, powers: [...a[i].powers] });
  }
  return out;
}

export function polySub(a: Poly, b: Poly): Poly {
  return polyAdd(a, polyNeg(b));
}

export function polyMul(a: Poly, b: Poly): Poly {
  const out: Poly = [];
  for (const ta of a) {
    for (const tb of b) {
      const powers = new Array(ta.powers.length);
      for (let i = 0; i < ta.powers.length; i++) {
        powers[i] = ta.powers[i] + tb.powers[i];
      }
      out.push({
        coeff: ta.coeff * tb.coeff,
        powers,
      });
    }
  }
  return normalize(out);
}

function polyPow(a: Poly, n: number, nVars: number): Poly {
  let result: Poly = [{ coeff: 1, powers: new Array<number>(nVars).fill(0) }];
  for (let i = 0; i < n; i++) result = polyMul(result, a);
  return result;
}

// ---------------------------------------------------------------------------
// Exact expression → Poly (self-contained recursive-descent parser)
// ---------------------------------------------------------------------------
//
// Deliberately dependency-free: importing the factory-scope `parse` from
// `factories/evaluate.js` created the runtime cycle
//   factories/evaluate → typed/index → typed/algebra → polynomial-ideal → factories/evaluate
// (the same cycle `cas.ts` avoids only by being excluded from typed/index).
// The polynomial grammar is small enough to parse exactly here:
//
//   expr   := term (('+' | '-') term)*
//   term   := factor (('*' | '/') factor)*
//   factor := ('+' | '-')* atom ('^' unsigned-integer)?
//   atom   := number | identifier | '(' expr ')'
//
// Division only by a nonzero numeric constant; exponents only non-negative
// integer literals. Anything else throws — no fabricated coefficients.

/**
 * Convert a polynomial expression string to a {@link Poly} over `vars` — exactly.
 * Supports numeric constants, the given variables, `+ − * / ^`, unary minus and
 * parentheses, with `/` restricted to nonzero numeric-constant divisors and `^`
 * to non-negative integer literal exponents. Unknown symbols throw.
 */
export function polyFromExpression(expr: string, vars: string[]): Poly {
  const nVars = vars.length;
  const varIndex = new Map();
  for (let i = 0; i < vars.length; i++) {
    varIndex.set(vars[i], i);
  }
  let pos = 0;

  const constPoly = (v: number): Poly =>
    normalize([{ coeff: v, powers: new Array<number>(nVars).fill(0) }]);

  function constOf(p: Poly): number | null {
    if (p.length === 0) return 0;
    if (p.length === 1) {
      let isConst = true;
      for (let i = 0; i < p[0].powers.length; i++) {
        if (p[0].powers[i] !== 0) {
          isConst = false;
          break;
        }
      }
      if (isConst) return p[0].coeff;
    }
    return null;
  }

  const skipWs = (): void => {
    while (pos < expr.length && /\s/.test(expr[pos])) pos++;
  };
  const peek = (): string => {
    skipWs();
    return expr[pos] ?? '';
  };
  const fail = (msg: string): never => {
    throw new Error(`polynomial parse: ${msg} (at position ${pos} in '${expr}')`);
  };

  function parseNumber(): number {
    skipWs();
    const m = /^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(expr.slice(pos));
    if (!m) return fail('expected a number');
    pos += m[0].length;
    return Number(m[0]);
  }

  function parseAtom(): Poly {
    const c = peek();
    if (c === '(') {
      pos++;
      const inner = parseExpr();
      if (peek() !== ')') fail("expected ')'");
      pos++;
      return inner;
    }
    if (/[0-9.]/.test(c)) return constPoly(parseNumber());
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(expr.slice(pos));
    if (m) {
      pos += m[0].length;
      const idx = varIndex.get(m[0]);
      if (idx === undefined) {
        return fail(`unknown symbol '${m[0]}' (declared variables: ${vars.join(', ')})`);
      }
      const powers = new Array<number>(nVars).fill(0);
      powers[idx] = 1;
      return [{ coeff: 1, powers }];
    }
    return fail(`unexpected character '${c}'`);
  }

  function parseFactor(): Poly {
    let sign = 1;
    while (peek() === '+' || peek() === '-') {
      if (expr[pos] === '-') sign = -sign;
      pos++;
    }
    let base = parseAtom();
    if (peek() === '^') {
      pos++;
      // exponent: an unsigned integer literal (optionally parenthesized)
      let e: number;
      if (peek() === '(') {
        pos++;
        const inner = constOf(parseExpr());
        if (peek() !== ')') fail("expected ')' after exponent");
        pos++;
        if (inner === null) return fail('exponent must be a numeric constant');
        e = inner;
      } else {
        e = parseNumber();
      }
      if (!Number.isInteger(e) || e < 0) {
        return fail('exponent must be a non-negative integer constant');
      }
      base = polyPow(base, e, nVars);
    }
    return sign === 1 ? base : polyNeg(base);
  }

  function parseTerm(): Poly {
    let p = parseFactor();
    for (;;) {
      const c = peek();
      if (c === '*') {
        pos++;
        p = polyMul(p, parseFactor());
      } else if (c === '/') {
        pos++;
        const denom = constOf(parseFactor());
        if (denom === null || Math.abs(denom) <= EPS) {
          return fail('division only by a nonzero numeric constant');
        }
        const nextP: Poly = [];
        for (let i = 0; i < p.length; i++) {
          nextP.push({ coeff: p[i].coeff / denom, powers: p[i].powers });
        }
        p = normalize(nextP);
      } else {
        break;
      }
    }
    return p;
  }

  function parseExpr(): Poly {
    let p = parseTerm();
    for (;;) {
      const c = peek();
      if (c === '+') {
        pos++;
        p = polyAdd(p, parseTerm());
      } else if (c === '-') {
        pos++;
        p = polySub(p, parseTerm());
      } else {
        break;
      }
    }
    return p;
  }

  const result = parseExpr();
  skipWs();
  if (pos !== expr.length) fail(`unexpected trailing input '${expr.slice(pos)}'`);
  return result;
}

// ---------------------------------------------------------------------------
// Division + Buchberger
// ---------------------------------------------------------------------------

function divides(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] > b[i]) return false;
  }
  return true;
}

function totalDegree(powers: number[]): number {
  let sum = 0;
  for (let i = 0; i < powers.length; i++) sum += powers[i];
  return sum;
}

/**
 * A spatial index grouping divisor polynomials by their leading term's total degree.
 * This filters out polynomials whose degree exceeds the target term, reducing search overhead.
 */
export class DivisorGeobucket {
  private buckets: Poly[][] = [];
  private maxDeg = 0;

  constructor(polys: Poly[]) {
    for (const p of polys) this.insert(p);
  }

  insert(poly: Poly): void {
    if (poly.length === 0) return;
    const d = totalDegree(poly[0].powers);
    if (!this.buckets[d]) this.buckets[d] = [];
    this.buckets[d].push(poly);
    if (d > this.maxDeg) this.maxDeg = d;
  }

  find(target: number[]): Poly | undefined {
    const d = totalDegree(target);
    const limit = d < this.maxDeg ? d : this.maxDeg;
    for (let i = 0; i <= limit; i++) {
      const bucket = this.buckets[i];
      if (!bucket) continue;
      for (let j = 0; j < bucket.length; j++) {
        if (divides(bucket[j][0].powers, target)) {
          return bucket[j];
        }
      }
    }
    return undefined;
  }
}

/** Remainder of p on multivariate division by G (lex order). */
export function polyReduce(p: Poly, G: Poly[] | DivisorGeobucket): Poly {
  const rem: Poly = [];
  let work = normalize(p);
  let guard = 0;
  const index = Array.isArray(G) ? new DivisorGeobucket(G) : G;
  while (work.length > 0) {
    if (++guard > 20_000) {
      throw new Error('polyReduce: iteration cap exceeded (system too large for this CAS)');
    }
    const lt = work[0];
    const g = index.find(lt.powers);
    if (g) {
      const powers = new Array(lt.powers.length);
      for (let i = 0; i < lt.powers.length; i++) {
        powers[i] = lt.powers[i] - g[0].powers[i];
      }
      const factor: Poly = [
        {
          coeff: lt.coeff / g[0].coeff,
          powers,
        },
      ];
      work = polySub(work, polyMul(factor, g));
    } else {
      rem.push(lt);
      work = work.slice(1);
    }
  }
  return normalize(rem);
}

function lcmPowers(a: number[], b: number[]): number[] {
  const len = a.length;
  const out = new Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = Math.max(a[i], b[i]);
  }
  return out;
}

function sPoly(f: Poly, g: Poly): Poly {
  const l = lcmPowers(f[0].powers, g[0].powers);
  const mfPowers = new Array(l.length);
  const mgPowers = new Array(l.length);
  for (let i = 0; i < l.length; i++) {
    mfPowers[i] = l[i] - f[0].powers[i];
    mgPowers[i] = l[i] - g[0].powers[i];
  }
  const mf: Poly = [{ coeff: 1 / f[0].coeff, powers: mfPowers }];
  const mg: Poly = [{ coeff: 1 / g[0].coeff, powers: mgPowers }];
  return polySub(polyMul(mf, f), polyMul(mg, g));
}

/** Leading-coefficient-normalize (monic). */
function monic(p: Poly): Poly {
  if (p.length === 0) return p;
  const c = p[0].coeff;
  const out: Poly = [];
  for (let i = 0; i < p.length; i++) {
    out.push({ coeff: p[i].coeff / c, powers: [...p[i].powers] });
  }
  return out;
}

/**
 * Buchberger's algorithm with honest caps: returns the REDUCED Gröbner basis
 * (monic, minimal, fully inter-reduced) in lex order over the given variable
 * ordering, or throws if the caps are exceeded.
 */
export function buchberger(input: Poly[]): Poly[] {
  let G: Poly[] = [];
  for (let i = 0; i < input.length; i++) {
    const p = normalize(input[i]);
    if (p.length > 0) {
      G.push(monic(p));
    }
  }
  if (G.length === 0) return [];

  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < G.length; i++) {
    for (let j = i + 1; j < G.length; j++) pairs.push([i, j]);
  }

  let iter = 0;
  const index = new DivisorGeobucket(G);
  while (pairs.length > 0) {
    if (++iter > 2_000 || G.length > 64) {
      throw new Error('groebnerBasis: system too large (iteration/basis cap exceeded)');
    }
    const [i, j] = pairs.shift()!;
    const s = polyReduce(sPoly(G[i], G[j]), index);
    if (s.length > 0) {
      const k = G.length;
      const newPoly = monic(s);
      G.push(newPoly);
      index.insert(newPoly);
      for (let t = 0; t < k; t++) pairs.push([t, k]);
    }
  }

  // Minimalize: drop g whose leading monomial is divisible by another's.
  const minimalG: Poly[] = [];
  for (let i = 0; i < G.length; i++) {
    const g = G[i];
    let isDivisible = false;
    for (let j = 0; j < G.length; j++) {
      if (i === j) continue;
      const h = G[j];
      if (
        h.length > 0 &&
        divides(h[0].powers, g[0].powers) &&
        (cmpPowers(h[0].powers, g[0].powers) !== 0 || j < i)
      ) {
        isDivisible = true;
        break;
      }
    }
    if (!isDivisible) minimalG.push(g);
  }
  G = minimalG;

  // Inter-reduce tails.
  const reducedG: Poly[] = [];
  for (let i = 0; i < G.length; i++) {
    const others: Poly[] = [];
    for (let j = 0; j < G.length; j++) {
      if (i !== j) others.push(G[j]);
    }
    const reduced = monic(polyReduce(G[i], others));
    if (reduced.length > 0) reducedG.push(reduced);
  }
  G = reducedG;

  // Deterministic order: by leading monomial, descending.
  G.sort((a, b) => cmpPowers(b[0].powers, a[0].powers));
  return G;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Format a Poly back to an expression string (constant-first, like `-1 + 1*y + 1*x^2`). */
export function polyToString(p: Poly, vars: string[]): string {
  if (p.length === 0) return '0';
  const fmt = (c: number): string => {
    const r = Math.round(c);
    return Math.abs(c - r) < 1e-9 ? String(r) : String(Number(c.toPrecision(12)));
  };
  const terms: string[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const t = p[i];
    const parts: string[] = [];
    for (let j = 0; j < t.powers.length; j++) {
      const e = t.powers[j];
      if (e === 1) parts.push(vars[j]);
      else if (e > 1) parts.push(`${vars[j]}^${e}`);
    }
    const varPart = parts.join('*');
    terms.push(varPart ? `${fmt(t.coeff)}*${varPart}` : fmt(t.coeff));
  }
  return terms.join(' + ').replace(/\+ -/g, '- ');
}
