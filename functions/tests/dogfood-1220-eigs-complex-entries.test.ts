import { describe, it, expect } from 'vitest';
import { eigs, complex, matrix, sparse, bignumber, fraction, unit } from '../src/index.js';

type Ri = { re: number; im: number };
const toRi = (x: unknown): Ri => {
  if (typeof x === 'number') return { re: x, im: 0 };
  const o = x as { re: number; im: number };
  return { re: o.re, im: o.im };
};
type Res = { values: unknown[]; eigenvectors?: { value: unknown; vector: unknown }[] };
const run = (r: unknown): Res => r as Res;
const C = (re: number, im: number) => complex(re, im);

/** Every expected value matches a distinct computed value. */
function expectSpectrum(got: unknown[], want: Ri[], tol = 1e-9) {
  expect(got).toHaveLength(want.length);
  const left = got.map(toRi);
  for (const w of want) {
    const k = left.findIndex((g) => Math.hypot(g.re - w.re, g.im - w.im) < tol);
    expect(k, `missing eigenvalue ${w.re}+${w.im}i in ${JSON.stringify(left)}`).toBeGreaterThan(-1);
    left.splice(k, 1);
  }
}

const mul = (a: Ri, b: Ri): Ri => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});

/** A v = lambda v for every returned pair. */
function expectPairs(
  A: unknown[][],
  res: { eigenvectors?: { value: unknown; vector: unknown }[] }
) {
  expect(res.eigenvectors!.length).toBeGreaterThan(0);
  for (const { value, vector } of res.eigenvectors!) {
    const lam = toRi(value);
    const v = (vector as unknown[]).map(toRi);
    const n = A.length;
    for (let i = 0; i < n; i++) {
      let s: Ri = { re: 0, im: 0 };
      for (let j = 0; j < n; j++) {
        const p = mul(toRi(A[i][j]), v[j]);
        s = { re: s.re + p.re, im: s.im + p.im };
      }
      const r = mul(lam, v[i]);
      expect(Math.hypot(s.re - r.re, s.im - r.im)).toBeLessThan(1e-8);
    }
  }
}

