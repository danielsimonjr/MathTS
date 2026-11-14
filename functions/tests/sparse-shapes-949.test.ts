import { describe, it, expect } from 'vitest';
// Issue #949: the factory sparse paths read the CSC form; the public SparseMatrix is CSR.
// The sweep and the class table import the built package, the way a consumer calls it.
import * as F from '@danielsimonjr/mathts-functions';
import { SparseMatrix, DenseMatrix } from '@danielsimonjr/mathts-matrix';
import { mathTyped } from '@danielsimonjr/mathts-core';
import { factoryScope } from '../src/factories/scope.js';
import { MathJSSparseMatrix } from '../src/factories/matrix-bridge.js';
import { adaptSparse, cscToPublic } from '../src/factories/sparse-adapter.js';
import '../src/factories/index.js';

type Fn = (...a: unknown[]) => unknown;
const exportsOf = F as unknown as Record<string, Fn>;
// `factory_<name>` is the mathjs-shaped factory function where the typed layer owns `<name>`.
const fn = (name: string): Fn => exportsOf[`factory_${name}`] ?? exportsOf[name]!;

const toSparse = (rows: number[][]): SparseMatrix =>
  SparseMatrix.fromDense(DenseMatrix.fromArray(rows));

const A = [
  [1, 0, 3],
  [0, 2, 0],
];
const B = [
  [4, 0, 0],
  [0, 5, 6],
];
const B1 = B.map((r) => r.map((v) => v + 1));
const C = [
  [1, 0],
  [0, 1],
  [1, 1],
];
const SQ = [
  [1, 0],
  [0, 2],
];

/** The kind of a result: a public sparse matrix, any other matrix or Array, or a scalar. */
function kindOf(x: unknown): 'sparse' | 'dense' | 'scalar' {
  if (x instanceof SparseMatrix) return 'sparse';
  if (Array.isArray(x)) return 'dense';
  if (
    x !== null &&
    typeof x === 'object' &&
    typeof (x as { toArray?: unknown }).toArray === 'function'
  )
    return 'dense';
  return 'scalar';
}

/** True when the CSC class of the factory sparse algorithms is anywhere in `x`. */
function leaksCsc(x: unknown): boolean {
  if (x instanceof MathJSSparseMatrix) return true;
  if (Array.isArray(x)) return x.some(leaksCsc);
  if (x !== null && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype) {
    return Object.values(x).some(leaksCsc);
  }
  return false;
}

/** A result as plain nested values: a matrix as its Array, an object field by field, -0 as 0. */
const nested = (x: unknown): unknown => {
  if (typeof (x as { toArray?: unknown })?.toArray === 'function') {
    return nested((x as { toArray(): unknown }).toArray());
  }
  if (Array.isArray(x)) return x.map(nested);
  if (typeof x === 'number') return x + 0;
  if (x !== null && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype) {
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, nested(v)]));
  }
  return x;
};
/** Booleans as 0 and 1, to compare a sparse result (numbers only) with a boolean Array. */
const numeric = (x: unknown): unknown =>
  Array.isArray(x)
    ? x.map(numeric)
    : typeof x === 'boolean'
      ? Number(x)
      : x !== null && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype
        ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, numeric(v)]))
        : x;

const ARG_FOR: Record<string, () => unknown> = {
  SparseMatrix: () => toSparse(SQ),
  Matrix: () => toSparse(SQ),
  DenseMatrix: () => DenseMatrix.fromArray(SQ),
  Array: () => SQ.map((r) => r.slice()),
  number: () => 2,
  any: () => 2,
  string: () => 'a',
  boolean: () => true,
};
/** The array form of the same argument, for the oracle call. */
const ARRAY_FOR: Record<string, () => unknown> = {
  ...ARG_FOR,
  SparseMatrix: () => SQ.map((r) => r.slice()),
  Matrix: () => SQ.map((r) => r.slice()),
  DenseMatrix: () => SQ.map((r) => r.slice()),
};

// A sparse matrix holds an implicit 0 where an Array holds a stored 0, so `0 / 0` is 0 in the
// sparse result and NaN in the Array result: the two calls differ by design here.
const SPARSE_ZERO_DIVISION = new Set(['dotDivide']);

// A call that raises one of these is a domain error of the arguments, not a shape error.
const ALLOWED_ERRORS: RegExp[] = [
  /Expected a column vector/, // dot of two matrices
  /Root must be non-zero/, // nthRoot of the diagonal matrix
  /Dimension mismatch\. Matrix columns must match vector length/, // solver, 2x2 right-hand side
  /Partial pivoting threshold must be a number from 0 to 1/, // lusolve, slu: threshold 2
  /^SparseMatrix is not supported by function flatten.*toDense\(\)/s, // flatten refuses 2-D sparse
];

