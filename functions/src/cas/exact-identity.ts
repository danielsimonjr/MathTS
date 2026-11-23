/**
 * Decide that two expressions are the same polynomial, exactly.
 *
 * `symbolicEqual` asks `simplify` whether the difference of the two sides is the constant 0. An
 * irrational constant beside a fraction folds to a decimal, so a difference that is exactly zero
 * leaves a rounding residue, and `simplify` does not expand `(x+1)^2`. This module reads both sides
 * as polynomials with rational coefficients over the symbols and the opaque function calls that they
 * hold, and compares the two polynomials with integer arithmetic. A call such as `sqrt(2)` is one
 * unknown that the two sides must share, so no decimal is ever formed.
 *
 * The test is one-sided: a `true` is a proof, a `false` is "not decided here". Every input that the
 * reader cannot treat as a commutative ring expression gives `false`.
 */

import {
  addMP,
  fromTerms,
  integerContentMP,
  isZero,
  mulMP,
  negMP,
  totalDegree,
  type MultiPoly,
} from '../typed/factorization/multi-poly.js';
import { bigintGcd } from '../typed/factorization/integer-poly.js';
import type { MathNode } from '../utils/node.js';
import { MAX_POLYNOMIAL_DEGREE, MAX_POLYNOMIAL_TERMS } from './polynomial-limits.js';

/** The part of a syntax-tree node that this module reads (duck typing, so a foreign node works). */
interface Node {
  type?: string;
  op?: string;
  fn?: unknown;
  args?: Node[];
  content?: Node;
  value?: unknown;
  name?: string;
  toString(): string;
  compile?: () => { evaluate: (scope?: unknown) => unknown };
}

/** An expression of ring operations over rational constants and named unknowns. */
type Ir =
  | { kind: 'const'; num: bigint; den: bigint }
  | { kind: 'unknown'; name: string }
  | { kind: 'add' | 'sub' | 'mul'; left: Ir; right: Ir }
  | { kind: 'neg'; operand: Ir }
  | { kind: 'div'; numerator: Ir; divisor: Ir }
  | { kind: 'pow'; base: Ir; exponent: number };

/** A polynomial `p / den` with `den > 0`. */
interface Value {
  p: MultiPoly;
  den: bigint;
}

/** Thrown inside the module when the input is outside what the reader treats as a ring expression. */
class Undecided extends Error {}

/** The names of the functions whose value changes from one call to the next. */
const IMPURE_FUNCTIONS = new Set(['random', 'randomInt', 'pickRandom']);

/** Symbols that stand for a number without a free variable; an atom with only these is evaluated. */
const CONSTANT_SYMBOLS = new Set(['pi', 'e', 'i', 'tau', 'phi', 'LN2', 'LN10', 'LOG2E', 'LOG10E']);

/** Symbols that are no variable: they name a value that is not a finite number. */
const NON_NUMBER_SYMBOLS = new Set(['NaN', 'Infinity', 'undefined', 'null']);

/**
 * The most pairs of terms that one comparison multiplies. A power of a sum such as `(x+1)^1000`
 * stays under the term and degree limits but multiplies a million pairs, which takes seconds; the
 * comparison is undecided past this count, and `simplify` then decides as before.
 */
const MAX_TERM_PAIRS = 10 * MAX_POLYNOMIAL_TERMS;

/**
 * The most bits that a coefficient or a denominator holds. The work budget counts pairs of terms,
 * and the cost of a pair follows the size of its numbers: `(x+1e300)^300` stays under every count
 * limit, but its coefficients reach 100000 bits and the comparison took 12 s (main: 0.1 s). Every
 * double fits in a quarter of this (the exact decimal of the largest one holds 1077 bits). The
 * comparison is undecided past it, and `simplify` then decides as before.
 */
const MAX_COEFFICIENT_BITS = 4096;

/** The first magnitude that is past {@link MAX_COEFFICIENT_BITS}. */
const COEFFICIENT_LIMIT = 1n << BigInt(MAX_COEFFICIENT_BITS);

/** The number of term pairs that a comparison has multiplied. */
interface Work {
  pairs: number;
}

/** The largest decimal exponent of a constant: every double fits (5e-324 to 1.8e308). */
const MAX_DECIMAL_EXPONENT = 400;

const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/;

/** The key prefix of an opaque call: no symbol name can carry it, so a call never equals a variable. */
const ATOM_PREFIX = 'atom:';

function undecided(): never {
  throw new Undecided();
}

function operatorName(node: Node): string | null {
  if (node.type !== 'OperatorNode') return null;
  const fn = node.fn;
  if (typeof fn === 'string') return fn;
  if (typeof fn === 'object' && fn !== null) {
    const name = (fn as { name?: unknown }).name;
    if (typeof name === 'string') return name;
  }
  return null;
}

