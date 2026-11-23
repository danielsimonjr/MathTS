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
  besselI,
  besselJ,
  besselK,
  besselY,
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

/**
 * The bound B1 of the large-x engine (x >= 25): 2^-52 * max(amplitude, |true|) * (8 + 0.4 an) + 4 ulp.
 * The engine measures 0.2 to 4 u (u = 2^-52 * amplitude) at every table point, and 546 u at the long
 * recurrence (1999.75, 2000), where the bound is 808 u. The phase x - A rounded in double
 * (the code that the exact angle addition replaces) measures up to 234750 u at (0.5, 1e6), so it fails.
 */
const expectB1 = (got: unknown, want: number, x: number, an: number): void => {
  const g = got as number;
  const ulp = Math.max(Math.abs(want) * 2 ** -52, 5e-324);
  const tol =
    2 ** -52 * Math.max(Math.sqrt(2 / (Math.PI * x)), Math.abs(want)) * (8 + 0.4 * an) + 4 * ulp;
  expect(Number.isFinite(g), `got ${g}, want ${want}`).toBe(true);
  expect(Math.abs(g - want), `got ${g}, want ${want}`).toBeLessThanOrEqual(tol);
};

describe('#1331: real-order J and Y at a large order or a large argument', () => {
  // main (3b2ffe60) ran CF1 for about x steps and a recurrence of an steps with no bound:
  // besselJ(4e9 + 0.5, 1000) took 28 s, and besselJ(400.3, 5000) was 3.2e-10 of the amplitude off.
  describe('the zero and overflow bounds and the order limit run before any loop', () => {
    it('besselJ(4e9 + 0.5, 1000) is 0 and besselY(4e9 + 0.5, 1e8) is -Infinity', () => {
      expect(besselJ(4e9 + 0.5, 1000)).toBe(0);
      expect(besselY(4e9 + 0.5, 1e8)).toBe(-Infinity);
    });
    it('an integer order follows the same rule: besselY(4e9, 1e8) is -Infinity', () => {
      expect(besselY(4e9, 1e8)).toBe(-Infinity);
      expect(besselJ(4e9, 1000)).toBe(0);
    });
    it('besselJ(3e9 + 0.5, 3e9) and besselY(3e9 + 0.5, 3e9) throw a RangeError', () => {
      expect(() => besselJ(3e9 + 0.5, 3e9)).toThrow(RangeError);
      expect(() => besselJ(3e9 + 0.5, 3e9)).toThrow(/exceeds the supported maximum/);
      expect(() => besselY(3e9 + 0.5, 3e9)).toThrow(/exceeds the supported maximum/);
    });
    it('a huge order with an x above nu^2 stays O(1): besselJ(3e9 + 0.5, 1e20) does not throw', () => {
      expect(Number.isFinite(besselJ(3e9 + 0.5, 1e20))).toBe(true);
    });
  });

  describe('the Hankel start with stable recurrences (x >= 25), bound B1', () => {
    // nu | x | J | Y (mpmath 1.3.0 on the exact doubles, rounded to the double)
    const TABLE: Array<[number, number, number, number]> = [
      [0.3, 25, 0.028287780084076883, -0.1570392985202982],
      [24.7, 25, 0.1675811264571081, -0.24032568627968495],
      [25.3, 25, 0.13837030306336998, -0.2896062006963584],
      [3.7, 26, 0.1082283714502558, 0.11409872107201208],
      [60.25, 50, 0.0008910128558409286, -10.671015349752063],
      [300.7, 25, 2.483587363988605e-287, -4.2770412651425316e283],
      [1999.75, 2000, 0.03615034729365811, -0.06037281670737458],
      [5000.5, 4000, 2.7871341210961365e-205, -3.8058400549762204e200],
      [10000.5, 9000, 8.691184919556407e-139, -8.400021227509216e133],
      [0.5, 1000000, -0.0002792544117637988, -0.0007474200598579329],
      [-0.5, 25, 0.15817308404205055, -0.021120283599650444],
      [-400.3, 5000, -0.0018644908934285784, 0.011147091443899288],
      [-99.9999999, 40, -457178269806370300000, -1.4552437166727982e27],
    ];
    it.each(TABLE)('besselJ(%s, %s) = %s', (nu, x, j) => {
      expectB1(besselJ(nu, x), j, x, Math.abs(nu));
    });
    it.each(TABLE)('besselY(%s, %s), column 4 of the table', (nu, x, _j, y) => {
      expectB1(besselY(nu, x), y, x, Math.abs(nu));
    });
    it('the values of the issue: J and Y of order 400.3 at 5000, 20000 and 1.5e5', () => {
      expectB1(besselJ(400.3, 5000), 7.9222661657754471e-3, 5000, 400.3);
      expectB1(besselJ(400.3, 20000), -5.4950720953749295e-3, 20000, 400.3);
      expectB1(besselJ(400.3, 1.5e5), 1.4431828136850286e-3, 1.5e5, 400.3);
      expectB1(besselY(400.3, 1.5e5), 1.4701599555883358e-3, 1.5e5, 400.3);
      expectB1(besselY(400.5, 1.5e5), 9.532123532783423e-4, 1.5e5, 400.5);
      expectB1(besselJ(1000.5, 9e4), -2.3309866009074991e-3, 9e4, 1000.5);
    });
    it('the amplitude is not 0 above x = 5.7e307, where pi * x is Infinity', () => {
      // The head before this test returned 0 for each of the six values.
      const MAX = 1.7976931348623157e308;
      expectRel(besselJ(0.5, 5.8e307), 3.108146590703153e-155, 1e-14);
      expectRel(besselY(0.5, 5.8e307), -1.0005071438488026e-154, 1e-14);
      expectRel(besselJ(2.25, MAX), 2.250000477195952e-155, 1e-14);
      expectRel(besselY(2.25, MAX), -5.509142236792925e-155, 1e-14);
      expectRel(besselJ(-2.25, MAX), 5.4865424292557276e-155, 1e-14);
      expectRel(besselY(-2.25, MAX), -2.304561239059276e-155, 1e-14);
    });
    it('guards that main already had right: besselJ(2.5, 30), besselY(0.75, 100)', () => {
      expectB1(besselJ(2.5, 30), 0.14120285879928212, 30, 2.5);
      expectB1(besselY(0.75, 100), -0.048204317525488324, 100, 0.75);
    });
    it('the Wronskian identity holds for an order of 100000.3 at x = 100001', () => {
      // mpmath cannot give this order in 280 s. nu <= x < nu + 1, so J_nu comes from the upward
      // recurrence and J_(nu+1) from CF1 and the Wronskian.
      const nu = 100000.3;
      const x = 100001;
      const jn = besselJ(nu, x) as number;
      const jn1 = besselJ(nu + 1, x) as number;
      const yn = besselY(nu, x) as number;
      const yn1 = besselY(nu + 1, x) as number;
      const lhs = jn * yn1 - jn1 * yn + 2 / (Math.PI * x);
      const tol = 2 * 2 ** -52 * x * (Math.abs(jn * yn1) + Math.abs(jn1 * yn));
      expect(Math.abs(lhs)).toBeLessThanOrEqual(tol);
    });
  });

  describe('the window where Y_an is outside the double range and J_an is not (x = 25)', () => {
    it('besselJ(322.5, 25) = 8.8966855908733198e-318 (main NaN), besselJ(320.5, 25), besselJ(318.5, 25)', () => {
      expectB1(besselJ(322.5, 25), 8.8966855908733198e-318, 25, 322.5);
      expectB1(besselJ(320.5, 25), 5.8858754696535775e-315, 25, 320.5);
      // a subnormal: 4 units of the last place
      expect(
        Math.abs((besselJ(318.5, 25) as number) - 3.8456139531998332e-312)
      ).toBeLessThanOrEqual(2e-323);
    });
    it('besselJ(328.5, 25) is 0 and besselY(322.5, 25) is -Infinity', () => {
      expect(besselJ(328.5, 25)).toBe(0);
      expect(besselY(322.5, 25)).toBe(-Infinity);
    });
    it('a negative order: besselJ(-322.5, 25) is Infinity, besselY(-322.5, 25) = 8.8966855908733198e-318', () => {
      expect(besselJ(-322.5, 25)).toBe(Infinity);
      // cos(322.5 pi) is exactly 0 and Y_(-nu) = sin(nu pi) J_nu
      expectB1(besselY(-322.5, 25), 8.8966855908733198e-318, 25, 322.5);
    });
    it('besselJ(1075.3, 300) is 0, besselJ(-1075.3, 300) is -Infinity, besselY(-1075.3, 300) is Infinity', () => {
      expect(besselJ(1075.3, 300)).toBe(0);
      expect(besselJ(-1075.3, 300)).toBe(-Infinity);
      expect(besselY(-1075.3, 300)).toBe(Infinity);
    });
  });

  describe('a negative order with a small factor is finite where Y_an alone is not', () => {
    it('besselY(-151.5001, 1) = -2.8381551290433205e+305 (main -2.8381551290403436e+305)', () => {
      expectRel(besselY(-151.5001, 1), -2.8381551290433205e305, 1e-12);
    });
    it('besselJ(-150.0000000001, 1e-3) is Infinity and besselY(-150.0000000001, 1e-3) is -Infinity', () => {
      expect(besselJ(-150.0000000001, 1e-3)).toBe(Infinity);
      expect(besselY(-150.0000000001, 1e-3)).toBe(-Infinity);
    });
  });

  describe('1e-5 <= x < 25 keeps the Temme and Steed values (bound B4, 1e-13 relative)', () => {
    it.each([
      ['J', 0.3, 1e-5, 0.028620072142050116],
      ['Y', 0.3, 1e-5, -37.052241917585756],
      ['J', 7.25, 1.9999, 0.00010563125704409467],
      ['Y', 7.25, 2.0001, -432.54354557045493],
      ['J', 7.25, 24.9999, 0.041634090978524423],
      ['Y', 7.25, 25.0001, 0.15769609067691412],
      ['J', -7.25, 25.0001, 0.082089705531464833],
      ['Y', -7.25, 25.0001, -0.1409262446370445],
    ] as Array<[string, number, number, number]>)('bessel%s(%s, %s) = %s', (kind, nu, x, want) => {
      const got = kind === 'J' ? besselJ(nu, x) : besselY(nu, x);
      expectRel(got, want, 1e-13);
    });
  });
});

