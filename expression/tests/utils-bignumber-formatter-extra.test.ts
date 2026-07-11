import { describe, it, expect } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import { format, toEngineering } from '../src/utils/bignumber/formatter.js';

function bn(value: number | string): BigNumber {
  if (typeof value === 'string') return BigNumber.parse(value);
  return BigNumber.fromNumber(value);
}

/*
 * NOTE: the binary/octal/hexadecimal `format()` branches (notation 'bin'/'oct'/'hex'
 * and the `formatBigNumberToBase` helper) are intentionally NOT exercised here.
 * The core `@danielsimonjr/mathts-core` BigNumber does not implement
 * `toBinary`/`toOctal`/`toHexadecimal`, and the word-size range checks mix BigInt
 * with the BigNumber arithmetic (throwing "Cannot mix BigInt and other types").
 * Covering them would require changing the core BigNumber, which is out of scope
 * for this expression-coverage task. They remain uncovered by design.
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

  it('accepts BigNumber lowerExp/upperExp (via direct BigNumber comparison)', () => {
    // upperExp given as a BigNumber exercises the isBigNumber branch.
    // 1e7 has exp 7 >= upperExp 2 => exp.
    const result = format(bn(1e7), { upperExp: bn(2) });
    expect(result).toMatch(/e/);
  });
});

describe('bignumber formatter - toEngineering', () => {
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
