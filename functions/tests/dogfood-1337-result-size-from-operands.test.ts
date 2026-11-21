/**
 * One mechanism, one rule (#1337): a result matrix takes its size from the operands, never from its
 * nested data. The nested form `[]` is a 0 x 0 matrix and every 0 x n matrix, and `arraySize([])` is
 * `[0]`, so a result rebuilt from nested data loses the second axis of a 0 x n result.
 *
 * Every site that builds a matrix from nested result data has a case below. The oracle is the
 * mathjs devDependency (15.2.0); a case where mathjs throws or gives a size that its own nested
 * data lost is stated as such.
 */
import { describe, expect, it } from 'vitest';
import * as mj from 'mathjs';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  add,
  concat,
  diag,
  bignumber,
  det,
  divide,
  expm,
  inv,
  matrix,
  multiply,
  pinv,
  pow,
  random,
  subtract,
  zeros,
} from '../src/index.js';
import { MathJSSparseMatrix } from '../src/factories/matrix-bridge.js';

type Bin = (a: unknown, b: unknown) => unknown;
type Boxed = { size(): number[]; toArray(): unknown; storage?: () => string };
const M = mj.create(mj.all);
const size = (r: unknown): number[] =>
  typeof (r as Boxed).size === 'function'
    ? (r as Boxed).size()
    : [(r as { rows: number }).rows, (r as { cols: number }).cols];
const csr = (r: number, c: number) => SparseMatrix.fromDense(DenseMatrix.zeros(r, c));
const sizes: [number, number][] = [
  [0, 0],
  [0, 3],
  [3, 0],
];

describe('S1 element-wise result: elementwiseMatrixNumber, denseOfSize', () => {
  for (const [name, f, g] of [
    ['add', add as Bin, M.add as Bin],
    ['subtract', subtract as Bin, M.subtract as Bin],
  ] as const) {
    for (const [r, c] of sizes) {
      it(`${name}(zeros(${r},${c}), zeros(${r},${c})) has size [${r},${c}] (mathjs: same)`, () => {
        expect(size(g(M.zeros(r, c), M.zeros(r, c)))).toEqual([r, c]);
        expect(size(f(zeros(r, c), zeros(r, c)))).toEqual([r, c]);
      });
    }
  }
  it('a matrix with a zero axis and a scalar keeps its size (mathjs: same)', () => {
    expect(size(M.add(M.zeros(0, 3), 2))).toEqual([0, 3]);
    expect(size((add as Bin)(zeros(0, 3), 2))).toEqual([0, 3]);
    expect(size((subtract as Bin)(1, zeros(0, 3)))).toEqual([0, 3]);
    expect(size((multiply as Bin)(zeros(0, 3), 2))).toEqual([0, 3]);
  });
  it('sizes that cannot broadcast throw a RangeError (mathjs throws too)', () => {
    expect(() => M.add(M.zeros(0, 3), M.zeros(0, 2))).toThrow();
    expect(() => (add as Bin)(zeros(0, 3), zeros(0, 2))).toThrow(RangeError);
  });
  it('the size [0] has no second axis, so the other operand gives the size (mathjs: [0])', () => {
    expect(size(M.add(M.matrix([]), M.zeros(0, 3)))).toEqual([0]);
    expect(size((add as Bin)(matrix([]), zeros(0, 3)))).toEqual([0, 3]);
    expect(size((add as Bin)(zeros(0, 3), matrix([])))).toEqual([0, 3]);
    expect(size((subtract as Bin)(zeros(0, 3), matrix([])))).toEqual([0, 3]);
    expect(size((add as Bin)(matrix([]), matrix([])))).toEqual([0]);
    expect(size((add as Bin)(matrix([]), 2))).toEqual([0]);
    expect(() => (add as Bin)(matrix([]), zeros(2, 3))).toThrow(RangeError);
  });
  it('a size drives the result, a non-empty result keeps its size', () => {
    expect(size((add as Bin)(zeros(2, 3), zeros(1, 3)))).toEqual([2, 3]);
    expect(size((add as Bin)(zeros(2, 1), zeros(1, 3)))).toEqual([2, 3]);
  });
});

