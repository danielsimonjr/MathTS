/**
 * Dogfood #1172 — the pivot test of the WASMBackend LU, inverse and determinant, and the
 * Householder skip of its QR.
 *
 * Every kernel compared a pivot to the absolute 1e-14. A pivot scales with the matrix and a
 * constant does not, so the verdict depended on the unit: a rank-deficient matrix times 2^20
 * kept a rounding residue above the floor (regular), a regular matrix with a pivot of 1e-15
 * fell under it (singular), and `determinantWasm` returned 0 for every pivot under 1e-14.
 *
 * The rule is that a pivot is zero when the rounding error of its own computation hides it.
 * The pivot of step k in row p is `a_pk - sum_{j<k} l_pj * u_jk`, and its rounding error is
 * bounded by a small multiple of `eps * sum_{j<k} |l_pj| * |u_jk|`. So the pivot is zero when it
 * is `<= 1e-14 * S` with `S` that sum. Every term is in the in-place LU storage and scales
 * exactly with a power of 2, so the verdict does not depend on the unit. Limits of the rule
 * (they belong to partial-pivoting LU, not to this rule): a regular matrix is called singular
 * only when a pivot lost 14 digits to cancellation (`[[1, 1], [1, 1 + 1e-15]]`), and a
 * rank-deficient matrix with an ill-conditioned leading block can pass.
 *
 * Every case runs on both paths: the AssemblyScript kernels (module loaded) and the JS
 * fallback (no `initialize()`).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DenseMatrix } from '../src/types/DenseMatrix.js';
import { WASMBackend } from '../src/backends/WASMBackend.js';

// ---- deterministic generators -------------------------------------------------------------

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
type Rnd = () => number;
const entry = (rnd: Rnd): number => rnd() * 2 - 1;

function randReg(n: number, rnd: Rnd): number[][] {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => entry(rnd)));
}

/** Rank n - 1 by construction: the product of an n x (n-1) and an (n-1) x n matrix. */
function rankDefProd(n: number, rnd: Rnd): number[][] {
  const B = Array.from({ length: n }, () => Array.from({ length: n - 1 }, () => entry(rnd)));
  const C = Array.from({ length: n - 1 }, () => Array.from({ length: n }, () => entry(rnd)));
  return B.map((row) => C[0].map((_, j) => row.reduce((s, v, k) => s + v * C[k][j], 0)));
}

/** A regular matrix times row and column factors 2^e, e in [-k, k]: exact, graded. */
function grade(A: number[][], k: number, rnd: Rnd): number[][] {
  const n = A.length;
  const pick = (): number => 2 ** (Math.floor(rnd() * (2 * k + 1)) - k);
  const d1 = Array.from({ length: n }, pick);
  const d2 = Array.from({ length: n }, pick);
  return A.map((row, i) => row.map((v, j) => v * d1[i] * d2[j]));
}

const scaleBy = (A: number[][], k: number): number[][] => A.map((r) => r.map((v) => v * 2 ** k));
const dm = (a: number[][]): DenseMatrix => DenseMatrix.fromArray(a);
const nested = (m: DenseMatrix): number[][] => m.toArray();

// ---- the two paths --------------------------------------------------------------------------

type Path = { name: string; backend: WASMBackend };
const asBackend = new WASMBackend();
const jsBackend = new WASMBackend();
const PATHS: Path[] = [
  { name: 'AS kernels', backend: asBackend },
  { name: 'JS fallback', backend: jsBackend },
];

beforeAll(async () => {
  await asBackend.initialize();
  // A silent fallback would test the JS path twice.
  expect((asBackend as unknown as { wasmModule: unknown }).wasmModule).not.toBeNull();
  expect((jsBackend as unknown as { wasmModule: unknown }).wasmModule).toBeNull();
});

