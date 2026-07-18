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