/**
 * Recognize polynomial syntax without expanding products or forming coefficients.
 * Keep calls and operators that can be undefined out of the structural shortcut.
 */
export function isSyntacticPolynomialIdentity(a: MathNode, b: MathNode): boolean {
  return a.equals(b) && isPlainPolynomialSyntax(a as unknown as Node);
}

function isPlainPolynomialSyntax(node: Node): boolean {
  switch (node.type) {
    case 'ConstantNode':
      return (
        typeof node.value === 'bigint' ||
        (typeof node.value === 'number' && Number.isFinite(node.value))
      );
    case 'SymbolNode':
      return typeof node.name === 'string' && !NON_NUMBER_SYMBOLS.has(node.name);
    case 'ParenthesisNode':
      return node.content !== undefined && isPlainPolynomialSyntax(node.content);
    case 'OperatorNode': {
      const op = operatorName(node);
      const args = node.args ?? [];
      if (args.length === 1 && (op === 'unaryMinus' || op === 'unaryPlus')) {
        return isPlainPolynomialSyntax(args[0]);
      }
      if (args.length !== 2) return false;
      if (op === 'add' || op === 'subtract' || op === 'multiply') {
        return args.every(isPlainPolynomialSyntax);
      }
      if (op !== 'pow') return false;
      const [base, exponent] = args;
      return (
        exponent.type === 'ConstantNode' &&
        typeof exponent.value === 'number' &&
        Number.isSafeInteger(exponent.value) &&
        exponent.value >= 0 &&
        isPlainPolynomialSyntax(base)
      );
    }
    default:
      return false;
  }
}

function callName(node: Node): string | null {
  const fn = node.fn;
  if (typeof fn === 'string') return fn;
  if (typeof fn === 'object' && fn !== null) {
    const name = (fn as { name?: unknown }).name;
    if (typeof name === 'string') return name;
  }
  return typeof node.name === 'string' ? node.name : null;
}

/** The exact rational of a finite number, read from its shortest decimal text. */
function rationalOf(value: number): Ir {
  if (!Number.isFinite(value)) return undecided();
  const match = DECIMAL.exec(String(value));
  if (match === null) return undecided();
  const [, sign, whole, fraction = '', exponentText = '0'] = match;
  const exponent = Number(exponentText) - fraction.length;
  if (Math.abs(exponent) > MAX_DECIMAL_EXPONENT) return undecided();
  const digits = BigInt(whole + fraction) * (sign === '-' ? -1n : 1n);
  return exponent >= 0
    ? { kind: 'const', num: digits * 10n ** BigInt(exponent), den: 1n }
    : { kind: 'const', num: digits, den: 10n ** BigInt(-exponent) };
}

/** True when `node` or a part of it is a call of a function that is not deterministic. */
function holdsImpureCall(node: Node): boolean {
  if (node.type === 'FunctionNode') {
    const name = callName(node);
    if (name !== null && IMPURE_FUNCTIONS.has(name)) return true;
  }
  if (node.content !== undefined && holdsImpureCall(node.content)) return true;
  return (node.args ?? []).some(holdsImpureCall);
}

/** The names of the symbols that `node` reads as values (the name of a called function is no value). */
function freeSymbols(node: Node, into: Set<string>): void {
  if (node.type === 'SymbolNode') {
    if (typeof node.name === 'string') into.add(node.name);
    return;
  }
  if (node.content !== undefined) freeSymbols(node.content, into);
  for (const arg of node.args ?? []) freeSymbols(arg, into);
}

/** True when `value` is a finite number or a Complex with a finite real part and imaginary part. */
function isFiniteValue(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'object' && value !== null) {
    const { re, im } = value as { re?: unknown; im?: unknown };
    return (
      typeof re === 'number' && typeof im === 'number' && Number.isFinite(re) && Number.isFinite(im)
    );
  }
  return false;
}

/**
 * An opaque unknown for a node that the reader does not open (a function call, a division by a
 * non-constant, a power with another exponent). Two equal texts name the same value, so the two
 * sides may share the unknown, and no rule treats it as a number. A call that is not deterministic
 * is refused, and so is a call of constants that has no finite value (`log(0)`).
 */
function atom(node: Node, names: Set<string>): Ir {
  if (holdsImpureCall(node)) return undecided();
  const symbols = new Set<string>();
  freeSymbols(node, symbols);
  for (const symbol of symbols) if (NON_NUMBER_SYMBOLS.has(symbol)) return undecided();
  if ([...symbols].every((symbol) => CONSTANT_SYMBOLS.has(symbol))) {
    if (typeof node.compile !== 'function') return undecided();
    let result: unknown;
    try {
      result = node.compile().evaluate();
    } catch {
      return undecided();
    }
    if (!isFiniteValue(result)) return undecided();
  }
  const name = ATOM_PREFIX + node.toString();
  names.add(name);
  return { kind: 'unknown', name };
}

