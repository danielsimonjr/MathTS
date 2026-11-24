import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import * as compat from '../src/index.js';

const { create, createSin, sinDependencies } = compat;

describe('native compatibility dependency bundles', () => {
  it('chains selected functions and functions imported later', () => {
    const actual = create({
      chainDependencies: compat.chainDependencies,
      sinDependencies,
      subtractDependencies: compat.subtractDependencies,
    });
    const expected = oracle.create({
      chainDependencies: Reflect.get(oracle, 'chainDependencies'),
      sinDependencies: Reflect.get(oracle, 'sinDependencies'),
      subtractDependencies: Reflect.get(oracle, 'subtractDependencies'),
    });
    const double = (value: number) => value * 2;
    actual.import({ double });
    expected.import({ double });
    const applyDouble = (chain: object) =>
      (Reflect.apply(Reflect.get(chain, 'double'), chain, []) as { done(): unknown }).done();
    expect(applyDouble(actual.chain(0.5).sin())).toBe(applyDouble(expected.chain(0.5).sin()));
    expect(actual.chain(7).subtract(4).done()).toBe(expected.chain(7).subtract(4).done());
    expect(compat.createChainClass.dependencies).toEqual(
      Reflect.get(oracle, 'createChainClass').dependencies
    );
  });

  it('constructs and revives a selected ResultSet', () => {
    const selected = create({ ResultSetDependencies: compat.ResultSetDependencies });
    const result = new selected.ResultSet([2, 'three']);
    const OracleResultSet = Reflect.get(oracle, 'ResultSet');
    const expected = new OracleResultSet([2, 'three']);
    expect(result.toString()).toBe(expected.toString());
    expect(result.toJSON()).toEqual(expected.toJSON());
    expect(selected.ResultSet.fromJSON(result.toJSON()).valueOf()).toEqual(expected.valueOf());
  });

  it('matches number word-size validation and JSON revival', () => {
    const selected = create({ numberDependencies: compat.numberDependencies });
    const number = Reflect.get(selected, 'number');
    expect(() => number('0x100i8')).toThrow('String "0x100" is out of range');
    expect(Reflect.get(number, 'fromJSON')({ value: '2.3' })).toBe(2.3);
  });

  it('uses the supplied integer predicate when validating a slice dimension', () => {
    const mapSlices = compat.createMapSlices({ typed: compat.typed, isInteger: () => false });
    expect(() => mapSlices([1, 2], 0, () => 0)).toThrow('Integer number expected for dimension');
  });

  it('matches the selected MathJS mode error for an empty input', () => {
    const selected = create({ modeDependencies: compat.modeDependencies });
    expect(() => Reflect.get(selected, 'mode')([])).toThrow(
      'Cannot calculate mode of an empty array'
    );
  });

  it('reads an indexed subset like MathJS', () => {
    const upstreamBundle = Reflect.get(oracle, 'subsetDependencies') as Parameters<
      typeof oracle.create
    >[0];
    const actual = create({ subsetDependencies: compat.subsetDependencies });
    const expected = oracle.create({ subsetDependencies: upstreamBundle } as typeof upstreamBundle);
    expect(Object.keys(compat.subsetDependencies)).toEqual(Object.keys(upstreamBundle));
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    expect(compat.createSubset.dependencies).toEqual(
      Reflect.get(oracle, 'createSubset').dependencies
    );
    expect(Reflect.get(actual, 'subset')([3, 4], compat.index(1))).toEqual(
      expected.subset([3, 4], oracle.index(1))
    );
  });

  it('can create a minimal sine instance using only compat imports', () => {
    const upstreamBundle = Reflect.get(oracle, 'sinDependencies') as Parameters<
      typeof oracle.create
    >[0];
    const math = create({ sinDependencies });
    const upstream = oracle.create({ sinDependencies: upstreamBundle } as typeof upstreamBundle);
    expect(Object.keys(math).sort()).toEqual(Object.keys(upstream).sort());
    expect(createSin.dependencies).toEqual(['typed']);
    expect(math.sin(0.5)).toBe(upstream.sin(0.5));
    const upstreamSin = upstream.sin as (value: unknown) => unknown;
    expect(() => upstreamSin([0, 0.5])).toThrow(TypeError);
    expect(() => math.sin([0, 0.5])).toThrow(TypeError);
  });

  it('passes the selected instance configuration to inverse trig factories', () => {
    const upstreamBundle = Reflect.get(oracle, 'acosDependencies') as Parameters<
      typeof oracle.create
    >[0];
    const expected = oracle.create({ acosDependencies: upstreamBundle } as typeof upstreamBundle);
    const actual = create({ acosDependencies: compat.acosDependencies });
    const { re, im } = expected.acos(2) as { re: number; im: number };
    expect(actual.acos(2)).toMatchObject({ re, im });

    const predictable = create(
      { acosDependencies: compat.acosDependencies },
      { predictable: true }
    );
    expect(predictable.acos(2)).toBeNaN();
  });

  it('uses the injected Complex constructor for negative real roots', () => {
    class TracedComplex extends compat.Complex {}
    const selectedSqrt = compat.createSqrt({
      Complex: TracedComplex,
      config: { predictable: false },
      typed: compat.typed,
    });
    const root = selectedSqrt(-4);
    expect(root).toBeInstanceOf(TracedComplex);
    expect(root).toMatchObject({ re: 0, im: 2 });
  });

  it('negates Booleans as numbers even with BigNumber selected', () => {
    const actual = create(
      { unaryMinusDependencies: compat.unaryMinusDependencies },
      { number: 'BigNumber' }
    );
    const expected = oracle.create(oracle.all, { number: 'BigNumber' });
    expect(Reflect.get(actual, 'unaryMinus')(false)).toBe(
      expected.unaryMinus(false as unknown as number)
    );
    expect(Reflect.get(actual, 'unaryMinus')(true)).toBe(
      expected.unaryMinus(true as unknown as number)
    );
  });

  it('adds selected dense and sparse matrices like MathJS', () => {
    const upstreamBundle = Reflect.get(oracle, 'addDependencies') as Parameters<
      typeof oracle.create
    >[0];
    const actual = create({ addDependencies: compat.addDependencies });
    const expected = oracle.create({ addDependencies: upstreamBundle } as typeof upstreamBundle);
    const left = [
      [1, 0],
      [0, 2],
    ];
    const right = [
      [0, 3],
      [0, 4],
    ];
    const result = actual.add(actual.matrix(left, 'dense'), actual.matrix(right, 'sparse'));
    const reference = expected.add(
      expected.matrix(left, 'dense'),
      expected.matrix(right, 'sparse')
    );
    expect((result as { valueOf(): unknown }).valueOf()).toEqual(reference.valueOf());
  });

  it('honors a substituted addScalar factory dependency', () => {
    const math = create({ addDependencies: compat.addDependencies });
    math.import(
      { addScalar: (left: number, right: number) => left + right + 10 },
      { override: true }
    );
    expect(math.add(1, 2)).toBe(13);
  });

  it('rejects extra arguments in selected subtraction', () => {
    const math = create({ subtractDependencies: compat.subtractDependencies });
    const subtract = math.subtract as (...args: unknown[]) => unknown;
    expect(() => subtract(9, 2, 1)).toThrow(TypeError);
  });

  it.each([
    ['acos', [0.5]],
    ['acosh', [2]],
    ['acot', [0.5]],
    ['acoth', [2]],
    ['acsc', [2]],
    ['acsch', [0.5]],
    ['asec', [2]],
    ['asech', [0.5]],
    ['asin', [0.5]],
    ['asinh', [0.5]],
    ['atan', [0.5]],
    ['atanh', [0.5]],
    ['cos', [0.5]],
    ['cosh', [0.5]],
    ['cot', [0.5]],
    ['coth', [0.5]],
    ['csc', [0.5]],
    ['csch', [0.5]],
    ['sec', [0.5]],
    ['sech', [0.5]],
    ['sin', [0.5]],
    ['sinh', [0.5]],
    ['tan', [0.5]],
    ['tanh', [0.5]],
    ['abs', [-3.5]],
    ['addScalar', [3, 4]],
    ['arg', [-2]],
    ['bitNot', [6]],
    ['clone', [3]],
    ['conj', [4]],
    ['cube', [3]],
    ['equalScalar', [2, 2]],
    ['erf', [0.5]],
    ['exp', [1]],
    ['expm1', [0.25]],
    ['im', [3]],
    ['isBounded', [2]],
    ['isNaN', [NaN]],
    ['isNegative', [-2]],
    ['isNumeric', [2]],
    ['isPositive', [2]],
    ['isPrime', [23]],
    ['lgamma', [2.5]],
    ['log10', [1000]],
    ['log2', [128]],
    ['multiplyScalar', [3, 4]],
    ['not', [true]],
    ['re', [7]],
    ['square', [7]],
    ['sqrt', [16]],
    ['unaryMinus', [true]],
    ['subtractScalar', [3, 4]],
    ['format', [1.23456, { precision: 4 }]],
    ['bin', [10]],
    ['hex', [255]],
    ['oct', [64]],
    ['cbrt', [-27]],
    ['and', [true, false]],
    ['compareNatural', ['file2', 'file10']],
    [
      'ctranspose',
      [
        [
          [1, 2],
          [3, 4],
        ],
      ],
    ],
    ['equalText', ['file', 'file']],
    ['kron', [[[1, 2]], [[3], [4]]]],
    ['leftShift', [3, 2]],
    [
      'mapSlices',
      [
        [
          [1, 2],
          [3, 4],
        ],
        0,
        (values: number[]) => values.length,
      ],
    ],
    ['mode', [[1, 2, 2]]],
    ['number', [['0b11.1', '0xFFi8', true]]],
    ['ceil', [1.2345, 2]],
    ['floor', [-1.2345, 2]],
    ['gcd', [240, 46]],
    ['mod', [-8, 3]],
    ['matrixFromFunction', [[2, 3], ([row, col]: number[]) => row + col]],
    ['setSize', [[3, 2, 3]]],
    ['sort', [[3, 2, 1], 'desc']],
    ['nthRoot', [16, 2]],
    ['nullish', [null, 42]],
    ['partitionSelect', [[3, 1, 2], 1]],
    ['randomInt', [1]],
    ['rightArithShift', [-12, 2]],
    ['rightLogShift', [12, 2]],
    ['round', [1.235, 2]],
    [
      'trace',
      [
        [
          [1, 2],
          [3, 4],
        ],
      ],
    ],
    ['print', ['answer=$x', { x: 42 }]],
    ['pickRandom', [[42]]],
    ['random', [[0]]],
    ['map', [[1, 2], (value: number) => value * 2]],
    ['filter', [[1, 2], (value: number) => value > 1]],
    ['forEach', [[1, 2], () => undefined]],
    [
      'flatten',
      [
        [
          [1, 2],
          [3, 4],
        ],
      ],
    ],
    [
      'size',
      [
        [
          [1, 2],
          [3, 4],
        ],
      ],
    ],
    ['squeeze', [[[1], [2]]]],
    ['getMatrixDataType', [[[1, 2]]]],
    ['typeOf', [[1, 2]]],
    ['bitAnd', [6, 3]],
    ['bitOr', [6, 3]],
    ['bitXor', [6, 3]],
    ['compare', [6, 3]],
    ['compareText', ['a', 'b']],
    [
      'deepEqual',
      [
        [1, 2],
        [1, 2],
      ],
    ],
    [
      'dot',
      [
        [1, 2],
        [3, 4],
      ],
    ],
    [
      'dotMultiply',
      [
        [1, 2],
        [3, 4],
      ],
    ],
    ['hasNumericValue', ['3']],
    ['isFinite', [3]],
    ['isZero', [0]],
    ['lcm', [6, 3]],
    ['largerEq', [6, 3]],
    ['smallerEq', [6, 3]],
    ['unequal', [6, 3]],
    ['or', [false, true]],
    ['xor', [true, true]],
    ['add', [2, 3, 4]],
    ['subtract', [6, 3]],
    ['diag', [[2, 3]]],
    ['identity', [2]],
    [
      'matrixFromColumns',
      [
        [1, 2],
        [3, 4],
      ],
    ],
    [
      'matrixFromRows',
      [
        [1, 2],
        [3, 4],
      ],
    ],
    ['ones', [2, 2]],
    [
      'reshape',
      [
        [1, 2, 3, 4],
        [2, 2],
      ],
    ],
    ['resize', [[[1]], [2, 2], 0]],
    [
      'transpose',
      [
        [
          [1, 2],
          [3, 4],
        ],
      ],
    ],
    ['zeros', [2, 2]],
  ] as const)('%s has a native dependency bundle matching MathJS', (name, args) => {
    const bundleName = name + 'Dependencies';
    const factoryName = 'create' + name[0].toUpperCase() + name.slice(1);
    const bundle = Reflect.get(compat, bundleName) as Record<string, unknown>;
    const upstreamBundle = Reflect.get(oracle, bundleName) as Parameters<typeof oracle.create>[0];
    const math = create({ [bundleName]: bundle });
    const upstream = oracle.create({ [bundleName]: upstreamBundle } as typeof upstreamBundle);
    expect(Object.keys(bundle)).toEqual(Object.keys(upstreamBundle));
    expect(Object.keys(math).sort()).toEqual(Object.keys(upstream).sort());
    expect(Reflect.get(compat, factoryName).dependencies).toEqual(
      Reflect.get(oracle, factoryName).dependencies
    );

    const actualFn = Reflect.get(math, name) as (...values: unknown[]) => unknown;
    const upstreamFn = Reflect.get(upstream, name) as (...values: unknown[]) => unknown;
    const result = actualFn(...args);
    const expected = upstreamFn(...args);
    if (typeof result === 'number' && typeof expected === 'number' && Number.isFinite(expected)) {
      expect(result).toBeCloseTo(expected, 14);
    } else if (compat.isMatrix(result) && oracle.isMatrix(expected)) {
      expect(result.valueOf()).toEqual(expected.valueOf());
    } else {
      expect(result).toEqual(expected);
    }
  });
});
