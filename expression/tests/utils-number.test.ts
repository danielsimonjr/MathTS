import { describe, it, expect } from 'vitest'
import {
  isInteger,
  safeNumberType,
  sign,
  log2,
  log10,
  log1p,
  cbrt,
  expm1,
  format,
  normalizeFormatOptions,
  splitNumber,
  toEngineering,
  toFixed,
  toExponential,
  toPrecision,
  roundDigits,
  digits,
  nearlyEqual,
  acosh,
  asinh,
  atanh,
  cosh,
  sinh,
  tanh,
  copysign,
} from '../src/utils/number.js'

// ---------------------------------------------------------------------------
// isInteger
// ---------------------------------------------------------------------------
describe('isInteger', () => {
  it('returns true for whole numbers', () => {
    expect(isInteger(0)).toBe(true)
    expect(isInteger(1)).toBe(true)
    expect(isInteger(-42)).toBe(true)
    expect(isInteger(1e6)).toBe(true)
  })

  it('returns false for floats', () => {
    expect(isInteger(1.5)).toBe(false)
    expect(isInteger(-0.1)).toBe(false)
  })

  it('returns false for Infinity and NaN', () => {
    expect(isInteger(Infinity)).toBe(false)
    expect(isInteger(NaN)).toBe(false)
  })

  it('returns true for booleans (treated as 0/1)', () => {
    expect(isInteger(true)).toBe(true)
    expect(isInteger(false)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// safeNumberType
// ---------------------------------------------------------------------------
describe('safeNumberType', () => {
  it('returns the configured type for integer strings when bigint', () => {
    const config = { number: 'bigint' as const, numberFallback: 'number' as const }
    expect(safeNumberType('42', config)).toBe('bigint')
  })

  it('falls back to numberFallback for non-integer strings when bigint', () => {
    const config = { number: 'bigint' as const, numberFallback: 'number' as const }
    expect(safeNumberType('3.14', config)).toBe('number')
  })

  it('returns the configured type when not bigint', () => {
    const config = { number: 'BigNumber' as const, numberFallback: 'number' as const }
    expect(safeNumberType('3.14', config)).toBe('BigNumber')
  })
})

// ---------------------------------------------------------------------------
// sign / log2 / log10 / log1p / cbrt / expm1
// ---------------------------------------------------------------------------
describe('sign', () => {
  it('returns 1 for positives', () => {
    expect(sign(5)).toBe(1)
  })

  it('returns -1 for negatives', () => {
    expect(sign(-3)).toBe(-1)
  })

  it('returns 0 for zero', () => {
    expect(sign(0)).toBe(0)
  })
})

describe('log2', () => {
  it('returns the base-2 log', () => {
    expect(log2(8)).toBeCloseTo(3)
    expect(log2(1)).toBeCloseTo(0)
  })
})

describe('log10', () => {
  it('returns the base-10 log', () => {
    expect(log10(100)).toBeCloseTo(2)
    expect(log10(1)).toBeCloseTo(0)
  })
})

describe('log1p', () => {
  it('returns ln(x+1)', () => {
    expect(log1p(0)).toBeCloseTo(0)
    expect(log1p(Math.E - 1)).toBeCloseTo(1)
  })
})

describe('cbrt', () => {
  it('returns the cube root', () => {
    expect(cbrt(27)).toBeCloseTo(3)
    expect(cbrt(-8)).toBeCloseTo(-2)
    expect(cbrt(0)).toBe(0)
  })

  it('handles Infinity', () => {
    expect(cbrt(Infinity)).toBe(Infinity)
  })
})

describe('expm1', () => {
  it('returns exp(x)-1 accurately near zero', () => {
    expect(expm1(0)).toBeCloseTo(0)
    expect(expm1(1)).toBeCloseTo(Math.E - 1)
  })
})

// ---------------------------------------------------------------------------
// splitNumber
// ---------------------------------------------------------------------------
describe('splitNumber', () => {
  it('splits a positive integer', () => {
    const r = splitNumber(123)
    expect(r.sign).toBe('')
    expect(r.coefficients).toEqual([1, 2, 3])
    expect(r.exponent).toBe(2)
  })

  it('splits a negative float', () => {
    const r = splitNumber(-0.05)
    expect(r.sign).toBe('-')
    expect(r.exponent).toBe(-2)
  })

  it('splits zero', () => {
    const r = splitNumber(0)
    expect(r.coefficients).toEqual([0])
  })

  it('throws for invalid input', () => {
    expect(() => splitNumber('abc')).toThrow('Invalid number')
  })
})

// ---------------------------------------------------------------------------
// toFixed
// ---------------------------------------------------------------------------
describe('toFixed', () => {
  it('formats an integer without precision', () => {
    expect(toFixed(42)).toBe('42')
  })

  it('formats with precision=2', () => {
    expect(toFixed(3.14159, 2)).toBe('3.14')
  })

  it('formats a negative number', () => {
    expect(toFixed(-7.5, 1)).toBe('-7.5')
  })

  it('returns "NaN" for NaN', () => {
    expect(toFixed(NaN)).toBe('NaN')
  })

  it('returns "Infinity" for Infinity', () => {
    expect(toFixed(Infinity)).toBe('Infinity')
  })
})

// ---------------------------------------------------------------------------
// toExponential
// ---------------------------------------------------------------------------
describe('toExponential', () => {
  it('formats a number in exponential notation without precision', () => {
    expect(toExponential(12345)).toMatch(/1\.2345e\+4/)
  })

  it('formats with precision', () => {
    expect(toExponential(12345, 3)).toMatch(/1\.23e\+4/)
  })

  it('returns "NaN" for NaN', () => {
    expect(toExponential(NaN)).toBe('NaN')
  })
})

// ---------------------------------------------------------------------------
// toEngineering
// ---------------------------------------------------------------------------
describe('toEngineering', () => {
  it('formats 12345678 in engineering notation', () => {
    expect(toEngineering(12345678)).toMatch(/12\.345678e\+6/)
  })

  it('formats 0.001 in engineering notation', () => {
    expect(toEngineering(0.001)).toMatch(/1e-3/)
  })

  it('returns "NaN" for NaN', () => {
    expect(toEngineering(NaN)).toBe('NaN')
  })
})

// ---------------------------------------------------------------------------
// toPrecision
// ---------------------------------------------------------------------------
describe('toPrecision', () => {
  it('formats in auto mode without precision', () => {
    expect(toPrecision(1234)).toBe('1234')
  })

  it('uses exponential when exponent >= upperExp', () => {
    // default upperExp=5; 100000 has exponent 5 → exponential
    const result = toPrecision(100000)
    expect(result).toMatch(/e/)
  })

  it('returns "NaN" for NaN', () => {
    expect(toPrecision(NaN)).toBe('NaN')
  })
})

// ---------------------------------------------------------------------------
// roundDigits
// ---------------------------------------------------------------------------
describe('roundDigits', () => {
  it('rounds to the specified precision', () => {
    const split = splitNumber(3.14159)
    const rounded = roundDigits(split, 3)
    expect(rounded.coefficients).toEqual([3, 1, 4])
  })

  it('rounds up when next digit >= 5', () => {
    const split = splitNumber(1.456)
    const rounded = roundDigits(split, 2)
    // 1.456 rounded to 2 sig figs is 1.5 → coefficients [1,5]
    expect(rounded.coefficients[1]).toBe(5)
  })

  it('returns input unchanged when precision is undefined', () => {
    const split = splitNumber(42)
    const rounded = roundDigits(split)
    expect(rounded.coefficients).toEqual([4, 2])
  })
})

// ---------------------------------------------------------------------------
// format (number)
// ---------------------------------------------------------------------------
describe('format (number)', () => {
  it('formats a plain number in auto mode', () => {
    expect(format(6.4)).toBe('6.4')
  })

  it('returns "Infinity" for Infinity', () => {
    expect(format(Infinity)).toBe('Infinity')
  })

  it('returns "-Infinity" for -Infinity', () => {
    expect(format(-Infinity)).toBe('-Infinity')
  })

  it('returns "NaN" for NaN', () => {
    expect(format(NaN)).toBe('NaN')
  })

  it('accepts a custom formatter function', () => {
    expect(format(42, (v: number) => `(${v})`)).toBe('(42)')
  })

  it('formats with fixed notation', () => {
    expect(format(2.3, { notation: 'fixed', precision: 2 })).toBe('2.30')
  })

  it('formats with exponential notation', () => {
    expect(format(52.8, { notation: 'exponential' })).toMatch(/5\.28e\+1/)
  })

  it('formats with engineering notation', () => {
    expect(format(12345678, { notation: 'engineering' })).toMatch(/e/)
  })

  it('formats in binary notation', () => {
    expect(format(10, { notation: 'bin' })).toBe('0b1010')
  })

  it('formats in octal notation', () => {
    expect(format(8, { notation: 'oct' })).toBe('0o10')
  })

  it('formats in hex notation', () => {
    expect(format(255, { notation: 'hex' })).toBe('0xff')
  })

  it('formats with precision as a number option', () => {
    expect(format(1 / 3, 3)).toBe('0.333')
  })

  it('throws for unknown notation', () => {
    expect(() => format(1, { notation: 'unknown' as any })).toThrow('Unknown notation')
  })
})

// ---------------------------------------------------------------------------
// normalizeFormatOptions
// ---------------------------------------------------------------------------
describe('normalizeFormatOptions', () => {
  it('returns defaults when options is undefined', () => {
    const r = normalizeFormatOptions()
    expect(r.notation).toBe('auto')
    expect(r.precision).toBeUndefined()
    expect(r.wordSize).toBeUndefined()
  })

  it('accepts a number as precision', () => {
    const r = normalizeFormatOptions(4)
    expect(r.precision).toBe(4)
  })

  it('accepts an object with notation and precision', () => {
    const r = normalizeFormatOptions({ notation: 'fixed', precision: 2 })
    expect(r.notation).toBe('fixed')
    expect(r.precision).toBe(2)
  })

  it('throws for an unsupported type', () => {
    expect(() => normalizeFormatOptions('bad' as any)).toThrow('Unsupported type')
  })
})

// ---------------------------------------------------------------------------
// digits
// ---------------------------------------------------------------------------
describe('digits', () => {
  it('counts significant digits', () => {
    expect(digits(2.34)).toBe(3)
    expect(digits(0.0034)).toBe(2)
    expect(digits(120.5e30)).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// nearlyEqual
// ---------------------------------------------------------------------------
describe('nearlyEqual', () => {
  it('returns true for equal numbers', () => {
    expect(nearlyEqual(1, 1)).toBe(true)
  })

  it('returns true for nearly equal numbers within relTol', () => {
    expect(nearlyEqual(1.000000001, 1.0, 1e-8)).toBe(true)
  })

  it('returns false for numbers outside relTol', () => {
    expect(nearlyEqual(1.01, 1.0, 1e-8)).toBe(false)
  })

  it('returns false for NaN', () => {
    expect(nearlyEqual(NaN, NaN)).toBe(false)
  })

  it('returns true for same Infinity', () => {
    expect(nearlyEqual(Infinity, Infinity)).toBe(true)
  })

  it('returns false for opposite Infinities', () => {
    expect(nearlyEqual(Infinity, -Infinity)).toBe(false)
  })

  it('throws for relTol <= 0', () => {
    expect(() => nearlyEqual(1, 1, 0)).toThrow('Relative tolerance must be greater than 0')
  })

  it('throws for negative absTol', () => {
    expect(() => nearlyEqual(1, 1, 1e-8, -1)).toThrow('Absolute tolerance must be at least 0')
  })

  it('uses absTol for near-zero comparisons', () => {
    expect(nearlyEqual(0.000000001, 0.0, 1e-8, 1e-8)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// acosh / asinh / atanh / cosh / sinh / tanh
// ---------------------------------------------------------------------------
describe('acosh', () => {
  it('returns ~0 for acosh(1)', () => {
    expect(acosh(1)).toBeCloseTo(0)
  })
})

describe('asinh', () => {
  it('returns ~0 for asinh(0)', () => {
    expect(asinh(0)).toBeCloseTo(0)
  })
})

describe('atanh', () => {
  it('returns ~0 for atanh(0)', () => {
    expect(atanh(0)).toBeCloseTo(0)
  })
})

describe('cosh', () => {
  it('returns 1 for cosh(0)', () => {
    expect(cosh(0)).toBeCloseTo(1)
  })
})

describe('sinh', () => {
  it('returns 0 for sinh(0)', () => {
    expect(sinh(0)).toBeCloseTo(0)
  })
})

describe('tanh', () => {
  it('returns 0 for tanh(0)', () => {
    expect(tanh(0)).toBeCloseTo(0)
  })

  it('approaches 1 for large positive values', () => {
    expect(tanh(100)).toBeCloseTo(1)
  })
})

// ---------------------------------------------------------------------------
// copysign
// ---------------------------------------------------------------------------
describe('copysign', () => {
  it('returns |x| with sign of y', () => {
    expect(copysign(5, -1)).toBe(-5)
    expect(copysign(-5, 1)).toBe(5)
    expect(copysign(-5, -1)).toBe(-5)
  })

  it('handles zero magnitude: copysign(0,-1) returns -0', () => {
    // -0 has negative sign, so copysign(0,-1) = -0
    const result = copysign(0, -1)
    expect(result).toBe(-0)
    expect(1 / result).toBe(-Infinity) // -0 test
  })
})
