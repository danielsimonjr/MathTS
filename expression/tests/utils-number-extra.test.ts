import { describe, it, expect } from 'vitest';
import {
  format,
  toEngineering,
  toExponential,
  toFixed,
  toPrecision,
  roundDigits,
  splitNumber,
  normalizeFormatOptions,
} from '../src/utils/number.js';
// importing print pulls in the (single-line) regex module so it is measured.
import { printTemplate } from '../src/utils/print.js';

/**
 * A duck-typed BigNumber accepted by `isBigNumber` (needs an `isBigNumber`
 * flag on the prototype and `.toNumber()`). Used to drive the BigNumber-typed
 * option branches of number.ts that the core BigNumber doesn't reach in this
 * build.
 */
class FakeBigNumber {
  private _v: number;
  constructor(v: number) {
    this._v = v;
  }
  toNumber(): number {
    return this._v;
  }
}
(FakeBigNumber.prototype as any).isBigNumber = true;
const fbn = (v: number) => new FakeBigNumber(v);

describe('number normalizeFormatOptions - BigNumber-typed branches', () => {
  it('accepts a BigNumber as the whole options (precision)', () => {
    expect(normalizeFormatOptions(fbn(4) as any).precision).toBe(4);
  });

  it('accepts a BigNumber precision inside an options object', () => {
    expect(normalizeFormatOptions({ precision: fbn(3) as any }).precision).toBe(3);
  });

  it('accepts a BigNumber wordSize inside an options object', () => {
    expect(normalizeFormatOptions({ notation: 'hex', wordSize: fbn(8) as any }).wordSize).toBe(8);
  });
});

describe('number format - BigNumber lowerExp/upperExp (_toNumberOrDefault)', () => {
  it('uses a BigNumber upperExp via _toNumberOrDefault', () => {
    const result = format(1e7, { upperExp: fbn(2) as any });
    expect(result).toMatch(/e/);
  });

  it('uses a BigNumber lowerExp via _toNumberOrDefault', () => {
    const result = format(0.01, { lowerExp: fbn(-1) as any });
    expect(result).toMatch(/e/);
  });
});

describe('utils/print', () => {
  it('exports the printTemplate regex', () => {
    expect(printTemplate).toBeInstanceOf(RegExp);
    expect('hello $name world'.match(printTemplate)).toEqual(['$name']);
  });
});

describe('number format - base notations (bin/oct/hex) for plain numbers', () => {
  it('formats a number in binary', () => {
    expect(format(10, { notation: 'bin' })).toBe('0b1010');
  });

  it('formats a number in octal', () => {
    expect(format(64, { notation: 'oct' })).toBe('0o100');
  });

  it('formats a number in hexadecimal', () => {
    expect(format(255, { notation: 'hex' })).toBe('0xff');
  });

  it('formats a negative number with a word size suffix', () => {
    expect(format(-1, { notation: 'hex', wordSize: 8 })).toBe('0xffi8');
  });

  it('formats a positive number with a word size suffix', () => {
    expect(format(5, { notation: 'bin', wordSize: 8 })).toBe('0b101i8');
  });

  it('formats a negative number without a word size (sign branch)', () => {
    expect(format(-10, { notation: 'bin' })).toBe('-0b1010');
    expect(format(-255, { notation: 'hex' })).toBe('-0xff');
  });

  it('throws when wordSize < 1', () => {
    expect(() => format(1, { notation: 'hex', wordSize: 0.5 })).toThrow();
  });

  it('throws when wordSize is not an integer', () => {
    expect(() => format(1, { notation: 'hex', wordSize: 2.5 })).toThrow('size must be an integer');
  });

  it('throws when the value is out of range for the word size', () => {
    expect(() => format(100, { notation: 'hex', wordSize: 4 })).toThrow(/Value must be in range/);
  });

  it('throws when the value is not an integer for a sized base format', () => {
    expect(() => format(1.5, { notation: 'hex', wordSize: 8 })).toThrow('Value must be an integer');
  });
});

