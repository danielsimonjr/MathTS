/**
 * BigNumber unary trig via decimal.js (#1780), matching mathjs 15.3.0 / decimal.js paths
 * without relying on core's transcendental BigNumber kernels.
 */

import { Decimal } from 'decimal.js';
import { isBigNumber } from '@danielsimonjr/mathts-core';
import { runWithConfig } from '@danielsimonjr/mathts-functions';
import { BigNumber as CompatBigNumber, type CompatDecimalBigNumberCtor } from './bignumber.js';

type ConfigSlice = Parameters<typeof runWithConfig>[0];
type UnaryFn = (...args: unknown[]) => unknown;

function isCompatBigNumberArgument(x: unknown): boolean {
  if (isBigNumber(x)) return true;
  return (
    typeof x === 'object' && x !== null && (x as { isBigNumber?: boolean }).isBigNumber === true
  );
}

function finiteOperandString(operand: { toString(): string }): string {
  const s = operand.toString();
  if (s === 'Infinity' || s === '-Infinity' || s === 'NaN') return s;
  return s;
}

function operandPrecisionAnalysis(
  operand: { toString(): string },
  configPrecision: number
): { workPrec: number; sd: number } {
  const finite = finiteOperandString(operand);
  if (finite === 'Infinity' || finite === '-Infinity' || finite === 'NaN') {
    return { workPrec: configPrecision, sd: configPrecision };
  }
  const prev = {
    precision: Decimal.precision,
    rounding: Decimal.rounding,
    toExpNeg: Decimal.toExpNeg,
    toExpPos: Decimal.toExpPos,
    minE: Decimal.minE,
    maxE: Decimal.maxE,
  };
  const parseCap = Math.max(configPrecision, 256);
  try {
    Decimal.set({ ...prev, precision: parseCap });
    const d = new Decimal(operand.toString());
    const sdRaw = d.sd();
    const sd = sdRaw === null || sdRaw === undefined ? configPrecision : sdRaw;
    let workPrec = Math.max(configPrecision, sd);
    // Near |sin(x)|≈1, decimal.js asin needs one extra digit beyond the operand (#1780).
    if (sd > configPrecision && d.abs().gte(0.9)) workPrec = Math.max(workPrec, sd + 1);
    if (sd > configPrecision && d.abs().gt(1)) workPrec = Math.max(workPrec, sd + 8);
    // acosh(asinh) inverses near cosh(x)≈1 need extra guard digits (#1780).
    if (sd > configPrecision && d.gt(1) && d.lte(1.05)) workPrec = Math.max(workPrec, sd + 6);
    return { workPrec, sd };
  } finally {
    Decimal.set(prev);
  }
}

function resultOutputPrecision(
  configPrecision: number,
  sd: number,
  instanceCtor: CompatDecimalBigNumberCtor,
  operandCtor: CompatDecimalBigNumberCtor
): number {
  if (
    operandCtor !== CompatBigNumber &&
    !Object.is(operandCtor, instanceCtor) &&
    sd > configPrecision + 1
  ) {
    return Math.max(configPrecision, sd);
  }
  return configPrecision;
}

function resultBigNumberCtor(
  operand: unknown,
  instanceCtor: CompatDecimalBigNumberCtor
): CompatDecimalBigNumberCtor {
  if (!(operand instanceof CompatBigNumber)) return instanceCtor;
  const bn = operand as CompatBigNumber;
  if (bn instanceof instanceCtor) return instanceCtor;
  const operandCtor = (Object.getPrototypeOf(bn) as { constructor: CompatDecimalBigNumberCtor })
    .constructor;
  return operandCtor !== CompatBigNumber ? operandCtor : instanceCtor;
}

function decimalRoundingMode(name: string | undefined): Decimal.Rounding {
  switch (name) {
    case 'up':
      return Decimal.ROUND_UP;
    case 'down':
      return Decimal.ROUND_DOWN;
    case 'ceil':
      return Decimal.ROUND_CEIL;
    case 'floor':
      return Decimal.ROUND_FLOOR;
    case 'halfUp':
      return Decimal.ROUND_HALF_UP;
    case 'halfDown':
      return Decimal.ROUND_HALF_DOWN;
    case 'halfEven':
      return Decimal.ROUND_HALF_EVEN;
    case 'halfCeil':
      return Decimal.ROUND_HALF_CEIL;
    case 'halfFloor':
      return Decimal.ROUND_HALF_FLOOR;
    default:
      return Decimal.ROUND_HALF_UP;
  }
}

function copyFunctionSurface(from: UnaryFn, to: UnaryFn): void {
  Object.defineProperty(to, 'name', { value: from.name, configurable: true });
  Object.defineProperty(to, 'length', { value: from.length, configurable: true });
  try {
    Object.setPrototypeOf(to, Object.getPrototypeOf(from));
  } catch {
    // exotic functions may refuse a prototype swap
  }
  const proto = Object.getOwnPropertyDescriptor(from, 'prototype');
  if (proto) {
    try {
      Object.defineProperty(to, 'prototype', proto);
    } catch {
      try {
        (to as { prototype: unknown }).prototype = (from as { prototype: unknown }).prototype;
      } catch {
        // class `.prototype` can be non-writable
      }
    }
  }
  for (const key of Reflect.ownKeys(from)) {
    if (key === 'length' || key === 'name' || key === 'prototype') continue;
    if (Object.prototype.hasOwnProperty.call(to, key)) continue;
    const desc = Object.getOwnPropertyDescriptor(from, key);
    if (!desc) continue;
    try {
      Object.defineProperty(to, key, desc);
    } catch {
      // skip non-configurable exotic keys
    }
  }
}