/** Lower `node` to an {@link Ir}, and add the name of each unknown to `names`. */
function lower(node: Node, names: Set<string>): Ir {
  switch (node.type) {
    case 'ConstantNode': {
      const value = node.value;
      if (typeof value === 'number') return rationalOf(value);
      if (typeof value === 'bigint') return { kind: 'const', num: value, den: 1n };
      return undecided();
    }
    case 'SymbolNode': {
      const name = node.name;
      if (typeof name !== 'string' || NON_NUMBER_SYMBOLS.has(name)) return undecided();
      names.add(name);
      return { kind: 'unknown', name };
    }
    case 'ParenthesisNode':
      return node.content === undefined ? undecided() : lower(node.content, names);
    case 'FunctionNode':
      return atom(node, names);
    case 'OperatorNode':
      return lowerOperator(node, names);
    default:
      return undecided();
  }
}

function lowerOperator(node: Node, names: Set<string>): Ir {
  const op = operatorName(node);
  const args = node.args ?? [];
  if (args.length === 1 && (op === 'unaryMinus' || op === 'unaryPlus')) {
    const operand = lower(args[0], names);
    return op === 'unaryMinus' ? { kind: 'neg', operand } : operand;
  }
  if (args.length !== 2) return atom(node, names);
  const [first, second] = args;
  switch (op) {
    case 'add':
      return { kind: 'add', left: lower(first, names), right: lower(second, names) };
    case 'subtract':
      return { kind: 'sub', left: lower(first, names), right: lower(second, names) };
    case 'multiply':
      return { kind: 'mul', left: lower(first, names), right: lower(second, names) };
    case 'divide': {
      const divisor = lower(second, names);
      if (!isConstantIr(divisor)) return atom(node, names);
      return { kind: 'div', numerator: lower(first, names), divisor };
    }
    case 'pow': {
      const exponent = lower(second, new Set<string>());
      if (!isConstantIr(exponent)) return atom(node, names);
      const value = evaluate(exponent, [], { pairs: 0 });
      const exponentValue = constantOf(value);
      // A power with a fraction as exponent is one opaque value; a power above the degree limit is refused.
      if (exponentValue === null || exponentValue.den !== 1n) return atom(node, names);
      if (exponentValue.num > BigInt(MAX_POLYNOMIAL_DEGREE)) return undecided();
      if (exponentValue.num < -BigInt(MAX_POLYNOMIAL_DEGREE)) return undecided();
      const base = lower(first, names);
      // A negative power is exact only for a constant base: 1/x is no polynomial.
      if (exponentValue.num < 0n && !isConstantIr(base)) return atom(node, names);
      return { kind: 'pow', base, exponent: Number(exponentValue.num) };
    }
    default:
      return atom(node, names);
  }
}

/** True when `ir` holds no unknown, so that it has one rational value. */
function isConstantIr(ir: Ir): boolean {
  switch (ir.kind) {
    case 'const':
      return true;
    case 'unknown':
      return false;
    case 'neg':
      return isConstantIr(ir.operand);
    case 'pow':
      return isConstantIr(ir.base);
    case 'div':
      return isConstantIr(ir.numerator) && isConstantIr(ir.divisor);
    default:
      return isConstantIr(ir.left) && isConstantIr(ir.right);
  }
}

function constant(vars: string[], value: bigint): MultiPoly {
  return fromTerms(vars, value === 0n ? [] : [[vars.map(() => 0), value]]);
}

/** `p` with each coefficient multiplied by `factor`. */
function scale(p: MultiPoly, factor: bigint): MultiPoly {
  const terms = new Map<string, bigint>();
  for (const [key, coefficient] of p.terms) terms.set(key, coefficient * factor);
  return { vars: p.vars.slice(), terms };
}

/** `value` with the common factor of the denominator and the coefficients removed. */
function reduce(value: Value): Value {
  if (isZero(value.p)) return { p: value.p, den: 1n };
  const factor = bigintGcd(value.den, integerContentMP(value.p));
  if (factor <= 1n) return value;
  const terms = new Map<string, bigint>();
  for (const [key, coefficient] of value.p.terms) terms.set(key, coefficient / factor);
  return { p: { vars: value.p.vars.slice(), terms }, den: value.den / factor };
}

/** True when a coefficient or the denominator of `value` holds more than the bit limit. */
function isOversized(value: Value): boolean {
  if (value.den >= COEFFICIENT_LIMIT) return true;
  for (const coefficient of value.p.terms.values()) {
    if (coefficient >= COEFFICIENT_LIMIT || coefficient <= -COEFFICIENT_LIMIT) return true;
  }
  return false;
}

