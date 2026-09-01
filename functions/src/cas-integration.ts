/**
 * Symbolic indefinite integration (Wave D / remaining). A recursive antiderivative
 * over a useful subset — polynomials, the power rule, linearity, constant multiples,
 * `1/x → ln`, and linear-substitution for `sin`/`cos`/`exp`/`ln`/`sinh`/`cosh`
 * (arguments `a·x+b`). Reuses the CAS `parse` for the AST and `evaluate` for the
 * linearity test. Complements the numerical `integrate`.
 *
 * Three extension methods run as fallbacks when the direct recursion can't
 * handle the integrand (see {@link symbolicIntegral}):
 *  - **Partial-fraction integration** of a single-variable rational function
 *    `P(x)/Q(x)`: composes the CAS `apart` decomposition with term-wise
 *    integration (each `A/(x−r)` → `A·ln|x−r|`). Handles distinct-rational-root
 *    denominators.
 *  - **Integration by parts** (tabular) for `p(x)·g(a·x+b)` where `p` is a
 *    polynomial and `g ∈ {exp, sin, cos}`: `∫ x·eˣ = (x−1)·eˣ`,
 *    `∫ x·sin x = sin x − x·cos x`, etc.
 *  - **Full rational-function integration** (Risch Layer 1,
 *    {@link integrateRationalFunction}) for any `P(x)/Q(x)` over ℚ whose
 *    denominator factors into linear + irreducible-quadratic factors —
 *    including **repeated** and **irreducible-quadratic** denominators the
 *    `apart` path can't split — producing the rational part + `log` + `arctan`.
 *    Degree-≥3 irreducible and repeated positive-discriminant-quadratic
 *    denominators are handled by Risch Layer 3 (Hermite + Rothstein–Trager /
 *    residue formula).
 *
 * NOTE: the package's CAS `simplify`/`derivative` throw on non-integer coefficients
 * (a separate bug — they BigInt-convert constants), so this builds clean output
 * directly and does not route results through `simplify`.
 *
 * OUT OF SCOPE (returns an unevaluated `integral(expr, v)` marker rather than a
 * wrong answer): general u-substitution / a full transcendental Risch-style
 * integrator, non-linear inner arguments (`sin(x^2)`), products of two
 * transcendental factors (`sin(x)·cos(x)` beyond a trig identity), a full
 * transcendental Risch decision procedure (nested exp/log towers that prove
 * non-elementarity), and `tan`/`sec`/…. Rational functions of any degree,
 * including irreducible cubics+, are in scope (Layers 1–3).
 */
import { parse as _parseRaw } from './factories/evaluate.js';
import { evaluate as _evaluateRaw } from './factories/evaluate.js';
import { apart, variables } from './typed/algebra.js';
import { polyFromExpression } from './typed/polynomial-ideal.js';
import { integrateRationalFunction } from './cas/rational-integrate.js';

interface Node {
  type: string;
  value?: number;
  name?: string;
  op?: string;
  args?: Node[];
  content?: Node;
  fn?: { name: string };
  toString(): string;
}
const parse = _parseRaw as unknown as (s: string) => Node;
const evaluate = _evaluateRaw as unknown as (s: string, scope?: Record<string, number>) => number;

class NotIntegrable extends Error {}

/**
 * Evaluate a constant sub-expression to a finite number. A symbolic constant (a free
 * parameter like `a` or `n`) can't be reduced numerically — route that to NotIntegrable
 * so `symbolicIntegral` returns its `integral(...)` marker instead of leaking the
 * evaluator's "Undefined symbol" error, honoring the documented out-of-scope contract.
 */
function evalConst(s: string): number {
  let v: number;
  try {
    v = evaluate(s);
  } catch {
    throw new NotIntegrable(`non-numeric constant ${s}`);
  }
  if (!Number.isFinite(v)) throw new NotIntegrable(`non-finite constant ${s}`);
  return v;
}

/** Unwrap a ParenthesisNode to its content. */
const unwrap = (n: Node): Node =>
  n.type === 'ParenthesisNode' && n.content ? unwrap(n.content) : n;

/** True if `node` contains no occurrence of the integration variable `x`. */
function isConst(n: Node, x: string): boolean {
  const node = unwrap(n);
  if (node.type === 'SymbolNode') return node.name !== x;
  if (node.type === 'ConstantNode') return true;
  return [...(node.args ?? []), ...(node.content ? [node.content] : [])].every((a) =>
    isConst(a, x)
  );
}

/** Format a numeric coefficient as a compact string (integers bare, else short decimal). */
function num(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(15)));
}

