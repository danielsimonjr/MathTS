/**
 * Structural contract for the BigNumber values manipulated here. Captures the
 * exact instance members and constructor statics used; the BigNumber of
 * `@danielsimonjr/mathts-core` provides them. The value is a bigint-backed decimal
 * with no digit array and no sign field, so the helpers read it through `toBigInt`.
 */
interface BigNumberValue {
  constructor: BigNumberCtor;
  isFinite(): boolean;
  isInteger(): boolean;
  isNaN(): boolean;
  isZero(): boolean;
  isNegative(): boolean;
  eq(other: BigNumberValue | number): boolean;
  lt(other: number): boolean;
  plus(other: BigNumberValue): BigNumberValue;
  times(other: BigNumberValue | string): BigNumberValue;
  div(other: BigNumberValue | string): BigNumberValue;
  mod(other: BigNumberValue): BigNumberValue;
  pow(other: BigNumberValue): BigNumberValue;
  floor(): BigNumberValue;
  neg(): BigNumberValue;
  toNumber(): number;
  toBigInt(): bigint;
}

interface BigNumberCtor {
  new (value: number | string): BigNumberValue;
  precision: number;
  fromBigInt(value: bigint): BigNumberValue;
}

/** A bitwise operator on two's-complement integers of any size. */
type BitOp = (a: bigint, b: bigint) => bigint;

/**
 * Bitwise and for Bignumbers
 *
 * Special Cases:
 *   N &  n =  N
 *   n &  0 =  0
 *   n & -1 =  n
 *   n &  n =  n
 *   I &  I =  I
 *  -I & -I = -I
 *   I & -I =  0
 *   I &  n =  n
 *   I & -n =  I
 *  -I &  n =  0
 *  -I & -n = -I
 *
 * @param {BigNumber} x
 * @param {BigNumber} y
 * @return {BigNumber} Result of `x` & `y`, is fully precise
 * @private
 */
export function bitAndBigNumber(x: BigNumberValue, y: BigNumberValue): BigNumberValue {
  if ((x.isFinite() && !x.isInteger()) || (y.isFinite() && !y.isInteger())) {
    throw new Error('Integers expected in function bitAnd');
  }

  const BigNumber = x.constructor;
  if (x.isNaN() || y.isNaN()) {
    return new BigNumber(NaN);
  }

  if (x.isZero() || y.eq(-1) || x.eq(y)) {
    return x;
  }
  if (y.isZero() || x.eq(-1)) {
    return y;
  }

  if (!x.isFinite() || !y.isFinite()) {
    if (!x.isFinite() && !y.isFinite()) {
      if (x.isNegative() === y.isNegative()) {
        return x;
      }
      return new BigNumber(0);
    }
    if (!x.isFinite()) {
      if (y.isNegative()) {
        return x;
      }
      if (x.isNegative()) {
        return new BigNumber(0);
      }
      return y;
    }
    if (!y.isFinite()) {
      if (x.isNegative()) {
        return y;
      }
      if (y.isNegative()) {
        return new BigNumber(0);
      }
      return x;
    }
  }
  return bitwise(x, y, (a, b) => a & b);
}

/**
 * Bitwise not
 * @param {BigNumber} x
 * @return {BigNumber} Result of ~`x`, fully precise
 *
 */
export function bitNotBigNumber(x: BigNumberValue): BigNumberValue {
  if (x.isFinite() && !x.isInteger()) {
    throw new Error('Integer expected in function bitNot');
  }

  // ~x = -x - 1. An infinite operand gives the infinity of the other sign, and NaN stays NaN.
  if (!x.isFinite()) return x.neg();
  return x.constructor.fromBigInt(-x.toBigInt() - 1n);
}

/**
 * Bitwise OR for BigNumbers
 *
 * Special Cases:
 *   N |  n =  N
 *   n |  0 =  n
 *   n | -1 = -1
 *   n |  n =  n
 *   I |  I =  I
 *  -I | -I = -I
 *   I | -n = -1
 *   I | -I = -1
 *   I |  n =  I
 *  -I |  n = -I
 *  -I | -n = -n
 *
 * @param {BigNumber} x
 * @param {BigNumber} y
 * @return {BigNumber} Result of `x` | `y`, fully precise
 */
