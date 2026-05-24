/**
 * Extended Special Functions Tests
 *
 * Tests for 20 new special functions: general Bessel, incomplete beta,
 * elliptic integrals, orthogonal polynomials, Lambert W, Fresnel, etc.
 */

import { describe, it, expect } from 'vitest';
import {
  besselJ,
  besselY,
  besselI,
  besselK,
  betainc,
  gammaincp,
  ellipticK,
  ellipticE,
  chebyshevT,
  hermiteH,
  laguerreL,
  legendreP,
  lambertW,
  erfi,
  cosIntegral,
  sinIntegral,
  logIntegral,
  expIntegralEi,
  fresnelC,
  fresnelS,
} from '../src/typed/special.js';

const EPSILON = 1e-4;

function expectClose(actual: number, expected: number, tol = EPSILON) {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
}

// =============================================================================
// General Bessel Functions
// =============================================================================

describe('besselJ (general order)', () => {
  it('should match J0 for n=0', () => {
    expectClose(besselJ(0, 1) as number, 0.7652, 0.001);
  });

  it('should match J1 for n=1', () => {
    expectClose(besselJ(1, 1) as number, 0.4401, 0.001);
  });

  it('should compute J2', () => {
    // J_2(1) ~ 0.1149
    expectClose(besselJ(2, 1) as number, 0.1149, 0.001);
  });

  it('should return 0 for J_n(0) when n > 0', () => {
    expectClose(besselJ(3, 0) as number, 0);
  });
});

describe('besselY (general order)', () => {
  it('should match Y0 for n=0', () => {
    expectClose(besselY(0, 1) as number, 0.0883, 0.001);
  });

  it('should return NaN for x <= 0', () => {
    expect(besselY(0, -1)).toBeNaN();
  });
});

describe('besselI', () => {
  it('should compute I0(0) = 1', () => {
    expectClose(besselI(0, 0) as number, 1);
  });

  it('should compute I0(1)', () => {
    expectClose(besselI(0, 1) as number, 1.2661, 0.001);
  });

  it('should return 0 for I_n(0) when n > 0', () => {
    expectClose(besselI(2, 0) as number, 0);
  });
});

describe('besselK', () => {
  it('should compute K0(1)', () => {
    expectClose(besselK(0, 1) as number, 0.421, 0.01);
  });

  it('should return NaN for x <= 0', () => {
    expect(besselK(0, -1)).toBeNaN();
  });
});

// =============================================================================
// Incomplete Beta
// =============================================================================

describe('betainc', () => {
  it('should return 0 at x=0', () => {
    expectClose(betainc(1, 1, 0) as number, 0);
  });

  it('should return 1 at x=1', () => {
    expectClose(betainc(1, 1, 1) as number, 1);
  });

  it('should return x for a=1, b=1 (uniform)', () => {
    expectClose(betainc(1, 1, 0.5) as number, 0.5, 0.01);
  });

  it('should be 0.5 at median for symmetric parameters', () => {
    expectClose(betainc(2, 2, 0.5) as number, 0.5, 0.01);
  });
});

// =============================================================================
// Upper Incomplete Gamma
// =============================================================================

describe('gammaincp', () => {
  it('should be complement of gammainc', () => {
    // P(1, 1) + Q(1, 1) = 1
    const p = 1 - Math.exp(-1); // known P(1,1)
    expectClose((gammaincp(1, 1) as number) + p, 1, 0.01);
  });
});

// =============================================================================
// Elliptic Integrals
// =============================================================================

describe('ellipticK', () => {
  it('should return pi/2 at m=0', () => {
    expectClose(ellipticK(0) as number, Math.PI / 2);
  });

  it('should be larger for m close to 1', () => {
    const k = ellipticK(0.99) as number;
    expect(k).toBeGreaterThan(3);
  });

  it('should return Infinity for m = 1 and NaN for m > 1', () => {
    // K(1) = +∞ (the complete elliptic integral diverges at m = 1)
    expect(ellipticK(1)).toBe(Infinity);
    // m > 1 is out of domain
    expect(ellipticK(1.5)).toBeNaN();
  });
});

describe('ellipticE', () => {
  it('should compute complete E(0) = pi/2', () => {
    expectClose(ellipticE(0) as number, Math.PI / 2, 0.01);
  });

  it('should compute incomplete E(pi/2, 0) = pi/2', () => {
    expectClose(ellipticE(Math.PI / 2, 0) as number, Math.PI / 2, 0.01);
  });
});

// =============================================================================
// Orthogonal Polynomials
// =============================================================================

describe('chebyshevT', () => {
  it('should compute T0(x) = 1', () => {
    expectClose(chebyshevT(0, 0.5) as number, 1);
  });

  it('should compute T1(x) = x', () => {
    expectClose(chebyshevT(1, 0.5) as number, 0.5);
  });

  it('should compute T2(x) = 2x^2 - 1', () => {
    expectClose(chebyshevT(2, 0.5) as number, -0.5);
  });
});

