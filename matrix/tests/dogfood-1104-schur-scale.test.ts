/**
 * Dogfood #1104 — decompositions of a matrix with extreme entries.
 *
 * `schur([[1, 1e160], [1e160, 1]])` returned NaN. The kernels square entries, so an
 * entry above about 1e154 overflows and one below about 1e-154 underflows. Each
 * decomposition scales its input by an exact power of 2 and unscales the result.
 * The oracle is homogeneity: for a power of 2 `s`, the result for `s·A` is the
 * result for `A`, scaled by `s` (`s^p` for a factor of degree p).
 */

import { describe, it, expect } from 'vitest';
import {
  DenseMatrix,
  matrixSchur,
  matrixSqrtm,
  matrixLogm,
  qr,
  lq,
  rq,
  ql,
  qrPivoted,
  svd,
  singularValues,
  pinv,
  lowRankApprox,
  norm2,
  normFro,
  condest,
  lstsq,
  cond,
  SparseMatrix,
  parallelMatrixNorm,
  norm as typedNorm,
} from '../src/index.js';
import {
  ldexp,
  pow2ScaleExponent,
  SQUARED,
  FOURTH,
  ABS_CUTOFF_LO,
} from '../src/operations/common.js';

const A0 = [
  [2, 1, 0.5],
  [1, 3, 1],
  [0.3, 1, 4],
];
const SPD = [
  [4, 1, 0.5],
  [1, 3, 1],
  [0.5, 1, 5],
];
// Integers, so that B0 · 2^-1060 is exact although every entry is subnormal.
const B0 = [
  [8, 1, 3],
  [1, 5, 1],
  [2, 1, 12],
];
const RECT = [
  [2, 1],
  [1, 3],
  [0.3, 1],
  [1, 0.5],
];

const P = (k: number): number => 2 ** k;
const SCALES = [P(531), P(996), P(-531), P(-994)];

const scaled = (A: number[][], s: number): number[][] => A.map((r) => r.map((v) => v * s));
const flat = (M: DenseMatrix | number[][] | number[]): number[] => {
  const a = M instanceof DenseMatrix ? M.toArray() : M;
  return (a as unknown[]).flat(Infinity) as number[];
};

/** got ≈ want · factor, measured against the largest wanted entry. */
function expectScaled(got: number[], want: number[], factor: number, tol = 1e-10): void {
  expect(got.length).toBe(want.length);
  expect(got.every(Number.isFinite)).toBe(true);
  const top = Math.max(...want.map((v) => Math.abs(v * factor)));
  for (let i = 0; i < got.length; i++) {
    expect(Math.abs(got[i] - want[i] * factor)).toBeLessThanOrEqual(tol * top);
  }
}

describe('#1104 schur of an extreme matrix', () => {
  it('schur([[1,1e160],[1e160,1]]) has the diagonal 1 ± 1e160 (SciPy)', () => {
    const A = [
      [1, 1e160],
      [1e160, 1],
    ];
    const { Q, T } = matrixSchur(A);
    const t = T.toArray();
    expect(flat(T).every(Number.isFinite)).toBe(true);
    expect(Math.abs(t[0][0]) / 1e160).toBeCloseTo(1, 12);
    expect(Math.abs(t[1][1]) / 1e160).toBeCloseTo(1, 12);
    expect(t[0][0] + t[1][1]).toBeLessThanOrEqual(1e145);
    expect(t[1][0]).toBe(0);
    // Q · T · Qᵀ = A, measured against 1e160
    const q = Q.toArray();
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        let sum = 0;
        for (let k = 0; k < 2; k++) {
          for (let l = 0; l < 2; l++) sum += q[i][k] * t[k][l] * q[j][l];
        }
        expect(Math.abs(sum - A[i][j])).toBeLessThanOrEqual(1e-12 * 1e160);
      }
    }
  });

  it.each(SCALES)('schur of A0 · 2^k, s = %s', (s) => {
    const ref = matrixSchur(A0);
    const got = matrixSchur(scaled(A0, s));
    expectScaled(flat(got.T), flat(ref.T), s);
    expectScaled(flat(got.Q), flat(ref.Q), 1);
  });

  it('schur of a subnormal matrix', () => {
    const s = P(-1060);
    const ref = matrixSchur(B0);
    const got = matrixSchur(scaled(B0, s));
    expectScaled(flat(got.T), flat(ref.T), s);
  });
});

