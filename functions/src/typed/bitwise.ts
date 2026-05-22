/**
 * Typed Bitwise Functions (Parallel-First)
 *
 * Polymorphic bitwise operations using typed-function for runtime
 * dispatch. Supports `number`, `BigNumber`, `bigint`, and `Int32Array`.
 *
 * Following the parallel-first philosophy per CLAUDE.md:
 * - Use the `ComputePool` for ALL `Int32Array` transformations.
 * - Use native ops on scalar inputs (no worker dispatch overhead).
 *
 * BigNumber bitwise semantics: the mathjs-synced helpers in
 * `functions/src/utils/bignumber/bitwise.ts` operate on the
 * `decimal.js`-internal coefficient layout (`x.d` / `x.e` / `x.s`),
 * which `@danielsimonjr/mathts-core`'s `BigNumber` does not expose.
 * We therefore reimplement the BigNumber path by routing through
 * native `bigint` when the operand is a finite integer — that
 * matches what the mathjs path does on integers anyway. NaN /
 * non-integer inputs throw, mirroring mathjs behavior.
 *
 * @packageDocumentation
 */

import { mathTyped, BigNumber } from '@danielsimonjr/mathts-core';
import { computePool } from '@danielsimonjr/mathts-parallel';

// =============================================================================
// AssemblyScript-Compatible Type Aliases
// =============================================================================

/** 32-bit signed integer (storage type for the JS bitwise ops) */
type i32 = number;

/** 64-bit signed integer */
type i64 = bigint;

// =============================================================================
// BigNumber helpers
// =============================================================================

/**
 * Validate a `BigNumber` operand and convert it to a native `bigint`.
 * Throws when the value is NaN, non-finite, or non-integer — matching
 * the mathjs `'Integers expected in function <op>'` contract.
 */
function bigNumberToBigInt(value: BigNumber, fnName: string): bigint {
  if (value.isNaN()) {
    throw new Error(`NaN not allowed in function ${fnName}`);
  }
  if (!value.isFinite()) {
    throw new Error(`Infinity not allowed in function ${fnName}`);
  }
  if (!value.isInteger()) {
    throw new Error(`Integers expected in function ${fnName}`);
  }
  // BigNumber.toString() emits a base-10 integer for integer values;
  // BigInt() accepts that directly.
  return BigInt(value.toString());
}

/**
 * Convert a native `bigint` back into a `BigNumber`. Avoids the lossy
 * `BigNumber.fromNumber(Number(x))` round-trip for values outside the
 * safe-integer range.
 */
function bigIntToBigNumber(value: bigint): BigNumber {
  return BigNumber.parse(value.toString());
}

/** Apply a native `bigint` binary op through the BigNumber boundary. */
function bigNumberBinary(
  a: BigNumber,
  b: BigNumber,
  fnName: string,
  op: (x: bigint, y: bigint) => bigint
): BigNumber {
  const ai = bigNumberToBigInt(a, fnName);
  const bi = bigNumberToBigInt(b, fnName);
  return bigIntToBigNumber(op(ai, bi));
}

/** Validate a shift count: must be a non-negative finite integer. */
function bigNumberShiftCount(value: BigNumber, fnName: string): bigint {
  const bi = bigNumberToBigInt(value, fnName);
  if (bi < 0n) {
    throw new Error(`Negative shift count not allowed in function ${fnName}`);
  }
  return bi;
}

/**
 * Logical right shift over native bigint. `bigint >>` is sign-preserving
 * by spec; for `rightLogShift` we mimic the JS `>>>` behavior by masking
 * to the low 32 bits before shifting, so the result matches what
 * `(x >>> n) | 0` would yield on a 32-bit integer.
 */
function logShiftBigInt(x: bigint, n: bigint): bigint {
  const masked = x & 0xffffffffn;          // -> uint32-equivalent
  const shifted = masked >> n;             // logical because masked is non-negative
  // Re-wrap into the signed 32-bit range to match `Int32Array` storage.
  return shifted >= 0x80000000n ? shifted - 0x100000000n : shifted;
}