describe('eigs keeps the imaginary part of Complex entries (#1220)', () => {
  it('1x1 complex(2,1)', () => {
    const A = [[C(2, 1)]];
    const r = run(eigs(A));
    expectSpectrum(r.values, [{ re: 2, im: 1 }]);
    expectPairs(A, r);
  });

  it('diag(i, 1)', () => {
    const A = [
      [C(0, 1), 0],
      [0, 1],
    ];
    const r = run(eigs(A));
    expectSpectrum(r.values, [
      { re: 0, im: 1 },
      { re: 1, im: 0 },
    ]);
    expectPairs(A, r);
  });

  it('diag(2+i, 5+i)', () => {
    const A = [
      [C(2, 1), 0],
      [0, C(5, 1)],
    ];
    const r = run(eigs(A));
    expectSpectrum(r.values, [
      { re: 2, im: 1 },
      { re: 5, im: 1 },
    ]);
    expectPairs(A, r);
  });

  it('upper triangular [[2+i,1],[0,3]]', () => {
    const A = [
      [C(2, 1), 1],
      [0, 3],
    ];
    const r = run(eigs(A));
    expectSpectrum(r.values, [
      { re: 2, im: 1 },
      { re: 3, im: 0 },
    ]);
    expectPairs(A, r);
  });

  it('off-diagonal Complex entry', () => {
    const A = [
      [1, C(0, 2)],
      [0, 4],
    ];
    const r = run(eigs(A));
    expectSpectrum(r.values, [
      { re: 1, im: 0 },
      { re: 4, im: 0 },
    ]);
    expectPairs(A, r);
  });

  it('Hermitian [[2,1-i],[1+i,3]] has eigenvalues within 1e-8 of 1 and 4', () => {
    const A = [
      [C(2, 0), C(1, -1)],
      [C(1, 1), C(3, 0)],
    ];
    const r = run(eigs(A));
    expectSpectrum(
      r.values,
      [
        { re: 1, im: 0 },
        { re: 4, im: 0 },
      ],
      1e-8
    );
    expectPairs(A, r);
  });

  it('general Complex 2x2 [[1+i, 2],[0, 3-2i]]', () => {
    const A = [
      [C(1, 1), C(2, 0)],
      [C(0, 0), C(3, -2)],
    ];
    const r = run(eigs(A));
    expectSpectrum(r.values, [
      { re: 1, im: 1 },
      { re: 3, im: -2 },
    ]);
    expectPairs(A, r);
  });

  it('general Complex 3x3 triangular', () => {
    const A = [
      [C(1, 2), C(0, 1), 3],
      [0, C(-1, 1), C(2, 2)],
      [0, 0, C(4, -3)],
    ];
    const r = run(eigs(A));
    expectSpectrum(r.values, [
      { re: 1, im: 2 },
      { re: -1, im: 1 },
      { re: 4, im: -3 },
    ]);
    expectPairs(A, r);
  });

  it('Matrix input and eigenvectors:false keep the imaginary part', () => {
    const r = run(eigs(matrix([[C(2, 1)]]), { eigenvectors: false }));
    expectSpectrum((r.values as unknown as { toArray(): unknown[] }).toArray(), [{ re: 2, im: 1 }]);
  });

  it('real-valued Complex matrix is unchanged', () => {
    const A = [
      [C(2, 0), C(1, 0)],
      [C(1, 0), C(2, 0)],
    ];
    const r = run(eigs(A));
    expectSpectrum(r.values, [
      { re: 1, im: 0 },
      { re: 3, im: 0 },
    ]);
    expectPairs(A, r);
  });

  it('number matrices are unchanged', () => {
    expectSpectrum(
      run(
        eigs([
          [2, 1],
          [1, 2],
        ])
      ).values,
      [
        { re: 1, im: 0 },
        { re: 3, im: 0 },
      ]
    );
    expectSpectrum(
      run(
        eigs([
          [0, -1],
          [1, 0],
        ])
      ).values,
      [
        { re: 0, im: 1 },
        { re: 0, im: -1 },
      ]
    );
  });

  it('complex(Complex), complex({re,im}) and complex(string) build a plain Complex', () => {
    const c = complex(2, 1) as Ri;
    const d = (complex as (x: unknown) => unknown)(c) as Ri;
    expect(d).toMatchObject({ re: 2, im: 1 });
    expect(d).not.toBe(c);
    expect((complex as (x: unknown) => unknown)({ re: 3, im: 4 })).toMatchObject({ re: 3, im: 4 });
    expect((complex as (x: unknown) => unknown)('2+i')).toMatchObject({ re: 2, im: 1 });
  });

  it('complex(Matrix) maps each entry and returns a Matrix, as in mathjs', () => {
    const r = (complex as (x: unknown) => unknown)(matrix([1, 2])) as {
      isMatrix: boolean;
      toArray: () => unknown[];
    };
    expect(r.isMatrix).toBe(true);
    expect(r.toArray().map(toRi)).toEqual([
      { re: 1, im: 0 },
      { re: 2, im: 0 },
    ]);
  });

  it('a Complex part of the two-argument form throws a TypeError, as in mathjs', () => {
    const f = complex as (...a: unknown[]) => unknown;
    expect(() => f(C(1, 2), 5)).toThrow(TypeError);
    expect(() => f(1, C(1, 2))).toThrow(/Unexpected type of argument in function complex/);
  });

  it('a third argument throws a TypeError, as in mathjs', () => {
    expect(() => (complex as (...a: unknown[]) => unknown)(1, 2, 3)).toThrow(
      /Too many arguments in function complex/
    );
  });

  it('the collection-callback shape converts the value', () => {
    expect([1, 2].map(complex as (x: unknown) => unknown).map(toRi)).toEqual([
      { re: 1, im: 0 },
      { re: 2, im: 0 },
    ]);
  });
});