describe.each(PATHS)('#1172 $name', ({ backend }) => {
  it('1. the verdict of a rank-deficient matrix does not depend on its unit', async () => {
    const rnd = lcg(12345);
    const sample = Array.from({ length: 300 }, (_, i) => rankDefProd(2 + (i % 4), rnd));
    for (const k of [0, 5, 10, 20, 600]) {
      let lu = 0;
      let inv = 0;
      for (const A of sample) {
        const S = dm(scaleBy(A, k));
        if ((await backend.luDecomposition(S)).singular) lu++;
        if ((await backend.inverse(S)).singular) inv++;
      }
      expect({ k, lu, inv }).toEqual({ k, lu: 300, inv: 300 });
    }
  });

  it('2. a regular matrix with a small or graded pivot is regular', async () => {
    const regular: Array<[string, number[][]]> = [
      [
        'diag(1, 1e-15)',
        [
          [1, 0],
          [0, 1e-15],
        ],
      ],
      [
        'diag(1e-15, 1)',
        [
          [1e-15, 0],
          [0, 1],
        ],
      ],
      [
        'diag(1e20, 1)',
        [
          [1e20, 0],
          [0, 1],
        ],
      ],
      [
        '[[1e20, 1e20], [1, 2]]',
        [
          [1e20, 1e20],
          [1, 2],
        ],
      ],
      [
        'spd [[1e32, 1e16], [1e16, 2]]',
        [
          [1e32, 1e16],
          [1e16, 2],
        ],
      ],
      [
        'unit upper with 1e20',
        [
          [1, 1e20, 0],
          [0, 1, 1e20],
          [0, 0, 1],
        ],
      ],
    ];
    for (const [label, A] of regular) {
      const r = await backend.luDecomposition(dm(A));
      expect({ label, singular: r.singular }).toEqual({ label, singular: false });
    }
    const inv = await backend.inverse(
      dm([
        [1, 0],
        [0, 1e-15],
      ])
    );
    expect(inv.singular).toBe(false);
    expect(nested(inv.inverse)).toEqual([
      [1, 0],
      [0, 1 / 1e-15],
    ]);

    const upper = await backend.inverse(
      dm([
        [1, 1e20, 0],
        [0, 1, 1e20],
        [0, 0, 1],
      ])
    );
    expect(upper.singular).toBe(false);
    const want = [
      [1, -1e20, 1e40],
      [0, 1, -1e20],
      [0, 0, 1],
    ];
    nested(upper.inverse).forEach((row, i) =>
      row.forEach((v, j) => {
        if (want[i][j] === 0) expect(v).toBe(0);
        else expect(Math.abs(v - want[i][j]) / Math.abs(want[i][j])).toBeLessThan(1e-15);
      })
    );
  });

  it('3. 3000 graded regular matrices (2^+-40) are regular', async () => {
    const rnd = lcg(777);
    let singular = 0;
    for (let i = 0; i < 3000; i++) {
      const A = grade(randReg(2 + (i % 9), rnd), 40, rnd);
      if ((await backend.luDecomposition(dm(A))).singular) singular++;
    }
    expect(singular).toBe(0);
  });

  it('4. a singular matrix stays singular', async () => {
    const r = await backend.luDecomposition(
      dm([
        [1, 2],
        [2, 4],
      ])
    );
    expect(r.singular).toBe(true);
    expect(
      (
        await backend.inverse(
          dm([
            [1, 2],
            [2, 4],
          ])
        )
      ).singular
    ).toBe(true);
    // The value can be -0, so compare with ===, not Object.is.
    expect(
      (await backend.determinantWasm(
        dm([
          [1, 2],
          [2, 4],
        ])
      )) === 0
    ).toBe(true);
    // The documented limit: a pivot that lost 14 digits to cancellation is zero.
    expect(
      (
        await backend.luDecomposition(
          dm([
            [1, 1],
            [1, 1 + 1e-15],
          ])
        )
      ).singular
    ).toBe(true);
  });

  it('5. the determinant of a small pivot is its value, and scales exactly', async () => {
    const d1 = await backend.determinantWasm(
      dm([
        [3e-100, 1e-100],
        [4e-100, 2e-100],
      ])
    );
    expect(Math.abs(d1 - 2e-200) / 2e-200).toBeLessThan(1e-13);
    expect(
      await backend.determinantWasm(
        dm([
          [1e-15, 0],
          [0, 1],
        ])
      )
    ).toBe(1e-15);
    expect(
      await backend.determinantWasm(
        dm([
          [1, 0],
          [0, 1e-15],
        ])
      )
    ).toBe(1e-15);

    const rnd = lcg(4242);
    for (let i = 0; i < 100; i++) {
      const n = 2 + (i % 2);
      const A = randReg(n, rnd);
      const base = await backend.determinantWasm(dm(A));
      for (const k of [-200, 10, 200]) {
        // 2^(n k) as two exact factors: 2^(n k) itself overflows for n k = 600.
        const half = 2 ** ((n * k) / 2);
        const scaled = await backend.determinantWasm(dm(scaleBy(A, k)));
        expect(scaled).toBe(base * half * half);
      }
    }
  });

  it('6. 3000 ordinary matrices: regular, and the factors equal a floor-free elimination', async () => {
    const rnd = lcg(31337);
    let singular = 0;
    for (let i = 0; i < 3000; i++) {
      const n = 2 + (i % 9);
      const A = randReg(n, rnd);
      const r = await backend.luDecomposition(dm(A));
      if (r.singular) {
        singular++;
        continue;
      }
      const ref = eliminate(A);
      expect(Array.from(r.perm)).toEqual(ref.perm);
      const got = r.lu.toFloat64Array();
      for (let q = 0; q < n * n; q++) {
        // Bit for bit: the rule changes the verdict and never the arithmetic.
        if (!Object.is(got[q], ref.lu[q])) expect(got[q]).toBe(ref.lu[q]);
      }
    }
    expect(singular).toBe(0);
  });

  it('6b. an infinite pivot is not zero: LU and inverse agree with the determinant', async () => {
    // The pivot -Infinity has the cancellation sum Infinity, and `Infinity <= 1e-14 * Infinity`
    // is true. An infinite pivot is not hidden by a rounding error, so it is not zero (origin/main
    // called these matrices regular too).
    for (const A of [
      [
        [1, 2],
        [3, Infinity],
      ],
      [
        [1, Infinity],
        [1, 1],
      ],
    ]) {
      expect((await backend.luDecomposition(dm(A))).singular).toBe(false);
      expect((await backend.inverse(dm(A))).singular).toBe(false);
      expect(Math.abs(await backend.determinantWasm(dm(A)))).toBe(Infinity);
    }
  });

  describe('7. QR of a column with a tiny or dependent sub-column', () => {
    const cases: Array<[string, number[][]]> = [
      [
        '1e-15 sub-column',
        [
          [1, 0],
          [0, 1e-15],
          [0, 1e-15],
        ],
      ],
      [
        '1e-200 sub-column',
        [
          [1, 0],
          [0, 1e-200],
          [0, 1e-200],
        ],
      ],
      [
        'zero then 1e-200',
        [
          [1, 0],
          [0, 0],
          [0, 1e-200],
        ],
      ],
      [
        '3e-162, 4e-162 (squares underflow)',
        [
          [1, 0],
          [0, 3e-162],
          [0, 4e-162],
        ],
      ],
      [
        'dependent columns',
        [
          [1, 2, 3],
          [4, 5, 9],
          [7, 8.5, 15.5],
        ],
      ],
      [
        'plain 3 x 2',
        [
          [1, 2],
          [3, 4],
          [5, 6],
        ],
      ],
    ];
    it.each(cases)('%s', async (_label, A) => {
      const m = A.length;
      const n = A[0].length;
      const { q, r } = await backend.qrDecomposition(dm(A));
      const Q = nested(q);
      const R = nested(r);
      for (const v of [...Q.flat(), ...R.flat()]) expect(Number.isFinite(v)).toBe(true);
      for (let i = 1; i < m; i++) for (let j = 0; j < Math.min(i, n); j++) expect(R[i][j]).toBe(0);
      // The kernels return Q^T: A = Q^T R.
      const QtR = Array.from({ length: m }, (_, i) =>
        Array.from({ length: n }, (_, j) => {
          let s = 0;
          for (let k = 0; k < m; k++) s += Q[k][i] * R[k][j];
          return s;
        })
      );
      const maxA = Math.max(...A.flat().map(Math.abs));
      for (let i = 0; i < m; i++)
        for (let j = 0; j < n; j++)
          expect(Math.abs(QtR[i][j] - A[i][j])).toBeLessThanOrEqual(1e-14 * maxA);
      // The sub-column is tiny too: its own error is small against its own entries.
      if (_label !== 'dependent columns' && _label !== 'plain 3 x 2') {
        const maxCol = Math.max(...A.map((row) => Math.abs(row[1])));
        for (let i = 0; i < m; i++)
          expect(Math.abs(QtR[i][1] - A[i][1])).toBeLessThanOrEqual(1e-14 * maxCol);
      }
      // Q Q^T = I.
      for (let i = 0; i < m; i++)
        for (let j = 0; j < m; j++) {
          let s = 0;
          for (let k = 0; k < m; k++) s += Q[i][k] * Q[j][k];
          expect(Math.abs(s - (i === j ? 1 : 0))).toBeLessThanOrEqual(1e-14);
        }
    });

    it('an ordinary matrix keeps its bits: the plain 3 x 2 factors equal the values of main', async () => {
      const { q, r } = await backend.qrDecomposition(
        dm([
          [1, 2],
          [3, 4],
          [5, 6],
        ])
      );
      expect(Array.from(r.toFloat64Array())).toEqual([
        -5.916079783099616, -7.437357441610946, 0, 0.8280786712108249, 0, 0,
      ]);
      expect(Array.from(q.toFloat64Array())).toEqual([
        -0.16903085094570347, -0.50709255283711, -0.8451542547285167, 0.8970852271450602,
        0.2760262237369423, -0.34503277967117735, 0.4082482904638636, -0.8164965809277258,
        0.4082482904638628,
      ]);
    });
  });
});

