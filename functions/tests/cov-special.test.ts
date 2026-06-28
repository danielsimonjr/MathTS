/**
 * Coverage tests for functions/src/typed/special.ts.
 *
 * Targets branches the existing special / special-extended suites miss:
 *   - the large-|x| asymptotic branches of the Bessel J/Y/I/K functions,
 *   - the higher-order recurrence branches (n >= 2),
 *   - the large-x branches of the Ci / Si / Ei integral functions,
 *   - the x > 4.5 and x < -4.5 asymptotic branches of the Airy functions,
 *   - the negative-argument reflection branch of digamma,
 *   - the Float64Array (below-threshold sequential) overload of every
 *     single-/multi-argument function,
 *   - the Carlson symmetric forms and the Carlson-based incomplete elliptic
 *     integrals (scalar + small-array JS path).
 *
 * All reference values are independent (DLMF / Abramowitz & Stegun / known
 * identities), not re-derived from the implementation under test.
 */

import { describe, it, expect } from 'vitest';
import {
  erfc,
  erfi,
  lgamma,
  beta,
  gammainc,
  gammaincp,
  betainc,
  digamma,
  besselJ0,
  besselJ1,
  besselY0,
  besselY1,
  besselJ,
  besselY,
  besselI,
  besselK,
  ellipticK,
  ellipticE,
  chebyshevT,
  hermiteH,
  laguerreL,
  legendreP,
  lambertW,
  cosIntegral,
  sinIntegral,
  logIntegral,
  expIntegralEi,
  fresnelC,
  fresnelS,
  airyAi,
  airyBi,
  carlsonRC,
  carlsonRF,
  carlsonRD,
  carlsonRJ,
  ellipticF,
  ellipticEIncomplete,
  ellipticPi,
} from '../src/typed/special.js';

// A small Float64Array stays below the default parallel threshold (50000), so
// every Float64Array overload takes its sequential JS branch.
const A = (...xs: number[]) => Float64Array.from(xs);

