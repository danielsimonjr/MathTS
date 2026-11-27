/**
 * Route Unit `_denormalize` through the compat instance's scalar helpers (#1779).
 *
 * Per-instance `Unit` classes close over the unwrapped factories `divideScalar`,
 * `multiplyScalar`, and `pow`. When the magnitude is a fraction.js instance,
 * the factory `pow` path returns core `Fraction` and `divideScalar` may throw.
 * The instance shims return fraction.js throughout.
 */
import { isBigNumber, isComplex, isFraction as isCoreFraction } from '@danielsimonjr/mathts-core';
import { isMathjsFraction } from './mathjs-fraction-class.js';

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

function patchedFormat(this: UnitLike & { value?: unknown }, options?: unknown): string {
  const nativeFormat = patchedFormat.__native as (opts?: unknown) => string;
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

/** Patch one compat instance's Unit class to denormalize and format with instance scalar shims. */
export function patchCompatUnitDenormalize(Unit: { prototype: object }, scalars: ScalarOps): void {
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
