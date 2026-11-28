import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { Complex, isBigNumber } from '@danielsimonjr/mathts-core';
import { isMatrix } from '@danielsimonjr/mathts-matrix';

const math = create(all);
const pi = math.pi as number;

describe('trig branch cuts (#1789)', () => {
  it('acsc(0) and acsc(false) use complex.js pi/2 + Infinity', () => {
    const z = math.acsc(0) as Complex;
    expect(z.re).toBeCloseTo(pi / 2);
    expect(z.im).toBe(Infinity);
    const f = math.acsc(false) as Complex;
    expect(f.re).toBeCloseTo(pi / 2);
    expect(f.im).toBe(Infinity);
  });

  it('asec(false) is 0 + Infinityi', () => {
    const z = math.asec(false) as Complex;
    expect(z.re).toBe(0);
    expect(z.im).toBe(Infinity);
  });

  it('atan(i) is 0 + Infinityi', () => {
    const z = math.atan(math.complex(0, 1)) as Complex;
    expect(z.re).toBe(0);
    expect(z.im).toBe(Infinity);
  });

  it('acsc(complex 0) matches mathjs branch cut', () => {
    const z = math.acsc(math.complex(0, 0)) as Complex;
    expect(z.re).toBeCloseTo(pi / 2);
    expect(z.im).toBe(Infinity);
  });

  it('per-instance BigNumber.precision mirrors config', () => {
    const high = math.create({ number: 'BigNumber', precision: 238 });
    const Ctor = high.BigNumber as { precision: number };
    const operand = high.bignumber(103.64);
    expect(Ctor.precision).toBe(238);
    const cosVal = high.cos(operand);
    expect(isBigNumber(cosVal)).toBe(true);
    expect((cosVal as { constructor: unknown }).constructor).toBe(high.BigNumber);
    expect(Ctor.precision).toBe(238);
  });

  it('atan2 sparse grids honor atan2(0, x) for x < 0', () => {
    const y = math.sparse([
      [0, 0, 2],
      [-2, 0, 0],
    ]);
    const x = math.sparse([
      [-1, 0, 0],
      [0, 0, -1],
    ]);
    const divided = math.divide(math.atan2(y, x), math.pi);
    expect(isMatrix(divided)).toBe(true);
    const result = (divided as { toArray(): number[][] }).toArray();
    expect(result[0][0]).toBeCloseTo(1);
    expect(result[1][2]).toBeCloseTo(1);
  });
});
