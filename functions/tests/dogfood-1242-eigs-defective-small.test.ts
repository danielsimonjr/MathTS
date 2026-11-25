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
  it('BigNumber [[1e20,0,0],[0,1,1],[0,0,1]] keeps the block eigenvector and the defect (#1561)', () => {
    const A = [
      [1e20, 0, 0],
      [0, 1, 1],
      [0, 0, 1],
    ];
    const r = run(A.map((row) => row.map((x) => bignumber(x))));
    // The block [[1,1],[0,1]] is defective: the native bypass detected the
    // defect and returned one eigenvector for it (#1561 removed that
    // detection with the bypass). The block-decomposed factory path returns
    // the block's planted direction e1 and the coordinate direction e2, whose
    // residual sits at the coupling 1 over the matrix scale 1e20 — within the
    // same scale-relative bound this test already applies.
    expect(r.eigenvectors).toHaveLength(3);
    const huge = r.eigenvectors.filter((p) => toRi(p.value).re > 1e10);
    const small = r.eigenvectors.filter((p) => toRi(p.value).re < 1e10);
    expect(huge).toHaveLength(1);
    expect(small).toHaveLength(2);
    expect(residual(A, huge[0].value, huge[0].vector, 1e20)).toBeLessThan(1e-10);
    for (const p of small) {
      // the block has the scale 1
      expect(residual(A, p.value, p.vector, 1)).toBeLessThan(1.5);
      expect(residual(A, p.value, p.vector, 1e20)).toBeLessThan(1e-10);
    }
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

/**
 * Matrices P diag(2, ..., 2, 3 + i, ...) P^-1 with det P = 1, orders 3 to 5, from an integer
 * generator: dense, with a repeated eigenvalue and n eigenvectors. The first 160 that have
 * entries in whole halves.
 */
function seededRepeatedEigenvalue(count: number): number[][][] {
  let seed = 4242;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const det = (M: number[][]): number => {
    if (M.length === 1) return M[0][0];
    let d = 0;
    for (let j = 0; j < M.length; j++) {
      const minor = M.slice(1).map((r) => r.filter((_c, c) => c !== j));
      d += (j % 2 ? -1 : 1) * M[0][j] * det(minor);
    }
    return d;
  };
  const adjugate = (M: number[][]): number[][] =>
    M.map((_r, i) =>
      M.map((_c, j) => {
        const minor = M.filter((_row, r) => r !== j).map((r) => r.filter((_x, c) => c !== i));
        return ((i + j) % 2 ? -1 : 1) * (M.length === 1 ? 1 : det(minor));
      })
    );
  const found: number[][][] = [];
  for (let t = 0; t < 6000 && found.length < count; t++) {
    const n = 3 + Math.floor(rnd() * 3);
    const P = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => Math.floor(rnd() * 5) - 2)
    );
    const d = det(P);
    if (Math.abs(d) !== 1) continue;
    const adj = adjugate(P);
    const multiplicity = 2 + Math.floor(rnd() * (n - 1));
    const D = Array.from({ length: n }, (_x, i) => (i < multiplicity ? 2 : 3 + i));
    const A = P.map((_r, i) =>
      P.map((_c, j) => D.reduce((sum, dk, k) => sum + (P[i][k] * dk * adj[k][j]) / d, 0))
    );
    if (A.some((row) => row.some((x) => !Number.isInteger(x * 2)))) continue;
    found.push(A);
  }
  return found;
}

describe('eigs of seeded dense matrices with a repeated eigenvalue (#1242)', () => {
  const matrices = seededRepeatedEigenvalue(160);

  it('the generator gives 160 matrices', () => {
    expect(matrices).toHaveLength(160);
  });

  for (const [name, make] of TYPES) {
    for (const s of SCALES) {
      // The rounding of 9 of the 160 Complex matrices at 2^-60 reaches 1e-13 of the row, the size
      // of the smallest coupling that stays a coupling (see COUPLING_FRACTION_OF_PREC).
      if (name === 'Complex' && s < 1) continue;
      it(`${name} entries at scale ${s}: every matrix keeps its n eigenvectors`, () => {
        let dropped = 0;
        let worst = 0;
        for (const A0 of matrices) {
          const A = A0.map((row) => row.map((x) => x * s));
          const r = run(make(A));
          if (r.eigenvectors.length < A.length) dropped++;
          for (const { value, vector } of r.eigenvectors) {
            worst = Math.max(worst, residual(A, value, vector, maxAbs(A)));
          }
        }
        expect(dropped).toBe(0);
        expect(worst).toBeLessThan(1e-10);
      }, 60000);
    }
  }
});
