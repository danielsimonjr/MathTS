/* eslint-disable no-loss-of-precision -- mpmath dps=30 oracle constants written
   at full precision; rounding to the nearest IEEE-754 double is intended. */
import { describe, it, expect } from 'vitest';
import {
  siegelZ,
  riemannSiegelZ,
  lerchPhi,
  parabolicCylinderD,
  coulombF,
  coulombG,
  coulombFG,
  polylog,
} from '../dist/index.js';

/**
 * Advanced niche special-function oracle test: Riemann–Siegel Z, Lerch
 * transcendent, parabolic-cylinder D_ν, and regular Coulomb wave F_L.
 *
 * Ground truth: mpmath at dps=30 (mp.siegelz / mp.lerchphi / mp.pcfd /
 * mp.coulombf). Regenerate constants with the corpus in the maintainer's
 * scratchpad `gen_oracle.py`.
 */

function relerr(actual: number, expected: number): number {
  if (expected === 0) return Math.abs(actual);
  return Math.abs((actual - expected) / expected);
}

describe('gap: advanced special functions oracle (siegelZ, lerchPhi, pcfd, coulombF)', () => {
  describe('siegelZ(t) — Riemann–Siegel Z-function', () => {
    // O(1)-magnitude points: tight relative tolerance.
    const oh1: Array<[number, number]> = [
      [0.5, -1.0653492124937794036],
      [1.0, -0.73630546286731773468],
      [2.5, -0.52628300373793761022],
      [5.0, -0.73886342827526476436],
      [10.0, -1.5491945461810223891],
      [15.0, 0.71994239134213713352],
      [30.0, 0.59602851923988495532],
      [40.0, -1.308882393456599159],
    ];
    for (const [t, expected] of oh1) {
      it(`matches mpmath.siegelz(${t})`, () => {
        expect(relerr(siegelZ(t) as number, expected)).toBeLessThan(1e-11);
      });
    }

    // Near the first three zeta zeros: value ≈ 0, so pin by absolute error.
    const nearZeros: Array<[number, number]> = [
      [14.134725, -1.1241835020461372577e-7],
      [21.02204, -4.1065861552570580742e-7],
      [25.010858, 5.7592312612242911809e-7],
    ];
    for (const [t, expected] of nearZeros) {
      it(`is ~0 near the zeta zero at t=${t} (abs error < 1e-9)`, () => {
        expect(Math.abs((siegelZ(t) as number) - expected)).toBeLessThan(1e-9);
      });
    }

    it('is even: Z(-t) = Z(t)', () => {
      expect(siegelZ(-15) as number).toBeCloseTo(siegelZ(15) as number, 12);
      expect(siegelZ(-14.134725) as number).toBeCloseTo(siegelZ(14.134725) as number, 12);
    });

    it('Z(0) = zeta(1/2) ≈ -1.4603545088', () => {
      expect(relerr(siegelZ(0) as number, -1.4603545088095868129)).toBeLessThan(1e-11);
    });

    it('riemannSiegelZ is an alias for siegelZ', () => {
      expect(riemannSiegelZ(15) as number).toBe(siegelZ(15) as number);
    });
  });

  describe('lerchPhi(z, s, a) — Lerch transcendent', () => {
    const cases: Array<[number, number, number, number]> = [
      [0.5, 2, 1, 1.1644810529300250118],
      [0.5, 3, 2, 0.14885277443216080376],
      [-0.7, 2, 1, 0.86451200333957898386],
      [0.9, 2, 1.5, 0.76309252564770053735],
      [0.3, 1.5, 0.5, 3.0197134125244131375],
      [-0.5, 2.5, 3, 0.051935648113781267714],
      [0.99, 2, 1, 1.6046721697741164646],
    ];
    for (const [z, s, a, expected] of cases) {
      it(`matches mpmath.lerchphi(${z}, ${s}, ${a})`, () => {
        expect(relerr(lerchPhi(z, s, a) as number, expected)).toBeLessThan(1e-12);
      });
    }

    it('cross-checks the polylog relation Li_s(z) = z·Φ(z, s, 1)', () => {
      expect(relerr((polylog(2, 0.5) as number) / 0.5, lerchPhi(0.5, 2, 1) as number)).toBeLessThan(
        1e-12
      );
      expect(relerr(polylog(3, 0.7) as number, 0.7 * (lerchPhi(0.7, 3, 1) as number))).toBeLessThan(
        1e-12
      );
    });

    it('throws for |z| >= 1 and for a <= 0', () => {
      expect(() => lerchPhi(1, 2, 1)).toThrow();
      expect(() => lerchPhi(-1.2, 2, 1)).toThrow();
      expect(() => lerchPhi(0.5, 2, 0)).toThrow();
    });
  });

  describe('parabolicCylinderD(nu, x) — parabolic-cylinder D_ν', () => {
    const cases: Array<[number, number, number]> = [
      [0, 1.0, 0.77880078307140486825],
      [1, 2.0, 0.73575888234288464319],
      [2, 0.5, -0.70455979711010683959],
      [0.5, 1.5, 0.72789464865315153931],
      [-1, 1.0, 0.5106437410796606749],
      [3, 2.0, 0.73575888234288464319],
      [2.5, 1.0, -0.74763763538460074184],
      [-0.5, 2.0, 0.24301889396360194159],
      [1, -1.5, -0.85467423709638451465],
    ];
    for (const [nu, x, expected] of cases) {
      it(`matches mpmath.pcfd(${nu}, ${x})`, () => {
        expect(relerr(parabolicCylinderD(nu, x) as number, expected)).toBeLessThan(1e-10);
      });
    }

    it('special value: D_0(x) = e^{-x²/4}', () => {
      expect(relerr(parabolicCylinderD(0, 1.3) as number, Math.exp(-(1.3 * 1.3) / 4))).toBeLessThan(
        1e-12
      );
    });
  });

  describe('coulombF(L, eta, rho) — regular Coulomb wave function', () => {
    const cases: Array<[number, number, number, number]> = [
      [0, 0.0, 1.0, 0.84147098480789650665],
      [0, 1.0, 2.0, 0.66178161383268129825],
      [1, 0.5, 3.0, 1.0610932285426884082],
      [0, -1.0, 5.0, 0.90941019611717468875],
      [2, 1.0, 4.0, 0.86886725076727654993],
      [1, 2.0, 1.0, 0.011353080388012422925],
      [0, 0.5, 10.0, 0.93918627635392269678],
      [3, 0.5, 6.0, 1.1525109775776881533],
      [0, 5.0, 2.0, 0.00028622029679632259616],
      [1, -2.0, 8.0, -0.90554623946612428572],
    ];
    for (const [L, eta, rho, expected] of cases) {
      it(`matches mpmath.coulombf(${L}, ${eta}, ${rho})`, () => {
        expect(relerr(coulombF(L, eta, rho) as number, expected)).toBeLessThan(1e-6);
      });
    }

    it('special case: F_0(0, rho) = sin(rho)', () => {
      expect(relerr(coulombF(0, 0, 1) as number, Math.sin(1))).toBeLessThan(1e-12);
      expect(relerr(coulombF(0, 0, 2.5) as number, Math.sin(2.5))).toBeLessThan(1e-12);
    });

    it('returns 0 at rho = 0 and throws for negative rho or L', () => {
      expect(coulombF(0, 1, 0)).toBe(0);
      expect(() => coulombF(0, 1, -1)).toThrow();
      expect(() => coulombF(-1, 1, 1)).toThrow();
    });
  });

  describe('coulombG(L, eta, rho) — irregular Coulomb wave function', () => {
    // mpmath.coulombg(L, eta, rho) at dps=30, within the validated domain
    // (the prototype achieves max relerr 3.0e-10 here). The deep-sub-turning-
    // point corner (eta=+5, rho<=1) is intentionally excluded — see the module
    // docstring's "Validated domain" note. Turning point rho_tp = eta +
    // sqrt(eta^2 + L(L+1)); above it, accuracy is ~1e-12.
    const cases: Array<[number, number, number, number]> = [
      [0, 0.0, 1.0, 0.5403023058681397174],
      [0, 1.0, 2.0, 1.2757787847682765892],
      [1, 0.5, 3.0, 0.51048479519450264344],
      [0, -1.0, 5.0, 0.13959252776182731837],
      [2, 1.0, 4.0, 1.0878725947264430947],
      [1, 2.0, 2.0, 5.0697860051748305015],
      [0, 0.5, 10.0, -0.41435106939020949432],
      [3, 0.5, 6.0, -0.20469265386509986971],
      [0, 5.0, 2.0, 869.69011404568501453],
      [1, -2.0, 8.0, 0.074848731250989494215],
      [2, -5.0, 20.0, -0.20249216737758908989],
      [3, 5.0, 5.0, 52.053863367045054249],
      [0, -5.0, 0.5, -0.37117109873324840776],
      [2, 2.0, 1.0, 66.49640933288923121],
      [3, -1.0, 10.0, 0.20906305496648189069],
      [1, 5.0, 10.0, 1.7087195200549296957],
      [0, 2.0, 20.0, 1.0133243842736106738],
      [3, 0.0, 5.0, 0.077214549564971021933],
    ];
    for (const [L, eta, rho, expected] of cases) {
      it(`matches mpmath.coulombg(${L}, ${eta}, ${rho})`, () => {
        expect(relerr(coulombG(L, eta, rho) as number, expected)).toBeLessThan(1e-6);
      });
    }

    it('special case: G_0(0, rho) = cos(rho)', () => {
      for (const rho of [0.5, 1.0, 2.5, 5.0, 10.0, 20.0]) {
        expect(relerr(coulombG(0, 0, rho) as number, Math.cos(rho))).toBeLessThan(1e-11);
      }
    });

    it('throws for rho <= 0 (G is singular at the origin) or L < 0', () => {
      expect(() => coulombG(0, 1, 0)).toThrow();
      expect(() => coulombG(0, 1, -1)).toThrow();
      expect(() => coulombG(-1, 1, 1)).toThrow();
    });
  });

  describe('coulombFG(L, eta, rho) — {F, F′, G, G′} bundle + Wronskian', () => {
    // (L, eta, rho, F, F', G, G') from mpmath (dps=30); coulombf/coulombg and
    // numerical derivatives. The Wronskian F′G − FG′ = 1 is the implementation-
    // independent invariant.
    const cases: Array<[number, number, number, number, number, number, number]> = [
      [
        0, 0.0, 1.0, 0.84147098480789650665, 0.5403023058681397174, 0.5403023058681397174,
        -0.84147098480789650665,
      ],
      [
        0, 1.0, 2.0, 0.66178161383268129825, 0.48155745570994920276, 1.2757787847682765892,
        -0.58272881309718474336,
      ],
      [
        1, 0.5, 3.0, 1.0610932285426884082, 0.28210448030197968775, 0.51048479519450264344,
        -0.80670569665703536417,
      ],
      [
        0, -1.0, 5.0, 0.90941019611717468875, 0.17756961358270570346, 0.13959252776182731837,
        -1.0723572409349213838,
      ],
      [
        2, 1.0, 4.0, 0.86886725076727654993, 0.42697960762876238878, 1.0878725947264430947,
        -0.61632037101263917547,
      ],
      [
        1, 2.0, 2.0, 0.081169844041273191505, 0.12006773254416149324, 5.0697860051748305015,
        -4.8205376577485665894,
      ],
    ];
    for (const [L, eta, rho, F, Fp, G, Gp] of cases) {
      it(`components + Wronskian at (${L}, ${eta}, ${rho})`, () => {
        const r = coulombFG(L, eta, rho) as { F: number; Fp: number; G: number; Gp: number };
        expect(relerr(r.F, F)).toBeLessThan(1e-6);
        expect(relerr(r.Fp, Fp)).toBeLessThan(1e-6);
        expect(relerr(r.G, G)).toBeLessThan(1e-6);
        expect(relerr(r.Gp, Gp)).toBeLessThan(1e-6);
        // Implementation-independent identity F′G − FG′ = 1.
        expect(Math.abs(r.Fp * r.G - r.F * r.Gp - 1)).toBeLessThan(1e-10);
      });
    }

    it('Wronskian F′G − FG′ = 1 holds across a wide corpus (< 1e-10)', () => {
      const grid: Array<[number, number, number]> = [];
      for (const L of [0, 1, 2, 3]) {
        for (const eta of [-5, -2, -1, 0, 0.5, 1, 2, 5]) {
          for (const rho of [0.5, 1, 2, 5, 10, 20]) {
            grid.push([L, eta, rho]);
          }
        }
      }
      for (const [L, eta, rho] of grid) {
        const r = coulombFG(L, eta, rho) as { F: number; Fp: number; G: number; Gp: number };
        expect(Math.abs(r.Fp * r.G - r.F * r.Gp - 1)).toBeLessThan(1e-10);
      }
    });

    it('G component of coulombFG equals coulombG', () => {
      const r = coulombFG(1, 0.5, 3.0) as { G: number };
      expect(r.G).toBe(coulombG(1, 0.5, 3.0) as number);
    });
  });
});
