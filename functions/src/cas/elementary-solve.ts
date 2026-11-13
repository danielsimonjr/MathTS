/**
 * Exact solution sets of one-function equations: `a*F(p*x + q) + b = 0`.
 *
 * `F` is one of `sin`, `cos`, `tan`, `exp`, `log`, `sqrt` or `abs`. The solver reads the
 * equation as a syntax tree, isolates `F(u) = c` with `u = p*x + q`, and writes the roots as
 * exact text: a rational multiple of `pi` for the special angles (`sin(x)=1/2` gives
 * `pi/6` and `5*pi/6`), a symbolic inverse call otherwise (`sin(x)=1/3` gives `asin(1/3)`
 * and `pi - asin(1/3)`). A periodic `F` also gives the period of the solution set.
 *
 * Any other shape, such as `sin(x) = x`, `sin(x)^2 = 1/4` or `sinh(x) = 1`, has no closed form
 * here: the function returns `null`, and the caller decides what to do.
 */

import { parse, evaluate } from '../factories/evaluate.js';

/** The part of a syntax-tree node that the solver reads. */
interface AstNode {
  type: string;
  op?: string;
  fn?: string | { name?: string };
  args?: AstNode[];
  content?: AstNode;
  value?: unknown;
  name?: string;
  toString(): string;
}

/** The exact solution set of one equation. */
export interface ElementarySolution {
  /** The principal roots as text. */
  roots: string[];
  /** The period of the solution set as text, when the set is periodic. */
  period?: string;
}

/** A rational number `n/d` with `d > 0`, in lowest terms. */
type Fraction = readonly [n: number, d: number];

/** The call `name(p*x + q)` found in an equation. */
interface Call {
  name: string;
  p: number;
  q: number;
}

/** `c + k * target`: a value that is linear in one target (a call, or the variable). */
interface Linear<T> {
  c: number;
  k: number;
  target: T | null;
}

/** One root of `F(u) = c`, before the map back to `x`. */
interface UnitRoot {
  /** The root as a rational multiple of `pi`, when the value is a special angle. */
  frac: Fraction | null;
  /** The root as text. */
  text: string;
}

/** The exact angle (as a multiple of pi) for the special values of `sin`, `cos` and `tan`. */
const SPECIAL_VALUES: ReadonlyArray<{
  value: number;
  asin?: Fraction;
  acos?: Fraction;
  atan?: Fraction;
}> = [
  { value: 0, asin: [0, 1], acos: [1, 2], atan: [0, 1] },
  { value: 1 / 2, asin: [1, 6], acos: [1, 3] },
  { value: Math.SQRT1_2, asin: [1, 4], acos: [1, 4] },
  { value: Math.sqrt(3) / 2, asin: [1, 3], acos: [1, 6] },
  { value: 1, asin: [1, 2], acos: [0, 1], atan: [1, 4] },
  { value: Math.sqrt(3), atan: [1, 3] },
  { value: 1 / Math.sqrt(3), atan: [1, 6] },
];

/** The two tolerances: one for a special value, one for a value that is a small fraction. */
const SPECIAL_TOLERANCE = 1e-12;
const FRACTION_TOLERANCE = 1e-12;
const MAX_FRACTION_DENOMINATOR = 100_000;

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

function makeFraction(n: number, d: number): Fraction {
  const g = gcd(n, d) || 1;
  const sign = d < 0 ? -1 : 1;
  return [(sign * n) / g, (sign * d) / g];
}

/** The fraction `n/d` that equals `x` (within a tolerance, `d` at most 100000), or null. */
function toFraction(x: number): Fraction | null {
  if (!Number.isFinite(x)) return null;
  if (Number.isInteger(x)) return [x, 1];
  const tolerance = FRACTION_TOLERANCE * Math.max(1, Math.abs(x));
  // Continued-fraction convergents.
  let h1 = 1;
  let h0 = 0;
  let k1 = 0;
  let k0 = 1;
  let rest = x;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(rest);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > MAX_FRACTION_DENOMINATOR) return null;
    if (Math.abs(x - h2 / k2) <= tolerance) return makeFraction(h2, k2);
    h0 = h1;
    h1 = h2;
    k0 = k1;
    k1 = k2;
    const frac = rest - a;
    if (frac === 0) return null;
    rest = 1 / frac;
  }
  return null;
}

/** A constant as exact text: an integer, a small fraction `n/d`, or the shortest decimal. */
function constantText(c: number): string {
  const f = toFraction(c);
  if (f === null) return String(Number(c.toPrecision(15)));
  return f[1] === 1 ? String(f[0]) : `${f[0]}/${f[1]}`;
}

/** A rational multiple of pi as text: `0`, `pi`, `-pi/6`, `5*pi/6`, `3*pi`. */
function piMultipleText(f: Fraction): string {
  const [n, d] = f;
  if (n === 0) return '0';
  const sign = n < 0 ? '-' : '';
  const magnitude = Math.abs(n);
  const top = magnitude === 1 ? 'pi' : `${magnitude}*pi`;
  return d === 1 ? `${sign}${top}` : `${sign}${top}/${d}`;
}

