/**
 * Read an expression as a syntax tree, and answer structural questions about it.
 *
 * The CAS solver must not decide the shape of an expression from sample values. A function
 * with period 1 or 0.5, such as `sin(2*pi*x)`, is zero at every integer and half-integer, so a
 * sampled test reads it as the zero polynomial. The helpers here read the tree itself.
 */

import { parse, evaluate } from '../factories/evaluate.js';
import { MAX_POLYNOMIAL_DEGREE, PolynomialDegreeError } from './polynomial-limits.js';

export { MAX_POLYNOMIAL_DEGREE, PolynomialDegreeError };

/** The part of a syntax-tree node that the CAS code reads. */
export interface AstNode {
  type: string;
  op?: string;
  fn?: string | { name?: string };
  args?: AstNode[];
  content?: AstNode;
  value?: unknown;
  name?: string;
  toString(): string;
}

/** Parse `expr`, or return null when it is not valid syntax. */
export function parseTree(expr: string): AstNode | null {
  try {
    return parse(expr) as unknown as AstNode;
  } catch {
    return null;
  }
}

/** True when `node` holds the symbol `name`. */
export function containsSymbol(node: AstNode, name: string): boolean {
  if (node.type === 'SymbolNode') return node.name === name;
  if (node.content !== undefined && containsSymbol(node.content, name)) return true;
  return (node.args ?? []).some((a) => containsSymbol(a, name));
}

/** The name of an operator node (`add`, `multiply`, `pow`, `unaryMinus`, ...), or null. */
export function operatorName(node: AstNode): string | null {
  if (node.type !== 'OperatorNode') return null;
  const fn = node.fn;
  return (typeof fn === 'string' ? fn : fn?.name) ?? null;
}

/** The name of a function-call node, or null. */
export function callName(node: AstNode): string | null {
  if (node.type !== 'FunctionNode') return null;
  const fn = node.fn;
  if (typeof fn === 'string') return fn;
  return fn?.name ?? node.name ?? null;
}

/**
 * The numeric value of a node that holds no free symbol, or null when the node has no finite
 * real value (an unknown symbol, a complex result, a division by zero).
 */
