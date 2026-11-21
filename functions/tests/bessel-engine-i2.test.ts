/* eslint-disable no-loss-of-precision -- the oracle values are written at the 17 digits that
   mpmath prints; each one rounds to the nearest double, which is the value the test pins. */
/**
 * Batch I2: the real-order Bessel engine (#1331, #1332, #1334), the recurrence polynomials
 * (#1332), the zeta reflection (#1327), and the defects of the same classes that the plan
 * found (D1 to D4).
 *
 * Oracle: mpmath 1.3.0 (mp.dps = 50 to 90). Every Bessel and polynomial input is the EXACT
 * DOUBLE (`mpf(float)`), not its decimal. The decimal and the double of `-2.0000001` give
 * different values at x = 1e-10 (40000096567245.8 against 40000096501782.345).
 *
 * A failing test is a finding. No bound is widened to make a value pass.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { BigNumber, Complex } from '@danielsimonjr/mathts-core';
import {
  besselJ,
  chebyshevT,
  hermiteH,
  laguerreL,
  legendreP,
  lgamma,
} from '../src/typed/special.js';
import { gamma, zeta } from '../src/index.js';

/** Relative error of `got` against `want` (absolute when `want` is 0). */
const rel = (got: unknown, want: number): number =>
  want === 0 ? Math.abs(got as number) : Math.abs(((got as number) - want) / want);

const expectRel = (got: unknown, want: number, tol: number): void => {
  expect(Number.isFinite(got as number)).toBe(true);
  expect(rel(got, want)).toBeLessThanOrEqual(tol);
};

describe('D1: sin(pi x) near a nonzero integer keeps its digits', () => {
  // pi * x rounds by ulp(pi * x), and sin there is about pi * dist, so the old form lost
  // about log10(x / dist) digits. The new helper reduces x exactly first.
  it('gamma(-1.0000001) = 9999999.5713771343 (main 9999999.569845542)', () => {
    expectRel(gamma(-1.0000001), 9999999.5713771343, 1e-13);
  });

  it('lgamma(-1.0000001) = 16.118095608096032 (main 16.118095607942873)', () => {
    expect(Math.abs((lgamma(-1.0000001) as number) - 16.118095608096032)).toBeLessThanOrEqual(
      1e-13
    );
  });

  it('the array form of lgamma equals the scalar form', () => {
    const arr = lgamma(new Float64Array([-1.0000001, -2.5, 0.25])) as Float64Array;
    expect(arr[0]).toBe(lgamma(-1.0000001));
    expect(arr[1]).toBe(lgamma(-2.5));
    expect(arr[2]).toBe(lgamma(0.25));
  });

  it('gamma(complex(-1.0000001, 1e-9)) = 9998999.6713688866 + 99990.000883148520i', () => {
    const g = gamma(new Complex(-1.0000001, 1e-9)) as Complex;
    expectRel(g.re, 9998999.6713688866, 1e-12);
    expectRel(g.im, 99990.00088314852, 1e-12);
  });

  it('besselJ(-1.0000001, 1e-10) = -2000.0046295296178 (main -2000.0046298359373)', () => {
    expectRel(besselJ(-1.0000001, 1e-10), -2000.0046295296178, 1e-13);
  });

  it('besselJ(-151.0000000001, 1) = -1.6334002392385388e+298 (main is 2e-7 off)', () => {
    expectRel(besselJ(-151.0000000001, 1), -1.6334002392385388e298, 1e-12);
  });
});

