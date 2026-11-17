/**
 * Dogfood #989 (part B): recurrences, sums and node rules stop for a huge order.
 *
 * Every row returns or throws at once. A row marked "(hang before the fix)" ran for ever
 * (or out of memory) before this change, so the red run skips it. Reference values come
 * from SciPy 1.16.3 and mpmath.
 */
import { describe, it, expect } from 'vitest';
import {
  besselJ,
  besselY,
  besselK,
  chebyshevT,
  hermiteH,
  laguerreL,
  legendreP,
} from '../src/typed/special.js';
import {
  sphericalBesselJ,
  sphericalBesselI,
  sphericalBesselK,
  sphericalBesselY,
  besselJZeros,
} from '../src/special/spherical-bessel.js';
import { polygamma, jacobiP, gegenbauerC } from '../src/special/polygamma-orthopoly.js';
import { ferrersP } from '../src/special/spheroidal.js';
import { sphericalHarmonic } from '../src/special/angular-momentum.js';
import { expn } from '../src/special/exp-integrals.js';
import { siegelZ } from '../src/special/wave-functions.js';
import { zipfPMF } from '../src/stats/distributions-extra.js';
import { binomialTest } from '../src/typed/hypothesis.js';
import { rootsLegendre } from '../src/numeric/gauss-nodes.js';
import {
  rootsHermite,
  rootsLaguerre,
  rootsJacobi,
  gaussHermiteIntegrate,
} from '../src/numeric/gauss-nodes-extra.js';
import { mathieuA, mathieuB, mathieuCe, mathieuSe } from '../src/special/mathieu.js';
import { discreteLog } from '../src/numbertheory/extra.js';
import { gaussQuad } from '../src/typed/integration.js';

const MAX = Number.MAX_VALUE;
const RECURRENCE = /exceeds the supported maximum of 1000000000/;

describe('three-term recurrences refuse an order above 1e9 (#989)', () => {
  it.each([
    ['besselJ', () => besselJ(MAX, MAX)],
    ['besselY', () => besselY(MAX, 2)],
    ['besselK', () => besselK(MAX, 2)],
    ['chebyshevT', () => chebyshevT(MAX, 0.5)],
    ['hermiteH', () => hermiteH(MAX, MAX)],
    ['laguerreL', () => laguerreL(MAX, 0.5)],
    ['legendreP', () => legendreP(MAX, 0.5)],
  ])('%s(MAX, x) throws a RangeError (hang before the fix)', (_name, call) => {
    expect(call).toThrow(RangeError);
    expect(call).toThrow(RECURRENCE);
  });

  it('legendreP(1e7, 0.5) matches SciPy', () => {
    expect(Math.abs((legendreP(1e7, 0.5) as number) - -0.00019171660957659144)).toBeLessThan(1e-12);
  });
  it('hermiteH(1e9, 0.5) stops at the first NaN (hang before the fix)', () => {
    expect(hermiteH(1e9, 0.5)).toBeNaN();
  });
  it('besselJ(1e9, 5) is 0 once the downward sweep overflows (hang before the fix)', () => {
    expect(besselJ(1e9, 5)).toBe(0);
  });
  it('besselJ(200, 5) and besselJ(5, 1e-10) match mpmath (NaN before the fix)', () => {
    expect(Math.abs((besselJ(200, 5) as number) / 4.76001008800229e-296 - 1)).toBeLessThan(1e-12);
    expect(Math.abs((besselJ(5, 1e-10) as number) / 2.604166666666667e-54 - 1)).toBeLessThan(1e-12);
  });
  it('besselJ keeps its non-finite order rule', () => {
    expect(besselJ(Infinity, 1)).toBeNaN();
    expect(besselJ(NaN, 1)).toBeNaN();
  });
});

describe('spherical Bessel functions (#989)', () => {
  it('sphericalBesselY(3, 2.5) matches SciPy', () => {
    expect(sphericalBesselY(3, 2.5)).toBeCloseTo(-0.7966031232532497, 12);
  });
  it('sphericalBesselK(3, 2.5) matches mpmath', () => {
    expect(Math.abs(sphericalBesselK(3, 2.5) / 0.3486505539304314 - 1)).toBeLessThan(1e-14);
  });
  it('sphericalBesselY(1e9, 5) is NaN at the first overflow (hang before the fix)', () => {
    expect(sphericalBesselY(1e9, 5)).toBeNaN();
  });
  it('sphericalBesselK(1e9, 5) is Infinity at the first overflow (hang before the fix)', () => {
    expect(sphericalBesselK(1e9, 5)).toBe(Infinity);
  });
  it('sphericalBesselY and K give NaN for a non-number x', () => {
    expect(sphericalBesselY(3, 'a' as unknown as number)).toBeNaN();
    expect(sphericalBesselK(3, 'a' as unknown as number)).toBeNaN();
  });
  it('sphericalBesselJ and I refuse a sweep above 1e9 (hang before the fix)', () => {
    expect(() => sphericalBesselJ(1e12, 5)).toThrow(RangeError);
    expect(() => sphericalBesselI(5, 1e12)).toThrow(RangeError);
  });
  it('sphericalBesselJ(1e6, 5) returns quickly now that the sweep keeps no array (hang before the fix)', () => {
    expect(sphericalBesselJ(1e6, 5)).toBe(0);
  });
  it('besselJZeros refuses a huge count or order (hang before the fix)', () => {
    expect(() => besselJZeros(0, 1e9)).toThrow(RangeError);
    expect(() => besselJZeros(1e12, 1)).toThrow(RangeError);
  });
  it('besselJZeros(0, 3) matches SciPy', () => {
    const z = besselJZeros(0, 3);
    expect(z[0]).toBeCloseTo(2.404825557695773, 12);
    expect(z[2]).toBeCloseTo(8.65372791291101, 12);
  });
});