describe('issue #949: one SparseMatrix contract for the factory functions', () => {
  it('every signature with a SparseMatrix argument returns, matches the Array call, and never leaks the CSC class', () => {
    const problems: string[] = [];
    let called = 0;
    let compared = 0;
    for (const name of Object.keys(exportsOf).sort()) {
      const f = fn(name) as Fn & { signatures?: Record<string, unknown> };
      if (typeof f !== 'function' || !f.signatures) continue;
      for (const sig of Object.keys(f.signatures)) {
        const types = sig.split(',').map((t) => t.trim());
        if (!types.some((t) => t.includes('SparseMatrix'))) continue;
        if (types.some((t) => ARG_FOR[t] === undefined)) continue;
        called++;
        let result: unknown;
        try {
          result = f(...types.map((t) => ARG_FOR[t]!()));
        } catch (e) {
          const msg = String((e as Error).message);
          if (!ALLOWED_ERRORS.some((re) => re.test(msg))) problems.push(`${name}(${sig}): ${msg}`);
          continue;
        }
        if (leaksCsc(result)) problems.push(`${name}(${sig}): result holds the CSC class`);
        // The same call on Arrays is the oracle for the shape and the values.
        let expected: unknown;
        try {
          expected = f(...types.map((t) => ARRAY_FOR[t]!()));
        } catch {
          continue;
        }
        compared++;
        const got = numeric(nested(result));
        const want = numeric(nested(expected));
        if (!SPARSE_ZERO_DIVISION.has(name) && JSON.stringify(got) !== JSON.stringify(want)) {
          problems.push(
            `${name}(${sig}): ${JSON.stringify(got)} differs from the Array result ${JSON.stringify(want)}`
          );
        }
      }
    }
    expect(called).toBeGreaterThan(150);
    expect(compared).toBeGreaterThan(100);
    expect(problems).toEqual([]);
  });

  // The return class of a call with a public sparse operand follows mathjs: two sparse
  // operands, or a sparse operand and a number for a function that keeps a zero, give a
  // sparse result; a number added to a sparse operand, and a comparison with a number, give a
  // dense result. Expected classes below come from the same calls in mathjs 15.
  const SP = 'sparse' as const;
  const DN = 'dense' as const;
  const classTable: [string, unknown[], 'sparse' | 'dense'][] = [
    ['add', [toSparse(A), toSparse(B)], SP],
    ['add', [toSparse(A), 2], DN],
    ['add', [2, toSparse(A)], DN],
    ['subtract', [toSparse(A), toSparse(B)], SP],
    ['subtract', [toSparse(A), 2], DN],
    ['subtract', [2, toSparse(A)], DN],
    ['multiply', [toSparse(A), toSparse(C)], SP],
    ['multiply', [toSparse(A), 2], SP],
    ['multiply', [2, toSparse(A)], SP],
    ['divide', [toSparse(A), 2], SP],
    ['divide', [2, toSparse(SQ)], SP],
    ['dotMultiply', [toSparse(A), toSparse(B)], SP],
    ['dotMultiply', [toSparse(A), 2], SP],
    ['dotDivide', [toSparse(A), toSparse(B1)], SP],
    ['dotDivide', [toSparse(A), 2], SP],
    ['dotPow', [toSparse(A), 2], SP],
    ['mod', [toSparse(A), 2], SP],
    ['atan2', [toSparse(A), toSparse(B)], SP],
    ['gcd', [toSparse(A), toSparse(B)], SP],
    ['lcm', [toSparse(A), toSparse(B1)], SP],
    ['abs', [toSparse(A)], SP],
    ['ceil', [toSparse(A)], SP],
    ['round', [toSparse(A)], SP],
    ['sign', [toSparse(A)], SP],
    ['unaryMinus', [toSparse(A)], SP],
    ['transpose', [toSparse(A)], SP],
    ['inv', [toSparse(SQ)], SP],
    ['compare', [toSparse(A), toSparse(B)], SP],
    ['compare', [toSparse(A), 2], DN],
    ['equal', [toSparse(A), toSparse(B)], SP],
    ['equal', [toSparse(A), 2], DN],
    ['larger', [toSparse(A), toSparse(B)], SP],
    ['larger', [toSparse(A), 2], DN],
    ['smaller', [toSparse(A), toSparse(B)], SP],
    ['smaller', [toSparse(A), 2], DN],
  ];
  for (const [name, args, kind] of classTable) {
    const label = args.map((a) => (a instanceof SparseMatrix ? 'S' : String(a))).join(', ');
    it(`${name}(${label}) returns a ${kind} matrix`, () => {
      const result = fn(name)(...args);
      expect(kindOf(result)).toBe(kind);
      expect(result).not.toBeInstanceOf(MathJSSparseMatrix);
    });
  }

  it('a sum, a difference and a product of two sparse operands hold the right values', () => {
    expect((fn('add')(toSparse(A), toSparse(B)) as SparseMatrix).toArray()).toEqual([
      [5, 0, 3],
      [0, 7, 6],
    ]);
    expect((fn('subtract')(toSparse(A), toSparse(B)) as SparseMatrix).toArray()).toEqual([
      [-3, 0, 3],
      [0, -3, -6],
    ]);
    const product = fn('multiply')(toSparse(A), toSparse(C)) as SparseMatrix;
    expect(product.toArray()).toEqual([
      [4, 3],
      [0, 2],
    ]);
    expect([product.rows, product.cols]).toEqual([2, 2]);
  });

  it('a boolean result of two sparse operands is a SparseMatrix of 0 and 1', () => {
    // The public class stores numbers: 1 is true and 0 is false.
    const r = fn('equal')(toSparse(A), toSparse(B)) as SparseMatrix;
    expect(r).toBeInstanceOf(SparseMatrix);
    expect(r.toArray()).toEqual([
      [0, 1, 0],
      [1, 0, 0],
    ]);
    expect(r.nnz).toBe(2);
  });

  it('a boolean result with a number is a dense matrix of booleans', () => {
    const r = fn('larger')(toSparse(A), 1) as { toArray(): unknown };
    expect(kindOf(r)).toBe('dense');
    expect(r.toArray()).toEqual([
      [false, false, true],
      [false, true, false],
    ]);
  });

  it('a mixed public DenseMatrix and SparseMatrix call works in both orders', () => {
    const expected = [
      [4, 0, 0],
      [0, 10, 0],
    ];
    expect(nested(fn('dotMultiply')(toSparse(A), DenseMatrix.fromArray(B)))).toEqual(expected);
    expect(nested(fn('dotMultiply')(DenseMatrix.fromArray(A), toSparse(B)))).toEqual(expected);
  });

  it('dotMultiply of two sparse matrices keeps only the shared non-zeros', () => {
    const r = fn('dotMultiply')(toSparse(A), toSparse(B)) as SparseMatrix;
    expect(r.toArray()).toEqual([
      [4, 0, 0],
      [0, 10, 0],
    ]);
    expect(r.nnz).toBe(2);
  });

  it('a sparse matrix with a stored zero gives the same result as without it', () => {
    const stored = new SparseMatrix(2, 2, [0, 5], [0, 1], [0, 1, 2]);
    expect(stored.nnz).toBe(2);
    expect((fn('abs')(stored) as SparseMatrix).toArray()).toEqual([
      [0, 0],
      [0, 5],
    ]);
  });

  it('an empty sparse matrix gives a sparse result of the same shape', () => {
    const e = new SparseMatrix(3, 0, [], [], [0, 0, 0, 0]);
    const r = fn('dotMultiply')(e, e) as SparseMatrix;
    expect([r.rows, r.cols]).toEqual([3, 0]);
    expect(r).toBeInstanceOf(SparseMatrix);
  });

  it('the density() of a CSC result serves nthRoot', () => {
    const x = [
      [4, 0],
      [0, 9],
    ];
    const y = [
      [2, 1],
      [1, 2],
    ];
    expect(nested(fn('nthRoot')(toSparse(x), toSparse(y)))).toEqual(nested(fn('nthRoot')(x, y)));
  });
});