function subtractFrom(whole: number, f: Fraction): Fraction {
  return makeFraction(whole * f[1] - f[0], f[1]);
}

/** True when `node` holds the variable `v`. */
function containsVariable(node: AstNode, v: string): boolean {
  if (node.type === 'SymbolNode') return node.name === v;
  if (node.content !== undefined && containsVariable(node.content, v)) return true;
  return (node.args ?? []).some((a) => containsVariable(a, v));
}

/** The numeric value of a node that has no variable, or null when it is not a real number. */
function constantValue(node: AstNode): number | null {
  if (node.type === 'ConstantNode' && typeof node.value === 'number') return node.value;
  try {
    const value: unknown = evaluate(node.toString());
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Read `node` as `c + k * target`, where a leaf of the tree (`leaf`) supplies the one target.
 * Sums, differences, negation, and products or quotients with a constant are linear; anything
 * else (a power, a product of two targets, two different targets) is not, and gives null.
 */
function foldLinear<T>(
  node: AstNode,
  v: string,
  leaf: (n: AstNode) => Linear<T> | null
): Linear<T> | null {
  if (!containsVariable(node, v)) {
    const c = constantValue(node);
    return c === null ? null : { c, k: 0, target: null };
  }
  if (node.type === 'ParenthesisNode' && node.content) return foldLinear(node.content, v, leaf);
  if (node.type !== 'OperatorNode' || !node.args) return leaf(node);

  const fold = (n: AstNode) => foldLinear(n, v, leaf);
  const args = node.args;
  const fn = node.fn;
  const op = typeof fn === 'string' ? fn : fn?.name;
  if (args.length === 1) {
    const a = fold(args[0]);
    if (a === null) return null;
    if (op === 'unaryMinus') return { c: -a.c, k: -a.k, target: a.target };
    if (op === 'unaryPlus') return a;
    return null;
  }
  if (args.length !== 2) return null;
  const a = fold(args[0]);
  const b = fold(args[1]);
  if (a === null || b === null) return null;
  switch (op) {
    case 'add':
    case 'subtract': {
      if (a.target !== null && b.target !== null) return null;
      const sign = op === 'add' ? 1 : -1;
      return { c: a.c + sign * b.c, k: a.k + sign * b.k, target: a.target ?? b.target };
    }
    case 'multiply': {
      if (a.target === null) return { c: a.c * b.c, k: a.c * b.k, target: b.target };
      if (b.target === null) return { c: a.c * b.c, k: a.k * b.c, target: a.target };
      return null;
    }
    case 'divide': {
      if (b.target !== null || b.c === 0) return null;
      return { c: a.c / b.c, k: a.k / b.c, target: a.target };
    }
    default:
      return null;
  }
}

/** The name of a function-call node, or null. */
function callName(node: AstNode): string | null {
  if (node.type !== 'FunctionNode') return null;
  const fn = node.fn;
  if (typeof fn === 'string') return fn;
  return fn?.name ?? node.name ?? null;
}

/** The functions the solver can invert. */
const FORMS: ReadonlySet<string> = new Set(['sin', 'cos', 'tan', 'exp', 'log', 'sqrt', 'abs']);

/** Read `node` as `c + k*F(p*x + q)` for one supported `F`, or null. */
function readCall(node: AstNode, v: string): Linear<Call> | null {
  const symbolLeaf = (n: AstNode): Linear<'x'> | null =>
    n.type === 'SymbolNode' && n.name === v ? { c: 0, k: 1, target: 'x' } : null;
  const callLeaf = (n: AstNode): Linear<Call> | null => {
    const name = callName(n);
    if (name === null || !FORMS.has(name) || n.args?.length !== 1) return null;
    const inner = foldLinear(n.args[0], v, symbolLeaf);
    if (inner === null || inner.target === null || inner.k === 0) return null;
    return { c: 0, k: 1, target: { name, p: inner.k, q: inner.c } };
  };
  return foldLinear(node, v, callLeaf);
}

/** The roots of `F(u) = c` and the period of `F`, in `u`. */
function solveUnit(name: string, c: number): { roots: UnitRoot[]; period?: Fraction } | null {
  const special = (key: 'asin' | 'acos' | 'atan'): Fraction | null => {
    const hit = SPECIAL_VALUES.find((s) => Math.abs(Math.abs(c) - s.value) < SPECIAL_TOLERANCE);
    const angle = hit?.[key];
    if (!angle) return null;
    // acos is not odd: acos(-v) = pi - acos(v). asin and atan are odd.
    if (c >= 0) return angle;
    return key === 'acos' ? subtractFrom(1, angle) : makeFraction(-angle[0], angle[1]);
  };
  const root = (frac: Fraction | null, generic: string): UnitRoot =>
    frac ? { frac, text: piMultipleText(frac) } : { frac: null, text: generic };
  const cText = constantText(c);
  const atOne = Math.abs(Math.abs(c) - 1) < SPECIAL_TOLERANCE;

  switch (name) {
    case 'sin': {
      const r1 = root(special('asin'), `asin(${cText})`);
      if (atOne) return { roots: [r1], period: [2, 1] };
      const r2 = r1.frac
        ? root(subtractFrom(1, r1.frac), '')
        : { frac: null, text: `pi - ${r1.text}` };
      return { roots: [r1, r2], period: [2, 1] };
    }
    case 'cos': {
      const r1 = root(special('acos'), `acos(${cText})`);
      if (atOne) return { roots: [r1], period: [2, 1] };
      const r2 = r1.frac
        ? root(subtractFrom(2, r1.frac), '')
        : { frac: null, text: `2*pi - ${r1.text}` };
      return { roots: [r1, r2], period: [2, 1] };
    }
    case 'tan':
      return { roots: [root(special('atan'), `atan(${cText})`)], period: [1, 1] };
    case 'exp':
      if (c === 0) return { roots: [] };
      return { roots: [{ frac: null, text: c === 1 ? '0' : `log(${cText})` }] };
    case 'log':
      return { roots: [{ frac: null, text: c === 0 ? '1' : c === 1 ? 'e' : `exp(${cText})` }] };
    case 'sqrt': {
      if (c < 0) return { roots: [] };
      const f = toFraction(c);
      const text = f
        ? f[1] === 1
          ? String(f[0] * f[0])
          : `${f[0] * f[0]}/${f[1] * f[1]}`
        : constantText(c * c);
      return { roots: [{ frac: null, text }] };
    }
    case 'abs':
      if (c < 0) return { roots: [] };
      if (c === 0) return { roots: [{ frac: null, text: '0' }] };
      return {
        roots: [
          { frac: null, text: constantText(-c) },
          { frac: null, text: constantText(c) },
        ],
      };
    default:
      return null;
  }
}

/** True when `text` is a plain number such as `-3`, `0.5` or `1/2`. */
function plainNumber(text: string): number | null {
  const m = /^(-?\d+(?:\.\d+)?)(?:\/(\d+))?$/.exec(text);
  if (!m) return null;
  return m[2] === undefined ? Number(m[1]) : Number(m[1]) / Number(m[2]);
}

/** Map the root `u` of `F(u) = c` back to `x`, where `u = p*x + q`. */
function mapToVariable(root: UnitRoot, p: number, q: number): string {
  const pFraction = toFraction(p);
  if (root.frac && q === 0 && pFraction) {
    return piMultipleText(makeFraction(root.frac[0] * pFraction[1], root.frac[1] * pFraction[0]));
  }
  const number = plainNumber(root.text);
  if (number !== null) return constantText((number - q) / p);
  let numerator: string;
  if (q === 0) numerator = root.text;
  else if (root.text === '0') numerator = constantText(-q);
  else numerator = `${root.text} ${q > 0 ? '-' : '+'} ${constantText(Math.abs(q))}`;
  if (p === 1) return numerator;
  const wrapped = /^[\w.]+$/.test(numerator) ? numerator : `(${numerator})`;
  if (p === -1) return `-${wrapped}`;
  const divisor = constantText(Math.abs(p));
  const divisorText = divisor.includes('/') ? `(${divisor})` : divisor;
  return `${p < 0 ? '-' : ''}${wrapped}/${divisorText}`;
}

/** The period `base * pi / |p|` as text. */
function periodText(base: Fraction, p: number): string {
  const pFraction = toFraction(Math.abs(p));
  if (pFraction)
    return piMultipleText(makeFraction(base[0] * pFraction[1], base[1] * pFraction[0]));
  return `${piMultipleText(base)}/${constantText(Math.abs(p))}`;
}

/**
 * Solve `expr = 0` exactly when `expr` is `a*F(p*x + q) + b` for one supported `F`.
 *
 * @param expr - The expression to set to zero, as text.
 * @param variable - The variable to solve for.
 * @returns The exact roots and, for a periodic `F`, the period; or `null` when `expr` has
 *   another shape.
 *
 * @example
 * solveElementary('sin(x)', 'x');     // { roots: ['0', 'pi'], period: '2*pi' }
 * solveElementary('2*cos(x) - 1', 'x'); // { roots: ['pi/3', '5*pi/3'], period: '2*pi' }
 * solveElementary('sin(x) - x', 'x'); // null
 */
export function solveElementary(expr: string, variable: string): ElementarySolution | null {
  let node: AstNode;
  try {
    node = parse(expr) as unknown as AstNode;
  } catch {
    return null;
  }
  const linear = readCall(node, variable);
  if (linear === null || linear.target === null || linear.k === 0) return null;
  const { name, p, q } = linear.target;
  const unit = solveUnit(name, -linear.c / linear.k);
  if (unit === null) return null;
  const solution: ElementarySolution = {
    roots: unit.roots.map((r) => mapToVariable(r, p, q)),
  };
  if (unit.period) solution.period = periodText(unit.period, p);
  return solution;
}
