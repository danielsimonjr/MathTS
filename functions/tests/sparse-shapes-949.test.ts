import { describe, it, expect } from 'vitest';
// Issue #949: the factory sparse paths read the CSC form; the public SparseMatrix is CSR.
// Imported by package name (built dist), the way a consumer calls it.
import * as F from '@danielsimonjr/mathts-functions';
import { SparseMatrix, DenseMatrix } from '@danielsimonjr/mathts-matrix';

const A = [
  [1, 0, 3],
  [0, 2, 0],
];
const B = [
  [4, 0, 0],
  [0, 5, 6],
];
const toSparse = (rows: number[][]): SparseMatrix =>
  SparseMatrix.fromDense(DenseMatrix.fromArray(rows));
type Fn = (...a: unknown[]) => unknown;
const exportsOf = F as unknown as Record<string, Fn>;
// `factory_<name>` is the mathjs-shaped factory function where the typed layer owns `<name>`.
const fn = (name: string): Fn => exportsOf[`factory_${name}`] ?? exportsOf[name]!;
// A sparse result stores a false predicate as an implicit 0, so booleans compare as numbers.
const num = (rows: unknown): unknown =>
  (rows as unknown[][]).map((row) => row.map((v) => (typeof v === 'boolean' ? Number(v) : v)));
const elementwise = (f: Fn, a: number[][], b: number[][] | number): unknown[][] =>
  num(
    a.map((row, i) => row.map((v, j) => f(v, typeof b === 'number' ? b : b[i]![j]!)))
  ) as unknown[][];
const plain = (x: unknown): unknown => {
  const o = x as { toArray?: () => unknown };
  return typeof o?.toArray === 'function' ? o.toArray() : x;
};

const ARG_FOR: Record<string, () => unknown> = {
  SparseMatrix: () =>
    toSparse([
      [1, 0],
      [0, 2],
    ]),
  Matrix: () =>
    toSparse([
      [1, 0],
      [0, 2],
    ]),
  DenseMatrix: () =>
    DenseMatrix.fromArray([
      [1, 0],
      [0, 2],
    ]),
  Array: () => [
    [1, 0],
    [0, 2],
  ],
  number: () => 2,
  any: () => 2,
  string: () => 'a',
  boolean: () => true,
};

describe('issue #949: one SparseMatrix contract for the factory functions', () => {
  it('no typed signature with a SparseMatrix argument leaks the CSC internals', () => {
    const leaks: string[] = [];
    let called = 0;
    for (const name of Object.keys(F).sort()) {
      const f = fn(name) as unknown as { signatures?: Record<string, unknown> } & ((
        ...a: unknown[]
      ) => unknown);
      if (typeof f !== 'function' || !f.signatures) continue;
      for (const sig of Object.keys(f.signatures)) {
        const types = sig.split(',').map((t) => t.trim());
        if (!types.some((t) => t.includes('SparseMatrix'))) continue;
        const make = types.map((t) => ARG_FOR[t]);
        if (make.some((m) => m === undefined)) continue;
        called++;
        try {
          f(...make.map((m) => m!()));
        } catch (e) {
          const msg = String((e as Error).message);
          if (/is not a function|Pattern Sparse Matrix/.test(msg))
            leaks.push(`${name}(${sig}): ${msg}`);
        }
      }
    }
    expect(called).toBeGreaterThan(100);
    expect(leaks).toEqual([]);
  });

  const binary = [
    'dotDivide',
    'dotMultiply',
    'compare',
    'equal',
    'larger',
    'smaller',
    'largerEq',
    'smallerEq',
    'gcd',
    'lcm',
    'mod',
    'atan2',
    'subtract',
  ];
  const B1 = B.map((r) => r.map((v) => v + 1));
  for (const name of binary) {
    it(`${name}: sparse operands match the scalar result`, () => {
      const f = fn(name);
      const expected = elementwise(f, A, B1);
      expect(num(plain(f(toSparse(A), toSparse(B1))))).toEqual(expected);
      expect(num(plain(f(toSparse(A), DenseMatrix.fromArray(B1))))).toEqual(expected);
      expect(num(plain(f(DenseMatrix.fromArray(A), toSparse(B1))))).toEqual(expected);
    });
  }

  for (const name of ['abs', 'ceil', 'floor', 'round']) {
    it(`${name}: a sparse operand matches the array result`, () => {
      const m = [
        [1.5, 0],
        [0, 2.25],
      ];
      expect(plain(fn(name)(toSparse(m)))).toEqual(m.map((r) => r.map((v) => fn(name)(v))));
    });
  }

  for (const [name, scalar] of [
    ['ceil', 1],
    ['floor', 1],
    ['dotPow', 2],
    ['atan2', 1],
  ] as const) {
    it(`${name}: a sparse matrix and a scalar match the array result`, () => {
      const m = [
        [1.5, 0],
        [0, 2.25],
      ];
      expect(num(plain(fn(name)(toSparse(m), scalar)))).toEqual(elementwise(fn(name), m, scalar));
    });
  }

  it('returns the public SparseMatrix for numeric sparse results (sparse in, sparse out)', () => {
    for (const out of [
      fn('dotMultiply')(toSparse(A), toSparse(A)),
      fn('dotDivide')(toSparse(A), toSparse(A.map((r) => r.map((v) => v + 1)))),
      fn('ceil')(
        toSparse([
          [1.5, 0],
          [0, 2.25],
        ])
      ),
      fn('inv')(
        toSparse([
          [1, 0],
          [0, 2],
        ])
      ),
    ]) {
      expect(out).toBeInstanceOf(SparseMatrix);
    }
  });

  it('dotMultiply of two sparse matrices keeps only the shared non-zeros', () => {
    const r = fn('dotMultiply')(toSparse(A), toSparse(B)) as SparseMatrix;
    expect(r.toArray()).toEqual([
      [4, 0, 0],
      [0, 10, 0],
    ]);
    expect(r.nnz).toBe(2);
  });

  it('an unsupported signature names the shape and toDense()', () => {
    expect(() => fn('flatten')(toSparse(A))).toThrow(/SparseMatrix.*toDense\(\)/s);
  });

  it('the CSC form of a result reports density()', () => {
    // nthRoot reads y.density() on a sparse root.
    const x = [
      [4, 0],
      [0, 9],
    ];
    const y = [
      [2, 1],
      [1, 2],
    ];
    expect(num(plain(fn('nthRoot')(toSparse(x), toSparse(y))))).toEqual(
      elementwise(fn('nthRoot'), x, y)
    );
  });
});
