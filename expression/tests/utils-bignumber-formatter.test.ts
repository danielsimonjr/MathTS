import { describe, it, expect } from 'vitest'
import { BigNumber } from '@danielsimonjr/mathts-core'
import {
  format,
  toEngineering,
  toExponential,
  toFixed,
} from '../src/utils/bignumber/formatter.js'

/**
 * Helper that wraps BigNumber.fromNumber / BigNumber.parse so tests read like
 * the old `bn(value)` call pattern.
 */
function bn(value: number | string): BigNumber {
  if (typeof value === 'string') return BigNumber.parse(value)
  return BigNumber.fromNumber(value)
}

// ---------------------------------------------------------------------------
// toFixed (BigNumber)
// ---------------------------------------------------------------------------
describe('toFixed (BigNumber formatter)', () => {
  it('formats a BigNumber with fixed decimal places', () => {
    expect(toFixed(bn(3.14159), 2)).toBe('3.14')
  })

  it('formats a BigNumber integer without decimals', () => {
    expect(toFixed(bn(42), undefined)).toBe('42')
  })

  it('pads with zeros to the requested precision', () => {
    expect(toFixed(bn(1), 3)).toBe('1.000')
  })
})

// ---------------------------------------------------------------------------
// toExponential (BigNumber)
// ---------------------------------------------------------------------------
describe('toExponential (BigNumber formatter)', () => {
  it('formats in exponential notation without precision', () => {
    const result = toExponential(bn(12345), undefined)
    expect(result).toMatch(/e/)
  })

  it('formats with precision=3 (note: calls .toExponential(precision-1))', () => {
    const result = toExponential(bn(12345), 3)
    // precision-1 = 2, so 2 decimals in mantissa
    expect(result).toMatch(/1\.23e/)
  })
})

// ---------------------------------------------------------------------------
// toEngineering (BigNumber)
// ---------------------------------------------------------------------------
describe('toEngineering (BigNumber formatter)', () => {
  it('formats 12345678 in engineering notation', () => {
    const result = toEngineering(bn(12345678), undefined)
    // Should use an exponent divisible by 3
    expect(result).toMatch(/e\+?[0-9]/)
  })

  it('formats 0.001 in engineering notation', () => {
    const result = toEngineering(bn(0.001), undefined)
    expect(result).toMatch(/e/)
  })
})

// ---------------------------------------------------------------------------
// format (BigNumber)
// ---------------------------------------------------------------------------
describe('format (BigNumber formatter)', () => {
  it('returns "NaN" for NaN BigNumber', () => {
    expect(format(bn(NaN), {})).toBe('NaN')
  })

  it('returns "Infinity" for positive infinite BigNumber', () => {
    // Use the real BigNumber for Infinity
    const infBn = BigNumber.fromNumber(Infinity)
    expect(format(infBn, {})).toBe('Infinity')
  })

  it('returns "-Infinity" for negative infinite BigNumber', () => {
    const negInfBn = BigNumber.fromNumber(-Infinity)
    expect(format(negInfBn, {})).toBe('-Infinity')
  })

  it('accepts a custom formatter function', () => {
    // The custom function receives the BigNumber; use toNumber() for the value
    expect(format(bn(42), (v: BigNumber) => `(${v.toNumber()})`)).toBe('(42)')
  })

  it('formats with fixed notation via options object', () => {
    const result = format(bn(3.14159), { notation: 'fixed', precision: 2 })
    expect(result).toBe('3.14')
  })

  it('formats with exponential notation', () => {
    const result = format(bn(12345), { notation: 'exponential' })
    expect(result).toMatch(/e/)
  })

  it('formats in auto mode (default) and removes trailing zeros', () => {
    // 1.0000 should become 1
    const result = format(bn(1.0), {})
    expect(result).not.toMatch(/0+$/)
  })

  it('returns "0" for zero in auto mode', () => {
    const result = format(bn(0), {})
    expect(result).toBe('0')
  })

  it('throws for unknown notation', () => {
    expect(() => format(bn(1), { notation: 'unknown' as any })).toThrow('Unknown notation')
  })
})