describe('special — scalar branches the base suites miss', () => {
  it('digamma reflection for negative non-integer x', () => {
    // psi(-0.5) = 0.03648997397857652 (DLMF / known value).
    expect(digamma(-0.5) as number).toBeCloseTo(0.03648997397857652, 8);
    // psi(-1.5) = 0.7031566406452432
    expect(digamma(-1.5) as number).toBeCloseTo(0.7031566406452432, 7);
    // pole at non-positive integer -> NaN
    expect(Number.isNaN(digamma(-2) as number)).toBe(true);
  });

  it('Bessel J1 / Y0 / Y1 large-x asymptotic branch (|x| >= 8)', () => {
    // J1(10) = 0.04347274616886144
    expect(besselJ1(10) as number).toBeCloseTo(0.04347274616886144, 6);
    // J1(-10) = -J1(10)
    expect(besselJ1(-10) as number).toBeCloseTo(-0.04347274616886144, 6);
    // Y0(10) = 0.05567116728359961
    expect(besselY0(10) as number).toBeCloseTo(0.05567116728359961, 6);
    // Y1(10) = 0.249015424206954
    expect(besselY1(10) as number).toBeCloseTo(0.249015424206954, 6);
    // x < 8 small-argument branch (regression for the corrected NR coeffs):
    // Y0(5) = -0.3085176252490338, Y1(5) = 0.14786314339122683
    expect(besselY0(5) as number).toBeCloseTo(-0.3085176252490338, 5);
    expect(besselY1(5) as number).toBeCloseTo(0.14786314339122683, 5);
  });

  it('Bessel general order J_n / Y_n (n >= 2) recurrence + special cases', () => {
    // J2(5) = 0.046565116277752214
    expect(besselJ(2, 5) as number).toBeCloseTo(0.046565116277752214, 5);
    // negative order: J_{-2}(x) = J_2(x)
    expect(besselJ(-2, 5) as number).toBeCloseTo(besselJ(2, 5) as number, 10);
    // negative odd order: J_{-3}(x) = -J_3(x)
    expect(besselJ(-3, 5) as number).toBeCloseTo(-(besselJ(3, 5) as number), 10);
    // order-0/1 dispatch
    expect(besselJ(0, 5) as number).toBeCloseTo(besselJ0(5) as number, 10);
    expect(besselJ(1, 5) as number).toBeCloseTo(besselJ1(5) as number, 10);
    // backward-recurrence (Miller's algorithm) branch: large order n > 20 with
    // |x| <= n. J_25(5) is vanishingly small; assert it is a tiny finite value.
    const j25 = besselJ(25, 5) as number;
    expect(Number.isFinite(j25)).toBe(true);
    expect(Math.abs(j25)).toBeLessThan(1e-10);
    // J_n at x ~ 0 -> 0 for n >= 2
    expect(besselJ(3, 0) as number).toBe(0);
    // Y2(5) = 0.3676628826055284
    expect(besselY(2, 5) as number).toBeCloseTo(0.3676628826055284, 5);
    expect(besselY(0, 5) as number).toBeCloseTo(besselY0(5) as number, 10);
    expect(besselY(1, 5) as number).toBeCloseTo(besselY1(5) as number, 10);
    // domain guard
    expect(Number.isNaN(besselY(2, -1) as number)).toBe(true);
  });

  it('modified Bessel I_n / K_n incl. recurrence and small/large-x K branches', () => {
    // I0(1) = 1.2660658777520084
    expect(besselI(0, 1) as number).toBeCloseTo(1.2660658777520084, 6);
    // I1(1) = 0.5651591039924851
    expect(besselI(1, 1) as number).toBeCloseTo(0.5651591039924851, 6);
    // I2(1) = 0.13574766976703828
    expect(besselI(2, 1) as number).toBeCloseTo(0.13574766976703828, 5);
    // I_n at x ~ 0
    expect(besselI(0, 0) as number).toBe(1);
    expect(besselI(2, 0) as number).toBe(0);
    // K0(1) = 0.42102443824070834 (x <= 2 series branch)
    expect(besselK(0, 1) as number).toBeCloseTo(0.42102443824070834, 5);
    // K1(1) = 0.6019072301972346
    expect(besselK(1, 1) as number).toBeCloseTo(0.6019072301972346, 5);
    // K2(1) = 1.6248388986351774 (recurrence branch)
    expect(besselK(2, 1) as number).toBeCloseTo(1.6248388986351774, 4);
    // x > 2 asymptotic branch of K0/K1
    expect(besselK(0, 5) as number).toBeCloseTo(0.0036910983340425947, 6);
    expect(besselK(1, 5) as number).toBeCloseTo(0.00404461344545216, 6);
    // domain guard
    expect(Number.isNaN(besselK(1, -1) as number)).toBe(true);
  });

  it('integral functions large-x asymptotic branches', () => {
    // Ci(10) = -0.04545643300445537 (x > 4 asymptotic branch)
    expect(cosIntegral(10) as number).toBeCloseTo(-0.04545643300445537, 5);
    // Si(10) = 1.6583475942188740 (always series, but exercise larger x)
    expect(sinIntegral(10) as number).toBeCloseTo(1.658347594218874, 5);
    // Si is odd
    expect(sinIntegral(-3) as number).toBeCloseTo(-(sinIntegral(3) as number), 10);
    // Ei large-x branch (|x| > 40): Ei(45) is enormous but finite
    expect(Number.isFinite(expIntegralEi(45) as number)).toBe(true);
    expect((expIntegralEi(45) as number) > 0).toBe(true);
    // Ei(0) = -Infinity
    expect(expIntegralEi(0) as number).toBe(-Infinity);
    // li(x) = Ei(ln x); li(2) ~ 1.0451637801174927
    expect(logIntegral(2) as number).toBeCloseTo(1.0451637801174927, 5);
    expect(Number.isNaN(logIntegral(1) as number)).toBe(true);
    expect(Number.isNaN(cosIntegral(-1) as number)).toBe(true);
  });

  it('Airy functions asymptotic branches (x > 4.5 and x < -4.5)', () => {
    // Positive (exponential) branch.
    // Ai(5) = 1.0834442813607e-4
    expect(airyAi(5) as number).toBeCloseTo(1.0834442813607e-4, 8);
    // Bi(5) = 657.7920441711155 (growing asymptotic)
    expect(airyBi(5) as number).toBeCloseTo(657.7920441711155, 0);
    // Negative (oscillatory) branch — these exercise the DLMF §9.7.9/§9.7.10
    // u_k asymptotic that was fixed (the old code returned ~0.138 for Ai(-5)).
    // Ai(-5) = 0.3507610090241531 (verified against the Airy power series).
    expect(airyAi(-5) as number).toBeCloseTo(0.3507610090241531, 3);
    expect(airyAi(-8) as number).toBeCloseTo(-0.05270504954514464, 3);
    // Bi(-5) = -0.1383691349016006 (near the XBIG=4.5 boundary the oscillatory
    // asymptotic carries ~5e-4 error, so compare to 2 decimals here).
    expect(airyBi(-5) as number).toBeCloseTo(-0.1383691349016006, 2);
    expect(airyBi(-8) as number).toBeCloseTo(-0.3312515817520458, 3);
  });

  it('erfi / fresnel scalar sanity (odd symmetry)', () => {
    expect(erfi(0) as number).toBe(0);
    expect(erfi(-1) as number).toBeCloseTo(-(erfi(1) as number), 10);
    expect(fresnelC(-1) as number).toBeCloseTo(-(fresnelC(1) as number), 10);
    expect(fresnelS(-1) as number).toBeCloseTo(-(fresnelS(1) as number), 10);
  });
});