// =============================================================================
// Bitwise AND
// =============================================================================

/**
 * Polymorphic bitwise AND.
 *
 * @example
 * ```typescript
 * bitAnd(0b1010, 0b1100);                   // 0b1000
 * bitAnd(53n, 131n);                        // 1n
 * await bitAnd(int32A, int32B);             // Parallel Int32Array AND
 * ```
 */
export const bitAnd = mathTyped('bitAnd', {
  'number, number': (a: i32, b: i32): i32 => {
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      throw new Error('Integers expected in function bitAnd');
    }
    return a & b;
  },

  'bigint, bigint': (a: i64, b: i64): i64 => a & b,

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber =>
    bigNumberBinary(a, b, 'bitAnd', (x, y) => x & y),

  'Int32Array, Int32Array': async (
    a: Int32Array,
    b: Int32Array
  ): Promise<Int32Array> => {
    const result = await computePool.bitAnd(a, b);
    return result.result;
  },

  // Variadic: fold from the left. typed-function packs the spread as a
  // single array argument (`fn(a, b, [...rest])`), so we receive it as
  // one positional param rather than via JS rest syntax.
  'number, number, ...number': (a: i32, b: i32, rest: i32[]): i32 =>
    rest.reduce((acc: i32, val: i32): i32 => {
      if (!Number.isInteger(val)) {
        throw new Error('Integers expected in function bitAnd');
      }
      return acc & val;
    }, (a & b) as i32),
});

// =============================================================================
// Bitwise OR
// =============================================================================

export const bitOr = mathTyped('bitOr', {
  'number, number': (a: i32, b: i32): i32 => {
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      throw new Error('Integers expected in function bitOr');
    }
    return a | b;
  },

  'bigint, bigint': (a: i64, b: i64): i64 => a | b,

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber =>
    bigNumberBinary(a, b, 'bitOr', (x, y) => x | y),

  'Int32Array, Int32Array': async (
    a: Int32Array,
    b: Int32Array
  ): Promise<Int32Array> => {
    const result = await computePool.bitOr(a, b);
    return result.result;
  },

  'number, number, ...number': (a: i32, b: i32, rest: i32[]): i32 =>
    rest.reduce((acc: i32, val: i32): i32 => {
      if (!Number.isInteger(val)) {
        throw new Error('Integers expected in function bitOr');
      }
      return acc | val;
    }, (a | b) as i32),
});

// =============================================================================
// Bitwise XOR
// =============================================================================

export const bitXor = mathTyped('bitXor', {
  'number, number': (a: i32, b: i32): i32 => {
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      throw new Error('Integers expected in function bitXor');
    }
    return a ^ b;
  },

  'bigint, bigint': (a: i64, b: i64): i64 => a ^ b,

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber =>
    bigNumberBinary(a, b, 'bitXor', (x, y) => x ^ y),

  'Int32Array, Int32Array': async (
    a: Int32Array,
    b: Int32Array
  ): Promise<Int32Array> => {
    const result = await computePool.bitXor(a, b);
    return result.result;
  },

  'number, number, ...number': (a: i32, b: i32, rest: i32[]): i32 =>
    rest.reduce((acc: i32, val: i32): i32 => {
      if (!Number.isInteger(val)) {
        throw new Error('Integers expected in function bitXor');
      }
      return acc ^ val;
    }, (a ^ b) as i32),
});

// =============================================================================
// Bitwise NOT (Unary)
// =============================================================================

export const bitNot = mathTyped('bitNot', {
  'number': (a: i32): i32 => {
    if (!Number.isInteger(a)) {
      throw new Error('Integer expected in function bitNot');
    }
    return ~a;
  },

  'bigint': (a: i64): i64 => ~a,

  'BigNumber': (a: BigNumber): BigNumber => {
    const ai = bigNumberToBigInt(a, 'bitNot');
    return bigIntToBigNumber(~ai);
  },

  'Int32Array': async (a: Int32Array): Promise<Int32Array> => {
    const result = await computePool.bitNot(a);
    return result.result;
  },
});

