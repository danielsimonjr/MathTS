import { describe, expect, it } from 'vitest';
import { expectSame } from './differential.js';
import { pair } from './oracle.js';

/**
 * Adversarial probes for the G08 inverse trig/hyperbolic PR (branch
 * `cursor/g08-inverse-hyperbolic-e21e`, commit 56dafefa, closes #1558/#1559/#1560).
 *
 * The builder ported `acoth`/`acsch`/`asech` from complex.js 2.4.2 and rewrote
 * `asinh`/`acosh`/`atanh` with the same algorithms, then rerouted the off-domain
 * number branches of `acoth`/`acsc`/`asec`/`asech` through the new `Complex`
 * methods. Every case below compares the compat instance with the pinned mathjs
 * 15.3.0 oracle by the parity harness rule (`typeOf` + `format(precision 14)`),
 * except the signed-zero case which must read the raw parts.
 *
 * Each `it` FAILS on the PR head. None is skipped.
 *
 * Compat fixes: `compat/src/complex-js-inverse-hyperbolic.ts` ports complex.js
 * 2.4.2 `sqrt`/`log`/`asin` and the inverse hyperbolic family; instance overrides
 * in `compat/src/index.ts` route parity names through those adapters (native
 * `core`/`functions` unchanged per G08 policy).
 */

type L = Record<string, unknown>;

const C = (l: L, re: number, im: number): unknown =>
  (l.complex as (re: number, im: number) => unknown)(re, im);
const at = (l: L, fn: string, v: unknown): unknown => (l[fn] as (v: unknown) => unknown)(v);

describe('G08 F1: Complex.asinh overflows the imaginary part to NaN (regression)', () => {
  // asinh(z) = -i asin(iz). For a large |z| core's asin builds a real Infinity
  // that is then multiplied by the zero of `-i`, giving NaN. mathjs's complex.js
  // returns the log form directly: asinh(Infinity + 0i) is Infinity, not NaN.
  const CASES: [string, number, number][] = [
    ['asinh(complex(1e300, 0))', 1e300, 0],
    ['asinh(complex(-1e300, 0))', -1e300, 0],
    ['asinh(complex(1e155, 0))', 1e155, 0],
    ['asinh(complex(0, 1e300))', 0, 1e300],
    ['asinh(complex(2, 1e300))', 2, 1e300],
    ['asinh(complex(1, 1e300))', 1, 1e300],
    ['asinh(complex(1e300, 3))', 1e300, 3],
  ];
  for (const [label, re, im] of CASES) {
    it(`${label} matches mathjs (Infinity, not Infinity + NaNi)`, () => {
      expectSame(label, undefined, (l) => at(l, 'asinh', C(l, re, im)));
    });
  }
});

describe('G08 F2: Complex.acosh overflows the imaginary part to NaN', () => {
  // acosh(z) is the acos swap; the same `Infinity * 0` in core's acos reaches it.
  // mathjs gives `Infinity` (real part infinite, imaginary part zero/signed).
  const CASES: [string, number, number][] = [
    ['acosh(complex(1e300, 0))', 1e300, 0],
    ['acosh(complex(-1e300, 0))', -1e300, 0],
    ['acosh(complex(1e155, 0))', 1e155, 0],
    ['acosh(complex(0, 1e300))', 0, 1e300],
    ['acosh(complex(2, 1e300))', 2, 1e300],
  ];
  for (const [label, re, im] of CASES) {
    it(`${label} matches mathjs (Infinity, not Infinity + NaNi)`, () => {
      expectSame(label, undefined, (l) => at(l, 'acosh', C(l, re, im)));
    });
  }
});

describe('G08 F3: Complex.acosh on the branch cut just inside |z|=1 is wrong', () => {
  // mathjs acosh(1 -+ eps i) is Infinity (the acos of a point epsilon inside the
  // unit circle diverges); core's acos returns 0 there, so compat returns 0.
  const CASES: [string, number][] = [
    ['acosh(complex(1, 1e-300))', 1e-300],
    ['acosh(complex(1, -1e-300))', -1e-300],
  ];
  for (const [label, im] of CASES) {
    it(`${label} matches mathjs`, () => {
      expectSame(label, undefined, (l) => at(l, 'acosh', C(l, 1, im)));
    });
  }
});

