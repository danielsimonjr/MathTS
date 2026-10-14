/**
 * Exact unit scales.
 *
 * A unit's scale to SI is a rational number times integer powers of named
 * irrationals: `num / den × Π name^k`. The names come from one registry,
 * {@link NAMED_IRRATIONALS} (π and ln 2 today); adding a constant is one entry
 * there. Products, quotients and integer powers stay exact, so a scale is
 * rounded to a double once, at the end, by {@link exactScaleToNumber}. `psi`
 * stated as `lbf/inch^2` is therefore the double nearest
 * 0.45359237 × 9.80665 / 0.0254², not the result of three rounded float steps.
 *
 * A decimal literal (`'0.0254'`, `'1.602176634e-19'`) is read digit for digit.
 * A JavaScript number is read through its shortest round-trip decimal
 * (`String(x)`), which is the literal it was written as.
 *
 * Scale expressions (the form the unit table states its rows in) are factors
 * joined by `*`, optionally followed by one `/` and the denominator's factors.
 * A factor is a decimal literal, a registered irrational name, a named scale,
 * or a parenthesized expression, with an optional integer power `^n`.
 * Whitespace between tokens is ignored. Everything after the first `/` at one
 * level is the denominator (ISO 80000-1 single-solidus reading): `a/b*c` is
 * a/(b·c), and `a/(b*c)` says the same with explicit grouping.
 *
 * @module @danielsimonjr/mathts-core/types/unit/exact-scale
 */

/**
 * The named irrationals a scale may carry, each as a decimal truncated to 120
 * places. Rounding `r × Π c^k` through these rationals is off from rounding the
 * true value only if the true value lies within about 1e-118 (relative) of a
 * midpoint between two doubles. The test files pin each entry's digits against
 * an independent computation. The constants are assumed algebraically
 * independent over Q (not known for π and ln 2; Schanuel's conjecture implies
 * it), so scales with different irrational powers never compare equal or add.
 */
export const NAMED_IRRATIONALS = Object.freeze({
  pi: '3.141592653589793238462643383279502884197169399375105820974944592307816406286208998628034825342117067982148086513282306647',
  ln2: '0.693147180559945309417232121458176568075500134360255254120680009493393621969694715605863326996418687542001481020570685733',
} as const);

/** A name in {@link NAMED_IRRATIONALS}. */
export type IrrationalName = keyof typeof NAMED_IRRATIONALS;

/** Integer powers of named irrationals; a name with power 0 is absent. */
export type IrrationalPowers = Readonly<Partial<Record<IrrationalName, number>>>;

/** `num / den × Π name^power`, with `den > 0` and the fraction in lowest terms. */
export interface ExactScale {
  readonly num: bigint;
  readonly den: bigint;
  /** Nonzero integer powers of named irrationals (`{ pi: 1 }` for `deg = pi/180`, `{}` when rational). */
  readonly irrationals: IrrationalPowers;
}

function isIrrationalName(name: string): name is IrrationalName {
  return Object.prototype.hasOwnProperty.call(NAMED_IRRATIONALS, name);
}

/** The power of `name` in `s` (0 when absent). */
export function irrationalPower(s: ExactScale, name: IrrationalName): number {
  return s.irrationals[name] ?? 0;
}

/** Whether `s` is a plain rational (no irrational factor). */
export function isRationalScale(s: ExactScale): boolean {
  return Object.keys(s.irrationals).length === 0;
}

const NO_IRRATIONALS: IrrationalPowers = Object.freeze({});

/** Combine powers: `a + sign·b` per name, dropping zeros, keys in a fixed order. */
function combinePowers(a: IrrationalPowers, b: IrrationalPowers, sign: number): IrrationalPowers {
  if (Object.keys(b).length === 0) return a;
  const out: Partial<Record<IrrationalName, number>> = {};
  let any = false;
  for (const name of Object.keys(NAMED_IRRATIONALS) as IrrationalName[]) {
    const k = (a[name] ?? 0) + sign * (b[name] ?? 0);
    if (k !== 0) {
      out[name] = k;
      any = true;
    }
  }
  return any ? Object.freeze(out) : NO_IRRATIONALS;
}

