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
    expect(fMt.toString()).toBe('0.(3)');
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
    expect((mt.parse as unknown as () => string)()).toBe('leaked');
    expect(() => mt.evaluate('parse("1+1")')).toThrow();
    expect(mt.evaluate('parse("1+1")', {}, { unsafe: true })).not.toBe('leaked');
    expect(() => mt.evaluate('map([1], x ? parse : 0)')).toThrow(/Undefined symbol parse/);
    const unsafeParsed = mt.evaluate('parse("1+1")', {}, { unsafe: true }) as {
      toString(): string;
    };
    expect(unsafeParsed.toString()).toBe('1 + 1');
  });

  it('G22 — denylist stays unreachable after import (member, unicode, map/filter)', () => {
    const mt = create(all);
    const denied = [
      'import',
      'createUnit',
      'evaluate',
      'parse',
      'compile',
      'typed',
      'simplify',
      'derivative',
      'help',
      'chain',
      'parser',
      'resolve',
    ];
    const planted: Record<string, () => string> = {};
    for (const name of denied) planted[name] = () => 'leaked-' + name;
    mt.import(planted, { override: true });

    for (const name of denied) {
      // `chain` is also the surveyor's-chain unit. The expression language keeps
      // that unit and must not resolve the imported function of the same name.
      if (name === 'chain') {
        const unit = mt.evaluate('chain');
        expect(typeof unit, name).not.toBe('function');
        expect(String(unit), name).toMatch(/chain/i);
      } else {
        expect(() => mt.evaluate(name), name).toThrow(/Undefined symbol/);
      }
      expect(() => mt.evaluate(`map([1], x ? ${name} : 0)`), 'map ' + name).toThrow(
        /Undefined symbol/
      );
      expect(() => mt.evaluate(`filter([1], x ? ${name} : 0)`), 'filter ' + name).toThrow(
        /Undefined symbol/
      );
      const escaped = [...name]
        .map((ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'))
        .join('');
      const viaMember = mt.evaluate(`mathWithTransform["${escaped}"]`);
      expect(viaMember, name).not.toBeTypeOf('function');
      expect(viaMember, name).not.toBe('leaked-' + name);
    }

    const layers = (mt as unknown as { expression: { mathWithTransform: Record<string, unknown> } })
      .expression.mathWithTransform;
    for (const name of denied) {
      expect(Object.prototype.hasOwnProperty.call(layers, name), name).toBe(false);
    }
  });

  it('#730 import override, silent, and wrap match mathjs', () => {
    const mt = create(all);
    const mj = mjCreate(mjAll);

    expect(() => mt.import({ sin: (x: number) => x + 1 })).toThrow(
      /Cannot import "sin": already exists/
    );
    expect(() => mj.import({ sin: (x: number) => x + 1 })).toThrow(
      /Cannot import "sin": already exists/
    );

    mt.import({ sin: (x: number) => x + 1 }, { silent: true });
    mj.import({ sin: (x: number) => x + 1 }, { silent: true });
    expect(mt.sin(0)).toBe(0);
    expect(mj.sin(0)).toBe(0);

    mt.import({ sin: (x: number) => x + 1 }, { override: true });
    mj.import({ sin: (x: number) => x + 1 }, { override: true });
    expect(mt.sin(0)).toBe(1);
    expect(mj.sin(0)).toBe(1);

    const mtWrap = create(all);
    const mjWrap = mjCreate(mjAll);
    const read = (x: { valueOf?: () => unknown } | number): unknown =>
      x && typeof x === 'object' && typeof x.valueOf === 'function' ? x.valueOf() : x;
    mtWrap.import({ read }, { wrap: true });
    mjWrap.import({ read }, { wrap: true });
    const mtUnit = mtWrap.unit(5, 'cm');
    const mjUnit = mjWrap.unit(5, 'cm');
    expect((mtWrap as unknown as { read: (x: unknown) => unknown }).read(mtUnit)).toEqual(
      (mjWrap as unknown as { read: (x: unknown) => unknown }).read(mjUnit)
    );
  });

  it('#731 typed rejects a missing signature the way mathjs does', () => {
    const mt = create(all);
    const mj = mjCreate(mjAll);
    const fMt = mt.typed('onlyNum', { number: (x: number) => x + 1 }) as (x: unknown) => unknown;
    const fMj = mj.typed('onlyNum', { number: (x: number) => x + 1 });
    expect(fMt(2)).toBe(3);
    expect(fMj(2)).toBe(3);
    expect(() => fMt('a')).toThrow();
    expect(() => fMj('a')).toThrow();
    const mtIs = mt.typed as unknown as { isTypedFunction(value: unknown): boolean };
    const mjIs = mj.typed as unknown as { isTypedFunction(value: unknown): boolean };
    expect(mtIs.isTypedFunction(fMt)).toBe(true);
    expect(mjIs.isTypedFunction(fMj)).toBe(true);
  });

  it('#732 compile is the same function as compileExpr', () => {
    const mt = create(all);
    expect(mt.compile).toBe((mt as unknown as { compileExpr: unknown }).compileExpr);
  });

  it('#733 subset assignment matches mathjs and leaves the original', () => {
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
    const outMt = mt.subset(A, mt.index(0, 1), 9) as { toArray(): number[][] };
    const outMj = mj.subset(B, mj.index(0, 1), 9) as { toArray(): number[][] };
    expect(outMt.toArray()).toEqual(outMj.toArray());
    expect((A as { toArray(): number[][] }).toArray()).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('#733 det(math.sparse) matches mathjs; native SparseMatrix still throws', () => {
    const mt = create(all);
    const mj = mjCreate(mjAll);
    const data = [
      [2, 0],
      [0, 3],
    ];
    expect(mt.det(mt.sparse(data))).toBe(mj.det(mj.sparse(data)));
    expect(mt.det(mt.matrix(data, 'sparse'))).toBe(6);
  });

  it('#734 reviver round-trips DenseMatrix, SparseMatrix, and BigNumber precision', () => {
    const mt = create(all);
    function roundtrip(v: unknown): unknown {
      return JSON.parse(JSON.stringify(v), mt.reviver);
    }
    const dense = mt.matrix([
      [1, 2],
      [3, 4],
    ]);
    const denseBack = roundtrip(dense) as { toArray(): number[][]; subset: unknown };
    expect(denseBack.toArray()).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(typeof denseBack.subset).toBe('function');

    const sparse = mt.sparse([
      [1, 0],
      [0, 4],
    ]);
    const sparseBack = roundtrip(sparse) as { toArray(): number[][]; get(i: number[]): number };
    expect(sparseBack.toArray()).toEqual([
      [1, 0],
      [0, 4],
    ]);
    expect(sparseBack.get([1, 1])).toBe(4);

    const digits = '1.23456789012345678901234567890123456789';
    const big = mt.bignumber(digits);
    const bigBack = roundtrip(big) as { toString(): string };
    expect(bigBack.toString()).toBe((big as { toString(): string }).toString());
    expect(bigBack.toString()).toBe(digits);
  });
});
