/**
 * Unit tests for the three formatter-compatibility surfaces added to BigNumber:
 *   - `.gt(other)`              — greater-than comparison
 *   - `.toSignificantDigits(n)` — round to n significant digits
 *   - `.e`                      — decimal exponent getter (floor(log10(|x|)))
 *
 * These surfaces allow the expression formatter to duck-type against BigNumber
 * the same way it duck-types against Decimal.js.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { BigNumber } from '../src/types/bignumber.js'

beforeEach(() => {
  BigNumber.resetConfig()
})

// ---------------------------------------------------------------------------
// .gt(other)
// ---------------------------------------------------------------------------
describe('BigNumber.prototype.gt', () => {
  it('returns true when this > positive other (number)', () => {
    expect(BigNumber.fromNumber(5).gt(3)).toBe(true)
  })

  it('returns false when this < positive other (number)', () => {
    expect(BigNumber.fromNumber(3).gt(5)).toBe(false)
  })

  it('returns false when this === other (equal, so not strictly greater)', () => {
    expect(BigNumber.fromNumber(7).gt(7)).toBe(false)
  })

  it('returns false for self-comparison', () => {
    const b = BigNumber.fromNumber(42)
    expect(b.gt(b)).toBe(false)
  })

  it('works with negative values: -1 > -5', () => {
    expect(BigNumber.fromNumber(-1).gt(-5)).toBe(true)
  })

  it('works with negative values: -5 > -1 is false', () => {
    expect(BigNumber.fromNumber(-5).gt(-1)).toBe(false)
  })

  it('positive > negative', () => {
    expect(BigNumber.fromNumber(1).gt(-1)).toBe(true)
  })

  it('negative > positive is false', () => {
    expect(BigNumber.fromNumber(-1).gt(1)).toBe(false)
  })

  it('large magnitude vs small magnitude', () => {
    expect(BigNumber.fromNumber(1e15).gt(1e14)).toBe(true)
  })

  it('fractional: 0.5 > 0.3', () => {
    expect(BigNumber.fromNumber(0.5).gt(0.3)).toBe(true)
  })

  it('fractional: 0.3 > 0.5 is false', () => {
    expect(BigNumber.fromNumber(0.3).gt(0.5)).toBe(false)
  })

  it('accepts a BigNumber argument', () => {
    const a = BigNumber.fromNumber(10)
    const b = BigNumber.fromNumber(3)
    expect(a.gt(b)).toBe(true)
    expect(b.gt(a)).toBe(false)
  })

  it('accepts a string argument', () => {
    expect(BigNumber.fromNumber(100).gt('99')).toBe(true)
    expect(BigNumber.fromNumber(100).gt('100')).toBe(false)
  })

  it('works for gt(0) — positive infinity check used by formatter', () => {
    expect(BigNumber.fromNumber(Infinity).gt(0)).toBe(true)
    expect(BigNumber.fromNumber(-Infinity).gt(0)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// .toSignificantDigits(n, roundingMode?)
// ---------------------------------------------------------------------------
describe('BigNumber.prototype.toSignificantDigits', () => {
  it('rounds integer 12345 to 3 significant digits → 12300', () => {
    const result = BigNumber.fromNumber(12345).toSignificantDigits(3)
    expect(result.toString()).toBe('12300')
  })

  it('rounds integer 12345 to 1 significant digit → 10000', () => {
    const result = BigNumber.fromNumber(12345).toSignificantDigits(1)
    expect(result.toString()).toBe('10000')
  })

  it('rounds integer 99999 to 2 significant digits → 100000', () => {
    const result = BigNumber.fromNumber(99999).toSignificantDigits(2)
    expect(result.toString()).toBe('100000')
  })

  it('handles value < 1: 0.012345 to 3 sf → 0.0123', () => {
    // 0.012345 has first sig digit at 10^-2; 3 sf → 0.01235 or 0.0123 depending on rounding
    // halfUp: 0.01234|5 → the 3rd sig digit is 3, next digit is 4 (< 5), so → 0.0123
    const result = BigNumber.fromNumber(0.012345).toSignificantDigits(3)
    expect(result.toString()).toBe('0.0123')
  })

  it('handles value < 1: 0.0050 to 1 sf → 0.005', () => {
    const result = BigNumber.fromNumber(0.005).toSignificantDigits(1)
    expect(result.toString()).toBe('0.005')
  })

  it('boundary rounding: 12.5 to 2 sf uses halfUp → 13', () => {
    // halfUp: 12.5 → 13 (rounds away from zero at exactly half)
    const result = BigNumber.fromNumber(12.5).toSignificantDigits(2)
    expect(result.toString()).toBe('13')
  })

  it('boundary rounding: 12.4 to 2 sf → 12 (below half)', () => {
    const result = BigNumber.fromNumber(12.4).toSignificantDigits(2)
    expect(result.toString()).toBe('12')
  })

  it('is idempotent when n >= current significant digits: 123 to 5 sf', () => {
    // 123 already has only 3 digits; asking for 5 sf should not change the value
    const result = BigNumber.fromNumber(123).toSignificantDigits(5)
    expect(result.toString()).toBe('123')
  })

  it('returns a new BigNumber (does not mutate this)', () => {
    const original = BigNumber.fromNumber(12345)
    const rounded = original.toSignificantDigits(3)
    // original unchanged
    expect(original.toString()).toBe('12345')
    expect(rounded.toString()).toBe('12300')
  })

  it('when called with no arg (undefined) returns value unchanged', () => {
    const b = BigNumber.fromNumber(12345)
    const result = b.toSignificantDigits()
    expect(result.toString()).toBe('12345')
  })

  it('handles negative values', () => {
    const result = BigNumber.fromNumber(-12345).toSignificantDigits(3)
    expect(result.toString()).toBe('-12300')
  })

  it('accepts an explicit roundingMode — halfDown: 12.5 to 2 sf → 12', () => {
    const result = BigNumber.fromNumber(12.5).toSignificantDigits(2, 'halfDown')
    expect(result.toString()).toBe('12')
  })
})

// ---------------------------------------------------------------------------
// .e — decimal exponent getter
// ---------------------------------------------------------------------------
describe('BigNumber.prototype.e (decimal exponent)', () => {
  it('12345 has exponent 4 (5 digits, MSB at 10^4)', () => {
    expect(BigNumber.fromNumber(12345).e).toBe(4)
  })

  it('1 has exponent 0', () => {
    expect(BigNumber.fromNumber(1).e).toBe(0)
  })

  it('10 has exponent 1', () => {
    expect(BigNumber.fromNumber(10).e).toBe(1)
  })

  it('100 has exponent 2', () => {
    expect(BigNumber.fromNumber(100).e).toBe(2)
  })

  it('0.1 has exponent -1', () => {
    expect(BigNumber.fromNumber(0.1).e).toBe(-1)
  })

  it('0.01 has exponent -2', () => {
    expect(BigNumber.fromNumber(0.01).e).toBe(-2)
  })

  it('0.001 has exponent -3', () => {
    expect(BigNumber.fromNumber(0.001).e).toBe(-3)
  })

  it('0.0123 has exponent -2 (first sig digit at 10^-2)', () => {
    expect(BigNumber.fromNumber(0.0123).e).toBe(-2)
  })

  it('999 has exponent 2', () => {
    expect(BigNumber.fromNumber(999).e).toBe(2)
  })

  it('1000 has exponent 3', () => {
    expect(BigNumber.fromNumber(1000).e).toBe(3)
  })

  it('negative value: -12345 has exponent 4 (magnitude)', () => {
    expect(BigNumber.fromNumber(-12345).e).toBe(4)
  })

  it('negative fractional: -0.01 has exponent -2', () => {
    expect(BigNumber.fromNumber(-0.01).e).toBe(-2)
  })

  it('0 has exponent 0 (by convention; use isZero() to distinguish)', () => {
    expect(BigNumber.fromNumber(0).e).toBe(0)
  })

  it('NaN has exponent 0 (special value; callers should check isNaN() first)', () => {
    expect(BigNumber.fromNumber(NaN).e).toBe(0)
  })

  it('Infinity has exponent 0 (special value; callers should check isFinite() first)', () => {
    expect(BigNumber.fromNumber(Infinity).e).toBe(0)
  })

  it('.e on a toSignificantDigits result: 12345.toSigDig(3).e is 4', () => {
    // 12300 → exponent is still 4 (MSB at 10^4)
    const rounded = BigNumber.fromNumber(12345).toSignificantDigits(3)
    expect(rounded.e).toBe(4)
  })
})