describe('#1334 and #1332: J and Y of a tiny argument', () => {
  // main: besselJ(-0.5, 1e-300) = NaN, besselY(-0.3, 1e-300) = NaN, besselJ(0.5, 5e-324) = 0:
  // the continued fraction of the Temme engine divides by x, and x / 2 is 0 for the smallest x.
  describe('besselJ, bound B2', () => {
    it.each([
      [-0.5, 1e-300, 7.9788456080286535e149],
      [-1.7, 1e-100, -7.6023876405919675e169],
      [-0.9999, 1e-6, 199.72156301161781],
      [-30.3, 1e-6, 5.2501110334840382e221],
      [-17.3, 9e-6, -3.9563340874032088e105],
      [-3.0000000000001, 1e-9, -1598721155463793.7],
      [0.3, 1e-8, 0.0036030536107702112],
      [0.5, 5e-324, 1.7735048886036273e-162],
      [-0.3, 5e-324, 9.3085148507228138e96],
    ])('besselJ(%s, %s) = %s', (nu, x, want) => {
      // 1e-14 for |nu| <= 3 and 5e-14 for 3 < |nu| <= 60 (measured worst 1.2e-15 and 7.2e-15)
      expectRel(besselJ(nu, x), want, Math.abs(nu) <= 3 ? 1e-14 : 5e-14);
    });
    it('besselJ(2.5, 1e-300) is 0: the value 5.3e-752 is below the double range', () => {
      expect(besselJ(2.5, 1e-300)).toBe(0);
    });
    it('a value above the double range is the signed Infinity', () => {
      expect(besselJ(-58.5, 1e-5)).toBe(Infinity);
      expect(besselJ(-150.5, 1e-3)).toBe(Infinity);
      expect(besselJ(-1.000000000001, 1e-320)).toBe(-Infinity);
    });
    it('the guard that main already had right: besselJ(-2.0000001, 1e-10) = 40000096501782.345', () => {
      expectRel(besselJ(-2.0000001, 1e-10), 40000096501782.345, 1e-14);
    });
  });

  describe('besselY, bound B3', () => {
    it.each([
      [-0.3, 1e-300, -6.8909140613203008e89],
      [1.5, 1e-200, -7.9788456080286538e299],
      [-2.5, 1e-5, 1.6820883480014255e-14],
      [1e-10, 1e-6, -8.8690314818165234],
      [0.3, 5e-324, -1.1505957125059706e97],
      [0.7, 5e-324, -1.3842517146242157e226],
      [0.3, 1e-300, -1.1723523233093104e90],
    ])('besselY(%s, %s) = %s', (nu, x, want) => {
      // Measured worst 2.9e-14 below x = 1e-100 (the exponent mu ln(x/2) is rounded) and 2e-16 above.
      expectRel(besselY(nu, x), want, x < 1e-100 ? 1e-13 : 1e-14);
    });
    it('besselY(2.0000001, 1e-10) = -1.2732426185660811e+20 and the negative order', () => {
      expectRel(besselY(2.0000001, 1e-10), -1.2732426185660811e20, 1e-14);
      expectRel(besselY(-2.0000001, 1e-10), -1.2732426185660182e20, 1e-14);
    });
  });

  describe('an integer order of a tiny argument (D5: main returned 0 below |x| = 1e-15)', () => {
    it.each([
      [2, 1e-16, 1.2499999999999999e-33],
      [3, 1e-16, 2.0833333333333332e-50],
      [5, 1e-20, 2.604166666666666e-104],
      [10, 1e-28, 2.6911444554673714e-290],
      [7, 1e-17, 1.5500992063492071e-125],
      [2, 9e-16, 1.0125000000000001e-31],
      [4, -3e-16, 2.1093749999999998e-65],
      [3, -7e-17, -7.1458333333333344e-51],
      [2, 1e-300, 0],
      [3, -1e-16, -2.0833333333333332e-50],
    ])('besselJ(%s, %s) = %s', (n, x, want) => {
      if (want === 0) expect(besselJ(n, x)).toBe(0);
      else expectRel(besselJ(n, x), want, 1e-14);
    });
    it('a subnormal result is within 2 units of the last place; below half a unit it is 0', () => {
      // J_10(1e-30) = 2.6911444554673744e-310 and J_11(1e-27) = 1.2232474797578969e-308 are
      // subnormal: the spacing of the doubles there is 4.9e-324 (relative 1.8e-14 and 4e-16).
      expect(
        Math.abs((besselJ(10, 1e-30) as number) - 2.6911444554673744e-310)
      ).toBeLessThanOrEqual(1e-323);
      expect(
        Math.abs((besselJ(11, 1e-27) as number) - 1.2232474797578969e-308)
      ).toBeLessThanOrEqual(1e-323);
      // J_20(9e-16) = 4.77e-326 is under half of the smallest subnormal: 0, as is J_21
      expect(besselJ(20, 9e-16)).toBe(0);
      expect(besselJ(21, 9e-16)).toBe(0);
      expect(besselJ(-3, 0)).toBe(-0);
    });
    it('besselY(2, 5e-324) is -Infinity (main NaN)', () => {
      expect(besselY(2, 5e-324)).toBe(-Infinity);
      expect(besselY(2, 1e-300)).toBe(-Infinity);
    });
  });
});

