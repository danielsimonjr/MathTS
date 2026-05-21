import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  erfc,
  beta,
  gammainc,
  digamma,
  besselJ0,
  besselJ1,
  besselY0,
  besselY1,
  besselJ,
  besselK,
  betainc,
  lambertW,
  erfi,
  expIntegralEi,
  fresnelC,
  legendreP,
  ellipticK,
  ellipticE,
} from '../src/typed/special.js';
import { computePool } from '@danielsimonjr/mathts-parallel';

describe('Special Functions', () => {
  // ===========================================================================
  // erfc - Complementary Error Function
  // ===========================================================================
  describe('erfc', () => {
    it('erfc(0) = 1', () => {
      expect(erfc(0)).toBeCloseTo(1, 10);
    });

    it('erfc(1) ~ 0.1573', () => {
      expect(erfc(1)).toBeCloseTo(0.15729920705, 5);
    });

    it('erfc(-1) ~ 1.8427', () => {
      expect(erfc(-1)).toBeCloseTo(1.84270079295, 5);
    });

    it('erfc(0.5) ~ 0.4795', () => {
      expect(erfc(0.5)).toBeCloseTo(0.47950012, 4);
    });

    it('erfc(large) approaches 0', () => {
      expect(erfc(5)).toBeCloseTo(0, 10);
    });

    it('erfc(-large) approaches 2', () => {
      expect(erfc(-5)).toBeCloseTo(2, 10);
    });
  });

  // ===========================================================================
  // beta - Beta Function
  // ===========================================================================
  describe('beta', () => {
    it('beta(2, 3) = 1/12', () => {
      expect(beta(2, 3)).toBeCloseTo(1 / 12, 10);
    });

    it('beta(1, 1) = 1', () => {
      expect(beta(1, 1)).toBeCloseTo(1, 10);
    });

    it('beta(0.5, 0.5) = pi', () => {
      expect(beta(0.5, 0.5)).toBeCloseTo(Math.PI, 8);
    });

    it('beta is symmetric: beta(a,b) = beta(b,a)', () => {
      expect(beta(3, 5)).toBeCloseTo(beta(5, 3), 10);
    });

    it('beta(1, n) = 1/n', () => {
      expect(beta(1, 5)).toBeCloseTo(0.2, 10);
    });
  });

  // ===========================================================================
  // gammainc - Lower Incomplete Gamma (regularized)
  // ===========================================================================
  describe('gammainc', () => {
    it('gammainc(1, 1) = 1 - 1/e', () => {
      expect(gammainc(1, 1)).toBeCloseTo(1 - 1 / Math.E, 10);
    });

    it('gammainc(a, 0) = 0', () => {
      expect(gammainc(2, 0)).toBe(0);
    });

    it('gammainc(0.5, 1) ~ erf(1) ~ 0.8427', () => {
      expect(gammainc(0.5, 1)).toBeCloseTo(0.84270079, 5);
    });

    it('gammainc(a, x) approaches 1 for large x', () => {
      expect(gammainc(2, 50)).toBeCloseTo(1, 5);
    });

    it('gammainc with negative x returns NaN', () => {
      expect(gammainc(1, -1)).toBeNaN();
    });

    it('gammainc(3, 2) ~ 0.3233', () => {
      // P(3, 2) = 1 - e^(-2)(1 + 2 + 2) = 1 - 5e^(-2)
      expect(gammainc(3, 2)).toBeCloseTo(0.32332, 4);
    });
  });

  // ===========================================================================
  // digamma - Psi Function
  // ===========================================================================
  describe('digamma', () => {
    it('digamma(1) = -gamma (Euler-Mascheroni)', () => {
      expect(digamma(1)).toBeCloseTo(-0.5772156649, 8);
    });

    it('digamma(2) = 1 - gamma', () => {
      expect(digamma(2)).toBeCloseTo(1 - 0.5772156649, 8);
    });

    it('digamma(0.5) = -gamma - 2*ln(2)', () => {
      expect(digamma(0.5)).toBeCloseTo(-0.5772156649 - 2 * Math.LN2, 6);
    });

    it('digamma at non-positive integers returns NaN', () => {
      expect(digamma(0)).toBeNaN();
      expect(digamma(-1)).toBeNaN();
      expect(digamma(-2)).toBeNaN();
      expect(digamma(-5)).toBeNaN();
    });

    it('digamma(10) ~ 2.2517', () => {
      expect(digamma(10)).toBeCloseTo(2.25175258906, 6);
    });
  });

  // ===========================================================================
  // besselJ0 - Bessel J0
  // ===========================================================================
  describe('besselJ0', () => {
    it('J0(0) = 1', () => {
      expect(besselJ0(0)).toBeCloseTo(1, 10);
    });

    it('J0(1) ~ 0.7652', () => {
      expect(besselJ0(1)).toBeCloseTo(0.76519768656, 6);
    });

    it('J0(2.4048) ~ 0 (first zero)', () => {
      expect(besselJ0(2.4048255577)).toBeCloseTo(0, 3);
    });

    it('J0 is even: J0(-x) = J0(x)', () => {
      expect(besselJ0(-3)).toBeCloseTo(besselJ0(3), 10);
    });

    it('J0(10) ~ -0.2459', () => {
      expect(besselJ0(10)).toBeCloseTo(-0.24593576, 4);
    });
  });

  // ===========================================================================
  // besselJ1 - Bessel J1
  // ===========================================================================
  describe('besselJ1', () => {
    it('J1(0) = 0', () => {
      expect(besselJ1(0)).toBeCloseTo(0, 10);
    });

    it('J1(1) ~ 0.4401', () => {
      expect(besselJ1(1)).toBeCloseTo(0.44005058574, 6);
    });

    it('J1 is odd: J1(-x) = -J1(x)', () => {
      expect(besselJ1(-3)).toBeCloseTo(-besselJ1(3), 10);
    });

    it('J1(3.8317) ~ 0 (first zero)', () => {
      expect(besselJ1(3.8317059702)).toBeCloseTo(0, 3);
    });
  });

  // ===========================================================================
  // besselY0 - Bessel Y0
  // ===========================================================================
  describe('besselY0', () => {
    it('Y0(1) ~ 0.0883', () => {
      expect(besselY0(1)).toBeCloseTo(0.08825696, 4);
    });

    it('Y0 for x <= 0 returns NaN', () => {
      expect(besselY0(0)).toBeNaN();
      expect(besselY0(-1)).toBeNaN();
    });

    it('Y0(0.8936) ~ 0 (first zero)', () => {
      expect(besselY0(0.89357697)).toBeCloseTo(0, 2);
    });

    it('Y0(10) ~ 0.0557', () => {
      expect(besselY0(10)).toBeCloseTo(0.055671168, 3);
    });
  });

  // ===========================================================================
  // besselY1 - Bessel Y1
  // ===========================================================================
  describe('besselY1', () => {
    it('Y1(1) ~ -0.7812', () => {
      expect(besselY1(1)).toBeCloseTo(-0.78121282, 4);
    });

    it('Y1 for x <= 0 returns NaN', () => {
      expect(besselY1(0)).toBeNaN();
      expect(besselY1(-1)).toBeNaN();
    });

    it('Y1(2.1971) ~ 0 (first zero)', () => {
      expect(besselY1(2.19714133)).toBeCloseTo(0, 1);
    });
  });
});

