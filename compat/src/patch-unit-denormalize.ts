/**
 * Route Unit `_denormalize` through the compat instance's scalar helpers (#1779).
 *
 * Per-instance `Unit` classes close over the unwrapped factories `divideScalar`,
 * `multiplyScalar`, and `pow`. When the magnitude is a fraction.js instance,
 * the factory `pow` path returns core `Fraction` and `divideScalar` may throw.
 * The instance shims return fraction.js throughout.
 */
import {
  isBigNumber,
  isComplex,
  isFraction as isCoreFraction,
  type Fraction,
} from '@danielsimonjr/mathts-core';
import { isMathjsFraction, mathjsFractionClass } from './mathjs-fraction-class.js';
import { mathjsCompatibleDivideScalar } from './mathjs-fraction-unary-predicates.js';

type FactorLists = { numerators: string[]; denominators: string[] };

function splitFactorSide(side: string): string[] {
  const trimmed = side.trim();
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return trimmed
      .slice(1, -1)
      .trim()
      .split(/\s+/)
      .filter((p) => p.length > 0);
  }
  return trimmed.length > 0 ? [trimmed] : [];
}

function parseUnitFactors(text: string): FactorLists {
  const slash = text.indexOf(' / ');
  if (slash === -1) {
    return { numerators: splitFactorSide(text), denominators: [] };
  }
  return {
    numerators: splitFactorSide(text.slice(0, slash)),
    denominators: splitFactorSide(text.slice(slash + 3)),
  };
}

function formatFactorGroup(parts: string[]): string {
  return parts.length === 0 ? '' : parts.length === 1 ? parts[0]! : `(${parts.join(' ')})`;
}

/** mathjs 15.3.0 display for a product of two valueless units (e.g. `m/s` × `h/m`). */
function mathjsValuelessUnitProductLabel(left: string, right: string): string {
  const a = parseUnitFactors(left);
  const b = parseUnitFactors(right);
  const numerators = [...a.numerators, ...b.numerators];
  const denominators = [...a.denominators, ...b.denominators];
  const num = formatFactorGroup(numerators);
  const den = formatFactorGroup(denominators);
  if (den.length === 0) return num;
  if (num.length === 0) return `${den} ^ -1`.replace(' ^ -1', ' / 1');
  return `${num} / ${den}`;
}

function shouldRecomputeUnitMagnitude(a: unknown, b: unknown): boolean {
  return (
    typeof a === 'bigint' ||
    typeof b === 'bigint' ||
    isMathjsFraction(a) ||
    isMathjsFraction(b) ||
    isCoreFraction(a) ||
    isCoreFraction(b)
  );
}

/** Magnitude as a finite number for the native unit kernel (not SI `valueOf`). */
function magnitudeForNativeKernel(magnitude: unknown): number {
  if (typeof magnitude === 'number') return magnitude;
  if (typeof magnitude === 'bigint') return Number(magnitude);
  if (isMathjsFraction(magnitude)) return magnitude.valueOf() as number;
  if (isCoreFraction(magnitude)) return (magnitude as Fraction).valueOf() as number;
  return Number(magnitude);
}

function compatTypeOf(value: unknown): string {
  if (isMathjsFraction(value) || isCoreFraction(value)) return 'Fraction';
  if (isBigNumber(value)) return 'BigNumber';
  if (isComplex(value)) return 'Complex';
  return typeof value === 'number' ? 'number' : typeof value;
}

type ScalarOps = {
  divideScalar: (a: unknown, b: unknown) => unknown;
  multiplyScalar: (a: unknown, b: unknown) => unknown;
  pow: (base: unknown, exponent: unknown) => unknown;
};

type UnitLike = {
  units: {
    unit: { value: unknown; logarithmic?: unknown };
    prefix: { value: unknown };
    power: unknown;
  }[];
  typeConverters: Record<string, (x: unknown) => unknown>;
  exactScale?: () => unknown;
  _exactSI?: unknown;
};

