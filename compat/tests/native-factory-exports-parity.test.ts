import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import * as compat from '../src/index.js';

const { create, createSin, sinDependencies } = compat;

describe('native compatibility dependency bundles', () => {
  it('computes selected matrix exponentials and numeric zeta values', () => {
    const actual = create({
      expmDependencies: compat.expmDependencies,
      zetaDependencies: compat.zetaDependencies,
      sparseDependencies: compat.sparseDependencies,
    });
    const expected = oracle.create({
      expmDependencies: Reflect.get(oracle, 'expmDependencies'),
      zetaDependencies: Reflect.get(oracle, 'zetaDependencies'),
      sparseDependencies: Reflect.get(oracle, 'sparseDependencies'),
    });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    const run = (instance: object) => {
      const call = (name: string, ...args: unknown[]) =>
        Reflect.apply(Reflect.get(instance, name), instance, args);
      const input = call('sparse', [
        [0, 2],
        [0, 0],
      ]);
      const result = call('expm', input) as { storage(): string; valueOf(): number[][] };
      return { matrix: result.valueOf(), storage: result.storage(), zeta: Number(call('zeta', 5)) };
    };
    const result = run(actual);
    const upstream = run(expected);
    expect(result.storage).toBe(upstream.storage);
    for (const [i, row] of result.matrix.entries()) {
      for (const [j, value] of row.entries()) expect(value).toBeCloseTo(upstream.matrix[i][j], 12);
    }
    expect(result.zeta).toBeCloseTo(upstream.zeta, 6);
  });

  it('computes selected eigenvalues and reconstructs a Schur decomposition', () => {
    const actual = create({ lyapDependencies: compat.lyapDependencies });
    const expected = oracle.create({ lyapDependencies: Reflect.get(oracle, 'lyapDependencies') });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    const run = (instance: object) => {
      const call = (name: string, ...args: unknown[]) =>
        Reflect.apply(Reflect.get(instance, name), instance, args);
      const values = (
        call('eigs', [
          [2, 1],
          [1, 2],
        ]) as { values: number[] }
      ).values;
      const input = [
        [1, 2],
        [0, 3],
      ];
      const { U, T } = call('schur', input) as { U: unknown; T: unknown };
      const reconstructed = call('multiply', call('multiply', U, T), call('transpose', U));
      const rows = Object(reconstructed).valueOf() as number[][];
      for (const [i, row] of rows.entries()) {
        for (const [j, entry] of row.entries()) expect(entry).toBeCloseTo(input[i][j], 12);
      }
      return values;
    };
    const values = run(actual);
    const upstream = run(expected);
    for (const [i, value] of values.entries()) expect(value).toBeCloseTo(upstream[i], 12);
  });

  it('solves selected modular inverses with BigNumber inputs', () => {
    const actual = create({ invmodDependencies: compat.invmodDependencies });
    const expected = oracle.create({
      invmodDependencies: Reflect.get(oracle, 'invmodDependencies'),
    });
    const run = (instance: object, values: unknown[]) =>
      String(Reflect.apply(Reflect.get(instance, 'invmod'), instance, values));
    expect(run(actual, [compat.bignumber(23), compat.bignumber(101)])).toBe(
      run(expected, [oracle.bignumber(23), oracle.bignumber(101)])
    );
  });

  it('reports the same unsupported median dimension as MathJS', () => {
    const actual = create({ medianDependencies: compat.medianDependencies });
    const expected = oracle.create({
      medianDependencies: Reflect.get(oracle, 'medianDependencies'),
    });
    for (const instance of [actual, expected]) {
      expect(() =>
        Reflect.apply(Reflect.get(instance, 'median'), instance, [
          [
            [3, 8],
            [1, 4],
          ],
          0,
        ])
      ).toThrow('median(A, dim) is not yet supported');
    }
  });

  it('transforms and reconstructs selected Fourier spectra', () => {
    const actual = create({ ifftDependencies: compat.ifftDependencies });
    const expected = oracle.create({ ifftDependencies: Reflect.get(oracle, 'ifftDependencies') });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    const run = (instance: object) => {
      const call = (name: string, input: unknown) =>
        Reflect.apply(Reflect.get(instance, name), instance, [input]) as {
          re: number;
          im: number;
        }[];
      const spectrum = call('fft', [1, 3, 2, -1]);
      return [spectrum, call('ifft', spectrum)];
    };
    const result = run(actual);
    const upstream = run(expected);
    for (const [i, vector] of result.entries()) {
      for (const [j, value] of vector.entries()) {
        expect(value.re).toBeCloseTo(upstream[i][j].re, 12);
        expect(value.im).toBeCloseTo(upstream[i][j].im, 12);
      }
    }
  });

  it('solves a selected ordinary differential equation', () => {
    const actual = create({ solveODEDependencies: compat.solveODEDependencies });
    const expected = oracle.create({
      solveODEDependencies: Reflect.get(oracle, 'solveODEDependencies'),
    });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    const solve = (instance: object) => {
      const result = Reflect.apply(Reflect.get(instance, 'solveODE'), instance, [
        (_time: number, value: number) => value,
        [0, 1],
        1,
        { tol: 1e-7 },
      ]) as { t: number[]; y: number[] };
      expect(result.t.at(-1)).toBeCloseTo(1, 8);
      return result.y.at(-1) as number;
    };
    expect(solve(actual)).toBeCloseTo(solve(expected), 5);
  });

  it('uses selected BigNumber precision for gamma and factorial', () => {
    const config = { precision: 8 };
    const actual = create({ factorialDependencies: compat.factorialDependencies }, config);
    const expected = oracle.create(
      {
        factorialDependencies: Reflect.get(oracle, 'factorialDependencies'),
      },
      config
    );
    const run = (instance: object, name: string, value: unknown) =>
      Number(String(Reflect.apply(Reflect.get(instance, name), instance, [value])));
    for (const name of ['gamma', 'factorial']) {
      const result = run(actual, name, compat.bignumber('19'));
      const upstream = run(expected, name, oracle.bignumber('19'));
      expect(result / upstream).toBeCloseTo(1, config.precision - 1);
    }
    expect(run(actual, 'gamma', compat.bignumber('NaN'))).toBe(
      run(expected, 'gamma', oracle.bignumber('NaN'))
    );
    expect(() => run(actual, 'gamma', compat.bignumber('2.5'))).toThrow(
      'Integer BigNumber expected'
    );
  });

  it('simplifies selected expression trees and compares selected symbolic forms', () => {
    const actual = create({
      symbolicEqualDependencies: compat.symbolicEqualDependencies,
      derivativeDependencies: compat.derivativeDependencies,
      rationalizeDependencies: compat.rationalizeDependencies,
      simplifyDependencies: compat.simplifyDependencies,
    });
    const expected = oracle.create({
      symbolicEqualDependencies: Reflect.get(oracle, 'symbolicEqualDependencies'),
      derivativeDependencies: Reflect.get(oracle, 'derivativeDependencies'),
      rationalizeDependencies: Reflect.get(oracle, 'rationalizeDependencies'),
      simplifyDependencies: Reflect.get(oracle, 'simplifyDependencies'),
    });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    const run = (instance: object) => {
      const call = (name: string, ...args: unknown[]) =>
        Reflect.apply(Reflect.get(instance, name), instance, args);
      const node = call('parse', 'x + (2 + 3)');
      return [
        String(call('simplifyCore', node)),
        String(call('simplifyConstant', node)),
        String(call('simplify', 'x + 2 + 3')),
        call('symbolicEqual', 'x + x', '2*x'),
        String(call('derivative', 'x^2', 'x')),
        String(call('rationalize', 'x + 1/2')),
      ];
    };
    expect(run(actual)).toEqual(run(expected));
  });

  it('revives tagged values for selected classes and exposes the local package version', () => {
    const actual = create({
      reviverDependencies: compat.reviverDependencies,
      versionDependencies: compat.versionDependencies,
      bigintDependencies: compat.bigintDependencies,
      numberDependencies: compat.numberDependencies,
      ComplexDependencies: compat.ComplexDependencies,
    });
    const expected = oracle.create({
      reviverDependencies: Reflect.get(oracle, 'reviverDependencies'),
      versionDependencies: Reflect.get(oracle, 'versionDependencies'),
      bigintDependencies: Reflect.get(oracle, 'bigintDependencies'),
      numberDependencies: Reflect.get(oracle, 'numberDependencies'),
      ComplexDependencies: Reflect.get(oracle, 'ComplexDependencies'),
    });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    expect(actual.version).toBe(compat.version);
    expect(expected.version).toBe(oracle.version);
    const json = JSON.stringify([
      { mathjs: 'number', value: 'Infinity' },
      { mathjs: 'bigint', value: '12345678901234567890' },
      { mathjs: 'Complex', re: 3, im: 4 },
      { mathjs: 'Unknown', value: 1 },
    ]);
    const run = (instance: object): unknown[] => JSON.parse(json, Reflect.get(instance, 'reviver'));
    const result = run(actual);
    const upstream = run(expected);
    expect(result.slice(0, 2)).toEqual(upstream.slice(0, 2));
    expect(String(result[2])).toBe(String(upstream[2]));
    expect(result[3]).toEqual(upstream[3]);
  });

  it('opens selected parser scopes and retrieves help using a function reference', () => {
    const actual = create({
      parserDependencies: compat.parserDependencies,
      helpDependencies: compat.helpDependencies,
      addDependencies: compat.addDependencies,
    });
    const expected = oracle.create({
      parserDependencies: Reflect.get(oracle, 'parserDependencies'),
      helpDependencies: Reflect.get(oracle, 'helpDependencies'),
      addDependencies: Reflect.get(oracle, 'addDependencies'),
    });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    const runParser = (instance: object) => {
      const parser = Reflect.apply(Reflect.get(instance, 'parser'), instance, []) as {
        set(name: string, value: unknown): unknown;
        evaluate(expr: string): unknown;
        get(name: string): unknown;
      };
      parser.set('x', 7);
      return [parser.evaluate('x + 3'), parser.get('x')];
    };
    expect(runParser(actual)).toEqual(runParser(expected));
    const helpName = (instance: object) => {
      const doc = Reflect.apply(Reflect.get(instance, 'help'), instance, [
        Reflect.get(instance, 'add'),
      ]) as { toJSON(): { name: string } };
      return doc.toJSON().name;
    };
    expect(helpName(actual)).toBe(helpName(expected));
  });

  it('evaluates selected transforms with MathJS expression semantics', () => {
    const cases = [
      ['and', 'And', 'false and missing'],
      ['bitAnd', 'BitAnd', '0 & missing'],
      ['diff', 'Diff', 'diff([[1, 3], [4, 8]], 2)'],
      ['range', 'Range', '2:4'],
      ['print', 'Print', 'print("$1", [42, 7])'],
      ['subset', 'Subset', 'A[2]'],
      ['index', 'Index', 'A[2]'],
      ['or', 'Or', 'true or missing'],
      ['bitOr', 'BitOr', '1 | 2'],
      ['nullish', 'Nullish', '4 ?? missing'],
      ['column', 'Column', 'column([[1, 2], [3, 4]], 2)'],
      ['row', 'Row', 'row([[1, 2], [3, 4]], 2)'],
      ['concat', 'Concat', 'concat([[1, 2]], [[3, 4]], 1)'],
      ['variance', 'Variance', 'variance([[2, 4], [6, 8]], 1)'],
      ['std', 'Std', 'std([[2, 4], [6, 8]], 2)'],
      ['quantileSeq', 'QuantileSeq', 'quantileSeq([[2, 4], [6, 8]], 0.5, 2)'],
      ['min', 'Min', 'min([[4, 1], [3, 9]], 1)'],
      ['max', 'Max', 'max([[4, 1], [3, 9]], 2)'],
      ['sum', 'Sum', 'sum([[4, 1], [3, 9]], 1)'],
      ['cumsum', 'CumSum', 'cumsum([[4, 1], [3, 9]], 2)'],
      ['mean', 'Mean', 'mean([[4, 1], [3, 9]], 1)'],
      ['mapSlices', 'MapSlices', 'mapSlices([[4, 1], [3, 9]], 2, first)'],
    ] as const;
    const config = { matrix: 'Array' as const };
    const run = (instance: object, expression: string) =>
      Reflect.apply(Reflect.get(instance, 'evaluate'), instance, [
        expression,
        { A: [10, 20], first: (row: unknown[]) => row[0] },
      ]);
    for (const [name, factoryName, expression] of cases) {
      const key = name + 'TransformDependencies';
      const createName = 'create' + factoryName + 'Transform';
      const actualBundle = Reflect.get(compat, key) as Record<string, unknown>;
      const expectedBundle = Reflect.get(oracle, key) as Parameters<typeof oracle.create>[0];
      expect(Object.keys(actualBundle)).toEqual(Object.keys(expectedBundle));
      type TransformFactory = { dependencies: string[]; meta: object };
      const actualFactory = Reflect.get(actualBundle, createName) as TransformFactory;
      const expectedFactory = Reflect.get(
        expectedBundle,
        createName
      ) as unknown as TransformFactory;
      expect(actualFactory.dependencies).toEqual(expectedFactory.dependencies);
      expect(actualFactory.meta).toEqual(expectedFactory.meta);
      const extraKeys =
        name === 'index'
          ? ['subsetTransformDependencies']
          : name === 'subset'
            ? ['indexTransformDependencies']
            : [];
      const extras = (library: object) =>
        Object.fromEntries(extraKeys.map((extraKey) => [extraKey, Reflect.get(library, extraKey)]));
      const actual = create(
        {
          ...extras(compat),
          [key]: actualBundle,
          evaluateDependencies: compat.evaluateDependencies,
        },
        config
      );
      const expected = oracle.create(
        {
          ...extras(oracle),
          [key]: expectedBundle,
          evaluateDependencies: Reflect.get(oracle, 'evaluateDependencies'),
        },
        config
      );
      expect(run(actual, expression)).toEqual(run(expected, expression));
    }
  });

  it('evaluates selected callback transforms with one-based indices', () => {
    const actual = create(
      {
        evaluateDependencies: compat.evaluateDependencies,
        addDependencies: compat.addDependencies,
        largerDependencies: compat.largerDependencies,
        mapTransformDependencies: compat.mapTransformDependencies,
        filterTransformDependencies: compat.filterTransformDependencies,
        forEachTransformDependencies: compat.forEachTransformDependencies,
      },
      { matrix: 'Array' }
    );
    const expected = oracle.create(
      Object.fromEntries(
        ['evaluate', 'add', 'larger', 'mapTransform', 'filterTransform', 'forEachTransform'].map(
          (name) => {
            const key = name + 'Dependencies';
            return [key, Reflect.get(oracle, key)];
          }
        )
      ),
      { matrix: 'Array' }
    );
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());

    const evaluate = (instance: object, expression: string, scope: object = {}) =>
      Reflect.apply(Reflect.get(instance, 'evaluate'), instance, [expression, scope]);
    for (const expression of ['map([4, 9], i)', 'filter([3, -2, 5], x > 0)']) {
      expect(evaluate(actual, expression, { i: (_x: unknown, index: unknown) => index })).toEqual(
        evaluate(expected, expression, { i: (_x: unknown, index: unknown) => index })
      );
    }
    const indices = (instance: object) => {
      const out: unknown[] = [];
      evaluate(instance, 'forEach([4, 9], collect)', {
        collect: (_value: unknown, index: unknown) => out.push(index),
      });
      return out;
    };
    expect(indices(actual)).toEqual(indices(expected));
  });

  it('constructs selected ranges and serializes MathJS numeric tags', () => {
    const actual = create({
      RangeDependencies: compat.RangeDependencies,
      replacerDependencies: compat.replacerDependencies,
    });
    const expected = oracle.create({
      RangeDependencies: Reflect.get(oracle, 'RangeDependencies'),
      replacerDependencies: Reflect.get(oracle, 'replacerDependencies'),
    });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());

    const serialize = (instance: object) => {
      const range = Reflect.construct(Reflect.get(instance, 'Range'), [5, -1, -2]) as {
        toArray(): number[];
      };
      return JSON.stringify(
        [range, range.toArray(), Infinity, -Infinity, NaN, 10n],
        Reflect.get(instance, 'replacer')
      );
    };
    expect(serialize(actual)).toBe(serialize(expected));
  });

  it('extracts selected fraction parts from fractions and nested collections', () => {
    const actual = create({
      numDependencies: compat.numDependencies,
      denDependencies: compat.denDependencies,
    });
    const expected = oracle.create({
      numDependencies: Reflect.get(oracle, 'numDependencies'),
      denDependencies: Reflect.get(oracle, 'denDependencies'),
    });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    const run = (instance: object, name: 'num' | 'den', value: unknown) =>
      Reflect.apply(Reflect.get(instance, name), instance, [value]);
    for (const name of ['num', 'den'] as const) {
      expect(run(actual, name, [[compat.fraction('-8/6'), compat.bignumber('0.125')]])).toEqual(
        run(expected, name, [[oracle.fraction('-8/6'), oracle.bignumber('0.125')]])
      );
    }
  });

  it('computes selected combinations with BigNumber inputs', () => {
    const actual = create({
      combinationsDependencies: compat.combinationsDependencies,
      combinationsWithRepDependencies: compat.combinationsWithRepDependencies,
    });
    const expected = oracle.create({
      combinationsDependencies: Reflect.get(oracle, 'combinationsDependencies'),
      combinationsWithRepDependencies: Reflect.get(oracle, 'combinationsWithRepDependencies'),
    });
    for (const name of ['combinations', 'combinationsWithRep']) {
      const result = Reflect.apply(Reflect.get(actual, name), actual, [
        compat.bignumber(12),
        compat.bignumber(4),
      ]);
      const upstream = Reflect.apply(Reflect.get(expected, name), expected, [
        oracle.bignumber(12),
        oracle.bignumber(4),
      ]);
      expect(String(result)).toBe(String(upstream));
    }
  });

  it('compiles selected expressions for repeated evaluation', () => {
    const actual = create({ compileDependencies: compat.compileDependencies });
    const expected = oracle.create({
      compileDependencies: Reflect.get(oracle, 'compileDependencies'),
    });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    const run = (instance: object) => {
      const code = Reflect.apply(Reflect.get(instance, 'compile'), instance, [
        ['x + 2', 'x * 3'],
      ]) as { evaluate(scope: { x: number }): unknown }[];
      return code.map((entry) => [entry.evaluate({ x: 4 }), entry.evaluate({ x: 7 })]);
    };
    expect(run(actual)).toEqual(run(expected));
  });

  it('resolves symbols with the selected MathJS factory', () => {
    const actual = create({ resolveDependencies: compat.resolveDependencies });
    const expected = oracle.create({
      resolveDependencies: Reflect.get(oracle, 'resolveDependencies'),
    });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    const run = (instance: object) => {
      const node = Reflect.apply(Reflect.get(instance, 'parse'), instance, ['a + b']);
      return String(Reflect.apply(Reflect.get(instance, 'resolve'), instance, [node, { a: 4 }]));
    };
    expect(run(actual)).toBe(run(expected));
  });

  it('uses the selected matrix factory for matrix intersections', () => {
    const actual = create({ intersectDependencies: compat.intersectDependencies });
    const expected = oracle.create({
      intersectDependencies: Reflect.get(oracle, 'intersectDependencies'),
    });
    const run = (instance: object) => {
      const points = [
        [0, 0],
        [2, 2],
        [0, 2],
        [2, 0],
      ].map((point) => Reflect.apply(Reflect.get(instance, 'matrix'), instance, [point, 'sparse']));
      return Reflect.apply(Reflect.get(instance, 'intersect'), instance, points) as {
        storage(): string;
        valueOf(): unknown;
      };
    };
    const result = run(actual);
    const upstreamResult = run(expected);
    expect(result.storage()).toBe(upstreamResult.storage());
    expect(result.valueOf()).toEqual(upstreamResult.valueOf());
  });

  it('constructs selected sparse matrices and preserves the requested datatype', () => {
    const actual = create({ sparseDependencies: compat.sparseDependencies });
    const expected = oracle.create({
      sparseDependencies: Reflect.get(oracle, 'sparseDependencies'),
    });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    const matrix = Reflect.apply(Reflect.get(actual, 'sparse'), actual, [[0, 2], 'number']);
    const reference = expected.sparse([0, 2] as unknown as number[][], 'number');
    if (!compat.isMatrix(matrix)) throw new TypeError('Expected a sparse matrix');
    expect(matrix.valueOf()).toEqual(reference.valueOf());
    expect(Reflect.apply(Reflect.get(matrix, 'datatype'), matrix, [])).toBe(reference.datatype());
  });

  it('converts and splits selected units like MathJS', () => {
    const names = [
      'unitDependencies',
      'toDependencies',
      'toBestDependencies',
      'splitUnitDependencies',
    ];
    const actual = create(
      Object.fromEntries(names.map((name) => [name, Reflect.get(compat, name)]))
    );
    const expected = oracle.create(
      Object.fromEntries(names.map((name) => [name, Reflect.get(oracle, name)]))
    );
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    for (const name of names.slice(1)) {
      const bundle = Reflect.get(compat, name);
      expect(Object.keys(bundle)).toEqual(Object.keys(Reflect.get(oracle, name)));
    }
    const run = (instance: object) => {
      const unit = Reflect.get(instance, 'unit')('3661 s');
      const call = (name: string, ...args: unknown[]) =>
        Reflect.apply(Reflect.get(instance, name), instance, args);
      return [
        String(call('to', unit, 'min')),
        String(call('toBest', unit)),
        String(call('splitUnit', unit, ['h', 'min', 's'])),
      ];
    };
    expect(run(actual)).toEqual(run(expected));
  });

  it('computes selected filter frequency bins and complex response', () => {
    const actual = create({ freqzDependencies: compat.freqzDependencies });
    const expected = oracle.create({ freqzDependencies: Reflect.get(oracle, 'freqzDependencies') });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    const run = (instance: object) =>
      Reflect.apply(Reflect.get(instance, 'freqz'), instance, [[1, 0.5], [1], 4]) as {
        w: number[];
        h: { re: number; im: number }[];
      };
    const result = run(actual);
    const upstream = run(expected);
    expect(result.w).toEqual(upstream.w);
    expect(result.h).toHaveLength(upstream.h.length);
    for (const [i, value] of result.h.entries()) {
      expect(value.re).toBeCloseTo(upstream.h[i].re, 12);
      expect(value.im).toBeCloseTo(upstream.h[i].im, 12);
    }
  });

  it('builds selected transfer function coefficients like MathJS', () => {
    const actual = create({ zpk2tfDependencies: compat.zpk2tfDependencies });
    const expected = oracle.create({
      zpk2tfDependencies: Reflect.get(oracle, 'zpk2tfDependencies'),
    });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    const run = (instance: object) =>
      (
        Reflect.apply(Reflect.get(instance, 'zpk2tf'), instance, [[2], [3], 1]) as {
          re: number;
          im: number;
        }[][]
      ).map((row) => row.map(({ re, im }) => [re, im]));
    expect(run(actual)).toEqual(run(expected));
  });

  it('uses selected BigNumber configuration for physical constants', () => {
    const actual = create(
      { planckConstantDependencies: compat.planckConstantDependencies },
      { number: 'BigNumber', precision: 30 }
    );
    const expected = oracle.create(
      { planckConstantDependencies: Reflect.get(oracle, 'planckConstantDependencies') },
      { number: 'BigNumber', precision: 30 }
    );
    const value = Reflect.get(actual, 'planckConstant') as { toNumeric(unit: string): unknown };
    const reference = Reflect.get(expected, 'planckConstant');
    const numeric = value.toNumeric('J s');
    expect(compat.isBigNumber(numeric)).toBe(true);
    const expectedNumeric = reference.toNumeric('J s');
    if (!oracle.isBigNumber(expectedNumeric)) throw new TypeError('Expected a BigNumber constant');
    expect(expectedNumeric.eq(String(numeric))).toBe(true);
  });

  it.each([
    'atomicMass',
    'avogadro',
    'bohrMagneton',
    'bohrRadius',
    'boltzmann',
    'classicalElectronRadius',
    'conductanceQuantum',
    'coulomb',
    'coulombConstant',
    'deuteronMass',
    'efimovFactor',
    'electricConstant',
    'electronMass',
    'elementaryCharge',
    'faraday',
    'fermiCoupling',
    'fineStructure',
    'firstRadiation',
    'gasConstant',
    'gravitationConstant',
    'gravity',
    'hartreeEnergy',
    'inverseConductanceQuantum',
    'klitzing',
    'loschmidt',
    'magneticConstant',
    'magneticFluxQuantum',
    'molarMass',
    'molarMassC12',
    'molarPlanckConstant',
    'molarVolume',
    'neutronMass',
    'nuclearMagneton',
    'planckCharge',
    'planckConstant',
    'planckLength',
    'planckMass',
    'planckTemperature',
    'planckTime',
    'protonMass',
    'quantumOfCirculation',
    'reducedPlanckConstant',
    'rydberg',
    'sackurTetrode',
    'secondRadiation',
    'speedOfLight',
    'stefanBoltzmann',
    'thomsonCrossSection',
    'vacuumImpedance',
    'weakMixingAngle',
    'wienDisplacement',
  ] as const)('creates the selected %s physical constant', (name) => {
    const key = name + 'Dependencies';
    const bundle = Reflect.get(compat, key);
    const referenceBundle = Reflect.get(oracle, key);
    expect(Object.keys(bundle)).toEqual(Object.keys(referenceBundle));
    const factoryName = Object.keys(bundle).find((entry) => entry.startsWith('create'));
    if (!factoryName) throw new Error(`No factory exported for ${name}`);
    expect(Reflect.get(compat, factoryName).dependencies).toEqual(
      Reflect.get(oracle, factoryName).dependencies
    );
    const selected = create({ [key]: bundle });
    const expected = oracle.create({ [key]: referenceBundle });
    expect(Object.keys(selected).sort()).toEqual(Object.keys(expected).sort());
    const value = Reflect.get(selected, name);
    const reference = Reflect.get(expected, name);
    if (oracle.isUnit(reference)) {
      const result = value as { formatUnits(): string; toNumber(unit: string): number };
      const unit = reference.formatUnits();
      expect(result.formatUnits()).toBe(unit);
      expect(result.toNumber(unit) / reference.toNumber(unit)).toBeCloseTo(1, 12);
    } else {
      expect(value).toBe(reference);
    }
  });

  it('shares expression scope across a selected evaluation array', () => {
    const actual = create({
      evaluateDependencies: compat.evaluateDependencies,
      addDependencies: compat.addDependencies,
    });
    const expected = oracle.create({
      evaluateDependencies: Reflect.get(oracle, 'evaluateDependencies'),
      addDependencies: Reflect.get(oracle, 'addDependencies'),
    });
    const expressions = ['x = 3', 'y = 4', 'x + y'];
    expect(Reflect.apply(Reflect.get(actual, 'evaluate'), actual, [expressions])).toEqual(
      expected.evaluate(expressions)
    );
  });

  it('parses expressions with selected nodes and local operations', () => {
    const actual = create({
      parseDependencies: compat.parseDependencies,
      addDependencies: compat.addDependencies,
      indexDependencies: compat.indexDependencies,
    });
    const expected = oracle.create({
      parseDependencies: Reflect.get(oracle, 'parseDependencies'),
      addDependencies: Reflect.get(oracle, 'addDependencies'),
      indexDependencies: Reflect.get(oracle, 'indexDependencies'),
    });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    const node = actual.parse('x = 2 + 3');
    const reference = expected.parse('x = 2 + 3');
    expect(node.toString()).toBe(reference.toString());
    expect(node.evaluate()).toBe(reference.evaluate());

    const actualScope = { a: [1, 2] };
    const expectedScope = { a: [1, 2] };
    expect(actual.parse('a[1] = 7').evaluate(actualScope)).toBe(
      expected.parse('a[1] = 7').evaluate(expectedScope)
    );
    expect(actualScope).toEqual(expectedScope);
  });

  it('converts units and isolates unit registrations in selected instances', () => {
    const actual = create({
      unitDependencies: compat.unitDependencies,
      createUnitDependencies: compat.createUnitDependencies,
    });
    const expected = oracle.create({
      unitDependencies: Reflect.get(oracle, 'unitDependencies'),
      createUnitDependencies: Reflect.get(oracle, 'createUnitDependencies'),
    });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    const name = 'compatMeterPair';
    Reflect.apply(Reflect.get(actual, 'createUnit'), actual, [name, '2 m']);
    expected.createUnit(name, '2 m');
    const unit = actual.unit(`5 ${name}`) as { toNumber(target: string): number };
    expect(unit.toNumber('m')).toBe(expected.unit(`5 ${name}`).toNumber('m'));
    const other = create({ unitDependencies: compat.unitDependencies });
    expect(() => other.unit(`5 ${name}`)).toThrow();
  });

  it('solves selected sparse LU with MathJS permutations', () => {
    const actual = create({ sluDependencies: compat.sluDependencies });
    const expected = oracle.create({ sluDependencies: Reflect.get(oracle, 'sluDependencies') });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    const input = [
      [2, 1],
      [3, 4],
    ];
    const lu = actual.slu(actual.matrix(input, 'sparse'), 0, 1) as ReturnType<typeof oracle.slu>;
    const reference = expected.slu(expected.matrix(input, 'sparse'), 0, 1);
    expect(lu.L.valueOf()).toEqual(reference.L.valueOf());
    expect(lu.U.valueOf()).toEqual(reference.U.valueOf());
    expect(lu.p).toEqual(reference.p);
    expect(lu.q).toEqual(reference.q);
  });

  it.each([
    ['dense', 'sparse'],
    ['sparse', 'dense'],
    ['sparse', 'sparse'],
  ] as const)('multiplies %s and %s storage like MathJS', (leftStorage, rightStorage) => {
    const selected = create({ multiplyDependencies: compat.multiplyDependencies });
    const expected = oracle.create({
      multiplyDependencies: Reflect.get(oracle, 'multiplyDependencies'),
    });
    const a = [
      [1, 0],
      [2, 3],
    ];
    const b = [
      [0, 4],
      [5, 0],
    ];
    const product = Reflect.get(selected, 'multiply')(
      selected.matrix(a, leftStorage),
      selected.matrix(b, rightStorage)
    );
    const reference = expected.multiply(
      expected.matrix(a, leftStorage),
      expected.matrix(b, rightStorage)
    );
    if (!compat.isMatrix(product) || !oracle.isMatrix(reference)) {
      throw new TypeError('Expected matrix multiplication to return matrices');
    }
    expect(compat.isSparseMatrix(product)).toBe(oracle.isSparseMatrix(reference));
    expect(product.valueOf()).toEqual(reference.valueOf());
  });

  it('uses injected scalar operations for dense and sparse multiplication', () => {
    const selected = create({ multiplyDependencies: compat.multiplyDependencies });
    const multiply = compat.createMultiply({
      typed: selected.typed,
      matrix: Reflect.get(selected, 'matrix'),
      addScalar: selected.typed('addScalar', {
        'number, number': (a: number, b: number) => a + b + 1,
      }),
      multiplyScalar: selected.typed('multiplyScalar', {
        'number, number': (a: number, b: number) => 2 * a * b,
      }),
      equalScalar: Reflect.get(selected, 'equalScalar'),
      dot: Reflect.get(selected, 'dot'),
    } as Parameters<typeof compat.createMultiply>[0]);
    expect(multiply([[1, 2]], [[3], [4]])).toEqual([[23]]);
    const sparse = multiply(
      selected.matrix([[1, 2]], 'sparse'),
      selected.matrix([[3], [4]], 'sparse')
    );
    if (!compat.isMatrix(sparse)) throw new TypeError('Expected a sparse product');
    expect(sparse.valueOf()).toEqual([[23]]);
  });

  it('uses the selected numeric configuration when reducing text', () => {
    const math = create(
      { sumDependencies: compat.sumDependencies, prodDependencies: compat.prodDependencies },
      { number: 'BigNumber', precision: 21 }
    );
    const expected = oracle.create(
      {
        sumDependencies: Reflect.get(oracle, 'sumDependencies'),
        prodDependencies: Reflect.get(oracle, 'prodDependencies'),
      },
      { number: 'BigNumber', precision: 21 }
    );
    for (const name of ['sum', 'prod'] as const) {
      const result = Reflect.get(math, name)(['1.25', '2.5']);
      expect(compat.isBigNumber(result)).toBe(true);
      expect(String(result)).toBe(
        String(Reflect.apply(Reflect.get(expected, name), expected, [['1.25', '2.5']]))
      );
    }
  });

  it('matches and loads the entire MathJS dependency bundle catalog', () => {
    const names = Object.keys(oracle).filter((name) => name.endsWith('Dependencies'));
    for (const name of names) {
      const actualBundle = Reflect.get(compat, name) as Record<string, unknown>;
      const expectedBundle = Reflect.get(oracle, name) as Record<string, unknown>;
      expect(Object.keys(actualBundle).sort(), name).toEqual(Object.keys(expectedBundle).sort());
      for (const [key, value] of Object.entries(expectedBundle)) {
        if (typeof value !== 'function') continue;
        for (const property of ['fn', 'dependencies', 'meta']) {
          const actualFactory = actualBundle[key] as object;
          expect(Reflect.get(actualFactory, property), `${name}.${key}.${property}`).toEqual(
            Reflect.get(value, property)
          );
        }
      }
    }
    const actual = create(
      Object.fromEntries(names.map((name) => [name, Reflect.get(compat, name)]))
    );
    const expected = oracle.create(
      Object.fromEntries(names.map((name) => [name, Reflect.get(oracle, name)]))
    );
    const keys = Object.keys(expected).sort();
    expect(Object.keys(actual).sort()).toEqual(keys);
    for (const name of keys) {
      expect(typeof Reflect.get(actual, name), name).toBe(typeof Reflect.get(expected, name));
    }
  });

  it.each(['qr', 'lup'] as const)('creates the selected %s decomposition', (name) => {
    const bundleName = name + 'Dependencies';
    const bundle = Reflect.get(compat, bundleName);
    const referenceBundle = Reflect.get(oracle, bundleName);
    expect(Object.keys(bundle)).toEqual(Object.keys(referenceBundle));
    const selected = create({ [bundleName]: bundle });
    const expected = oracle.create({ [bundleName]: referenceBundle });
    expect(Object.keys(selected).sort()).toEqual(Object.keys(expected).sort());
    const input = [
      [4, 1],
      [2, 3],
    ];
    expect(Reflect.get(selected, name)(input)).toEqual(Reflect.get(expected, name)(input));
  });

  it('uses the selected sparse accumulator and heap for LUP', () => {
    const selected = create({ lupDependencies: compat.lupDependencies });
    const expected = oracle.create({ lupDependencies: Reflect.get(oracle, 'lupDependencies') });
    const input = [
      [4, 1],
      [2, 3],
    ];
    const sparse = Reflect.get(selected, 'matrix')(input, 'sparse');
    const result = Reflect.get(selected, 'lup')(sparse) as ReturnType<typeof oracle.lup>;
    const reference = expected.lup(expected.matrix(input, 'sparse'));
    expect(result.L.valueOf()).toEqual(reference.L.valueOf());
    expect(result.U.valueOf()).toEqual(reference.U.valueOf());
    expect(result.p).toEqual(reference.p);
  });

  it('creates selected indices and immutable matrices', () => {
    const actual = create({ indexDependencies: compat.indexDependencies });
    const expected = oracle.create({ indexDependencies: Reflect.get(oracle, 'indexDependencies') });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    expect(String(actual.index(1, [2, 3]))).toBe(String(expected.index(1, [2, 3])));
    const OracleMatrix = Reflect.get(expected, 'ImmutableDenseMatrix');
    expect(new actual.ImmutableDenseMatrix([[1, 2]]).valueOf()).toEqual(
      new OracleMatrix([[1, 2]]).valueOf()
    );
  });

  it.each([
    'Node',
    'ConstantNode',
    'AssignmentNode',
    'SymbolNode',
    'FunctionNode',
    'ParenthesisNode',
    'ArrayNode',
    'BlockNode',
    'OperatorNode',
    'RangeNode',
    'AccessorNode',
    'ConditionalNode',
    'FunctionAssignmentNode',
    'ObjectNode',
    'IndexNode',
    'RelationalNode',
  ] as const)('creates the selected %s constructor with MathJS dependencies', (name) => {
    const bundleName = name + 'Dependencies';
    const factoryName = 'create' + name;
    const bundle = Reflect.get(compat, bundleName);
    const referenceBundle = Reflect.get(oracle, bundleName);
    expect(Object.keys(bundle)).toEqual(Object.keys(referenceBundle));
    expect(Reflect.get(compat, factoryName).dependencies).toEqual(
      Reflect.get(oracle, factoryName).dependencies
    );
    const selected = create({ [bundleName]: bundle });
    const expected = oracle.create({ [bundleName]: referenceBundle });
    expect(Object.keys(selected).sort()).toEqual(Object.keys(expected).sort());
    expect(typeof Reflect.get(selected, name)).toBe('function');
  });

  it('compiles a selected AST using the functions in the same instance', () => {
    const bundles = ['ConstantNodeDependencies', 'OperatorNodeDependencies', 'addDependencies'];
    const selected = create(
      Object.fromEntries(bundles.map((name) => [name, Reflect.get(compat, name)]))
    );
    const expected = oracle.create(
      Object.fromEntries(bundles.map((name) => [name, Reflect.get(oracle, name)]))
    );
    const result = new selected.OperatorNode('+', 'add', [
      new selected.ConstantNode(3),
      new selected.ConstantNode(4),
    ]);
    const reference = new expected.OperatorNode('+', 'add', [
      new expected.ConstantNode(3),
      new expected.ConstantNode(4),
    ]);
    expect(result.evaluate()).toBe(reference.evaluate());
    expect(result.toString()).toBe(reference.toString());
  });

  it.each([
    ['bignumber', ['0xff']],
    ['bignumber', [123456789012345678901234567890n]],
    ['fraction', [{ n: 3, d: 7, s: -1 }]],
    ['fraction', [7n, 19n]],
    ['complex', ['2 + 3i']],
    ['complex', [{ abs: 2, arg: 0 }]],
  ] as const)('uses the selected %s conversion factory', (name, input) => {
    const bundleName = name + 'Dependencies';
    const actual = create({ [bundleName]: Reflect.get(compat, bundleName) });
    const expected = oracle.create({ [bundleName]: Reflect.get(oracle, bundleName) });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    const result = Reflect.apply(Reflect.get(actual, name), actual, input);
    const reference = Reflect.apply(Reflect.get(expected, name), expected, input);
    if (compat.isBigNumber(result) && oracle.isBigNumber(reference)) {
      expect(reference.eq(result.toString())).toBe(true);
    } else if (compat.isFraction(result) && oracle.isFraction(reference)) {
      expect(result.numerator).toBe(reference.s * reference.n);
      expect(result.denominator).toBe(reference.d);
    } else if (compat.isComplex(result) && oracle.isComplex(reference)) {
      expect([result.re, result.im]).toEqual([reference.re, reference.im]);
    } else {
      throw new TypeError(`Unexpected result from ${name}`);
    }
  });

  it('computes all roots using the selected nthRoots dependencies', () => {
    const actual = create({ nthRootsDependencies: compat.nthRootsDependencies });
    const expected = oracle.create({
      nthRootsDependencies: Reflect.get(oracle, 'nthRootsDependencies'),
    });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    const result = Reflect.get(actual, 'nthRoots')(8, 3);
    const oracleResult = Reflect.get(expected, 'nthRoots')(8, 3);
    if (!Array.isArray(result) || !Array.isArray(oracleResult)) {
      throw new TypeError('Expected nthRoots to return arrays');
    }
    const roots = result as { re: number; im: number }[];
    const reference = oracleResult as { re: number; im: number }[];
    expect(roots).toHaveLength(reference.length);
    roots.forEach(({ re, im }, index) => {
      expect(re).toBeCloseTo(reference[index].re, 14);
      expect(im).toBeCloseTo(reference[index].im, 14);
    });
  });

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
    ['multiply', [2, 3, 4]],
    [
      'multiply',
      [
        [
          [1, 2],
          [3, 4],
        ],
        [
          [2, 0],
          [1, 2],
        ],
      ],
    ],
    [
      'multiply',
      [
        [1, 2],
        [3, 4],
      ],
    ],
    [
      'multiply',
      [
        [
          [1, 2],
          [3, 4],
        ],
        [2, 3],
      ],
    ],
    [
      'multiply',
      [
        [2, 3],
        [
          [1, 2],
          [3, 4],
        ],
      ],
    ],
    [
      'det',
      [
        [
          [1, 2],
          [3, 4],
        ],
      ],
    ],
    [
      'inv',
      [
        [
          [2, 0],
          [0, 4],
        ],
      ],
    ],
    [
      'pow',
      [
        [
          [1, 2],
          [0, 1],
        ],
        3,
      ],
    ],
    [
      'cross',
      [
        [1, 0, 0],
        [0, 1, 0],
      ],
    ],
    ['dotPow', [[2, 4], 2]],
    ['leafCount', ['x + 3']],
    [
      'pinv',
      [
        [
          [2, 0],
          [0, 4],
        ],
      ],
    ],
    [
      'intersect',
      [
        [0, 0],
        [2, 2],
        [0, 2],
        [2, 0],
      ],
    ],
    ['combinations', [7, 5]],
    ['combinationsWithRep', [7, 5]],
    [
      'bigint',
      [
        [
          [-1.5, true],
          ['14', 0],
        ],
      ],
    ],
    [
      'boolean',
      [
        [
          ['False', 1],
          ['2', 0],
        ],
      ],
    ],
    [
      'string',
      [
        [
          [1e-10, 1.25],
          [true, null],
        ],
      ],
    ],
    [
      'lusolve',
      [
        [
          [2, 1],
          [1, 3],
        ],
        [5, 5],
      ],
    ],
    [
      'sqrtm',
      [
        [
          [4, 0],
          [0, 9],
        ],
      ],
    ],
    ['gamma', [5]],
    ['factorial', [[3, 4, 5]]],
    ['permutations', [6]],
    ['permutations', [6, 2]],
    ['catalan', [7]],
    ['multinomial', [[2, 3, 4]]],
    ['stirlingS2', [8, 3]],
    ['bellNumbers', [7]],
    ['median', [[3, 8, 1, 4]]],
    ['mad', [[1, 3, 9]]],
    ['variance', [[1, 2, 3], 'unbiased']],
    ['std', [[1, 2, 3], 'unbiased']],
    ['quantileSeq', [[1, 2, 3, 4, 5], 0.25]],
    [
      'corr',
      [
        [1, 2, 3, 4],
        [4, 2, 1, 3],
      ],
    ],
    ['xgcd', [8, 12]],
    ['invmod', [7, 13]],
    ['norm', [[3, 4]]],
    ['rotationMatrix', [0.75]],
    ['rotate', [[2, 3], 0.75]],
    ['sylvester', [[[-2]], [[-3]], [[10]]]],
    ['lyap', [[[-2]], [[8]]]],
    ['composition', [5, 3]],
    [
      'kldivergence',
      [
        [0.3, 0.7],
        [0.5, 0.5],
      ],
    ],
    ['mean', [[2, 4, 9]]],
    [
      'mean',
      [
        [
          ['2', '4'],
          ['6', '8'],
        ],
        1,
      ],
    ],
    ['polynomialRoot', [-6, 11, -6, 1]],
    ['divide', [12, 3]],
    ['divide', [[2, 4], 2]],
    [
      'divide',
      [
        [
          [7, -6],
          [13, -4],
        ],
        [
          [1, 2],
          [4, 3],
        ],
      ],
    ],
    [
      'setUnion',
      [
        [3, 1, 1],
        [2, 3],
      ],
    ],
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
    ['numeric', ['0b11.1', 'number']],
    ['diff', [[1, 4, 9]]],
    ['divideScalar', [7, 2]],
    ['fix', [-3.75]],
    ['larger', [3, 2]],
    ['sign', [-42]],
    ['smaller', [3, 2]],
    ['unaryPlus', ['8']],
    ['dotDivide', [[2, 4], 2]],
    ['hypot', [3, 4]],
    ['log', [16, 2]],
    [
      'distance',
      [
        [0, 0],
        [3, 4],
      ],
    ],
    [
      'lsolve',
      [
        [
          [2, 0],
          [1, 2],
        ],
        [4, 6],
      ],
    ],
    [
      'usolve',
      [
        [
          [2, 1],
          [0, 2],
        ],
        [6, 4],
      ],
    ],
    [
      'lsolveAll',
      [
        [
          [2, 0],
          [1, 2],
        ],
        [4, 6],
      ],
    ],
    [
      'usolveAll',
      [
        [
          [2, 1],
          [0, 2],
        ],
        [6, 4],
      ],
    ],
    ['log1p', [0.5]],
    ['range', [1, 6, 2]],
    [
      'setSymDifference',
      [
        [1, 2],
        [2, 3],
      ],
    ],
    [
      'min',
      [
        [
          [1, 5],
          [3, 2],
        ],
        0,
      ],
    ],
    [
      'max',
      [
        [
          [1, 5],
          [3, 2],
        ],
        1,
      ],
    ],
    ['cumsum', [[1, 4, 9]]],
    ['sum', [['1.25', '2.5']]],
    ['prod', [['1.25', '2.5']]],
    [
      'count',
      [
        [
          [1, 2],
          [3, 4],
        ],
      ],
    ],
    ['bernoulli', [4]],
    [
      'setDifference',
      [
        [1, 2],
        [2, 3],
      ],
    ],
    [
      'setIntersect',
      [
        [1, 2],
        [2, 3],
      ],
    ],
    ['setDistinct', [[1, 1, 2]]],
    [
      'setCartesian',
      [
        [1, 2],
        [3, 4],
      ],
    ],
    ['setIsSubset', [[1], [1, 2]]],
    ['setMultiplicity', [2, [1, 2, 2]]],
    ['setPowerset', [[1, 2]]],
    [
      'column',
      [
        [
          [1, 2],
          [3, 4],
        ],
        1,
      ],
    ],
    [
      'row',
      [
        [
          [1, 2],
          [3, 4],
        ],
        1,
      ],
    ],
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
    const bundle = Reflect.get(compat, bundleName) as Record<string, unknown>;
    const upstreamBundle = Reflect.get(oracle, bundleName) as Parameters<typeof oracle.create>[0];
    const math = create({ [bundleName]: bundle });
    const upstream = oracle.create({ [bundleName]: upstreamBundle } as typeof upstreamBundle);
    expect(Object.keys(bundle)).toEqual(Object.keys(upstreamBundle));
    expect(Object.keys(math).sort()).toEqual(Object.keys(upstream).sort());
    const factoryName = Object.keys(upstreamBundle).find((key) => key.startsWith('create'));
    if (!factoryName) throw new Error(`No factory exported for ${bundleName}`);
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
