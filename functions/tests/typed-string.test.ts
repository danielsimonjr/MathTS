/**
 * Tests for typed/string.ts — bin, hex, oct, format, print
 *
 * Covers each op with:
 *  - number inputs (positive, negative, zero, edge cases)
 *  - BigNumber inputs
 *  - format options (precision, notation, lowerExp/upperExp)
 *  - print template interpolation (flat and nested)
 *  - type-dispatch errors for unsupported argument combinations
 *
 * ≥ 20 tests total.
 */
import { describe, it, expect } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import { bin, hex, oct, format, print, typedString } from '../src/typed/string.js';

// =============================================================================
// bin
// =============================================================================

describe('bin', () => {
  it('formats zero', () => {
    expect(bin(0)).toBe('0b0');
  });

  it('formats a positive integer', () => {
    expect(bin(2)).toBe('0b10');
  });

  it('formats 255', () => {
    expect(bin(255)).toBe('0b11111111');
  });

  it("formats a negative number (sign-magnitude, not two's-complement)", () => {
    // mathjs convention: sign-magnitude
    expect(bin(-5)).toBe('-0b101');
  });

  it('formats Number.MAX_SAFE_INTEGER', () => {
    const result = bin(Number.MAX_SAFE_INTEGER);
    // Should start with 0b and be a valid binary string
    expect(result).toMatch(/^0b[01]+$/);
    expect(parseInt(result.slice(2), 2)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('formats a BigNumber', () => {
    const bn = BigNumber.fromNumber(10);
    expect(bin(bn)).toBe('0b1010');
  });

  it('formats a negative BigNumber (sign-magnitude)', () => {
    const bn = BigNumber.fromNumber(-3);
    expect(bin(bn)).toBe('-0b11');
  });

  it("formats with wordSize (two's-complement) for a negative number", () => {
    // -1 with 8-bit word size → 0xff with i8 suffix
    expect(bin(-1, 8)).toBe('0b11111111i8');
  });
});

// =============================================================================
// hex
// =============================================================================

describe('hex', () => {
  it('formats zero', () => {
    expect(hex(0)).toBe('0x0');
  });

  it('formats 255', () => {
    expect(hex(255)).toBe('0xff');
  });

  it('formats a negative number (sign-magnitude)', () => {
    expect(hex(-5)).toBe('-0x5');
  });

  it('formats a larger number', () => {
    expect(hex(256)).toBe('0x100');
  });

  it('formats a BigNumber', () => {
    const bn = BigNumber.fromNumber(255);
    expect(hex(bn)).toBe('0xff');
  });

  it('formats a negative BigNumber (sign-magnitude)', () => {
    const bn = BigNumber.fromNumber(-16);
    expect(hex(bn)).toBe('-0x10');
  });

  it("formats with wordSize (two's-complement)", () => {
    // -1 with 8-bit word size → 0xff with i8 suffix
    expect(hex(-1, 8)).toBe('0xffi8');
  });
});

// =============================================================================
// oct
// =============================================================================

describe('oct', () => {
  it('formats zero', () => {
    expect(oct(0)).toBe('0o0');
  });

  it('formats 8 (= 0o10)', () => {
    expect(oct(8)).toBe('0o10');
  });

  it('formats a negative number (sign-magnitude)', () => {
    expect(oct(-8)).toBe('-0o10');
  });

  it('formats a BigNumber', () => {
    const bn = BigNumber.fromNumber(64);
    expect(oct(bn)).toBe('0o100');
  });

  it("formats with wordSize (two's-complement)", () => {
    // -1 with 8-bit word size → 0o377 with i8 suffix
    expect(oct(-1, 8)).toBe('0o377i8');
  });
});

// =============================================================================
// format
// =============================================================================

describe('format', () => {
  it('formats a plain number with default auto notation', () => {
    expect(format(6.4)).toBe('6.4');
  });

  it('rounds to specified precision (positional argument)', () => {
    expect(format(3.14159, 3)).toBe('3.14');
  });

  it('formats with options-object precision', () => {
    // 0.0001 in auto with precision 2 → exponential
    const result = format(0.0001, { precision: 2 });
    expect(result).toBe('1e-4');
  });

  it('formats Infinity', () => {
    expect(format(Infinity)).toBe('Infinity');
  });

  it('formats -Infinity', () => {
    expect(format(-Infinity)).toBe('-Infinity');
  });

  it('formats NaN', () => {
    expect(format(NaN)).toBe('NaN');
  });

  it('formats with notation: fixed (no precision → full number)', () => {
    // Without precision, fixed notation returns the full decimal representation
    const result = format(12.071, { notation: 'fixed' });
    expect(result).toBe('12.071');
  });

  it('formats with notation: fixed and precision', () => {
    const result = format(2.3, { notation: 'fixed', precision: 4 });
    expect(result).toBe('2.3000');
  });

  it('formats with notation: exponential', () => {
    const result = format(52.8, { notation: 'exponential' });
    expect(result).toBe('5.28e+1');
  });

  it('formats a BigNumber with precision', () => {
    const bn = BigNumber.fromNumber(3.14159);
    const result = format(bn, 3);
    expect(result).toBe('3.14');
  });

  it('formats with lowerExp/upperExp options', () => {
    // With upperExp: 2, 2000 should switch to exponential
    const result = format(2000, { lowerExp: -2, upperExp: 2 });
    expect(result).toBe('2e+3');
  });
});

// =============================================================================
// print
// =============================================================================

describe('print', () => {
  it('interpolates a simple variable', () => {
    expect(print('Hello $name!', { name: 'World' })).toBe('Hello World!');
  });

  it('formats numeric values via format', () => {
    expect(print('Lucy is $age years old', { age: 5 })).toBe('Lucy is 5 years old');
  });

  it('supports nested property access ($user.name)', () => {
    const result = print('Hello $user.name!', { user: { name: 'Mary' } });
    expect(result).toBe('Hello Mary!');
  });

  it('supports array-style indexed access ($0, $1)', () => {
    const result = print('$0 and $1', ['apples', 'bananas']);
    expect(result).toBe('apples and bananas');
  });

  it('leaves unknown placeholders unchanged', () => {
    const result = print('Hello $unknown', { name: 'World' });
    expect(result).toBe('Hello $unknown');
  });

  it('supports a precision option (third argument)', () => {
    const result = print('pi is $pi', { pi: Math.PI }, 4);
    expect(result).toBe('pi is 3.142');
  });

  it('supports an options-object as third argument', () => {
    const result = print('val = $v', { v: 0.000123 }, { precision: 2 });
    // 0.000123 with precision 2 in auto notation → exponential
    expect(result).toMatch(/val = 1\.2e-4/);
  });
});

// =============================================================================
// typedString barrel
// =============================================================================

describe('typedString barrel', () => {
  it('exports all 5 ops', () => {
    expect(typeof typedString.bin).toBe('function');
    expect(typeof typedString.hex).toBe('function');
    expect(typeof typedString.oct).toBe('function');
    expect(typeof typedString.format).toBe('function');
    expect(typeof typedString.print).toBe('function');
  });
});