function patchedDenormalize(this: UnitLike, value: unknown, _prefixValue?: unknown): unknown {
  if (value === null || value === undefined || this.units.length === 0) {
    return value ?? null;
  }

  const logOnly =
    this.units.length === 1 &&
    this.units[0].power === 1 &&
    this.units[0].unit.logarithmic !== undefined
      ? this.units[0].unit.logarithmic
      : undefined;
  if (logOnly !== undefined) {
    const native = patchedDenormalize.__native as (v: unknown, p?: unknown) => unknown;
    return native.call(this, value, _prefixValue);
  }

  const scalars = patchedDenormalize.__scalars as ScalarOps;
  let res: unknown = value;
  const UnitCtor = this as UnitLike & {
    constructor: { _getNumberConverter: (t: string) => (x: unknown) => unknown };
  };
  const convert = UnitCtor.constructor._getNumberConverter(compatTypeOf(value));

  for (let i = 0; i < this.units.length; i++) {
    const unitValue = convert(this.units[i].unit.value!);
    const unitPrefixValue = convert(this.units[i].prefix.value);
    const unitPower = convert(this.units[i].power);
    res = scalars.divideScalar(
      res,
      scalars.pow(scalars.multiplyScalar(unitValue, unitPrefixValue), unitPower)
    );
  }

  if (isMathjsFraction(res)) {
    lastDenormalizedFraction = res;
  }
  return res;
}

let lastDenormalizedFraction: { s: bigint; n: bigint; d: bigint; toString(): string } | null = null;

function formatMathjsFractionRatio(frac: { s: bigint; n: bigint; d: bigint }): string {
  const sign = frac.s < 0n ? '-' : '';
  return `${sign}${frac.n}/${frac.d}`;
}

function patchedFormat(this: UnitLike & { value?: unknown }, rawOptions?: unknown): string {
  const nativeFormat = patchedFormat.__native as (opts?: unknown) => string;
  // mathjs reads a number as the precision; the native Complex formatter reads only
  // `options.precision`, so `unit.format(12)` kept every digit of a complex magnitude (#1784).
  const options = typeof rawOptions === 'number' ? { precision: rawOptions } : rawOptions;
  const useDecimal =
    typeof options === 'object' &&
    options !== null &&
    (options as { fraction?: string }).fraction === 'decimal';
  if (!isMathjsFraction(this.value) || useDecimal) {
    return nativeFormat.call(this, options);
  }
  lastDenormalizedFraction = null;
  const rendered = nativeFormat.call(this, options);
  const frac = lastDenormalizedFraction ?? this.value;
  lastDenormalizedFraction = null;
  const decimal = frac.toString();
  const ratio = formatMathjsFractionRatio(frac);
  if (rendered === decimal) {
    return ratio;
  }
  if (rendered.startsWith(`${decimal} `)) {
    return `${ratio}${rendered.slice(decimal.length)}`;
  }
  return rendered;
}

patchedDenormalize.__native = null as unknown as (v: unknown, p?: unknown) => unknown;
patchedDenormalize.__scalars = null as unknown as ScalarOps;
patchedFormat.__native = null as unknown as (opts?: unknown) => string;

type UnitMultiplyProto = {
  multiply: (other: unknown) => unknown;
  value: unknown;
  toString: () => string;
};