// =============================================================================
// Left Shift
// =============================================================================

export const leftShift = mathTyped('leftShift', {
  'number, number': (a: i32, b: i32): i32 => {
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      throw new Error('Integers expected in function leftShift');
    }
    return a << b;
  },

  'bigint, bigint': (a: i64, b: i64): i64 => {
    if (b < 0n) {
      throw new Error('Negative shift count not allowed in function leftShift');
    }
    return a << b;
  },

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => {
    const ai = bigNumberToBigInt(a, 'leftShift');
    const bi = bigNumberShiftCount(b, 'leftShift');
    return bigIntToBigNumber(ai << bi);
  },

  'Int32Array, Int32Array': async (
    a: Int32Array,
    b: Int32Array
  ): Promise<Int32Array> => {
    const result = await computePool.leftShift(a, b);
    return result.result;
  },

  'number, number, ...number': (a: i32, b: i32, rest: i32[]): i32 =>
    rest.reduce((acc: i32, val: i32): i32 => {
      if (!Number.isInteger(val)) {
        throw new Error('Integers expected in function leftShift');
      }
      return acc << val;
    }, (a << b) as i32),
});

// =============================================================================
// Arithmetic Right Shift
// =============================================================================

export const rightArithShift = mathTyped('rightArithShift', {
  'number, number': (a: i32, b: i32): i32 => {
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      throw new Error('Integers expected in function rightArithShift');
    }
    return a >> b;
  },

  'bigint, bigint': (a: i64, b: i64): i64 => {
    if (b < 0n) {
      throw new Error(
        'Negative shift count not allowed in function rightArithShift'
      );
    }
    return a >> b;
  },

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => {
    const ai = bigNumberToBigInt(a, 'rightArithShift');
    const bi = bigNumberShiftCount(b, 'rightArithShift');
    return bigIntToBigNumber(ai >> bi);
  },

  'Int32Array, Int32Array': async (
    a: Int32Array,
    b: Int32Array
  ): Promise<Int32Array> => {
    const result = await computePool.rightArithShift(a, b);
    return result.result;
  },

  'number, number, ...number': (a: i32, b: i32, rest: i32[]): i32 =>
    rest.reduce((acc: i32, val: i32): i32 => {
      if (!Number.isInteger(val)) {
        throw new Error('Integers expected in function rightArithShift');
      }
      return acc >> val;
    }, (a >> b) as i32),
});

// =============================================================================
// Logical Right Shift
// =============================================================================

export const rightLogShift = mathTyped('rightLogShift', {
  'number, number': (a: i32, b: i32): i32 => {
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      throw new Error('Integers expected in function rightLogShift');
    }
    return a >>> b;
  },

  'bigint, bigint': (a: i64, b: i64): i64 => {
    if (b < 0n) {
      throw new Error(
        'Negative shift count not allowed in function rightLogShift'
      );
    }
    return logShiftBigInt(a, b);
  },

  'BigNumber, BigNumber': (a: BigNumber, b: BigNumber): BigNumber => {
    const ai = bigNumberToBigInt(a, 'rightLogShift');
    const bi = bigNumberShiftCount(b, 'rightLogShift');
    return bigIntToBigNumber(logShiftBigInt(ai, bi));
  },

  'Int32Array, Int32Array': async (
    a: Int32Array,
    b: Int32Array
  ): Promise<Int32Array> => {
    const result = await computePool.rightLogShift(a, b);
    return result.result;
  },

  'number, number, ...number': (a: i32, b: i32, rest: i32[]): i32 =>
    rest.reduce((acc: i32, val: i32): i32 => {
      if (!Number.isInteger(val)) {
        throw new Error('Integers expected in function rightLogShift');
      }
      return acc >>> val;
    }, (a >>> b) as i32),
});

// =============================================================================
// Barrel
// =============================================================================

export const typedBitwise = {
  bitAnd,
  bitOr,
  bitXor,
  bitNot,
  leftShift,
  rightArithShift,
  rightLogShift,
};
