/**
 * Supplementary typed-function integration tests targeting previously-uncovered
 * code: WASM init helpers, conversion convert() callbacks, duck-typed guards
 * (isUnit/isMatrix/isDenseMatrix/isSparseMatrix), and TypeRegistry methods.
 * @module @danielsimonjr/mathts-core/tests/typed/mathts-typed-coverage
 */

import { describe, it, expect } from 'vitest';
import {
  initTypedWasm,
  isTypedWasmAvailable,
  isUnit,
  isMatrix,
  isDenseMatrix,
  isSparseMatrix,
  MATHTS_CONVERSIONS,
  TypeRegistry,
  type ConversionDef,
} from '../../src/typed/mathts-typed';
import { Complex } from '../../src/types/complex';
import { Fraction } from '../../src/types/fraction';
import { BigNumber } from '../../src/types/bignumber';

function convert(from: string, to: string): (v: unknown) => unknown {
  const def = MATHTS_CONVERSIONS.find((c: ConversionDef) => c.from === from && c.to === to);
  if (!def) throw new Error(`missing conversion ${from}->${to}`);
  return def.convert;
}

describe('typed-function WASM helpers', () => {
  it('initTypedWasm resolves to a boolean and is idempotent', async () => {
    const first = await initTypedWasm({ preferWasm: false });
    expect(typeof first).toBe('boolean');
    // Second call hits the early-return cached branch.
    const second = await initTypedWasm();
    expect(second).toBe(first);
  });

  it('isTypedWasmAvailable returns a boolean', () => {
    expect(typeof isTypedWasmAvailable()).toBe('boolean');
  });
});

describe('duck-typed guards', () => {
  const denseLike = { rows: 2, cols: 2, get: () => 0, type: 'DenseMatrix' };
  const sparseLike = { rows: 2, cols: 2, get: () => 0, type: 'SparseMatrix' };

  it('isMatrix recognises matrix-shaped objects', () => {
    expect(isMatrix(denseLike)).toBe(true);
    expect(isMatrix({ rows: 1 })).toBe(false);
    expect(isMatrix(null)).toBe(false);
    expect(isMatrix(42)).toBe(false);
  });

  it('isDenseMatrix distinguishes the dense type tag', () => {
    expect(isDenseMatrix(denseLike)).toBe(true);
    expect(isDenseMatrix(sparseLike)).toBe(false);
  });

  it('isSparseMatrix distinguishes the sparse type tag', () => {
    expect(isSparseMatrix(sparseLike)).toBe(true);
    expect(isSparseMatrix(denseLike)).toBe(false);
  });

  it('isUnit recognises native and legacy unit shapes, rejects others', () => {
    expect(isUnit({ type: 'Unit', value: 1, dimensions: [] })).toBe(true); // native
    expect(isUnit({ type: 'Unit', value: 5, unit: 'm' })).toBe(true); // legacy duck shape
    expect(isUnit({ type: 'Unit' })).toBe(false); // missing value/dimensions
    expect(isUnit({ value: 1, unit: 'm' })).toBe(false); // no string type
    expect(isUnit(null)).toBe(false);
  });
});