describe('#1332 and D4: the recurrence polynomials overflow to a signed Infinity, never NaN', () => {
  // Measured on the dist of main 3b2ffe60: legendreP(1000, 1.5) gave NaN (Infinity - Infinity at
  // the step after the overflow). The sign of the true value oscillates with n for hermiteH and
  // laguerreL, so "the first overflow decides" is wrong for them: they run on a rescaled
  // recurrence (a power of 2, exact) and the end scale gives the sign.
  describe('legendreP and chebyshevT', () => {
    it('legendreP(1000, 1.5) === Infinity (true 1.823538659945327e+416)', () => {
      expect(legendreP(1000, 1.5)).toBe(Infinity);
    });
    it('legendreP(1001, -1.5) === -Infinity (P_n(-x) = (-1)^n P_n(x), P_1001(1.5) > 0)', () => {
      expect(legendreP(1001, -1.5)).toBe(-Infinity);
      expect(legendreP(1000, -1.5)).toBe(Infinity);
    });
    it('a finite value next to the overflow is not turned into NaN', () => {
      // The numerator (2k - 1) x P_{k-1} is about k times the result, so it overflowed early.
      expectRel(legendreP(741, 1.5), 1.1759686377667739e308, 1e-12);
      expectRel(legendreP(740, 1.5), 4.4948338009723002e307, 1e-12);
      expectRel(legendreP(739, -1.5), -1.7180347067677979e307, 1e-12);
      expectRel(chebyshevT(5028, 1.01), 1.7967817555890111e308, 1e-12);
    });
    it('an infinite x gives the signed Infinity of the leading term; NaN stays NaN', () => {
      expect(legendreP(5, Infinity)).toBe(Infinity);
      expect(legendreP(5, -Infinity)).toBe(-Infinity);
      expect(legendreP(5, NaN)).toBeNaN();
      expect(chebyshevT(1000, 1.5)).toBe(Infinity);
      expect(chebyshevT(5, NaN)).toBeNaN();
    });
    it('every finite value of main keeps its bits: legendreP(300, 0.3)', () => {
      expect(legendreP(300, 0.3)).toBe(-0.042350017547288815);
    });
  });

  describe('hermiteH', () => {
    it('hermiteH(1000, 1.5) === -Infinity and hermiteH(1001, 1.5) === -Infinity (true -4.49e1433)', () => {
      expect(hermiteH(1000, 1.5)).toBe(-Infinity);
      expect(hermiteH(1001, 1.5)).toBe(-Infinity);
    });
    it('hermiteH(300, 10) === Infinity and hermiteH(301, -10) === Infinity (true +1.185e374)', () => {
      expect(hermiteH(300, 10)).toBe(Infinity);
      expect(hermiteH(301, -10)).toBe(Infinity);
    });
    it('finite values are unchanged: hermiteH(150, 10), hermiteH(173, 3.3)', () => {
      expectRel(hermiteH(150, 10), -1.3205101243688398e175, 1e-12);
      expectRel(hermiteH(173, 3.3), -3.7965687540599635e184, 1e-12);
    });
    it('hermiteH(1001, 0) is exactly 0 and hermiteH(1000, 0) is Infinity (true 3.3e1433)', () => {
      expect(hermiteH(1001, 0)).toBe(0);
      expect(hermiteH(1000, 0)).toBe(Infinity);
    });
    it('one step that leaves the range gives the signed leading term, not NaN', () => {
      expect(hermiteH(4, -1e200)).toBe(Infinity);
      expect(hermiteH(5, -1e200)).toBe(-Infinity);
      expect(hermiteH(5, Infinity)).toBe(Infinity);
      expect(hermiteH(5, -Infinity)).toBe(-Infinity);
      expect(hermiteH(3, NaN)).toBeNaN();
    });
    it('hermiteH(3e9, 1) throws a RangeError (new order limit, 2500000000)', () => {
      expect(() => hermiteH(3e9, 1)).toThrow(RangeError);
      expect(() => hermiteH(3e9, 1)).toThrow(/exceeds the supported maximum of 2500000000/);
    });
    it('an array call is bounded by the same total work', () => {
      expect(() => hermiteH(2e9, new Float64Array(2))).toThrow(RangeError);
      expect(() => hermiteH(2e9, new Float64Array(2))).toThrow(/per call/);
    });
  });

  describe('laguerreL', () => {
    it('laguerreL(1000, -1000) === Infinity, laguerreL(2000, 3000) === Infinity', () => {
      expect(laguerreL(1000, -1000)).toBe(Infinity);
      expect(laguerreL(2000, 3000)).toBe(Infinity);
    });
    it('laguerreL(1001, 3000) === -Infinity (the sign oscillates with n)', () => {
      expect(laguerreL(1001, 3000)).toBe(-Infinity);
    });
    it('a finite value next to the overflow is not turned into NaN', () => {
      expectRel(laguerreL(801, 1419), -7.5516370208470904e305, 1e-12);
      expectRel(laguerreL(800, 1400), -1.2755362021531788e302, 1e-12);
      expectRel(laguerreL(300, 1000), -5.2681767098751553e215, 1e-12);
    });
    it('one step that leaves the range gives the signed leading term, not NaN', () => {
      expect(laguerreL(5, 1e200)).toBe(-Infinity);
      expect(laguerreL(4, 1e200)).toBe(Infinity);
      expect(laguerreL(5, -1e200)).toBe(Infinity);
    });
  });
});

