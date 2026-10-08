/**
 * Exact unit scales.
 *
 * A unit's scale to SI is a rational number times an integer power of π:
 * `num / den × π^pi`. Products, quotients and integer powers stay exact, so a
 * scale is rounded to a double once, at the end, by {@link exactScaleToNumber}.
 * `psi` stated as `lbf/inch^2` is therefore the double nearest
 * 0.45359237 × 9.80665 / 0.0254², not the result of three rounded float steps.
 *
 * A decimal literal (`'0.0254'`, `'1.602176634e-19'`) is read digit for digit.
 * A JavaScript number is read through its shortest round-trip decimal
 * (`String(x)`), which is the literal it was written as.
 *
 * Scale expressions (the form the unit table states its rows in) are factors
 * joined by `*`, optionally followed by one `/` and the denominator's factors.
 * Each factor is a decimal literal, `pi`, or a named scale, with an optional
 * integer power `^n`. Everything after the first `/` is the denominator
 * (ISO 80000-1 single-solidus reading): `a/b*c` is a/(b·c).
 *
 * @module @danielsimonjr/mathts-core/types/unit/exact-scale
 */

/** `num / den × π^pi`, with `den > 0`, the fraction in lowest terms, and `pi` an integer. */
export interface ExactScale {
  readonly num: bigint;
  readonly den: bigint;
  /** The integer power of π (1 for `deg = pi/180`, -1 for the parsec, 0 for a rational scale). */
  readonly pi: number;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

function make(num: bigint, den: bigint, pi: number): ExactScale {
  if (den === 0n) throw new RangeError('exact scale: zero denominator');
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den);
  return g > 1n ? { num: num / g, den: den / g, pi } : { num, den, pi };
}

/** The scale 1. */
export const UNIT_EXACT_SCALE: ExactScale = Object.freeze({ num: 1n, den: 1n, pi: 0 });

/** π itself, as a scale. */
export const PI_EXACT_SCALE: ExactScale = Object.freeze({ num: 1n, den: 1n, pi: 1 });

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
    ? make(num * 10n ** BigInt(exponent), 1n, 0)
    : make(num, 10n ** BigInt(-exponent), 0);
}

/** The exact decimal a finite JavaScript number prints as (its shortest round-trip form). */
export function exactScaleOf(x: number): ExactScale {
  if (!Number.isFinite(x)) throw new RangeError(`exact scale: ${x} is not finite`);
  return decimalExactScale(String(x))!;
}

/**
 * The exact binary value of a finite double (`0.1` is 3602879701896397 / 2^55).
 * This is the value a computed double holds, where {@link exactScaleOf} reads
 * the decimal a typed number was meant as.
 */
export function binaryExactScale(x: number): ExactScale {
  if (!Number.isFinite(x)) throw new RangeError(`exact scale: ${x} is not finite`);
  if (x === 0) return make(0n, 1n, 0);
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
    ? make(num << BigInt(exponent), 1n, 0)
    : make(num, 1n << BigInt(-exponent), 0);
}

/** `num / den`, exactly. */
export function ratioExactScale(num: number | bigint, den: number | bigint = 1n): ExactScale {
  return make(BigInt(num), BigInt(den), 0);
}

/** `a × b × …`. */
export function multiplyExactScales(...factors: readonly ExactScale[]): ExactScale {
  let num = 1n;
  let den = 1n;
  let pi = 0;
  for (const f of factors) {
    num *= f.num;
    den *= f.den;
    pi += f.pi;
  }
  return make(num, den, pi);
}

/** `a / b`. */
export function divideExactScales(a: ExactScale, b: ExactScale): ExactScale {
  if (b.num === 0n) throw new RangeError('exact scale: division by zero');
  return make(a.num * b.den, a.den * b.num, a.pi - b.pi);
}

/** `a ^ n` for an integer `n`. A fractional power has no exact form and throws. */
export function powerExactScale(a: ExactScale, n: number): ExactScale {
  if (!Number.isInteger(n)) throw new RangeError(`exact scale: power ${n} is not an integer`);
  const k = BigInt(Math.abs(n));
  const up = make(a.num ** k, a.den ** k, a.pi * Math.abs(n));
  return n >= 0 ? up : divideExactScales(UNIT_EXACT_SCALE, up);
}

/** Whether two exact scales are the same number. */
export function exactScalesEqual(a: ExactScale, b: ExactScale): boolean {
  return a.num === b.num && a.den === b.den && (a.num === 0n || a.pi === b.pi);
}

/** `a + b`, when both carry the same power of π; null otherwise (π is transcendental). */
export function addExactScales(a: ExactScale, b: ExactScale): ExactScale | null {
  if (a.num === 0n) return b;
  if (b.num === 0n) return a;
  if (a.pi !== b.pi) return null;
  return make(a.num * b.den + b.num * a.den, a.den * b.den, a.pi);
}

