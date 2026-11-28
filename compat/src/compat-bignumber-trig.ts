/**
 * BigNumber unary trig for mathjs 15.3.0 (#1780, #1789): results use the compat
 * instance BigNumber class; pole-adjacent `sin`/`cos`/`tan`/`cot`/`atan` use
 * decimal.js (as mathjs does) while inverse chains keep NativeBigNumber division.
 */

import { Decimal } from 'decimal.js';
import { BigNumber as NativeBigNumber, isBigNumber } from '@danielsimonjr/mathts-core';
import { runWithConfig } from '@danielsimonjr/mathts-functions';
import { BigNumber as CompatBigNumber, type CompatDecimalBigNumberCtor } from './bignumber.js';
import { INSTANCE_PRECISION_GETTER } from './compat-bignumber-instance.js';

type ConfigSlice = Parameters<typeof runWithConfig>[0];
type UnaryFn = (...args: unknown[]) => unknown;
type BigNumberCtor = typeof NativeBigNumber;
type GetPi = () => { toString(): string; div(n: number | NativeBigNumber): { toString(): string } };

type DecimalValue = Decimal;

type TrigContext = {
  x: NativeBigNumber;
  D: BigNumberCtor;
  operandPrec: number;
  instancePrec: number;
  workExtraDigits: number;
  getPi: GetPi;
  atOperandPrec: (fn: (d: NativeBigNumber) => NativeBigNumber) => NativeBigNumber;
  atOperandDecimal: (fn: (d: DecimalValue) => DecimalValue) => NativeBigNumber;
  atOperandDecimalMathjs: (fn: (d: DecimalValue) => DecimalValue) => NativeBigNumber;
  atInstancePrec: (fn: (D: BigNumberCtor) => NativeBigNumber) => NativeBigNumber;
};

type TrigCompute = {
  run: (ctx: TrigContext) => NativeBigNumber;
  resultOwner: 'operand' | 'instance';
};

function isCompatBigNumberArgument(x: unknown): boolean {
  if (isBigNumber(x)) return true;
  return (
    typeof x === 'object' && x !== null && (x as { isBigNumber?: boolean }).isBigNumber === true
  );
}

function precisionOfOperand(operand: unknown, fallback: number): number {
  if (operand instanceof CompatBigNumber) {
    const ctor = (Object.getPrototypeOf(operand) as { constructor: Record<symbol, unknown> })
      .constructor;
    const getter = ctor?.[INSTANCE_PRECISION_GETTER];
    if (typeof getter === 'function') {
      return (getter as () => number)();
    }
  }
  return fallback;
}

