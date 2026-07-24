/* eslint-disable no-loss-of-precision -- mpmath dps=30 oracle constants written
   at full precision; rounding to the nearest IEEE-754 double is intended. */
import { describe, it, expect } from 'vitest';
import { besselK } from '../dist/index.js';

/**
 * besselK uniform machine-precision oracle test.
 *
 * Ground truth: mpmath at dps=30. Regenerate with:
 *
 *   python -c "
 *   import mpmath as mp
 *   mp.mp.dps=30
 *   xs=[0.1,0.5,1,2,5,8,8.5,9,9.5,10,10.5,11,15,30,50]
 *   for x in xs: print(x, mp.nstr(mp.besselk(0,x),20), mp.nstr(mp.besselk(1,x),20))
 *   print(mp.nstr(mp.besselk(2,10),20), mp.nstr(mp.besselk(3,10),20))
 *   "
 *
 * The point of the test is the x in [8,11] band, where the previous
 * series(x<=8)/asymptotic(x>8) split floored the relative error at ~1.6e-9
 * due to cancellation near the crossover. The uniformly-accurate
 * Temme/Steed continued-fraction method must hold relerr < 1e-13 across the
 * WHOLE range x in [0.1, 50].
 */

// mpmath dps=30 reference: [x, K0(x), K1(x)]
const REF: Array<[number, number, number]> = [
  [0.1, 2.4270690247020165578, 9.8538447808706055744],
  [0.5, 0.92441907122766586178, 1.6564411200033008937],
  [1, 0.42102443824070833334, 0.60190723019723457474],
  [2, 0.11389387274953343565, 0.13986588181652242728],
  [5, 0.0036910983340425942747, 0.0040446134454521642084],
  [8, 0.0001464707052228153871, 0.00015536921180500113392],
  [8.5, 0.000086257566349325077619, 0.000091197247750068985436],
  [9, 0.00005088131295645924757, 0.000053637016379451945249],
  [9.5, 0.000030057884957934335384, 0.000031602034110426745609],
  [10, 0.000017780062316167651811, 0.000018648773453825584597],
  [10.5, 0.000010529988143865325862, 0.000011020472311353895487],
  [11, 6.2430205476536771453e-6, 6.5208606745808860555e-6],
  [15, 9.819536482396434541e-8, 1.014172936976209181e-7],
  [30, 2.1324774964630563712e-14, 2.1677320018915494249e-14],
  [50, 3.4101677497894955139e-23, 3.4441022267175556126e-23],
];

const relerr = (got: number, want: number) => Math.abs(got - want) / Math.abs(want);

describe('besselK uniform machine precision (mpmath oracle)', () => {
  it('K0 matches mpmath to relerr < 1e-13 across x in [0.1,50]', () => {
    for (const [x, k0] of REF) {
      const got = besselK(0, x) as number;
      expect(relerr(got, k0), `K0(${x}) relerr`).toBeLessThan(1e-13);
    }
  });

  it('K1 matches mpmath to relerr < 1e-13 across x in [0.1,50]', () => {
    for (const [x, , k1] of REF) {
      const got = besselK(1, x) as number;
      expect(relerr(got, k1), `K1(${x}) relerr`).toBeLessThan(1e-13);
    }
  });

  it('holds tightly in the [8,11] band (the crossover that used to floor at ~1.6e-9)', () => {
    const band = REF.filter(([x]) => x >= 8 && x <= 11);
    let worst = 0;
    for (const [x, k0, k1] of band) {
      const e0 = relerr(besselK(0, x) as number, k0);
      const e1 = relerr(besselK(1, x) as number, k1);
      worst = Math.max(worst, e0, e1);
      expect(e0, `K0(${x}) band relerr`).toBeLessThan(1e-13);
      expect(e1, `K1(${x}) band relerr`).toBeLessThan(1e-13);
    }
    // Diagnostic: the previous implementation's band worst-case was ~1.6e-9.
    expect(worst).toBeLessThan(1e-13);
  });

  it('K2/K3 via the order recurrence stay accurate (mpmath)', () => {
    // K2(10)=2.1509817006932768731e-5, K3(10)=2.7252700256598692089e-5
    // K2(5)=5.3089437122234599581e-3,  K3(7)=7.710751535668901623e-4
    expect(relerr(besselK(2, 10) as number, 2.1509817006932768731e-5)).toBeLessThan(1e-12);
    expect(relerr(besselK(3, 10) as number, 2.7252700256598692089e-5)).toBeLessThan(1e-12);
    expect(relerr(besselK(2, 5) as number, 5.3089437122234599581e-3)).toBeLessThan(1e-12);
    expect(relerr(besselK(3, 7) as number, 7.710751535668901623e-4)).toBeLessThan(1e-12);
  });
});