export function bitOrBigNumber(x: BigNumberValue, y: BigNumberValue): BigNumberValue {
  if ((x.isFinite() && !x.isInteger()) || (y.isFinite() && !y.isInteger())) {
    throw new Error('Integers expected in function bitOr');
  }

  const BigNumber = x.constructor;
  if (x.isNaN() || y.isNaN()) {
    return new BigNumber(NaN);
  }

  const negOne = new BigNumber(-1);
  if (x.isZero() || y.eq(negOne) || x.eq(y)) {
    return y;
  }
  if (y.isZero() || x.eq(negOne)) {
    return x;
  }

  if (!x.isFinite() || !y.isFinite()) {
    if (
      (!x.isFinite() && !x.isNegative() && y.isNegative()) ||
      (x.isNegative() && !y.isNegative() && !y.isFinite())
    ) {
      return negOne;
    }
    if (x.isNegative() && y.isNegative()) {
      return x.isFinite() ? x : y;
    }
    return x.isFinite() ? y : x;
  }

  return bitwise(x, y, (a, b) => a | b);
}

/**
 * Applies a bitwise operator to two finite integer BigNumbers. The bigint operators use the
 * two's-complement form of a negative value, as the mathjs helper does, and the result is exact.
 * @param {BigNumber} x
 * @param {BigNumber} y
 * @param {function (a, b)} op
 * @return {BigNumber}
 */
export function bitwise(x: BigNumberValue, y: BigNumberValue, op: BitOp): BigNumberValue {
  return x.constructor.fromBigInt(op(x.toBigInt(), y.toBigInt()));
}

/**
 * Bitwise XOR for BigNumbers
 *
 * Special Cases:
 *   N ^  n =  N
 *   n ^  0 =  n
 *   n ^  n =  0
 *   n ^ -1 = ~n
 *   I ^  n =  I
 *   I ^ -n = -I
 *   I ^ -I = -1
 *  -I ^  n = -I
 *  -I ^ -n =  I
 *
 * @param {BigNumber} x
 * @param {BigNumber} y
 * @return {BigNumber} Result of `x` ^ `y`, fully precise
 *
 */
export function bitXor(x: BigNumberValue, y: BigNumberValue): BigNumberValue {
  if ((x.isFinite() && !x.isInteger()) || (y.isFinite() && !y.isInteger())) {
    throw new Error('Integers expected in function bitXor');
  }

  const BigNumber = x.constructor;
  if (x.isNaN() || y.isNaN()) {
    return new BigNumber(NaN);
  }
  if (x.isZero()) {
    return y;
  }
  if (y.isZero()) {
    return x;
  }

  if (x.eq(y)) {
    return new BigNumber(0);
  }

  const negOne = new BigNumber(-1);
  if (x.eq(negOne)) {
    return bitNotBigNumber(y);
  }
  if (y.eq(negOne)) {
    return bitNotBigNumber(x);
  }

  if (!x.isFinite() || !y.isFinite()) {
    if (!x.isFinite() && !y.isFinite()) {
      return negOne;
    }
    return new BigNumber(x.isNegative() === y.isNegative() ? Infinity : -Infinity);
  }
  return bitwise(x, y, (a, b) => a ^ b);
}

/**
 * Bitwise left shift
 *
 * Special Cases:
 *  n << -n = N
 *  n <<  N = N
 *  N <<  n = N
 *  n <<  0 = n
 *  0 <<  n = 0
 *  I <<  I = N
 *  I <<  n = I
 *  n <<  I = I
 *
 * @param {BigNumber} x
 * @param {BigNumber} y
 * @return {BigNumber} Result of `x` << `y`
 *
 */