describe('MATHTS_CONVERSIONS convert callbacks', () => {
  it('Fraction -> Complex', () => {
    const c = convert('Fraction', 'Complex')(new Fraction(1n, 2n)) as Complex;
    expect(c.re).toBeCloseTo(0.5);
    expect(c.im).toBe(0);
  });

  it('BigNumber -> Complex', () => {
    const c = convert('BigNumber', 'Complex')(BigNumber.fromNumber(3)) as Complex;
    expect(c.re).toBe(3);
  });

  it('string -> Complex', () => {
    const c = convert('string', 'Complex')('2+3i') as Complex;
    expect(c.re).toBe(2);
    expect(c.im).toBe(3);
  });

  it('bigint -> Fraction', () => {
    const f = convert('bigint', 'Fraction')(7n) as Fraction;
    expect(f.numerator).toBe(7n);
    expect(f.denominator).toBe(1n);
  });

  it('string -> Fraction', () => {
    const f = convert('string', 'Fraction')('3/4') as Fraction;
    expect(f.numerator).toBe(3n);
    expect(f.denominator).toBe(4n);
  });

  it('bigint -> BigNumber', () => {
    const bn = convert('bigint', 'BigNumber')(100n) as BigNumber;
    expect(bn.valueOf()).toBe(100);
  });

  it('Fraction -> BigNumber', () => {
    const bn = convert('Fraction', 'BigNumber')(new Fraction(1n, 4n)) as BigNumber;
    expect(bn.valueOf()).toBeCloseTo(0.25);
  });

  it('string -> BigNumber', () => {
    const bn = convert('string', 'BigNumber')('12.5') as BigNumber;
    expect(bn.valueOf()).toBe(12.5);
  });

  it('string -> number throws on non-numeric', () => {
    const fn = convert('string', 'number');
    expect(fn('42')).toBe(42);
    expect(() => fn('abc')).toThrow();
  });

  it('bigint -> number', () => {
    expect(convert('bigint', 'number')(9n)).toBe(9);
  });

  it('Fraction -> number', () => {
    expect(convert('Fraction', 'number')(new Fraction(3n, 2n))).toBeCloseTo(1.5);
  });

  it('BigNumber -> number', () => {
    expect(convert('BigNumber', 'number')(BigNumber.fromNumber(8))).toBe(8);
  });

  it('number -> bigint truncates', () => {
    expect(convert('number', 'bigint')(7.9)).toBe(7n);
  });

  it('Fraction -> bigint truncates', () => {
    expect(convert('Fraction', 'bigint')(new Fraction(7n, 2n))).toBe(3n);
  });

  it('BigNumber -> bigint', () => {
    expect(convert('BigNumber', 'bigint')(BigNumber.fromNumber(42))).toBe(42n);
  });

  it('string -> bigint', () => {
    expect(convert('string', 'bigint')('123')).toBe(123n);
  });

  it('Array -> Matrix builds a dense-shaped descriptor with get()', () => {
    const m = convert('Array', 'Matrix')([
      [1, 2],
      [3, 4],
    ]) as { rows: number; cols: number; type: string; get: (r: number, c: number) => number };
    expect(m.rows).toBe(2);
    expect(m.cols).toBe(2);
    expect(m.type).toBe('DenseMatrix');
    expect(m.get(1, 0)).toBe(3);
  });

  it('Array -> Matrix handles empty input', () => {
    const m = convert('Array', 'Matrix')([]) as { rows: number; cols: number };
    expect(m.rows).toBe(0);
    expect(m.cols).toBe(0);
  });

  it('Matrix -> Array reconstructs the nested array', () => {
    const matrixLike = {
      rows: 2,
      cols: 2,
      get: (r: number, c: number) => r * 2 + c,
    };
    const arr = convert('Matrix', 'Array')(matrixLike) as number[][];
    expect(arr).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('DenseMatrix -> SparseMatrix retags the descriptor', () => {
    const out = convert('DenseMatrix', 'SparseMatrix')({ type: 'DenseMatrix', data: [1] }) as {
      type: string;
      data: number[];
    };
    expect(out.type).toBe('SparseMatrix');
    expect(out.data).toEqual([1]);
  });
});

describe('TypeRegistry full lifecycle', () => {
  it('registers types/conversions, queries them, builds, and clears', () => {
    const reg = new TypeRegistry();
    reg.registerType('Even', (x: unknown): x is number => typeof x === 'number' && x % 2 === 0);
    reg.registerConversion<number, string>('Even', 'string', (n) => String(n));

    expect(reg.hasType('Even')).toBe(true);
    expect(reg.hasType('Odd')).toBe(false);
    expect(reg.hasConversion('Even', 'string')).toBe(true);
    expect(reg.hasConversion('string', 'Even')).toBe(false);
    expect(reg.getTypeNames()).toEqual(['Even']);

    const instance = reg.build();
    expect(typeof instance).toBe('function');
    // build() caches: a second call returns the same instance object.
    expect(reg.build()).toBe(instance);

    reg.clear();
    expect(reg.hasType('Even')).toBe(false);
    expect(reg.getTypeNames()).toEqual([]);
  });
});