describe('#1104 sibling decompositions of an extreme matrix', () => {
  it.each(SCALES)('qr, s = %s', (s) => {
    const ref = qr(A0);
    const got = qr(scaled(A0, s));
    expectScaled(flat(got.R), flat(ref.R), s);
    expectScaled(flat(got.Q), flat(ref.Q), 1);
  });

  it.each(SCALES)('lq, rq, ql, s = %s', (s) => {
    expectScaled(flat(lq(scaled(RECT, s)).L), flat(lq(RECT).L), s);
    expectScaled(flat(rq(scaled(A0, s)).R), flat(rq(A0).R), s);
    expectScaled(flat(ql(scaled(RECT, s)).L), flat(ql(RECT).L), s);
  });

  it.each(SCALES)('qrPivoted, s = %s', (s) => {
    const ref = qrPivoted(A0);
    const got = qrPivoted(scaled(A0, s));
    expect(got.P).toEqual(ref.P);
    expect(got.rank).toBe(ref.rank);
    expectScaled(flat(got.R), flat(ref.R), s);
  });

  it.each(SCALES)('svd, singularValues, norm2, lowRankApprox, s = %s', (s) => {
    const ref = svd(A0);
    const got = svd(scaled(A0, s));
    expectScaled(got.S, ref.S, s);
    expect(got.rank).toBe(ref.rank);
    expectScaled(singularValues(scaled(A0, s)), ref.S, s);
    expectScaled([norm2(scaled(A0, s))], [ref.S[0]], s);
    expectScaled(flat(lowRankApprox(scaled(RECT, s), 1)), flat(lowRankApprox(RECT, 1)), s);
  });

  it.each(SCALES)('cond is scale-free, s = %s', (s) => {
    expectScaled([cond(scaled(A0, s))], [cond(A0)], 1);
  });

  it.each(SCALES)('pinv scales by 1/s, s = %s', (s) => {
    const ref = pinv(DenseMatrix.fromArray(RECT));
    const got = pinv(DenseMatrix.fromArray(scaled(RECT, s)));
    expectScaled(flat(got), flat(ref), 1 / s);
  });

  it.each(SCALES)('normFro, s = %s', (s) => {
    expectScaled([normFro(scaled(A0, s))], [normFro(A0)], s);
  });

  it('normFro of [[1e160, 1e160]] is sqrt(2) · 1e160', () => {
    expectScaled([normFro([[1e160, 1e160]])], [Math.SQRT2], 1e160);
  });

  it('svd, qr and normFro of a subnormal matrix', () => {
    const s = P(-1060);
    expectScaled(svd(scaled(B0, s)).S, svd(B0).S, s);
    expectScaled(flat(qr(scaled(B0, s)).R), flat(qr(B0).R), s);
    expectScaled([normFro(scaled(B0, s))], [normFro(B0)], s);
  });

  it.each(SCALES)('sqrtm scales by sqrt(s), s = %s', (s) => {
    const ref = matrixSqrtm(DenseMatrix.fromArray(SPD));
    const got = matrixSqrtm(DenseMatrix.fromArray(scaled(SPD, s)));
    expectScaled(flat(got), flat(ref), Math.sqrt(s));
  });

  it.each(SCALES)('logm adds ln(s) on the diagonal, s = %s', (s) => {
    const ref = flat(matrixLogm(DenseMatrix.fromArray(SPD)));
    const want = ref.map((v, i) => (i % 4 === 0 ? v + Math.log(s) : v));
    const got = flat(matrixLogm(DenseMatrix.fromArray(scaled(SPD, s))));
    expectScaled(got, want, 1);
  });
});

describe('#1104 norm, condest and lstsq of an extreme matrix', () => {
  it.each(SCALES)('DenseMatrix.norm, s = %s', (s) => {
    const ref = DenseMatrix.fromArray(A0).norm();
    expectScaled([DenseMatrix.fromArray(scaled(A0, s)).norm()], [ref], s);
  });

  it('DenseMatrix.norm of [[1e200, 1e200]] is sqrt(2) · 1e200', () => {
    expectScaled([DenseMatrix.fromArray([[1e200, 1e200]]).norm()], [Math.SQRT2], 1e200);
  });

  it.each([...SCALES, P(-1060)])('condest is scale-free, s = %s', (s) => {
    const ref = condest(DenseMatrix.fromArray(B0));
    expectScaled([condest(DenseMatrix.fromArray(scaled(B0, s)))], [ref], 1);
  });

  it.each([...SCALES, P(-1060)])('lstsq scales by 1/s on A and by s on b, s = %s', (s) => {
    const b = [1, 2, 3];
    const ref = lstsq(B0, b);
    // x = ref / s overflows for s = 2^-1060, which no double holds.
    if (Number.isFinite(1 / s)) expectScaled(lstsq(scaled(B0, s), b), ref, 1 / s);
    expectScaled(
      lstsq(
        scaled(B0, s),
        b.map((v) => v * s)
      ),
      ref,
      1
    );
  });
});

// ---------------------------------------------------------------------------
// Per-routine windows (#1104). Oracles: NumPy 2.3.5 and SciPy 1.16.3. NumPy eigvals
// is wrong from about 1e150, so the Schur oracle is eig(A) at scale 1, times the scale.
// A logm oracle at a scale s is logm(A) + ln(s)·I, from SciPy at scale 1.
// ---------------------------------------------------------------------------