describe('special — Float64Array sequential overloads (below threshold)', () => {
  it('single-argument array functions', async () => {
    expect(Array.from(await erfc(A(0, 1)))[0]).toBeCloseTo(1, 6);
    expect(Array.from(await erfi(A(0, 1)))[1]).toBeCloseTo(erfi(1) as number, 8);
    expect(Array.from(await lgamma(A(1, 2, 0.5)))[2]).toBeCloseTo(0.5723649429247001, 6);
    expect(Array.from(await digamma(A(1, 2)))[0]).toBeCloseTo(-0.5772156649015329, 6);
    expect(Array.from(await besselJ0(A(0, 1)))[0]).toBeCloseTo(1, 10);
    expect(Array.from(await besselJ1(A(1, 2)))[0]).toBeCloseTo(besselJ1(1) as number, 8);
    expect(Array.from(await besselY0(A(1, 2)))[0]).toBeCloseTo(besselY0(1) as number, 8);
    expect(Array.from(await besselY1(A(1, 2)))[0]).toBeCloseTo(besselY1(1) as number, 8);
    expect(Array.from(await ellipticK(A(0, 0.5)))[1]).toBeCloseTo(1.8540746773013719, 6);
    expect(Array.from(await ellipticE(A(0, 1)))[1]).toBeCloseTo(1, 6);
    expect(Array.from(await lambertW(A(0, 1)))[1]).toBeCloseTo(0.5671432904097838, 6);
    expect(Array.from(await cosIntegral(A(1, 2)))[0]).toBeCloseTo(cosIntegral(1) as number, 8);
    expect(Array.from(await sinIntegral(A(1, 2)))[0]).toBeCloseTo(sinIntegral(1) as number, 8);
    expect(Array.from(await logIntegral(A(2, 3)))[0]).toBeCloseTo(logIntegral(2) as number, 8);
    expect(Array.from(await expIntegralEi(A(1, 2)))[0]).toBeCloseTo(expIntegralEi(1) as number, 8);
    expect(Array.from(await fresnelC(A(0.5, 1)))[1]).toBeCloseTo(fresnelC(1) as number, 8);
    expect(Array.from(await fresnelS(A(0.5, 1)))[1]).toBeCloseTo(fresnelS(1) as number, 8);
    expect(Array.from(await airyAi(A(0, 1)))[0]).toBeCloseTo(0.3550280538878172, 6);
    expect(Array.from(await airyBi(A(0, 1)))[0]).toBeCloseTo(0.6149266274460007, 6);
  });

  it('multi-argument array functions (varying last/array argument)', async () => {
    // beta(Float64Array, b)
    expect(Array.from(await beta(A(2, 3), 3))[0]).toBeCloseTo(beta(2, 3) as number, 8);
    // gammainc(a, Float64Array)
    expect(Array.from(await gammainc(1, A(1, 2)))[0]).toBeCloseTo(1 - 1 / Math.E, 6);
    // gammaincp(a, Float64Array)
    expect(Array.from(await gammaincp(1, A(1, 2)))[0]).toBeCloseTo(1 / Math.E, 6);
    // betainc(a, b, Float64Array)
    expect(Array.from(await betainc(2, 2, A(0.5, 1)))[0]).toBeCloseTo(0.5, 8);
    // besselJ/Y/I/K with array x
    expect(Array.from(await besselJ(2, A(5, 6)))[0]).toBeCloseTo(besselJ(2, 5) as number, 6);
    expect(Array.from(await besselY(2, A(5, 6)))[0]).toBeCloseTo(besselY(2, 5) as number, 6);
    expect(Array.from(await besselI(2, A(1, 2)))[0]).toBeCloseTo(besselI(2, 1) as number, 6);
    expect(Array.from(await besselK(2, A(1, 2)))[0]).toBeCloseTo(besselK(2, 1) as number, 5);
    // orthogonal polynomials with array x
    expect(Array.from(await chebyshevT(3, A(0.5, 1)))[1]).toBeCloseTo(1, 8);
    expect(Array.from(await hermiteH(2, A(0, 1)))[0]).toBeCloseTo(-2, 8);
    expect(Array.from(await laguerreL(2, A(0, 1)))[0]).toBeCloseTo(1, 8);
    expect(Array.from(await legendreP(2, A(0, 1)))[1]).toBeCloseTo(1, 8);
  });
});