describe('issue #949: public comparison functions are scalar-only', () => {
  // `equal`, `compare`, `larger`, `smaller`, `largerEq` and `smallerEq` of the public package
  // hold scalar signatures only. They reject every collection, so a public SparseMatrix is
  // refused the same as an Array or a DenseMatrix. `factory_<name>` takes the collections.
  for (const name of ['equal', 'compare', 'larger', 'smaller', 'largerEq', 'smallerEq']) {
    it(`${name} rejects a collection of every class with a TypeError`, () => {
      const f = exportsOf[name]!;
      for (const arg of [toSparse(SQ), DenseMatrix.fromArray(SQ), SQ]) {
        expect(() => f(arg, arg)).toThrow(TypeError);
        expect(() => f(arg, 1)).toThrow(TypeError);
      }
    });
    it(`factory_${name} takes a public SparseMatrix`, () => {
      const f = exportsOf[`factory_${name}`]!;
      expect(f(toSparse(SQ), toSparse(SQ))).toBeInstanceOf(SparseMatrix);
    });
  }
});

describe('issue #949: an unsupported signature names the shape and toDense()', () => {
  it('flatten', () => {
    expect(() => fn('flatten')(toSparse(A))).toThrow(/SparseMatrix.*toDense\(\)/s);
  });

  it('a function without the argument type rethrows with the hint', () => {
    const scalarOnly = adaptSparse(
      mathTyped('scalarOnly', { number: (x: number) => x }) as unknown as Fn,
      'scalarOnly'
    );
    expect(() => scalarOnly(toSparse(SQ))).toThrow(
      /scalarOnly does not accept a SparseMatrix.*toDense\(\)/s
    );
  });

  it('rethrows only when the mismatched argument is the sparse one', () => {
    const f = adaptSparse(
      mathTyped('pair', {
        'SparseMatrix, number': (_m: unknown, n: number) => n,
      }) as unknown as Fn,
      'pair'
    );
    // Argument 1 is the wrong one, and it is a string: the original error stays.
    expect(() => f(toSparse(SQ), {})).toThrow(/Unexpected type of argument in function pair/);
    expect(() => f(toSparse(SQ), {})).not.toThrow(/toDense/);
  });

  it('does not relabel the error of a nested call inside an implementation', () => {
    const inner = mathTyped('inner', { number: (x: number) => x });
    const outer = adaptSparse(
      mathTyped('outer', {
        SparseMatrix: (m: unknown) => (inner as unknown as Fn)(m),
      }) as unknown as Fn,
      'outer'
    );
    // `inner` rejects the matrix at its index 0, as `outer` would: only the name differs.
    expect(() => outer(toSparse(SQ))).toThrow(/Unexpected type of argument in function inner/);
    expect(() => outer(toSparse(SQ))).not.toThrow(/toDense/);
  });
});