function installValuelessUnitMultiply(Unit: { prototype: object }, scalars: ScalarOps): void {
  const proto = Unit.prototype as UnitMultiplyProto & {
    divide: (other: unknown) => unknown;
  };
  const nativeMul = proto.multiply;
  proto.multiply = function multiplyMathjs(other: unknown) {
    const self = this as UnitMultiplyProto;
    const unitOther =
      typeof other === 'object' &&
      other !== null &&
      (other as { isUnit?: boolean }).isUnit === true;
    if (unitOther && self.value === null && (other as { value: unknown }).value === null) {
      const label = mathjsValuelessUnitProductLabel(
        self.toString(),
        (other as UnitMultiplyProto).toString()
      );
      const res = nativeMul.call(this, other) as UnitMultiplyProto & {
        format: (opts?: unknown) => string;
        toJSON?: () => { unit?: string };
      };
      const nativeLabel = res.toString();
      if (nativeLabel !== label) {
        res.format = function formatMathjsValueless(_opts?: unknown): string {
          return label;
        };
        res.toString = () => label;
        if (typeof res.toJSON === 'function') {
          const nativeJson = res.toJSON.bind(res);
          res.toJSON = () => {
            const json = nativeJson() as { unit?: string };
            json.unit = label;
            return json;
          };
        }
      }
      return res;
    }
    if (!unitOther && self.value !== null && shouldRecomputeUnitMagnitude(self.value, other)) {
      const res = (self as unknown as { clone(): UnitMultiplyProto }).clone() as {
        value: unknown;
        _exactSI?: unknown;
      };
      res.value = scalars.multiplyScalar(self.value, other);
      res._exactSI = undefined;
      return res;
    }
    const res = nativeMul.call(this, other) as { value: unknown; _exactSI?: unknown };
    if (res._exactSI === undefined && self.value !== null && unitOther) {
      const rightMag = (other as { value: unknown | null }).value;
      if (
        rightMag !== null &&
        rightMag !== undefined &&
        shouldRecomputeUnitMagnitude(self.value, rightMag)
      ) {
        res.value = scalars.multiplyScalar(self.value, rightMag);
      }
    }
    return res;
  };

  const nativeDiv = proto.divide;
  proto.divide = function divideMathjs(other: unknown) {
    const self = this as unknown as {
      value: unknown | null;
      clone: () => { value: unknown | null };
    };
    const unitOther =
      typeof other === 'object' &&
      other !== null &&
      (other as { isUnit?: boolean }).isUnit === true;
    const selfVal = self.value;
    const otherMag = unitOther ? (other as { value: unknown | null }).value : other;

    if (
      selfVal !== null &&
      otherMag !== null &&
      otherMag !== undefined &&
      shouldRecomputeUnitMagnitude(selfVal, otherMag)
    ) {
      const selfClone = (self as unknown as { clone(): { value: unknown | null } }).clone();
      const otherClone = unitOther
        ? (other as unknown as { clone(): { value: unknown | null } }).clone()
        : new (Unit as new (x: unknown) => { value: unknown | null })(other);
      selfClone.value = magnitudeForNativeKernel(selfVal);
      otherClone.value = magnitudeForNativeKernel(otherMag);
      const res = nativeDiv.call(selfClone, otherClone) as
        { value: unknown; _exactSI?: unknown; isUnit?: boolean } | number | bigint;
      if (
        typeof res !== 'object' ||
        res === null ||
        (res as { isUnit?: boolean }).isUnit !== true
      ) {
        const direct = mathjsCompatibleDivideScalar(selfVal, otherMag);
        if (direct !== null) return direct;
        if (typeof otherMag === 'number' || typeof otherMag === 'bigint') {
          const left = isMathjsFraction(selfVal)
            ? selfVal
            : isCoreFraction(selfVal)
              ? new mathjsFractionClass(
                  (selfVal as Fraction).numerator,
                  (selfVal as Fraction).denominator
                )
              : new mathjsFractionClass(String(selfVal));
          return left.div(typeof otherMag === 'bigint' ? otherMag.toString() : otherMag);
        }
        return scalars.divideScalar(selfVal, otherMag);
      }
      const resUnit = res as { value: unknown; _exactSI?: unknown };
      if (resUnit._exactSI === undefined) {
        const direct = mathjsCompatibleDivideScalar(selfVal, otherMag);
        if (direct !== null) {
          resUnit.value = direct;
        } else if (typeof otherMag === 'number' || typeof otherMag === 'bigint') {
          const left = isMathjsFraction(selfVal)
            ? selfVal
            : isCoreFraction(selfVal)
              ? new mathjsFractionClass(
                  (selfVal as Fraction).numerator,
                  (selfVal as Fraction).denominator
                )
              : new mathjsFractionClass(String(selfVal));
          resUnit.value = left.div(typeof otherMag === 'bigint' ? otherMag.toString() : otherMag);
        } else {
          resUnit.value = scalars.divideScalar(selfVal, otherMag);
        }
      }
      return resUnit;
    }

    const res = nativeDiv.call(this, other);
    const selfValOnly = selfVal;
    const resRecord = res as { value: unknown; _exactSI?: unknown };
    if (resRecord._exactSI === undefined && selfValOnly !== null && selfValOnly !== undefined) {
      const mag =
        typeof other === 'object' && other !== null && (other as { isUnit?: boolean }).isUnit
          ? (other as { value: unknown | null }).value
          : other;
      if (mag !== null && mag !== undefined && (isComplex(selfValOnly) || isComplex(mag))) {
        resRecord.value = scalars.divideScalar(selfValOnly, mag);
      }
    }
    return res;
  };
}

/** Patch one compat instance's Unit class to denormalize and format with instance scalar shims. */
export function patchCompatUnitDenormalize(Unit: { prototype: object }, scalars: ScalarOps): void {
  installValuelessUnitMultiply(Unit, scalars);
  const proto = Unit.prototype as {
    _denormalize: (v: unknown, p?: unknown) => unknown;
    format: (opts?: unknown) => string;
  };
  const native = proto._denormalize;
  patchedDenormalize.__native = native.bind(Unit.prototype);
  patchedDenormalize.__scalars = scalars;
  proto._denormalize = patchedDenormalize;

  if (proto.format !== patchedFormat) {
    patchedFormat.__native = proto.format;
    proto.format = patchedFormat;
  }
}
