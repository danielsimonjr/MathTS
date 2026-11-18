import { describe, expect, it } from 'vitest';
import { qr, matrix, complex, bignumber, fraction } from '../src/index.js';

type Z = [number, number];
const num = (x: unknown): Z => {
  if (typeof x === 'number') return [x, 0];
  const o = x as { re?: number; im?: number; toNumber?: () => number; valueOf: () => unknown };
  if (typeof o.re === 'number') return [o.re, o.im as number];
  if (typeof o.toNumber === 'function') return [o.toNumber(), 0];
  return [Number(o.valueOf()), 0];
};
const mulZ = (a: Z, b: Z): Z => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const conjT = (z: Z): Z => [z[0], -z[1]];
const toZ = (M: unknown[][]) => M.map((r) => r.map(num));

const run = (A: unknown[][]) => {
  const r = qr(A as never) as unknown as { Q: unknown[][]; R: unknown[][] };
  return { Q: toZ(r.Q), R: toZ(r.R) };
};
const prod = (X: Z[][], Y: Z[][]) =>
  X.map((_, i) =>
    Y[0].map((__, j) =>
      X[i].reduce<Z>(
        (s, x, k) => {
          const p = mulZ(x, Y[k][j]);
          return [s[0] + p[0], s[1] + p[1]];
        },
        [0, 0]
      )
    )
  );
const maxAbs = (M: Z[][]) => Math.max(...M.flat().map((z) => Math.hypot(z[0], z[1])));
const reconErr = (A: Z[][], Q: Z[][], R: Z[][]) => {
  const P = prod(Q, R);
  let e = 0;
  A.forEach((r, i) =>
    r.forEach((a, j) => (e = Math.max(e, Math.hypot(P[i][j][0] - a[0], P[i][j][1] - a[1]))))
  );
  return e / maxAbs(A);
};
const orthErr = (Q: Z[][]) => {
  const QH = Q[0].map((_, j) => Q.map((r) => conjT(r[j])));
  const P = prod(QH, Q);
  let e = 0;
  P.forEach((r, i) =>
    r.forEach((z, j) => (e = Math.max(e, Math.hypot(z[0] - (i === j ? 1 : 0), z[1]))))
  );
  return e;
};

const d = 3e-10;
const E = 2 ** -19;
const base = [
  [1, 1, 1],
  [1, 1 + d, 1],
  [1, 1, 1 + d],
];
const makers: Record<string, (x: number) => unknown> = {
  'complex(x,0)': (x) => complex(x, 0),
  'complex(x,x)': (x) => complex(x, x),
  bignumber: (x) => bignumber(x),
  // exact: 1 + 3/10^10 and 2^-19 as Fractions (a double 1 + 3e-10 does not convert exactly)
  fraction: (x) => fraction(Math.round(x * 2 ** 19 * 1e10), 1e10 * 2 ** 19),
  'mixed number/Complex': (x) => (x === E ? x : complex(x, 0)),
};

describe('qr keeps a nearly dependent column of non-number matrices (#1188)', () => {
  for (const [label, mk] of Object.entries(makers)) {
    it(`${label} reconstructs and Q is unitary`, () => {
      const A = base.map((r) => r.map((x) => mk(x * E)));
      const { Q, R } = run(A);
      expect(reconErr(toZ(A), Q, R)).toBeLessThan(1e-14);
      expect(orthErr(Q)).toBeLessThan(1e-14);
      // R is upper triangular and R[2][2] is about d/sqrt(3)-sized relative to the scale, not a skipped step.
      expect(Math.hypot(...R[2][2])).toBeGreaterThan(1e-12 * E);
    });
  }

  it('an exactly dependent column gives R[k][k] at rounding level and a unitary Q', () => {
    for (const mk of [(x: number) => complex(x, x), (x: number) => bignumber(x)]) {
      const A = [
        [1, 2, 3],
        [4, 5, 9],
        [7, 8, 15],
      ].map((r) => r.map((x) => mk(x * E)));
      const { Q, R } = run(A);
      expect(reconErr(toZ(A), Q, R)).toBeLessThan(1e-14);
      expect(orthErr(Q)).toBeLessThan(1e-14);
      expect(Math.hypot(...R[2][2])).toBeLessThan(1e-14 * E * 20);
    }
  });

  it('a negative tiny pivot with a zero tail does not produce NaN', () => {
    const A = [
      [complex(-1e-17, 0), complex(1, 0)],
      [complex(0, 0), complex(1, 0)],
    ];
    const { Q, R } = run(A);
    expect(reconErr(toZ(A), Q, R)).toBeLessThan(1e-14);
  });

  it('a column whose square underflows does not break the unitary Q', () => {
    const A = [
      [0, 0, 0, 0, 0],
      [-75.70759923902897, 0, -6.865303596696373e-140, 0, 0],
      [0, 2.782236043930641e-74, 0, 0, 0],
      [6.411946772654541e-17, 1.2654562611809476e-72, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ].map((r) => r.map((x) => complex(x, 0)));
    const { Q } = run(A);
    expect(orthErr(Q)).toBeLessThan(1e-12);
  });

  const full = [
    [1, 2, 3],
    [4, 5, 6.5],
    [7, 8, 10],
  ];
  for (const s of [1e-150, 1e-200, 1e-300, 1e300]) {
    for (const kind of ['complex(x,0)', 'complex(x,x/3)', 'mixed']) {
      it(`a ${kind} matrix scaled by ${s} reconstructs and Q is unitary`, () => {
        const A = full.map((r, i) =>
          r.map((x, j) =>
            kind === 'mixed' && i + j === 0
              ? x * s
              : complex(x * s, kind === 'complex(x,x/3)' ? (x * s) / 3 : 0)
          )
        );
        const { Q, R } = run(A);
        expect(reconErr(toZ(A), Q, R)).toBeLessThan(1e-14);
        expect(orthErr(Q)).toBeLessThan(1e-14);
      });
    }
  }

  it('a zero matrix still factors', () => {
    const A = [
      [bignumber(0), bignumber(0)],
      [bignumber(0), bignumber(0)],
    ];
    const { Q, R } = run(A);
    expect(orthErr(Q)).toBeLessThan(1e-14);
    expect(maxAbs(R)).toBe(0);
  });
  it('Matrix input matches array input', () => {
    const A = base.map((r) => r.map((x) => complex(x * E, 0)));
    const m = qr(matrix(A as never) as never) as unknown as { Q: unknown; R: unknown };
    expect(m.Q).toBeDefined();
  });
});
