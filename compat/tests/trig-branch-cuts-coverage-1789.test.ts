import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { Complex } from '@danielsimonjr/mathts-core';
import { isMatrix } from '@danielsimonjr/mathts-matrix';
import { complexJsAtan, complexJsAcot } from '../src/compat-trig-complex.js';

const math = create(all);

describe('trig branch cut coverage (#1789)', () => {
  it('complexJs atan / acot oracle corners', () => {
    const ni = complexJsAtan(new Complex(0, -1));
    expect(ni.re).toBe(0);
    expect(ni.im).toBe(-Infinity);
    const ac = complexJsAcot(new Complex(2, 3));
    expect(Number.isFinite(ac.re)).toBe(true);
    const az = complexJsAcot(new Complex(0, 0));
    expect(az.re).toBeCloseTo(Math.PI / 2);
  });

  it('atan(-i) branch', () => {
    const z = math.atan(math.complex(0, -1)) as Complex;
    expect(z.re).toBe(0);
    expect(z.im).toBe(-Infinity);
  });

  it('acot on complex with imaginary part', () => {
    const z = math.acot(math.complex(1, 2)) as Complex;
    expect(Number.isFinite(z.re)).toBe(true);
  });

  it('atan2(null) throws mathjs conversion error', () => {
    expect(() => math.atan2(null)).toThrow(TypeError);
  });

  it('atan2 sparse with positive scalar keeps sparse storage', () => {
    const y = math.sparse([
      [0, 1],
      [0, 0],
    ]);
    const r = math.atan2(y, 2);
    expect(isMatrix(r)).toBe(true);
    expect((r as { storage(): string }).storage()).toBe('sparse');
  });

  it('atan2 sparse with negative scalar uses dense', () => {
    const y = math.sparse([[0, 0]]);
    const r = math.atan2(y, -1);
    expect((r as { storage(): string }).storage()).toBe('dense');
  });

  it('atan2 nested array with sparse matrix', () => {
    const y = [
      [1, 0],
      [0, 0],
    ];
    const x = math.sparse([
      [1, -1],
      [0, 1],
    ]);
    const r = math.atan2(y, x);
    expect(isMatrix(r)).toBe(true);
    expect((r as { toArray(): number[][] }).toArray().length).toBe(2);
  });

  it('atan2 boolean scalar with sparse', () => {
    const x = math.sparse([[0, 1]]);
    const r = math.atan2(true, x);
    expect(isMatrix(r)).toBe(true);
  });

  it('atan2 dimension mismatch throws', () => {
    const y = math.sparse([[1, 2, 3]]);
    const x = math.sparse([[1], [2]]);
    expect(() => math.atan2(y, x)).toThrow(RangeError);
  });

  it('acosh(1) as BigNumber is zero', () => {
    const z = math.acosh(math.bignumber(1));
    expect(String(z)).toBe('0');
  });

  it('predictable acsc(0) uses native path', () => {
    const pred = math.create({ predictable: true });
    const z = pred.acsc(0);
    expect(typeof z).toBe('number');
    expect(Number.isNaN(z as number)).toBe(true);
  });
});
