import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { abs, add, multiply, norm } from '../src/typed/arithmetic.js';
import { qr } from '../src/factories/index.js';
import { shapiroWilkTest } from '../src/typed/hypothesis.js';

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
