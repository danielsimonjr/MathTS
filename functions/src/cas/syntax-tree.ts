/**
 * Read an expression as a syntax tree, and answer structural questions about it.
 *
 * The CAS solver must not decide the shape of an expression from sample values. A function
 * with period 1 or 0.5, such as `sin(2*pi*x)`, is zero at every integer and half-integer, so a
 * sampled test reads it as the zero polynomial. The helpers here read the tree itself.
 */

import { parse, evaluate } from '../factories/evaluate.js';

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

/** The highest degree that {@link polynomialCoefficients} builds; a higher one gives null. */
export const MAX_POLYNOMIAL_DEGREE = 1000;

function addCoefficients(a: readonly number[], b: readonly number[], sign: 1 | -1): number[] {
  const out = new Array<number>(Math.max(a.length, b.length)).fill(0);
  a.forEach((c, i) => (out[i] += c));
  b.forEach((c, i) => (out[i] += sign * c));
  return out;
}

function multiplyCoefficients(a: readonly number[], b: readonly number[]): number[] | null {
  if (a.length + b.length - 1 > MAX_POLYNOMIAL_DEGREE + 1) return null;
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  }
  return out;
}

/**
 * The coefficients of `node` as a polynomial in `variable`, lowest degree first
 * (`x^2 - 3` gives `[-3, 0, 1]`), or null when `node` is not such a polynomial.
 *
 * A subtree without the variable is a coefficient, and it must have a finite real value, so
 * `pi*x - 1` and `sqrt(2)*x^2 - 1` are polynomials. The variable may appear in sums,
 * differences, products and negations; in a quotient only in the numerator; and as a power
 * base only with a non-negative integer exponent. Any call that holds the variable
 * (`sin(x)`, `abs(x)`), or the variable in an exponent or a denominator, gives null. So does a
 * degree above {@link MAX_POLYNOMIAL_DEGREE}.
 *
 * The coefficients come from the tree, not from sample values. A function with period 1 or
 * 0.5, such as `sin(2*pi*x)`, is zero at every integer and half-integer, so a sampled test
 * reads it as the zero polynomial; and a sampled fit adds rounding noise to the coefficients.
 * The result may end with zero coefficients (`x^2 - x^2` gives `[0, 0, 0]`).
 */
export function polynomialCoefficients(node: AstNode, variable: string): number[] | null {
  if (!containsSymbol(node, variable)) {
    const c = constantValue(node);
    return c === null ? null : [c];
  }
  if (node.type === 'SymbolNode') return [0, 1];
  if (node.type === 'ParenthesisNode') {
    return node.content === undefined ? null : polynomialCoefficients(node.content, variable);
  }
  const op = operatorName(node);
  const args = node.args ?? [];
  if (op === null) return null;
  if (args.length === 1) {
    const a = polynomialCoefficients(args[0], variable);
    if (a === null) return null;
    if (op === 'unaryPlus') return a;
    return op === 'unaryMinus' ? a.map((c) => -c) : null;
  }
  if (args.length !== 2) return null;
  const [left, right] = args;
  if (op === 'divide' || op === 'pow') {
    // The divisor and the exponent must not hold the variable.
    if (containsSymbol(right, variable)) return null;
    const scalar = constantValue(right);
    const a = polynomialCoefficients(left, variable);
    if (scalar === null || a === null) return null;
    if (op === 'divide') return scalar === 0 ? null : a.map((c) => c / scalar);
    if (!Number.isInteger(scalar) || scalar < 0) return null;
    let power: number[] | null = [1];
    for (let i = 0; i < scalar && power !== null; i++) power = multiplyCoefficients(power, a);
    return power;
  }
  const a = polynomialCoefficients(left, variable);
  const b = polynomialCoefficients(right, variable);
  if (a === null || b === null) return null;
  switch (op) {
    case 'add':
      return addCoefficients(a, b, 1);
    case 'subtract':
      return addCoefficients(a, b, -1);
    case 'multiply':
      return multiplyCoefficients(a, b);
    default:
      return null;
  }
}
