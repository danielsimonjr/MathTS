import { describe, it, expect } from 'vitest';
import { type MathJsInstance as OracleInstance } from 'mathjs';
import { create as createCompat } from '../../src/index.js';
import { expectSame } from './differential.js';
import { pair } from './oracle.js';

/**
 * G02 — the compat instance binds the mathjs-shaped factories (#1550, #1583,
 * #1587, #1588). Every row is the captured mathjs 15.3.0 behavior from the
 * issue; `expectSame` compares the compat instance with the oracle.
 */

type Instance = ReturnType<typeof createCompat> & OracleInstance;

const BIG = { number: 'BigNumber' } as const;

type Row = [string, (L: Instance) => unknown];

/** The rows of the #1550 repro table (plus the zeros/ones rows of the pool). */
const TABLE_ROWS: Row[] = [
  ['ceil(3.14159, 2)', (L) => L.ceil(3.14159, 2)],
  ['floor(3.14159, 2)', (L) => L.floor(3.14159, 2)],
  ['fix(-3.14159, 2)', (L) => L.fix(-3.14159, 2)],
  ['floor(unit, unit)', (L) => L.floor(L.unit('3.241 cm'), L.unit('cm'))],
  ['evaluate ceil (expression path)', (L) => L.evaluate('ceil(3.14159, 2)')],
  ['identity(2, 3)', (L) => L.identity(2, 3)],
  ['identity(7, 2)', (L) => L.identity(7, 2)],
  ['identity()', (L) => L.identity()],
  ['identity([2, 3])', (L) => L.identity([2, 3])],
  ['ones(2)', (L) => L.ones(2)],
  ['zeros(2)', (L) => L.zeros(2)],
  ['unaryMinus(unit)', (L) => L.unaryMinus(L.unit('5 cm'))],
  ['unaryPlus(unit)', (L) => L.unaryPlus(L.unit('5 cm'))],
  ['sign(unit)', (L) => L.sign(L.unit('-5 cm'))],
  ['max(unit, unit)', (L) => L.max(L.unit('5 cm'), L.unit('2 inch'))],
  ['min(unit)', (L) => L.min(L.unit('5 cm'))],
  ['max(complex)', (L) => L.max(L.complex(1, 2))],
  ['sum(true)', (L) => L.sum(true)],
  ['max(true)', (L) => L.max(true)],
  ['variance(arr, arr)', (L) => (L.variance as (...a: unknown[]) => unknown)([1, 2, 3], [4, 5, 6])],
  ['std(a, 0, 1)', (L) => (L.std as (...a: unknown[]) => unknown)([1, 2, 3], 0, 1)],
  [
    'std(matrix, matrix)',
    (L) =>
      (L.std as (...a: unknown[]) => unknown)(
        L.matrix([
          [1, 2],
          [3, 4],
        ]),
        L.matrix([
          [5, 6],
          [7, 8],
        ])
      ),
  ],
  ['std(complex, 2)', (L) => (L.std as (...a: unknown[]) => unknown)(L.complex(1, 2), 2)],
  ['variance(complex, 2)', (L) => (L.variance as (...a: unknown[]) => unknown)(L.complex(1, 2), 2)],
  ['nthRoot(arr, arr)', (L) => (L.nthRoot as (...a: unknown[]) => unknown)([1, 2, 3], [4, 5, 6])],
  ['compare(fraction, fraction)', (L) => L.compare(L.fraction(1, 3), L.fraction(1, 4))],
  ['compare(bignumber, bignumber)', (L) => L.compare(L.bignumber(7), L.bignumber(2))],
  ['arg(bignumber)', (L) => L.arg(L.bignumber('2.5'))],
  [
    'mad(matrix, matrix)',
    (L) =>
      (L.mad as (...a: unknown[]) => unknown)(
        L.matrix([
          [1, 2],
          [3, 4],
        ]),
        L.matrix([
          [5, 6],
          [7, 8],
        ])
      ),
  ],
];

/** The #1587 arity / type rows. */
const ARITY_ROWS: Row[] = [
  ['add(2)', (L) => (L.add as (...a: unknown[]) => unknown)(2)],
  ['multiply(2)', (L) => (L.multiply as (...a: unknown[]) => unknown)(2)],
  ['size(2, 3)', (L) => (L.size as (...a: unknown[]) => unknown)(2, 3)],
  ['transpose(2, 3)', (L) => (L.transpose as (...a: unknown[]) => unknown)(2, 3)],
  ['bignumber(2, 3)', (L) => (L.bignumber as (...a: unknown[]) => unknown)(2, 3)],
  ['det(2, 3)', (L) => (L.det as (...a: unknown[]) => unknown)(2, 3)],
  ['inv(2, 3)', (L) => (L.inv as (...a: unknown[]) => unknown)(2, 3)],
  [
    'sin(fraction(1,3))',
    (L) =>
      (L.sin as (x: unknown) => unknown)((L.fraction as (n: number, d: number) => unknown)(1, 3)),
  ],
];

// The trigonometric / log / exp functions whose Fraction argument mathjs
// rejects through its Fraction→BigNumber conversion guard (#1587).
const FRACTION_REJECTED = [
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atanh',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'acot',
  'acoth',
  'acsc',
  'asec',
  'asech',
  'csch',
  'csc',
  'sec',
  'sech',
  'cot',
  'coth',
  'log',
  'log10',
  'log2',
  'exp',
];

