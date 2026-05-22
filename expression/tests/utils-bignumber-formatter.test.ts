import { describe, it, expect } from 'vitest'
import {
  format,
  toEngineering,
  toExponential,
  toFixed,
} from '../src/utils/bignumber/formatter.js'

/**
 * Minimal mock BigNumber that satisfies the formatter's duck-typed interface.
 * The formatter uses: isFinite(), isNaN(), gt(n), isZero(), toSignificantDigits(n),
 * .e, toFixed([n]), toExponential([n]), toPrecision(n), mul(n).
 */
class MockBigNumber {
  _value: number
  e: number
  isBigNumber: boolean = true

  constructor(value: number | string) {
    this._value = typeof value === 'number' ? value : parseFloat(value as string)
    // Exponent of the number in base-10 scientific notation
    const abs = Math.abs(this._value)
    this.e = abs === 0 ? 0 : Math.floor(Math.log10(abs))
  }

  isFinite() {
    return isFinite(this._value)
  }

  isNaN() {
    return isNaN(this._value)
  }

  isZero() {
    return this._value === 0
  }

  gt(x: number | MockBigNumber) {
    const v = x instanceof MockBigNumber ? x._value : x
    return this._value > v
  }

  lessThan(x: number | MockBigNumber) {
    const v = x instanceof MockBigNumber ? x._value : x
    return this._value < v
  }

  greaterThan(x: number | MockBigNumber) {
    return this.gt(x)
  }

  toSignificantDigits(n?: number) {
    const rounded = n !== undefined ? parseFloat(this._value.toPrecision(n)) : this._value
    const result = new MockBigNumber(rounded)
    result.e = this.e
    return result
  }

  toFixed(n?: number) {
    return n !== undefined ? this._value.toFixed(n) : String(this._value)
  }

  toExponential(n?: number) {
    return n !== undefined ? this._value.toExponential(n) : this._value.toExponential()
  }

  toPrecision(n?: number) {
    return n !== undefined ? this._value.toPrecision(n) : String(this._value)
  }

  mul(x: number | MockBigNumber) {
    const v = x instanceof MockBigNumber ? x._value : x
    return new MockBigNumber(this._value * v)
  }

  toNumber() {
    return this._value
  }

  toString() {
    return String(this._value)
  }
}

MockBigNumber.prototype.isBigNumber = true

function bn(value: number | string) {
  return new MockBigNumber(value)
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
    // Override isFinite/gt for Infinity simulation
    const infBn = {
      isFinite: () => false,
      isNaN: () => false,
      gt: (x: number) => true,
      isBigNumber: true,
    }
    expect(format(infBn, {})).toBe('Infinity')
  })

  it('returns "-Infinity" for negative infinite BigNumber', () => {
    const negInfBn = {
      isFinite: () => false,
      isNaN: () => false,
      gt: (_x: number) => false,
      isBigNumber: true,
    }
    expect(format(negInfBn, {})).toBe('-Infinity')
  })

  it('accepts a custom formatter function', () => {
    expect(format(bn(42), (v: any) => `(${v._value})`)).toBe('(42)')
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
    const zeroBn = Object.assign(new MockBigNumber(0), {
      isZero: () => true,
    })
    const result = format(zeroBn, {})
    expect(result).toBe('0')
  })

  it('throws for unknown notation', () => {
    expect(() => format(bn(1), { notation: 'unknown' as any })).toThrow('Unknown notation')
  })
})
