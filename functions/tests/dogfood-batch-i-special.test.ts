/**
 * Dogfood batch I (special functions): non-finite results, array work bounds, range losses.
 *
 * Reference values come from mpmath 1.3.0, SciPy 1.16.3 and exact integer arithmetic (Python).
 * No test asserts a wall-clock time. A call that must finish at once shows it by returning
 * (or throwing) inside the default test timeout.
 */
import { describe, it, expect } from 'vitest';
import { besselJ, besselY, chebyshevT, laguerreL, legendreP } from '../src/typed/special.js';
import { MAX_CHEBYSHEV_ORDER } from '../src/utils/limits.js';
import { bernoulli, catalan, zeros } from '../src/index.js';
import { siegelZ } from '../src/special/wave-functions.js';
import { sphericalHarmonic } from '../src/special/angular-momentum.js';
import { mathieuA, mathieuB, mathieuCe, mathieuSe } from '../src/special/mathieu.js';
import { rootsHermite, rootsLaguerre } from '../src/numeric/gauss-nodes-extra.js';
import {
  symTridiagEigenvalue,
  symTridiagEigenvalues,
  symTridiagEigenvector,
} from '../src/numeric/tridiagonal-eigen.js';
import { workerKernel } from '../src/typed/worker-kernels.js';
import { besselYnJS } from '../src/wasm/special/wasm-bridge.js';
import {
  sphericalBesselJ,
  sphericalBesselI,
  sphericalBesselK,
  sphericalBesselY,
} from '../src/special/spherical-bessel.js';

/** Relative error |a / b - 1|. */
const rel = (a: number, b: number) => Math.abs(a / b - 1);
const bernoulliNumber = (n: number): number => bernoulli(n) as number;
const catalanNumber = (n: number): number => catalan(n) as number;

describe('#1116 Bessel and Chebyshev results that were NaN', () => {
  describe('besselJ(nu, x) for a real order nu > 0 and a tiny x', () => {
    it('besselJ(0.5, 1e-300) matches mpmath', () => {
      expect(rel(besselJ(0.5, 1e-300) as number, 7.978845608028654e-151)).toBeLessThan(1e-14);
    });
    it('besselJ(2.5, 1e-300) is 0 (the true value 5.3e-752 underflows)', () => {
      expect(besselJ(2.5, 1e-300)).toBe(0);
    });
    it('besselJ(1.5, 1e-150) matches mpmath', () => {
      expect(rel(besselJ(1.5, 1e-150) as number, 2.659615202676218e-226)).toBeLessThan(2e-14);
    });
    it('besselJ(0.5, 1e-20) matches mpmath', () => {
      expect(rel(besselJ(0.5, 1e-20) as number, 7.978845608028654e-11)).toBeLessThan(1e-14);
    });
    it('the worker kernel of besselJ gives the same value as the scalar', () => {
      const kernel = new Function(`return ${workerKernel('besselJ', 0.5)}`)() as (
        x: number
      ) => number;
      expect(rel(kernel(1e-300), 7.978845608028654e-151)).toBeLessThan(1e-14);
      expect(kernel(1e-300)).toBe(besselJ(0.5, 1e-300));
      expect(kernel(1e-20)).toBe(besselJ(0.5, 1e-20));
    });
    it('the worker kernel of besselY still evaluates (it lists besselJRealOrder)', () => {
      const kernel = new Function(`return ${workerKernel('besselY', 0.5)}`)() as (
        x: number
      ) => number;
      expect(kernel(1e-3)).toBe(besselY(0.5, 1e-3));
    });
  });

  describe('sphericalBesselJ and sphericalBesselI for a tiny x', () => {
    it('sphericalBesselJ(1, 1e-300) matches mpmath', () => {
      expect(rel(sphericalBesselJ(1, 1e-300), 3.3333333333333334e-301)).toBeLessThan(1e-15);
    });
    it('sphericalBesselJ(3, 1e-300) is 0 (the true value underflows)', () => {
      expect(sphericalBesselJ(3, 1e-300)).toBe(0);
    });
    it('sphericalBesselJ(3, 1e-100) matches mpmath', () => {
      expect(rel(sphericalBesselJ(3, 1e-100), 9.523809523809524e-303)).toBeLessThan(1e-14);
    });
    it('sphericalBesselI(1, 1e-300) matches mpmath', () => {
      expect(rel(sphericalBesselI(1, 1e-300), 3.3333333333333334e-301)).toBeLessThan(1e-15);
    });
    it('sphericalBesselI(2, 1e-300) is 0 (the true value underflows)', () => {
      expect(sphericalBesselI(2, 1e-300)).toBe(0);
    });
    it('sphericalBesselJ(5, 0.5) matches mpmath (series path, normal x)', () => {
      expect(rel(sphericalBesselJ(5, 0.5), 2.9774668754574457e-6)).toBeLessThan(1e-14);
    });
    it('a negative x keeps the parity (-1)^n', () => {
      expect(sphericalBesselJ(1, -1e-300)).toBe(-sphericalBesselJ(1, 1e-300));
      expect(sphericalBesselJ(2, -0.5)).toBe(sphericalBesselJ(2, 0.5));
      expect(sphericalBesselI(1, -1e-300)).toBe(-sphericalBesselI(1, 1e-300));
    });
  });

  describe('sphericalBesselY overflow', () => {
    it('sphericalBesselY(50, 1e-10) is -Infinity', () => {
      expect(sphericalBesselY(50, 1e-10)).toBe(-Infinity);
    });
    it('sphericalBesselY(20, 1e-10) is finite and matches mpmath (control)', () => {
      expect(rel(sphericalBesselY(20, 1e-10), -3.1983098677287777e233)).toBeLessThan(1e-13);
    });
    it('sphericalBesselY keeps the parity y_n(-x) = (-1)^(n+1) y_n(x) at overflow', () => {
      expect(sphericalBesselY(51, -1e-10)).toBe(-Infinity);
      expect(sphericalBesselY(50, -1e-10)).toBe(Infinity);
    });
    it('sphericalBesselY(400, 1) is -Infinity (SciPy spherical_yn gives -inf)', () => {
      expect(sphericalBesselY(400, 1)).toBe(-Infinity);
    });
  });

  describe('sphericalBesselI for a large x', () => {
    it('sphericalBesselI(1000, 1000) matches mpmath', () => {
      expect(rel(sphericalBesselI(1000, 1000), 6.9454341175993605e227)).toBeLessThan(1e-12);
    });
    it('sphericalBesselI(5000, 1000) is 0 (the true value 8.4e-2812 underflows)', () => {
      expect(sphericalBesselI(5000, 1000)).toBe(0);
    });
    it('sphericalBesselI(10, 800) is Infinity (the true value 1.59e344 overflows)', () => {
      expect(sphericalBesselI(10, 800)).toBe(Infinity);
    });
    it('sphericalBesselI(1001, -1000) is the negative of sphericalBesselI(1001, 1000)', () => {
      const v = sphericalBesselI(1001, 1000);
      expect(Number.isFinite(v)).toBe(true);
      expect(sphericalBesselI(1001, -1000)).toBe(-v);
    });
  });

  describe('sphericalBesselK for a large x', () => {
    it('sphericalBesselK(1000, 1000) matches mpmath', () => {
      expect(rel(sphericalBesselK(1000, 1000), 7.994050611016102e-235)).toBeLessThan(1e-12);
    });
    it('sphericalBesselK(3, 800) is 0 (the true value 7.3e-351 underflows)', () => {
      expect(sphericalBesselK(3, 800)).toBe(0);
    });
    it('sphericalBesselK(0, 1000) is 0 (the true value 8e-438 underflows)', () => {
      expect(sphericalBesselK(0, 1000)).toBe(0);
    });
    it('sphericalBesselK(1e8, 1e9) is 0 at once: the upper bound of k_n is below the smallest double', () => {
      expect(sphericalBesselK(1e8, 1e9)).toBe(0);
    });
    it('sphericalBesselK(1e8, Infinity) is 0 at once', () => {
      expect(sphericalBesselK(1e8, Infinity)).toBe(0);
    });
    it('sphericalBesselK(n, x) with n near x is 0 at once (the sweep took 19 s at n = x = 1.8e9)', () => {
      // True value exp(-0.53 x): far below the smallest double. The default test timeout is 5 s.
      expect(sphericalBesselK(1.8e9, 1.8e9)).toBe(0);
      expect(sphericalBesselK(1.7e9, 1.8e9)).toBe(0);
    });
    it('the upper bound lets a value near the underflow edge pass (mpmath)', () => {
      // k_347(800) = 1.3414e-318 and k_346(800) = 8.8052e-319 are subnormal doubles.
      expect(rel(sphericalBesselK(347, 800), 1.3414e-318)).toBeLessThan(1e-4);
      expect(rel(sphericalBesselK(346, 800), 8.8052e-319)).toBeLessThan(1e-4);
    });
  });

  describe('chebyshevT for |x| > 1 after the overflow', () => {
    it('chebyshevT(1000, 1.5) is Infinity', () => {
      expect(chebyshevT(1000, 1.5)).toBe(Infinity);
    });
    it('chebyshevT(1001, -1.5) is -Infinity', () => {
      expect(chebyshevT(1001, -1.5)).toBe(-Infinity);
    });
    it('chebyshevT(1000, -1.5) is Infinity', () => {
      expect(chebyshevT(1000, -1.5)).toBe(Infinity);
    });
    it('chebyshevT(2, 1e200) and chebyshevT(3, -1e200) overflow with the right sign (pins)', () => {
      expect(chebyshevT(2, 1e200)).toBe(Infinity);
      expect(chebyshevT(3, -1e200)).toBe(-Infinity);
    });
    it('chebyshevT(10, 1.5) is exact (control)', () => {
      expect(rel(chebyshevT(10, 1.5) as number, 7563.5)).toBeLessThan(1e-14);
    });
    it('the Float64Array form gives the same overflow values', () => {
      expect(Array.from(chebyshevT(1000, new Float64Array([1.5, -1.5])) as Float64Array)).toEqual([
        Infinity,
        Infinity,
      ]);
      expect(Array.from(chebyshevT(1001, new Float64Array([1.5, -1.5])) as Float64Array)).toEqual([
        Infinity,
        -Infinity,
      ]);
    });
  });
});

