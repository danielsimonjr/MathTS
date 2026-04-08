import { describe, it, expect } from 'vitest';
import {
  erfc,
  beta,
  gammainc,
  digamma,
  besselJ0,
  besselJ1,
  besselY0,
  besselY1,
} from '../src/typed/special.js';

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