/** Apply one decimal.js unary op when the sole argument is a BigNumber (#1780). */
export function createCompatBigNumberTrigWrap(
  getConfig: () => ConfigSlice,
  getBigNumberCtor: () => CompatDecimalBigNumberCtor
) {
  const applyDecimalUnary = (
    operand: { toString(): string },
    compute: (
      d: InstanceType<typeof Decimal>,
      DecimalCtor: typeof Decimal
    ) => InstanceType<typeof Decimal>,
    decimalOptions: { extendedPrecision: boolean }
  ): unknown => {
    const configSlice = getConfig();
    const configPrecision = configSlice.precision ?? 64;
    const rounding =
      'rounding' in configSlice ? (configSlice as { rounding?: string }).rounding : undefined;
    const instanceCtor = getBigNumberCtor();
    const crossInstanceOperand =
      operand instanceof CompatBigNumber &&
      operand.constructor !== CompatBigNumber &&
      !(operand instanceof instanceCtor);
    const useExtendedWork = decimalOptions.extendedPrecision || crossInstanceOperand;
    const analysis = operandPrecisionAnalysis(operand, configPrecision);
    let workPrec = analysis.workPrec;
    if (useExtendedWork && decimalOptions.extendedPrecision && crossInstanceOperand) {
      workPrec = Math.max(workPrec, configPrecision + 12);
    }
    const precision = useExtendedWork ? workPrec : configPrecision;
    const resultCtor = resultBigNumberCtor(operand, instanceCtor);
    const outputPrec = useExtendedWork
      ? resultOutputPrecision(configPrecision, analysis.sd, instanceCtor, resultCtor)
      : configPrecision;
    const prev = {
      precision: Decimal.precision,
      rounding: Decimal.rounding,
      toExpNeg: Decimal.toExpNeg,
      toExpPos: Decimal.toExpPos,
      minE: Decimal.minE,
      maxE: Decimal.maxE,
    };
    try {
      Decimal.set({
        ...prev,
        precision,
        rounding: decimalRoundingMode(rounding),
      });
      const d = new Decimal(operand.toString());
      const out = compute(d, Decimal);
      const config = getConfig();
      const outputRounding = decimalRoundingMode(rounding);
      Decimal.set({
        ...prev,
        precision: Math.max(precision, outputPrec),
        rounding: outputRounding,
      });
      const rounded = out.toDecimalPlaces(outputPrec, outputRounding);
      return runWithConfig(
        { ...config, precision: outputPrec },
        () => new resultCtor(rounded.toString())
      );
    } finally {
      Decimal.set(prev);
    }
  };

  return function wrapCompatBigNumberUnaryTrig(
    base: UnaryFn,
    compute: (
      d: InstanceType<typeof Decimal>,
      DecimalCtor: typeof Decimal
    ) => InstanceType<typeof Decimal>,
    decimalOptions: { extendedPrecision?: boolean } = {}
  ): UnaryFn {
    const opts = { extendedPrecision: decimalOptions.extendedPrecision === true };
    const wrapped: UnaryFn = (...args: unknown[]) => {
      const x = args[0];
      if (isCompatBigNumberArgument(x)) {
        const decimalOut = applyDecimalUnary(x as { toString(): string }, compute, opts);
        return decimalOut;
      }
      return base(...args);
    };
    copyFunctionSurface(base, wrapped);
    return wrapped;
  };
}

export const compatDecimalTrigAsin = (d: InstanceType<typeof Decimal>) => d.asin();
export const compatDecimalTrigAsinh = (d: InstanceType<typeof Decimal>) => d.asinh();
export const compatDecimalTrigAcosh = (d: InstanceType<typeof Decimal>) => d.acosh();
export const compatDecimalTrigAcot = (d: InstanceType<typeof Decimal>, D: typeof Decimal) =>
  new D(1).div(d).atan();
export const compatDecimalTrigAcoth = (d: InstanceType<typeof Decimal>, D: typeof Decimal) =>
  new D(1).div(d).atanh();
export const compatDecimalTrigAcsc = (d: InstanceType<typeof Decimal>, D: typeof Decimal) =>
  new D(1).div(d).asin();
export const compatDecimalTrigCsc = (d: InstanceType<typeof Decimal>, D: typeof Decimal) =>
  new D(1).div(d.sin());
export const compatDecimalTrigSec = (d: InstanceType<typeof Decimal>, D: typeof Decimal) =>
  new D(1).div(d.cos());
export const compatDecimalTrigSech = (d: InstanceType<typeof Decimal>, D: typeof Decimal) =>
  new D(1).div(d.cosh());
export const compatDecimalTrigSin = (d: InstanceType<typeof Decimal>) => d.sin();
export const compatDecimalTrigCos = (d: InstanceType<typeof Decimal>) => d.cos();
export const compatDecimalTrigCosh = (d: InstanceType<typeof Decimal>) => d.cosh();
export const compatDecimalTrigSinh = (d: InstanceType<typeof Decimal>) => d.sinh();
export const compatDecimalTrigCot = (d: InstanceType<typeof Decimal>, D: typeof Decimal) =>
  new D(1).div(d.tan());
export const compatDecimalTrigCoth = (d: InstanceType<typeof Decimal>) => d.cosh().div(d.sinh());