function scalePowers(a: IrrationalPowers, n: number): IrrationalPowers {
  if (n === 0) return NO_IRRATIONALS;
  if (n === 1 || Object.keys(a).length === 0) return a;
  const out: Partial<Record<IrrationalName, number>> = {};
  for (const name of Object.keys(a) as IrrationalName[]) out[name] = a[name]! * n;
  return Object.freeze(out);
}

function powersEqual(a: IrrationalPowers, b: IrrationalPowers): boolean {
  for (const name of Object.keys(NAMED_IRRATIONALS) as IrrationalName[]) {
    if ((a[name] ?? 0) !== (b[name] ?? 0)) return false;
  }
  return true;
}

const SAFE_GCD = 1n << 53n;

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  if (x <= SAFE_GCD && y <= SAFE_GCD) {
    // Both exact as doubles: Euclid in floating point is exact and much cheaper than BigInt.
    let p = Number(x);
    let q = Number(y);
    while (q !== 0) [p, q] = [q, p % q];
    return BigInt(p);
  }
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

/** Whether `s` is exactly 1 (then a product or quotient can return the other operand). */
function isOne(s: ExactScale): boolean {
  return s.num === 1n && s.den === 1n && isRationalScale(s);
}

function make(num: bigint, den: bigint, irrationals: IrrationalPowers): ExactScale {
  if (den === 0n) throw new RangeError('exact scale: zero denominator');
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den);
  return g > 1n ? { num: num / g, den: den / g, irrationals } : { num, den, irrationals };
}

/** The scale 1. */
export const UNIT_EXACT_SCALE: ExactScale = Object.freeze({
  num: 1n,
  den: 1n,
  irrationals: NO_IRRATIONALS,
});

/** A registered irrational itself, as a scale (`namedIrrationalScale('pi')` is π). */
export function namedIrrationalScale(name: IrrationalName): ExactScale {
  return Object.freeze({ num: 1n, den: 1n, irrationals: Object.freeze({ [name]: 1 }) });
}

/** π itself, as a scale. */
export const PI_EXACT_SCALE: ExactScale = namedIrrationalScale('pi');

/** ln 2 itself, as a scale. */
export const LN2_EXACT_SCALE: ExactScale = namedIrrationalScale('ln2');

const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/;

/** The exact value of a decimal literal, or null when `text` is not one. */
export function decimalExactScale(text: string): ExactScale | null {
  const m = DECIMAL.exec(text.trim());
  if (m === null) return null;
  const whole = m[2] ?? '';
  const fraction = m[3] ?? '';
  if (whole === '' && fraction === '') return null;
  const exponent = Number(m[4] ?? '0') - fraction.length;
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 10_000) return null;
  let num = BigInt(whole + fraction);
  if (m[1] === '-') num = -num;
  return exponent >= 0
    ? make(num * 10n ** BigInt(exponent), 1n, NO_IRRATIONALS)
    : make(num, 10n ** BigInt(-exponent), NO_IRRATIONALS);
}

/** The exact decimal a finite JavaScript number prints as (its shortest round-trip form). */
export function exactScaleOf(x: number): ExactScale {
  if (!Number.isFinite(x)) throw new RangeError(`exact scale: ${x} is not finite`);
  if (Number.isSafeInteger(x)) return make(BigInt(x), 1n, NO_IRRATIONALS);
  return decimalExactScale(String(x))!;
}

/**
 * The exact binary value of a finite double (`0.1` is 3602879701896397 / 2^55).
 * This is the value a computed double holds, where {@link exactScaleOf} reads
 * the decimal a typed number was meant as.
 */
export function binaryExactScale(x: number): ExactScale {
  if (!Number.isFinite(x)) throw new RangeError(`exact scale: ${x} is not finite`);
  if (x === 0) return make(0n, 1n, NO_IRRATIONALS);
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const negative = bits >> 63n === 1n;
  const biased = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & ((1n << 52n) - 1n);
  const mantissa = biased === 0 ? fraction : fraction | (1n << 52n);
  const exponent = (biased === 0 ? 1 : biased) - 1075;
  const num = negative ? -mantissa : mantissa;
  return exponent >= 0
    ? make(num << BigInt(exponent), 1n, NO_IRRATIONALS)
    : make(num, 1n << BigInt(-exponent), NO_IRRATIONALS);
}

