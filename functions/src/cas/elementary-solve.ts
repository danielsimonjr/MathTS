/**
 * Exact solution sets of one-function equations: `a*F(p*x + q) + b = 0`.
 *
 * `F` is one of `sin`, `cos`, `tan`, `exp`, `log`, `sqrt` or `abs`. The solver reads the
 * equation as a syntax tree, isolates `F(u) = c` with `u = p*x + q`, and writes the roots as
 * exact text: a rational multiple of `pi` for the special angles (`sin(x)=1/2` gives
 * `pi/6` and `5*pi/6`), a symbolic inverse call otherwise (`sin(x)=1/3` gives `asin(1/3)`
 * and `pi - asin(1/3)`). A periodic `F` also gives the period of the solution set.
 *
 * The roots are real roots. A value that `F` never takes on the real line (`sin(x) = 2`,
 * `exp(x) = -1`, `sqrt(x) = -1`) gives no roots.
 *
 * Exact means that no digit of the text is a rounded result. A constant is exact when it is a
 * small fraction, a special value of `sin`/`cos`/`tan`, or a decimal of at most 12 digits that a
 * person could have typed. The coefficient `p` may also be a rational multiple of `pi`
 * (`sin(2*pi*x) = 0` gives `0` and `1/2`). Any other constant, such as `sqrt(2)/3` or `pi/4` in
 * the offset, has no exact text here, and the function returns `null`.
 *
 * Any other shape, such as `sin(x) = x`, `sin(x)^2 = 1/4` or `sinh(x) = 1`, has no closed form
 * here: the function returns `null`, and the caller decides what to do.
 */

import {
  type AstNode,
  callName,
  constantValue,
  containsSymbol,
  operatorName,
  parseTree,
} from './syntax-tree.js';

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
  /** True when the argument of the call names the constant `pi`. */
  mentionsPi: boolean;
}

/** The scale `p` of the argument: `frac`, or `frac * pi` when `pi` is true. */
interface Scale {
  frac: Fraction;
  pi: boolean;
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

/** The most digits of a decimal that counts as typed by a person and not as a rounded result. */
const MAX_DECIMAL_DIGITS = 12;

/** A fraction as text: `3`, `-1/2`. */
function fractionText(f: Fraction): string {
  return f[1] === 1 ? String(f[0]) : `${f[0]}/${f[1]}`;
}

/**
 * A constant as exact text: an integer, a small fraction `n/d`, or a decimal of at most
 * {@link MAX_DECIMAL_DIGITS} digits. Returns null for any other value. A value such as
 * `sqrt(2)/3` has about 16 digits and no small fraction, so no text can state it exactly.
 */
function exactText(c: number): string | null {
  const f = toFraction(c);
  if (f !== null) return fractionText(f);
  const text = String(c);
  if (!/^-?\d*\.\d+$/.test(text)) return null;
  const digits = text.replace(/[-.]/g, '').replace(/^0+/, '');
  return digits.length <= MAX_DECIMAL_DIGITS ? text : null;
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
  if (!containsSymbol(node, v)) {
    const c = constantValue(node);
    return c === null ? null : { c, k: 0, target: null };
  }
  if (node.type === 'ParenthesisNode' && node.content) return foldLinear(node.content, v, leaf);
  if (node.type !== 'OperatorNode' || !node.args) return leaf(node);

  const fold = (n: AstNode) => foldLinear(n, v, leaf);
  const args = node.args;
  const op = operatorName(node);
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
    const mentionsPi = containsSymbol(n.args[0], 'pi');
    return { c: 0, k: 1, target: { name, p: inner.k, q: inner.c, mentionsPi } };
  };
  return foldLinear(node, v, callLeaf);
}

/**
 * The roots of `F(u) = c` and the period of `F`, in `u`. Returns null when `c` is neither a
 * special value nor a constant with exact text (see {@link exactText}), so that no text carries
 * a rounded digit. Returns no roots when `F` never takes the value `c` on the real line.
 */
