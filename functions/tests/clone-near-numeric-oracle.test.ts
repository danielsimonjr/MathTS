/**
 * Independent oracles for Sprint 2R near-clone numeric merges (batch 6).
 * Values are closed-form or pre-refactor literals — not round-trips through helpers under test.
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

describe('clone-near numeric oracles — linearFit family', () => {
  it('expfit: y = 2·e^{3x} at two points recovers a=2, b=3 exactly', () => {
    const xs = [0, 1];
    const ys = [2, 2 * Math.exp(3)];
    expect(expfit(xs, ys)).toEqual([2, 3]);
  });

  it('logfit: y = 3·ln(x) + 1 on x=1,2,3 recovers [3, 1]', () => {
    const xs = [1, 2, 3];
    const ys = xs.map((x) => 3 * Math.log(x) + 1);
    const [a, b] = logfit(xs, ys);
    expect(a).toBeCloseTo(3, 12);
    expect(b).toBeCloseTo(1, 12);
  });

  it('powerfit: y = 2·x³ on x=1..5 recovers a=2, b=3', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = xs.map((x) => 2 * x ** 3);
    const [a, b] = powerfit(xs, ys);
    expect(a).toBeCloseTo(2, 12);
    expect(b).toBeCloseTo(3, 12);
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
});

describe('clone-near numeric oracles — Struve / Kelvin series', () => {
  it('struveH(0,1) matches DLMF table literal', () => {
    expect(struveH(0, 1)).toBe(0.5686566270482877);
  });

  it('struveL(0,1) matches modified-series literal', () => {
    expect(struveL(0, 1)).toBe(0.7102431859378905);
  });

  it('kelvinBer(2) and kelvinBei(2) match table literals', () => {
    expect(kelvinBer(2)).toBe(0.7517341827138083);
    expect(kelvinBei(2)).toBe(0.9722916273066612);
  });
});

describe('clone-near numeric oracles — zipIntPoly (ℤ and 𝔽_p)', () => {
  it('add/sub exact coefficient vectors', () => {
    expect(add(P(1, 1), P(0, 1))).toEqual(P(1, 2));
    expect(sub(P(1, 2), P(1, 1))).toEqual(P(0, 1));
  });

  it('addP/subP mod 5', () => {
    expect(addP(P(4, 2), P(1, 1), 5n)).toEqual(P(0, 3));
    expect(subP(P(4, 2), P(1, 1), 5n)).toEqual(P(3, 1));
  });
});

describe('clone-near numeric oracles — set selectById multiplicity', () => {
  it('intersect keeps one copy per matched identifier', () => {
    expect(setIntersect([2, 2, 3], [2, 3])).toEqual([2, 3]);
  });

  it('difference keeps unmatched multiplicity in b1', () => {
    expect(setDifference([2, 2, 3], [2])).toEqual([2, 3]);
  });

  it('naturalCompare ordering preserved on strings', () => {
    expect(setIntersect(['a10', 'a2'], ['a2', 'a10'])).toEqual(['a10', 'a2']);
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
  });

  it('lucas(15) = 1364 (independent from fib closed form)', () => {
    expect(lucas(15)).toBe(1364);
  });
});
