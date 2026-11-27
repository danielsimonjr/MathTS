import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import assert from 'node:assert/strict';

const math = create(all);

describe('BigNumber class identity and valueOf (#1780)', () => {
  const B = math.BigNumber;
  const bn = (x: number | string) => math.bignumber(x);

  it('bignumber(), new BigNumber(), and floor share one constructor', () => {
    const a = bn('2.13');
    const b = new B('2.13');
    const c = math.floor(a, 2) as InstanceType<typeof B>;
    expect(a).toBeInstanceOf(B);
    expect(b).toBeInstanceOf(B);
    expect(c).toBeInstanceOf(B);
    assert.deepStrictEqual(c, math.floor(bn('2.13'), 2));
  });

  it('valueOf returns the decimal string like mathjs 15.3.0', () => {
    expect(bn(0).valueOf()).toBe('0');
    expect(bn(42).valueOf()).toBe('42');
    expect(bn('123.456').valueOf()).toBe('123.456');
    expect(math.sign(bn(0)).valueOf()).toBe('0');
  });

  it('bitwise and arithmetic results use the compat BigNumber class', () => {
    const x = bn(5);
    const y = bn(3);
    const band = math.bitAnd(x, y) as InstanceType<typeof B>;
    const mod = math.mod(x, y) as InstanceType<typeof B>;
    expect(band).toBeInstanceOf(B);
    expect(mod).toBeInstanceOf(B);
    expect(band.toString()).toBe('1');
    expect(mod.toString()).toBe('2');
  });

  it('matrix literals hold the same BigNumber class', () => {
    const m = math.matrix([bn(1), bn(2)]);
    const row = (m as { toArray(): unknown[] }).toArray();
    for (const entry of row) {
      expect(entry).toBeInstanceOf(B);
    }
    const bigMath = create(all, { number: 'BigNumber' });
    const fromExpr = bigMath.evaluate('matrix([bignumber(1), bignumber(2)])') as {
      toArray(): unknown[];
    };
    for (const entry of fromExpr.toArray()) {
      expect(entry).toBeInstanceOf(bigMath.BigNumber);
    }
  });

  it('numeric converts to the compat BigNumber class with string valueOf', () => {
    const converted = math.numeric('3.5', 'BigNumber') as InstanceType<typeof B>;
    expect(converted).toBeInstanceOf(B);
    expect(converted.valueOf()).toBe('3.5');
  });

  it('toJSON keeps mathjs shape', () => {
    expect(bn('0.2').toJSON()).toEqual({ mathjs: 'BigNumber', value: '0.2' });
  });

  it('ceil matches bignumber(…) under deepStrictEqual (decimal.js exponent −0)', () => {
    assert.deepStrictEqual(math.ceil(bn(1.3)), bn(2));
  });

  it('typed converts bigint to the compat BigNumber class', () => {
    const double = math.typed('double', {
      BigNumber: (x: InstanceType<typeof B>) => x.plus(x),
    });
    assert.deepStrictEqual(double(2n), bn(4));
  });
});