describe('#1331: the array form is bounded by the same total work (no wall clock)', () => {
  it('evaluates an array of large non-integral orders without recurrence', () => {
    const n = 1e9 + 0.5;
    const xs = new Float64Array(8).fill(2e9);
    for (const [evaluate, expected] of [
      [besselJ, 9.851904486365147e-6],
      [besselY, -1.644664952620546e-5],
    ] as const) {
      const result = evaluate(n, xs) as Float64Array;
      expect(result.length).toBe(xs.length);
      for (const value of result) expectRel(value, expected, 3e-6);
    }
  });
  it('besselJ(4e9 + 0.5, 4 x 1000) returns four zeros at once: each element is under the zero bound', () => {
    const out = besselJ(4e9 + 0.5, new Float64Array(4).fill(1000)) as Float64Array;
    expect(Array.from(out)).toEqual([0, 0, 0, 0]);
  });
  it('besselJ(400.3, [5000, 20000]) equals the two scalar calls', () => {
    const out = besselJ(400.3, new Float64Array([5000, 20000])) as Float64Array;
    expect(out[0]).toBe(besselJ(400.3, 5000));
    expect(out[1]).toBe(besselJ(400.3, 20000));
  });
  it('an order that the scalar rejects keeps the message of the scalar', () => {
    expect(() => besselJ(3e9 + 0.5, new Float64Array([3e9]))).toThrow(
      /besselJ: n = 3000000000.5 exceeds the supported maximum of 2500000000/
    );
  });
  it('a moderate real-order array is not refused', () => {
    const out = besselJ(2.5, new Float64Array(2000).fill(30)) as Float64Array;
    expect(out.length).toBe(2000);
    expectRel(out[0], 0.14120285879928212, 1e-13);
  });
});