describe('#1132 besselJ and besselY: one work bound per array call', () => {
  const fill = (len: number, v: number) => new Float64Array(len).fill(v);

  it('besselY(2.4e9, 1024 elements at 5e9) throws a RangeError before any recurrence runs', () => {
    expect(() => besselY(2.4e9, fill(1024, 5e9))).toThrow(RangeError);
  });
  it('besselJ(2.4e9, 1024 elements at 5e9) throws a RangeError before any recurrence runs', () => {
    expect(() => besselJ(2.4e9, fill(1024, 5e9))).toThrow(RangeError);
  });
  it('besselJ and besselY with 2 elements (below the array threshold) throw too', () => {
    expect(() => besselJ(2.4e9, fill(2, 5e9))).toThrow(RangeError);
    expect(() => besselY(2.4e9, fill(2, 5e9))).toThrow(RangeError);
  });
  it('the message names the order, the element count and the per-call maximum', () => {
    expect(() => besselJ(2.4e9, fill(1024, 5e9))).toThrow(
      /besselJ: order 2400000000 over 1024 elements needs about \d+ recurrence steps, above the supported maximum of 2500000000 per call/
    );
  });
  it('a downward sweep over many elements throws (x just below n)', () => {
    expect(() => besselJ(5e8, fill(8, 5e8 - 1))).toThrow(/per call/);
  });
  it('an element with its own limit error keeps its own message', () => {
    expect(() => besselJ(3e9, fill(4, 5e9))).toThrow(/besselJ: n = 3000000000 exceeds/);
    // x = 5 would give -Infinity at once (Y_3e9(5) is below -1e308, bound before the limit, #1331).
    expect(() => besselY(3e9, fill(2048, 3e9))).toThrow(/besselY: n = 3000000000 exceeds/);
    expect(Array.from(besselY(3e9, fill(4, 5)) as Float64Array)).toEqual([
      -Infinity,
      -Infinity,
      -Infinity,
      -Infinity,
    ]);
  });
  it('besselJ(2.4e9, 2048 elements at 1000) is 0 for every element (zero bound, no steps)', () => {
    const r = besselJ(2.4e9, fill(2048, 1000)) as Float64Array;
    expect(r.length).toBe(2048);
    expect(r.every((v) => v === 0)).toBe(true);
  });
  it('besselY(2e9, 2048 elements at 1) equals the scalar rule (overflow exit, about 200 steps)', () => {
    const r = besselY(2e9, fill(2048, 1)) as Float64Array;
    const want = besselYnJS(2e9, fill(2048, 1));
    expect(r.every((v, i) => Object.is(v, want[i]))).toBe(true);
    expect(r.every((v) => v === -Infinity)).toBe(true);
  });
  it('besselJ(5, [1, 2, 3]) equals the scalars', () => {
    const r = besselJ(5, new Float64Array([1, 2, 3])) as Float64Array;
    expect(Array.from(r)).toEqual([besselJ(5, 1), besselJ(5, 2), besselJ(5, 3)]);
  });
  it('a total below the maximum passes: besselJ(2, 1e6 elements) runs', () => {
    const r = besselJ(2, fill(1_000_000, 0.5)) as Float64Array;
    expect(r.length).toBe(1_000_000);
  });
});

