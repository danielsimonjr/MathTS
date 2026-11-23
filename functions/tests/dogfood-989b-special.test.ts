/**
 * Dogfood #989 (part B): recurrences, sums and node rules stop for a huge order.
 *
 * Every row returns or throws at once. A row marked "(hang before the fix)" ran for ever
 * (or out of memory) before this change, so the red run skips it. Reference values come
 * from SciPy 1.16.3 and mpmath.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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
import { workerKernel } from '../src/typed/worker-kernels.js';
import {
  MAX_RECURRENCE_ORDER,
  MAX_JACOBI_ORDER,
  MAX_GEGENBAUER_ORDER,
  MAX_FERRERS_ORDER,
  MAX_EXPN_ORDER,
  MAX_LAGUERRE_ORDER,
  MAX_SPHERICAL_BESSEL_ORDER,
  MAX_BESSEL_J_SWEEP,
} from '../src/utils/limits.js';

const MAX = Number.MAX_VALUE;
const RECURRENCE = new RegExp(`exceeds the supported maximum of ${MAX_RECURRENCE_ORDER}$`);
const CHEBYSHEV = /exceeds the supported maximum of 4000000000$/;

/** Relative error of `got` against a reference value. */
function rel(got: unknown, want: number): number {
  return Math.abs((got as number) / want - 1);
}