/** If `u` is linear in `x` (`a·x + b`), return slope `a` (constant), else null. */
function linearSlope(u: string, x: string): number | null {
  try {
    // a = u(x+1) − u(x); linear ⟺ this is independent of x (check two points)
    const a1 = evaluate(u, { [x]: 1 }) - evaluate(u, { [x]: 0 });
    const a2 = evaluate(u, { [x]: 5 }) - evaluate(u, { [x]: 4 });
    if (Math.abs(a1 - a2) < 1e-9 && Math.abs(a1) > 1e-12) return a1;
    return null;
  } catch (e) {
    // A free symbol (u carries a parameter other than x) can't be evaluated → treat as
    // "not linear" (→ out of scope → marker). A genuine evaluator error must NOT be
    // silently equated with non-linearity; re-throw anything that isn't a free symbol.
    if (e instanceof Error && /undefined symbol/i.test(e.message)) return null;
    throw e;
  }
}

/** Recursively integrate `node` w.r.t. `x`, returning an expression string. */
function integrateNode(raw: Node, x: string): string {
  const node = unwrap(raw);
  if (isConst(node, x)) return `${node.toString()} * ${x}`;

  switch (node.type) {
    case 'SymbolNode':
      return `${x}^2 / 2`; // node is x

    case 'OperatorNode': {
      const args = (node.args ?? []).map(unwrap);
      if (node.op === '+') return args.map((a) => integrateNode(a, x)).join(' + ');
      if (node.op === '-' && args.length === 2)
        return `${integrateNode(args[0], x)} - (${integrateNode(args[1], x)})`;
      if (node.op === '-' && args.length === 1) return `-(${integrateNode(args[0], x)})`;

      if (node.op === '*') {
        const consts = args.filter((a) => isConst(a, x));
        const varying = args.filter((a) => !isConst(a, x));
        if (varying.length === 1) {
          const c = consts.map((a) => `(${a.toString()})`).join(' * ');
          const inner = integrateNode(varying[0], x);
          return c ? `${c} * (${inner})` : inner;
        }
        throw new NotIntegrable('product of x-dependent factors');
      }

      if (node.op === '/') {
        if (isConst(args[1], x)) return `(${integrateNode(args[0], x)}) / (${args[1].toString()})`;
        if (isConst(args[0], x)) {
          const a = linearSlope(args[1].toString(), x);
          if (a !== null) {
            const k = evalConst(args[0].toString()) / a;
            return `${num(k)} * log(abs(${args[1].toString()}))`;
          }
          // 1 / (x * log(x)) → log(log(x))
          const den = unwrap(args[1]);
          if (den.type === 'OperatorNode' && den.op === '*') {
            const df = (den.args ?? []).map(unwrap);
            const hasX = df.some((f) => f.type === 'SymbolNode' && f.name === x);
            const logF = df.find(
              (f) =>
                f.type === 'FunctionNode' &&
                (f.fn?.name === 'log' || f.fn?.name === 'ln') &&
                unwrap((f.args ?? [])[0] ?? f).type === 'SymbolNode' &&
                unwrap((f.args ?? [])[0] ?? f).name === x
            );
            if (hasX && logF && df.length === 2) {
              const k = evalConst(args[0].toString());
              return k === 1 ? `log(log(${x}))` : `${num(k)} * log(log(${x}))`;
            }
          }
        }
        throw new NotIntegrable('general quotient');
      }

      if (node.op === '^') {
        const base = args[0];
        const exp = args[1];
        if (!isConst(exp, x)) throw new NotIntegrable('variable exponent');
        const n = evalConst(exp.toString());
        const a = linearSlope(base.toString(), x);
        if (a === null) throw new NotIntegrable('non-linear base');
        const b = `(${base.toString()})`;
        if (n === -1) return `${num(1 / a)} * log(abs(${b}))`;
        const denom = a * (n + 1);
        return denom === 1 ? `${b}^${num(n + 1)}` : `${b}^${num(n + 1)} / ${num(denom)}`;
      }
      throw new NotIntegrable(`operator ${node.op}`);
    }

    case 'FunctionNode': {
      const fn = node.fn?.name ?? node.name ?? '';
      const u = (node.args ?? [])[0];
      if (!u) throw new NotIntegrable(fn);
      const us = u.toString();
      if (fn === 'log' || fn === 'ln') {
        if (us === x) return `${x} * log(${x}) - ${x}`; // ∫ln x = x·ln x − x
        throw new NotIntegrable('ln of non-trivial argument');
      }
      if (fn === 'sqrt') return integrateNode(parse(`(${us})^(0.5)`), x); // √u = u^½
      const a = linearSlope(us, x);
      if (a === null) throw new NotIntegrable(`non-linear argument of ${fn}`);
      const inv = a === 1 ? '' : ` / ${num(a)}`;
      switch (fn) {
        case 'sin':
          return `-cos(${us})${inv}`;
        case 'cos':
          return `sin(${us})${inv}`;
        case 'exp':
          return `exp(${us})${inv}`;
        case 'sinh':
          return `cosh(${us})${inv}`;
        case 'cosh':
          return `sinh(${us})${inv}`;
        default:
          throw new NotIntegrable(`function ${fn}`);
      }
    }

    default:
      throw new NotIntegrable(node.type);
  }
}