describe('#1290 chebyshevT, legendreP and laguerreL: one work bound per array call', () => {
  const fill = (len: number, v: number) => new Float64Array(len).fill(v);

  it('chebyshevT(2e9, 4 elements at 0.5) throws a RangeError about the per-call bound', () => {
    expect(() => chebyshevT(2e9, fill(4, 0.5))).toThrow(RangeError);
    expect(() => chebyshevT(2e9, fill(4, 0.5))).toThrow(/per call/);
  });
  it('legendreP(1.3e9, 2 elements at 0.5) throws a RangeError about the per-call bound', () => {
    expect(() => legendreP(1.3e9, fill(2, 0.5))).toThrow(
      /legendreP: order 1300000000 over 2 elements/
    );
  });
  it('laguerreL(6e8, 2 elements at 0.5) throws a RangeError about the per-call bound', () => {
    expect(() => laguerreL(6e8, fill(2, 0.5))).toThrow(
      /laguerreL: order 600000000 over 2 elements/
    );
  });
  it('chebyshevT(3e9, 1000 elements at 1.5) is Infinity for every element (overflow exit)', () => {
    const r = chebyshevT(3e9, fill(1000, 1.5)) as Float64Array;
    expect(r.every((v) => v === Infinity)).toBe(true);
  });
  it('chebyshevT(3e9, [1.5, -1.5]) is Infinity for both (an even order)', () => {
    const r = chebyshevT(3e9, new Float64Array([1.5, -1.5])) as Float64Array;
    expect(Array.from(r)).toEqual([Infinity, Infinity]);
  });
  it('legendreP(2e9, 4 elements at 1.5) ends at the first overflow and does not throw', () => {
    const r = legendreP(2e9, fill(4, 1.5)) as Float64Array;
    expect(r.length).toBe(4);
    expect(r.every((v) => !Number.isFinite(v))).toBe(true);
  });
  it('legendreP(1e6, [0.3, 0.4]) equals the two scalars', () => {
    const r = legendreP(1e6, new Float64Array([0.3, 0.4])) as Float64Array;
    expect(Array.from(r)).toEqual([legendreP(1e6, 0.3), legendreP(1e6, 0.4)]);
  });
  it('chebyshevT(1000, 1000 elements at 0.5) is -0.5 for every element (1e6 steps, no scan)', () => {
    const r = chebyshevT(1000, fill(1000, 0.5)) as Float64Array;
    expect(r.every((v) => Math.abs(v + 0.5) < 1e-12)).toBe(true);
  });
  it('a NaN element counts no steps: chebyshevT(3e9, 4 NaN elements) is NaN', () => {
    const r = chebyshevT(3e9, fill(4, NaN)) as Float64Array;
    expect(r.every((v) => Number.isNaN(v))).toBe(true);
  });
  it('an order above the scalar limit keeps the message of the scalar', () => {
    expect(() => chebyshevT(5e9, fill(2, 0.5))).toThrow(/chebyshevT: n = 5000000000 exceeds/);
    expect(() => laguerreL(2e9, fill(2, 0.5))).toThrow(/laguerreL: n = 2000000000 exceeds/);
  });
  it('the chebyshevT worker kernel carries the limit of utils/limits.ts', () => {
    expect(workerKernel('chebyshevT', 5)).toContain(String(MAX_CHEBYSHEV_ORDER));
  });
});