const R43 = [
  [0.3, -1.2, 0.7],
  [1.1, 0.4, -0.5],
  [-0.8, 0.9, 1.3],
  [0.2, -0.6, 0.45],
];
const ORACLE: Record<
  string,
  { S: number[]; cond: number; pinv: number[][]; eig?: number[]; logm?: number[][] }
> = {
  R43: {
    S: [1.9458844829448894, 1.6902668561130791, 0.8596694330729157],
    cond: 2.2635264301410176,
    pinv: [
      [0.2676686553967171, 0.8796138815471379, 0.11618051007026363, 0.2253427086767205],
      [-0.3406201317969098, 0.3990005754364978, 0.3856587791027431, -0.14093785079440085],
      [0.3789575487218224, 0.26232174273767056, 0.5712687890085562, 0.2738692478943032],
    ],
  },
  A0: {
    S: [4.893788690866969, 2.7425449794775196, 1.367215888104444],
    cond: 3.579382549197763,
    pinv: [
      [0.5994550408719346, -0.19073569482288813, -0.02724795640326967],
      [-0.20163487738419617, 0.427792915531335, -0.08174386920980922],
      [0.005449591280653926, -0.09264305177111706, 0.2724795640326975],
    ],
    eig: [1.3692220962882768, 2.7404831087355435, 4.890294794976178],
    logm: [
      [0.5875342509571101, 0.4125857611490538, 0.12228319370608914],
      [0.42602731104800395, 0.9765972997830012, 0.2781702621595533],
      [0.04648681642575316, 0.2916118120585033, 1.3454980237604675],
    ],
  },
  SPD: {
    S: [5.84007180916422, 3.9229361013821045, 2.236992089453674],
    cond: 2.6106805816155134,
    pinv: [
      [0.273170731707317, -0.08780487804878045, -0.009756097560975632],
      [-0.08780487804878048, 0.38536585365853654, -0.06829268292682922],
      [-0.009756097560975643, -0.06829268292682932, 0.21463414634146344],
    ],
    eig: [2.236992089453674, 3.9229361013821062, 5.840071809164224],
    logm: [
      [1.3441979560158794, 0.28644998416152745, 0.08221156024405439],
      [0.28644998416152734, 1.0141669491138428, 0.25158516596912245],
      [0.08221156024405428, 0.2515851659691225, 1.578350712888797],
    ],
  },
};
const SMALL: Record<string, { absR: number[][]; sqrtm: number[][] }> = {
  'A0e-20': {
    absR: [
      [2.2561028345356953e-20, 2.3491836980430618e-20, 1.418375062969396e-20],
      [0.0, 2.3412253101418327e-20, 1.7802542994501428e-20],
      [0.0, 0.0, 3.474033219477879e-20],
    ],
    sqrtm: [
      [1.374892359442401e-10, 3.162803442259254e-11, 1.2430783850350823e-11],
      [3.21693517603438e-11, 1.681699650257682e-10, 2.6214861045079922e-11],
      [6.3758356347079346e-12, 2.675617838283121e-11, 1.9803871810066914e-10],
    ],
  },
  'A0e-40': {
    absR: [
      [2.2561028345356955e-40, 2.3491836980430616e-40, 1.418375062969396e-40],
      [0.0, 2.341225310141833e-40, 1.7802542994501428e-40],
      [0.0, 0.0, 3.4740332194778795e-40],
    ],
    sqrtm: [
      [1.3748923594424007e-20, 3.162803442259268e-21, 1.2430783850350876e-21],
      [3.2169351760343992e-21, 1.6816996502576812e-20, 2.621486104507999e-21],
      [6.375835634707977e-22, 2.675617838283124e-21, 1.9803871810066918e-20],
    ],
  },
  'A0e-100': {
    absR: [
      [2.2561028345356954e-100, 2.349183698043062e-100, 1.4183750629693962e-100],
      [0.0, 2.341225310141833e-100, 1.7802542994501436e-100],
      [0.0, 0.0, 3.47403321947788e-100],
    ],
    sqrtm: [
      [1.3748923594424003e-50, 3.162803442259263e-51, 1.243078385035081e-51],
      [3.2169351760343926e-51, 1.681699650257681e-50, 2.6214861045079955e-51],
      [6.375835634707927e-52, 2.675617838283121e-51, 1.9803871810066905e-50],
    ],
  },
  'SPDe-20': {
    absR: [
      [4.153311931459037e-20, 1.8057877962865383e-20, 1.3242443839434612e-20],
      [0.0, 2.7819292648776326e-20, 2.195848661321952e-20],
      [0.0, 0.0, 4.4356088046811336e-20],
    ],
    sqrtm: [
      [1.9796352413798593e-10, 2.6525457368125373e-11, 1.0336499517764541e-11],
      [2.6525457368125405e-11, 1.693479030796477e-10, 2.4853326415954955e-11],
      [1.033649951776452e-11, 2.485332641595493e-11, 2.2198078507785584e-10],
    ],
  },
  'SPDe-40': {
    absR: [
      [4.153311931459037e-40, 1.8057877962865379e-40, 1.3242443839434614e-40],
      [0.0, 2.781929264877633e-40, 2.1958486613219514e-40],
      [0.0, 0.0, 4.4356088046811335e-40],
    ],
    sqrtm: [
      [1.979635241379859e-20, 2.652545736812544e-21, 1.0336499517764507e-21],
      [2.65254573681254e-21, 1.6934790307964772e-20, 2.4853326415954958e-21],
      [1.0336499517764503e-21, 2.4853326415954943e-21, 2.2198078507785587e-20],
    ],
  },
  'SPDe-100': {
    absR: [
      [4.1533119314590375e-100, 1.8057877962865385e-100, 1.3242443839434613e-100],
      [0.0, 2.781929264877633e-100, 2.1958486613219521e-100],
      [0.0, 0.0, 4.435608804681134e-100],
    ],
    sqrtm: [
      [1.9796352413798626e-50, 2.6525457368125357e-51, 1.0336499517764468e-51],
      [2.652545736812534e-51, 1.6934790307964775e-50, 2.4853326415954964e-51],
      [1.033649951776442e-51, 2.4853326415954985e-51, 2.219807850778558e-50],
    ],
  },
};
const MATS: Record<string, number[][]> = { R43, A0, SPD };

