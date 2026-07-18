/**
 * compat parity guard — numpy oracle + functions cross-check.
 *
 * `compat/src/shims.ts` REIMPLEMENTS several homonyms independently of their
 * `functions`/`core` twins so it can pin mathjs semantics (e.g. std/variance
 * default to 'unbiased', matrix-aware add/subtract/multiply). Those independent
 * bodies are allowlisted in tools/create-dependency-graph/duplicate-allowlist.json
 * as intentional — but "allowlist alone is negligent": a divergent compat impl
 * is EXACTLY how a past 10^6× variance bug hid. This test is the guard the
 * allowlist entries reference:
 *
 *   1. anchor compat's impl to the numpy oracle (expected values generated via
 *      `python -c "import numpy ..."`), and
 *   2. cross-check `compat.X ≡ functions.X` where they claim the SAME semantics.
 *
 * If a future edit makes compat diverge from numpy OR from functions, this goes
 * RED. (As of writing, all three agree to full double precision — the compat
 * bodies are independent implementations that happen to converge, which is what
 * the guard protects.)
 */
import { describe, it, expect } from 'vitest';
import {
  variance as cVariance,
  std as cStd,
  det as cDet,
  acos as cAcos,
  asin as cAsin,
  atan as cAtan,
  atan2 as cAtan2,
  conj as cConj,
  re as cRe,
  im as cIm,
  arg as cArg,
} from '../src/index.js';
import {
  variance as fVariance,
  std as fStd,
  det as fDet,
  acos as fAcos,
  asin as fAsin,
  atan as fAtan,
  atan2 as fAtan2,
  conj as fConj,
  re as fRe,
  im as fIm,
  arg as fArg,
} from '@danielsimonjr/mathts-functions';
import { Complex } from '@danielsimonjr/mathts-core';
import {
  zeros as cZeros,
  ones as cOnes,
  identity as cIdentity,
  matrix as cMatrix,
  size as cSize,
  transpose as cTranspose,
  bignumber as cBignumber,
  fraction as cFraction,
  sparse as cSparse,
  complex as cComplex,
  pi as cPi,
  e as cE,
  tau as cTau,
  phi as cPhi,
} from '../src/index.js';
import { size as fSize } from '@danielsimonjr/mathts-functions';

// numpy oracle values, generated with:
//   np.var(d, ddof=1)  (unbiased / sample, mathjs + compat DEFAULT)
//   np.var(d, ddof=0)  (uncorrected / population)
//   np.std(...)        (sqrt of the above)
//   numpy.linalg.det(...)
const VAR_CORPUS: Array<{ data: number[]; varUnbiased: number; stdUnbiased: number }> = [
  { data: [2, 4, 6], varUnbiased: 4.0, stdUnbiased: 2.0 },
  { data: [1, 2, 3, 4, 5, 8, 13], varUnbiased: 17.142857142857142, stdUnbiased: 4.140393356054125 },
];

const DET_CORPUS: Array<{ m: number[][]; det: number }> = [
  {
    m: [
      [1, 2],
      [3, 4],
    ],
    det: -2.0,
  },
  {
    m: [
      [6, 1, 1],
      [4, -2, 5],
      [2, 8, 7],
    ],
    det: -306.0,
  },
  {
    m: [
      [3, 2, 0, 1],
      [4, 0, 1, 2],
      [3, 0, 2, 1],
      [9, 2, 3, 1],
    ],
    det: 24.0,
  },
];

describe('compat parity — variance/std vs numpy oracle + functions', () => {
  for (const { data, varUnbiased, stdUnbiased } of VAR_CORPUS) {
    it(`variance([${data}]) matches numpy (unbiased) and functions`, () => {
      expect(cVariance(data)).toBeCloseTo(varUnbiased, 10); // numpy oracle
      expect(cVariance(data)).toBeCloseTo(fVariance(data), 12); // functions cross-check
    });
    it(`std([${data}]) matches numpy (unbiased) and functions`, () => {
      expect(cStd(data)).toBeCloseTo(stdUnbiased, 10);
      expect(cStd(data)).toBeCloseTo(fStd(data), 12);
    });
  }

  it('variance accepts uncorrected (population) normalization — numpy ddof=0', () => {
    // np.var([1,2,3,4,5,8,13], ddof=0) = 14.693877551020408
    expect(cVariance([1, 2, 3, 4, 5, 8, 13], 'uncorrected')).toBeCloseTo(14.693877551020408, 10);
  });
});

describe('compat parity — det vs numpy oracle + functions', () => {
  for (const { m, det } of DET_CORPUS) {
    it(`det(${m.length}x${m.length}) matches numpy.linalg.det and functions.det`, () => {
      expect(cDet(m)).toBeCloseTo(det, 8); // numpy oracle
      expect(cDet(m)).toBeCloseTo(fDet(m) as number, 10); // functions cross-check
    });
  }
});