/** `num / den`, exactly. */
export function ratioExactScale(num: number | bigint, den: number | bigint = 1n): ExactScale {
  return make(BigInt(num), BigInt(den), NO_IRRATIONALS);
}

/** `a × b × …`. */
export function multiplyExactScales(...factors: readonly ExactScale[]): ExactScale {
  if (factors.length === 2) {
    if (isOne(factors[1]!)) return factors[0]!;
    if (isOne(factors[0]!)) return factors[1]!;
  }
  let num = 1n;
  let den = 1n;
  let irrationals = NO_IRRATIONALS;
  for (const f of factors) {
    num *= f.num;
    den *= f.den;
    irrationals = combinePowers(irrationals, f.irrationals, 1);
  }
  return make(num, den, irrationals);
}

/** `a / b`. */
export function divideExactScales(a: ExactScale, b: ExactScale): ExactScale {
  if (b.num === 0n) throw new RangeError('exact scale: division by zero');
  if (isOne(b)) return a;
  return make(a.num * b.den, a.den * b.num, combinePowers(a.irrationals, b.irrationals, -1));
}

/** `a ^ n` for an integer `n`. A fractional power has no exact form and throws. */
export function powerExactScale(a: ExactScale, n: number): ExactScale {
  if (!Number.isInteger(n)) throw new RangeError(`exact scale: power ${n} is not an integer`);
  const k = BigInt(Math.abs(n));
  const up = make(a.num ** k, a.den ** k, scalePowers(a.irrationals, Math.abs(n)));
  return n >= 0 ? up : divideExactScales(UNIT_EXACT_SCALE, up);
}

/** Whether two exact scales are the same number. */
export function exactScalesEqual(a: ExactScale, b: ExactScale): boolean {
  return (
    a.num === b.num &&
    a.den === b.den &&
    (a.num === 0n || powersEqual(a.irrationals, b.irrationals))
  );
}

/**
 * `a + b`, when both carry the same irrational powers; null otherwise (the
 * registered irrationals are taken as algebraically independent over Q).
 */
export function addExactScales(a: ExactScale, b: ExactScale): ExactScale | null {
  if (a.num === 0n) return b;
  if (b.num === 0n) return a;
  if (!powersEqual(a.irrationals, b.irrationals)) return null;
  return make(a.num * b.den + b.num * a.den, a.den * b.den, a.irrationals);
}

/** Each registered irrational as `num / den`, read once from its digits. */
const IRRATIONAL_RATIONALS: Readonly<Record<IrrationalName, ExactScale>> = Object.freeze(
  Object.fromEntries(
    (Object.keys(NAMED_IRRATIONALS) as IrrationalName[]).map((name) => [
      name,
      decimalExactScale(NAMED_IRRATIONALS[name])!,
    ])
  ) as Record<IrrationalName, ExactScale>
);

/** Every integer up to 2^53 is exact as a double. */
const SAFE_OPERAND = 1n << 53n;

/** `floor(log2(x)) + 1` for `x > 0` (0 for 0). */
function bitLength(x: bigint): number {
  if (x === 0n) return 0;
  const hex = x.toString(16);
  return (hex.length - 1) * 4 + (32 - Math.clz32(parseInt(hex[0]!, 16)));
}

/**
 * `num / den` (`den > 0`) rounded once to the nearest double, ties to even.
 *
 * Uses integer arithmetic in base 2: pick the shift that puts the ratio into the
 * 53-bit significand window (or onto the fixed 2^-1074 grid below the smallest
 * normal) from the operands' bit lengths, then round from the remainder.
 */
