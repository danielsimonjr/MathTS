/**
 * Line coverage for exported #1785 surface helpers (not exhaustive oracle parity).
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import {
  applyCompatLegacySubsetGet,
  applySubsetGetMatrixShape,
  compareMixedTypes,
  createCompatBigintStatisticsReducer,
  createCompatConcat,
  createCompatEmptySum,
  createCompatMap,
  createCompatMatrixFromFunction,
  createCompatMatrixFromRows,
  createCompatMixedTypeReducer,
  createCompatRangeDispatch,
  createCompatReshape,
  createCompatSum,
  forwardSubsetArgs,
  guardCompatRangeZeroStep,
  normalizeCompatRotationMatrix,
  withMixedTypeVariadicMaxMin,
} from '../src/mathjs-parity-1785-surfaces.js';
import {
  bindCompatMatrixPromotion,
  inheritMatrixDatatype,
  isCompatWrappedMatrix,
  promoteToCompatMatrix,
  readMatrixDatatype,
  stampMatrixDatatype,
  type CompatMatrixCtors,
} from '../src/compat-matrix-model.js';

const math = create(all);
const matrixCtors = {
  DenseMatrix: math.DenseMatrix,
  SparseMatrix: math.SparseMatrix,
  ImmutableDenseMatrix: math.ImmutableDenseMatrix,
} as unknown as CompatMatrixCtors;
bindCompatMatrixPromotion(matrixCtors);
const matrixFn = (...args: unknown[]) => math.matrix(...(args as Parameters<typeof math.matrix>));
type BnCtor = new (value: string | number) => unknown;

describe('mathjs-parity-1785-surfaces unit coverage', () => {
  it('compareMixedTypes and mixed reducers handle numbers and strings', () => {
    expect(compareMixedTypes(1, 3)).toBe(-1);
    expect(compareMixedTypes('5', 3)).toBe(1);
    const max = createCompatMixedTypeReducer((a, b) => compareMixedTypes(a, b) > 0, true);
    expect(max(1, '9', 3)).toBe('9');
    const min = createCompatMixedTypeReducer((a, b) => compareMixedTypes(a, b) < 0, false);
    expect(min('2', 5)).toBe('2');
    expect(min()).toBe(Infinity);
    expect(max()).toBe(-Infinity);
  });

  it('forwardSubsetArgs forwards one through four arguments', () => {
    const calls: unknown[][] = [];
    const subset = (...args: unknown[]) => {
      calls.push(args);
      return args.length;
    };
    expect(forwardSubsetArgs(subset, 1)).toBe(1);
    expect(forwardSubsetArgs(subset, 1, 2)).toBe(2);
    expect(forwardSubsetArgs(subset, 1, 2, 3)).toBe(3);
    expect(forwardSubsetArgs(subset, 1, 2, 3, 4)).toBe(4);
    expect(calls).toEqual([[1], [1, 2], [1, 2, 3], [1, 2, 3, 4]]);
  });

  it('promoteToCompatMatrix and datatype helpers stamp compat wrappers', () => {
    const raw = math.matrix([1, 2, 3]);
    const wrapped = promoteToCompatMatrix(raw);
    expect(isCompatWrappedMatrix(wrapped)).toBe(true);
    stampMatrixDatatype(wrapped, 'number');
    expect(readMatrixDatatype(wrapped)).toBe('number');
  });

  it('non-scalar subset GET returns a matrix slice', () => {
    const m = math.matrix([1, 2, 3]);
    const slice = (m as { subset: (i: unknown) => unknown }).subset(math.index([0, 1]));
    expect(math.isMatrix(slice)).toBe(true);
    expect(math.deepEqual(slice, math.matrix([1, 2]))).toBe(true);
  });

  it('applyCompatLegacySubsetGet promotes scalars when legacy is off', () => {
    const idx = math.index([0, 1]);
    const wrapped = applyCompatLegacySubsetGet(7, idx, false, (value) => math.matrix([[value]]));
    expect(math.deepEqual(wrapped, math.matrix([[7]]))).toBe(true);
  });

  it('applyCompatLegacySubsetGet unwraps 1×1 legacy GET results', () => {
    const idx = math.index(0);
    const one = math.matrix([[4]]);
    expect(applyCompatLegacySubsetGet(one, idx, true, () => null)).toBe(4);
  });

  it('applySubsetGetMatrixShape reshapes row/column slices under modern subset', () => {
    const rowIdx = math.index(0, [0, 1]);
    const rowShaped = applySubsetGetMatrixShape([1, 2], rowIdx, false, (data: unknown) =>
      math.matrix(data)
    ) as { toArray(): unknown };
    expect(rowShaped.toArray()).toEqual([1, 2]);
    const colIdx = math.index([0, 1], 0);
    const colShaped = applySubsetGetMatrixShape([[1], [2]], colIdx, false, (data: unknown) =>
      math.matrix(data)
    ) as { toArray(): unknown };
    expect(colShaped.toArray()).toEqual([1, 2]);
  });

  it('guardCompatRangeZeroStep throws on zero BigNumber step', () => {
    const cfg = create(all, { number: 'BigNumber' });
    const guarded = guardCompatRangeZeroStep(cfg.range.bind(cfg));
    expect(() => guarded(0, 1, cfg.bignumber(0))).toThrow(/non-zero/);
    expect(guarded(0, 2, 1)).toEqual(cfg.range(0, 2, 1));
  });

  it('createCompatMap handles jagged empty rows and AnyFunction map errors', () => {
    const wrapped = createCompatMap(math.map.bind(math));
    expect(wrapped([[2], []], (x: unknown) => math.multiply(x as number, 2))).toEqual([[4], []]);
    const bad = createCompatMap(() => {
      throw new TypeError('AnyFunction map undefined');
    });
    expect(() => bad(1)).toThrow(/Function map/);
  });

  it('matrix factory wrappers promote compat DenseMatrix shells', () => {
    const fromRows = createCompatMatrixFromRows(
      () =>
        math.sparse([
          [1, 0],
          [0, 2],
        ]),
      matrixFn,
      matrixCtors
    );
    const densified = fromRows() as { type?: string };
    expect(densified.type).toBe('DenseMatrix');
    const fromFn = createCompatMatrixFromFunction(() => math.matrix([1, 2, 3]), matrixCtors);
    expect(isCompatWrappedMatrix(fromFn())).toBe(true);
  });

  it('reshape adapter rejects abstract Matrix inputs', () => {
    const reshape = createCompatReshape(
      math.reshape.bind(math),
      math.bignumber as unknown as BnCtor
    );
    const abstract = new math.Matrix();
    expect(() => reshape(abstract, [2, 2])).toThrow(/Cannot invoke reshape/);
  });

  it('range dispatch builds Fraction loops with explicit loop dependencies', () => {
    const frac = create(all, { number: 'Fraction' });
    const FracBnClass = Object.getPrototypeOf(frac.bignumber(1)).constructor as BnCtor;
    const rangeFrac = createCompatRangeDispatch(
      frac.range.bind(frac),
      FracBnClass,
      (x) => frac.fraction(x),
      {
        add: (a, b) => frac.add(a, b),
        smaller: (a, b) => frac.smaller(a, b),
        smallerEq: (a, b) => frac.smallerEq(a, b),
        larger: (a, b) => frac.larger(a, b),
        largerEq: (a, b) => frac.largerEq(a, b),
        isPositive: (x) => Boolean(frac.isPositive(x)),
        isZero: (x) => Boolean(frac.isZero(x)),
        matrixOut: (values) => frac.matrix(values),
      }
    );
    const dec = rangeFrac(
      frac.fraction(2),
      frac.fraction(0),
      frac.fraction(-1),
      true
    ) as { toArray(): unknown[] };
    expect(dec.toArray().length).toBeGreaterThan(1);
  });

  it('range dispatch appends the end BigNumber when includeEnd misses the stop', () => {
    const bn = create(all, { number: 'BigNumber' });
    const BnClass = Object.getPrototypeOf(bn.bignumber(1)).constructor as BnCtor;
    const rangeBn = createCompatRangeDispatch(
      bn.range.bind(bn),
      BnClass,
      (x) => bn.fraction(x),
      {
        add: (a, b) => bn.add(a, b),
        smaller: (a, b) => bn.smaller(a, b),
        smallerEq: (a, b) => bn.smallerEq(a, b),
        larger: (a, b) => bn.larger(a, b),
        largerEq: (a, b) => bn.largerEq(a, b),
        isPositive: (x) => Boolean(bn.isPositive(x)),
        isZero: (x) => Boolean(bn.isZero(x)),
        matrixOut: (values) => bn.matrix(values),
      }
    );
    const endCase = rangeBn(bn.bignumber(0), bn.bignumber(2), true) as { toArray(): unknown[] };
    expect(endCase.toArray().length).toBeGreaterThan(0);
  });

  it('matrixFromRows densifies sparse compat results', () => {
    const fromRows = createCompatMatrixFromRows(
      () =>
        math.sparse([
          [1, 0],
          [0, 2],
        ]),
      matrixFn,
      matrixCtors
    );
    const densified = fromRows() as { storage?: () => string };
    expect(densified.storage?.()).toBe('dense');
  });

  it('range dispatch handles BigNumber endpoints and Fraction inputs', () => {
    const bn = create(all, { number: 'BigNumber' });
    const BnClass = Object.getPrototypeOf(bn.bignumber(1)).constructor as BnCtor;
    const rangeBn = createCompatRangeDispatch(bn.range.bind(bn), BnClass, (x) => bn.fraction(x));
    const frac = create(all, { number: 'Fraction' });
    const FracBnClass = Object.getPrototypeOf(frac.bignumber(1)).constructor as BnCtor;
    const rangeFrac = createCompatRangeDispatch(
      frac.range.bind(frac),
      FracBnClass,
      (x) => frac.fraction(x),
      {
        add: (a, b) => frac.add(a, b),
        smaller: (a, b) => frac.smaller(a, b),
        smallerEq: (a, b) => frac.smallerEq(a, b),
        larger: (a, b) => frac.larger(a, b),
        largerEq: (a, b) => frac.largerEq(a, b),
        isPositive: (x) => Boolean(frac.isPositive(x)),
        isZero: (x) => Boolean(frac.isZero(x)),
        matrixOut: (values) => frac.matrix(values),
      }
    );
    const bnRange = rangeBn(bn.bignumber(1), bn.bignumber(3), bn.bignumber(1), true) as {
      toArray(): unknown;
    };
    const nativeRange = bn.range(bn.bignumber(1), bn.bignumber(3), bn.bignumber(1), true) as {
      toArray(): unknown;
    };
    expect(bn.deepEqual(bnRange, nativeRange)).toBe(true);
    const fracRange = rangeFrac(frac.fraction(0), frac.fraction(1), frac.fraction(1));
    expect(frac.isMatrix(fracRange) || Array.isArray(fracRange)).toBe(true);
  });

  it('concat, sum, and empty-sum adapters follow mathjs edges', () => {
    const concat = createCompatConcat(math.concat.bind(math));
    const stacked = concat(math.matrix([1]), math.matrix([2]), math.bignumber(0)) as {
      size(): { valueOf(): number[] };
    };
    expect(stacked.size().valueOf()).toEqual([2]);
    const emptySum = createCompatEmptySum(
      math.sum.bind(math),
      () => 'number',
      math.bignumber as unknown as BnCtor
    );
    expect(emptySum([])).toBe(0);
    const fracEmpty = createCompatEmptySum(
      math.sum.bind(math),
      () => 'Fraction',
      math.bignumber as unknown as BnCtor
    );
    expect(math.isFraction(fracEmpty([]))).toBe(true);
    const bnCfg = create(all, { number: 'BigNumber' });
    const BnClass = Object.getPrototypeOf(bnCfg.bignumber(1)).constructor as BnCtor;
    const bnEmpty = createCompatEmptySum(bnCfg.sum.bind(bnCfg), () => 'BigNumber', BnClass);
    expect(bnCfg.isBigNumber(bnEmpty([]))).toBe(true);
    const sumWrap = createCompatSum(() => {
      throw new TypeError('Unexpected type of argument in function sum (x)');
    });
    expect(() => sumWrap('bad')).toThrow(/Cannot calculate sum/);
  });

  it('mixed max/min and bigint statistics reducers route heterogeneous scalars', () => {
    const maxWrap = withMixedTypeVariadicMaxMin(math.max.bind(math), math.max.bind(math));
    expect(maxWrap(1n, 3)).toBe(3);
    expect(compareMixedTypes(1n, 5)).toBe(-1);
    const maxBig = createCompatBigintStatisticsReducer(true, () => 'bigint');
    expect(maxBig('5', '2')).toBe(5n);
    const minFrac = createCompatMixedTypeReducer((a, b) => compareMixedTypes(a, b) < 0, false);
    expect(minFrac(math.fraction(1, 2), 1)).toEqual(math.fraction(1, 2));
  });

  it('rotation normalizer strips IEEE dust from sparse matrices', () => {
    const sparse = math.sparse([
      [1e-20, 0],
      [0, 1],
    ]);
    const normalized = normalizeCompatRotationMatrix(sparse, matrixFn, promoteToCompatMatrix) as {
      get?: (i: number, j: number) => number;
    };
    expect(normalized.get?.(0, 0)).toBe(0);
  });

  it('inheritMatrixDatatype copies datatype from operand matrices', () => {
    const src = math.matrix([1]);
    stampMatrixDatatype(src, 'number');
    const out = inheritMatrixDatatype(math.matrix([2]), [src]);
    expect(readMatrixDatatype(out)).toBe('number');
  });

  it('legacy subset shape adapter row-wraps flat GET data', () => {
    const idx = math.index(0, [0, 1]);
    const legacy = applySubsetGetMatrixShape([9, 8], idx, true, (data: unknown) =>
      math.matrix(data)
    ) as {
      toArray(): unknown;
    };
    expect(legacy.toArray()).toEqual([[9, 8]]);
  });
});