function solveUnit(name: string, c: number): { roots: UnitRoot[]; period?: Fraction } | null {
  const special = (key: 'asin' | 'acos' | 'atan'): Fraction | null => {
    const hit = SPECIAL_VALUES.find((s) => Math.abs(Math.abs(c) - s.value) < SPECIAL_TOLERANCE);
    const angle = hit?.[key];
    if (!angle) return null;
    // acos is not odd: acos(-v) = pi - acos(v). asin and atan are odd.
    if (c >= 0) return angle;
    return key === 'acos' ? subtractFrom(1, angle) : makeFraction(-angle[0], angle[1]);
  };
  const text = exactText(c);
  const atOne = Math.abs(Math.abs(c) - 1) < SPECIAL_TOLERANCE;
  /** The root `inverse(c)`: a multiple of pi for a special value, else the symbolic call. */
  const principal = (key: 'asin' | 'acos' | 'atan'): UnitRoot | null => {
    const frac = special(key);
    if (frac) return { frac, text: piMultipleText(frac) };
    return text === null ? null : { frac: null, text: `${key}(${text})` };
  };
  const plain = (rootText: string): UnitRoot => ({ frac: null, text: rootText });

  switch (name) {
    case 'sin': {
      if (Math.abs(c) > 1 && !atOne) return { roots: [] };
      const r1 = principal('asin');
      if (r1 === null) return null;
      if (atOne) return { roots: [r1], period: [2, 1] };
      const r2: UnitRoot = r1.frac
        ? { frac: subtractFrom(1, r1.frac), text: piMultipleText(subtractFrom(1, r1.frac)) }
        : plain(`pi - ${r1.text}`);
      return { roots: [r1, r2], period: [2, 1] };
    }
    case 'cos': {
      if (Math.abs(c) > 1 && !atOne) return { roots: [] };
      const r1 = principal('acos');
      if (r1 === null) return null;
      if (atOne) return { roots: [r1], period: [2, 1] };
      const r2: UnitRoot = r1.frac
        ? { frac: subtractFrom(2, r1.frac), text: piMultipleText(subtractFrom(2, r1.frac)) }
        : plain(`2*pi - ${r1.text}`);
      return { roots: [r1, r2], period: [2, 1] };
    }
    case 'tan': {
      const r = principal('atan');
      return r === null ? null : { roots: [r], period: [1, 1] };
    }
    case 'exp':
      if (c <= 0) return { roots: [] };
      if (Math.abs(c - 1) < SPECIAL_TOLERANCE) return { roots: [plain('0')] };
      return text === null ? null : { roots: [plain(`log(${text})`)] };
    case 'log':
      if (Math.abs(c) < SPECIAL_TOLERANCE) return { roots: [plain('1')] };
      if (Math.abs(c - 1) < SPECIAL_TOLERANCE) return { roots: [plain('e')] };
      return text === null ? null : { roots: [plain(`exp(${text})`)] };
    case 'sqrt': {
      if (c < 0) return { roots: [] };
      const f = toFraction(c);
      if (f === null) return null;
      return { roots: [plain(fractionText(makeFraction(f[0] * f[0], f[1] * f[1])))] };
    }
    case 'abs': {
      if (c < 0) return { roots: [] };
      if (Math.abs(c) < SPECIAL_TOLERANCE) return { roots: [plain('0')] };
      const positive = exactText(c);
      const negative = exactText(-c);
      if (positive === null || negative === null) return null;
      return { roots: [plain(negative), plain(positive)] };
    }
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

/** True when `text` has a `+` or `-` outside brackets, apart from a leading sign. */
function hasTopLevelSum(text: string): boolean {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && i > 0 && (ch === '+' || ch === '-')) return true;
  }
  return false;
}

/**
 * Read the coefficient `p` of the argument as a fraction, or as a fraction times `pi` when the
 * argument names `pi`. Returns null for any other value of `p` (`sqrt(2)*x`, `3.14159*x`), which
 * has no exact text.
 */
function readScale(p: number, mentionsPi: boolean): Scale | null {
  if (mentionsPi) {
    const ratio = toFraction(p / Math.PI);
    if (ratio !== null && ratio[0] !== 0) return { frac: ratio, pi: true };
  }
  const frac = toFraction(p);
  return frac !== null && frac[0] !== 0 ? { frac, pi: false } : null;
}

