/**
 * Exact unit scales.
 *
 * A unit's scale to SI is a rational number times integer powers of π and ln 2:
 * `num / den × π^pi × (ln 2)^ln2`. Products, quotients and integer powers stay
 * exact, so a scale is rounded to a double once, at the end, by
 * {@link exactScaleToNumber}. `psi` stated as `lbf/inch^2` is therefore the
 * double nearest 0.45359237 × 9.80665 / 0.0254², not the result of three
 * rounded float steps.
 *
 * A decimal literal (`'0.0254'`, `'1.602176634e-19'`) is read digit for digit.
 * A JavaScript number is read through its shortest round-trip decimal
 * (`String(x)`), which is the literal it was written as.
 *
 * Scale expressions (the form the unit table states its rows in) are factors
 * joined by `*`, optionally followed by one `/` and the denominator's factors.
 * Each factor is a decimal literal, `pi`, `ln2`, or a named scale, with an
 * optional integer power `^n`. Everything after the first `/` is the
 * denominator (ISO 80000-1 single-solidus reading): `a/b*c` is a/(b·c).
 *
 * @module @danielsimonjr/mathts-core/types/unit/exact-scale
 */

/** `num / den × π^pi × (ln 2)^ln2`, with `den > 0`, the fraction in lowest terms. */
export interface ExactScale {
  readonly num: bigint;
  readonly den: bigint;
  /** The integer power of π (1 for `deg = pi/180`, -1 for the parsec, 0 for a rational scale). */
  readonly pi: number;
  /** The integer power of ln 2 (1 for `ln2`, -1 for the nats-to-bits factor). */
  readonly ln2: number;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

function make(num: bigint, den: bigint, pi: number, ln2: number): ExactScale {
  if (den === 0n) throw new RangeError('exact scale: zero denominator');
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den);
  return g > 1n ? { num: num / g, den: den / g, pi, ln2 } : { num, den, pi, ln2 };
}

/** The scale 1. */
export const UNIT_EXACT_SCALE: ExactScale = Object.freeze({
  num: 1n,
  den: 1n,
  pi: 0,
  ln2: 0,
});

/** π itself, as a scale. */
export const PI_EXACT_SCALE: ExactScale = Object.freeze({
  num: 1n,
  den: 1n,
  pi: 1,
  ln2: 0,
});

/** ln 2 itself, as a scale. */
export const LN2_EXACT_SCALE: ExactScale = Object.freeze({
  num: 1n,
  den: 1n,
  pi: 0,
  ln2: 1,
});

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
    ? make(num * 10n ** BigInt(exponent), 1n, 0, 0)
    : make(num, 10n ** BigInt(-exponent), 0, 0);
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
  if (x === 0) return make(0n, 1n, 0, 0);
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
    ? make(num << BigInt(exponent), 1n, 0, 0)
    : make(num, 1n << BigInt(-exponent), 0, 0);
}

/** `num / den`, exactly. */
export function ratioExactScale(num: number | bigint, den: number | bigint = 1n): ExactScale {
  return make(BigInt(num), BigInt(den), 0, 0);
}

/** `a × b × …`. */
export function multiplyExactScales(...factors: readonly ExactScale[]): ExactScale {
  let num = 1n;
  let den = 1n;
  let pi = 0;
  let ln2 = 0;
  for (const f of factors) {
    num *= f.num;
    den *= f.den;
    pi += f.pi;
    ln2 += f.ln2 ?? 0;
  }
  return make(num, den, pi, ln2);
}

/** `a / b`. */
export function divideExactScales(a: ExactScale, b: ExactScale): ExactScale {
  if (b.num === 0n) throw new RangeError('exact scale: division by zero');
  return make(a.num * b.den, a.den * b.num, a.pi - b.pi, (a.ln2 ?? 0) - (b.ln2 ?? 0));
}

/** `a ^ n` for an integer `n`. A fractional power has no exact form and throws. */
export function powerExactScale(a: ExactScale, n: number): ExactScale {
  if (!Number.isInteger(n)) throw new RangeError(`exact scale: power ${n} is not an integer`);
  const k = BigInt(Math.abs(n));
  const ln2 = a.ln2 ?? 0;
  const up = make(a.num ** k, a.den ** k, a.pi * Math.abs(n), ln2 * Math.abs(n));
  return n >= 0 ? up : divideExactScales(UNIT_EXACT_SCALE, up);
}

/** Whether two exact scales are the same number. */
export function exactScalesEqual(a: ExactScale, b: ExactScale): boolean {
  return (
    a.num === b.num &&
    a.den === b.den &&
    (a.num === 0n || (a.pi === b.pi && (a.ln2 ?? 0) === (b.ln2 ?? 0)))
  );
}

/**
 * `a + b`, when both carry the same powers of π and ln 2; null otherwise
 * (π and ln 2 are transcendental and algebraically independent over Q).
 */