/** got ≈ want, measured against the largest |want| (or `floor`, when it is larger). */
function expectClose(got: number[], want: number[], tol = 1e-10, floor = 0): void {
  expect(got.length).toBe(want.length);
  const top = Math.max(floor, ...want.map(Math.abs));
  for (let i = 0; i < got.length; i++) {
    expect(Math.abs(got[i] - want[i])).toBeLessThanOrEqual(tol * top);
  }
}

/** The same bits, entry by entry (+0 and -0 are equal). */
function expectBits(got: number[], want: number[]): void {
  expect(got.length).toBe(want.length);
  for (let i = 0; i < got.length; i++) expect(Object.is(got[i] + 0, want[i] + 0)).toBe(true);
}

const dm = (A: number[][]): DenseMatrix => DenseMatrix.fromArray(A);
const diagOf = (M: DenseMatrix): number[] => M.toArray().map((r, i) => r[i]);
const ascending = (v: number[]): number[] => [...v].sort((a, b) => a - b);
/** Flattened M + c·I of a 3x3 or 2x2 matrix. */
const addDiag = (M: number[][], c: number): number[] =>
  M.flatMap((r, i) => r.map((v, k) => (i === k ? v + c : v)));
const pow2 = (A: number[][], k: number): number[][] => A.map((r) => r.map((v) => ldexp(v, k)));
const by = (v: number[], k: number): number[] => v.map((x) => ldexp(x, k));
/** A, divided by its largest |entry|, so that the largest |entry| is exactly 1. */
const unitMax = (A: number[][]): number[][] => {
  const m = Math.max(...A.flat().map(Math.abs));
  return A.map((r) => r.map((v) => v / m));
};

describe('#1104 in-window fixes: large matrices', () => {
  for (const name of ['R43', 'A0', 'SPD']) {
    it.each([1e80, 1e100, 1e120])(`${name} · %s: svd family, schur, logm`, (s) => {
      const A = scaled(MATS[name], s);
      const o = ORACLE[name];
      expectClose(
        svd(A).S,
        o.S.map((v) => v * s)
      );
      expectClose(
        singularValues(A),
        o.S.map((v) => v * s)
      );
      expectClose([norm2(A)], [o.S[0] * s]);
      expectClose([cond(A)], [o.cond], 1e-8);
      expectClose(
        flat(pinv(A)),
        o.pinv.flat().map((v) => v / s),
        1e-8
      );
      expectClose(flat(lowRankApprox(A, 3)), A.flat());
      if (o.eig) {
        expectClose(
          ascending(diagOf(matrixSchur(A).T)),
          o.eig.map((v) => v * s)
        );
        expectClose(flat(matrixLogm(dm(A))), addDiag(o.logm as number[][], Math.log(s)), 1e-9, 1);
      }
    });
  }
});

