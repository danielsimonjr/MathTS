import { describe, it, expect } from 'vitest';
import { BigNumber } from '../src/types/bignumber.js';
import { format, toEngineering, toExponential, toFixed } from '../src/bignumber-formatter.js';
import type { FormatOptions } from '../src/number.js';

/**
 * Unit coverage for the canonical BigNumber (decimal.js-shaped) formatter.
 *
 * Migrated from expression/tests/utils-bignumber-formatter{,-extra}.test.ts when the
 * dead-ship expression/src/utils/bignumber/formatter.ts and
 * functions/src/utils/bignumber/formatter.ts re-export shims were retired. Those shims
 * simply re-exported these same core functions, so this test targets the canonical
 * core/src/bignumber-formatter.ts directly — the coverage the shims' tests provided,
 * with no loss.
 */

/**
 * Helper that wraps BigNumber.fromNumber / BigNumber.parse so tests read like
 * the old `bn(value)` call pattern.
 */
function bn(value: number | string): BigNumber {
  if (typeof value === 'string') return BigNumber.parse(value);
  return BigNumber.fromNumber(value);
}

// ---------------------------------------------------------------------------
// toFixed (BigNumber)
// ---------------------------------------------------------------------------
describe('toFixed (BigNumber formatter)', () => {
  it('formats a BigNumber with fixed decimal places', () => {
    expect(toFixed(bn(3.14159), 2)).toBe('3.14');
  });

  it('formats a BigNumber integer without decimals', () => {
    expect(toFixed(bn(42), undefined)).toBe('42');
  });

  it('pads with zeros to the requested precision', () => {
    expect(toFixed(bn(1), 3)).toBe('1.000');
  });
});

// ---------------------------------------------------------------------------
// toExponential (BigNumber)
// ---------------------------------------------------------------------------
describe('toExponential (BigNumber formatter)', () => {
  it('formats in exponential notation without precision', () => {
    const result = toExponential(bn(12345), undefined);
    expect(result).toMatch(/e/);
  });

  it('formats with precision=3 (note: calls .toExponential(precision-1))', () => {
    const result = toExponential(bn(12345), 3);
    // precision-1 = 2, so 2 decimals in mantissa
    expect(result).toMatch(/1\.23e/);
  });
});

// ---------------------------------------------------------------------------
// toEngineering (BigNumber)
// ---------------------------------------------------------------------------
describe('toEngineering (BigNumber formatter)', () => {
  it('formats 12345678 in engineering notation', () => {
    const result = toEngineering(bn(12345678), undefined);
    // Should use an exponent divisible by 3
    expect(result).toMatch(/e\+?[0-9]/);
  });

  it('formats 0.001 in engineering notation', () => {
    const result = toEngineering(bn(0.001), undefined);
    expect(result).toMatch(/e/);
  });

  it('formats with explicit precision', () => {
    const result = toEngineering(bn(12345678), 4);
    expect(result).toMatch(/e\+?[0-9]/);
  });

  it('formats a small fractional value with a negative exponent', () => {
    const result = toEngineering(bn(0.0000123), undefined);
    expect(result).toMatch(/e-/);
  });

  it('formats a value whose exponent is already a multiple of 3', () => {
    const result = toEngineering(bn(1000), undefined);
    expect(result).toMatch(/e\+?3/);
  });

  it('handles a value whose toPrecision yields exponential (large magnitude)', () => {
    // a very large value can make toPrecision return an "e" string, exercising
    // the new-BigNumber(valueStr).toFixed() re-normalization branch.
    const result = toEngineering(bn(1.23e21), 3);
    expect(result).toMatch(/e\+?21/);
  });
});