describe('special — orthogonal polynomial scalar recurrences', () => {
  it('Chebyshev / Hermite / Laguerre / Legendre at known points', () => {
    // T_0=1, T_1=x, T_2(x)=2x^2-1
    expect(chebyshevT(0, 0.3) as number).toBe(1);
    expect(chebyshevT(1, 0.3) as number).toBeCloseTo(0.3, 10);
    expect(chebyshevT(2, 0.5) as number).toBeCloseTo(-0.5, 10);
    // H_0=1, H_1=2x, H_2=4x^2-2
    expect(hermiteH(0, 1) as number).toBe(1);
    expect(hermiteH(1, 2) as number).toBeCloseTo(4, 10);
    expect(hermiteH(2, 1) as number).toBeCloseTo(2, 10);
    // L_0=1, L_1=1-x, L_2=(x^2-4x+2)/2
    expect(laguerreL(0, 1) as number).toBe(1);
    expect(laguerreL(1, 2) as number).toBeCloseTo(-1, 10);
    expect(laguerreL(2, 1) as number).toBeCloseTo(-0.5, 10);
    // P_0=1, P_1=x, P_2=(3x^2-1)/2
    expect(legendreP(0, 1) as number).toBe(1);
    expect(legendreP(1, 0.4) as number).toBeCloseTo(0.4, 10);
    expect(legendreP(2, 1) as number).toBeCloseTo(1, 10);
    // lambertW edge cases
    expect(lambertW(0) as number).toBe(0);
    expect(lambertW(Math.E) as number).toBeCloseTo(1, 10);
    expect(Number.isNaN(lambertW(-1) as number)).toBe(true);
    // lambertW(x) for x in (1, e): w = log(x) start branch
    expect(lambertW(2) as number).toBeCloseTo(0.8526055020137254, 8);
    // lambertW(x) for x >= e: log(x) - log(log(x)) start branch
    expect(lambertW(10) as number).toBeCloseTo(1.7455280027406994, 8);
  });
});