describe('#1104 in-window fixes: small matrices', () => {
  for (const name of ['A0', 'SPD']) {
    it.each([20, 40, 100])(`${name} · 1e-%s: qr family, sqrtm, logm`, (p) => {
      const s = 10 ** -p;
      const A = scaled(MATS[name], s);
      const o = SMALL[`${name}e-${p}`];
      expectClose(flat(qr(A).R).map(Math.abs), o.absR.flat());
      const At = A[0].map((_, j) => A.map((r) => r[j]));
      // L of A is R of Aᵀ, transposed.
      expectClose(flat(lq(A).L).map(Math.abs), flat(qr(At).R.transpose()).map(Math.abs));
      for (const [Q, F] of [
        [qr(A).Q, qr(A).R],
        [lq(A).Q, lq(A).L],
        [rq(A).Q, rq(A).R],
        [ql(A).Q, ql(A).L],
      ] as const) {
        // Q is orthogonal (a tiny matrix gave Q = I before), and the factor has digits.
        const q = Q.toArray();
        for (let j = 0; j < q[0].length; j++) {
          expect(Math.hypot(...q.map((r) => r[j]))).toBeCloseTo(1, 12);
        }
        expect(Math.max(...flat(F).map(Math.abs))).toBeGreaterThan(s);
      }
      expectClose(flat(matrixSqrtm(dm(A))), o.sqrtm.flat(), 1e-9);
      const logm1 = ORACLE[name].logm as number[][];
      expectClose(flat(matrixLogm(dm(A))), addDiag(logm1, Math.log(s)), 1e-9, 1);
    });
  }

  it('qr([[3,1],[4,2]] · 1e-100): |R| = [[5, 2.2], [0, 0.4]] · 1e-100 (NumPy)', () => {
    const A = scaled(
      [
        [3, 1],
        [4, 2],
      ],
      1e-100
    );
    expectClose(flat(qr(A).R).map(Math.abs), [5e-100, 2.2e-100, 0, 0.4e-100]);
  });

  it('sqrtm and logm of [[4,1],[1,3]] · 1e-100 (SciPy)', () => {
    const A = dm(
      scaled(
        [
          [4, 1],
          [1, 3],
        ],
        1e-100
      )
    );
    expectClose(
      flat(matrixSqrtm(A)),
      [
        1.9815776331353157e-50, 2.708322060941794e-51, 2.708322060941794e-51,
        1.7107454270411364e-50,
      ],
      1e-9
    );
    expectClose(
      flat(matrixLogm(A)),
      [-228.91152437706648, 0.2960745718783782, 0.2960745718783782, -229.20759894894485],
      1e-9,
      1
    );
  });

  it('sqrtm of A0 · 2^-26, row 0 (SciPy)', () => {
    const row = matrixSqrtm(dm(pow2(A0, -26))).toArray()[0];
    expectClose(row, [1.6783353997099602e-4, 3.860844045726622e-5, 1.5174296692322898e-5], 1e-8);
  });

  it('schur of A0 · 1e-80 (SciPy)', () => {
    expectClose(
      ascending(diagOf(matrixSchur(scaled(A0, 1e-80)).T)),
      [1.3692220962882786e-80, 2.7404831087355437e-80, 4.890294794976178e-80],
      1e-12
    );
  });
});