describe('three-term recurrences refuse an order above the limit (#989)', () => {
  it('the limit is 2.5e9', () => {
    expect(MAX_RECURRENCE_ORDER).toBe(2_500_000_000);
  });
  it('the AS kernels hold the same limits as utils/limits.ts (#1113)', () => {
    // The AS source cannot import limits.ts, so it holds its own copies of the literals.
    const literal = (file: string, name: string): number => {
      const text = readFileSync(new URL(`../../assembly/src/${file}`, import.meta.url), 'utf8');
      const m = new RegExp(`const ${name}: f64 = ([0-9.e+-]+);`).exec(text);
      if (!m) throw new Error(`${name} not found in assembly/src/${file}`);
      return Number(m[1]);
    };
    expect(literal('special.ts', '_BESSEL_J_MAX_SWEEP')).toBe(MAX_BESSEL_J_SWEEP);
    expect(literal('ops/special.ts', '_ORDER_MAX_LAGUERRE')).toBe(MAX_LAGUERRE_ORDER);
    expect(literal('ops/special.ts', '_ORDER_MAX_I32')).toBe(2 ** 31 - 2);
    expect(Object.is(literal('special.ts', '_BESSEL_J_DOWN'), 2 ** -700)).toBe(true);
  });
  it.each([
    ['besselJ', () => besselJ(MAX, MAX)],
    // x = MAX: Y_MAX(2) is below -1e308, so the overflow bound returns -Infinity at once, before
    // the limit (#1331); an x above the order lets the limit decide.
    ['besselY', () => besselY(MAX, MAX)],
    ['legendreP', () => legendreP(MAX, 0.5)],
  ])('%s(MAX, x) throws a RangeError (hang before the fix)', (_name, call) => {
    expect(call).toThrow(RangeError);
    expect(call).toThrow(RECURRENCE);
  });
  it('besselY(MAX, 2) is -Infinity at once: the true value is outside the double range (#1331)', () => {
    expect(besselY(MAX, 2)).toBe(-Infinity);
  });
  it('chebyshevT has its own limit of 4e9 (hang before the fix)', () => {
    expect(() => chebyshevT(MAX, 0.5)).toThrow(CHEBYSHEV);
    expect(() => chebyshevT(4e9 + 1, 0.5)).toThrow(CHEBYSHEV);
  });
  it('the laguerreL worker kernel holds its own limit', () => {
    expect(workerKernel('laguerreL', 5)).toContain(String(MAX_LAGUERRE_ORDER));
  });
  // Each family limit is the order that returns in about 20 s; one step past it throws.
  it.each([
    ['laguerreL', MAX_LAGUERRE_ORDER, (n: number) => laguerreL(n, 0.5)],
    ['jacobiP', MAX_JACOBI_ORDER, (n: number) => jacobiP(n, 0.5, 0.5, 0.3)],
    ['gegenbauerC', MAX_GEGENBAUER_ORDER, (n: number) => gegenbauerC(n, 0.7, 0.3)],
    ['ferrersP', MAX_FERRERS_ORDER, (n: number) => ferrersP(n, 2, 0.3)],
    ['expn', MAX_EXPN_ORDER, (n: number) => expn(n, 0.5)],
    ['sphericalBesselJ', MAX_SPHERICAL_BESSEL_ORDER, (n: number) => sphericalBesselJ(n, 5)],
    ['sphericalBesselY', MAX_SPHERICAL_BESSEL_ORDER, (n: number) => sphericalBesselY(n, 5)],
    ['sphericalBesselI', MAX_SPHERICAL_BESSEL_ORDER, (n: number) => sphericalBesselI(n, 5)],
    ['sphericalBesselK', MAX_SPHERICAL_BESSEL_ORDER, (n: number) => sphericalBesselK(n, 5)],
  ])('%s throws one step above its limit', (_name, limit, call) => {
    expect(() => call((limit as number) + 1)).toThrow(
      new RegExp(`exceeds the supported maximum of ${limit as number}$`)
    );
  });
  it('sphericalBesselI refuses max(n, |x|) one step above the limit', () => {
    expect(() => sphericalBesselI(5, MAX_SPHERICAL_BESSEL_ORDER + 1)).toThrow(RangeError);
  });
  it.each(['besselJ', 'besselY', 'legendreP', 'hermiteH'])(
    'the %s worker kernel holds the shared limit',
    (name) => {
      expect(workerKernel(name, 5)).toContain(String(MAX_RECURRENCE_ORDER));
    }
  );
  it('the besselJ worker kernel holds the downward-sweep limit', () => {
    expect(workerKernel('besselJ', 5)).toContain(String(MAX_BESSEL_J_SWEEP));
  });
  it('uses a bounded expansion above the old downward sweep limit', () => {
    const n = MAX_BESSEL_J_SWEEP;
    expect(besselJ(n, n - 1)).toBeCloseTo(0.000420568474896717, 12);
  });
  it('besselJ with a small x still returns 0 at once above the sweep limit', () => {
    expect(besselJ(2e9, 5)).toBe(0);
  });
  it('the chebyshevT worker kernel holds its limit', () => {
    expect(workerKernel('chebyshevT', 5)).toContain('4000000000');
  });
  it('besselK(MAX, 2) is Infinity at the first overflow (no order limit)', () => {
    expect(besselK(MAX, 2)).toBe(Infinity);
  });
  it('besselK(MAX, 1e4) is Infinity at once (the gate of #1362; no order limit)', () => {
    // K_nu(x) grows with nu: ln K_MAX(1e4) is about MAX ln(2 MAX / 1e4). The old pin 0 came from
    // the underflowed start values (exp(-1e4) is 0) and the stop at two zeros in a row.
    expect(besselK(MAX, 1e4)).toBe(Infinity);
  });
  // hermiteH had no order limit and gave NaN at the first overflow (a few hundred steps). The sign
  // of H_n(x) oscillates with n, so since #1332 it runs the full degree on a rescaled recurrence
  // and has the limit of the other three-term recurrences.
  it('hermiteH(MAX, MAX) throws a RangeError (the limit of #1332)', () => {
    expect(() => hermiteH(MAX, MAX)).toThrow(RangeError);
    expect(() => hermiteH(MAX, MAX)).toThrow(RECURRENCE);
  });
  it('besselJ(-1e9 - 5, 3) is -0 at once (NaN after 9.6 s before the fix)', () => {
    expect(besselJ(-1e9 - 5, 3)).toBe(-0);
  });
  it.each([
    [10, 1e-10, 2.691144455467373e-110],
    [30, 1e-6, 3.511074584737299e-222],
    [20, 1e-6, 3.919904349624741e-145],
    [50, 1e-3, 2.920285702604064e-230],
    [200, 5, 4.76001008800229e-296],
    [5, 1e-10, 2.6041666666666672e-54],
  ])('besselJ(%d, %d) matches mpmath', (n, x, want) => {
    expect(rel(besselJ(n, x), want)).toBeLessThan(1e-12);
  });

  it('legendreP(1e7, 0.5) matches SciPy', () => {
    expect(Math.abs((legendreP(1e7, 0.5) as number) - -0.00019171660957659144)).toBeLessThan(1e-12);
  });
  it('hermiteH one step above its limit throws; below it the value is +-Infinity, not NaN', () => {
    expect(() => hermiteH(MAX_RECURRENCE_ORDER + 1, 0.5)).toThrow(RECURRENCE);
    expect(Math.abs(hermiteH(1e6, 0.5) as number)).toBe(Infinity);
  });
  it('besselJ(1e9, 5) is 0 once the downward sweep overflows (hang before the fix)', () => {
    expect(besselJ(1e9, 5)).toBe(0);
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
  it('sphericalBesselY(4e8, 5) is -Infinity at the first overflow (hang before the fix)', () => {
    expect(sphericalBesselY(4e8, 5)).toBe(-Infinity);
  });
  it('sphericalBesselK(4e8, 5) is Infinity at the first overflow (hang before the fix)', () => {
    expect(sphericalBesselK(4e8, 5)).toBe(Infinity);
  });
  it('sphericalBesselY and K give NaN for a non-number x', () => {
    expect(sphericalBesselY(3, 'a' as unknown as number)).toBeNaN();
    expect(sphericalBesselK(3, 'a' as unknown as number)).toBeNaN();
  });
  it('sphericalBesselJ and I refuse a sweep above their limit (hang before the fix)', () => {
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
  it('siegelZ(1e6) is the value of mpmath, and a huge t is refused (hang before the fix)', () => {
    // The Borwein sum took n^2 terms. The Euler-Maclaurin sum has t / 2 terms and a limit (#1102).
    expect(Math.abs(siegelZ(1e6) - -2.8061338784306984)).toBeLessThan(1e-8);
    expect(() => siegelZ(1e12)).toThrow(RangeError);
  });
  it('siegelZ(15) is unchanged', () => {
    expect(siegelZ(15)).toBeCloseTo(0.7199423913, 6);
  });
  it('zipfPMF(1, 1, 1e12) matches mpmath (hang before the fix)', () => {
    expect(rel(zipfPMF(1, 1, 1e12), 0.03545063832843207)).toBeLessThan(1e-13);
  });
  it('binomialTest(1e9, 1e9) returns (hang before the fix)', () => {
    const r = binomialTest(1e9, 1e9);
    expect(r.statistic).toBe(1);
    expect(r.pValue).toBe(0);
  });
  it.each([0, 1, NaN, -0.5, 1.5])(
    'binomialTest with p = %d returns a NaN p-value at once (over 60 s before the fix)',
    (p) => {
      const r = binomialTest(5, 1e9, p);
      expect(r.statistic).toBe(5e-9);
      expect(r.pValue).toBeNaN();
    }
  );
  it('expn with a tiny x exits the recurrence at once (over 60 s before the fix)', () => {
    const n = MAX_EXPN_ORDER;
    expect(expn(n, 1e-300)).toBe(Math.exp(-1e-300) / (n - 1));
  });
  it('sphericalBesselK(limit, 1e4) is Infinity: k_n grows with n and overflows at once', () => {
    expect(sphericalBesselK(MAX_SPHERICAL_BESSEL_ORDER, 1e4)).toBe(Infinity);
  });
  it('binomialTest refuses n above 1e11', () => {
    expect(() => binomialTest(5, 1e11 + 2)).toThrow(RangeError);
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
    expect(() => gaussQuad((x) => x, 0, 1, 1e10)).toThrow(RangeError);
    expect(() => gaussQuad((x) => x, 0, 1, Infinity)).toThrow(RangeError);
  });
  it('gaussQuad gives NaN for a NaN interval count', () => {
    expect(gaussQuad((x) => x, 0, 1, NaN)).toBeNaN();
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
  it('mathieuA(99, 1) matches SciPy mathieu_a (the 50-harmonic matrix gave 9801.0025510, #1105)', () => {
    expect(Math.abs(mathieuA(99, 1) / 9801.00005102041 - 1)).toBeLessThan(1e-12);
  });
  it('discreteLog refuses a modulus that needs more than 2^24 baby steps (hang before the fix)', () => {
    const q = 2 ** 53 - 111; // a prime, and the order of g = 3 is above 2^24
    expect(() => discreteLog(3, 5, q)).toThrow(RangeError);
  });
  it('discreteLog returns for g === 0 (mod p) at the largest p (RangeError before #1114)', () => {
    const s = 2 ** 53 - 1; // 0^1 === 0
    expect(discreteLog(s, s, s)).toBe(1);
  });
  it('discreteLog finds a small order of g first for a large p (RangeError before the fix)', () => {
    expect(discreteLog(50154588067499, 266974891273491, 282000011339987)).toBe(12345);
    expect(discreteLog(1, 1, 1e15 + 37)).toBe(0);
    expect(discreteLog(1, 2, 1e15 + 37)).toBe(-1);
  });
  it('discreteLog refuses a p above 2^53 - 1', () => {
    expect(() => discreteLog(2, 3, 2 ** 53 + 2)).toThrow(RangeError);
  });
  it('discreteLog keeps its small answers', () => {
    expect(discreteLog(2, 3, 5)).toBe(3);
    expect(discreteLog(3, 13, 17)).toBe(4);
    expect(discreteLog(2, 5, 11)).toBe(4);
  });
});