describe('D2 and D3: besselI and besselK of a real order (main rounded the order)', () => {
  // main: besselI(1, -1) = 0.5652 (true -0.5652), besselI(-0.5, 1) = 0.5652 (true 1.2312),
  // besselI(0.5, 1) = 0.5652 (true 0.9377), besselI(2, 800) = NaN, besselI(0.5, 1e-300) = 0, and
  // besselK(1.49, 3) = 0.0402 (true 0.04783) because `Math.round(Math.abs(n))` replaced the order.
  describe('besselI', () => {
    it.each([
      [1, -1, -0.56515910399248503],
      [3, -2, -0.21273995923985266],
      [-2, 3, 2.2452124409299512],
      [-1, 3, 3.9533702174026094],
      [0, 0.5, 1.0634833707413235],
      [1, 0.5, 0.25789430539089632],
      [2, 50, 2.8164306402451941e20],
      [2, 700, 1.5252262036997769e302],
      [200, 700, 7.0802044275411892e289],
      [-0.5, 1, 1.2312002145929674],
      [0.5, 1, 0.93767488824548765],
      [0.3, 1e-8, 0.0036030536107702113],
      [1000.5, 900, 1.3945311004547579e166],
      [170.5, 30, 1.3008463806581897e-107],
      [-150.000000001, 0.9, 3.9657950421771418e303],
      [-2.5, 3, 1.5688541070744028],
      [-0.3, 0.2, 1.5591400070119671],
      [-150.5, 2, 1.4737746528722863e261],
      [-3.7, 60, 5.2537089359530428e24],
      [-1e-9, 2, 2.2795853024499611],
      [2.7, 40, 13582084091273960],
    ])('besselI(%s, %s) = %s', (nu, x, want) => {
      // Bound B3: 1e-14. Measured worst 3.4e-15 (besselI(1000.5, 900)).
      expectRel(besselI(nu, x), want, 1e-14);
    });
    it('besselI(0.5, 1e-300) = 7.9788456080286537e-151 (main 0)', () => {
      expectRel(besselI(0.5, 1e-300), 7.9788456080286537e-151, 1e-13);
    });
    it('a negative x: an integer order has the sign (-1)^n, a real order is NaN', () => {
      expect(besselI(0.5, -1)).toBeNaN();
      expect(besselI(-0.5, -1)).toBeNaN();
      expect(besselI(2, -3)).toBe(besselI(2, 3));
      expect(besselI(-3, -2)).toBe(-(besselI(3, 2) as number));
    });
    it('the result outside the double range: Infinity (main NaN) and 0', () => {
      expect(besselI(2, 800)).toBe(Infinity);
      expect(besselI(0, 1e5)).toBe(Infinity);
      expect(besselI(300.25, 1)).toBe(0); // true 3.2e-706
      expect(besselI(4.5, 5e-324)).toBe(0); // true 1.1e-1458
    });
    it('x = 0: 1 for order 0, 0 for a positive order, a signed Infinity for a negative real order', () => {
      expect(besselI(0, 0)).toBe(1);
      expect(besselI(2, 0)).toBe(0);
      expect(besselI(-2, 0)).toBe(0);
      expect(besselI(0.5, 0)).toBe(0);
      expect(besselI(-0.5, 0)).toBe(Infinity);
      // Gamma(-0.5) < 0, so I_(-1.5)(x) -> -Infinity as x -> 0+
      expect(besselI(-1.5, 0)).toBe(-Infinity);
    });
    it('a NaN or infinite order is NaN, x = Infinity is Infinity, a NaN x is NaN', () => {
      expect(besselI(NaN, 1)).toBeNaN();
      expect(besselI(Infinity, 1)).toBeNaN();
      expect(besselI(0.5, NaN)).toBeNaN();
      expect(besselI(0.5, Infinity)).toBe(Infinity);
      expect(besselI(2, -Infinity)).toBe(Infinity);
      expect(besselI(1, -Infinity)).toBe(-Infinity);
    });
    it('the work limit: a RangeError when the product and the series need above 2500000000 steps', () => {
      // nu = 2200000000.5 at x = 1458035535: ln T(m*) = -0.34 (no gate fires), m* = 219646508
      expect(() => besselI(2200000000.5, 1458035535)).toThrow(RangeError);
      expect(() => besselI(2200000000.5, 1458035535)).toThrow(
        /besselI: .* above the supported maximum of 2500000000/
      );
      // an order of 3e9 at x = 1000 is 0 at once (the zero gate comes first)
      expect(besselI(3e9 + 0.5, 1000)).toBe(0);
    });
  });

  describe('besselK', () => {
    it.each([
      [0.5, 1, 0.46106850444789456],
      [-0.5, 1, 0.46106850444789456],
      [2.5, 2, 0.3897977588961997],
      [0.3, 0.1, 2.8050564750215722],
      [2.7, 40, 9.1831009509620418e-19],
      [-2.7, 40, 9.1831009509620418e-19],
      [150.5, 2, 2.3149998112552111e261],
      [1.49, 3, 0.04783045360771901],
      [1.51, 3, 0.04824102776989774],
      [2.5, 1.999, 0.39046557949525685],
      [2.5, 2.001, 0.38913127073156315],
      [1e-7, 1.5, 0.2138055626475263],
      [0.25, 700, 4.6699847598133661e-306],
      [3.3, 700, 4.7062160878657106e-306],
    ])('besselK(%s, %s) = %s', (nu, x, want) => {
      // Bound B3: 1e-14. Measured worst 1.8e-15.
      expectRel(besselK(nu, x), want, 1e-14);
    });
    it('besselK(0.5, 1e-300) = 1.2533141373155002e+150 (the exponent mu ln(x/2) is rounded)', () => {
      expectRel(besselK(0.5, 1e-300), 1.2533141373155002e150, 1e-13);
    });
    it('besselK(2, 3) = 0.061510458471742038 within 4e-15 (an integer order, as main)', () => {
      expectRel(besselK(2, 3), 0.061510458471742038, 4e-15);
    });
    it('the result above the double range is Infinity; an invalid input is NaN', () => {
      expect(besselK(150.000000001, 0.9)).toBe(Infinity);
      expect(besselK(0.5, 0)).toBeNaN();
      expect(besselK(0.5, -1)).toBeNaN();
      expect(besselK(NaN, 1)).toBeNaN();
      expect(besselK(Infinity, 1)).toBeNaN();
      expect(besselK(0.5, NaN)).toBeNaN();
      expect(besselK(0.5, Infinity)).toBe(0);
    });
  });

  describe('the array form of besselI is bounded by the total work', () => {
    it('besselI(1e9, 4 x 662743431) throws: one element needs 1.2e9 steps, four need 4.8e9', () => {
      // ln T(m*) = -0.37 at m* = 99839323, so no gate fires; the scalar is never called
      expect(() => besselI(1e9, new Float64Array(4).fill(662743431))).toThrow(RangeError);
      expect(() => besselI(1e9, new Float64Array(4).fill(662743431))).toThrow(/per call/);
    });
    it('besselI(1e9, 4 x 1000) returns four zeros at once (the zero gate)', () => {
      const out = besselI(1e9, new Float64Array(4).fill(1000)) as Float64Array;
      expect(Array.from(out)).toEqual([0, 0, 0, 0]);
    });
    it('besselI(2.5, [1, 30]) and besselI(-2.5, [1, 30]) equal the scalars', () => {
      const a = besselI(2.5, new Float64Array([1, 30])) as Float64Array;
      expect(a[0]).toBe(besselI(2.5, 1));
      expect(a[1]).toBe(besselI(2.5, 30));
      const b = besselI(-2.5, new Float64Array([1, 30])) as Float64Array;
      expect(b[0]).toBe(besselI(-2.5, 1));
      expect(b[1]).toBe(besselI(-2.5, 30));
    });
  });
});

describe('#1331: J of a negative real order at x = 0 is a signed Infinity', () => {
  // J_(-nu)(x) ~ (x/2)^(-nu) / Gamma(1 - nu) as x -> 0+, with the sign of Gamma(1 - nu).
  it('besselJ(-0.5, 0) = Infinity and besselJ(-1.5, 0) = -Infinity (main Infinity)', () => {
    expect(besselJ(-0.5, 0)).toBe(Infinity);
    expect(besselJ(-1.5, 0)).toBe(-Infinity);
    expect(besselJ(-2.5, 0)).toBe(Infinity);
    expect(besselJ(0.5, 0)).toBe(0);
  });
});
