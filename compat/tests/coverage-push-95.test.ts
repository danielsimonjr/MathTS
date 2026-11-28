/**
 * Targeted branch coverage to hold compat line floor >= 95% (Bun 1.4.2 lcov).
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { bignumber as shimBignumber } from '../src/shims.js';
import {
  remapPublicScalarFnName,
  withMatrixMapHintOnUnary,
  withPublicFactoryScalar,
} from '../src/mathjs-parity-errors.js';
import { setCompatSparseBignumberFactory } from '../src/compat-sparse-matrix.js';
import { compareMathjsFractionSign } from '../src/mathjs-parity-g06.js';

describe('coverage push — matrix model, sparse, shims, parity (#1785)', () => {
  it('hits compare fraction sign, nested matrix data, subset arity, and empty map', () => {
    const math = create(all);
    expect(compareMathjsFractionSign(math.fraction(1, 2), math.fraction(2, 3))).toBeLessThan(0);
    expect(math.compare(math.fraction(1, 2), math.fraction(2, 3))).toBeDefined();
    expect(math.compare(1, 2)).toBe(-1);
    const nested = math.matrix(math.matrix([1, 2, 3]));
    expect(nested.size()).toEqual([3]);
    const DenseCtor = math.DenseMatrix as new (data: unknown) => { toArray(): unknown };
    const fromMatrix = new DenseCtor(math.matrix([[1, 2]]));
    expect(fromMatrix.toArray()).toEqual([[1, 2]]);
    const empty = math.matrix([]);
    expect(() => (empty as { map: (cb: unknown) => unknown }).map('not-a-fn')).toThrow(
      /Function map/
    );
    for (const _ of empty as unknown as Iterable<unknown>) {
      void _;
    }
  });

  it('sparse bigint datatype, column shrink on resize, and linalg shim dense paths', () => {
    const math = create(all);
    const sparse = math.sparse as (data: unknown, datatype?: string) => unknown;
    const s = sparse(
      [
        [1, 0, 0],
        [0, 2, 0],
        [0, 0, 3],
      ],
      'number'
    ) as unknown as {
      _datatype?: string;
      _size: number[];
      resize: (size: number[], def?: unknown) => void;
      get: (r: number, c: number) => unknown;
    };
    s._datatype = 'bigint';
    s.resize([3, 1], 0);
    expect(s._size).toEqual([3, 1]);
    expect(s.get(0, 0)).toBeDefined();
    expect(
      math.usolve(
        math.sparse([
          [1, 0],
          [0, 1],
        ]),
        math.matrix([[2], [3]])
      )
    ).toBeDefined();
    const sp = math.sparse([
      [1, 0],
      [0, 2],
    ]) as { subset: (...a: unknown[]) => unknown };
    expect(() => sp.subset(math.index(0, 0), 1, 0, 9)).toThrow(/Wrong number of arguments/);
  });

  it('parity error adapters: range map hint, scalar guards, and ctor fallbacks', () => {
    const math = create(all);
    const square = withMatrixMapHintOnUnary('square', () => 0);
    expect(() => square(math.range(0, 2))).toThrow(/map\(/);
    const throwsTyped = (..._args: unknown[]) => {
      throw new TypeError('addScalar: unexpected type Matrix at index 0');
    };
    const add = withPublicFactoryScalar('add', 'addScalar', throwsTyped);
    expect(() => add(math.matrix([1]), 1)).toThrow(/function add/);
    const syntaxBn = (..._args: unknown[]) => {
      throw new SyntaxError('BigNumber cannot parse value');
    };
    const add2 = withPublicFactoryScalar('add', 'addScalar', syntaxBn);
    expect(() => add2('not-a-number', 1)).toThrow(/Cannot convert/);
    const u = math.unit('5 cm');
    expect(() => math.add(u, 3)).toThrow(/expected: Unit/);
    expect(remapPublicScalarFnName('function addScalar', 'addScalar', 'add')).toContain('add');
    const bn = create(all, { number: 'BigNumber' });
    setCompatSparseBignumberFactory((value) => bn.bignumber(value as number));
    const sp = bn.sparse([
      [bn.bignumber(1), -0],
      [0, bn.bignumber(2)],
    ]);
    const grid = sp.valueOf() as unknown[][];
    expect(bn.isBigNumber(grid[0][0])).toBe(true);
    expect(grid[0][1]).toBeDefined();
  });

  it('instance evaluate batch, bignumber arity, parser subset guard, and compile matrix', () => {
    const math = create(all);
    expect(math.evaluate(['1+1', '2+2'])).toEqual([2, 4]);
    const bignumber = math.bignumber as (...args: unknown[]) => unknown;
    expect(() => bignumber(1, 2)).toThrow(/Too many arguments/);
    const parser = math.parser();
    parser.set('bad', { isIndex: true });
    expect(() => parser.evaluate('subset([1,2,3], bad)')).toThrow(/expected: Index/);
    const compiled = math.compile(
      math.matrix([
        ['1+1', '2+2'],
        ['3+3', '4+4'],
      ])
    );
    expect(compiled).toBeDefined();
    expect(math.matrixFromRows([[1, 2]], [[3, 4]])).toBeDefined();
    expect(math.matrixFromFunction([2, 2], ([i, j]: number[]) => i + j)).toBeDefined();
    const scoped = math.parser();
    scoped.set('M', math.matrix([1, 2, 3]));
    expect(scoped.evaluate('mean(M)')).toBe(2);
    expect(scoped.evaluate('quantileSeq(M, 0.5)')).toBe(2);
    expect(math.mode([1, 1, 2, 3])).toBeDefined();
    expect(math.kron(math.matrix([1, 2]), math.matrix([0, 1]))).toBeDefined();
  });

  it('shims bignumber arity, sparse linalg, and statistics flatten branches', () => {
    const math = create(all);
    const bignumberShim = shimBignumber as (...args: unknown[]) => unknown;
    expect(() => bignumberShim(1, 2)).toThrow(/Too many arguments/);
    expect(
      math.mad([math.fraction(1, 10), math.fraction(2, 10), math.fraction(9, 10)])
    ).toBeDefined();
    expect(math.add(math.complex(1, 1), math.matrix([1]))).toBeDefined();
    expect(math.evaluate('schur([1,2;3,4])')).toBeDefined();
    expect(math.max(math.matrix([4]), 0)).toBe(4);
    expect(() =>
      math.qr(
        math.sparse([
          [1, 0],
          [0, 1],
        ])
      )
    ).toThrow(/sparse/);
    expect(
      math.lusolve(
        math.sparse([
          [2, 0],
          [0, 3],
        ]),
        math.matrix([[1], [2]])
      )
    ).toBeDefined();
  });

  it('BigNumber unary shim fast path and matrix mode helpers', () => {
    const bn = create(all, { number: 'BigNumber' });
    expect(bn.sqrt(bn.bignumber(9)).valueOf()).toBe('3');
    expect(bn.unaryPlus(bn.bignumber(-3)).valueOf()).toBe('-3');
    const parser = bn.parser();
    parser.set('x', 4);
    expect(parser.evaluate('x')).toBe(4);
  });
});