/**
 * π truncated to 120 decimal places. Rounding `r × π^k` through this rational
 * is off from rounding the true value only if the true value lies within about
 * 1e-118 (relative) of a midpoint between two doubles.
 */
const PI_DIGITS =
  '3141592653589793238462643383279502884197169399375105820974944592307816406286208998628034825342117067982148086513282306647';
const PI_NUM = BigInt(PI_DIGITS);
const PI_DEN = 10n ** BigInt(PI_DIGITS.length - 1);

/** The fewest significant digits kept before the sticky digit; far beyond a double's 17. */
const MIN_DIGITS = 40;

/** Decimal places of `1 / den` when it terminates (`den` = 2^a·5^b): max(a, b). Null otherwise. */
function terminatingPlaces(den: bigint): number | null {
  let d = den;
  let twos = 0;
  let fives = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    twos++;
  }
  while (d % 5n === 0n) {
    d /= 5n;
    fives++;
  }
  return d === 1n ? Math.max(twos, fives) : null;
}

/**
 * `num / den` (`den > 0`) rounded once to the nearest double, ties to even.
 *
 * A terminating quotient (`den` = 2^a·5^b) is written out exactly and parsed,
 * so a tie (always a dyadic rational) lands here and rounds half to even. Any
 * other quotient is not a tie and sits at least `1 / (den·2^54)` of its
 * magnitude from every tie; truncating it to `max(40, digits(den) + 20)`
 * significant digits stays closer than that, and a sticky `1` keeps the string
 * strictly inside the truncation interval, so the parse rounds the way the
 * quotient does.
 */
function rationalToNumber(num: bigint, den: bigint): number {
  if (num === 0n) return 0;
  const negative = num < 0n;
  const g = gcd(num, den);
  const a = (negative ? -num : num) / g;
  den /= g;
  const places = terminatingPlaces(den);
  if (places !== null) {
    const value = Number(`${(a * 10n ** BigInt(places)) / den}e-${places}`);
    return negative ? -value : value;
  }
  const digits = Math.max(MIN_DIGITS, den.toString().length + 20);
  const shift = digits - (a.toString().length - den.toString().length);
  const q = shift >= 0 ? (a * 10n ** BigInt(shift)) / den : a / (den * 10n ** BigInt(-shift));
  // Not terminating, so the remainder is never zero: the sticky digit is always due.
  const value = Number(`${q.toString()}1e${-(shift + 1)}`);
  return negative ? -value : value;
}

/** The scale as a double, rounded once. */
export function exactScaleToNumber(s: ExactScale): number {
  if (s.pi === 0) return rationalToNumber(s.num, s.den);
  const k = BigInt(Math.abs(s.pi));
  return s.pi > 0
    ? rationalToNumber(s.num * PI_NUM ** k, s.den * PI_DEN ** k)
    : rationalToNumber(s.num * PI_DEN ** k, s.den * PI_NUM ** k);
}

/** The scale as text: `num/den`, with `*pi^k` when π is a factor. For messages and tests. */
export function formatExactScale(s: ExactScale): string {
  const rational = s.den === 1n ? `${s.num}` : `${s.num}/${s.den}`;
  if (s.pi === 0) return rational;
  return `${rational}*pi${s.pi === 1 ? '' : `^${s.pi}`}`;
}

const FACTOR = /^([^*/^\s()]+)(?:\^([+-]?\d+))?$/;

/**
 * The exact value of a scale expression (`'lbf/inch^2'`, `'648000*astronomical_unit/pi'`,
 * `'101325/760'`). `resolve` gives a name its scale and returns undefined for a
 * name it does not know, which throws here. `pi` always means π.
 */
export function readScaleExpression(
  text: string,
  resolve: (name: string) => ExactScale | undefined = () => undefined
): ExactScale {
  const product = (side: string): ExactScale => {
    let scale = UNIT_EXACT_SCALE;
    for (const part of side.split('*')) {
      const m = FACTOR.exec(part);
      if (m === null) throw new RangeError(`exact scale: '${text}' is not a product of factors`);
      const atom = m[1]!;
      const base = decimalExactScale(atom) ?? (atom === 'pi' ? PI_EXACT_SCALE : resolve(atom));
      if (base === undefined) {
        throw new RangeError(`exact scale: '${text}' names '${atom}', which is not a known scale`);
      }
      scale = multiplyExactScales(
        scale,
        m[2] === undefined ? base : powerExactScale(base, Number(m[2]))
      );
    }
    return scale;
  };
  const trimmed = text.trim();
  const parts = trimmed.split('/');
  const top = product(parts[0]!);
  return parts.length > 1 ? divideExactScales(top, product(parts.slice(1).join('*'))) : top;
}
