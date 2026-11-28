/**
 * Branch coverage for compat matrix model helpers (#1785) not hit by oracle suites.
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import {
  createCompatMatrixClass,
  promoteToCompatMatrix,
  bindCompatMatrixPromotion,
  type CompatMatrixCtors,
} from '../src/compat-matrix-model.js';
import { setCompatSparseBignumberFactory } from '../src/compat-sparse-matrix.js';
import { createCompatReshape } from '../src/mathjs-parity-1785-surfaces.js';
import { createCompatSubsetG09 } from '../src/mathjs-parity-g09.js';
import * as mathFunctions from '@danielsimonjr/mathts-functions';

const math = create(all);
const matrixCtors = {
  DenseMatrix: math.DenseMatrix,
  SparseMatrix: math.SparseMatrix,
  ImmutableDenseMatrix: math.ImmutableDenseMatrix,
} as unknown as CompatMatrixCtors;
bindCompatMatrixPromotion(matrixCtors);

const checks = {
  isMatrix: (value: unknown) => math.isMatrix(value),
  isDenseMatrix: (value: unknown) => math.isDenseMatrix(value),
  isSparseMatrix: (value: unknown) => math.isSparseMatrix(value),
};

type BnCtor = new (value: string | number) => unknown;

describe('compat-matrix-model promotion and interface (#1785)', () => {
  it('promoteToCompatMatrix handles bridge size shapes and immutable sources', () => {
    const withRowsCols = promoteToCompatMatrix(
      {
        isMatrix: true,
        toArray: () => [[1, 2]],
        rows: 1,
        cols: 2,
      },
      matrixCtors
    );
    expect(math.isMatrix(withRowsCols)).toBe(true);
    const sized = promoteToCompatMatrix(
      {
        isMatrix: true,
        type: 'DenseMatrix',
        toArray: () => [],
        size: { rows: 0, cols: 2 },
      },
      matrixCtors
    );
    expect(math.size(sized).valueOf()).toEqual([0, 2]);
    const sparseBridge = promoteToCompatMatrix(
      {
        isMatrix: true,
        storage: () => 'sparse',
        toArray: () => [],
        rows: 0,
        cols: 3,
      },
      matrixCtors
    );
    expect(math.isSparseMatrix(sparseBridge)).toBe(true);
    const sparseFlat = promoteToCompatMatrix(
      {
        isMatrix: true,
        isSparseMatrix: true,
        toArray: () => [[0, 1]],
      },
      matrixCtors
    );
    expect(math.isSparseMatrix(sparseFlat)).toBe(true);
    const imm = promoteToCompatMatrix(
      {
        isMatrix: true,
        isImmutableDenseMatrix: true,
        toArray: () => [4, 5],
      },
      matrixCtors
    );
    expect((imm as { isImmutableDenseMatrix?: boolean }).isImmutableDenseMatrix).toBe(true);
    expect(promoteToCompatMatrix(3, matrixCtors)).toBe(3);
  });

  it('createCompatMatrixClass guards construction and rejects interface calls', () => {
    const MatrixIface = createCompatMatrixClass(checks);
    const asFn = MatrixIface as unknown as () => void;
    expect(() => asFn()).toThrow(/new operator/);
    const iface = new MatrixIface();
    expect(iface.type).toBe('Matrix');
    const ifaceRec = iface as unknown as Record<string | symbol, () => unknown>;
    expect(() => ifaceRec.subset()).toThrow(/Cannot invoke/);
    expect(() => ifaceRec.storage()).toThrow(/Cannot invoke/);
    expect(() => ifaceRec[Symbol.iterator]()).toThrow(/Cannot iterate/);
    expect(math.matrix([1]) instanceof math.Matrix).toBe(true);
  });
});

describe('compat dense/sparse instance adapters (#1785)', () => {
  it('covers dense constructor, get/subset/resize/map, and transpose', () => {
    const DenseCtor = math.DenseMatrix as new (...args: unknown[]) => { toArray(): unknown };
    const fromSparse = new DenseCtor(
      math.sparse([
        [1, 0],
        [0, 2],
      ])
    );
    expect(math.isDenseMatrix(fromSparse)).toBe(true);
    const fromBlock = new DenseCtor({ data: [[9], [8]], size: [2, 1] });
    expect(fromBlock.toArray()).toEqual([[9], [8]]);
    expect(() => new DenseCtor([1], 99)).toThrow(/Invalid datatype/);

    type DenseTools = {
      _datatype?: string;
      subset: (i: unknown, r?: unknown, d?: unknown) => unknown;
      get: (i: unknown, j?: unknown) => unknown;
      map: (cb: unknown) => unknown;
      resize: (size: unknown, def?: unknown, copy?: boolean) => unknown;
      transpose: () => { toArray(): unknown };
      clone: () => { _datatype?: string };
      toJSON: () => Record<string, unknown>;
    };
    const m = math.matrix([
      [1, 2],
      [3, 4],
    ]) as unknown as DenseTools;
    m._datatype = 'number';
    const t = math.matrix([
      [1, 2],
      [3, 4],
    ]) as unknown as { transpose: () => { toArray(): unknown } };
    expect(t.transpose().toArray()).toEqual([
      [1, 3],
      [2, 4],
    ]);
    expect(m.toJSON().datatype).toBe('number');
    expect(m.get(0, 1)).toBe(2);
    expect(() => m.get([0], 1)).toThrow(/Array expected/);
    expect(() => m.get('bad' as unknown as number[])).toThrow(/Array expected for index/);
    expect(() => m.subset('x')).toThrow(/Invalid index/);
    expect(() => m.subset({ isIndex: false } as unknown, 9)).toThrow(/Invalid index/);
    m.subset(math.index(1, 0), 7);
    expect(m.get([1, 0])).toBe(7);
    const resized = m.resize([1, 1], null, true) as { toArray(): unknown };
    expect(resized.toArray()).toEqual([[1]]);
    const scalarResize = m.resize([], null) as unknown;
    expect(typeof scalarResize).toBe('number');
    expect(() => m.map('not-fn')).toThrow(/Function map/);
    const cloned = m.clone();
    expect(cloned._datatype).toBe('number');
    const vec = math.matrix([1, 2, 3]) as unknown as Iterable<{
      value: unknown;
      index: number[];
    }>;
    expect([...vec].map((e) => e.value)).toEqual([1, 2, 3]);
  });

  it('covers sparse datatype coercion, resize-on-set, and valueOf', () => {
    const bn = create(all, { number: 'BigNumber' });
    setCompatSparseBignumberFactory((value) => bn.bignumber(value as number));
    const big = bn.sparse([
      [1, 0],
      [0, -0],
    ]) as unknown as {
      _datatype?: string;
      set: (idx: unknown, value: unknown) => unknown;
      get: (r: number, c: number) => unknown;
      valueOf: () => unknown;
      subset: (idx: unknown, rep?: unknown) => unknown;
    };
    big._datatype = 'BigNumber';
    big.subset(bn.index(0, 0) as unknown, bn.bignumber(2));
    big.set([2, 2], 5);
    expect(big.get(2, 2)).toBeDefined();
    const grid = big.valueOf() as unknown[][];
    expect(grid[1][1]).toBeDefined();
    const frac = create(all, { number: 'Fraction' });
    const fs = frac.sparse([[frac.fraction(1, 2), 0]]) as unknown as { zero: unknown };
    expect(fs.zero).toBeDefined();
  });

  it('immutable dense matrices forbid set-subset and re-wrap GET results', () => {
    const imm = new math.ImmutableDenseMatrix([
      [1, 2],
      [3, 4],
    ]);
    expect(() =>
      (imm as { subset: (i: unknown, r: number) => void }).subset(math.index(0, 0), 9)
    ).toThrow(/Immutable/);
    const slice = (imm as { subset: (i: unknown) => unknown }).subset(
      math.index(0, math.range(0, 2))
    ) as { type?: string };
    expect(slice.type).toBe('ImmutableDenseMatrix');
    const fromDense = new math.ImmutableDenseMatrix(
      math.matrix([
        [5, 6],
        [7, 8],
      ])
    );
    expect(fromDense.toArray()).toEqual([
      [5, 6],
      [7, 8],
    ]);
  });

  it('DenseMatrix create/fromJSON and Index clone paths stay compat-wrapped', () => {
    const m = math.matrix([1, 2, 3]) as unknown as {
      create: (data: unknown, dt?: string) => unknown;
    };
    expect(m.create(7)).toBe(7);
    const block = m.create({ data: [4, 5], size: [2] }) as { type?: string };
    expect(block.type).toBe('DenseMatrix');
    const DenseCtor = math.DenseMatrix as new (...args: unknown[]) => { toArray(): unknown };
    const fromJson = (DenseCtor as unknown as { fromJSON: (j: unknown) => unknown }).fromJSON({
      data: [1],
      size: [1],
      datatype: 'number',
    });
    expect(math.isDenseMatrix(fromJson)).toBe(true);
    const idx = math.index([0, 1]);
    const cloned = (
      math.Index as unknown as { prototype: { clone(): unknown } }
    ).prototype.clone.call(idx);
    expect(cloned).toBeDefined();
  });

  it('promotes core dense matrices that lack a size() method', () => {
    const bridge = {
      isMatrix: true,
      toArray: () => [8, 9],
    };
    const out = promoteToCompatMatrix(bridge, matrixCtors);
    expect(math.isMatrix(out)).toBe(true);
  });

  it('legacy subset GET reshapes rows under legacySubset', () => {
    const legacy = create(all, { legacySubset: true });
    const row = legacy
      .matrix([
        [1, 2],
        [3, 4],
      ])
      .subset(legacy.index(0, legacy.range(0, 2))) as unknown;
    expect(Array.isArray(row) || legacy.isMatrix(row)).toBe(true);
  });

  it('wires G09 array-null default paths on subset', () => {
    const subsetBase = mathFunctions.subset as (...args: unknown[]) => unknown;
    const patched = createCompatSubsetG09(subsetBase, {
      add: math.add,
      zeros: math.zeros,
      matrix: (...args: unknown[]) => math.matrix(...(args as [unknown])),
      sparse: (...args: unknown[]) => math.sparse(...(args as [unknown])),
    });
    const arr: number[] = [1];
    const idx = math.index(2);
    const out = patched(arr, idx, 9, null) as number[];
    expect(out).toEqual([1, null, 9]);
    const legacy = create(all, { legacySubset: true });
    const row = legacy.matrix([10, 20, 30]);
    const getLegacy = patched(row, legacy.index(1));
    expect(getLegacy).toBe(20);
  });

  it('reshape adapter normalizes BigNumber nests and matrix size vectors', () => {
    const bn = create(all, { number: 'BigNumber' });
    const BnClass = Object.getPrototypeOf(bn.bignumber(1)).constructor as BnCtor;
    const reshape = createCompatReshape(bn.reshape.bind(bn), BnClass);
    const nested = reshape(
      [
        [bn.bignumber(1), bn.bignumber(2)],
        [bn.bignumber(3), bn.bignumber(4)],
      ],
      [2, 2]
    ) as { toArray(): unknown };
    const shaped = nested as unknown as unknown[][];
    expect(shaped.length).toBe(2);
    expect(bn.isBigNumber(shaped[0][0])).toBe(true);
    const sizeMat = bn.matrix([bn.bignumber(2), bn.bignumber(2)]);
    const square = reshape(bn.matrix([1, 2, 3, 4]), sizeMat) as { size(): number[] };
    expect(square.size()).toEqual([2, 2]);
  });
});