describe('G08 F4: Complex.asech near z = 1 is wrong (same acos root as F3)', () => {
  // The #1559 fix flips the real-axis branch (asech(7.25), asech(2), asech(-2) all
  // pass), but asech(1 -+ eps i) still differs: mathjs is Infinity, compat is 0.
  const CASES: [string, number][] = [
    ['asech(complex(1, 1e-300))', 1e-300],
    ['asech(complex(1, -1e-300))', -1e-300],
  ];
  for (const [label, im] of CASES) {
    it(`${label} matches mathjs`, () => {
      expectSame(label, undefined, (l) => at(l, 'asech', C(l, 1, im)));
    });
  }
});

describe('G08 F5: Complex.acsch on the imaginary axis / tiny real part is wrong', () => {
  // acsch(z) = asinh(1/z) off the real axis; the asinh overflow (F1) and the
  // asin branch (F1's root) reach it. mathjs gives Infinity / -Infinity here.
  const CASES: [string, number, number][] = [
    ['acsch(complex(1e-200, 1))', 1e-200, 1],
    ['acsch(complex(0, 1e-100))', 0, 1e-100],
    ['acsch(complex(0, 1e-15))', 0, 1e-15],
  ];
  for (const [label, re, im] of CASES) {
    it(`${label} matches mathjs`, () => {
      expectSame(label, undefined, (l) => at(l, 'acsch', C(l, re, im)));
    });
  }
});

describe('G08 F6: atanh / acoth near the pole keep a finite value where mathjs overflows', () => {
  // The port claims the complex.js 2.4.2 `atanh` "bit for bit". complex.js's
  // logHypot has no overflow rescue: for |x| > ~1.3e154 the `0.5*log(a^2+b^2)`
  // term is Infinity, so atanh(1 -+ 1e-160 i) and acoth(1 -+ 1e-160 i) are
  // Infinity. Core's logHypot rescales and returns the finite 184.55..., so the
  // port is not the complex.js result it says it is.
  const CASES: [string, string, number][] = [
    ['atanh(complex(1, 1e-160))', 'atanh', 1e-160],
    ['atanh(complex(1, -1e-160))', 'atanh', -1e-160],
    ['acoth(complex(1, 1e-160))', 'acoth', 1e-160],
    ['acoth(complex(1, -1e-160))', 'acoth', -1e-160],
  ];
  for (const [label, fn, im] of CASES) {
    it(`${label} matches mathjs (Infinity, not a finite log)`, () => {
      expectSame(label, undefined, (l) => at(l, fn, C(l, 1, im)));
    });
  }
});

describe('G08 F7: Complex.asinh(0) returns a negative zero real part', () => {
  // asinh(0) must be +0 on the real part, as mathjs and the pre-PR code return.
  // The rewrite produces -0 there. `format(precision 14)` prints both as "0", so
  // the harness rule cannot see it; read the raw part.
  const CASES: [string, number, number][] = [
    ['asinh(complex(0, 0))', 0, 0],
    ['asinh(complex(-0, -0))', -0, -0],
    ['asinh(complex(0, 1))', 0, 1],
  ];
  const asinhMethod = (l: L, re: number, im: number): { re: number } => {
    const z = C(l, re, im) as { asinh(): { re: number } };
    return z.asinh();
  };
  for (const [label, re, im] of CASES) {
    it(`${label} keeps a +0 real part like mathjs`, () => {
      const { mathjs, compat } = pair({});
      const oracleRe = asinhMethod(mathjs as unknown as L, re, im).re;
      const compatRe = asinhMethod(compat as unknown as L, re, im).re;
      expect(Object.is(compatRe, -0)).toBe(Object.is(oracleRe, -0));
    });
  }
});