describe('hermiteH', () => {
  it('should compute H0(x) = 1', () => {
    expectClose(hermiteH(0, 1) as number, 1);
  });

  it('should compute H1(x) = 2x', () => {
    expectClose(hermiteH(1, 3) as number, 6);
  });

  it('should compute H2(x) = 4x^2 - 2', () => {
    expectClose(hermiteH(2, 1) as number, 2);
  });
});

describe('laguerreL', () => {
  it('should compute L0(x) = 1', () => {
    expectClose(laguerreL(0, 5) as number, 1);
  });

  it('should compute L1(x) = 1-x', () => {
    expectClose(laguerreL(1, 3) as number, -2);
  });

  it('should compute L2(x) = (x^2 - 4x + 2)/2', () => {
    expectClose(laguerreL(2, 2) as number, -1);
  });
});

describe('legendreP', () => {
  it('should compute P0(x) = 1', () => {
    expectClose(legendreP(0, 0.5) as number, 1);
  });

  it('should compute P1(x) = x', () => {
    expectClose(legendreP(1, 0.5) as number, 0.5);
  });

  it('should compute P2(x) = (3x^2 - 1)/2', () => {
    expectClose(legendreP(2, 0.5) as number, -0.125);
  });
});

// =============================================================================
// Lambert W
// =============================================================================

describe('lambertW', () => {
  it('should compute W(0) = 0', () => {
    expectClose(lambertW(0) as number, 0);
  });

  it('should compute W(e) = 1', () => {
    expectClose(lambertW(Math.E) as number, 1, 1e-10);
  });

  it('should compute W(1) ~ 0.5671', () => {
    expectClose(lambertW(1) as number, 0.5671, 0.001);
  });

  it('should satisfy W(x)*exp(W(x)) = x', () => {
    const x = 5;
    const w = lambertW(x) as number;
    expectClose(w * Math.exp(w), x, 1e-10);
  });

  it('should return NaN for x < -1/e', () => {
    expect(lambertW(-1)).toBeNaN();
  });
});

// =============================================================================
// Imaginary Error Function
// =============================================================================

describe('erfi', () => {
  it('should return 0 at x=0', () => {
    expectClose(erfi(0) as number, 0);
  });

  it('should compute erfi(1) ~ 1.6503', () => {
    expectClose(erfi(1) as number, 1.6503, 0.01);
  });
});

// =============================================================================
// Integral Functions
// =============================================================================

describe('cosIntegral', () => {
  it('should compute Ci(1) ~ 0.3374', () => {
    expectClose(cosIntegral(1) as number, 0.3374, 0.01);
  });

  it('should return NaN for x <= 0', () => {
    expect(cosIntegral(0)).toBeNaN();
  });
});

describe('sinIntegral', () => {
  it('should return 0 at x=0', () => {
    expectClose(sinIntegral(0) as number, 0);
  });

  it('should compute Si(1) ~ 0.9461', () => {
    expectClose(sinIntegral(1) as number, 0.9461, 0.01);
  });

  it('should be odd function', () => {
    const si1 = sinIntegral(1) as number;
    const siNeg1 = sinIntegral(-1) as number;
    expectClose(siNeg1, -si1, 1e-10);
  });
});

describe('expIntegralEi', () => {
  it('should compute Ei(1) ~ 1.8951', () => {
    expectClose(expIntegralEi(1) as number, 1.8951, 0.01);
  });

  it('should return -Infinity at x=0', () => {
    expect(expIntegralEi(0)).toBe(-Infinity);
  });
});

describe('logIntegral', () => {
  it('should compute li(2) ~ 1.0451', () => {
    expectClose(logIntegral(2) as number, 1.0451, 0.01);
  });

  it('should return NaN for x <= 0', () => {
    expect(logIntegral(0)).toBeNaN();
  });

  it('should return NaN for x = 1', () => {
    expect(logIntegral(1)).toBeNaN();
  });
});

// =============================================================================
// Fresnel Integrals
// =============================================================================

describe('fresnelC', () => {
  it('should return 0 at x=0', () => {
    expectClose(fresnelC(0) as number, 0);
  });

  it('should compute C(1) ~ 0.7799', () => {
    expectClose(fresnelC(1) as number, 0.7799, 0.01);
  });

  it('should be odd function', () => {
    const c1 = fresnelC(1) as number;
    const cNeg1 = fresnelC(-1) as number;
    expectClose(cNeg1, -c1, 1e-6);
  });
});

describe('fresnelS', () => {
  it('should return 0 at x=0', () => {
    expectClose(fresnelS(0) as number, 0);
  });

  it('should compute S(1) ~ 0.4383', () => {
    expectClose(fresnelS(1) as number, 0.4383, 0.01);
  });

  it('should be odd function', () => {
    const s1 = fresnelS(1) as number;
    const sNeg1 = fresnelS(-1) as number;
    expectClose(sNeg1, -s1, 1e-6);
  });
});