function ctorOfOperand(
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

function copyFunctionSurface(from: UnaryFn, to: UnaryFn): void {
  Object.defineProperty(to, 'name', { value: from.name, configurable: true });
  Object.defineProperty(to, 'length', { value: from.length, configurable: true });
  for (const key of Reflect.ownKeys(from)) {
    if (key === 'length' || key === 'name' || key === 'prototype') continue;
    if (Object.prototype.hasOwnProperty.call(to, key)) continue;
    const desc = Object.getOwnPropertyDescriptor(from, key);
    if (desc) Object.defineProperty(to, key, desc);
  }
}

/** Apply one NativeBigNumber unary trig op when the sole argument is a BigNumber (#1780). */
function resolveMathjsDecimalOperand(
  operand: NativeBigNumber,
  getPi: GetPi,
  workPrec: number,
  operandPrec: number
): DecimalValue {
  const D = Decimal.clone({ precision: workPrec, modulo: Decimal.EUCLID });
  const text = operand.toString();
  const pi = getPi();
  const piBn = new NativeBigNumber(pi.toString());
  if (text === pi.toString()) {
    return D.acos(new D(-1));
  }
  const doubled = new NativeBigNumber(text).multiply(2);
  const halfDelta = doubled.subtract(piBn).abs();
  const epsilon = new NativeBigNumber(1).div(new NativeBigNumber(10).pow(operandPrec - 1));
  if (halfDelta.compareTo(epsilon) <= 0) {
    return D.acos(new D(-1)).div(2);
  }
  return new D(text);
}

function decimalToMathjsString(value: DecimalValue, prec: number): string {
  const normalized = value.toSignificantDigits(prec);
  return normalized.e <= -7 || normalized.e >= 21
    ? normalized.toExponential()
    : normalized.toFixed();
}

/**
 * Wrap unary trig factories so BigNumber arguments follow mathjs 15.3.0 decimal.js rounding (#1789).
 *
 * @param getConfig - Active compat instance configuration slice.
 * @param getBigNumberCtor - The instance-scoped `BigNumber` class constructor.
 * @param getPi - Lazy `pi` constant for half-π decimal reconstruction.
 * @returns A helper that wraps a factory plus a {@link TrigCompute} descriptor.
 */
export function createCompatBigNumberTrigWrap(
  getConfig: () => ConfigSlice,
  getBigNumberCtor: () => CompatDecimalBigNumberCtor,
  getPi: GetPi
) {
  const decimalAtPrecision = (
    operand: { toString(): string },
    prec: number,
    workExtra: number,
    fn: (d: DecimalValue) => DecimalValue,
    clonePrec?: number
  ): NativeBigNumber => {
    const workPrec = clonePrec ?? prec + workExtra;
    const D = Decimal.clone({ precision: workPrec, modulo: Decimal.EUCLID });
    const x = resolveMathjsDecimalOperand(
      new NativeBigNumber(operand.toString()),
      getPi,
      workPrec,
      prec
    );
    const y = fn(x);
    D.config({ precision: prec });
    return new NativeBigNumber(decimalToMathjsString(y, prec));
  };

  const decimalAtOperandPrecOnly = (
    operand: { toString(): string },
    prec: number,
    fn: (d: DecimalValue) => DecimalValue
  ): NativeBigNumber => decimalAtPrecision(operand, prec, 0, fn, prec);

  const applyBigNumberUnary = (
    operand: { toString(): string },
    compute: TrigCompute,
    workExtraDigits: number
  ): unknown => {
    const configSlice = getConfig();
    const instancePrec = configSlice.precision ?? 64;
    const operandPrec = precisionOfOperand(operand, instancePrec);
    const instanceCtor = getBigNumberCtor();
    const resultCtor =
      compute.resultOwner === 'operand' ? ctorOfOperand(operand, instanceCtor) : instanceCtor;
    const outputPrec = compute.resultOwner === 'operand' ? operandPrec : instancePrec;

    const prev = NativeBigNumber.config();
    try {
      NativeBigNumber.config({
        precision: Math.max(operandPrec, instancePrec) + workExtraDigits,
      });
      const x = new NativeBigNumber(operand.toString());
      const ctx: TrigContext = {
        x,
        D: NativeBigNumber,
        operandPrec,
        instancePrec,
        workExtraDigits,
        getPi,
        atOperandPrec(fn) {
          NativeBigNumber.config({ precision: operandPrec + workExtraDigits });
          const res = fn(x);
          NativeBigNumber.config({ precision: operandPrec });
          return res.isFinite() ? res.toSignificantDigits(operandPrec) : res;
        },
        atInstancePrec(fn) {
          NativeBigNumber.config({ precision: instancePrec + workExtraDigits });
          const res = fn(NativeBigNumber);
          NativeBigNumber.config({ precision: instancePrec });
          return res.isFinite() ? res.toSignificantDigits(instancePrec) : res;
        },
        atOperandDecimal(fn) {
          return decimalAtPrecision(operand, operandPrec, workExtraDigits, fn);
        },
        atOperandDecimalMathjs(fn) {
          return decimalAtOperandPrecOnly(operand, operandPrec, fn);
        },
      };
      const out = compute.run(ctx);
      NativeBigNumber.config({ precision: outputPrec });
      const rounded = out.isFinite() ? out.toSignificantDigits(outputPrec) : out;
      return runWithConfig(
        { ...configSlice, precision: outputPrec },
        () => new resultCtor(rounded.toString())
      );
    } finally {
      NativeBigNumber.config(prev);
    }
  };

  return function wrapCompatBigNumberUnaryTrig(
    base: UnaryFn,
    compute: TrigCompute,
    options?: { extendedPrecision?: boolean; workExtraDigits?: number }
  ): UnaryFn {
    const extraDigits = options?.workExtraDigits ?? (options?.extendedPrecision ? 32 : 24);
    const wrapped: UnaryFn = (...args: unknown[]) => {
      const x = args[0];
      if (isCompatBigNumberArgument(x)) {
        return applyBigNumberUnary(x as { toString(): string }, compute, extraDigits);
      }
      return base(...args);
    };
    copyFunctionSurface(base, wrapped);
    return wrapped;
  };
}

export const compatDecimalTrigAsin: TrigCompute = {
  resultOwner: 'operand',
  run: (ctx) => ctx.atOperandPrec((d) => d.asin()),
};
export const compatDecimalTrigAsinh: TrigCompute = {
  resultOwner: 'operand',
  run: (ctx) => ctx.atOperandPrec((d) => d.asinh()),
};
export const compatDecimalTrigAcosh: TrigCompute = {
  resultOwner: 'operand',
  run: (ctx) => ctx.atOperandPrec((d) => d.acosh()),
};
export const compatDecimalTrigSin: TrigCompute = {
  resultOwner: 'operand',
  run: (ctx) => ctx.atOperandDecimal((d) => d.sin()),
};
export const compatDecimalTrigCos: TrigCompute = {
  resultOwner: 'operand',
  run: (ctx) => ctx.atOperandDecimal((d) => d.cos()),
};
export const compatDecimalTrigTan: TrigCompute = {
  resultOwner: 'operand',
  run: (ctx) => ctx.atOperandDecimalMathjs((d) => d.tan()),
};
export const compatDecimalTrigAtan: TrigCompute = {
  resultOwner: 'operand',
  run: (ctx) => ctx.atOperandDecimalMathjs((d) => d.atan()),
};
export const compatDecimalTrigCosh: TrigCompute = {
  resultOwner: 'operand',
  run: (ctx) => ctx.atOperandPrec((d) => d.cosh()),
};
export const compatDecimalTrigSinh: TrigCompute = {
  resultOwner: 'operand',
  run: (ctx) => ctx.atOperandPrec((d) => d.sinh()),
};
export const compatDecimalTrigCoth: TrigCompute = {
  resultOwner: 'instance',
  run: (ctx) => {
    const t = ctx.atOperandPrec((d) => d.tanh());
    return ctx.atInstancePrec((D) => new D(1).div(t));
  },
};
export const compatDecimalTrigAcot: TrigCompute = {
  resultOwner: 'operand',
  run: (ctx) =>
    ctx.atOperandDecimalMathjs((d) => {
      const Ctor = d.constructor as typeof Decimal;
      return new Ctor(1).div(d).atan();
    }),
};
export const compatDecimalTrigAcoth: TrigCompute = {
  resultOwner: 'instance',
  run: (ctx) => {
    const inv = ctx.atInstancePrec((D) => new D(1).div(ctx.x));
    return ctx.atInstancePrec(() => inv.atanh());
  },
};
export const compatDecimalTrigAcsc: TrigCompute = {
  resultOwner: 'instance',
  run: (ctx) => {
    const inv = ctx.atInstancePrec((D) => new D(1).div(ctx.x));
    return ctx.atInstancePrec(() => inv.asin());
  },
};
export const compatDecimalTrigCsc: TrigCompute = {
  resultOwner: 'instance',
  run: (ctx) => {
    const s = ctx.atOperandPrec((d) => d.sin());
    return ctx.atInstancePrec((D) => new D(1).div(s));
  },
};
export const compatDecimalTrigSec: TrigCompute = {
  resultOwner: 'instance',
  run: (ctx) => {
    const c = ctx.atOperandPrec((d) => d.cos());
    return ctx.atInstancePrec((D) => new D(1).div(c));
  },
};
export const compatDecimalTrigSech: TrigCompute = {
  resultOwner: 'instance',
  run: (ctx) => {
    const c = ctx.atOperandPrec((d) => d.cosh());
    return ctx.atInstancePrec((D) => new D(1).div(c));
  },
};
export const compatDecimalTrigCot: TrigCompute = {
  resultOwner: 'operand',
  run: (ctx) => {
    const tan = ctx.atOperandDecimalMathjs((d) => d.tan());
    return ctx.atInstancePrec((D) => new D(1).div(new NativeBigNumber(tan.toString())));
  },
};
export const compatDecimalTrigCsch: TrigCompute = {
  resultOwner: 'instance',
  run: (ctx) => {
    const s = ctx.atOperandPrec((d) => d.sinh());
    return ctx.atInstancePrec((D) => new D(1).div(s));
  },
};
export const compatDecimalTrigAcsch: TrigCompute = {
  resultOwner: 'instance',
  run: (ctx) =>
    ctx.atInstancePrec((D) => {
      const d = ctx.atOperandPrec((v) => v);
      if (d.isZero()) return new D(Infinity);
      return new D(1).div(d).asinh();
    }),
};