export function constantValue(node: AstNode): number | null {
  if (node.type === 'ConstantNode' && typeof node.value === 'number') return node.value;
  try {
    const value: unknown = evaluate(node.toString());
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * A coefficient that is not larger than this fraction of the magnitude of the terms that were
 * summed into it is rounding noise, and reads as zero. The rounding error of a sum or a product
 * is about `n * 2.2e-16` of the terms, with `n` up to the highest degree that the reader builds
 * ({@link MAX_POLYNOMIAL_DEGREE}, about 1000 terms), so `1e-12` is above the noise of any
 * polynomial that the reader accepts, and below any coefficient that a person wrote.
 */
export const COEFFICIENT_NOISE_RATIO = 1e-12;

/** The coefficients of a polynomial, and the magnitude of the terms that were summed into each. */
interface Poly {
  /** Coefficient of `x^i`. */
  c: number[];
  /** Sum of the absolute values of the terms that made `c[i]`: the scale of its rounding noise. */
  m: number[];
}

/** A built polynomial, `null` for an expression that is no polynomial, or `'degree'` for a degree above the limit. */
type Built = Poly | null | 'degree';

function addPolys(a: Poly, b: Poly, sign: 1 | -1): Poly {
  const n = Math.max(a.c.length, b.c.length);
  const c = new Array<number>(n).fill(0);
  const m = new Array<number>(n).fill(0);
  a.c.forEach((v, i) => (c[i] += v));
  b.c.forEach((v, i) => (c[i] += sign * v));
  a.m.forEach((v, i) => (m[i] += v));
  b.m.forEach((v, i) => (m[i] += v));
  return { c, m };
}

function multiplyPolys(a: Poly, b: Poly): Built {
  if (a.c.length + b.c.length - 1 > MAX_POLYNOMIAL_DEGREE + 1) return 'degree';
  const length = a.c.length + b.c.length - 1;
  const c = new Array<number>(length).fill(0);
  const m = new Array<number>(length).fill(0);
  for (let i = 0; i < a.c.length; i++) {
    for (let j = 0; j < b.c.length; j++) {
      c[i + j] += a.c[i] * b.c[j];
      m[i + j] += a.m[i] * b.m[j];
    }
  }
  return { c, m };
}

function scalePoly(a: Poly, factor: number): Poly {
  return { c: a.c.map((v) => v * factor), m: a.m.map((v) => v * Math.abs(factor)) };
}

/** The result of two parts: a part that is no polynomial decides first, then a degree that is too high. */
function both(a: Built, b: Built, join: (x: Poly, y: Poly) => Built): Built {
  if (a === null || b === null) return null;
  if (a === 'degree' || b === 'degree') return 'degree';
  return join(a, b);
}

/** The operators that a variable-free subtree keeps as arithmetic, so its rounding noise is measured. */
const CONSTANT_ARITHMETIC = new Set(['add', 'subtract', 'multiply', 'unaryMinus', 'unaryPlus']);

function buildPoly(node: AstNode, variable: string): Built {
  if (!containsSymbol(node, variable)) {
    // A sum or product of constants (`0.1 + 0.2 - 0.3`) is built term by term, with the magnitude of
    // each term, so that its rounding noise reads as zero. Any other constant has one value.
    const op = node.type === 'OperatorNode' ? operatorName(node) : null;
    if (node.type !== 'ParenthesisNode' && !(op !== null && CONSTANT_ARITHMETIC.has(op))) {
      const v = constantValue(node);
      return v === null ? null : { c: [v], m: [Math.abs(v)] };
    }
  }
  if (node.type === 'SymbolNode') return { c: [0, 1], m: [0, 1] };
  if (node.type === 'ParenthesisNode') {
    return node.content === undefined ? null : buildPoly(node.content, variable);
  }
  const op = operatorName(node);
  const args = node.args ?? [];
  if (op === null) return null;
  if (args.length === 1) {
    const a = buildPoly(args[0], variable);
    if (a === null || a === 'degree') return a;
    if (op === 'unaryPlus') return a;
    return op === 'unaryMinus' ? scalePoly(a, -1) : null;
  }
  if (args.length !== 2) return null;
  const [left, right] = args;
  if (op === 'divide' || op === 'pow') {
    // The divisor and the exponent must not hold the variable.
    if (containsSymbol(right, variable)) return null;
    const scalar = constantValue(right);
    const a = buildPoly(left, variable);
    if (scalar === null || a === null) return null;
    if (a === 'degree') return a;
    if (op === 'divide') return scalar === 0 ? null : scalePoly(a, 1 / scalar);
    if (!Number.isInteger(scalar) || scalar < 0) return null;
    // A constant base needs no loop, and a base of degree d gives degree d*scalar: refuse a
    // power above the limit before the loop, so that `(x^0)^1e9` cannot run for long.
    if (a.c.length === 1) return { c: [a.c[0] ** scalar], m: [a.m[0] ** scalar] };
    if (scalar * (a.c.length - 1) > MAX_POLYNOMIAL_DEGREE) return 'degree';
    let power: Built = { c: [1], m: [1] };
    for (let i = 0; i < scalar && power !== null && power !== 'degree'; i++) {
      power = multiplyPolys(power, a);
    }
    return power;
  }
  const a = buildPoly(left, variable);
  const b = buildPoly(right, variable);
  switch (op) {
    case 'add':
      return both(a, b, (x, y) => addPolys(x, y, 1));
    case 'subtract':
      return both(a, b, (x, y) => addPolys(x, y, -1));
    case 'multiply':
      return both(a, b, multiplyPolys);
    default:
      return null;
  }
}

/**
 * The coefficients of `node` as a polynomial in `variable`, lowest degree first
 * (`x^2 - 3` gives `[-3, 0, 1]`), or null when `node` is not such a polynomial.
 *
 * A subtree without the variable is a coefficient, and it must have a finite real value, so
 * `pi*x - 1` and `sqrt(2)*x^2 - 1` are polynomials. The variable may appear in sums,
 * differences, products and negations; in a quotient only in the numerator; and as a power
 * base only with a non-negative integer exponent. Any call that holds the variable
 * (`sin(x)`, `abs(x)`), or the variable in an exponent or a denominator, gives null.
 *
 * The coefficients come from the tree, not from sample values. A function with period 1 or
 * 0.5, such as `sin(2*pi*x)`, is zero at every integer and half-integer, so a sampled test
 * reads it as the zero polynomial; and a sampled fit adds rounding noise to the coefficients.
 *
 * A coefficient that is rounding noise reads as `0`. A sum such as `0.1*x^2 - 0.3*x^2 + 0.2*x^2`
 * leaves about `3e-17` in the `x^2` term, which is no larger than {@link COEFFICIENT_NOISE_RATIO}
 * of the terms that made it. The test compares a coefficient with its own terms and not with the
 * largest coefficient, so `x^2 - 1e20` keeps its leading `1`, and `1e-20*x - 1e-30` keeps both
 * of its terms. The result may end with zero coefficients (`x^2 - x^2` gives `[0, 0, 0]`).
 *
 * @throws PolynomialDegreeError when `node` is a polynomial of a degree above
 *   {@link MAX_POLYNOMIAL_DEGREE}. An expression that is no polynomial gives `null`, whatever its
 *   other parts hold.
 */
export function polynomialCoefficients(node: AstNode, variable: string): number[] | null {
  const built = buildPoly(node, variable);
  if (built === null) return null;
  if (built === 'degree') throw new PolynomialDegreeError();
  return built.c.map((c, i) =>
    Number.isFinite(built.m[i]) && Math.abs(c) <= COEFFICIENT_NOISE_RATIO * built.m[i] ? 0 : c
  );
}