describe('compat parity — trig wrappers vs numpy oracle + functions', () => {
  // numpy: acos(.5)=π/3, asin(.5)=π/6, atan(2), atan2(1,2)
  const cases: Array<[string, () => number, () => number, number]> = [
    ['acos(0.5)', () => cAcos(0.5), () => fAcos(0.5) as number, Math.acos(0.5)],
    ['asin(0.5)', () => cAsin(0.5), () => fAsin(0.5) as number, Math.asin(0.5)],
    ['atan(2)', () => cAtan(2), () => fAtan(2) as number, Math.atan(2)],
    ['atan2(1,2)', () => cAtan2(1, 2), () => fAtan2(1, 2) as number, Math.atan2(1, 2)],
  ];
  for (const [label, compatFn, funcsFn, oracle] of cases) {
    it(`${label} matches Math oracle and functions`, () => {
      expect(compatFn()).toBeCloseTo(oracle, 12);
      expect(compatFn()).toBeCloseTo(funcsFn(), 12);
    });
  }
});

describe('compat parity — complex re/im/conj/arg vs functions', () => {
  const z = new Complex(3, 4);
  it('re/im extract the parts and agree with functions', () => {
    expect(cRe(z)).toBe(3);
    expect(cIm(z)).toBe(4);
    expect(cRe(z)).toBe(fRe(z));
    expect(cIm(z)).toBe(fIm(z));
  });
  it('conj negates the imaginary part and agrees with functions', () => {
    const cc = cConj(z);
    expect(cc.re).toBe(3);
    expect(cc.im).toBe(-4);
    const fc = fConj(z) as Complex;
    expect(cc.re).toBe(fc.re);
    expect(cc.im).toBe(fc.im);
  });
  it('arg matches atan2(im, re) and functions', () => {
    expect(cArg(z)).toBeCloseTo(Math.atan2(4, 3), 12); // numpy angle(3+4j)
    expect(cArg(z)).toBeCloseTo(fArg(z) as number, 12);
  });
});

// --------------------------------------------------------------------------
// Homonym constructors / constants — compat's self-contained mathjs-API shim
// bodies (distinct from the functions factory twins; different return types:
// compat matrix constructors return DenseMatrix, functions return arrays).
// These are allowlisted as intentional independent bodies; this guard pins
// each to an explicit oracle so a future edit can't silently break compat.
// --------------------------------------------------------------------------
const toArr = (m: { toArray?: () => unknown; valueOf?: () => unknown }): unknown =>
  m.toArray ? m.toArray() : m.valueOf ? m.valueOf() : m;

describe('compat parity — matrix constructors vs oracle', () => {
  it('zeros(rows,cols) is a rows×cols zero matrix', () => {
    expect(toArr(cZeros(2, 2))).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(toArr(cZeros(2, 3))).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });
  it('ones(rows,cols) is a rows×cols ones matrix', () => {
    expect(toArr(cOnes(2, 3))).toEqual([
      [1, 1, 1],
      [1, 1, 1],
    ]);
  });
  it('CONTRACT: compat zeros/ones single-arg is SQUARE (cols ?? rows) — NOT the mathjs size-n vector', () => {
    // Documented divergence from mathjs (which returns [0,0,0] for zeros(3)):
    // compat's matrix constructors are always 2-D, single arg ⇒ n×n square.
    expect(toArr(cZeros(3))).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(toArr(cOnes(3))).toEqual([
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ]);
  });
  it('identity(n) is the n×n identity', () => {
    expect(toArr(cIdentity(3))).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });
  it('matrix() wraps a 2-D array, transpose() flips it', () => {
    expect(
      toArr(
        cMatrix([
          [1, 2],
          [3, 4],
        ])
      )
    ).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(
      cTranspose([
        [1, 2],
        [3, 4],
      ])
    ).toEqual([
      [1, 3],
      [2, 4],
    ]); // numpy .T oracle
  });
  it('size agrees with the functions twin and the oracle', () => {
    expect(
      cSize([
        [1, 2, 3],
        [4, 5, 6],
      ])
    ).toEqual([2, 3]);
    expect(
      cSize([
        [1, 2, 3],
        [4, 5, 6],
      ])
    ).toEqual(
      (
        fSize([
          [1, 2, 3],
          [4, 5, 6],
        ]) as { valueOf: () => unknown }
      ).valueOf()
    );
  });
});

describe('compat parity — numeric-type constructors vs oracle', () => {
  it('bignumber parses to exact value', () => {
    expect(cBignumber('1.5').toString()).toBe('1.5');
  });
  it('fraction reduces to 1/3', () => {
    const f = cFraction(2, 6); // compat's own Fraction type (numerator/denominator)
    expect(f.valueOf()).toBeCloseTo(1 / 3, 15); // 2/6 = 1/3
    expect(f.toString()).toBe('1/3');
  });
  it('complex builds re/im', () => {
    const z = cComplex(1, 2);
    expect([z.re, z.im]).toEqual([1, 2]);
  });
  it('sparse preserves the dense values', () => {
    const s = cSparse([
      [1, 0],
      [0, 2],
    ]);
    expect(s.toArray()).toEqual([
      [1, 0],
      [0, 2],
    ]);
  });
});

describe('compat parity — mathematical constants vs oracle', () => {
  it('pi/e/tau/phi match their closed-form values', () => {
    expect(cPi).toBe(Math.PI);
    expect(cE).toBe(Math.E);
    expect(cTau).toBeCloseTo(2 * Math.PI, 15);
    expect(cPhi).toBeCloseTo((1 + Math.sqrt(5)) / 2, 15); // golden ratio 1.618033988749895
  });
});
