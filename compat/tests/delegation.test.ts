/**
 * Delegation tests: `create(all)` builds a mathjs-compatible instance whose
 * compat surface delegates correctly to the underlying core types and
 * functions ops, matching mathjs semantics.
 */

import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { Complex } from '@danielsimonjr/mathts-core';

const math = create(all);

describe('create(all) arithmetic delegates to functions ops', () => {
  it('add/subtract/multiply/divide/pow on numbers', () => {
    expect(math.add(1, 2)).toBe(3);
    expect(math.subtract(10, 4)).toBe(6);
    expect(math.multiply(6, 7)).toBe(42);
    expect(math.divide(20, 5)).toBe(4);
    expect(math.pow(2, 10)).toBe(1024);
  });

  it('sqrt/abs/exp/log match Math semantics', () => {
    expect(math.sqrt(16)).toBe(4);
    expect(math.abs(-3.5)).toBe(3.5);
    expect(math.exp(0)).toBe(1);
    expect(math.log(Math.E)).toBeCloseTo(1);
  });
});

describe('create(all) type creation delegates to core constructors', () => {
  it('complex() returns a core Complex', () => {
    const c = math.complex(3, 4) as Complex;
    expect(c).toBeInstanceOf(Complex);
    expect(c.re).toBe(3);
    expect(c.im).toBe(4);
  });

  it('complex constants are surfaced (i === sqrt(-1))', () => {
    const ci = math.i as Complex;
    expect(ci).toBeInstanceOf(Complex);
    expect(ci.re).toBe(0);
    expect(ci.im).toBe(1);
  });
});

describe('create(all) statistics + rounding delegate correctly', () => {
  it('sum/mean over an array', () => {
    expect(math.sum([1, 2, 3, 4])).toBe(10);
    expect(math.mean([2, 4, 6])).toBe(4);
  });

  it('round/floor/ceil match mathjs semantics', () => {
    expect(math.round(2.5)).toBe(3);
    expect(math.floor(2.9)).toBe(2);
    expect(math.ceil(2.1)).toBe(3);
  });
});

describe('create(all) keeps compat shims overlaid on the functions namespace', () => {
  it('conj/re/im operate on Complex', () => {
    const c = new Complex(3, -4);
    const cj = math.conj(c) as Complex;
    expect(cj.im).toBe(4);
    expect(math.re(c)).toBe(3);
    expect(math.im(c)).toBe(-4);
  });

  it('matrix-specific shims (identity/zeros/transpose) work through the instance', () => {
    const id = math.identity(2) as { get: (r: number, c: number) => number };
    expect(id.get(0, 0)).toBe(1);
    expect(id.get(0, 1)).toBe(0);
  });
});

describe('config is independent per instance', () => {
  it('config is process-global — separate instances share it (singleton functions surface)', () => {
    // GC12: `config()` now DRIVES behavior by forwarding to the shared functions
    // runtime config. The MathTS functions surface is a process singleton, so —
    // unlike mathjs's per-instance `create()` config — config is global: mutating
    // it through one instance is observed by every instance. (Per-instance
    // isolation is impossible without per-instance function surfaces, and was
    // only "true" before because config was an inert no-op.)
    const a = create(all);
    const b = create(all);
    try {
      a.config({ precision: 99 });
      expect(a.config().precision).toBe(99);
      expect(b.config().precision).toBe(99); // shared, not isolated
    } finally {
      a.config({ precision: 64 }); // restore global default for other tests
    }
  });
});