describe('S2 matrix product: matrixProduct, genericMatrixProduct, denseMatrixProduct', () => {
  const mul = multiply as Bin;
  const cases: [number, number, number, number][] = [
    [0, 2, 2, 0],
    [0, 3, 3, 2],
    [2, 3, 3, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 3],
    [3, 0, 0, 0],
  ];
  for (const [ar, ac, br, bc] of cases) {
    it(`multiply(zeros(${ar},${ac}), zeros(${br},${bc})) has size [${ar},${bc}] (mathjs: same)`, () => {
      expect(size(M.multiply(M.zeros(ar, ac), M.zeros(br, bc)))).toEqual([ar, bc]);
      expect(size(mul(zeros(ar, ac), zeros(br, bc)))).toEqual([ar, bc]);
    });
  }
  it('an inner length of 0 gives the empty sums, a matrix of zeros (mathjs throws a TypeError)', () => {
    const r = mul(zeros(2, 0), zeros(0, 2)) as Boxed;
    expect(r.size()).toEqual([2, 2]);
    expect(r.toArray()).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });
  it('a product with an entry that is not a number keeps the size of the operands', () => {
    const a = matrix([[bignumber(1), bignumber(2)]]);
    expect(size(mul(a, zeros(2, 0)))).toEqual([1, 0]);
    expect(size(mul(zeros(0, 1), a))).toEqual([0, 2]);
  });
  it('a product with mismatched inner sizes still throws', () => {
    expect(() => mul(zeros(0, 2), zeros(3, 0))).toThrow(
      /Cannot multiply 0×2 matrix with 3×0 matrix/
    );
  });
  it('a non-empty product is unchanged', () => {
    const r = mul(
      matrix([
        [1, 2],
        [3, 4],
      ]),
      matrix([[5], [6]])
    ) as Boxed;
    expect(r.size()).toEqual([2, 1]);
    expect(r.toArray()).toEqual([[17], [39]]);
  });
});

describe('S3 vector product: vectorProduct, matrixVectorProduct, denseVectorProduct', () => {
  const mul = multiply as Bin;
  it('a matrix with 0 rows times a vector is an empty vector (mathjs: same)', () => {
    expect(size(M.multiply(M.zeros(0, 2), M.matrix([1, 2])))).toEqual([0]);
    expect(size(mul(zeros(0, 2), matrix([1, 2])))).toEqual([0]);
  });
  it('a vector times a matrix with 0 columns is an empty vector (mathjs: same)', () => {
    expect(size(M.multiply(M.matrix([1, 2]), M.zeros(2, 0)))).toEqual([0]);
    expect(size(mul(matrix([1, 2]), zeros(2, 0)))).toEqual([0]);
  });
  it('a vector times a matrix with 0 rows is a vector of zeros', () => {
    const r = mul(matrix([]), zeros(0, 3)) as Boxed;
    expect(r.toArray()).toEqual([0, 0, 0]);
  });
});

describe('S4 sparse results: publicSparseOrDense, sparseOfSize, sparse-product', () => {
  it('add and subtract of public CSR matrices with a zero axis give a SparseMatrix of that size', () => {
    for (const [r, c] of sizes) {
      for (const f of [add as Bin, subtract as Bin]) {
        const out = f(csr(r, c), csr(r, c));
        expect(out instanceof SparseMatrix).toBe(true);
        expect(size(out)).toEqual([r, c]);
      }
    }
  });
  it('add of CSC matrices with a zero axis keeps the size', () => {
    const csc = (r: number, c: number) =>
      new MathJSSparseMatrix({
        values: [],
        index: [],
        ptr: new Array(c + 1).fill(0),
        size: [r, c],
      });
    expect(size((add as Bin)(csc(0, 3), csc(0, 3)))).toEqual([0, 3]);
    expect(size((add as Bin)(csc(3, 0), csc(3, 0)))).toEqual([3, 0]);
  });
  it('a public CSR matrix times a public CSR matrix with a zero axis is a SparseMatrix', () => {
    const out = (multiply as Bin)(csr(0, 2), csr(2, 0));
    expect(out instanceof SparseMatrix).toBe(true);
    expect(size(out)).toEqual([0, 0]);
  });
});

describe('S5 pinv: pinvData, boxedShape', () => {
  it('pinv of a 0 x 3 matrix is a 3 x 0 matrix (mathjs: same)', () => {
    expect(size(M.pinv(M.zeros(0, 3)))).toEqual([3, 0]);
    expect(size(pinv(zeros(0, 3) as never))).toEqual([3, 0]);
  });
  it('pinv of a 3 x 0 matrix is a 0 x 3 matrix (mathjs throws a RangeError)', () => {
    expect(size(pinv(zeros(3, 0) as never))).toEqual([0, 3]);
  });
  it('the rcond option keeps the size', () => {
    const r = (pinv as unknown as Bin)(zeros(0, 3), { rcond: 1e-6 });
    expect(size(r)).toEqual([3, 0]);
  });
  it('a 1-D matrix gives a 1-D result of the same length (mathjs [2]; it was [2, 1])', () => {
    expect(size(pinv(matrix([3, 4]) as never))).toEqual([2]);
  });
});