/** `value` when it is within the size limits, else the input is undecided. */
function bounded(value: Value): Value {
  if (
    value.p.terms.size > MAX_POLYNOMIAL_TERMS ||
    totalDegree(value.p) > MAX_POLYNOMIAL_DEGREE ||
    isOversized(value)
  ) {
    return undecided();
  }
  return value;
}

function addValues(left: Value, right: Value): Value {
  const sum = addMP(scale(left.p, right.den), scale(right.p, left.den));
  return bounded(reduce({ p: sum, den: left.den * right.den }));
}

function multiplyValues(left: Value, right: Value, work: Work): Value {
  // A product combines every term of one side with every term of the other.
  const pairs = left.p.terms.size * right.p.terms.size;
  work.pairs += pairs;
  if (pairs > MAX_POLYNOMIAL_TERMS || work.pairs > MAX_TERM_PAIRS) return undecided();
  // Each operand is within the bit limit (every value passes `bounded`), so one product holds at
  // most twice the limit: its cost is bounded, and `bounded` refuses the result when it is too large.
  return bounded(reduce({ p: mulMP(left.p, right.p), den: left.den * right.den }));
}

/** The rational value of `value` when it is a constant, else null. */
function constantOf(value: Value): { num: bigint; den: bigint } | null {
  if (isZero(value.p)) return { num: 0n, den: 1n };
  if (value.p.terms.size !== 1) return null;
  const [[key, coefficient]] = [...value.p.terms];
  return key.split(',').every((exponent) => exponent === '0' || exponent === '')
    ? { num: coefficient, den: value.den }
    : null;
}

function powerOf(base: Value, exponent: number, work: Work): Value {
  const vars = base.p.vars;
  if (exponent >= 0) {
    let result: Value = { p: constant(vars, 1n), den: 1n };
    for (let step = 0; step < exponent; step++) result = multiplyValues(result, base, work);
    return result;
  }
  // A negative exponent is exact only for a constant base that is not zero.
  const value = constantOf(base);
  if (value === null || value.num === 0n) return undecided();
  const sign = value.num < 0n ? -1n : 1n;
  return powerOf({ p: constant(vars, value.den * sign), den: value.num * sign }, -exponent, work);
}

/** The value of `ir` as a polynomial over `vars`. */
function evaluate(ir: Ir, vars: string[], work: Work): Value {
  switch (ir.kind) {
    case 'const':
      // A bigint literal has no size limit of its own.
      return bounded({ p: constant(vars, ir.num), den: ir.den });
    case 'unknown': {
      const index = vars.indexOf(ir.name);
      if (index < 0) return undecided();
      const exponents = vars.map((_, position) => (position === index ? 1 : 0));
      return { p: fromTerms(vars, [[exponents, 1n]]), den: 1n };
    }
    case 'neg': {
      const operand = evaluate(ir.operand, vars, work);
      return { p: negMP(operand.p), den: operand.den };
    }
    case 'add':
      return addValues(evaluate(ir.left, vars, work), evaluate(ir.right, vars, work));
    case 'sub': {
      const right = evaluate(ir.right, vars, work);
      return addValues(evaluate(ir.left, vars, work), { p: negMP(right.p), den: right.den });
    }
    case 'mul':
      return multiplyValues(evaluate(ir.left, vars, work), evaluate(ir.right, vars, work), work);
    case 'div': {
      const numerator = evaluate(ir.numerator, vars, work);
      const divisor = constantOf(evaluate(ir.divisor, vars, work));
      if (divisor === null || divisor.num === 0n) return undecided();
      const sign = divisor.num < 0n ? -1n : 1n;
      return bounded(
        reduce({
          p: scale(numerator.p, divisor.den * sign),
          den: numerator.den * divisor.num * sign,
        })
      );
    }
    case 'pow':
      return powerOf(evaluate(ir.base, vars, work), ir.exponent, work);
  }
}

/**
 * True when `a` and `b` are the same polynomial with rational coefficients over their variables and
 * opaque calls. A `true` is a proof. A `false` means "not decided here": the sides differ, or a part of
 * them is outside what the reader treats as a commutative ring expression (a matrix, a string, a call
 * that is not deterministic, a constant without a finite value, a size above the limits of the CAS).
 * The function never throws.
 */
export function isExactPolynomialIdentity(a: MathNode, b: MathNode): boolean {
  try {
    const names = new Set<string>();
    const left = lower(a as unknown as Node, names);
    const right = lower(b as unknown as Node, names);
    const vars = [...names].sort();
    const work: Work = { pairs: 0 };
    const x = evaluate(left, vars, work);
    const y = evaluate(right, vars, work);
    return isZero(addMP(scale(x.p, y.den), negMP(scale(y.p, x.den))));
  } catch {
    return false;
  }
}