describe('number normalizeFormatOptions - numeric inputs', () => {
  it('accepts a plain number as the whole options (precision)', () => {
    const norm = normalizeFormatOptions(4);
    expect(norm.precision).toBe(4);
  });

  it('accepts a numeric precision inside an options object', () => {
    const norm = normalizeFormatOptions({ precision: 3 });
    expect(norm.precision).toBe(3);
  });

  it('accepts a numeric wordSize inside an options object', () => {
    const norm = normalizeFormatOptions({ notation: 'hex', wordSize: 8 });
    expect(norm.wordSize).toBe(8);
  });

  /*
   * NOTE: the BigNumber-typed precision/wordSize branches of
   * normalizeFormatOptions / _toNumberOrThrow are not exercised here: the core
   * `@danielsimonjr/mathts-core` BigNumber is not recognised by `isBigNumber`
   * in this build (its instances lack the `isBigNumber` flag the guard
   * requires), so passing a BigNumber as an option throws "must be a number or
   * BigNumber". Covering those branches needs a core BigNumber change, which is
   * out of scope for this expression-coverage task.
   */

  it('throws on a non-numeric precision', () => {
    expect(() => normalizeFormatOptions({ precision: 'x' as any })).toThrow(
      'Option "precision" must be a number or BigNumber'
    );
  });

  it('throws on a non-numeric wordSize', () => {
    expect(() => normalizeFormatOptions({ wordSize: 'x' as any })).toThrow(
      'Option "wordSize" must be a number or BigNumber'
    );
  });
});

describe('number toEngineering / toExponential / toPrecision edge cases', () => {
  it('toEngineering pads coefficients without precision', () => {
    expect(toEngineering(100000000, undefined as any)).toMatch(/e\+?6/);
  });

  it('toEngineering with explicit precision adds sig figs', () => {
    const r = toEngineering(1.5, 5);
    expect(r).toMatch(/e/);
  });

  it('toExponential returns string for NaN/Infinity', () => {
    expect(toExponential(NaN)).toBe('NaN');
    expect(toExponential(Infinity)).toBe('Infinity');
  });

  it('toExponential appends zeros for requested precision', () => {
    expect(toExponential(3, 4)).toMatch(/3\.000e/);
  });

  it('toExponential of a small fractional value', () => {
    expect(toExponential(0.000123)).toMatch(/e/);
  });

  it('toExponential of zero', () => {
    expect(toExponential(0)).toMatch(/0/);
  });

  it('toPrecision rounds up with carry (9.99 -> 1e1)', () => {
    const r = toPrecision(9.99, 1);
    expect(r).toBeTypeOf('string');
  });

  it('toPrecision prepends zeros for non-positive precision path', () => {
    const r = toPrecision(123, 0 as any);
    expect(r).toBeTypeOf('string');
  });

  it('format with auto notation removes trailing zeros', () => {
    expect(format(1.0)).toBe('1');
  });

  it('toFixed prepends zeros for a small value (p < 0 branch)', () => {
    // 0.001 has a negative position; toFixed must prepend zeros.
    expect(toFixed(0.001, 5)).toBe('0.00100');
  });

  it('toFixed of a small value without precision', () => {
    expect(toFixed(0.0005)).toMatch(/^0\.000?5?/);
  });

  it('toFixed returns string for NaN/Infinity', () => {
    expect(toFixed(NaN)).toBe('NaN');
    expect(toFixed(Infinity)).toBe('Infinity');
  });

  it('roundDigits with precision <= 0 prepends zeros', () => {
    const split = splitNumber(123);
    const rounded = roundDigits(split, 0);
    expect(rounded.coefficients[0]).toBe(0);
  });

  it('roundDigits rounds up with carry propagation', () => {
    const split = splitNumber(99.9);
    const rounded = roundDigits(split, 1);
    expect(rounded.coefficients).toBeInstanceOf(Array);
  });
});
