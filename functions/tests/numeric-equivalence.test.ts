import { describe, it, expect } from 'vitest';
import { createSeededRng } from '@danielsimonjr/mathts-core';
import { nearlyEqual } from '@danielsimonjr/mathts-core/internal';
import { numericallyEquivalent, NumericEquivalenceError } from '../src/numeric-equivalence.js';
import * as barrel from '../src/index.js';
import { scalar } from '../src/scalar-eval.js';

describe('numericallyEquivalent', () => {
  it('barrel export matches module', () => {
    expect(barrel.numericallyEquivalent).toBe(numericallyEquivalent);
    expect(barrel.NumericEquivalenceError).toBe(NumericEquivalenceError);
  });

  it('oracle 1: counterexample (x^2)^0.5 vs x on [-1, 0]', () => {
    const x = scalar.symbol('x');
    const a = scalar.op('^', [scalar.op('^', [x, scalar.number(2)]), scalar.number(0.5)]);
    const b = x;
    const rng = createSeededRng(42);
    const u = rng.next();
    const x0 = -1 + u;
    const expectedA = Math.pow(Math.pow(x0, 2), 0.5);

    const result = numericallyEquivalent(a, b, {
      domain: { x: [-1, 0] },
      rng: createSeededRng(42),
    });

    expect(result).toEqual({
      verdict: 'counterexample',
      at: { x: x0 },
      a: expectedA,
      b: x0,
    });
    expect(result.verdict === 'counterexample' && result.a > 0 && result.b < 0).toBe(true);
  });

  it('oracle 2: consistent sin^2+cos^2 vs 1', () => {
    const x = scalar.symbol('x');
    const lhs = scalar.op('+', [
      scalar.op('^', [scalar.call('sin', x), scalar.number(2)]),
      scalar.op('^', [scalar.call('cos', x), scalar.number(2)]),
    ]);
    const result = numericallyEquivalent(lhs, scalar.number(1), {
      domain: { x: [0, 1] },
      rng: createSeededRng(1),
    });
    expect(result).toEqual({ verdict: 'consistent', samplesUsed: 64 });
    expect('constant' in result).toBe(false);
  });

  it('oracle 3: upToConstant 2πx vs x', () => {
    const x = scalar.symbol('x');
    const a = scalar.op('*', [scalar.number(2 * Math.PI), x]);
    const b = x;
    const result = numericallyEquivalent(a, b, {
      domain: { x: [1, 2] },
      rng: createSeededRng(1),
      upToConstant: true,
    });
    expect(result.verdict).toBe('consistent');
    if (result.verdict === 'consistent') {
      expect(result.samplesUsed).toBe(64);
      expect(nearlyEqual(result.constant!, 2 * Math.PI, 1e-9, 1e-12)).toBe(true);
    }
  });

  it('oracle 4: inconclusive ln(x) vs ln(x) with few valid samples', () => {
    const x = scalar.symbol('x');
    const tree = scalar.call('ln', x);
    const inconclusive = {
      verdict: 'inconclusive' as const,
      reason: 'too-few-valid-samples' as const,
    };

    expect(
      numericallyEquivalent(tree, tree, {
        domain: { x: [-1, 1] },
        samples: 4,
        rng: createSeededRng(3),
      })
    ).toEqual(inconclusive);

    expect(
      numericallyEquivalent(tree, scalar.number(0), {
        domain: { x: [-1, 1] },
        samples: 4,
        rng: createSeededRng(3),
      })
    ).toEqual(inconclusive);

    expect(
      numericallyEquivalent(tree, scalar.number(0), {
        domain: { x: [-2, -1] },
        rng: createSeededRng(99),
      })
    ).toEqual(inconclusive);
  });

  it('empty domain constants: 1 vs 1 and 1 vs 2', () => {
    const rng = createSeededRng(42);
    const r1 = numericallyEquivalent(scalar.number(1), scalar.number(1), { domain: {}, rng });
    expect(r1).toEqual({ verdict: 'consistent', samplesUsed: 1 });
    expect(rng.next()).toBe(createSeededRng(42).next());

    const r2 = numericallyEquivalent(scalar.number(1), scalar.number(2), {
      domain: {},
      rng: createSeededRng(0),
    });
    expect(r2).toEqual({
      verdict: 'counterexample',
      at: {},
      a: 1,
      b: 2,
    });
  });

  it('missing domain for free symbol', () => {
    const x = scalar.symbol('x');
    expect(() =>
      numericallyEquivalent(scalar.op('+', [x, scalar.symbol('y')]), x, {
        domain: { x: [0, 1] },
        rng: createSeededRng(0),
      })
    ).toThrow(/missing domain entry for symbol 'y'/);
  });

  it('validation errors', () => {
    const one = scalar.number(1);
    const rng = createSeededRng(0);
    const base = { domain: { x: [0, 1] as [number, number] }, rng };

    expect(() =>
      numericallyEquivalent(scalar.symbol('x'), one, { domain: { x: [NaN, 1] }, rng })
    ).toThrow(NumericEquivalenceError);
    expect(() =>
      numericallyEquivalent(scalar.symbol('x'), one, { domain: { x: [0, Infinity] }, rng })
    ).toThrow(NumericEquivalenceError);
    expect(() =>
      numericallyEquivalent(scalar.symbol('x'), one, { domain: { x: [1, 0] }, rng })
    ).toThrow(NumericEquivalenceError);
    expect(() => numericallyEquivalent(scalar.symbol('x'), one, { ...base, samples: 0 })).toThrow(
      NumericEquivalenceError
    );
    expect(() => numericallyEquivalent(scalar.symbol('x'), one, { ...base, samples: 1.5 })).toThrow(
      NumericEquivalenceError
    );
    expect(() => numericallyEquivalent(scalar.symbol('x'), one, { ...base, samples: NaN })).toThrow(
      NumericEquivalenceError
    );
    expect(() => numericallyEquivalent(scalar.symbol('x'), one, { ...base, relTol: 0 })).toThrow(
      NumericEquivalenceError
    );
    expect(() => numericallyEquivalent(scalar.symbol('x'), one, { ...base, absTol: -1 })).toThrow(
      NumericEquivalenceError
    );
    expect(() =>
      numericallyEquivalent(scalar.symbol('x'), one, {
        domain: { x: [0, 1] },
        rng,
        logUniform: ['x'],
      })
    ).toThrow(NumericEquivalenceError);

    const rngBefore = createSeededRng(7);
    const expectedFirst = createSeededRng(7).next();
    expect(() =>
      numericallyEquivalent(scalar.symbol('x'), one, {
        domain: { x: [-1, 1] },
        rng: rngBefore,
        logUniform: ['x'],
      })
    ).toThrow(NumericEquivalenceError);
    expect(rngBefore.next()).toBe(expectedFirst);
  });

  it('log-uniform sampling: x*x vs x^2', () => {
    const x = scalar.symbol('x');
    const result = numericallyEquivalent(
      scalar.op('*', [x, x]),
      scalar.op('^', [x, scalar.number(2)]),
      {
        domain: { x: [1e-3, 1e3] },
        logUniform: ['x'],
        rng: createSeededRng(42),
      }
    );
    expect(result).toEqual({ verdict: 'consistent', samplesUsed: 64 });
  });

  it('identical trees x vs x', () => {
    const x = scalar.symbol('x');
    const result = numericallyEquivalent(x, x, {
      domain: { x: [0, 1] },
      rng: createSeededRng(0),
    });
    expect(result).toEqual({ verdict: 'consistent', samplesUsed: 64 });
  });

  it('determinism', () => {
    const x = scalar.symbol('x');
    const a = scalar.op('^', [scalar.op('^', [x, scalar.number(2)]), scalar.number(0.5)]);
    const opts = { domain: { x: [-1, 0] as [number, number] }, rng: createSeededRng(42) };
    const r1 = numericallyEquivalent(a, x, opts);
    const r2 = numericallyEquivalent(a, x, { ...opts, rng: createSeededRng(42) });
    expect(r1).toEqual(r2);

    const rSeed1 = numericallyEquivalent(a, x, {
      domain: { x: [-1, 0] },
      rng: createSeededRng(1),
    });
    const rSeed2 = numericallyEquivalent(a, x, {
      domain: { x: [-1, 0] },
      rng: createSeededRng(2),
    });
    expect(rSeed1.verdict).toBe('counterexample');
    expect(rSeed2.verdict).toBe('counterexample');
    if (rSeed1.verdict === 'counterexample' && rSeed2.verdict === 'counterexample') {
      expect(rSeed1.at.x).toBeCloseTo(-0.3729, 3);
      expect(rSeed2.at.x).toBeCloseTo(-0.2657, 3);
      expect(rSeed1.at.x).not.toBe(rSeed2.at.x);
    }
  });

  it('upToConstant edge cases', () => {
    expect(
      numericallyEquivalent(scalar.number(0), scalar.number(0), {
        domain: {},
        rng: createSeededRng(0),
        upToConstant: true,
      })
    ).toEqual({ verdict: 'consistent', samplesUsed: 1, constant: 0 });

    const ce = numericallyEquivalent(scalar.number(1), scalar.number(0), {
      domain: {},
      rng: createSeededRng(0),
      upToConstant: true,
    });
    expect(ce.verdict).toBe('counterexample');

    const x = scalar.symbol('x');
    const r = numericallyEquivalent(scalar.op('*', [scalar.number(0), x]), x, {
      domain: { x: [1, 2] },
      rng: createSeededRng(0),
      upToConstant: true,
    });
    expect(r).toEqual({ verdict: 'consistent', samplesUsed: 64, constant: 0 });
  });

  it('own-key domain: constructor symbol', () => {
    const ctor = scalar.symbol('constructor');
    const inherited = Object.create({ constructor: [0, 1] as [number, number] });
    expect(() =>
      numericallyEquivalent(ctor, ctor, { domain: inherited, rng: createSeededRng(0) })
    ).toThrow(/missing domain entry for symbol 'constructor'/);

    const own = Object.assign(Object.create(null), { constructor: [0, 1] as [number, number] });
    const ok = numericallyEquivalent(ctor, ctor, { domain: own, rng: createSeededRng(0) });
    expect(ok.verdict).toBe('consistent');
  });

  it('rng.fork isolation', () => {
    const parent = createSeededRng(42);
    const child = parent.fork('equiv');
    const direct = createSeededRng(child.seed);
    const x = scalar.symbol('x');
    const tree = scalar.op('*', [x, x]);
    const domain = { x: [0, 1] as [number, number] };
    const fromFork = numericallyEquivalent(tree, tree, { domain, rng: child });
    const fromDirect = numericallyEquivalent(tree, tree, { domain, rng: direct });
    expect(fromFork).toEqual(fromDirect);

    const parentFirst = createSeededRng(42);
    parentFirst.fork('equiv');
    expect(parentFirst.next()).toBe(createSeededRng(42).next());
  });
});
