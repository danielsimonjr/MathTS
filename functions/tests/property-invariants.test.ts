import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { abs, add, multiply, norm } from '../src/typed/arithmetic.js';
import { qr } from '../src/factories/index.js';
import { shapiroWilkTest } from '../src/typed/hypothesis.js';
import {
  sin,
  cos,
  sinh,
  cosh,
  exp,
  log,
  sqrt,
  cbrt,
  hypot,
  sign,
  gcd,
  lcm,
  sort,
} from '../src/index.js';

/**
 * WS-1 P3 — property-based invariant tests (unlocked by `fast-check`, gate G1).
 *
 * Where the WS-1 P2 oracle tests pin a single hand-derived value, these assert an
 * exact mathematical *property* over thousands of randomly-generated inputs — the
 * strongest implementation-independent check (a systematically-wrong function is
 * caught by an invariant it must satisfy for ALL inputs, not just the pinned one).
 * See [[feedback-oracle-tests-implementation-independent]].
 */

/** Finite doubles in a bounded range (no NaN / ±Infinity). */
const dbl = (min = -1e4, max = 1e4) =>
  fc.double({ min, max, noNaN: true, noDefaultInfinity: true });
const vec = (minLength = 1, maxLength = 24) => fc.array(dbl(), { minLength, maxLength });

/** Relative closeness for float invariants (absolute for magnitudes ≤ 1). */
const close = (a: number, b: number, rel = 1e-9): boolean =>
  Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));

const A = add as (x: unknown, y: unknown) => unknown;
const M = multiply as (x: unknown, y: unknown) => unknown;
const N = norm as (x: unknown, p?: unknown) => number;
const ABS = abs as (x: number) => number;
const num = (f: unknown) => f as (x: number) => number;
const SIN = num(sin);
const COS = num(cos);
const SINH = num(sinh);
const COSH = num(cosh);
const EXP = num(exp);
const LOG = num(log);
const SQRT = num(sqrt);
const CBRT = num(cbrt);
const SIGN = num(sign);
const HYP = hypot as (a: number, b: number) => number;
const GCD = gcd as (a: number, b: number) => number;
const LCM = lcm as (a: number, b: number) => number;
const SORT = sort as (x: number[]) => number[];

describe('abs — properties', () => {
  it('non-negative and even: abs(x) ≥ 0 and abs(−x) = abs(x)', () => {
    fc.assert(
      fc.property(dbl(-1e12, 1e12), (x) => {
        expect(ABS(x)).toBeGreaterThanOrEqual(0);
        expect(ABS(-x)).toBe(ABS(x));
      })
    );
  });
});

describe('add / multiply — algebraic properties', () => {
  it('add is commutative on numbers', () => {
    fc.assert(fc.property(dbl(), dbl(), (a, b) => close(A(a, b) as number, A(b, a) as number)));
  });

  it('multiply is commutative on numbers', () => {
    fc.assert(fc.property(dbl(), dbl(), (a, b) => close(M(a, b) as number, M(b, a) as number)));
  });

  it('add is element-wise commutative on equal-length vectors', () => {
    fc.assert(
      fc.property(vec(), fc.integer({ min: 0, max: 1000 }), (x, seed) => {
        const y = x.map((v, i) => v + ((seed + i) % 7) - 3);
        const r1 = A(x, y) as number[];
        const r2 = A(y, x) as number[];
        return r1.every((v, i) => close(v, r2[i]));
      })
    );
  });
});

describe('norm — vector properties', () => {
  it('non-negativity: ‖x‖ ≥ 0', () => {
    fc.assert(fc.property(vec(), (x) => N(x) >= 0));
  });

  it('absolute homogeneity: ‖a·x‖ = |a|·‖x‖', () => {
    fc.assert(
      fc.property(vec(), dbl(-1e3, 1e3), (x, a) => {
        const scaled = x.map((v) => a * v);
        return close(N(scaled), Math.abs(a) * N(x), 1e-8);
      })
    );
  });

  it('triangle inequality: ‖x + y‖ ≤ ‖x‖ + ‖y‖', () => {
    fc.assert(
      fc.property(vec(1, 16), (x) => {
        const y = x.map((v, i) => v * (i % 3) - 1);
        const lhs = N(A(x, y) as number[]);
        const rhs = N(x) + N(y);
        // small absolute slack for float round-off
        return lhs <= rhs + 1e-6 * Math.max(1, rhs);
      })
    );
  });
});

describe('norm — matrix Frobenius homogeneity', () => {
  it('‖a·A‖_F = |a|·‖A‖_F', () => {
    fc.assert(
      fc.property(
        fc.array(vec(2, 4), { minLength: 2, maxLength: 4 }),
        dbl(-1e3, 1e3),
        (rows, a) => {
          // rectangularize to a proper matrix (all rows same length)
          const w = Math.min(...rows.map((r) => r.length));
          const Amat = rows.map((r) => r.slice(0, w));
          const scaled = Amat.map((r) => r.map((v) => a * v));
          return close(N(scaled, 'fro'), Math.abs(a) * N(Amat, 'fro'), 1e-8);
        }
      )
    );
  });
});