describe('issue #949: the output rule of cscToPublic', () => {
  const csc = (values: unknown[] | null): MathJSSparseMatrix =>
    new MathJSSparseMatrix({
      values: values as never,
      index: [0, 1],
      ptr: [0, 1, 2],
      size: [2, 2],
    });

  it('keeps numbers', () => {
    const r = cscToPublic(csc([3, 4]));
    expect(r).toBeInstanceOf(SparseMatrix);
    expect((r as SparseMatrix).toArray()).toEqual([
      [3, 0],
      [0, 4],
    ]);
  });

  it('stores true as 1 and false as 0', () => {
    const r = cscToPublic(csc([true, false])) as SparseMatrix;
    expect(r).toBeInstanceOf(SparseMatrix);
    expect(r.toArray()).toEqual([
      [1, 0],
      [0, 0],
    ]);
    expect(r.nnz).toBe(1);
  });

  it('stores 1 for each position of a pattern matrix', () => {
    const r = cscToPublic(csc(null)) as SparseMatrix;
    expect(r.toArray()).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });

  it('returns the nested Array when an entry is not a number or a boolean', () => {
    const r = cscToPublic(csc(['a', 'b']));
    expect(r).not.toBeInstanceOf(SparseMatrix);
    expect(r).toEqual([
      ['a', 0],
      [0, 'b'],
    ]);
  });
});

describe('issue #949: factoryScope.typed keeps the behaviour of mathTyped', () => {
  const scoped = factoryScope.typed as unknown as typeof mathTyped;

  it('exposes the same helper functions as mathTyped', () => {
    for (const key of ['find', 'convert', 'referTo', 'referToSelf', 'findSignature', 'addTypes']) {
      expect(typeof (scoped as unknown as Record<string, unknown>)[key]).toBe(
        typeof (mathTyped as unknown as Record<string, unknown>)[key]
      );
    }
  });

  it('builds a working function, and referToSelf works inside it', () => {
    const fact = scoped('fact', {
      number: scoped.referToSelf(
        (self) => (n: number) =>
          n <= 1 ? 1 : n * (self as unknown as (m: number) => number)(n - 1)
      ),
    }) as unknown as (n: number) => number;
    expect(fact(5)).toBe(120);
  });

  it('find and convert called on the scoped typed read the same registry', () => {
    const f = scoped('twice', { number: (x: number) => 2 * x }) as unknown as Fn;
    const found = (scoped as unknown as { find: (f: Fn, s: string) => Fn }).find(f, 'number');
    expect(found(4)).toBe(8);
    expect(scoped.convert).toBe(mathTyped.convert);
  });

  it('a function that declares no matrix type is the plain typed function', () => {
    const f = scoped('plain', { number: (x: number) => x + 1 }) as unknown as {
      signatures: object;
    };
    expect(Object.keys(f.signatures)).toEqual(['number']);
  });
});

describe('issue #949: divide(scalar, matrix) in the factory scope', () => {
  // The factory `pinv` was built while `add` and `multiply` of the scope were still the scalar
  // stubs, and it called `Complex(1, 1)` without `new`. `divide(scalar, Array)` failed with
  // "Class constructor Complex cannot be invoked without 'new'".
  it('divides a number by an Array', () => {
    expect(nested(fn('divide')(2, SQ))).toEqual([
      [2, 0],
      [0, 1],
    ]);
  });
});