// Every expected value below is the result of mathjs 15.2.0 for the same call, except where the
// test name says that mathjs differs.
describe('complex converts each argument type, as in mathjs (#1220)', () => {
  const f = complex as (...a: unknown[]) => unknown;
  const plain = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(plain);
    const o = x as { re: unknown; im: unknown };
    return [o.re, o.im];
  };

  it.each<[string, () => unknown, unknown]>([
    ['no argument', () => f(), [0, 0]],
    ['null', () => f(null), [0, 0]],
    ['number', () => f(5), [5, 0]],
    ['NaN', () => f(NaN), [NaN, 0]],
    ['two numbers', () => f(3, 4), [3, 4]],
    ['BigNumber', () => f(bignumber(3)), [3, 0]],
    ['two BigNumbers', () => f(bignumber(1), bignumber(2)), [1, 2]],
    ['number and BigNumber', () => f(1, bignumber(2)), [1, 2]],
    ['Fraction', () => f(fraction(1, 2)), [0.5, 0]],
    ['boolean', () => f(true), [1, 0]],
    ['two booleans', () => f(true, false), [1, 0]],
    ['bigint', () => f(1n), [1, 0]],
    ['two bigints', () => f(1n, 2n), [1, 2]],
    ['two numeric strings', () => f('2', '3'), [2, 3]],
    ['string', () => f('3+4i'), [3, 4]],
    ['string -i', () => f('-i'), [0, -1]],
    ['{re, im}', () => f({ re: 1, im: 2 }), [1, 2]],
    ['{r, phi}', () => f({ r: 2, phi: Math.PI / 2 }), [1.2246467991473532e-16, 2]],
    ['{abs, arg}', () => f({ abs: 2, arg: Math.PI / 2 }), [1.2246467991473532e-16, 2]],
    ['empty Array', () => f([]), []],
    [
      'nested Array',
      () => f([[1, C(1, 2)], ['1+i']]),
      [
        [
          [1, 0],
          [1, 2],
        ],
        [[1, 1]],
      ],
    ],
  ])('%s', (_name, call, want) => {
    expect(plain(call())).toEqual(want);
  });

  it('a SparseMatrix converts its stored entries and stays a Matrix', () => {
    const r = f(
      sparse([
        [1, 0],
        [0, 2],
      ])
    ) as { isMatrix: boolean; toArray: () => unknown[][] };
    expect(r.isMatrix).toBe(true);
    expect(r.toArray().map((row) => row.map(toRi))).toEqual([
      [
        { re: 1, im: 0 },
        { re: 0, im: 0 },
      ],
      [
        { re: 0, im: 0 },
        { re: 2, im: 0 },
      ],
    ]);
  });

  it.each<[string, () => unknown]>([
    ['undefined', () => f(undefined)],
    ['a function', () => f(() => 1)],
    ['a Unit', () => f(unit('5 cm'))],
    ['(1, undefined)', () => f(1, undefined)],
    ['(1, null)', () => f(1, null)],
    ['(null, 1)', () => f(null, 1)],
    ['(Array, number)', () => f([1, 2], 3)],
    ['(number, Array)', () => f(1, [2])],
  ])('%s throws a TypeError', (_name, call) => {
    expect(call).toThrow(TypeError);
    expect(call).toThrow(/Unexpected type of argument in function complex/);
  });

  it('an object without the part names throws the mathjs error', () => {
    expect(() => f({})).toThrow(/Expected object with properties \(re and im\)/);
    expect(() => f({ re: 1 })).toThrow(/Expected object with properties \(re and im\)/);
  });

  it('a string part that is not a number throws the mathjs conversion error', () => {
    expect(() => f('a', 1)).toThrow('Cannot convert "a" to a number');
  });

  it('object parts convert to numbers and a Complex part throws (mathjs keeps the part as it is)', () => {
    expect(plain(f({ re: bignumber(1), im: bignumber(2) }))).toEqual([1, 2]);
    expect(plain(f({ re: '1', im: '2' }))).toEqual([1, 2]);
    expect(() => f({ re: C(1, 2), im: 0 })).toThrow(TypeError);
  });

  it('two Fractions convert (mathjs throws for this pair)', () => {
    expect(plain(f(fraction(1, 2), fraction(1, 4)))).toEqual([0.5, 0.25]);
  });
});

describe('eigs of Complex entries beside other types (#1220)', () => {
  it('a full Complex 3x3 has the eigenvalues of mathjs', () => {
    const A = [
      [C(1, 2), C(0, 1), 3],
      [1, C(-1, 1), C(2, 2)],
      [2, 0, C(4, -3)],
    ];
    const r = run(eigs(A));
    expectSpectrum(r.values, [
      { re: -1.5537348448369326, im: 0.7614209826210648 },
      { re: 1.0109728444396766, im: 1.5170779298977852 },
      { re: 4.542762000397257, im: -2.2784989125188533 },
    ]);
    expectPairs(A, r);
  });

  it('a skew-Hermitian matrix has imaginary eigenvalues', () => {
    const A = [
      [C(0, 1), C(1, 0)],
      [C(-1, 0), C(0, 2)],
    ];
    const r = run(eigs(A));
    expectSpectrum(r.values, [
      { re: 0, im: 0.38196601125010576 },
      { re: 0, im: 2.618033988749895 },
    ]);
    expectPairs(A, r);
  });

  it('a Complex entry beside BigNumber or Fraction entries keeps its imaginary part', () => {
    const want = [
      { re: 2, im: 1 },
      { re: 3, im: 0 },
    ];
    expectSpectrum(
      run(
        eigs([
          [C(2, 1), bignumber(1)],
          [0, bignumber(3)],
        ])
      ).values,
      want
    );
    expectSpectrum(
      run(
        eigs([
          [C(2, 1), fraction(1, 2)],
          [0, 3],
        ])
      ).values,
      want
    );
  });

  it('a SparseMatrix with a Complex entry keeps its imaginary part', () => {
    const r = run(
      eigs(
        sparse([
          [C(0, 1), 0],
          [0, 1],
        ])
      )
    );
    expectSpectrum((r.values as unknown as { toArray(): unknown[] }).toArray(), [
      { re: 0, im: 1 },
      { re: 1, im: 0 },
    ]);
  });
});