describe('#1102 range losses: bernoulli, catalan, siegelZ, sphericalBesselY, sphericalHarmonic', () => {
  it('bernoulliNumber(198), (200) and (258) are finite and match mpmath', () => {
    expect(rel(bernoulliNumber(198), 3.617609027237286e212)).toBeLessThan(1e-13);
    expect(rel(bernoulliNumber(200), -3.647077264519136e215)).toBeLessThan(1e-13);
    expect(rel(bernoulliNumber(258), 1.3352784187354634e306)).toBeLessThan(1e-13);
  });
  it('bernoulli is continuous across the switch of method (190, 192, 196)', () => {
    expect(rel(bernoulliNumber(190), 4.292841379140298e200)).toBeLessThan(1e-13);
    expect(rel(bernoulliNumber(192), -3.987674496823221e203)).toBeLessThan(1e-13);
    expect(rel(bernoulliNumber(196), -3.661423368368119e209)).toBeLessThan(1e-13);
  });
  it('bernoulliNumber(260) stays -Infinity and bernoulliNumber(20) keeps its exact pin', () => {
    expect(bernoulliNumber(260)).toBe(-Infinity);
    expect(bernoulliNumber(20)).toBe(-529.1242424242421);
  });

  it('catalanNumber(141), (300) and (519) are finite and match the exact integer', () => {
    expect(rel(catalanNumber(141), 2.597771382055171e81)).toBeLessThan(1e-14);
    expect(rel(catalanNumber(300), 4.4886359467174175e176)).toBeLessThan(1e-14);
    expect(rel(catalanNumber(519), 1.4023904365091493e308)).toBeLessThan(1e-14);
  });
  it('catalanNumber(520) is Infinity, and catalanNumber(30) is the exact integer', () => {
    expect(catalanNumber(520)).toBe(Infinity);
    expect(catalanNumber(1e9)).toBe(Infinity);
    expect(catalanNumber(30)).toBe(3814986502092304);
    expect(catalanNumber(10)).toBe(16796);
  });

  it('siegelZ beyond the Borwein range matches mpmath', () => {
    expect(Math.abs(siegelZ(55) - 2.8032775129841925)).toBeLessThan(1e-12);
    expect(Math.abs(siegelZ(60) - 0.5869504907108744)).toBeLessThan(1e-12);
    expect(Math.abs(siegelZ(100) - 2.692697056664463)).toBeLessThan(1e-12);
    expect(Math.abs(siegelZ(1000) - 0.9977946375215866)).toBeLessThan(1e-10);
    expect(Math.abs(siegelZ(1e4) - -0.34139472423120854)).toBeLessThan(1e-9);
    expect(Math.abs(siegelZ(1e6) - -2.8061338784306984)).toBeLessThan(1e-8);
  });
  it('siegelZ is continuous at the change of method (t = 40) and even', () => {
    expect(Math.abs(siegelZ(40) - -1.3088823934565992)).toBeLessThan(1e-12);
    expect(Math.abs(siegelZ(40.000001) - -1.3088812474433555)).toBeLessThan(1e-12);
    expect(Math.abs(siegelZ(41) - 0.11988453570872165)).toBeLessThan(1e-12);
    expect(siegelZ(-60)).toBe(siegelZ(60));
  });
  it('siegelZ above its limit throws a RangeError that names the limit', () => {
    expect(() => siegelZ(1e12)).toThrow(RangeError);
    expect(() => siegelZ(1e12)).toThrow(
      /siegelZ: \|t\| = 1000000000000 exceeds the supported maximum of/
    );
    expect(siegelZ(Infinity)).toBeNaN();
  });

  it('sphericalBesselY(400, 1) is -Infinity (the true value is -4.67e987)', () => {
    expect(sphericalBesselY(400, 1)).toBe(-Infinity);
  });

  it('sphericalHarmonic with l + |m| above 170 matches mpmath', () => {
    const a = sphericalHarmonic(200, 0, 1, 1);
    expect(rel(a.re, 0.07676429162435205)).toBeLessThan(1e-12);
    expect(a.im).toBe(0);
    const b = sphericalHarmonic(100, 100, 1, 1);
    expect(rel(b.re, 2.6122613842772793e-8)).toBeLessThan(1e-12);
    expect(rel(b.im, -1.5339562348747204e-8)).toBeLessThan(1e-12);
    const c = sphericalHarmonic(100, -100, 1, 1);
    expect(rel(c.re, 2.6122613842772793e-8)).toBeLessThan(1e-12);
    expect(rel(c.im, 1.5339562348747204e-8)).toBeLessThan(1e-12);
    const d = sphericalHarmonic(500, 250, 1, 1);
    expect(rel(d.re, 0.08775236132841563)).toBeLessThan(1e-12);
    expect(rel(d.im, -0.35340356184244176)).toBeLessThan(1e-12);
  });
  it('sphericalHarmonic is continuous across l + |m| = 170 (the change of method)', () => {
    const a = sphericalHarmonic(171, 0, 1, 1);
    expect(rel(a.re, 0.16717176690401456)).toBeLessThan(1e-12);
    const b = sphericalHarmonic(100, 71, 1, 1);
    expect(rel(b.re, 0.02965853223672696)).toBeLessThan(1e-12);
    expect(rel(b.im, -0.0912777039405189)).toBeLessThan(1e-12);
    const c = sphericalHarmonic(85, 85, 1, 1);
    expect(rel(c.re, 3.8143474816090086e-7)).toBeLessThan(1e-13);
    expect(rel(c.im, 6.822729917767806e-8)).toBeLessThan(1e-13);
  });
  it('sphericalHarmonic at the poles: m = 0 is sqrt((2l+1)/4pi), m != 0 is 0', () => {
    const a = sphericalHarmonic(200, 0, 0, 0);
    expect(rel(a.re, 5.648943803041858)).toBeLessThan(1e-13);
    expect(a.im).toBe(0);
    const b = sphericalHarmonic(200, 3, 0, 0);
    expect(b.re).toBe(0);
    expect(b.im).toBe(0);
    const c = sphericalHarmonic(200, 0, Math.PI, 0);
    expect(rel(c.re, 5.648943803041858)).toBeLessThan(1e-13);
  });
});