/**
 * Map the root `u` of `F(u) = c` back to `x`, where `u = p*x + q`. Returns null when the text
 * of a constant would carry a rounded digit.
 */
function mapToVariable(root: UnitRoot, scale: Scale, q: number): string | null {
  const p = scale.frac[0] / scale.frac[1];
  if (root.frac && q === 0) {
    // u = t*pi, so x = t*pi / p. With p = r*pi the factors of pi cancel.
    const t = makeFraction(root.frac[0] * scale.frac[1], root.frac[1] * scale.frac[0]);
    return scale.pi ? fractionText(t) : piMultipleText(t);
  }
  const number = plainNumber(root.text);
  if (number !== null && !scale.pi) return exactText((number - q) / p);

  let numerator: string;
  if (q === 0) {
    numerator = root.text;
  } else if (root.text === '0') {
    const shift = exactText(-q);
    if (shift === null) return null;
    numerator = shift;
  } else {
    const shift = exactText(Math.abs(q));
    if (shift === null) return null;
    numerator = `${root.text} ${q > 0 ? '-' : '+'} ${shift}`;
  }
  // x = numerator / |p| with |p| = n/d (times pi when scale.pi): write d*numerator / n, or
  // d*numerator / (n*pi), so that no quotient of quotients such as `a/(1/2)` appears.
  const [n, d] = [Math.abs(scale.frac[0]), scale.frac[1]];
  const divisor = scale.pi ? (n === 1 ? 'pi' : `(${n}*pi)`) : n === 1 ? '' : String(n);
  const unit = d === 1 && divisor === '';
  const wrap = !unit && (hasTopLevelSum(numerator) || (d !== 1 && numerator.startsWith('-')));
  const top = wrap ? `(${numerator})` : numerator;
  const product = d === 1 ? top : `${d}*${top}`;
  const body = divisor === '' ? product : `${product}/${divisor}`;
  if (scale.frac[0] > 0) return body;
  if (hasTopLevelSum(body)) return `-(${body})`;
  return body.startsWith('-') ? body.slice(1) : `-${body}`;
}

/** The period `base * pi / |p|` as text. */
function periodText(base: Fraction, scale: Scale): string {
  const ratio = makeFraction(base[0] * scale.frac[1], base[1] * Math.abs(scale.frac[0]));
  return scale.pi ? fractionText(ratio) : piMultipleText(ratio);
}

/**
 * Solve `expr = 0` exactly when `expr` is `a*F(p*x + q) + b` for one supported `F`.
 *
 * @param expr - The expression to set to zero, as text.
 * @param variable - The variable to solve for.
 * @returns The exact real roots and, for a periodic `F`, the period; or `null` when `expr` has
 *   another shape, or when a constant of it has no exact text.
 *
 * @example
 * solveElementary('sin(x)', 'x');     // { roots: ['0', 'pi'], period: '2*pi' }
 * solveElementary('2*cos(x) - 1', 'x'); // { roots: ['pi/3', '5*pi/3'], period: '2*pi' }
 * solveElementary('sin(2*pi*x)', 'x'); // { roots: ['0', '1/2'], period: '1' }
 * solveElementary('sin(x) - x', 'x'); // null
 * solveElementary('sin(x) - sqrt(2)/3', 'x'); // null
 */
export function solveElementary(expr: string, variable: string): ElementarySolution | null {
  const node = parseTree(expr);
  if (node === null) return null;
  const linear = readCall(node, variable);
  if (linear === null || linear.target === null || linear.k === 0) return null;
  const { name, p, q, mentionsPi } = linear.target;
  const scale = readScale(p, mentionsPi);
  if (scale === null) return null;
  if (q !== 0 && exactText(Math.abs(q)) === null) return null;
  const unit = solveUnit(name, -linear.c / linear.k);
  if (unit === null) return null;
  const roots: string[] = [];
  for (const root of unit.roots) {
    const text = mapToVariable(root, scale, q);
    if (text === null) return null;
    roots.push(text);
  }
  const solution: ElementarySolution = { roots };
  if (unit.period) solution.period = periodText(unit.period, scale);
  return solution;
}