function rationalToNumber(num: bigint, den: bigint): number {
  if (num === 0n) return 0;
  const negative = num < 0n;
  const a = negative ? -num : num;

  // Both operands exact as doubles: IEEE division rounds the quotient once, to nearest even.
  if (a <= SAFE_OPERAND && den <= SAFE_OPERAND) {
    const q = Number(a) / Number(den);
    return negative ? -q : q;
  }

  // a / den lies in [2^(e-1), 2^(e+1)) for e = bitLength(a) - bitLength(den).
  const e = bitLength(a) - bitLength(den);
  if (e > 1025) return negative ? -Infinity : Infinity;
  if (e < -1080) return negative ? -0 : 0;

  // With shift 52 - e the quotient lies in [2^51, 2^53): at most one step up reaches [2^52, 2^53).
  let shift = 52 - e;
  const quotient = (k: number): bigint =>
    k >= 0 ? (a << BigInt(k)) / den : a / (den << BigInt(-k));
  if (quotient(shift) < 1n << 52n) shift += 1;

  // Below the smallest normal double (2^-1022) the grid step is fixed at 2^-1074, so the shift
  // stops at 1074. A subnormal that rounds up to m = 2^52 is the smallest normal: no special case.
  if (shift > 1074) shift = 1074;

  const n = shift >= 0 ? a << BigInt(shift) : a;
  const d = shift >= 0 ? den : den << BigInt(-shift);
  let m = n / d;
  const twice = 2n * (n % d);
  if (twice > d || (twice === d && m % 2n === 1n)) m += 1n;
  if (m === 1n << 53n) {
    m >>= 1n;
    shift -= 1;
  }

  // Overflow after rounding into the next binade.
  if (52 - shift > 1023) return negative ? -Infinity : Infinity;

  const value = Number(m) * 2 ** -shift;
  if (!Number.isFinite(value)) return negative ? -Infinity : Infinity;
  return negative ? -value : value;
}

/** Fold the irrational powers into the rational through the registry digits. */
function scaleToRational(s: ExactScale): { num: bigint; den: bigint } {
  let num = s.num;
  let den = s.den;
  for (const name of Object.keys(s.irrationals) as IrrationalName[]) {
    const power = s.irrationals[name]!;
    const c = IRRATIONAL_RATIONALS[name];
    const k = BigInt(Math.abs(power));
    if (power > 0) {
      num *= c.num ** k;
      den *= c.den ** k;
    } else {
      num *= c.den ** k;
      den *= c.num ** k;
    }
  }
  return { num, den };
}

/**
 * The most results {@link exactScaleToNumber} keeps. Unit readings reach it as exact scales,
 * so one entry per distinct reading would grow without bound.
 */
export const EXACT_SCALE_NUMBER_CACHE_LIMIT = 4096;

const numberCache = new Map<string, number>();

/**
 * Each scale object's rounded double. Scales are immutable, so the result belongs to the object;
 * a weak map frees it with the object and needs no bound or string key.
 */
const roundedByIdentity = new WeakMap<ExactScale, number>();

/**
 * The scale as a double, rounded once, remembered for this scale object only. For one-off
 * scales (a unit's exact reading) this skips the string-keyed memo of {@link exactScaleToNumber},
 * whose key would cost as much as the rounding.
 */
export function roundExactScale(s: ExactScale): number {
  let value = roundedByIdentity.get(s);
  if (value === undefined) {
    const { num, den } = scaleToRational(s);
    value = rationalToNumber(num, den);
    roundedByIdentity.set(s, value);
  }
  return value;
}

function powersKey(p: IrrationalPowers): string {
  let key = '';
  for (const name of Object.keys(p) as IrrationalName[]) key += `|${name}^${p[name]}`;
  return key;
}

function cacheKey(s: ExactScale): string {
  return `${s.num}/${s.den}${powersKey(s.irrationals)}`;
}

/** Drop the {@link exactScaleToNumber} memo table (tests). */
export function clearExactScaleNumberCache(): void {
  numberCache.clear();
}

/** How many exact scales have a cached double (tests / diagnostics). */
export function exactScaleNumberCacheSize(): number {
  return numberCache.size;
}

/** Whether the scale has a cached double. Reads the memo without changing its order (tests). */
export function exactScaleNumberCacheHas(s: ExactScale): boolean {
  return numberCache.has(cacheKey(s));
}

/**
 * The scale as a double, rounded once. Repeated calls reuse a memoized result. The memo keeps at
 * most {@link EXACT_SCALE_NUMBER_CACHE_LIMIT} results; when it is full, the entry that was used
 * longest ago leaves first (a `Map` iterates in insertion order, and a hit re-inserts its key).
 */