describe('#1102 range losses: Gauss rules of high degree (Golub-Welsch)', () => {
  it('rootsHermite(200) matches SciPy roots_hermite', () => {
    const { nodes, weights } = rootsHermite(200);
    expect(nodes.length).toBe(200);
    expect(rel(nodes[0], -19.33924866791141)).toBeLessThan(1e-12);
    expect(rel(nodes[100], 0.07844190391741279)).toBeLessThan(1e-12);
    expect(rel(weights[0], 2.229093496280268e-163)).toBeLessThan(1e-11);
    expect(rel(weights[100], 0.15592224233010094)).toBeLessThan(1e-11);
    expect(
      rel(
        weights.reduce((a, b) => a + b, 0),
        Math.sqrt(Math.PI)
      )
    ).toBeLessThan(1e-13);
  });
  it('rootsHermite is symmetric and ascending', () => {
    const { nodes, weights } = rootsHermite(51);
    expect(nodes[25]).toBe(0);
    for (let i = 0; i < 25; i++) {
      expect(nodes[i]).toBe(-nodes[50 - i]);
      expect(weights[i]).toBe(weights[50 - i]);
      expect(nodes[i]).toBeLessThan(nodes[i + 1]);
    }
  });
  it('rootsHermite(2) keeps its nodes', () => {
    const { nodes } = rootsHermite(2);
    expect(Math.abs(nodes[0] - -0.7071067811865476)).toBeLessThan(1e-15);
    expect(Math.abs(nodes[1] - 0.7071067811865476)).toBeLessThan(1e-15);
  });
  it('rootsLaguerre(1000) matches mpmath', () => {
    const { nodes, weights } = rootsLaguerre(1000);
    expect(nodes.length).toBe(1000);
    expect(rel(nodes[0], 0.0014450740675415123)).toBeLessThan(1e-10);
    expect(rel(weights[0], 0.003703171934719189)).toBeLessThan(1e-10);
    expect(rel(nodes[499], 651.7158828349023)).toBeLessThan(1e-14);
    expect(rel(weights[499], 2.547161481169928e-283)).toBeLessThan(1e-11);
    expect(rel(nodes[999], 3943.247394845271)).toBeLessThan(1e-14);
    expect(weights[999]).toBe(0);
  });
  it('rootsLaguerre(1000) integrates x^k / k! to 1 for k = 0, 1, 2, 5, 10', () => {
    const { nodes, weights } = rootsLaguerre(1000);
    for (const k of [0, 1, 2, 5, 10]) {
      let factorial = 1;
      for (let i = 2; i <= k; i++) factorial *= i;
      let s = 0;
      for (let i = 0; i < nodes.length; i++) s += (weights[i] * nodes[i] ** k) / factorial;
      expect(Math.abs(s - 1)).toBeLessThan(1e-12);
    }
  });
  it('rootsLaguerre(20, 1.5) matches SciPy roots_genlaguerre', () => {
    const { nodes, weights } = rootsLaguerre(20, 1.5);
    expect(rel(nodes[0], 0.23778714350283628)).toBeLessThan(1e-13);
    expect(rel(weights[0], 0.03193042654377361)).toBeLessThan(1e-13);
    expect(rel(nodes[19], 69.29557082823865)).toBeLessThan(1e-13);
    expect(rel(weights[19], 6.0655273433137666e-27)).toBeLessThan(1e-11);
    expect(
      rel(
        weights.reduce((a, b) => a + b, 0),
        1.329340388179137
      )
    ).toBeLessThan(1e-13);
  });
  it('a degree above the limit throws a RangeError', () => {
    expect(() => rootsHermite(1e9)).toThrow(RangeError);
    expect(() => rootsLaguerre(1e9)).toThrow(RangeError);
  });
  it('rootsHermite and rootsLaguerre still reject a bad degree or exponent', () => {
    expect(() => rootsHermite(0)).toThrow(RangeError);
    expect(() => rootsLaguerre(3, -1)).toThrow(RangeError);
  });
});

describe('#1102 range losses: 3-D zeros (fixed by batch D, pinned here)', () => {
  it('zeros(2, 3, 4) has the size [2, 3, 4]', () => {
    expect((zeros(2, 3, 4) as { size(): number[] }).size()).toEqual([2, 3, 4]);
  });
  it('zeros(1e4, 1e4, 1e4) throws the size RangeError before it allocates', () => {
    expect(() => zeros(1e4, 1e4, 1e4)).toThrow(RangeError);
    expect(() => zeros(1e4, 1e4, 1e4)).toThrow(/too large/);
  });
});

describe('tridiagonal-eigen: symTridiagEigenvalues, symTridiagEigenvalue and symTridiagEigenvector', () => {
  it('the 1D Laplacian has the eigenvalues 2 - 2 cos(k pi / (n + 1))', () => {
    const n = 40;
    const values = symTridiagEigenvalues(new Array(n).fill(2), new Array(n - 1).fill(-1));
    for (let k = 1; k <= n; k++) {
      expect(Math.abs(values[k - 1] - (2 - 2 * Math.cos((k * Math.PI) / (n + 1))))).toBeLessThan(
        1e-14
      );
    }
  });
  it('the Sturm bisection gives the same eigenvalue as the QL method', () => {
    const d = [3, -1, 4, 1, -5, 9, 2, -6, 5, 3];
    const e = [1, 2, -1, 0.5, 3, -2, 1, 1, 0.25];
    const values = symTridiagEigenvalues(d, e);
    for (let k = 0; k < d.length; k++) {
      expect(Math.abs(symTridiagEigenvalue(d, e, k) - values[k])).toBeLessThan(1e-13);
    }
  });
  it('a 1 x 1 matrix is its entry, and a 2 x 2 matrix has the closed form', () => {
    expect(symTridiagEigenvalues([7], [])).toEqual([7]);
    expect(symTridiagEigenvalue([7], [], 0)).toBe(7);
    const values = symTridiagEigenvalues([2, 2], [1]);
    expect(Math.abs(values[0] - 1)).toBeLessThan(1e-15);
    expect(Math.abs(values[1] - 3)).toBeLessThan(1e-15);
  });
  it('a diagonal matrix (zero off-diagonal) returns the sorted diagonal', () => {
    expect(symTridiagEigenvalues([3, 1, 2], [0, 0])).toEqual([1, 2, 3]);
    expect(symTridiagEigenvalue([3, 1, 2], [0, 0], 1)).toBeCloseTo(2, 14);
  });
  it('a wrong shape or index throws a RangeError', () => {
    expect(() => symTridiagEigenvalues([1, 2], [])).toThrow(RangeError);
    expect(() => symTridiagEigenvalues([], [])).toThrow(RangeError);
    expect(() => symTridiagEigenvalue([1, 2], [1], 2)).toThrow(RangeError);
    expect(() => symTridiagEigenvalue([1, NaN], [1], 0)).toThrow(RangeError);
    expect(() => symTridiagEigenvector([1, 2], [], 1)).toThrow(RangeError);
    expect(() => symTridiagEigenvector([1, NaN], [1], 1)).toThrow(RangeError);
    expect(() => symTridiagEigenvector([1, 2], [1], NaN)).toThrow(RangeError);
  });
  it('the eigenvector of the 1D Laplacian is a sine, for the first, a middle and the last eigenvalue', () => {
    const n = 31;
    const d = new Array(n).fill(2);
    const e = new Array(n - 1).fill(-1);
    for (const k of [1, 12, 31]) {
      const lambda = 2 - 2 * Math.cos((k * Math.PI) / (n + 1));
      const v = symTridiagEigenvector(d, e, symTridiagEigenvalue(d, e, k - 1));
      let dot = 0;
      let norm = 0;
      for (let i = 0; i < n; i++) {
        const s = Math.sin(((i + 1) * k * Math.PI) / (n + 1));
        dot += v[i] * s;
        norm += s * s;
      }
      expect(Math.abs(Math.abs(dot) / Math.sqrt(norm) - 1)).toBeLessThan(1e-13);
      expect(Math.abs(symTridiagEigenvalue(d, e, k - 1) - lambda)).toBeLessThan(1e-14);
    }
  });
  it('the eigenvector has a small residual for a matrix with entries of very different size', () => {
    const d = [3, -1, 4, 1, -5, 9, 2, -6, 5, 3, 1e6, -1e6];
    const e = [1, 2, -1, 0.5, 3, -2, 1, 1, 0.25, 7, 1e3];
    for (let k = 0; k < d.length; k++) {
      const lambda = symTridiagEigenvalue(d, e, k);
      const v = symTridiagEigenvector(d, e, lambda);
      let norm = 0;
      let residual = 0;
      for (let i = 0; i < d.length; i++) {
        let tv = d[i] * v[i];
        if (i > 0) tv += e[i - 1] * v[i - 1];
        if (i < d.length - 1) tv += e[i] * v[i + 1];
        residual = Math.max(residual, Math.abs(tv - lambda * v[i]));
        norm += v[i] * v[i];
      }
      expect(Math.abs(norm - 1), `k = ${k}`).toBeLessThan(1e-14);
      expect(residual, `k = ${k}`).toBeLessThan(1e-9);
    }
  });
  it('a diagonal matrix gives a unit vector, and a 1 x 1 matrix gives [1]', () => {
    const v = symTridiagEigenvector([3, 1, 2], [0, 0], 2);
    expect(Math.abs(v[2])).toBe(1);
    expect(v[0]).toBeCloseTo(0, 12);
    expect(v[1]).toBeCloseTo(0, 12);
    expect(Array.from(symTridiagEigenvector([7], [], 7))).toEqual([1]);
  });
});

