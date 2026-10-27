/**
 * Independent oracles for Sprint 2R near-clone numeric merges (batch 6).
 *
 * Literals were captured from a standalone recreation of the origin/main
 * bodies (`git show origin/main:<file>`), not from the shared helpers under
 * test. Closed forms use exact equality. Errors are compared by class name
 * plus message string — not `toThrow(new Error(...))`, which vitest matches
 * on extra own properties.
 */
import { describe, it, expect } from 'vitest';
import { expfit, logfit, powerfit } from '../src/typed/numeric.js';
import { chebyshevFit, legendreFit } from '../src/typed/interpolation.js';
import { struveH, struveL, kelvinBer, kelvinBei } from '../src/special/niche.js';
import { add, sub } from '../src/typed/factorization/integer-poly.js';
import { addP, subP } from '../src/typed/factorization/finite-field.js';
import { fibonacci, lucas } from '../src/typed/combinatorics.js';
import { setIntersect, setDifference } from '../src/typed/set.js';

const P = (...c: number[]) => c.map(BigInt);

/** origin/main `logfit` body (pre-`linearFit`); engine-stable bit oracle. */
function logfitOrig(xs: number[], ys: number[]): [number, number] {
  const logXs = xs.map((x) => Math.log(x));
  const n = xs.length;
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += logXs[i];
    sy += ys[i];
    sxx += logXs[i] * logXs[i];
    sxy += logXs[i] * ys[i];
  }
  const a = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const b = (sy - a * sx) / n;
  return [a, b];
}

function expectError(fn: () => unknown, message: string): void {
  let thrown: unknown;
  try {
    fn();
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(Error);
  const err = thrown as Error;
  expect(err.name).toBe('Error');
  expect(err.message).toBe(message);
}

describe('clone-near numeric oracles — linearFit family', () => {
  it('expfit: y = 2·e^{3x} at two points recovers a=2, b=3 exactly', () => {
    const xs = [0, 1];
    const ys = [2, 2 * Math.exp(3)];
    expect(expfit(xs, ys)).toEqual([2, 3]);
  });

  it('expfit maps y through log(abs(y)||1e-15) then exp(intercept)', () => {
    // origin/main OLS on xs=[0,1], ys=[0,2] (zero hits the 1e-15 floor).
    const [aFloor, bFloor] = expfit([0, 1], [0, 2]);
    expect(aFloor).toBe(1.0000000000000013e-15);
    expect(bFloor).toBe(35.231923575470624);

    // abs() of a negative exponential recovers the same [2, 3] as the positive pair.
    expect(expfit([0, 1], [-2, -2 * Math.exp(3)])).toEqual([2, 3]);
  });

  it('logfit: y = 3·ln(x)+1 returns slope/intercept with no exp', () => {
    const xs = [1, 2, 3];
    const ys = xs.map((x) => 3 * Math.log(x) + 1);
    const [a, b] = logfit(xs, ys);
    expect([a, b]).toEqual(logfitOrig(xs, ys));
    expect(a).toBeCloseTo(3, 12);
    expect(b).toBeCloseTo(1, 12);
    expect(b).not.toBe(Math.exp(1));
  });

  it('powerfit: y = 2·x³ exp(intercept) bits from origin/main OLS', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = xs.map((x) => 2 * x ** 3);
    const [a, b] = powerfit(xs, ys);
    expect(a).toBe(2.000000000000002);
    expect(b).toBe(2.9999999999999987);
  });
});

describe('clone-near numeric oracles — chebyshev/legendre normal equations (JS path)', () => {
  it('chebyshevFit recovers T₂ on three nodes', () => {
    const xs = [-1, 0, 1];
    const ys = xs.map((x) => 2 * x * x - 1);
    expect(chebyshevFit(xs, ys, 2)).toEqual([0, 0, 1]);
  });

  it('legendreFit recovers P₂ on three nodes', () => {
    const xs = [-1, 0, 1];
    const ys = xs.map((x) => (3 * x * x - 1) / 2);
    expect(legendreFit(xs, ys, 2)).toEqual([0, 0, 1]);
  });

  it('chebyshevFit recovers T₀ + ½ T₁ on four nodes', () => {
    const xs = [-1, -0.5, 0.5, 1];
    const ys = xs.map((x) => 1 + 0.5 * x);
    expect(chebyshevFit(xs, ys, 1)).toEqual([1, 0.5]);
  });

  it('rank-deficient GE throws wrapper-specific messages', () => {
    const xs = [0.5, 0.5, 0.5];
    const ys = [1, 2, 3];
    expectError(() => chebyshevFit(xs, ys, 2), 'chebyshevFit: rank-deficient system');
    expectError(() => legendreFit(xs, ys, 2), 'legendreFit: rank-deficient system');
  });
});