describe('#1104 window edges', () => {
  // Inside the window the kernel runs unscaled. Outside it, the input is scaled by an
  // exact power of 2: a large matrix to the top of the window, a small one to [1, 2).
  // The result at an outside edge is then the result at that target, scaled back bit for bit.
  const U = unitMax(A0);
  const S2 = unitMax(SPD);
  const schurT = (A: number[][]): number[] => flat(matrixSchur(A).T);
  const svdS = (A: number[][]): number[] => svd(A).S;
  const logmF = (A: number[][]): number[] => flat(matrixLogm(dm(A)));
  const qrR = (A: number[][]): number[] => flat(qr(A).R);
  const sqrtmF = (A: number[][]): number[] => flat(matrixSqrtm(dm(A)));
  const shiftDiag = (v: number[], c: number): number[] =>
    v.map((x, i) => (i % 4 === 0 ? x + c : x));

  it('schur: 2^±128 are inside; 2^129 runs at 2^127, 2^-129 at 2^0', () => {
    expectBits(schurT(pow2(U, 129)), by(schurT(pow2(U, 127)), 2));
    expectBits(schurT(pow2(U, -129)), by(schurT(U), -129));
    expectClose(schurT(pow2(U, 128)), by(schurT(U), 128));
    expectClose(schurT(pow2(U, -128)), by(schurT(U), -128));
  });

  it('svd: 2^128 is inside; 2^129 runs at 2^127', () => {
    expectBits(svdS(pow2(U, 129)), by(svdS(pow2(U, 127)), 2));
    expectClose(svdS(pow2(U, 128)), by(svdS(U), 128));
  });

  it('logm: 2^128 and 2^-20 are inside; 2^129 runs at 2^127, 2^-21 at 2^0', () => {
    expectBits(logmF(pow2(S2, 129)), shiftDiag(logmF(pow2(S2, 127)), 2 * Math.LN2));
    expectBits(logmF(pow2(S2, -21)), shiftDiag(logmF(S2), -21 * Math.LN2));
    expectClose(logmF(pow2(S2, 128)), shiftDiag(logmF(S2), 128 * Math.LN2), 1e-9, 1);
    expectClose(logmF(pow2(S2, -20)), shiftDiag(logmF(S2), -20 * Math.LN2), 1e-9, 1);
  });

  it('qr: 2^400 and 2^-20 are inside; 2^401 runs at 2^399, 2^-21 at 2^0', () => {
    expectBits(qrR(pow2(U, 401)), by(qrR(pow2(U, 399)), 2));
    expectBits(qrR(pow2(U, -21)), by(qrR(U), -21));
    expectClose(qrR(pow2(U, 400)), by(qrR(U), 400));
    expectClose(qrR(pow2(U, -20)), by(qrR(U), -20));
  });

  it('sqrtm: 2^400 and 2^-20 are inside; 2^401 runs at 2^399, 2^-21 at 2^-1 (even exponents)', () => {
    expectBits(sqrtmF(pow2(S2, 401)), by(sqrtmF(pow2(S2, 399)), 1));
    expectBits(sqrtmF(pow2(S2, -21)), by(sqrtmF(pow2(S2, -1)), -10));
    expectClose(sqrtmF(pow2(S2, 400)), by(sqrtmF(S2), 200));
    expectClose(sqrtmF(pow2(S2, -20)), by(sqrtmF(S2), -10));
  });

  it.each([
    ['schur', -FOURTH, FOURTH],
    ['svd family', -SQUARED, FOURTH],
    ['logm', ABS_CUTOFF_LO, FOURTH],
    ['qr family and sqrtm', ABS_CUTOFF_LO, SQUARED],
    ['qrPivoted and condest', -SQUARED, SQUARED],
  ])('%s: the scale exponent is 0 exactly on [2^lo, 2^hi]', (_name, lo, hi) => {
    expect(pow2ScaleExponent(ldexp(1, lo), lo, hi)).toBe(0);
    expect(pow2ScaleExponent(ldexp(1, hi), lo, hi)).toBe(0);
    // The adjacent doubles outside the window.
    const below = ldexp(1 - 2 ** -53, lo);
    const above = ldexp(1 + 2 ** -52, hi);
    for (const x of [below, above]) {
      // Scaled, the value is inside the window (Math.log2 may round it to [0.5, 1)).
      const e = pow2ScaleExponent(x, lo, hi);
      expect(e).not.toBe(0);
      expect(ldexp(x, e)).toBeGreaterThanOrEqual(0.5);
      expect(ldexp(x, e)).toBeLessThanOrEqual(ldexp(1, hi));
    }
    expect(pow2ScaleExponent(ldexp(1, hi + 1), lo, hi)).toBe(-2);
    expect(pow2ScaleExponent(ldexp(1, lo - 1), lo, hi)).toBe(-lo + 1);
    expect(pow2ScaleExponent(NaN, lo, hi)).toBe(0);
    expect(pow2ScaleExponent(Infinity, lo, hi)).toBe(0);
    expect(pow2ScaleExponent(0, lo, hi)).toBe(0);
  });
});

describe('#1104 top of the window', () => {
  it('logm(diag(1e130, 1e110)) = diag(130, 110) · ln 10', () => {
    const L = matrixLogm(
      dm([
        [1e130, 0],
        [0, 1e110],
      ])
    );
    // The kernel is accurate to about 1e-12 relative near the top of the window.
    expectClose(flat(L), [130 * Math.LN10, 0, 0, 110 * Math.LN10], 2e-12);
  });

  it('sqrtm(diag(1e130, 1e110))[1][1] = 1e55', () => {
    const R = matrixSqrtm(
      dm([
        [1e130, 0],
        [0, 1e110],
      ])
    ).toArray();
    expect(R[1][1]).toBe(1e55);
  });

  it('schur(diag(1e160, 1e-170)).T[1][1] = 1e-170 (SciPy)', () => {
    const T = matrixSchur([
      [1e160, 0],
      [0, 1e-170],
    ]).T.toArray();
    expect(T[1][1]).toBe(1e-170);
  });

  it('svd(diag(1e200, 1, 1e-200)) preserves all representable singular values', () => {
    // Use the NumPy result. The unscaled Jacobi fallback preserves the small
    // column even when globally scaling the matrix would lose the entry.
    const S = svd([
      [1e200, 0, 0],
      [0, 1, 0],
      [0, 0, 1e-200],
    ]).S;
    expect(S).toEqual([1e200, 1, 1e-200]);
  });
});

describe('#1104 lossy scale: the unscaled result is kept when it is finite', () => {
  it('svd([[1e100, 1], [1, 1e-250]]).S[1] = 1e-100', () => {
    // The scale 2^-332 would push 1e-250 below 2^-1022.
    expect(
      svd([
        [1e100, 1],
        [1, 1e-250],
      ]).S[1]
    ).toBe(1e-100);
  });

  it('schur(diag(1e60, 1e-300)).T[1][1] = 1e-300', () => {
    // The scale 2^-71 would push 1e-300 below 2^-1022.
    expect(
      matrixSchur([
        [1e60, 0],
        [0, 1e-300],
      ]).T.toArray()[1][1]
    ).toBe(1e-300);
  });

  it('svd with a lossy global scale retains the orthogonal part of the middle column', () => {
    // NumPy gives S[1] = 1e110. The fallback must project away the parallel
    // component even when squaring the ratio of column norms would overflow.
    const S = svd([
      [1e130, 1e110, 0],
      [0, 1e110, 0],
      [0, 0, 1e-250],
    ]).S;
    expect(S[1] / 1e110).toBeCloseTo(1, 12);
  });
});

