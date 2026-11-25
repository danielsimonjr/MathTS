import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import {
  add,
  all,
  arg,
  cbrt,
  combinations,
  compareNatural,
  compareNaturalDependencies,
  compareText,
  conj,
  create,
  derivative,
  equalText,
  erf,
  format,
  fraction,
  fractionDependencies,
  im,
  lgamma,
  lgammaDependencies,
  log1p,
  log2,
  median,
  multiply,
  norm,
  pow,
  re,
  round,
  toBest,
  toBestDependencies,
  typeOf,
  typeOfDependencies,
} from '../src/index.js';

describe('named compatibility function imports', () => {
  it('reports the MathJS matrix type names across compatibility entry points', () => {
    const math = create(all);
    const selected = create({ typeOfDependencies });
    const data = [
      [1, 0],
      [0, 2],
    ];
    for (const storage of ['dense', 'sparse'] as const) {
      const matrix = math.matrix(data, storage);
      const expected = oracle.typeOf(oracle.matrix(data, storage));
      expect(typeOf(matrix)).toBe(expected);
      expect(math.typeOf(matrix)).toBe(expected);
      expect(selected.typeOf(matrix)).toBe(expected);
      expect(math.evaluate('typeOf(x)', { x: matrix })).toBe(expected);
    }
    expect(math.evaluate('typeOf(1:3)')).toBe(oracle.evaluate('typeOf(1:3)'));
  });

  it('naturally orders matrix values and uses storage type to break ties', () => {
    const math = create(all);
    const selected = create({ compareNaturalDependencies });
    const array = [
      [1, 0],
      [0, 2],
    ];
    const dense = math.matrix(array, 'dense');
    const sparse = math.matrix(array, 'sparse');
    const referenceDense = oracle.matrix(array, 'dense');
    const referenceSparse = oracle.matrix(array, 'sparse');
    const larger = [
      [1, 0],
      [0, 3],
    ];

    expect(compareNatural(dense, array)).toBe(oracle.compareNatural(referenceDense, array));
    expect(compareNatural([dense], [larger])).toBe(
      oracle.compareNatural([referenceDense], [larger])
    );
    expect(math.compareNatural(sparse, larger)).toBe(
      oracle.compareNatural(referenceSparse, larger)
    );
    expect(selected.compareNatural(dense, sparse)).toBe(
      oracle.compareNatural(referenceDense, referenceSparse)
    );
    expect(math.evaluate('compareNatural(x, y)', { x: dense, y: sparse })).toBe(
      oracle.compareNatural(referenceDense, referenceSparse)
    );
  });

  it.each(['dense', 'sparse'] as const)('formats %s matrices with numeric options', (storage) => {
    const math = create(all);
    const data = [
      [1.2345, 0],
      [0, 2.3456],
    ];
    const matrix = math.matrix(data, storage);
    const expected = oracle.matrix(data, storage);

    expect(matrix.format(3)).toBe(oracle.format(expected, 3));
    expect(format(matrix, 3)).toBe(oracle.format(expected, 3));
    expect(math.format(matrix, { notation: 'fixed', precision: 2 })).toBe(
      oracle.format(expected, { notation: 'fixed', precision: 2 })
    );
    expect(math.evaluate('format(x, 3)', { x: matrix })).toBe(oracle.format(expected, 3));
    expect(matrix.toString()).toBe(expected.toString());
  });

  it.each(['dense', 'sparse'] as const)('swaps %s matrix rows in place', (storage) => {
    const math = create(all);
    const data = [
      [1, 0, 3],
      [0, 2, 4],
      [5, 0, 0],
    ];
    const matrix = math.matrix(data, storage);
    const expected = oracle.matrix(data, storage);

    expect(matrix.swapRows(0, 1)).toBe(matrix);
    expect(matrix.toArray()).toEqual(expected.swapRows(0, 1).toArray());
    expect(matrix.swapRows(1, 1).toArray()).toEqual(expected.toArray());
    expect(() => matrix.swapRows(1, 3)).toThrow('Index out of range');
    expect(() => matrix.swapRows(0.5, 1)).toThrow('Row index must be positive integers');
    expect(matrix.toArray()).toEqual(expected.toArray());
  });

  it('keeps sparse entries in their original columns when swapping with an empty row', () => {
    const data = [
      [1, 0, 3],
      [0, 2, 0],
      [0, 0, 0],
    ];
    for (const [i, j] of [
      [1, 2],
      [2, 1],
    ]) {
      const matrix = create(all).sparse(data);
      const expected = oracle.sparse(data);
      expect(matrix.swapRows(i, j).toArray()).toEqual(expected.swapRows(i, j).toArray());
    }
  });

  it('matches the upstream results across mathematical categories', () => {
    expect(combinations(12, 3)).toBe(oracle.combinations(12, 3));
    expect(log2(16)).toBe(oracle.log2(16));
    expect(median([1, 9, 5])).toBe(oracle.median([1, 9, 5]));
    expect(erf(0.5)).toBeCloseTo(oracle.erf(0.5), 14);
    expect(String(derivative('x^2', 'x'))).toBe(oracle.derivative('x^2', 'x').toString());
  });

  it('accepts string infinity norms for vectors and matrices', () => {
    const vector = [-5, 2, 3];
    for (const p of ['inf', '-inf']) {
      expect(norm(vector, p)).toBe(oracle.norm(vector, p));
    }

    const math = create(all);
    const data = [
      [1, 2],
      [3, 4],
    ];
    const expected = oracle.norm(data, 'inf');
    expect(norm(data, 'inf')).toBe(expected);
    expect(math.norm(math.matrix(data), 'inf')).toBe(expected);
    expect(math.norm(math.sparse(data), 'inf')).toBe(expected);
    expect(math.evaluate('norm([[1, 2], [3, 4]], "inf")')).toBe(expected);
  });

  it('accepts complex values and an optional base for log1p', () => {
    const math = create(all);
    const value = math.complex(1, 2);
    const expected = oracle.log1p(oracle.complex(1, 2));
    const actual = log1p(value);
    expect(actual.re).toBeCloseTo(expected.re, 14);
    expect(actual.im).toBeCloseTo(expected.im, 14);
    expect(log1p(9999, 10)).toBeCloseTo(oracle.log1p(9999, 10), 14);
    expect(math.log1p(9999, 10)).toBeCloseTo(4, 14);
    expect(math.evaluate('log1p(9999, 10)')).toBeCloseTo(4, 14);
    expect(() => log1p([1, 2], 10)).toThrow();
  });

  it('takes cube roots of values with units', () => {
    const math = create(all);
    for (const [value, unit] of [
      [27, 'm'],
      [64, 'cm'],
    ] as const) {
      const expected = oracle.cbrt(oracle.unit(value, unit + '^3'));
      const named = cbrt(math.unit(value, unit + '^3')) as typeof math.speedOfLight;
      const evaluated = math.evaluate('cbrt(' + value + ' ' + unit + '^3)') as typeof named;
      expect(named.toNumeric(unit)).toBeCloseTo(Number(expected.toNumeric(unit)), 12);
      expect(evaluated.toNumeric(unit)).toBeCloseTo(Number(expected.toNumeric(unit)), 12);
    }
  });

  it('rounds units after converting to the requested target unit', () => {
    const math = create(all);
    const target = math.unit('cm');
    const oracleTarget = oracle.unit('cm');
    const value = math.unit('3.241 cm');
    const oracleValue = oracle.unit('3.241 cm');
    const rounded = round(value, 2, target) as typeof math.speedOfLight;
    const integral = round(value, target) as typeof math.speedOfLight;
    expect(integral.toNumeric('cm')).toBeCloseTo(
      Number(oracle.round(oracleValue, oracleTarget).toNumeric('cm')),
      14
    );
    expect(rounded.toNumeric('cm')).toBeCloseTo(
      Number(oracle.round(oracleValue, 2, oracleTarget).toNumeric('cm')),
      14
    );
    expect(String(math.evaluate('round(3.241 cm, 2, cm)'))).toBe('3.24 cm');
    expect(String(round([value, math.unit('2.178 cm'), 0], 2, target))).toBe('3.24 cm,2.18 cm,0');
  });

  it('allows preferred units and an offset in toBest', () => {
    const math = create(all);
    const value = math.unit(10, 'm') as typeof math.speedOfLight;
    const expected = oracle.unit(10, 'm');
    const options = { offset: 1.5 };
    const oracleToBest = oracle.toBest as unknown as (
      value: typeof expected,
      units: string | string[],
      options?: { offset: number }
    ) => typeof expected;
    expect(String(toBest(value, 'cm'))).toBe(String(oracleToBest(expected, ['cm'])));
    expect(String(math.toBest(value, ['mm', 'km'], options))).toBe(
      String(oracleToBest(expected, ['mm', 'km'], options))
    );
    expect(String(math.evaluate('toBest(unit(10, "m"), "mm,km", {offset: 1.5})'))).toBe(
      String(oracleToBest(expected, ['mm', 'km'], options))
    );
  });

  it('naturally orders units by normalized magnitude and dimension', () => {
    const math = create(all);
    for (const [left, right] of [
      ['5 cm', '40 mm'],
      ['1 m', '1000 mm'],
      ['1 m', '1 s'],
    ]) {
      expect(compareNatural(math.unit(left), math.unit(right))).toBe(
        oracle.compareNatural(oracle.unit(left), oracle.unit(right))
      );
    }
    expect(math.evaluate('compareNatural(5cm, 40mm)')).toBe(1);
  });

  it('takes negative integer powers of invertible matrices', () => {
    const math = create(all);
    const values = [
      [1, 2],
      [4, 3],
    ];
    const determinantZero = [
      [1, 2],
      [2, 4],
    ];
    const matrixValues = (matrix: unknown) => (matrix as { valueOf(): unknown }).valueOf();
    const expected = oracle.pow(values, -1);
    expect(pow(values, -1)).toEqual(expected);
    expect(matrixValues(math.pow(math.matrix(values), -1))).toEqual(expected);
    expect(matrixValues(math.pow(math.sparse(values), -1))).toEqual(expected);
    expect(math.pow(values, math.bignumber(-1))).toEqual(expected);
    expect(
      (math.evaluate('pow([[1, 2], [4, 3]], -1)') as { valueOf(): unknown }).valueOf()
    ).toEqual(expected);
    expect(() => pow(determinantZero, -1)).toThrow(/not invertible/);
  });

  it('dispatches named, instance, and expression text comparisons elementwise', () => {
    const math = create(all);
    const labels = ['A', 'B', 'C'];
    expect(compareText('B', labels)).toEqual([1, 0, -1]);
    expect(equalText(labels, 'B')).toEqual([false, true, false]);
    expect(math.compareText('B', labels)).toEqual([1, 0, -1]);
    expect(math.equalText(labels, 'B')).toEqual([false, true, false]);
    const expression = 'compareText("B", ["A","B","C"])';
    expect((math.evaluate(expression) as { valueOf(): unknown }).valueOf()).toEqual(
      oracle.evaluate(expression).valueOf()
    );
    expect(() => compareText(1, '1')).toThrow(TypeError);
  });

  it('converts numeric strings for scalar and expression addition', () => {
    const math = create(all);
    expect(add('2.3', '4')).toBe(6.3);
    expect(math.add('2', 3, '4')).toBe(9);
    expect(math.evaluate('"2.3" + "4"')).toBe(6.3);
    expect(() => add('abc', '4')).toThrow(/Cannot convert "abc" to a number/);
  });

  it('uses the MathJS default prefix offset in each compatibility entry point', () => {
    const math = create(all);
    const selected = create({ toBestDependencies });
    const value = math.unit(0.000000123, 'A') as typeof math.speedOfLight;
    const expression = 'toBest(unit(0.000000123, "A"))';
    const expected = String(oracle.evaluate(expression));
    expect(String(toBest(value))).toBe(expected);
    expect(String(math.toBest(value))).toBe(expected);
    expect(String(selected.toBest(value))).toBe(expected);
    expect(String(math.evaluate(expression))).toBe(expected);
    expect(String(toBest(value, [], { offset: 0 }))).toBe('0.123 uA');
  });

  it('matches the MathJS approximation of floating-point fractions', () => {
    const math = create(all);
    const selected = create({ fractionDependencies });
    const input = -Math.sqrt(10);
    const expected = oracle.fraction(input);
    for (const actual of [fraction(input), math.fraction(input), selected.fraction(input)]) {
      expect(actual.numerator).toBe(expected.s * expected.n);
      expect(actual.denominator).toBe(expected.d);
    }
    expect(String(math.evaluate('fraction(sqrt(10))'))).toBe(
      oracle.fraction(Math.sqrt(10)).toFraction()
    );
  });

  it('converts numeric strings in multiplication and alongside collections', () => {
    const math = create(all);
    const product: number = multiply('5', '2');
    const sum: number = add('2', 3, '4');
    const instanceSum: number = math.add('2', 3, '4');
    expect(product).toBe(10);
    expect(sum).toBe(9);
    expect(instanceSum).toBe(sum);
    expect(multiply('5', 2, '3')).toBe(30);
    expect(math.multiply('5', 2)).toBe(10);
    expect(math.evaluate('"5" * "2"')).toBe(10);
    expect(add([1, 2], '3')).toEqual([4, 5]);
    expect(multiply([1, 2], '3')).toEqual([3, 6]);
    expect(() => multiply('abc', '2')).toThrow(/Cannot convert "abc" to a number/);
  });

  it('accepts MathJS mixed, repeating, and colon fraction notation', () => {
    const math = create(all);
    const selected = create({ fractionDependencies });
    for (const text of ['2 1/3', '-2 1/3', "1.2'34'", '2:3']) {
      const expected = oracle.fraction(text);
      const evaluated = math.evaluate(`fraction("${text}")`) as ReturnType<typeof fraction>;
      for (const actual of [fraction(text), selected.fraction(text), evaluated]) {
        expect(actual.numerator).toBe(expected.s * expected.n);
        expect(actual.denominator).toBe(expected.d);
      }
    }
    expect(fraction('1e4').numerator).toBe(10000n);
  });

  it('dispatches complex projections over real numbers and collections', () => {
    const math = create(all);
    expect(conj(5)).toBe(oracle.conj(5));
    expect(arg(-5)).toBe(oracle.arg(-5));
    expect(re([1, math.complex(2, 3)])).toEqual([1, 2]);
    expect(im([1, math.complex(2, 3)])).toEqual([0, 3]);
    expect(String(math.conj(math.fraction('1/3')))).toBe(
      String(oracle.evaluate("conj(fraction('1/3'))"))
    );
    for (const name of ['arg', 'conj', 'im', 're']) {
      const expression = `${name}([1, -2, 2+3i])`;
      const actual = math.evaluate(expression) as { toArray(): unknown[] };
      const expected = oracle.evaluate(expression) as { toArray(): unknown[] };
      expect(actual.toArray().map(String)).toEqual(expected.toArray().map(String));
    }
  });

  it('matches the MathJS real-axis log-gamma domain', () => {
    const math = create(all);
    const selected = create({ lgammaDependencies });
    for (const value of [-Infinity, -3, -0.5, -0, 0, Infinity, NaN]) {
      const expected = oracle.lgamma(value);
      for (const actual of [lgamma(value), math.lgamma(value), selected.lgamma(value)]) {
        expect(actual).toBe(expected);
      }
    }
    expect(math.evaluate('lgamma(-0.5)')).toBeNaN();
    expect(lgamma(math.complex(-0.5, 0))).toMatchObject({ re: NaN, im: 0 });
  });

  it('handles units in roots and powers and complex values in expm1', () => {
    const math = create(all);
    for (const expression of ['sqrt(9 cm^2)', 'square(2 m)', 'cube(2 m)']) {
      expect(String(math.evaluate(expression))).toBe(String(oracle.evaluate(expression)));
    }
    const actual = math.evaluate('expm1(2i)') as { re: number; im: number };
    const expected = oracle.evaluate('expm1(2i)') as { re: number; im: number };
    expect(actual.re).toBeCloseTo(expected.re, 14);
    expect(actual.im).toBeCloseTo(expected.im, 14);
  });
});