describe('orthogonal polynomials and angular functions (#989)', () => {
  it('polygamma(1e9, 2) is NaN at once (hang before the fix)', () => {
    expect(polygamma(1e9, 2)).toBeNaN();
  });
  it('polygamma refuses a huge negative argument (hang before the fix)', () => {
    expect(() => polygamma(1, -1e12 + 0.5)).toThrow(RangeError);
  });
  it('polygamma(1, 2) is unchanged', () => {
    expect(polygamma(1, 2)).toBeCloseTo(0.6449340668482264, 12);
  });
  it('jacobiP and gegenbauerC refuse a huge degree (hang before the fix)', () => {
    expect(() => jacobiP(1e12, 0.5, 0.5, 0.3)).toThrow(RangeError);
    expect(() => gegenbauerC(1e12, 0.7, 0.3)).toThrow(RangeError);
  });
  it('ferrersP and sphericalHarmonic refuse a huge degree (hang before the fix)', () => {
    expect(() => ferrersP(1e12, 2, 0.3)).toThrow(RangeError);
    expect(() => ferrersP(1e12, 1e12, 0.3)).toThrow(RangeError);
    expect(() => sphericalHarmonic(1e12, 0, 1, 1)).toThrow(RangeError);
  });
  it('ferrersP keeps NaN for a non-finite degree', () => {
    expect(ferrersP(Infinity, 2, 0.3)).toBeNaN();
  });
});

describe('sums and exponential integrals (#989)', () => {
  it('expn(1e12, 0.5) refuses the order (hang before the fix)', () => {
    expect(() => expn(1e12, 0.5)).toThrow(RangeError);
  });
  it('expn gives NaN for a non-number x (hang before the fix)', () => {
    expect(expn(1e9, 'a' as unknown as number)).toBeNaN();
  });
  it('expn(2, 1) is unchanged', () => {
    expect(expn(2, 1)).toBeCloseTo(0.14849550677592205, 14);
  });
  it('siegelZ(1e6) refuses the height (hang before the fix)', () => {
    expect(() => siegelZ(1e6)).toThrow(RangeError);
  });
  it('siegelZ(15) is unchanged', () => {
    expect(siegelZ(15)).toBeCloseTo(0.7199423913, 6);
  });
  it('zipfPMF(1, 1, 1e12) and binomialTest(1e9, 1e9) refuse n (hang before the fix)', () => {
    expect(() => zipfPMF(1, 1, 1e12)).toThrow(RangeError);
    expect(() => binomialTest(1e9, 1e9)).toThrow(RangeError);
  });
  it('zipfPMF(1, 1, 3) is 6/11', () => {
    expect(zipfPMF(1, 1, 3)).toBeCloseTo(6 / 11, 14);
  });
});

describe('node rules and quadrature (#989)', () => {
  it('rootsLegendre, rootsHermite, rootsLaguerre, rootsJacobi refuse a huge n (hang before the fix)', () => {
    expect(() => rootsLegendre(1e6)).toThrow(RangeError);
    expect(() => rootsHermite(1e9)).toThrow(RangeError);
    expect(() => rootsLaguerre(1e9)).toThrow(RangeError);
    expect(() => rootsJacobi(1e9, 0, 0)).toThrow(RangeError);
  });
  it('gaussHermiteIntegrate(x => x, 1e9) throws (out of memory before the fix)', () => {
    expect(() => gaussHermiteIntegrate((x) => x, 1e9)).toThrow(RangeError);
  });
  it('gaussQuad refuses a huge or infinite n (hang before the fix)', () => {
    expect(() => gaussQuad((x) => x, 0, 1, 1e9)).toThrow(RangeError);
    expect(() => gaussQuad((x) => x, 0, 1, Infinity)).toThrow(RangeError);
  });
  it('gaussQuad(x => x, 0, 1, 1000) is 1/2', () => {
    expect(gaussQuad((x) => x, 0, 1, 1000)).toBeCloseTo(0.5, 12);
  });
  it('rootsHermite(2) is unchanged', () => {
    expect(rootsHermite(2).nodes[1]).toBeCloseTo(0.7071067811865476, 14);
  });
});

describe('Mathieu order and discrete logarithm (#989)', () => {
  it('mathieuA(100, 1) throws a RangeError that names the limit', () => {
    expect(() => mathieuA(100, 1)).toThrow(RangeError);
    expect(() => mathieuA(100, 1)).toThrow('order n must be at most 99, got 100');
  });
  it('mathieuB, mathieuCe, mathieuSe name their limit', () => {
    expect(() => mathieuB(101, 1)).toThrow('order n must be at most 100, got 101');
    expect(() => mathieuCe(100, 0, 1)).toThrow('order n must be at most 99, got 100');
    expect(() => mathieuSe(101, 0, 1)).toThrow('order n must be at most 100, got 101');
  });
  it('mathieuA(99, 1) matches SciPy', () => {
    expect(Math.abs(mathieuA(99, 1) / 9801.002551012194 - 1)).toBeLessThan(1e-12);
  });
  it('discreteLog refuses a modulus that needs more than 2^24 baby steps (hang before the fix)', () => {
    const s = 2 ** 53 - 1;
    expect(() => discreteLog(s, s, s)).toThrow(RangeError);
  });
  it('discreteLog keeps its small answers', () => {
    expect(discreteLog(2, 3, 5)).toBe(3);
    expect(discreteLog(3, 13, 17)).toBe(4);
    expect(discreteLog(2, 5, 11)).toBe(4);
  });
});