describe('#1105 mathieuA and mathieuB at large q', () => {
  it('mathieuA(n, q) for q = 1e6 and 1e8 matches the tridiagonal eigenvalue (SciPy)', () => {
    expect(rel(mathieuA(3, 1e6), -1986006.2528470953)).toBeLessThan(1e-13);
    expect(rel(mathieuA(3, 1e8), -199860006.2502844)).toBeLessThan(1e-13);
    expect(rel(mathieuA(0, 1e6), -1998000.2500312617)).toBeLessThan(1e-13);
  });
  it('mathieuA(99, q) at large q needs thousands of harmonics and matches SciPy', () => {
    expect(rel(mathieuA(99, 1e8), -196024956.42641017)).toBeLessThan(1e-12);
    expect(rel(mathieuA(99, 1e9), -1987419087.1115198)).toBeLessThan(1e-12);
  });
  it('mathieuA(3, 1e10) / 1e10 and mathieuA(3, 1e100) follow the asymptotic series', () => {
    expect(rel(mathieuA(3, 1e10) / 1e10, -1.9998600006250027)).toBeLessThan(1e-14);
    expect(mathieuA(3, 1e100)).toBe(-2e100);
  });
  it('mathieuB(n, 1e6) matches SciPy', () => {
    expect(rel(mathieuB(3, 1e6), -1990003.251094726)).toBeLessThan(1e-13);
    expect(rel(mathieuB(4, 1e6), -1986006.2528470969)).toBeLessThan(1e-13);
  });
  it('a negative q follows DLMF 28.2.21: a_3(-q) = b_3(q)', () => {
    expect(mathieuA(3, -1e6)).toBe(mathieuB(3, 1e6));
    expect(rel(mathieuA(3, -5), mathieuB(3, 5))).toBeLessThan(1e-12);
    expect(rel(mathieuB(3, -5), mathieuA(3, 5))).toBeLessThan(1e-12);
    expect(rel(mathieuA(4, -5), mathieuA(4, 5))).toBeLessThan(1e-12);
  });
  it('the two methods agree at the change of method (|q| = 1e5)', () => {
    expect(rel(mathieuA(0, 99999), -199365.7977291912)).toBeLessThan(1e-13);
    expect(rel(mathieuA(0, 1e5), -199367.79456690454)).toBeLessThan(1e-13);
    expect(rel(mathieuA(7, 99999), -190539.54958944966)).toBeLessThan(1e-13);
    expect(rel(mathieuA(7, 1e5), -190541.50215473777)).toBeLessThan(1e-13);
    expect(rel(mathieuB(1, 1e5), -199367.79456690466)).toBeLessThan(1e-13);
  });
  it('mathieuA(99, q) agrees with SciPy on both sides of the change of method (10 s^4 = 1.5682e10)', () => {
    expect(rel(mathieuA(99, 1.568e10), -31310167467.659313)).toBeLessThan(1e-13);
    expect(rel(mathieuA(99, 1.5685e10), -31320159522.265316)).toBeLessThan(1e-13);
  });
  it('mathieuA and mathieuB match SciPy at small q and high order', () => {
    expect(rel(mathieuA(99, 1), 9801.00005102041)).toBeLessThan(1e-12);
    expect(rel(mathieuA(3, 1e4), -18606.278776913656)).toBeLessThan(1e-12);
    expect(rel(mathieuA(99, 100), 9801.510220693339)).toBeLessThan(1e-12);
    expect(rel(mathieuA(99, 1000), 9852.188092449915)).toBeLessThan(1e-12);
    expect(rel(mathieuA(10, 1000), -729.6779750629651)).toBeLessThan(1e-12);
    expect(rel(mathieuB(100, 1000), 10050.162809813028)).toBeLessThan(1e-12);
    expect(rel(mathieuB(100, 1), 10000.000050005017)).toBeLessThan(1e-12);
  });
  it('q = 0 gives n squared exactly, and a non-finite q follows the limit', () => {
    expect(mathieuA(0, 0)).toBe(0);
    expect(mathieuA(5, 0)).toBe(25);
    expect(mathieuB(4, 0)).toBe(16);
    expect(mathieuA(3, Infinity)).toBe(-Infinity);
    expect(mathieuB(3, -Infinity)).toBe(-Infinity);
    expect(mathieuA(3, NaN)).toBeNaN();
  });
  it('the order limits keep their messages', () => {
    expect(() => mathieuA(100, 1)).toThrow('order n must be at most 99, got 100');
    expect(() => mathieuB(101, 1)).toThrow('order n must be at most 100, got 101');
  });
});

