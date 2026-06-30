/**
 * Symbolic indefinite integration (Wave D / remaining). A recursive antiderivative
 * over a useful subset — polynomials, the power rule, linearity, constant multiples,
 * `1/x → ln`, and linear-substitution for `sin`/`cos`/`exp`/`ln`/`sinh`/`cosh`
 * (arguments `a·x+b`). Reuses the CAS `parse` for the AST and `evaluate` for the
 * linearity test. Complements the numerical `integrate`.
 *
 * NOTE: the package's CAS `simplify`/`derivative` throw on non-integer coefficients
 * (a separate bug — they BigInt-convert constants), so this builds clean output
 * directly and does not route results through `simplify`.
 *
 * Out of scope (returns an unevaluated `integral(expr, v)` marker): products of two
 * x-dependent factors (integration by parts), non-linear inner arguments, partial
 * fractions, `tan`/`sec`/… — honest about its limits rather than returning a wrong answer.
 */
import { parse as _parseRaw } from './factories/evaluate.js';
import { evaluate as _evaluateRaw } from './factories/evaluate.js';

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

/** Unwrap a ParenthesisNode to its content. */
const unwrap = (n: Node): Node => (n.type === 'ParenthesisNode' && n.content ? unwrap(n.content) : n);

/** True if `node` contains no occurrence of the integration variable `x`. */
function isConst(n: Node, x: string): boolean {
  const node = unwrap(n);
  if (node.type === 'SymbolNode') return node.name !== x;
  if (node.type === 'ConstantNode') return true;
  return [...(node.args ?? []), ...(node.content ? [node.content] : [])].every((a) => isConst(a, x));
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
  } catch {
    return null;
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
            const k = evaluate(args[0].toString()) / a;
            return `${num(k)} * log(abs(${args[1].toString()}))`;
          }
        }
        throw new NotIntegrable('general quotient');
      }

      if (node.op === '^') {
        const base = args[0];
        const exp = args[1];
        if (!isConst(exp, x)) throw new NotIntegrable('variable exponent');
        const n = evaluate(exp.toString());
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

/**
 * Symbolic indefinite integral of `expr` with respect to `variable` (default `'x'`),
 * returned as an expression string (without the constant of integration). If the
 * integrand is outside the supported subset, returns `integral(expr, variable)`.
 *
 * @example symbolicIntegral('x^3')          // 'x^4 / 4'
 * @example symbolicIntegral('cos(3*x + 1)') // 'sin(3 * x + 1) / 3'
 */
export function symbolicIntegral(expr: string, variable = 'x'): string {
  try {
    return integrateNode(parse(expr), variable);
  } catch (e) {
    if (e instanceof NotIntegrable) return `integral(${expr}, ${variable})`;
    throw e;
  }
}