export function exactScaleToNumber(s: ExactScale): number {
  const key = cacheKey(s);
  const cached = numberCache.get(key);
  if (cached !== undefined) {
    numberCache.delete(key);
    numberCache.set(key, cached);
    return cached;
  }
  const value = roundExactScale(s);
  numberCache.set(key, value);
  if (numberCache.size > EXACT_SCALE_NUMBER_CACHE_LIMIT) {
    numberCache.delete(numberCache.keys().next().value as string);
  }
  return value;
}

/** The scale as text: `num/den`, then `*name` / `*name^k` for each irrational factor. */
export function formatExactScale(s: ExactScale): string {
  const rational = s.den === 1n ? `${s.num}` : `${s.num}/${s.den}`;
  const parts: string[] = [rational];
  for (const name of Object.keys(s.irrationals) as IrrationalName[]) {
    const k = s.irrationals[name]!;
    parts.push(k === 1 ? name : `${name}^${k}`);
  }
  return parts.join('*');
}

/** Tokens: `(`, `)`, `*`, `/`, `^n`, or an atom (a decimal literal or a name). */
const TOKEN = /\s*(?:([()*/])|\^\s*([+-]?\d+)|([^\s*/^()]+))/y;

type Token =
  { kind: 'op'; op: string } | { kind: 'pow'; n: number } | { kind: 'atom'; text: string };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  TOKEN.lastIndex = 0;
  let at = 0;
  while (at < text.length) {
    if (/^\s*$/.test(text.slice(at))) break;
    TOKEN.lastIndex = at;
    const m = TOKEN.exec(text);
    if (m === null) throw new RangeError(`exact scale: '${text}' is not a product of factors`);
    if (m[1] !== undefined) tokens.push({ kind: 'op', op: m[1] });
    else if (m[2] !== undefined) tokens.push({ kind: 'pow', n: Number(m[2]) });
    else tokens.push({ kind: 'atom', text: m[3]! });
    at = TOKEN.lastIndex;
  }
  return tokens;
}

/**
 * The exact value of a scale expression (`'lbf/inch^2'`, `'648000*astronomical_unit/pi'`,
 * `'101325/760'`, `'ln2'`, `'1/(2 * pi)'`). `resolve` gives a name its scale and returns
 * undefined for a name it does not know, which throws here. A name in
 * {@link NAMED_IRRATIONALS} always means that constant.
 */
export function readScaleExpression(
  text: string,
  resolve: (name: string) => ExactScale | undefined = () => undefined
): ExactScale {
  const tokens = tokenize(text);
  let i = 0;
  const fail = (): never => {
    throw new RangeError(`exact scale: '${text}' is not a product of factors`);
  };
  const isOp = (op: string): boolean => {
    const t = tokens[i];
    return t !== undefined && t.kind === 'op' && t.op === op;
  };

  const factor = (): ExactScale => {
    const t = tokens[i++];
    let base: ExactScale | undefined;
    if (t === undefined) return fail();
    if (t.kind === 'op' && t.op === '(') {
      base = expression();
      if (!isOp(')')) fail();
      i++;
    } else if (t.kind === 'atom') {
      base =
        decimalExactScale(t.text) ??
        (isIrrationalName(t.text) ? namedIrrationalScale(t.text) : resolve(t.text));
      if (base === undefined) {
        throw new RangeError(
          `exact scale: '${text}' names '${t.text}', which is not a known scale`
        );
      }
    } else {
      return fail();
    }
    const p = tokens[i];
    if (p !== undefined && p.kind === 'pow') {
      i++;
      return powerExactScale(base, p.n);
    }
    return base;
  };

  // A product of factors; in a denominator a further `/` also multiplies (single solidus).
  const product = (denominator: boolean): ExactScale => {
    let scale = factor();
    while (isOp('*') || (denominator && isOp('/'))) {
      i++;
      scale = multiplyExactScales(scale, factor());
    }
    return scale;
  };

  const expression = (): ExactScale => {
    const top = product(false);
    if (!isOp('/')) return top;
    i++;
    return divideExactScales(top, product(true));
  };

  const result = expression();
  if (i !== tokens.length) fail();
  return result;
}