// =============================================================================
// Parallel Float64Array overloads
// =============================================================================

describe('Special function parallel array overloads', () => {
  beforeAll(async () => {
    await computePool.initialize();
    // Lower the threshold so the worker path is actually exercised.
    computePool.updateConfig({ thresholdElements: 64, chunkSize: 256 });
  });

  afterAll(async () => {
    computePool.updateConfig({ thresholdElements: 50000, chunkSize: 10000 });
    await computePool.terminate();
  });

  const sample = [0, 1, 7, 99, 173, 255];

  it('single-argument overloads match the scalar implementation', async () => {
    const xs = Float64Array.from({ length: 300 }, (_, i) => 0.05 + i * 0.03);
    const cases: Array<[Promise<Float64Array>, (v: number) => number]> = [
      [erfc(xs) as Promise<Float64Array>, (v) => erfc(v) as number],
      [digamma(xs) as Promise<Float64Array>, (v) => digamma(v) as number],
      [besselJ0(xs) as Promise<Float64Array>, (v) => besselJ0(v) as number],
      [besselY1(xs) as Promise<Float64Array>, (v) => besselY1(v) as number],
      [lambertW(xs) as Promise<Float64Array>, (v) => lambertW(v) as number],
      [erfi(xs) as Promise<Float64Array>, (v) => erfi(v) as number],
      [expIntegralEi(xs) as Promise<Float64Array>, (v) => expIntegralEi(v) as number],
      [fresnelC(xs) as Promise<Float64Array>, (v) => fresnelC(v) as number],
    ];
    for (const [arrPromise, scalar] of cases) {
      const arr = await arrPromise;
      expect(arr.length).toBe(300);
      for (const i of sample) {
        expect(arr[i]).toBeCloseTo(scalar(xs[i]), 9);
      }
    }
  });

  it('multi-argument overloads match the scalar implementation', async () => {
    const xs = Float64Array.from({ length: 300 }, (_, i) => 0.1 + i * 0.03);
    const ms = Float64Array.from({ length: 300 }, (_, i) => (i / 300) * 0.98);

    const jn = await (besselJ(3, xs) as Promise<Float64Array>);
    const kn = await (besselK(2, xs) as Promise<Float64Array>);
    const gi = await (gammainc(2, xs) as Promise<Float64Array>);
    const bi = await (betainc(2, 3, ms) as Promise<Float64Array>);
    const lp = await (legendreP(5, ms) as Promise<Float64Array>);
    const ek = await (ellipticK(ms) as Promise<Float64Array>);
    const ee = await (ellipticE(ms) as Promise<Float64Array>);
    const bt = await (beta(xs, 3) as Promise<Float64Array>);

    for (const i of sample) {
      expect(jn[i]).toBeCloseTo(besselJ(3, xs[i]) as number, 9);
      expect(kn[i]).toBeCloseTo(besselK(2, xs[i]) as number, 9);
      expect(gi[i]).toBeCloseTo(gammainc(2, xs[i]) as number, 9);
      expect(bi[i]).toBeCloseTo(betainc(2, 3, ms[i]) as number, 9);
      expect(lp[i]).toBeCloseTo(legendreP(5, ms[i]) as number, 9);
      expect(ek[i]).toBeCloseTo(ellipticK(ms[i]) as number, 9);
      expect(ee[i]).toBeCloseTo(ellipticE(ms[i]) as number, 9);
      expect(bt[i]).toBeCloseTo(beta(xs[i], 3) as number, 9);
    }
  });
});
