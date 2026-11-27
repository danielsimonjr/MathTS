/**
 * BigNumber unary trig using core's NativeBigNumber (#1780), matching mathjs 15.3.0
 * per-instance BigNumber precision and constructor identity without external decimal.js.
 */

import { BigNumber as NativeBigNumber, isBigNumber } from '@danielsimonjr/mathts-core';
import { runWithConfig } from '@danielsimonjr/mathts-functions';
import { BigNumber as CompatBigNumber, type CompatDecimalBigNumberCtor } from './bignumber.js';
import { INSTANCE_PRECISION_GETTER } from './compat-bignumber-instance.js';

type ConfigSlice = Parameters<typeof runWithConfig>[0];
type UnaryFn = (...args: unknown[]) => unknown;
type BigNumberCtor = typeof NativeBigNumber;

type TrigContext = {
  x: NativeBigNumber;
  D: BigNumberCtor;
  operandPrec: number;
  instancePrec: number;
  atOperandPrec: (fn: (d: NativeBigNumber) => NativeBigNumber) => NativeBigNumber;
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
export function createCompatBigNumberTrigWrap(
  getConfig: () => ConfigSlice,
  getBigNumberCtor: () => CompatDecimalBigNumberCtor
) {
  const applyBigNumberUnary = (operand: { toString(): string }, compute: TrigCompute): unknown => {
    const configSlice = getConfig();
    const instancePrec = configSlice.precision ?? 64;
    const operandPrec = precisionOfOperand(operand, instancePrec);
    const instanceCtor = getBigNumberCtor();
    const resultCtor =
      compute.resultOwner === 'operand' ? ctorOfOperand(operand, instanceCtor) : instanceCtor;
    const outputPrec = compute.resultOwner === 'operand' ? operandPrec : instancePrec;

    const prev = NativeBigNumber.config();
    try {
      NativeBigNumber.config({ precision: Math.max(operandPrec, instancePrec) + 24 });
      const x = new NativeBigNumber(operand.toString());
      const ctx: TrigContext = {
        x,
        D: NativeBigNumber,
        operandPrec,
        instancePrec,
        atOperandPrec(fn) {
          NativeBigNumber.config({ precision: operandPrec + 24 });
          const res = fn(x);
          NativeBigNumber.config({ precision: operandPrec });
          return res.isFinite() ? res.toSignificantDigits(operandPrec) : res;
        },
        atInstancePrec(fn) {
          NativeBigNumber.config({ precision: instancePrec + 24 });
          const res = fn(NativeBigNumber);
          NativeBigNumber.config({ precision: instancePrec });
          return res.isFinite() ? res.toSignificantDigits(instancePrec) : res;
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
    _options?: { extendedPrecision?: boolean }
  ): UnaryFn {
    const wrapped: UnaryFn = (...args: unknown[]) => {
      const x = args[0];
      if (isCompatBigNumberArgument(x)) {
        return applyBigNumberUnary(x as { toString(): string }, compute);
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
  run: (ctx) => ctx.atOperandPrec((d) => d.sin()),
};
export const compatDecimalTrigCos: TrigCompute = {
  resultOwner: 'operand',
  run: (ctx) => ctx.atOperandPrec((d) => d.cos()),
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
  resultOwner: 'instance',
  run: (ctx) => {
    const inv = ctx.atInstancePrec((D) => new D(1).div(ctx.x));
    return ctx.atInstancePrec(() => inv.atan());
  },
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
  resultOwner: 'instance',
  run: (ctx) => {
    const t = ctx.atOperandPrec((d) => d.tan());
    return ctx.atInstancePrec((D) => new D(1).div(t));
  },
};
