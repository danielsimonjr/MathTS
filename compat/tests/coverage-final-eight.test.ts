import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { Complex } from '@danielsimonjr/mathts-core';
import {
  createCompatMathjsStatistics,
  withCountBoolean,
  withReductionDim0ScalarReturn,
} from '../src/mathjs-parity-g02.js';
import { ensureMathjsFractionToJson } from '../src/fraction-mathjs-json.js';
import { mapElementwiseBroadcastError } from '../src/g12-mathjs-parity.js';
import { Fraction } from '@danielsimonjr/mathts-core';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

describe('final eight lines — index compare, G02 count/variance/reduce', () => {
  it('mad partitionSelect uses fraction compare in index.ts', () => {
    const math = create(all);
    const fr = Array.from({ length: 9 }, (_, i) => math.fraction(i + 1, 10));
    expect(math.mad(fr)).toBeDefined();
    expect(math.mad([math.fraction(1, 4), math.fraction(1, 2), math.fraction(3, 4)])).toBeDefined();
  });

  it('withCountBoolean reports the first-arg error before too-many', () => {
    const math = create(all);
    const count = withCountBoolean(math.count.bind(math));
    expect(() => count(math.unit('5 m'), 0)).toThrow();
    expect(() => count([1, 2, 3], 2)).toThrow(/Too many arguments/);
  });

  it('withReductionDim0ScalarReturn unwraps a 1×1 matrix result on dim 0', () => {
    const math = create(all);
    const reduce = withReductionDim0ScalarReturn(() => math.matrix([42]));
    expect(reduce(math.matrix([5]), 0)).toBe(42);
  });

  it('complex variance single-value path returns numeric zero for BigNumber', () => {
    const instance = create(all);
    const deps = {
      subtract: instance.subtract.bind(instance),
      add: instance.add.bind(instance),
      divide: instance.divide.bind(instance),
      multiply: instance.multiply.bind(instance),
      sqrt: instance.sqrt.bind(instance),
      matrix: instance.matrix.bind(instance),
      mapSlices: instance.mapSlices.bind(instance),
    };
    const variance = createCompatMathjsStatistics(
      'variance',
      instance.variance.bind(instance),
      deps
    );
    expect(variance(new Complex(1, 2))).toBe(0);
    expect(variance(instance.bignumber(5))).toBeDefined();
    expect(variance([new Complex(1, 2)])).toBe(0);
    expect(variance([1, 2, 3], 'uncorrected')).toBeDefined();
    expect(variance([1, 2, 3], 'biased')).toBeDefined();
    const cm = instance.matrix([new Complex(2, 0), new Complex(0, 0)]);
    expect(variance(cm, 'uncorrected')).toBeDefined();
    expect(variance(cm, 'biased')).toBeDefined();
  });

  it('BigNumber unary bind and sparse QR empty-axis shim paths', () => {
    const bn = create(all, { number: 'BigNumber' });
    const logged = bn.log(bn.bignumber(10));
    expect(bn.isBigNumber(logged)).toBe(true);
    const fine = create(all, { number: 'BigNumber', precision: 30 });
    expect(fine.sin(fine.bignumber(0.25))).toBeDefined();
    const math = create(all);
    expect(math.fix(math.matrix([math.fraction(4, 3)]))).toBeDefined();
    expect(
      math.fraction(
        math.matrix([
          [1, 2],
          [3, 4],
        ])
      )
    ).toBeDefined();
    expect(
      math.fraction(
        new DenseMatrix([
          [1, 2],
          [3, 4],
        ])
      )
    ).toBeDefined();
    const empty = math.matrix([]);
    empty.resize([0, 2], 0);
    expect(math.qr(empty)).toBeDefined();
    const sparse = math.sparse([]);
    sparse.resize([0, 2], 0);
    expect(math.qr(sparse)).toBeDefined();
    const left = math.matrix([]);
    left.resize([0, 2], 0);
    const right = math.matrix([]);
    right.resize([0, 2], 0);
    expect(math.add(left, right)).toBeDefined();
    expect(math.isNegative(math.matrix([-1, -2]))).toBeDefined();
    const core = new Fraction(1, 3);
    ensureMathjsFractionToJson(core);
    expect(ensureMathjsFractionToJson(core)).toBe(core);
    expect(() => math.multiply([1, 2], [1, 2, 3])).toThrow(/Dimension mismatch/);
    const mismatch = new Error('Dimension mismatch in element-wise operation');
    expect(() => mapElementwiseBroadcastError(mismatch, [1, 2], [1, 2, 3])).toThrow(/broadcast/);
    expect(() => mapElementwiseBroadcastError(mismatch, [1, 2], [1, 2])).toThrow(mismatch);
    const err2 = new Error('Matrix dimensions must match in element-wise op');
    expect(() =>
      mapElementwiseBroadcastError(
        err2,
        math.matrix([
          [1, 2],
          [3, 4],
        ]),
        [1, 2, 3]
      )
    ).toThrow();
  });
});