describe('#1289 besselY: an overflow is -Infinity, not NaN', () => {
  it('besselY(n, x) is -Infinity where the upward recurrence leaves the double range', () => {
    // Y_n(1) is below -1.797e308 from n = 152. The recurrence reached NaN at n = 154.
    for (const [n, x] of [
      [152, 1],
      [154, 1],
      [200, 1],
      [400, 1],
      [300, 5],
      [1000, 100],
      [3, 1e-310],
    ]) {
      expect(besselY(n, x), `besselY(${n}, ${x})`).toBe(-Infinity);
    }
  });
  it('besselY(400.5, 1) is -Infinity (real order)', () => {
    expect(besselY(400.5, 1)).toBe(-Infinity);
    expect(besselY(152.5, 1)).toBe(-Infinity);
  });
  it('a negative odd integer order flips the sign: besselY(-401, 1) is +Infinity', () => {
    expect(besselY(-401, 1)).toBe(Infinity);
    expect(besselY(-400, 1)).toBe(-Infinity);
  });
  it('besselY(400, [1, 2]) is [-Infinity, -Infinity]', () => {
    const r = besselY(400, new Float64Array([1, 2])) as Float64Array;
    expect(Array.from(r)).toEqual([-Infinity, -Infinity]);
  });
  it('a huge order ends at once: besselY(1e9, 1) is -Infinity', () => {
    expect(besselY(1e9, 1)).toBe(-Infinity);
  });
  it('the values below the overflow keep their digits (mpmath)', () => {
    expect(rel(besselY(150, 1) as number, -1.733326253073777e305)).toBeLessThan(1e-13);
    expect(rel(besselY(151, 1) as number, -5.199920593251399e307)).toBeLessThan(1e-13);
    expect(rel(besselY(150.5, 1) as number, -2.999691509002089e306)).toBeLessThan(1e-13);
    expect(rel(besselY(260, 20) as number, -6.900884357849415e253)).toBeLessThan(1e-13);
  });
  it('a real order at x >= 2 and at a huge order is -Infinity, not NaN (mpmath: -1e796, -7e2388, ...)', () => {
    // The downward recurrence of besselJYTemme overflowed for nu / x above about 150.
    for (const [nu, x] of [
      [400.3, 2],
      [400.3, 3],
      [1000.3, 3],
      [1000.3, 50],
      [3000.3, 90],
    ]) {
      expect(besselY(nu, x), `besselY(${nu}, ${x})`).toBe(-Infinity);
    }
    expect(besselJ(300.5, 1)).toBe(0);
    expect(besselJ(1000.3, 3)).toBe(0);
  });
  it('a negative real order: the sign of the overflow, and the exact zero of cos at a half-integer', () => {
    expect(besselY(-400.3, 1)).toBe(-Infinity);
    expect(besselY(-400.7, 1)).toBe(Infinity);
    expect(besselY(-400.5, 1)).toBe(0);
    // These were -1.8e172 and -2.0e9: cos(100.5 pi) is 1e-14 in a double, times a huge Y_nu.
    expect(rel(besselY(-100.5, 1) as number, 5.94003332445e-190)).toBeLessThan(1e-9);
    expect(rel(besselY(-20.5, 1) as number, 6.01429082926e-26)).toBeLessThan(1e-9);
    expect(rel(besselY(-60.5, 2) as number, 1.51700688916e-83)).toBeLessThan(1e-9);
  });
  it('x = Infinity gives the limit 0; a NaN, zero or negative x gives NaN', () => {
    // Y_nu(x) -> 0 as x -> Infinity (the amplitude sqrt(2 / (pi x)) -> 0; mpmath gives 0). The
    // scalar returned NaN from sin(Infinity) before the limit was a rule.
    expect(besselY(1e8, Infinity)).toBe(0);
    expect(besselY(5, NaN)).toBeNaN();
    expect(besselY(400, 0)).toBeNaN();
    expect(besselY(400, -1)).toBeNaN();
  });
});

