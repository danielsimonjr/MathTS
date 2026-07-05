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
  return [...byKey.values()]
    .filter((t) => Math.abs(t.coeff) > EPS)
    .sort((a, b) => cmpPowers(b.powers, a.powers));
}

export function polyAdd(a: Poly, b: Poly): Poly {
  return normalize([...a, ...b]);
}

export function polyNeg(a: Poly): Poly {
  return a.map((t) => ({ coeff: -t.coeff, powers: [...t.powers] }));
}

export function polySub(a: Poly, b: Poly): Poly {
  return polyAdd(a, polyNeg(b));
}

export function polyMul(a: Poly, b: Poly): Poly {
  const out: Poly = [];
  for (const ta of a) {
    for (const tb of b) {
      out.push({
        coeff: ta.coeff * tb.coeff,
        powers: ta.powers.map((p, i) => p + tb.powers[i]),
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
  const varIndex = new Map(vars.map((v, i) => [v, i]));
  let pos = 0;

  const constPoly = (v: number): Poly =>
    normalize([{ coeff: v, powers: new Array<number>(nVars).fill(0) }]);

  function constOf(p: Poly): number | null {
    if (p.length === 0) return 0;
    if (p.length === 1 && p[0].powers.every((x) => x === 0)) return p[0].coeff;
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
        p = normalize(p.map((t) => ({ coeff: t.coeff / denom, powers: t.powers })));
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
  return a.every((p, i) => p <= b[i]);
}

/** Remainder of p on multivariate division by G (lex order). */
export function polyReduce(p: Poly, G: Poly[]): Poly {
  const rem: Poly = [];
  let work = normalize(p);
  let guard = 0;
  while (work.length > 0) {
    if (++guard > 20_000) {
      throw new Error('polyReduce: iteration cap exceeded (system too large for this CAS)');
    }
    const lt = work[0];
    const g = G.find((q) => q.length > 0 && divides(q[0].powers, lt.powers));
    if (g) {
      const factor: Poly = [
        {
          coeff: lt.coeff / g[0].coeff,
          powers: lt.powers.map((x, i) => x - g[0].powers[i]),
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
  return a.map((x, i) => Math.max(x, b[i]));
}

function sPoly(f: Poly, g: Poly): Poly {
  const l = lcmPowers(f[0].powers, g[0].powers);
  const mf: Poly = [{ coeff: 1 / f[0].coeff, powers: l.map((x, i) => x - f[0].powers[i]) }];
  const mg: Poly = [{ coeff: 1 / g[0].coeff, powers: l.map((x, i) => x - g[0].powers[i]) }];
  return polySub(polyMul(mf, f), polyMul(mg, g));
}

/** Leading-coefficient-normalize (monic). */
function monic(p: Poly): Poly {
  if (p.length === 0) return p;
  const c = p[0].coeff;
  return p.map((t) => ({ coeff: t.coeff / c, powers: [...t.powers] }));
}

/**
 * Buchberger's algorithm with honest caps: returns the REDUCED Gröbner basis
 * (monic, minimal, fully inter-reduced) in lex order over the given variable
 * ordering, or throws if the caps are exceeded.
 */
export function buchberger(input: Poly[]): Poly[] {
  let G = input
    .map(normalize)
    .filter((p) => p.length > 0)
    .map(monic);
  if (G.length === 0) return [];

  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < G.length; i++) {
    for (let j = i + 1; j < G.length; j++) pairs.push([i, j]);
  }

  let iter = 0;
  while (pairs.length > 0) {
    if (++iter > 2_000 || G.length > 64) {
      throw new Error('groebnerBasis: system too large (iteration/basis cap exceeded)');
    }
    const [i, j] = pairs.shift()!;
    const s = polyReduce(sPoly(G[i], G[j]), G);
    if (s.length > 0) {
      const k = G.length;
      G.push(monic(s));
      for (let t = 0; t < k; t++) pairs.push([t, k]);
    }
  }

  // Minimalize: drop g whose leading monomial is divisible by another's.
  G = G.filter(
    (g, i) =>
      !G.some(
        (h, j) =>
          j !== i &&
          h.length > 0 &&
          divides(h[0].powers, g[0].powers) &&
          (cmpPowers(h[0].powers, g[0].powers) !== 0 || j < i)
      )
  );
  // Inter-reduce tails.
  G = G.map((g, i) =>
    monic(
      polyReduce(
        g,
        G.filter((_, j) => j !== i)
      )
    )
  ).filter((g) => g.length > 0);
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
  const terms = [...p].reverse().map((t) => {
    const varPart = t.powers
      .map((e, i) => (e === 0 ? '' : e === 1 ? vars[i] : `${vars[i]}^${e}`))
      .filter(Boolean)
      .join('*');
    return varPart ? `${fmt(t.coeff)}*${varPart}` : fmt(t.coeff);
  });
  return terms.join(' + ').replace(/\+ -/g, '- ');
}
