import { isBigNumber } from '@danielsimonjr/mathts-core';
import { compatDecimalResult, getCompatDecimalBigNumberCtor } from './bignumber.js';

function asCompatBigNumber(x: unknown): unknown {
  if (isBigNumber(x)) return x;
  if (
    typeof x === 'object' &&
    x !== null &&
    (x as { isBigNumber?: boolean }).isBigNumber === true
  ) {
    return x;
  }
  return null;
}

type DecimalLike = {
  eq(n: unknown): boolean;
  toFixed(): string;
  isInteger(): boolean;
  isPositive(): boolean;
  toDecimalPlaces(n: number): DecimalLike;
  pow(n: DecimalLike | number): DecimalLike;
};

function exactLog2ForSmallIntegerPower(operand: unknown): unknown | null {
  const bn = asCompatBigNumber(operand) as DecimalLike | null;
  if (!bn || !bn.isInteger() || !bn.isPositive()) return null;
  const text = bn.toFixed();
  if (!/^\d+$/.test(text)) return null;
  let big = BigInt(text);
  if (big <= 1n) return null;
  if ((big & (big - 1n)) !== 0n) return null;
  let exp = 0n;
  while (big > 1n) {
    big >>= 1n;
    exp += 1n;
  }
  return new (getCompatDecimalBigNumberCtor())(exp.toString());
}

function roundLog2WhenExactPower(operand: unknown, out: unknown): unknown {
  const operandBn = asCompatBigNumber(operand) as DecimalLike | null;
  const outBn = asCompatBigNumber(out) as DecimalLike | null;
  if (!operandBn || !outBn) return out;
  const Ctor = getCompatDecimalBigNumberCtor();
  const rounded = outBn.toDecimalPlaces(0);
  const two = new Ctor(2) as DecimalLike;
  try {
    if (two.pow(rounded).eq(operandBn)) {
      return new Ctor(rounded.toFixed());
    }
  } catch {
    // pow overflow at extreme exponents — keep computed value
  }
  return out;
}

/** mathjs returns exact integer logs for exact powers of two (#1780). */
export function withCompatLog2BigNumberExact(fn: (x: unknown) => unknown): (x: unknown) => unknown {
  return (x: unknown): unknown => {
    const exactSmall = exactLog2ForSmallIntegerPower(x);
    if (exactSmall !== null) {
      return compatDecimalResult(exactSmall);
    }
    const out = fn(x);
    if ((asCompatBigNumber(x) as DecimalLike | null)?.eq?.(1)) {
      return compatDecimalResult(new (getCompatDecimalBigNumberCtor())(0));
    }
    return compatDecimalResult(roundLog2WhenExactPower(x, out));
  };
}