describe('#1289 mathieuCe and mathieuSe at large q and high order', () => {
  const abs = (a: number, b: number) => Math.abs(a - b);
  it('mathieuSe(100, 1e3, 0.4) uses the harmonics that order 100 needs (SciPy tridiagonal)', () => {
    // The sign is the one of DLMF 28.2(vi), by continuity from q = 0: se'(0, q) > 0.
    expect(abs(mathieuSe(100, 1e3, 0.4), -1.0101290320424767)).toBeLessThan(1e-10);
  });
  it('mathieuCe(0, 1e6, 1.5) has the right sign and size', () => {
    expect(abs(mathieuCe(0, 1e6, 1.5), 0.042019879164098224)).toBeLessThan(1e-10);
  });
  it('mathieuCe(99, 1e8, 1.5) sums thousands of harmonics', () => {
    expect(abs(mathieuCe(99, 1e8, 1.5), -2.1859582726046796)).toBeLessThan(1e-10);
  });
  it('mathieuSe(4, 1e4, 1.2) matches to 1e-10 relative', () => {
    expect(rel(mathieuSe(4, 1e4, 1.2), 7.261328317028637e-4)).toBeLessThan(1e-10);
  });
  it('mathieuCe(40, 100, 0.7) keeps its value (control, SciPy mathieu_cem)', () => {
    expect(abs(mathieuCe(40, 100, 0.7), -0.06035583475937689)).toBeLessThan(1e-10);
  });
  it('a negative q uses the same method', () => {
    expect(abs(mathieuCe(6, -300, 0.3), 1.2418375986375678)).toBeLessThan(1e-10);
    expect(abs(mathieuSe(7, -50, 2.2), -0.9711091395212201)).toBeLessThan(1e-10);
  });
  it('the sign follows DLMF 28.2(vi) (continuity from q = 0): SciPy mathieu_cem and mathieu_sem', () => {
    // The coefficient m of the Fourier series is negative for these (n, q), so a rule that
    // makes it positive returns the opposite sign.
    expect(abs(mathieuCe(3, 25, 0.3), 0.16589139160737623)).toBeLessThan(1e-10);
    expect(abs(mathieuCe(4, 50, 0.3), 0.0585451251669315)).toBeLessThan(1e-10);
    expect(abs(mathieuCe(2, 100, 0.3), 1.0955372765749082e-4)).toBeLessThan(1e-10);
    expect(abs(mathieuSe(7, 50, 0.3), 0.36871769546048205)).toBeLessThan(1e-10);
    expect(abs(mathieuSe(4, 100, 0.3), 5.487317992177143e-4)).toBeLessThan(1e-10);
  });
  it('ce_n(0, q) and the slope of se_n at 0 are positive for every q (DLMF 28.2(vi))', () => {
    // Only |q| <= 30 here: at a large q the mode is exponentially small at x = 0, below rounding,
    // and the sign is read at pi/2 (see anchorSign).
    for (const q of [1, 10, 30, -10, -30]) {
      for (const n of [2, 3, 4, 5, 8, 11]) {
        expect(mathieuCe(n, q, 0)).toBeGreaterThanOrEqual(0);
        const h = 1e-9;
        expect(mathieuSe(n, q, h)).toBeGreaterThan(0);
      }
    }
  });
  it('q = 0 gives the plain trigonometric functions', () => {
    expect(abs(mathieuCe(5, 0, 0.7), Math.cos(3.5))).toBeLessThan(1e-14);
    expect(abs(mathieuSe(4, 0, 0.3), Math.sin(1.2))).toBeLessThan(1e-14);
    expect(abs(mathieuCe(0, 0, 0.9), Math.SQRT1_2)).toBeLessThan(1e-14);
  });
  it('ce_5(x, 1e4) has the norm 1: (1 / pi) times the integral of ce^2 over 0..2 pi', () => {
    const points = 4096;
    let sum = 0;
    for (let i = 0; i < points; i++) sum += mathieuCe(5, 1e4, (2 * Math.PI * i) / points) ** 2;
    expect(abs((sum * 2) / points, 1)).toBeLessThan(1e-9);
  });
  it('a q that needs more than MAX_MATHIEU_HARMONICS harmonics throws a RangeError', () => {
    expect(() => mathieuCe(3, 1e30, 0)).toThrow(RangeError);
    expect(() => mathieuSe(3, 1e30, 0)).toThrow(/harmonics/);
    expect(() => mathieuCe(3, Infinity, 0)).toThrow(RangeError);
    expect(() => mathieuSe(3, -Infinity, 0)).toThrow(RangeError);
  });
  it('a NaN q gives NaN', () => {
    expect(mathieuCe(3, NaN, 0.5)).toBeNaN();
    expect(mathieuSe(3, NaN, 0.5)).toBeNaN();
  });
  it('a mode of more than 100000 coefficients is not cached, and a second call gives the same value', () => {
    // n = 3 and q = 1e16 need 153000 harmonics.
    const first = mathieuCe(3, 1e16, 0.3);
    expect(Number.isFinite(first)).toBe(true);
    expect(mathieuCe(3, 1e16, 0.3)).toBe(first);
  });
  it('a call after 40 other q values gives the same result (the cache is bounded)', () => {
    const first = mathieuCe(3, 7.5, 0.4);
    for (let i = 1; i <= 40; i++) mathieuCe(3, 7.5 + i, 0.4);
    expect(mathieuCe(3, 7.5, 0.4)).toBe(first);
  });
});

describe('code review F1, F3b, F4, F5: values that the review found wrong', () => {
  it('F1: sphericalBesselI at x = 0 is 1 for n = 0 and 0 for n > 0', () => {
    expect(sphericalBesselI(0, 0)).toBe(1);
    expect(sphericalBesselI(3, 0)).toBe(0);
  });

  it('F3b: a negative real order near an overflow keeps the finite cos or sin term', () => {
    expect(rel(besselY(-151.5001, 1) as number, -2.8381551290433205e305)).toBeLessThan(1e-9);
    expect(rel(besselY(-151.4999, 1) as number, 2.8349155690017926e305)).toBeLessThan(1e-9);
    expect(rel(besselY(-152.5, 1) as number, 7.62980592e-315)).toBeLessThan(1e-8);
    expect(rel(besselJ(-152.0001, 1) as number, 4.9362468597371876e306)).toBeLessThan(1e-9);
    expect(rel(besselY(-151.25, 1) as number, 1.5318366649966553e308)).toBeLessThan(1e-9);
    expect(besselY(-152.49, 1)).toBe(-Infinity);
  });

  it('F4: sphericalBesselJ at x = k pi does not normalise by the rounding error of j_0', () => {
    expect(rel(sphericalBesselJ(10, Math.PI), 5.485546590142097e-6)).toBeLessThan(1e-10);
    expect(rel(sphericalBesselJ(10, 2 * Math.PI), 0.0028626898900201633)).toBeLessThan(1e-10);
  });

  it('F5: sphericalBesselI(0, x) is finite while the value is a double', () => {
    expect(rel(sphericalBesselI(0, 712), 1.1592073491493218e306)).toBeLessThan(1e-13);
    expect(rel(sphericalBesselI(0, -712), 1.1592073491493218e306)).toBeLessThan(1e-13);
    expect(sphericalBesselI(0, Infinity)).toBe(Infinity);
  });
});