describe('qr (factory) — orthonormality invariant', () => {
  it('QᵀQ = I for random square matrices', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }).chain((n) =>
          fc.tuple(
            fc.constant(n),
            fc.array(fc.array(dbl(-1e2, 1e2), { minLength: n, maxLength: n }), {
              minLength: n,
              maxLength: n,
            })
          )
        ),
        ([n, Amat]) => {
          const r = qr(Amat) as { Q: number[][] };
          const Q = r.Q;
          for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
              let dot = 0;
              for (let k = 0; k < n; k++) dot += Q[k][i] * Q[k][j];
              if (!close(dot, i === j ? 1 : 0, 1e-6)) return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('shapiroWilkTest — invariance over random samples', () => {
  it('scale + location and reflection invariant: W(a·x+b) = W(x) = W(−x)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Integer samples with a required spread: Shapiro-Wilk divides by S² and is
        // numerically undefined / unstable for (near-)constant data, so the invariance
        // is only meaningful on non-degenerate inputs. Scale stays moderate so extreme
        // scaling doesn't amplify float round-off past the tolerance.
        fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 5, maxLength: 30 }),
        fc.double({ min: 0.5, max: 10, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
        async (x, a, b) => {
          fc.pre(Math.max(...x) - Math.min(...x) >= 1); // non-degenerate spread
          const W = async (v: number[]): Promise<number> =>
            ((await shapiroWilkTest(v)) as { statistic: number }).statistic;
          const w0 = await W(x);
          return (
            close(w0, await W(x.map((v) => a * v + b)), 1e-7) &&
            close(w0, await W(x.map((v) => -v)), 1e-7)
          );
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('trigonometry — exact identities', () => {
  it('Pythagorean: sin²(x) + cos²(x) = 1', () => {
    fc.assert(
      fc.property(dbl(-1e3, 1e3), (x) => close(SIN(x) * SIN(x) + COS(x) * COS(x), 1, 1e-9))
    );
  });

  it('parity: sin(−x) = −sin(x) and cos(−x) = cos(x)', () => {
    fc.assert(
      fc.property(dbl(-1e3, 1e3), (x) => close(SIN(-x), -SIN(x)) && close(COS(-x), COS(x)))
    );
  });
});

describe('hyperbolic — exact identities', () => {
  it('cosh(x) + sinh(x) = exp(x)', () => {
    // The `cosh² − sinh² = 1` form suffers catastrophic cancellation for large x
    // (both terms ~e^{2x}/4, so their difference loses the leading 1). This
    // equivalent identity is cancellation-free (both summands positive).
    fc.assert(fc.property(dbl(-100, 100), (x) => close(COSH(x) + SINH(x), EXP(x), 1e-9)));
  });
});

describe('exp / log — inverse relationship', () => {
  it('log(exp(x)) = x on a non-overflowing range', () => {
    fc.assert(fc.property(dbl(-100, 100), (x) => close(LOG(EXP(x)), x, 1e-9)));
  });

  it('exp(log(x)) = x for x > 0', () => {
    fc.assert(fc.property(dbl(1e-6, 1e6), (x) => close(EXP(LOG(x)), x, 1e-9)));
  });
});

describe('roots — inverse relationship', () => {
  it('sqrt(x)² = x for x ≥ 0', () => {
    fc.assert(fc.property(dbl(0, 1e8), (x) => close(SQRT(x) * SQRT(x), x, 1e-8)));
  });

  it('cbrt(x)³ = x (all sign)', () => {
    fc.assert(
      fc.property(dbl(-1e6, 1e6), (x) => {
        const c = CBRT(x);
        return close(c * c * c, x, 1e-7);
      })
    );
  });

  it('hypot(a, b)² = a² + b²', () => {
    fc.assert(
      fc.property(dbl(-1e4, 1e4), dbl(-1e4, 1e4), (a, b) =>
        close(HYP(a, b) * HYP(a, b), a * a + b * b, 1e-7)
      )
    );
  });
});

describe('sign — defining property', () => {
  it('sign(x)·|x| = x and sign(x) ∈ {−1, 0, 1}', () => {
    fc.assert(
      fc.property(dbl(-1e9, 1e9), (x) => {
        const s = SIGN(x);
        return (s === -1 || s === 0 || s === 1) && close(s * ABS(x), x);
      })
    );
  });
});

describe('gcd / lcm — number-theory identity', () => {
  it('gcd(a,b)·lcm(a,b) = a·b for positive integers', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1e4 }), fc.integer({ min: 1, max: 1e4 }), (a, b) => {
        // bound keeps a·b ≤ 1e8, well within exact-integer range
        return GCD(a, b) * LCM(a, b) === a * b;
      })
    );
  });

  it('gcd divides both operands', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1e6 }), fc.integer({ min: 1, max: 1e6 }), (a, b) => {
        const g = GCD(a, b);
        return a % g === 0 && b % g === 0;
      })
    );
  });
});

describe('sort — order + permutation invariants', () => {
  // Integer samples: the public `sort` orders via `compareNatural`, which is
  // *tolerance-aware* (values within `config.epsilon` compare equal — so e.g. a
  // denormal like 1e-320 and 0 are "equal" and their mutual order is unspecified).
  // Well-separated integers make the tolerant order coincide with the strict order,
  // so the invariant is meaningful. (This is documented mathjs behavior, not a bug.)
  const ints = fc.array(fc.integer({ min: -1e6, max: 1e6 }), { maxLength: 40 });

  it('output is non-decreasing, idempotent, and preserves the multiset', () => {
    fc.assert(
      fc.property(ints, (x) => {
        const s = SORT(x.slice());
        // non-decreasing
        for (let i = 1; i < s.length; i++) if (s[i] < s[i - 1]) return false;
        // idempotent
        const s2 = SORT(s.slice());
        if (s2.some((v, i) => v !== s[i])) return false;
        // permutation: same length and same exact sum (integers ⇒ no round-off)
        if (s.length !== x.length) return false;
        return s.reduce((a, b) => a + b, 0) === x.reduce((a, b) => a + b, 0);
      })
    );
  });
});