describe('#1327 and D1: zeta of a negative argument by the symmetric functional equation', () => {
  // main (3b2ffe60): zeta(-170.5) = Infinity and zeta(-200.5) = -Infinity (Gamma(1 - s) overflows
  // before the product with 2^s pi^(s - 1) sin(pi s / 2) is formed), zeta(complex(-200.5, 1)) =
  // NaN, and sin(pi s / 2) next to an even integer lost digits.
  describe('number', () => {
    it('zeta(-170.5) = 1.7363215609094552e+171, zeta(-200.5) = -2.3200006633528991e+215', () => {
      expectRel(zeta(-170.5), 1.7363215609094552e171, 1e-13);
      expectRel(zeta(-200.5), -2.3200006633528991e215, 1e-13);
    });
    it('zeta(-259.5) = 3.982766118112322e+307 and zeta(-260.5) overflows to -Infinity', () => {
      expectRel(zeta(-259.5), 3.982766118112322e307, 1e-13);
      expect(zeta(-260.5)).toBe(-Infinity);
    });
    it('values that main already had keep their accuracy: zeta(-100.5), zeta(-20.5), zeta(-1.5)', () => {
      expectRel(zeta(-100.5), -1.2790431911215158e78, 1e-13);
      expectRel(zeta(-20.5), -108.21747505877606, 1e-13);
      expectRel(zeta(-1.5), -0.025485201889833036, 1e-13);
    });
    it('zeta(-2.0000001) = 3.0448453720386309e-9 and zeta(-4.000000001) = -7.9838121079834373e-12 (D1)', () => {
      // main: 3.044845369470748e-9 (8.4e-10 relative) and -7.983812739514951e-12 (8e-8 relative).
      expectRel(zeta(-2.0000001), 3.0448453720386309e-9, 1e-13);
      expectRel(zeta(-4.000000001), -7.9838121079834373e-12, 1e-13);
    });
    it('a negative even integer is a trivial zero, also above the range of gamma', () => {
      expect(zeta(-2)).toBe(0);
      expect(zeta(-1000)).toBe(0);
      expect(zeta(-1e300)).toBe(0);
    });
    it('an out-of-range value is the infinity with the sign of -B(2n) / (2n), not NaN', () => {
      expect(zeta(-1001)).toBe(-Infinity);
      // sign of sin(pi s / 2) from the exact reduction of s / 2 modulo 2
      const sign = (s: number): number => (s / 2 - 2 * Math.round(s / 4) < 0 ? -1 : 1);
      expect(zeta(-700.5)).toBe(sign(-700.5) * Infinity);
      expect(zeta(-1500.5)).toBe(sign(-1500.5) * Infinity);
      expect(zeta(-4503599627370497)).toBe(-Infinity);
      expect(zeta(-9007199254740991)).toBe(Infinity);
    });
    it('NaN and the infinities keep their values', () => {
      expect(zeta(NaN)).toBeNaN();
      expect(zeta(Infinity)).toBe(1);
      expect(zeta(-Infinity)).toBeNaN();
    });
  });

  describe('Complex', () => {
    const part = (z: unknown, re: number, im: number, tol: number): void => {
      const c = z as Complex;
      expectRel(c.re, re, tol);
      expectRel(c.im, im, tol);
    };
    it('zeta(-200.5 + 1i) = 3.8102909584475514e+215 - 6.8967100728523601e+215i', () => {
      part(zeta(new Complex(-200.5, 1)), 3.8102909584475514e215, -6.8967100728523601e215, 1e-13);
    });
    it('zeta(-220.5 + 1i) = 1.0371114652356205e+246 - 2.386918780766325e+246i', () => {
      part(zeta(new Complex(-220.5, 1)), 1.0371114652356205e246, -2.386918780766325e246, 1e-13);
    });
    it('zeta(-2.0000001 + 1e-9i) = 3.0448453720715127e-9 - 3.0448450482042081e-11i (D1)', () => {
      part(
        zeta(new Complex(-2.0000001, 1e-9)),
        3.0448453720715127e-9,
        -3.0448450482042081e-11,
        1e-12
      );
    });
    it('zeta(-30.5 + 2i) and zeta(-0.5 + 3i) keep their values', () => {
      part(zeta(new Complex(-30.5, 2)), -1541128413.7265245, 1704290311.9032229, 1e-12);
      part(zeta(new Complex(-0.5, 3)), 0.35291387981928725, 0.012124954416036982, 1e-12);
    });
  });

  describe('BigNumber', () => {
    // The relative bound of the plan is 10^(4 - precision): the work precision holds guard digits.
    const bigRel = (got: unknown, want: string, p: number): void => {
      const w = BigNumber.parse(want);
      const g = got as BigNumber;
      expect(
        g
          .minus(w)
          .abs()
          .div(w.abs())
          .lte(`1e-${p - 4}`),
        `${String(g)} against ${want}`
      ).toBe(true);
    };
    const VALUES: Array<[string, string, string]> = [
      [
        '-620000000000000.5',
        '-1.2113752305837205097e+8407148750326884',
        '-1.211375230583720509650272710945630045329961364679269536148136268e+8407148750326884',
      ],
      [
        '-630000000000000.5',
        '-3.1143681162343861121e+8547125705491109',
        '-3.114368116234386112111889402726837158282955293445211901792803708e+8547125705491109',
      ],
      [
        '-660000000000000.5',
        '-2.2764983153374937931e+8967465926285145',
        '-2.276498315337493793078604127022058876468133288906040041889059794e+8967465926285145',
      ],
      [
        '-100000000000000.5',
        '-4.6196972573299266968e+1276752564973876',
        '-4.61969725732992669682901774910135025514182316011262515428319438e+1276752564973876',
      ],
      [
        '-12345.25',
        '-1.9876593257800509947e+35297',
        '-1.987659325780050994662033298897484820460180885260160034466403337e+35297',
      ],
      [
        '-250.5',
        '1.3106450149434268013e+293',
        '1.310645014943426801257106449118695889463794485728052922065547893e+293',
      ],
    ];
    afterEach(() => BigNumber.resetConfig());
    it.each(VALUES)('precision 20: zeta(%s)', { timeout: 60000 }, (s, want20) => {
      BigNumber.config({ precision: 20 });
      bigRel(zeta(BigNumber.parse(s)), want20, 20);
    });
    it.each(VALUES)('precision 64: zeta(%s)', { timeout: 60000 }, (s, _want20, want64) => {
      BigNumber.config({ precision: 64 });
      bigRel(zeta(BigNumber.parse(s)), want64, 64);
    });
    it('zeta(-700000000000000.5) is -Infinity: the exponent 9.5e15 is above the maximum exponent', () => {
      expect(String(zeta(BigNumber.parse('-700000000000000.5')))).toBe('-Infinity');
    });
  });
});
