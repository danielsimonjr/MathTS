/**
 * G16 — mathjs compat surface (#730 #731 #732 #733 #734 #738)
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { Complex, Fraction, isUnit, isBigNumber } from '@danielsimonjr/mathts-core';
import { create as mjCreate, all as mjAll } from 'mathjs';

describe('G16 dogfood — mathjs compat surface', () => {
  it('#730 math.import registers a function and evaluate sees it', () => {
    const mt = create(all);
    const mj = mjCreate(mjAll);
    mj.import({ addFive: (x: number) => x + 5 });
    mt.import({ addFive: (x: number) => x + 5 });
    expect((mj as unknown as { addFive: (x: number) => number }).addFive(10)).toBe(15);
    expect((mt as unknown as { addFive: (x: number) => number }).addFive(10)).toBe(15);
    expect(mt.evaluate('addFive(10)')).toBe(15);
  });

  it('#731 math.typed builds overloads like mathjs', () => {
    const mt = create(all);
    const mj = mjCreate(mjAll);
    const fMj = mj.typed('double', {
      number: (x: number) => x * 2,
      string: (x: string) => x + x,
    });
    const fMt = mt.typed('double', {
      number: (x: number) => x * 2,
      string: (x: string) => x + x,
    }) as (x: number | string) => number | string;
    expect(fMj(3)).toBe(6);
    expect(fMj('ab')).toBe('abab');
    expect(fMt(3)).toBe(6);
    expect(fMt('ab')).toBe('abab');
  });

  it('#732 math.compile aliases compileExpr', () => {
    const mt = create(all);
    const mj = mjCreate(mjAll);
    expect(mj.compile('2+3').evaluate()).toBe(5);
    expect(typeof mt.compile).toBe('function');
    expect(mt.compile('2+3').evaluate()).toBe(5);
    expect(mt.compile('x^2').evaluate({ x: 3 })).toBe(9);
  });

  it('#733 subset(matrix, index) reads elements', () => {
    const mt = create(all);
    const mj = mjCreate(mjAll);
    const A = mt.matrix([
      [1, 2],
      [3, 4],
    ]);
    const B = mj.matrix([
      [1, 2],
      [3, 4],
    ]);
    expect(mj.subset(B, mj.index(0, 1))).toBe(2);
    expect(mt.subset(A, mt.index(0, 1))).toBe(2);
    expect(mt.subset(A, mt.index(1, 1))).toBe(4);
  });

  it('#734 JSON reviver round-trips Unit and BigNumber', () => {
    const mt = create(all);
    const mj = mjCreate(mjAll);
    function roundtrip(m: { reviver: (k: string, v: unknown) => unknown }, v: unknown) {
      return JSON.parse(JSON.stringify(v), m.reviver);
    }
    const uMj = roundtrip(mj, mj.unit(5, 'cm'));
    const uMt = roundtrip(mt, mt.unit(5, 'cm'));
    expect(String(uMj)).toBe('5 cm');
    expect(String(uMt)).toBe('5 cm');
    expect(isUnit(uMt)).toBe(true);

    const bMj = roundtrip(mj, mj.bignumber('0.1'));
    const bMt = roundtrip(mt, mt.bignumber('0.1'));
    expect(String(bMj)).toBe('0.1');
    expect(String(bMt)).toBe('0.1');
    expect(isBigNumber(bMt)).toBe(true);

    const cMt = roundtrip(mt, mt.complex(1, 2)) as Complex;
    expect(cMt.re).toBe(1);
    expect(cMt.im).toBe(2);

    const fMt = roundtrip(mt, mt.fraction(1, 3)) as Fraction;
    expect(fMt.toString()).toBe('1/3');
  });

  it('G22 — instance import/typed/compile stay out of safe evaluate', () => {
    const mt = create(all);
    expect(() => mt.evaluate('import')).toThrow(/Undefined symbol "import"/);
    expect(() => mt.evaluate('typed')).toThrow(/Undefined symbol "typed"/);
    expect(() => mt.evaluate('compile')).toThrow(/Undefined symbol "compile"/);
    mt.import(
      {
        parse: () => 'leaked',
        typed: () => 'leaked',
        compile: () => 'leaked',
        import: () => 'leaked',
      },
      { override: true }
    );
    expect((mt.parse as () => string)()).toBe('leaked');
    expect(() => mt.evaluate('parse("1+1")')).toThrow();
    expect(mt.evaluate('parse("1+1")', {}, { unsafe: true })).not.toBe('leaked');
    expect(() => mt.evaluate('map([1], x ? parse : 0)')).toThrow(/Undefined symbol parse/);
    const unsafeParsed = mt.evaluate('parse("1+1")', {}, { unsafe: true }) as {
      toString(): string;
    };
    expect(unsafeParsed.toString()).toBe('1 + 1');
  });
});