export function addExactScales(a: ExactScale, b: ExactScale): ExactScale | null {
  if (a.num === 0n) return b;
  if (b.num === 0n) return a;
  if (a.pi !== b.pi || (a.ln2 ?? 0) !== (b.ln2 ?? 0)) return null;
  return make(a.num * b.den + b.num * a.den, a.den * b.den, a.pi, a.ln2 ?? 0);
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

/**
 * ln 2 truncated to 120 decimal places (same relative-error story as π).
 * Source digits: OEIS A002162 / standard high-precision expansion.
 */
const LN2_DIGITS =
  '693147180559945309417232121458176568075500134360255254120680009493393621969694715605863326996418687542001481020805829729';
const LN2_NUM = BigInt(LN2_DIGITS);
const LN2_DEN = 10n ** BigInt(LN2_DIGITS.length);

/**
 * `num / den` (`den > 0`) rounded once to the nearest double, ties to even.
 *
 * Uses integer arithmetic in base 2 (shift the ratio into the 53-bit significand
 * window, then round from the remainder). The previous decimal-sticky path
 * mis-rounded magnitudes above about 1e41.
 */
function rationalToNumber(num: bigint, den: bigint): number {
  if (num === 0n) return 0;
  const negative = num < 0n;
  let a = negative ? -num : num;
  const g = gcd(a, den);
  a /= g;
  den /= g;

  // Fast magnitude screen from bit lengths (floor(log2)+1).
  const bitLen = (x: bigint): number => (x === 0n ? 0 : x.toString(2).length);
  const log2Approx = bitLen(a) - bitLen(den);
  if (log2Approx > 1025) return negative ? -Infinity : Infinity;
  if (log2Approx < -1080) return negative ? -0 : 0;

  const scaled = (k: number): bigint => (k >= 0 ? (a << BigInt(k)) / den : a / (den << BigInt(-k)));

  let shift = 0;
  // Move into the normal significand window [2^52, 2^53), or the subnormal
  // window when the value is smaller than the smallest normal.
  if (scaled(0) === 0n) {
    while (shift < 1100 && scaled(shift) < 1n << 52n) shift++;
  } else {
    while (scaled(shift) < 1n << 52n) shift++;
    while (scaled(shift) >= 1n << 53n) shift--;
  }

  // Subnormals: unbiased exponent would be < -1022 ⇒ use fixed 2^-1074 grid.
  // value = m * 2^-shift with m in [2^52, 2^53) ⇒ unbiased exp = 52 - shift.
  if (52 - shift < -1022) {
    shift = 1074;
    const n = a;
    const d = den << BigInt(shift);
    let m = n / d;
    const twice = 2n * (n % d);
    if (twice > d || (twice === d && m % 2n === 1n)) m += 1n;
    if (m === 0n) return negative ? -0 : 0;
    if (m >= 1n << 52n) {
      // Rounded up into the smallest normal (2^-1022).
      const value = Number(1n << 52n) * 2 ** -1074 * 2; // = 2^-1022
      return negative ? -value : value;
    }
    const value = Number(m) * 2 ** -1074;
    return negative ? -value : value;
  }

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

/** Fold π and ln 2 powers into the rational, then round once. */
function scaleToRational(s: ExactScale): { num: bigint; den: bigint } {
  let num = s.num;
  let den = s.den;
  const pi = s.pi;
  const ln2 = s.ln2 ?? 0;
  if (pi !== 0) {
    const k = BigInt(Math.abs(pi));
    if (pi > 0) {
      num *= PI_NUM ** k;
      den *= PI_DEN ** k;
    } else {
      num *= PI_DEN ** k;
      den *= PI_NUM ** k;
    }
  }
  if (ln2 !== 0) {
    const k = BigInt(Math.abs(ln2));
    if (ln2 > 0) {
      num *= LN2_NUM ** k;
      den *= LN2_DEN ** k;
    } else {
      num *= LN2_DEN ** k;
      den *= LN2_NUM ** k;
    }
  }
  return { num, den };
}

const numberCache = new Map<string, number>();

function cacheKey(s: ExactScale): string {
  return `${s.num}/${s.den}|${s.pi}|${s.ln2 ?? 0}`;
}

/** Drop the {@link exactScaleToNumber} memo table (tests). */
export function clearExactScaleNumberCache(): void {
  numberCache.clear();
}

/** How many exact scales have a cached double (tests / diagnostics). */
export function exactScaleNumberCacheSize(): number {
  return numberCache.size;
}

/** The scale as a double, rounded once. Repeated calls reuse a memoized result. */
export function exactScaleToNumber(s: ExactScale): number {
  const key = cacheKey(s);
  const cached = numberCache.get(key);
  if (cached !== undefined) return cached;
  const { num, den } = scaleToRational(s);
  const value = rationalToNumber(num, den);
  numberCache.set(key, value);
  return value;
}

/** The scale as text: `num/den`, with `*pi^k` / `*ln2^k` when those are factors. */
export function formatExactScale(s: ExactScale): string {
  const rational = s.den === 1n ? `${s.num}` : `${s.num}/${s.den}`;
  const parts: string[] = [rational];
  if (s.pi !== 0) parts.push(s.pi === 1 ? 'pi' : `pi^${s.pi}`);
  const ln2 = s.ln2 ?? 0;
  if (ln2 !== 0) parts.push(ln2 === 1 ? 'ln2' : `ln2^${ln2}`);
  return parts.length === 1 ? rational : parts.join('*');
}

const FACTOR = /^([^*/^\s()]+)(?:\^([+-]?\d+))?$/;

/**
 * The exact value of a scale expression (`'lbf/inch^2'`, `'648000*astronomical_unit/pi'`,
 * `'101325/760'`, `'ln2'`). `resolve` gives a name its scale and returns undefined for a
 * name it does not know, which throws here. `pi` always means π; `ln2` always means ln 2.
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
      const base =
        decimalExactScale(atom) ??
        (atom === 'pi' ? PI_EXACT_SCALE : atom === 'ln2' ? LN2_EXACT_SCALE : resolve(atom));
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