describe('G02 factory binding (#1550)', () => {
  it.each(TABLE_ROWS.map((row) => row.slice(0, 1) as unknown as [string]) as [string][])(
    '%s matches the oracle',
    (label) => {
      const run = TABLE_ROWS.find((row) => row[0] === label)?.[1];
      expect(run).toBeDefined();
      expectSame(label, undefined, run as unknown as (L: Record<string, unknown>) => unknown);
    }
  );

  it('std of a Complex keeps the Complex on the named export too', () => {
    const { mathjs, compat } = pair({});
    const mrec = mathjs as unknown as Record<string, (...args: unknown[]) => unknown>;
    const crec = compat as unknown as Record<string, (...args: unknown[]) => unknown>;
    expect(compat.typeOf(crec.std(crec.complex(1, 2), 2))).toBe(
      mathjs.typeOf(mrec.std(mrec.complex(1, 2), 2))
    );
  });
});

describe('G02 arity and type rejections (#1587)', () => {
  it.each(ARITY_ROWS.map((row) => row.slice(0, 1) as unknown as [string]) as [string][])(
    '%s matches the oracle',
    (label) => {
      const run = ARITY_ROWS.find((row) => row[0] === label)?.[1];
      expect(run).toBeDefined();
      expectSame(label, undefined, run as unknown as (L: Record<string, unknown>) => unknown);
    }
  );

  it('BigNumber-config erf(0.2) through evaluate throws like mathjs', () => {
    expectSame('erf(0.2) under BigNumber', BIG, (L) =>
      (L.evaluate as (expr: string) => unknown)('erf(0.2)')
    );
  });

  it('count of a boolean is the string length', () => {
    const { mathjs, compat } = pair({});
    const crec = compat as unknown as Record<string, (x: unknown) => unknown>;
    const mrec = mathjs as unknown as Record<string, (x: unknown) => unknown>;
    expect(crec.count(true)).toBe(4);
    expect(crec.count(false)).toBe(5);
    expect(mrec.count(true)).toBe(4);
    expect(mrec.count(false)).toBe(5);
  });

  it.each(FRACTION_REJECTED)('%s(fraction(1,3)) throws the mathjs conversion error', (name) => {
    const { mathjs, compat } = pair({});
    const run = (rec: Record<string, unknown>): unknown =>
      (rec[name] as (...args: unknown[]) => unknown)(
        (rec.fraction as (n: number, d: number) => unknown)(1, 3)
      );
    const oracleOutcome = outcomeOf(mathjs, run);
    const compatOutcome = outcomeOf(compat, run);
    expect(compatOutcome).toEqual(oracleOutcome);
  });
});

function outcomeOf(
  lib: { typeOf(v: unknown): string; format(v: unknown, o: { precision: number }): string },
  run: (rec: Record<string, unknown>) => unknown
): string {
  try {
    const v = run(lib as unknown as Record<string, unknown>);
    return lib.typeOf(v) + ' ' + lib.format(v, { precision: 14 });
  } catch (e) {
    return 'throws ' + (e as Error).message;
  }
}

describe('G02 expm (#1588)', () => {
  it('expm of an Array is a DenseMatrix', () => {
    const { mathjs, compat } = pair({});
    const crec = compat as unknown as Record<string, (...args: unknown[]) => unknown>;
    const mrec = mathjs as unknown as Record<string, (...args: unknown[]) => unknown>;
    const r = crec.expm([
      [0, 2],
      [0, 0],
    ]) as { isMatrix?: boolean };
    expect(r.isMatrix).toBe(true);
    expect(compat.format(r, { precision: 14 })).toBe(
      mathjs.format(
        mrec.expm([
          [0, 2],
          [0, 0],
        ]),
        { precision: 14 }
      )
    );
    expectSame('expm(matrix input)', undefined, (L) =>
      (L.expm as (x: unknown) => unknown)(
        (L.matrix as (x: unknown) => unknown)([
          [0, 2],
          [0, 0],
        ])
      )
    );
  });
});

describe('G02 mad (#1583)', () => {
  it('mad of two units keeps the unit mathjs keeps', () => {
    expectSame('mad(unit, unit)', undefined, (L) =>
      (L.mad as (x: unknown, y: unknown) => unknown)(
        (L.unit as (v: string) => unknown)('5 cm'),
        (L.unit as (v: string) => unknown)('2 inch')
      )
    );
  });

  it('mad of a unit list keeps the unit', () => {
    expectSame('mad(unit list)', undefined, (L) =>
      (L.mad as (x: unknown) => unknown)([
        (L.unit as (v: string) => unknown)('1 m'),
        (L.unit as (v: string) => unknown)('2 m'),
        (L.unit as (v: string) => unknown)('4 m'),
      ])
    );
  });

  it('mad of a mixed bigint list computes in numbers', () => {
    expectSame('mad(bigint, 0)', undefined, (L) => (L.mad as (...a: unknown[]) => unknown)(2n, 0));
  });

  it('mad of a bigint list stays a bigint', () => {
    expectSame('mad(bigint, bigint)', undefined, (L) =>
      (L.mad as (...a: unknown[]) => unknown)(2n, 3n)
    );
  });
});