// ---------------------------------------------------------------------------
// Extension method 1: partial-fraction integration of rational functions
// ---------------------------------------------------------------------------

/** Strip whitespace for a form-insensitive equality check. */
const stripWs = (s: string): string => s.replace(/\s+/g, '');

/**
 * Integrate a single-variable rational function `P(x)/Q(x)` by first running the
 * CAS `apart` partial-fraction decomposition, then integrating the resulting
 * sum term-by-term (each `A/(x−r)` → `A·ln|x−r|`, plus any polynomial quotient).
 * Returns null when the input isn't a single-variable rational, when `apart`
 * can't decompose it (repeated / irreducible-quadratic denominator), or when a
 * decomposed term still isn't integrable by {@link integrateNode}.
 */
function tryPartialFractions(expr: string, x: string): string | null {
  const vars = variables(expr);
  if (vars.length !== 1 || vars[0] !== x) return null;
  let decomposed: string;
  try {
    decomposed = apart(expr);
  } catch {
    return null;
  }
  // apart returns the input unchanged when it can't decompose — nothing gained.
  if (stripWs(decomposed) === stripWs(expr)) return null;
  try {
    // integrateNode already handles the +/- sum recursion and each A/(linear)
    // → log term and polynomial-quotient prefix that apart emits.
    return integrateNode(parse(decomposed), x);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Extension method 2: tabular integration by parts for p(x)·g(a·x+b)
// ---------------------------------------------------------------------------

/** Flatten a top-level `*` product into its multiplicative factors. */
function flattenMul(raw: Node): Node[] {
  const n = unwrap(raw);
  if (n.type === 'OperatorNode' && n.op === '*') {
    return (n.args ?? []).flatMap(flattenMul);
  }
  return [n];
}

/** Parse a single-variable polynomial string to dense ascending coefficients. */
function polyDenseFromStr(s: string, x: string): number[] {
  const poly = polyFromExpression(s, [x]); // throws if not a polynomial in x
  let maxPow = 0;
  for (const t of poly) maxPow = Math.max(maxPow, t.powers[0] ?? 0);
  const dense = new Array<number>(maxPow + 1).fill(0);
  for (const t of poly) dense[t.powers[0]] += t.coeff;
  return dense;
}

/** Derivative of a dense ascending-coefficient polynomial. */
function derivDense(c: number[]): number[] {
  if (c.length <= 1) return [0];
  return c.slice(1).map((v, i) => v * (i + 1));
}

/** Format a dense ascending-coefficient polynomial as a string (highest power first). */
function densePolyToStr(coeffs: number[], x: string): string {
  const parts: string[] = [];
  for (let i = coeffs.length - 1; i >= 0; i--) {
    const c = coeffs[i];
    if (Math.abs(c) < 1e-12) continue;
    if (i === 0) parts.push(num(c));
    else {
      const v = i === 1 ? x : `${x}^${i}`;
      if (Math.abs(c - 1) < 1e-12) parts.push(v);
      else if (Math.abs(c + 1) < 1e-12) parts.push(`-${v}`);
      else parts.push(`${num(c)}*${v}`);
    }
  }
  if (parts.length === 0) return '0';
  return parts.join(' + ').replace(/\+ -/g, '- ');
}

/** True when a dense polynomial is identically zero. */
const isZeroDense = (c: number[]): boolean => c.every((v) => Math.abs(v) < 1e-12);

/**
 * The m-th repeated antiderivative (m ≥ 1) of `g(u) ∈ {exp,sin,cos}` at unit
 * slope, as `{ str, sign }` (the `1/aᵐ` scale is applied by the caller).
 */
function repeatedAntideriv(fn: string, u: string, m: number): { str: string; sign: number } {
  if (fn === 'exp') return { str: `exp(${u})`, sign: 1 };
  const rem = (((m - 1) % 4) + 4) % 4;
  if (fn === 'sin') {
    // ∫sin = −cos, ∫∫ = −sin, ∫∫∫ = cos, ∫∫∫∫ = sin (period 4)
    return [
      { str: `cos(${u})`, sign: -1 },
      { str: `sin(${u})`, sign: -1 },
      { str: `cos(${u})`, sign: 1 },
      { str: `sin(${u})`, sign: 1 },
    ][rem];
  }
  // cos: ∫cos = sin, ∫∫ = −cos, ∫∫∫ = −sin, ∫∫∫∫ = cos
  return [
    { str: `sin(${u})`, sign: 1 },
    { str: `cos(${u})`, sign: -1 },
    { str: `sin(${u})`, sign: -1 },
    { str: `cos(${u})`, sign: 1 },
  ][rem];
}

/**
 * Integrate `p(x)·g(a·x+b)` (`g ∈ {exp, sin, cos}`, `p` a polynomial in `x`) via
 * tabular integration by parts:
 *   ∫ p·g dx = Σ_{k≥0} (−1)ᵏ · p⁽ᵏ⁾(x) · G_{k+1}(x),
 * where `G_m` is the m-th repeated antiderivative of `g` (`= sign·trig(u)/aᵐ`
 * for trig, `exp(u)/aᵐ` for exp). The sum terminates because `p⁽ᵏ⁾ = 0` past
 * `deg p`. Returns null when the integrand isn't this shape.
 */
function tryByParts(expr: string, x: string): string | null {
  let root: Node;
  try {
    root = unwrap(parse(expr));
  } catch {
    return null;
  }
  if (root.type !== 'OperatorNode' || root.op !== '*') return null;

  const factors = flattenMul(root);
  const gFactors = factors.filter((f) => f.type === 'FunctionNode');
  if (gFactors.length !== 1) return null;
  const g = gFactors[0];
  const fn = g.fn?.name ?? g.name ?? '';
  if (fn !== 'exp' && fn !== 'sin' && fn !== 'cos') return null;
  const arg = (g.args ?? [])[0];
  if (!arg) return null;
  const u = arg.toString();
  const a = linearSlope(u, x);
  if (a === null) return null;

  // Everything except g must form a polynomial in x (constants included).
  const rest = factors.filter((f) => f !== g);
  const pStr = rest.length ? rest.map((f) => `(${f.toString()})`).join('*') : '1';
  let pk: number[];
  try {
    pk = polyDenseFromStr(pStr, x);
  } catch {
    return null; // rest isn't a pure polynomial in x
  }

  const terms: string[] = [];
  for (let k = 0; !isZeroDense(pk); k++) {
    const m = k + 1;
    const { str: gStr, sign } = repeatedAntideriv(fn, u, m);
    const coeff = (k % 2 === 0 ? 1 : -1) * sign * Math.pow(1 / a, m);
    const polyStr = densePolyToStr(pk, x);
    if (polyStr !== '0') {
      const polyFactor = polyStr === '1' ? '' : `(${polyStr}) * `;
      terms.push(`${num(coeff)} * ${polyFactor}${gStr}`);
    }
    pk = derivDense(pk);
    if (k > 64) break; // guard (unreachable for real polynomials)
  }

  if (terms.length === 0) return null;
  return terms.join(' + ').replace(/\+ -/g, '- ');
}

/**
 * Symbolic indefinite integral of `expr` with respect to `variable` (default `'x'`),
 * returned as an expression string (without the constant of integration). If the
 * integrand is outside the supported subset, returns `integral(expr, variable)`.
 *
 * The direct recursion is tried first; on failure, partial-fraction integration
 * (for distinct-rational-root integrands), tabular integration by parts (for
 * polynomial·{exp,sin,cos}), and full rational-function integration (Risch
 * Layer 1) are attempted before giving up with the marker. Rational functions
 * with irreducible-quadratic, repeated, and degree-≥3 irreducible factors
 * are integrated (Layers 1–3: rational part + `log` + `arctan` / residues).
 * Nested transcendental towers that are not elementary still return the marker.
 *
 * @example symbolicIntegral('x^3')          // 'x^4 / 4'
 * @example symbolicIntegral('cos(3*x + 1)') // 'sin(3 * x + 1) / 3'
 * @example symbolicIntegral('1/(x^2 - 1)')  // partial fractions → sum of logs
 * @example symbolicIntegral('1/(x^2 + 1)')  // Risch Layer 1 → 'atan(...)'
 * @example symbolicIntegral('x * sin(x)')   // by parts → 'sin(x) - x*cos(x)'
 */
export function symbolicIntegral(expr: string, variable = 'x'): string {
  try {
    return integrateNode(parse(expr), variable);
  } catch (e) {
    if (!(e instanceof NotIntegrable)) throw e;
    return (
      tryPartialFractions(expr, variable) ??
      tryByParts(expr, variable) ??
      integrateRationalFunction(expr, variable) ??
      `integral(${expr}, ${variable})`
    );
  }
}