describe('#1104 guard inputs keep the unscaled result', () => {
  // The values are those of the build without scaling. A matrix with a NaN or an
  // infinite entry is never scaled.
  const GUARD: Record<string, Record<string, string>> = {
    nan: {
      schur: '[["NaN","NaN"],[0,"NaN"]]',
      qr: '[["NaN","NaN"],[0,"NaN"]]',
      lq: '[["NaN",0],["NaN","NaN"]]',
      rq: '[["NaN","NaN"],[0,1.4142135623730951]]',
      ql: '[["NaN",0],["NaN",1.4142135623730951]]',
      qrPivoted: '[["NaN","NaN"],[0,"NaN"]]',
      svd: '["NaN","NaN"]',
      singularValues: '["NaN","NaN"]',
      norm2: '0',
      cond: '"NaN"',
      pinv: '[[0,0],[0,0]]',
      lowRankApprox: '[["NaN","NaN"],["NaN","NaN"]]',
      sqrtm: 'throws',
      logm: '[["NaN","NaN"],["NaN","NaN"]]',
      condest: '"NaN"',
    },
    inf: {
      schur: '[["Infinity",1],[0,1]]',
      qr: '[["Infinity","NaN"],[0,"NaN"]]',
      lq: '[["Infinity",0],["NaN","NaN"]]',
      rq: '[["NaN","NaN"],[0,1.4142135623730951]]',
      ql: '[["NaN",0],["NaN",1.4142135623730951]]',
      qrPivoted: '[["Infinity",1],[0,1]]',
      svd: '["Infinity",1.4142135623730951]',
      singularValues: '["Infinity",1.4142135623730951]',
      norm2: '"Infinity"',
      cond: '"Infinity"',
      pinv: '[[0,0],[0,0]]',
      lowRankApprox: '[["NaN","NaN"],["NaN","NaN"]]',
      sqrtm: 'throws',
      logm: 'throws',
      condest: '"Infinity"',
    },
    bigNaN: {
      schur: '[[1e+300,"NaN"],[0,1]]',
      qr: '[["Infinity","NaN"],[0,"NaN"]]',
      lq: '[["NaN",0],["NaN","NaN"]]',
      rq: '[["NaN","NaN"],[0,1.4142135623730951]]',
      ql: '[["NaN",0],["NaN","NaN"]]',
      qrPivoted: '[[1e+300,"NaN"],[0,1]]',
      svd: '["NaN","NaN"]',
      singularValues: '["NaN","NaN"]',
      norm2: '0',
      cond: '"NaN"',
      pinv: '[[0,0],[0,0]]',
      lowRankApprox: '[["NaN","NaN"],["NaN","NaN"]]',
      sqrtm: 'throws',
      logm: '[["NaN","NaN"],[0,0]]',
      condest: '"NaN"',
    },
    zero: {
      schur: '[[0,0],[0,0]]',
      qr: '[[0,0],[0,0]]',
      lq: '[[0,0],[0,0]]',
      rq: '[[0,0],[0,0]]',
      ql: '[[0,0],[0,0]]',
      qrPivoted: '[[0,0],[0,0]]',
      svd: '[0,0]',
      singularValues: '[0,0]',
      norm2: '0',
      cond: '"Infinity"',
      pinv: '[[0,0],[0,0]]',
      lowRankApprox: '[[0,0],[0,0]]',
      sqrtm: '[[0,0],[0,0]]',
      logm: 'throws',
      condest: '0',
    },
    one0: {
      schur: '[[0]]',
      qr: '[[0]]',
      lq: '[[0]]',
      rq: '[[0]]',
      ql: '[[0]]',
      qrPivoted: '[[0]]',
      svd: '[0]',
      singularValues: '[0]',
      norm2: '0',
      cond: '"Infinity"',
      pinv: '[[0]]',
      lowRankApprox: '[[0]]',
      sqrtm: '[[0]]',
      logm: 'throws',
      condest: '0',
    },
    empty: {
      schur: '[]',
      qr: '[]',
      lq: '[]',
      rq: '[]',
      ql: '[]',
      qrPivoted: '[]',
      svd: '[]',
      singularValues: '[]',
      norm2: '0',
      cond: '"Infinity"',
      pinv: '[]',
      lowRankApprox: '[]',
      sqrtm: 'throws',
      logm: 'throws',
      condest: 'throws',
    },
  };
  const enc = (v: unknown): string =>
    JSON.stringify(v, (_k, x: unknown) =>
      typeof x === 'number' && !Number.isFinite(x) ? String(x) : x
    );
  const arr = (x: unknown): unknown =>
    x instanceof DenseMatrix ? x.toArray() : Array.isArray(x) ? x : x;
  const inputs: Record<string, number[][]> = {
    nan: [
      [NaN, 1],
      [1, 1],
    ],
    inf: [
      [Infinity, 1],
      [1, 1],
    ],
    bigNaN: [
      [1e300, NaN],
      [1, 1],
    ],
    zero: [
      [0, 0],
      [0, 0],
    ],
    one0: [[0]],
    empty: [],
  };
  const routines: Record<string, (A: number[][]) => unknown> = {
    schur: (A) => matrixSchur(A).T,
    qr: (A) => qr(A).R,
    lq: (A) => lq(A).L,
    rq: (A) => rq(A).R,
    ql: (A) => ql(A).L,
    qrPivoted: (A) => qrPivoted(A).R,
    svd: (A) => svd(A).S,
    singularValues: (A) => singularValues(A),
    norm2: (A) => norm2(A),
    cond: (A) => cond(A),
    pinv: (A) => pinv(A),
    lowRankApprox: (A) => lowRankApprox(A, 1),
    sqrtm: (A) => matrixSqrtm(dm(A)),
    logm: (A) => matrixLogm(dm(A)),
    condest: (A) => condest(dm(A)),
  };
  for (const [iname, A] of Object.entries(inputs)) {
    it(`${iname}: every routine`, () => {
      for (const [r, f] of Object.entries(routines)) {
        let got: string;
        try {
          got = enc(arr(f(A.map((row) => row.slice()))));
        } catch {
          got = 'throws';
        }
        expect(`${r}: ${got}`).toBe(`${r}: ${GUARD[iname][r]}`);
      }
    });
  }

  it('1x1 matrices are exact: qr, lq, rq, ql of [[1e300]] and [[1e-300]], logm of both', () => {
    for (const v of [1e300, 1e-300]) {
      expect(qr([[v]]).R.toArray()).toEqual([[v]]);
      expect(lq([[v]]).L.toArray()).toEqual([[v]]);
      expect(rq([[v]]).R.toArray()).toEqual([[v]]);
      expect(ql([[v]]).L.toArray()).toEqual([[v]]);
      expectClose(flat(matrixLogm(dm([[v]]))), [Math.log(v)], 1e-13);
      expect(svd([[v]]).S).toEqual([v]);
      expect(matrixSchur([[v]]).T.toArray()).toEqual([[v]]);
    }
  });
});

