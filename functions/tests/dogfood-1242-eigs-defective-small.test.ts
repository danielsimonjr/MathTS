/**
 * Dogfood #1242 - the general eigs gives no false eigenvector for a defective small matrix.
 *
 * `findEigenvectors` solved the null space of U - lambda I with `usolveAll`, which tests the
 * right-hand side of a zero-diagonal row with an absolute tolerance. A coupling of 8.7e-19 (the
 * Jordan block [[1,1],[0,1]] scaled by 2^-60) read as zero, so the row had a free variable and
 * the block got two eigenvectors. The solver now tests the row relative to the entries of the
 * row and to the components already solved, with the tolerance `prec` of eigs. A row with a
 * rounding residual is made an exact zero, so no garbage enters a vector.
 */
import { describe, it, expect } from 'vitest';
import { eigs, bignumber, complex } from '../src/index.js';

type Ri = { re: number; im: number };

const toRi = (x: unknown): Ri => {
  if (typeof x === 'number') return { re: x, im: 0 };
  const o = x as { re?: unknown; im?: unknown };
  if (typeof o.re === 'number' && typeof o.im === 'number') return { re: o.re, im: o.im };
  return { re: Number(x), im: 0 };
};

type EigResult = {
  values: unknown[];
  eigenvectors: Array<{ value: unknown; vector: unknown[] }>;
};
const run = (A: unknown[][]): EigResult => eigs(A as never) as unknown as EigResult;

/** |A v - l v| / (scale |v|). */
function residual(A: number[][], l: unknown, v: unknown[], scale: number): number {
  const lam = toRi(l);
  const vec = v.map(toRi);
  const vnorm = Math.hypot(...vec.map((z) => Math.hypot(z.re, z.im)));
  let worst = 0;
  for (let i = 0; i < A.length; i++) {
    let ar = 0;
    let ai = 0;
    for (let j = 0; j < A.length; j++) {
      ar += A[i][j] * vec[j].re;
      ai += A[i][j] * vec[j].im;
    }
    const er = ar - (lam.re * vec[i].re - lam.im * vec[i].im);
    const ei = ai - (lam.re * vec[i].im + lam.im * vec[i].re);
    worst = Math.max(worst, Math.hypot(er, ei));
  }
  return worst / (scale * vnorm);
}

const maxAbs = (A: number[][]): number => Math.max(...A.flat().map(Math.abs));

const TYPES = [
  ['BigNumber', (A: number[][]) => A.map((r) => r.map((x) => bignumber(x)))],
  ['Complex', (A: number[][]) => A.map((r) => r.map((x) => complex(x, 0)))],
] as const;
const SCALES = [1, 2 ** 40, 2 ** -60];

// The Jordan structures of the issue table: one eigenvector each.
const DEFECTIVE: Array<[string, number[][]]> = [
  [
    '[[1,1],[0,1]]',
    [
      [1, 1],
      [0, 1],
    ],
  ],
  [
    '[[0,1],[0,0]]',
    [
      [0, 1],
      [0, 0],
    ],
  ],
  [
    '[[2,1,0],[0,2,1],[0,0,2]]',
    [
      [2, 1, 0],
      [0, 2, 1],
      [0, 0, 2],
    ],
  ],
  [
    '[[0,1,0],[0,0,1],[0,0,0]]',
    [
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, 0],
    ],
  ],
];

describe.each(TYPES)('eigs of a defective matrix with %s entries (#1242)', (_name, make) => {
  for (const s of SCALES) {
    describe(`at scale ${s}`, () => {
      it.each(DEFECTIVE)('%s has exactly one eigenvector with a small residual', (_t, A0) => {
        const A = A0.map((row) => row.map((x) => x * s));
        const r = run(make(A));
        expect(r.eigenvectors).toHaveLength(1);
        const { value, vector } = r.eigenvectors[0];
        expect(residual(A, value, vector, maxAbs(A))).toBeLessThan(1e-10);
      });
    });
  }
});

describe('eigs of a matrix with a diagonalizable double eigenvalue (#1242)', () => {
  // P diag(2,2,5) P^-1 with det P = 1: a dense matrix, so the null space of U - 2I has two
  // dimensions. The coupling in that row is rounding noise, and must be read as zero.
  const P = [
    [1, 2, 3],
    [0, 1, 4],
    [5, 6, 0],
  ];
  const Pinv = [
    [-24, 18, 5],
    [20, -15, -4],
    [-5, 4, 1],
  ];
  const D = [2, 2, 5];
  const A0 = P.map((_, i) =>
    P.map((__, j) => D.reduce((sum, d, k) => sum + P[i][k] * d * Pinv[k][j], 0))
  );

  /** |det| of the unit eigenvectors of one matrix: a measure of their independence. */
  const independence = (vectors: unknown[][]): number => {
    const u = vectors.map((v) => {
      const z = v.map(toRi);
      const norm = Math.hypot(...z.map((c) => Math.hypot(c.re, c.im)));
      return z.map((c) => c.re / norm);
    });
    const [a, b, c] = u;
    return Math.abs(
      a[0] * (b[1] * c[2] - b[2] * c[1]) -
        a[1] * (b[0] * c[2] - b[2] * c[0]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])
    );
  };

  describe.each(TYPES)('%s entries', (_name, make) => {
    for (const s of SCALES) {
      it(`at scale ${s}: three independent eigenvectors`, () => {
        const A = A0.map((row) => row.map((x) => x * s));
        const r = run(make(A));
        expect(r.eigenvectors).toHaveLength(3);
        for (const { value, vector } of r.eigenvectors) {
          expect(residual(A, value, vector, maxAbs(A))).toBeLessThan(1e-10);
        }
        expect(independence(r.eigenvectors.map((p) => p.vector))).toBeGreaterThan(1e-3);
      });
    }
  });
});

describe('eigs of a defective block beside a huge entry (#1242)', () => {
  it('BigNumber [[1e20,0,0],[0,1,1],[0,0,1]] has two eigenvectors', () => {
    const A = [
      [1e20, 0, 0],
      [0, 1, 1],
      [0, 0, 1],
    ];
    const r = run(A.map((row) => row.map((x) => bignumber(x))));
    expect(r.eigenvectors).toHaveLength(2);
    const huge = r.eigenvectors.filter((p) => toRi(p.value).re > 1e10);
    const small = r.eigenvectors.filter((p) => toRi(p.value).re < 1e10);
    expect(huge).toHaveLength(1);
    expect(small).toHaveLength(1);
    expect(residual(A, huge[0].value, huge[0].vector, 1e20)).toBeLessThan(1e-10);
    // the block has the scale 1
    expect(residual(A, small[0].value, small[0].vector, 1)).toBeLessThan(1e-10);
  });

  it('the identity matrix and diag(1,1,2) keep all their eigenvectors', () => {
    const I2 = [
      [1, 0],
      [0, 1],
    ];
    const D3 = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 2],
    ];
    for (const [, make] of TYPES) {
      expect(run(make(I2)).eigenvectors).toHaveLength(2);
      expect(run(make(D3)).eigenvectors).toHaveLength(3);
    }
  });
});
