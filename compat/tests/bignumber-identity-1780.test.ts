import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import assert from 'node:assert/strict';

const math = create(all);

describe('BigNumber class identity and valueOf (#1780)', () => {
  const B = math.BigNumber;
  const bn = (x: number | string) => math.bignumber(x);
  const isInstanceDecimal = (x: unknown): boolean =>
    math.isBigNumber(x) &&
    ((x as { constructor?: { name?: string } }).constructor?.name ?? '').includes('BigNumber');

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
    expect(isInstanceDecimal(converted)).toBe(true);
    expect(converted.valueOf()).toBe('3.5');
  });

  it('toJSON keeps mathjs shape', () => {
    expect(bn('0.2').toJSON()).toEqual({ mathjs: 'BigNumber', value: '0.2' });
  });

  it('ceil matches bignumber(…) under deepStrictEqual (decimal.js exponent −0)', () => {
    assert.strictEqual((math.ceil(bn(1.3)) as InstanceType<typeof B>).valueOf(), bn(2).valueOf());
  });

  it('divide promotes booleans when the other operand is a BigNumber', () => {
    const a = bn('0.3');
    assert.strictEqual((math.divide(a, true) as InstanceType<typeof B>).valueOf(), a.valueOf());
    assert.strictEqual((math.divide(true, bn('2')) as InstanceType<typeof B>).valueOf(), '0.5');
  });

  it('typed converts bigint to the compat BigNumber class', () => {
    const double = math.typed('double', {
      BigNumber: (x: InstanceType<typeof B>) => x.plus(x),
    });
    assert.strictEqual((double(2n) as InstanceType<typeof B>).valueOf(), bn(4).valueOf());
  });

  it('instance precision applies to BigNumber.prototype methods', () => {
    const mymath = create(all, { precision: 32 });
    const a = mymath.bignumber(1).dividedBy(3);
    expect(a.toString()).toBe('0.33333333333333333333333333333333');
  });

  it('log10 on large bigint returns a number in default number mode', () => {
    const log10Bigint = math.log10 as unknown as (x: bigint) => number;
    expect(Math.floor(log10Bigint(123456789012345678901234567890n))).toBe(29);
  });

  it('diag fills structural zeros with CompatBigNumber', () => {
    const x = [bn(1), bn(2), bn(3)];
    const d = math.diag(x) as unknown[][];
    expect(isInstanceDecimal(d[0][1])).toBe(true);
    expect(String(d[0][1])).toBe('0');
  });

  it('range with mixed BigNumber and number bounds returns BigNumber matrix', () => {
    const r = math.range(bn(1), 3) as { toArray(): unknown[] };
    const row = r.toArray();
    expect(isInstanceDecimal(row[0])).toBe(true);
    expect(isInstanceDecimal(row[1])).toBe(true);
  });

  it('SparseMatrix(dense, "BigNumber") exposes BigNumber valueOf and zero', () => {
    const m1 = math.matrix([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    const Sparse = math.SparseMatrix as new (...args: unknown[]) => {
      valueOf(): unknown[][];
      zero: InstanceType<typeof B>;
    };
    const m2 = new Sparse(m1, 'BigNumber');
    expect(isInstanceDecimal(m2.zero)).toBe(true);
    expect(isInstanceDecimal(m2.valueOf()[0][0])).toBe(true);
  });

  it('max tolerates unit(NaN) like mathjs', () => {
    const raw = math.max(math.unit(NaN, 's'), math.unit(123, 's'));
    const unitLike = raw as { value: number };
    assert.ok(Number.isNaN(unitLike.value));
  });

  it('bignumber(bigint) keeps full integer precision', () => {
    assert.deepStrictEqual(math.bignumber(12345678901234567890n), new B('12345678901234567890'));
  });

  it('arg of a negative BigNumber uses full-precision pi', () => {
    const neg = bn(-2);
    const a = math.arg(neg) as InstanceType<typeof B>;
    expect(isInstanceDecimal(a)).toBe(true);
    expect(a.toString()).toBe('3.141592653589793238462643383279502884197169399375105820974944592');
  });

  it('log2 of exact powers of two returns exact integer BigNumbers', () => {
    const big = create(all, { precision: 100 });
    const B100 = big.BigNumber;
    assert.deepStrictEqual(big.log2(big.bignumber(1)), new B100(0));
    assert.deepStrictEqual(big.log2(big.bignumber(8)), new B100(3));
    assert.deepStrictEqual(big.log2(big.bignumber(2).pow(500)), new B100(500));
  });

  it('evaluate(distance) returns instance BigNumber', () => {
    const big = create(all, { number: 'BigNumber', precision: 32 });
    const five = big.evaluate('distance([1, 2], [4, 6])');
    assert.deepStrictEqual(five, big.bignumber(5));
  });

  it('asin from a parent instance preserves child instance BigNumber identity', () => {
    const bigmath = create(all, { number: 'BigNumber', precision: 20 });
    const bigmath61 = bigmath.create({ number: 'BigNumber', precision: 61 });
    const asinBig = bigmath.asin;
    const expected = bigmath61.bignumber(
      '-1.141592653589793238462643383279502884197169399375105820974945'
    );
    assert.deepStrictEqual(asinBig(bigmath61.sin(bigmath61.bignumber(-2))), expected);
    assert.deepStrictEqual(asinBig(bigmath.sin(bigmath.bignumber(0))), bigmath.bignumber(0));
  });

  it('csc on pi/8 matches mathjs 15.3.0 rounded output', () => {
    const bigmath = create(all, { number: 'BigNumber', precision: 20 });
    const pi = bigmath.pi as InstanceType<typeof bigmath.BigNumber>;
    assert.strictEqual(bigmath.csc(pi.div(8)).toString(), '2.6131259297527530557');
    assert.deepStrictEqual(bigmath.csc(pi), bigmath.bignumber('-26769019461318409709'));
  });
});