describe('#1172 the JS Householder kernel takes the norm of a huge column by scaling', () => {
  // `qrDecomposition` scales a huge matrix into range before it calls a kernel (#1123), so the
  // kernel is called directly: a column above 2^500 has squares that overflow above about 1.34e154.
  const kernel = (a: number[][]): { q: DenseMatrix; r: DenseMatrix } =>
    (
      new WASMBackend() as unknown as {
        qrDecompositionJS(m: DenseMatrix): { q: DenseMatrix; r: DenseMatrix };
      }
    ).qrDecompositionJS(dm(a));

  it.each([
    ['three 1e200', [[1e200], [1e200], [1e200]], -Math.sqrt(3) * 1e200],
    [
      'a 1e300 column and a unit column',
      [
        [1e300, 1],
        [1e300, 2],
      ],
      -Math.sqrt(2) * 1e300,
    ],
  ] as Array<[string, number[][], number]>)('%s', (_label, A, r00) => {
    const R = nested(kernel(A).r);
    expect(Math.abs(R[0][0] / r00 - 1)).toBeLessThan(4e-16);
    for (let i = 1; i < R.length; i++) expect(R[i][0]).toBe(0);
  });
});

/** Partial-pivoting elimination with no floor and no scaling: the reference of test 6. */
function eliminate(A: number[][]): { lu: number[]; perm: number[] } {
  const n = A.length;
  const d = A.flat();
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let k = 0; k < n - 1; k++) {
    let max = Math.abs(d[k * n + k]);
    let p = k;
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(d[i * n + k]);
      if (v > max) {
        max = v;
        p = i;
      }
    }
    if (p !== k) {
      for (let j = 0; j < n; j++) [d[k * n + j], d[p * n + j]] = [d[p * n + j], d[k * n + j]];
      [perm[k], perm[p]] = [perm[p], perm[k]];
    }
    const pivot = d[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const f = d[i * n + k] / pivot;
      d[i * n + k] = f;
      for (let j = k + 1; j < n; j++) d[i * n + j] -= f * d[k * n + j];
    }
  }
  return { lu: d, perm };
}
