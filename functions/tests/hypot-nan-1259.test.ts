/**
 * #1259: `hypot(Infinity, NaN)` is NaN on every path.
 *
 * The typed number paths called `Math.hypot`, which follows IEEE 754: an infinite argument
 * gives Infinity even when another argument is NaN. mathjs 15.2.0 gives NaN, and so do the
 * factory `hypot` and the BigNumber paths (those rows are pins, not RED tests). The expected
 * values below were read from mathjs 15.2.0.
 */
import { describe, it, expect } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import * as math from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const hypot = math.hypot as unknown as Fn;
const factoryHypot = math.factory_hypot as unknown as Fn;
const bignumber = math.bignumber as unknown as Fn;
const matrix = math.matrix as unknown as Fn;

function expectBigNaN(value: unknown): void {
  expect(value).toBeInstanceOf(BigNumber);
  expect((value as BigNumber).isNaN()).toBe(true);
}

describe('typed hypot with a NaN argument (#1259)', () => {
  it('hypot(Infinity, NaN) is NaN', () => {
    expect(hypot(Infinity, NaN)).toBeNaN();
  });

  it('hypot(NaN, Infinity) is NaN', () => {
    expect(hypot(NaN, Infinity)).toBeNaN();
  });

  it('hypot(-Infinity, NaN, 1) is NaN', () => {
    expect(hypot(-Infinity, NaN, 1)).toBeNaN();
  });

  it('hypot([Infinity, NaN]) is NaN', () => {
    expect(hypot([Infinity, NaN])).toBeNaN();
  });

  it('hypot(matrix([Infinity, NaN])) is NaN', () => {
    expect(hypot(matrix([Infinity, NaN]))).toBeNaN();
  });

  it('hypot of a nested array with Infinity and NaN is NaN', () => {
    expect(hypot([[Infinity], [NaN]])).toBeNaN();
  });

  it('hypot(Infinity, NaN, bignumber(1)) has the value NaN (the type is a number)', () => {
    expect(Number(hypot(Infinity, NaN, bignumber(1)))).toBeNaN();
  });

  it('hypot(NaN) is NaN (pin)', () => {
    expect(hypot(NaN)).toBeNaN();
  });

  it('controls: an infinite argument without NaN and plain numbers keep their values', () => {
    expect(hypot(Infinity, 3)).toBe(Infinity);
    expect(hypot(NaN, 3)).toBeNaN();
    expect(hypot(3, 4)).toBe(5);
    expect(hypot(3, 4, 12)).toBe(13);
    expect(hypot([3, 4])).toBe(5);
  });
});

describe('hypot with a BigNumber and NaN (pins, already correct)', () => {
  it('hypot(bignumber(Infinity), bignumber(NaN)) is a BigNumber NaN', () => {
    expectBigNaN(hypot(bignumber(Infinity), bignumber(NaN)));
  });

  it('hypot(bignumber(Infinity), NaN) is a BigNumber NaN', () => {
    expectBigNaN(hypot(bignumber(Infinity), NaN));
  });

  it('hypot(Infinity, bignumber(NaN)) is a BigNumber NaN', () => {
    expectBigNaN(hypot(Infinity, bignumber(NaN)));
  });

  it('hypot([Infinity, bignumber(NaN)]) is a BigNumber NaN', () => {
    expectBigNaN(hypot([Infinity, bignumber(NaN)]));
  });
});

describe('factory hypot with a NaN argument (pins, already correct)', () => {
  it('factory_hypot(Infinity, NaN) and factory_hypot(NaN, Infinity) are NaN', () => {
    expect(factoryHypot(Infinity, NaN)).toBeNaN();
    expect(factoryHypot(NaN, Infinity)).toBeNaN();
  });

  it('factory_hypot([Infinity, NaN]) and factory_hypot(-Infinity, NaN, 1) are NaN', () => {
    expect(factoryHypot([Infinity, NaN])).toBeNaN();
    expect(factoryHypot(-Infinity, NaN, 1)).toBeNaN();
  });
});

describe('the modulus of a Complex with a NaN part is NaN (same mechanism, #1259)', () => {
  const complex = math.complex as unknown as Fn;
  const abs = math.abs as unknown as Fn;
  const norm = math.norm as unknown as Fn;

  it.each([
    [Infinity, NaN],
    [-Infinity, NaN],
    [NaN, Infinity],
    [NaN, -Infinity],
  ])('abs and norm of complex(%s, %s) are NaN', (re, im) => {
    expect(abs(complex(re, im))).toBeNaN();
    expect(norm(complex(re, im))).toBeNaN();
  });

  it('abs(complex(3, 4)) is 5 (control)', () => {
    expect(abs(complex(3, 4))).toBe(5);
  });
});
