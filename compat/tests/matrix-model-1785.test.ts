/**
 * mathjs 15.3.0 matrix model parity (#1785): compat constructor guards, jagged
 * arithmetic, sparse iterator.
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

const math = create(all);

const NEW_MSG = 'Constructor must be called with the new operator';

describe('matrix model #1785', () => {
  it('DenseMatrix without new throws SyntaxError', () => {
    const Dense = math.DenseMatrix as unknown as (...args: unknown[]) => unknown;
    expect(() => Dense()).toThrow(NEW_MSG);
  });

  it('ImmutableDenseMatrix without new throws SyntaxError', () => {
    const Imm = math.ImmutableDenseMatrix as unknown as (...args: unknown[]) => unknown;
    expect(() => Imm()).toThrow(NEW_MSG);
  });

  it('SparseMatrix without new throws SyntaxError', () => {
    const Sparse = math.SparseMatrix as unknown as (...args: unknown[]) => unknown;
    expect(() => Sparse()).toThrow(NEW_MSG);
  });

  it('add routes jagged nested arrays through the factory path', () => {
    expect(math.add(1, [[1, 2], [3] as unknown as number[]])).toEqual([[2, 3], [4]]);
  });

  it('Index stores compat ImmutableDenseMatrix in dimensions', () => {
    const dims = new math.Index([1, 2, 3])._dimensions;
    expect(math.deepEqual(dims[0], new math.ImmutableDenseMatrix([1, 2, 3]))).toBe(true);
  });

  it('matrix() returns compat-wrapped DenseMatrix instances', () => {
    const m = math.matrix([
      [1, 2],
      [3, 4],
    ]) as { type?: string };
    expect(m.type).toBe('DenseMatrix');
    expect(math.isDenseMatrix(m)).toBe(true);
  });

  it('gcd accepts nested 1d array matrix form', () => {
    expect(math.gcd([[12, 8]])).toBe(4);
  });

  it('matrix identity clone preserves number datatype', () => {
    const b = (math.matrix as (data: unknown, format?: string, datatype?: string) => unknown)(
      [
        [1, 2],
        [3, 4],
      ],
      'dense',
      'number'
    ) as { datatype(): string; _datatype?: string };
    const c = math.matrix(b, 'dense') as unknown as {
      datatype(): string;
      _datatype?: string;
    };
    expect(c.datatype()).toBe('number');
    expect(c._datatype).toBe('number');
  });

  it('sparse pattern add unions CSC structure', () => {
    const a = new math.SparseMatrix({
      values: null,
      index: [0, 1, 2, 0],
      ptr: [0, 2, 3, 4],
      size: [3, 3],
    });
    const b = new math.SparseMatrix({
      values: null,
      index: [0, 1, 2, 1],
      ptr: [0, 3, 3, 4],
      size: [3, 3],
    });
    const c = math.add(a, b) as { _values: unknown[] | null; _ptr: number[] };
    expect(c._values).toBeNull();
    expect(c._ptr).toEqual([0, 3, 4, 6]);
  });

  it('sparse map respects skipZeros third argument', () => {
    const m = new math.SparseMatrix([
      [1, 0],
      [0, 0],
    ]);
    let counter = 0;
    (m.map as (cb: () => number, context?: unknown, skipZeros?: boolean) => unknown)(
      () => {
        counter++;
        return 2;
      },
      m,
      true
    );
    expect(counter).toBe(1);
  });

  it('gcd promotes core Fraction gcd results to mathjs-shaped Fraction', () => {
    const four = math.gcd(12, math.fraction(8));
    expect(four).toEqual(math.fraction(4));
  });

  it('map applies unary callbacks across jagged arrays with empty rows', () => {
    expect(math.map([[2], []], math.square)).toEqual([[4], []]);
  });

  it('sparse Symbol.iterator yields stored entries in column order', () => {
    const m = new math.SparseMatrix([
      [1, 0],
      [0, 2],
    ]);
    const iterable = m as unknown as Iterable<{ value: unknown; index: number[] }>;
    const entries = [...iterable];
    expect(entries).toEqual([
      { value: 1, index: [0, 0] },
      { value: 2, index: [1, 1] },
    ]);
  });

  it('dense Symbol.iterator walks 2-D storage in row-major order', () => {
    const m = math.matrix([
      [10, 20],
      [30, 40],
    ]) as Iterable<{ value: unknown; index: number[] }>;
    expect([...m]).toEqual([
      { value: 10, index: [0, 0] },
      { value: 20, index: [0, 1] },
      { value: 30, index: [1, 0] },
      { value: 40, index: [1, 1] },
    ]);
  });

  it('dense subset rejects non-index GET with TypeError', () => {
    const m = math.matrix([1, 2, 3]);
    expect(() =>
      (m as { subset: (i: unknown) => unknown }).subset({ isIndex: false } as unknown),
    ).toThrow(/Invalid index/);
  });

  it('Matrix interface cannot be constructed without new', () => {
    const Matrix = math.Matrix as unknown as (...args: unknown[]) => unknown;
    expect(() => Matrix()).toThrow(NEW_MSG);
    expect(new (math.Matrix as new () => { type: string })().type).toBe('Matrix');
  });

  it('reshape keeps compat matrix type for abstract Matrix inputs', () => {
    const flat = math.reshape(math.matrix([1, 2, 3, 4]), [2, 2]) as { type?: string };
    expect(flat.type).toBe('DenseMatrix');
    expect(math.size(flat).valueOf()).toEqual([2, 2]);
  });

  it('range preserves includeEnd under BigNumber config', () => {
    const cfg = create(all, { number: 'BigNumber' });
    expect(cfg.range('4:10', true)).toEqual(cfg.range('4:10', true));
  });
});