describe('special — Carlson symmetric forms (scalar + array JS path)', () => {
  it('Carlson RC / RF / RD / RJ scalar identities', () => {
    // RC(0,1) = pi/2 ; RC(1,1) = 1
    expect(carlsonRC(0, 1) as number).toBeCloseTo(Math.PI / 2, 8);
    expect(carlsonRC(1, 1) as number).toBeCloseTo(1, 8);
    // RF(0,1,2) = 1.3110287771461 (DLMF)
    expect(carlsonRF(0, 1, 2) as number).toBeCloseTo(1.3110287771461, 6);
    // RF(2,3,4) symmetric, finite positive
    expect(carlsonRF(2, 3, 4) as number).toBeGreaterThan(0);
    // RD(0,2,1) = 1.7972103521034 (DLMF)
    expect(carlsonRD(0, 2, 1) as number).toBeCloseTo(1.7972103521034, 5);
    // RJ(x,y,z,p) finite positive
    expect(carlsonRJ(1, 2, 3, 4) as number).toBeGreaterThan(0);
  });

  it('Carlson array (small) JS path', () => {
    const rc = carlsonRC(A(0, 1), A(1, 1)) as Float64Array;
    expect(rc[0]).toBeCloseTo(Math.PI / 2, 6);
    const rf = carlsonRF(A(0, 2), A(1, 3), A(2, 4)) as Float64Array;
    expect(rf[0]).toBeCloseTo(1.3110287771461, 6);
    const rd = carlsonRD(A(0, 1), A(2, 2), A(1, 3)) as Float64Array;
    expect(rd[0]).toBeCloseTo(1.7972103521034, 5);
    const rj = carlsonRJ(A(1, 1), A(2, 2), A(3, 3), A(4, 4)) as Float64Array;
    expect(rj[0]).toBeGreaterThan(0);
  });
});

describe('special — incomplete elliptic integrals (Carlson-based)', () => {
  it('scalar F / E / Pi special cases', () => {
    // F(pi/2, m) = K(m); F(pi/2, 0.5) ~ 1.8540746773013719
    expect(ellipticF(Math.PI / 2, 0.5) as number).toBeCloseTo(1.8540746773013719, 5);
    expect(ellipticF(0, 0.5) as number).toBeCloseTo(0, 8);
    // E(pi/2, m) = E(m); E(pi/2, 0.5) ~ 1.3506438810476755
    expect(ellipticEIncomplete(Math.PI / 2, 0.5) as number).toBeCloseTo(1.3506438810476755, 4);
    expect(ellipticEIncomplete(0, 0.5) as number).toBeCloseTo(0, 8);
    // Pi(0, phi, m) reduces to F(phi, m)
    expect(ellipticPi(0, Math.PI / 4, 0.5) as number).toBeCloseTo(
      ellipticF(Math.PI / 4, 0.5) as number,
      5
    );
  });

  it('array (small) JS path for F / E / Pi', () => {
    const f = ellipticF(A(Math.PI / 2, Math.PI / 4), A(0.5, 0.5)) as Float64Array;
    expect(f[0]).toBeCloseTo(1.8540746773013719, 5);
    const e = ellipticEIncomplete(A(Math.PI / 2, Math.PI / 4), A(0.5, 0.5)) as Float64Array;
    expect(e[0]).toBeCloseTo(1.3506438810476755, 4);
    const pi = ellipticPi(A(0, 0), A(Math.PI / 4, Math.PI / 3), A(0.5, 0.5)) as Float64Array;
    expect(pi[0]).toBeCloseTo(ellipticF(Math.PI / 4, 0.5) as number, 5);
  });

  it('ellipticE two-argument (phi, m) Simpson form', () => {
    // E(phi, m) Simpson 2-arg form; E(pi/2, 0.5) ~ complete E(0.5)
    expect(ellipticE(Math.PI / 2, 0.5) as number).toBeCloseTo(1.3506438810476755, 3);
    expect(ellipticE(0, 0.5) as number).toBeCloseTo(0, 8);
  });
});