export function leftShiftBigNumber(x: BigNumberValue, y: BigNumberValue): BigNumberValue {
  if ((x.isFinite() && !x.isInteger()) || (y.isFinite() && !y.isInteger())) {
    throw new Error('Integers expected in function leftShift');
  }

  const BigNumber = x.constructor;
  if (x.isNaN() || y.isNaN() || (y.isNegative() && !y.isZero())) {
    return new BigNumber(NaN);
  }
  if (x.isZero() || y.isZero()) {
    return x;
  }
  if (!x.isFinite() && !y.isFinite()) {
    return new BigNumber(NaN);
  }

  // Math.pow(2, y) is fully precise for y < 55, and fast
  if (y.lt(55)) {
    return x.times(Math.pow(2, y.toNumber()) + '');
  }
  return x.times(new BigNumber(2).pow(y));
}

/**
 * Arithmetic right shift `x >> y` of two BigNumber integers.
 *
 * Special Cases:
 *   n >> -n =  N
 *   n >>  N =  N
 *   N >>  n =  N
 *   I >>  I =  N
 *   n >>  0 =  n
 *   I >>  n =  I
 *  -I >>  n = -I
 *  -I >>  I = -I
 *   n >>  I =  I
 *  -n >>  I = -1
 *   0 >>  n =  0
 *
 * @param {BigNumber} x
 * @param {BigNumber} y
 * @return {BigNumber} Result of `x` >> `y`
 *
 */
export function rightArithShiftBigNumber(x: BigNumberValue, y: BigNumberValue): BigNumberValue {
  if ((x.isFinite() && !x.isInteger()) || (y.isFinite() && !y.isInteger())) {
    throw new Error('Integers expected in function rightArithShift');
  }

  const BigNumber = x.constructor;
  if (x.isNaN() || y.isNaN() || (y.isNegative() && !y.isZero())) {
    return new BigNumber(NaN);
  }
  if (x.isZero() || y.isZero()) {
    return x;
  }
  if (!y.isFinite()) {
    if (x.isNegative()) {
      return new BigNumber(-1);
    }
    if (!x.isFinite()) {
      return new BigNumber(NaN);
    }
    return new BigNumber(0);
  }

  // Math.pow(2, y) is fully precise for y < 55, and fast
  if (y.lt(55)) {
    return x.div(Math.pow(2, y.toNumber()) + '').floor();
  }
  return x.div(new BigNumber(2).pow(y)).floor();
}

/**
 * Bitwise right logical shift
 *
 * Special Cases:
 *   n >>> -n =  N
 *   n >>>  N =  N
 *   N >>>  n =  N
 *   I >>>  I =  N
 *   n >>>  0 =  n
 *   I >>>  n =  I
 *  -I >>>  n =  N
 *  -I >>>  I =  N
 *   n >>>  I =  0
 *  -n >>>  I =  0
 *   0 >>>  n =  0
 *
 * @param {BigNumber} x
 * @param {BigNumber} y
 * @return {BigNumber} Result of `x` >>> `y`
 *
 */
export function rightLogShiftBigNumber(x: BigNumberValue, y: BigNumberValue): BigNumberValue {
  if ((x.isFinite() && !x.isInteger()) || (y.isFinite() && !y.isInteger())) {
    throw new Error('Integers expected in function rightLogShift');
  }

  const BigNumber = x.constructor;
  if (x.isNaN() || y.isNaN() || (y.isNegative() && !y.isZero())) {
    return new BigNumber(NaN);
  }
  if (x.isZero() || y.isZero()) {
    return x;
  }
  if (!y.isFinite()) {
    if (x.isNegative() || !x.isFinite()) {
      return new BigNumber(NaN);
    }
    return new BigNumber(0);
  }

  // Convert negative numbers to their 32-bit two's complement unsigned representation
  let val = x;
  if (val.isNegative()) {
    const MASK = new BigNumber(4294967296);
    val = val.mod(MASK);
    if (val.isNegative()) {
      val = val.plus(MASK);
    }
  }

  // Math.pow(2, y) is fully precise for y < 55, and fast
  if (y.lt(55)) {
    return val.div(Math.pow(2, y.toNumber()) + '').floor();
  }
  return val.div(new BigNumber(2).pow(y)).floor();
}