describe('#1104 Frobenius norms at the 2^-800 threshold and on overflow', () => {
  // A sum of squares that is finite and at least 2^-800 gives sqrt(sum), as before.
  // Below it, or on overflow, the norm is recomputed with a running scale.
  const above = [[ldexp(1, -399), 0]]; // sum = 2^-798
  const below = [[ldexp(1, -401), 0]]; // sum = 2^-802
  const over = [[1e200, 1e200]];
  const want = (M: number[][]): number => Math.hypot(...M.flat());
  const views: Record<string, (M: number[][]) => number> = {
    normFro: (M) => normFro(M),
    'DenseMatrix.norm': (M) => dm(M).norm(),
    'DenseMatrix.norm (non-contiguous view)': (M) => {
      const wide = M.map((r) => [...r, 7]);
      return dm(wide).slice({ colEnd: M[0].length }).norm();
    },
    'SparseMatrix.norm': (M) => SparseMatrix.fromDense(dm(M)).norm(),
    'Array norm': (M) => typedNorm(M.flat()) as number,
    parallelMatrixNorm: (M) => parallelMatrixNorm(M.flat()) as number,
  };
  for (const [name, f] of Object.entries(views)) {
    it(name, () => {
      expect(f(above)).toBe(Math.sqrt(2 ** -798));
      expect(f(below)).toBe(want(below));
      expect(f(below)).toBe(ldexp(1, -401));
      expect(f(over) / 1e200).toBeCloseTo(Math.SQRT2, 14);
      expect(f([[Infinity, Infinity]])).toBe(Infinity);
      // SparseMatrix.fromDense drops a NaN entry, so its norm has no NaN to see.
      if (name !== 'SparseMatrix.norm') expect(f([[NaN, 1]])).toBeNaN();
      expect(f([[0, 0]])).toBe(0);
    });
  }
});

describe('#1104 lstsq ratio window', () => {
  it.each([400, -400, 401, -401])('b scaled by 2^%s', (k) => {
    const b = [1, 2, 3].map((v) => ldexp(v, k));
    const ref = lstsq(B0, [1, 2, 3]);
    expectScaled(lstsq(B0, b), ref, ldexp(1, k));
  });
});