describe('S6 consumers of the size: a lost second axis was read as a 0 x 0 matrix', () => {
  const lost = () => (add as Bin)(zeros(0, 3), zeros(0, 3));
  it('det, inv, expm and pow of a 0 x 3 sum throw, as mathjs throws', () => {
    expect(() => M.det(M.add(M.zeros(0, 3), M.zeros(0, 3)))).toThrow(RangeError);
    expect(() => (det as (a: unknown) => unknown)(lost())).toThrow(RangeError);
    expect(() => (inv as (a: unknown) => unknown)(lost())).toThrow(RangeError);
    expect(() => (expm as (a: unknown) => unknown)(lost())).toThrow(/square/);
    expect(() => (pow as Bin)(lost(), 2)).toThrow(RangeError);
  });
});

describe('S7 random takes the requested size', () => {
  it('random(matrix([0, 3])) is a 0 x 3 matrix; mathjs gives [0] (its nested data lost the axis)', () => {
    expect(size(M.random(M.matrix([0, 3])))).toEqual([0]);
    expect(size((random as (a: unknown) => unknown)(matrix([0, 3])))).toEqual([0, 3]);
    expect(size((random as (a: unknown) => unknown)(matrix([2, 3])))).toEqual([2, 3]);
  });
});

describe('S8 the class guard: one constructor, no size read from the result data', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []
    );
  const files = ['functions/src', 'compat/src'].flatMap((d) => walk(join(root, d)));
  const rel = (file: string) => relative(root, file).split(sep).join('/');
  // Allowed: matrix-bridge.ts defines the boxed class and the one constructor (`denseOfSize`);
  // scope.ts holds `createDenseMatrix`, the constructor that the mathjs factories call with their
  // own `{ data, size }` storage object.
  const allowed = new Set([
    'functions/src/factories/matrix-bridge.ts',
    'functions/src/factories/scope.ts',
  ]);
  it('no file under functions/src or compat/src but the two allowed calls `new MathJSDenseMatrix(`', () => {
    const hits = files
      .filter((file) => readFileSync(file, 'utf8').includes('new MathJSDenseMatrix('))
      .map(rel)
      .filter((name) => !allowed.has(name));
    expect(hits).toEqual([]);
  });
  it('no file under functions/src or compat/src passes arraySize(...) as the size of a result', () => {
    const call = new RegExp(String.raw`(denseOfSize|sparseOfSize)\([^;]*?arraySize\(`, 's');
    const hits = files.filter((file) => call.test(readFileSync(file, 'utf8'))).map(rel);
    expect(hits).toEqual([]);
  });
});

describe('S9 a 3-D operand keeps the error of mathjs (collectionSize reads every axis of an Array)', () => {
  const A3 = [
    [
      [1, 2],
      [3, 4],
    ],
    [
      [5, 6],
      [7, 8],
    ],
  ];
  const M22 = () =>
    matrix([
      [1, 2],
      [3, 4],
    ]);
  it('multiply of a matrix and a 3-D Array throws the dimension error, in both orders', () => {
    const mul = multiply as Bin;
    expect(() =>
      M.multiply(
        M.matrix([
          [1, 2],
          [3, 4],
        ]),
        A3
      )
    ).toThrow(/1 or 2 dimensional/);
    expect(() => mul(M22(), A3)).toThrow(/Matrix B has 3 dimensions/);
    expect(() => mul(A3, M22())).toThrow(/Matrix A has 3 dimensions/);
  });
  it('divide(scalar, 3-D) throws mathjs RangeError, for an Array and for a matrix', () => {
    const div = M.divide as Bin;
    expect(() => div(2, A3)).toThrow(/must be two dimensional/);
    expect(() => (divide as Bin)(2, A3)).toThrow(/must be two dimensional/);
    expect(() => (divide as Bin)(2, matrix(A3))).toThrow(/must be two dimensional/);
  });
});

// #1337 names concat and diag too. mathjs 15.2.0 gives the size [0] for both: concat joins the
// nested data of two 0 x 0 matrices along the last axis, and the diagonal of a 0 x 0 matrix is a
// vector of length 0. MathTS gives the same size, so these items are parity, not a defect.
describe('#1337 concat and diag of 0 x 0 matrices: the size [0], as in mathjs', () => {
  type Un = (...a: unknown[]) => unknown;
  it('concat(zeros(0, 0), zeros(0, 0)) and diag(zeros(0, 0)) have the size [0]', () => {
    expect(size(M.concat(M.zeros(0, 0), M.zeros(0, 0)))).toEqual([0]);
    expect(size((concat as Un)(zeros(0, 0), zeros(0, 0)))).toEqual([0]);
    expect(size(M.diag(M.zeros(0, 0)))).toEqual([0]);
    expect(size((diag as Un)(zeros(0, 0)))).toEqual([0]);
  });
});