// ---------------------------------------------------------------------------
// format (BigNumber)
// ---------------------------------------------------------------------------
describe('format (BigNumber formatter)', () => {
  it('returns "NaN" for NaN BigNumber', () => {
    expect(format(bn(NaN), {})).toBe('NaN');
  });

  it('returns "Infinity" for positive infinite BigNumber', () => {
    const infBn = BigNumber.fromNumber(Infinity);
    expect(format(infBn, {})).toBe('Infinity');
  });

  it('returns "-Infinity" for negative infinite BigNumber', () => {
    const negInfBn = BigNumber.fromNumber(-Infinity);
    expect(format(negInfBn, {})).toBe('-Infinity');
  });

  it('accepts a custom formatter function', () => {
    // The custom function receives the BigNumber; use toNumber() for the value
    expect(format(bn(42), (v: BigNumber) => `(${v.toNumber()})`)).toBe('(42)');
  });

  it('formats with fixed notation via options object', () => {
    const result = format(bn(3.14159), { notation: 'fixed', precision: 2 });
    expect(result).toBe('3.14');
  });

  it('formats with exponential notation', () => {
    const result = format(bn(12345), { notation: 'exponential' });
    expect(result).toMatch(/e/);
  });

  it('formats in auto mode (default) and removes trailing zeros', () => {
    // 1.0000 should become 1
    const result = format(bn(1.0), {});
    expect(result).not.toMatch(/0+$/);
  });

  it('returns "0" for zero in auto mode', () => {
    const result = format(bn(0), {});
    expect(result).toBe('0');
  });

  it('throws for unknown notation', () => {
    expect(() => format(bn(1), { notation: 'unknown' as FormatOptions['notation'] })).toThrow(
      'Unknown notation'
    );
  });
});

// ---------------------------------------------------------------------------
// format — auto-notation branches
// ---------------------------------------------------------------------------
/*
 * NOTE: the binary/octal/hexadecimal `format()` branches (notation 'bin'/'oct'/'hex'
 * and the `formatBigNumberToBase` helper) are intentionally NOT exercised here.
 * The core BigNumber does not implement `toBinary`/`toOctal`/`toHexadecimal`, and the
 * word-size range checks mix BigInt with the BigNumber arithmetic (throwing "Cannot
 * mix BigInt and other types"). Covering them would require changing the core
 * BigNumber, which is out of scope. They remain uncovered by design.
 */
describe('bignumber formatter - auto notation branches', () => {
  it('uses exponential notation for large values in auto mode', () => {
    const result = format(bn(1.4e7), {});
    expect(result).toMatch(/e/);
  });

  it('uses exponential notation for very small values in auto mode', () => {
    const result = format(bn(1.4e-7), {});
    expect(result).toMatch(/e/);
  });

  it('uses normal notation for mid-range values in auto mode', () => {
    expect(format(bn(123.4), {})).toBe('123.4');
  });

  it('respects a custom upperExp bound (forces exponential earlier)', () => {
    const result = format(bn(1234), { upperExp: 2 });
    expect(result).toMatch(/e/);
  });

  it('respects a custom lowerExp bound', () => {
    // a value that would normally print plain, forced exponential via lowerExp
    const result = format(bn(0.01), { lowerExp: -1 });
    expect(result).toMatch(/e/);
  });

  it('strips trailing zeros from a fixed auto result (precision forces zeros)', () => {
    // precision pads the fixed form with trailing zeros, which the auto branch
    // then removes via its regex replace callback.
    const result = format(bn(1.2), { precision: 6 });
    expect(result).toBe('1.2');
  });

  it('strips trailing zeros leaving an integer mantissa', () => {
    const result = format(bn(2), { precision: 6 });
    expect(result).toBe('2');
  });

  it('accepts BigNumber lowerExp/upperExp (via _toNumberOrDefault)', () => {
    // upperExp given as a BigNumber exercises the isBigNumber branch of
    // _toNumberOrDefault (value.toNumber()). 1e7 has exp 7 >= upperExp 2 => exp.
    const result = format(bn(1e7), { upperExp: bn(2) });
    expect(result).toMatch(/e/);
  });
});