describe('clone-near numeric oracles — Struve / Kelvin series', () => {
  it('struveH(0,1) matches origin/main series bits', () => {
    expect(struveH(0, 1)).toBe(0.5686566270482877);
  });

  it('struveL(0,1) matches origin/main series bits (positive ratio)', () => {
    expect(struveL(0, 1)).toBe(0.7102431859378905);
  });

  it('struveH/L z<0 keep wrapper error text; z=0 short-circuits', () => {
    expect(struveH(0, 0)).toBe(0);
    expect(struveL(0, 0)).toBe(0);
    expectError(() => struveH(0, -1), 'struveH: z must be >= 0');
    expectError(() => struveL(0, -0.5), 'struveL: z must be >= 0');
  });

  it('kelvinBer(2) and kelvinBei(2) match origin/main series bits', () => {
    expect(kelvinBer(2)).toBe(0.7517341827138083);
    expect(kelvinBei(2)).toBe(0.9722916273066612);
  });

  it('kelvin term0: ber(0)=1, bei(0)=0', () => {
    expect(kelvinBer(0)).toBe(1);
    expect(kelvinBei(0)).toBe(0);
  });
});

describe('clone-near numeric oracles — zipIntPoly (ℤ and 𝔽_p)', () => {
  it('add/sub exact coefficient vectors', () => {
    expect(add(P(1, 1), P(0, 1))).toEqual(P(1, 2));
    expect(sub(P(1, 2), P(1, 1))).toEqual(P(0, 1));
  });

  it('add/sub pad the shorter vector and trim leading zeros', () => {
    expect(add(P(1), P(0, 0, 1))).toEqual(P(1, 0, 1));
    expect(sub(P(1, 1, 1), P(1))).toEqual(P(0, 1, 1));
    expect(add(P(1, 2), P(-1, -2))).toEqual([]);
  });

  it('addP/subP mod 5, including wrap and trim', () => {
    expect(addP(P(4, 2), P(1, 1), 5n)).toEqual(P(0, 3));
    expect(subP(P(4, 2), P(1, 1), 5n)).toEqual(P(3, 1));
    expect(subP(P(0), P(1), 5n)).toEqual(P(4));
    expect(addP(P(1, 4), P(0, 1), 5n)).toEqual(P(1));
    expect(addP(P(4, 4), P(1, 1), 5n)).toEqual([]);
  });
});

describe('clone-near numeric oracles — set selectById multiplicity', () => {
  it('intersect keeps min multiplicity per identifier', () => {
    expect(setIntersect([2, 2, 2], [2, 2])).toEqual([2, 2]);
    expect(setIntersect([2, 2, 3], [2, 3])).toEqual([2, 3]);
  });

  it('difference keeps unmatched multiplicity in b1', () => {
    expect(setDifference([2, 2, 2], [2])).toEqual([2, 2]);
    expect(setDifference([2, 2, 3], [2])).toEqual([2, 3]);
  });

  it('naturalCompare string order is lexicographic, not numeric-aware', () => {
    // 'a10' < 'a2' because '1' < '2'. Output follows sorted b1, not input order.
    expect(setIntersect(['a2', 'a10'], ['a10', 'a2'])).toEqual(['a10', 'a2']);
  });
});

describe('clone-near numeric oracles — fibPair / lucas relation', () => {
  it('fibonacci(10) = 55 and lucas(10) = 123', () => {
    expect(fibonacci(10)).toBe(55);
    expect(lucas(10)).toBe(123);
  });

  it('lucas(0)=2 and lucas(1)=1 without fast-doubling bases', () => {
    expect(lucas(0)).toBe(2);
    expect(lucas(1)).toBe(1);
    expect(fibonacci(0)).toBe(0);
    expect(fibonacci(1)).toBe(1);
  });

  it('lucas(15) = 1364 (independent from fib closed form)', () => {
    expect(lucas(15)).toBe(1364);
  });

  it('fast doubling at n=70 matches the known integer sequence values', () => {
    expect(fibonacci(70)).toBe(190392490709135);
    expect(lucas(70)).toBe(425730551631123);
  });

  it('fibonacci/lucas error strings stay wrapper-specific', () => {
    expectError(() => fibonacci(-1), 'fibonacci requires a non-negative integer');
    expectError(() => fibonacci(1.5), 'fibonacci requires a non-negative integer');
    expectError(() => lucas(-1), 'lucas requires a non-negative integer');
    expectError(() => lucas(0.5), 'lucas requires a non-negative integer');
  });
});
