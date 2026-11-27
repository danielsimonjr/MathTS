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

  it('BigNumber unary trig wrappers match mathjs 15.3.0 across precision instances', () => {
    const bigmath = create(all, { number: 'BigNumber', precision: 20 });
    const biggermath = bigmath.create({ number: 'BigNumber', precision: 22 });
    const Big = bigmath.bignumber;

    assert.deepStrictEqual(bigmath.acosh(biggermath.cosh(Big(0.1))), Big('0.10000000000000000012'));
    assert.deepStrictEqual(
      bigmath.asinh(biggermath.sinh(Big(0.1))),
      Big('0.099999999999999999996')
    );
    assert.deepStrictEqual(bigmath.acoth(bigmath.coth(Big(-2))), Big('-1.9999999999999999998'));
    assert.deepStrictEqual(bigmath.acot(bigmath.cot(Big(0.5))), Big(0.5));
    assert.deepStrictEqual(bigmath.acsc(bigmath.csc(Big(0.5))), Big(0.5));
    assert.deepStrictEqual(bigmath.sech(biggermath.pi), Big('0.086266738334054414696'));
    assert.deepStrictEqual(bigmath.sec(Big(0)), Big(1));
    assert.deepStrictEqual(bigmath.cos(Big(0)), Big(1));
    assert.deepStrictEqual(bigmath.sin(Big(0)), Big(0));
    assert.deepStrictEqual(bigmath.sinh(Big(0)), Big(0));
    assert.deepStrictEqual(bigmath.cosh(Big(0)), Big(1));
    assert.deepStrictEqual(bigmath.cot(Big(1)).toString(), '0.64209261593433070301');
  });

  it('BigNumber bitwise infinite and negative shifts, log2(1), diag, and range', () => {
    const bigmath = create(all, { number: 'BigNumber', precision: 20 });
    const Big = bigmath.bignumber;
    const inf = Big(Infinity);
    const ninf = Big(-Infinity);

    expect(bigmath.bitAnd(inf, Big(5))).toEqual(Big(5));
    expect(bigmath.bitOr(inf, Big(5))).toEqual(inf);
    expect(bigmath.bitXor(inf, Big(-1))).toEqual(ninf);
    expect(bigmath.bitXor(inf, Big(1))).toEqual(inf);
    expect(bigmath.bitNot(inf)).toEqual(ninf);
    expect(String(bigmath.leftShift(Big(2), -3))).toBe('NaN');
    expect(String(bigmath.leftShift(inf, inf))).toBe('NaN');
    expect(String(bigmath.leftShift(ninf, inf))).toBe('-1');
    expect(String(bigmath.leftShift(ninf, Infinity))).toBe('-1');
    expect(String(bigmath.leftShift(inf, 2))).toBe('Infinity');
    expect(String(bigmath.rightArithShift(Big(2), -1))).toBe('NaN');
    expect(bigmath.log2(Big(1))).toEqual(Big(0));
    expect(bigmath.log2(Big(8))).toEqual(Big(3));

    const d = bigmath.diag([Big(1), Big(2)]) as unknown[][];
    expect(d[0][1]).toBeInstanceOf(bigmath.BigNumber);
    const r = bigmath.range(Big(1), 4) as { toArray(): unknown[] };
    expect(r.toArray()[0]).toBeInstanceOf(bigmath.BigNumber);
  });

  it('SparseMatrix, diag/range matrix, log2 non-powers, and BigNumber helpers coverage (#1780)', () => {
    const bigmath = create(all, { number: 'BigNumber', precision: 20 });
    const Big = bigmath.bignumber;
    const B = bigmath.BigNumber;
    const inf = Big(Infinity);
    const ninf = Big(-Infinity);

    // SparseMatrix BigNumber operations
    const sp = (bigmath.sparse as (data: unknown) => unknown)([
      [Big(1), Big(0)],
      [Big(0), Big(2)],
    ]) as {
      toArray(): unknown[][];
      map(fn: (v: unknown) => unknown): { toArray(): unknown[][] };
      clone(): { toArray(): unknown[][] };
      get(idx: number[]): unknown;
      set(idx: number[], val: unknown): unknown;
    };
    expect(sp.toArray()[0][0]).toBeInstanceOf(B);
    expect(sp.clone().toArray()[1][1]).toBeInstanceOf(B);
    expect(sp.map((v) => v).toArray()[0][0]).toBeInstanceOf(B);
    expect(sp.get([0, 0])).toBeInstanceOf(B);
    sp.set([0, 1], Big(3));
    expect(sp.get([0, 1])).toBeInstanceOf(B);

    // diag with Matrix input + range with plain numbers
    const dm = bigmath.diag(bigmath.matrix([Big(1), Big(2)])) as { toArray(): unknown[][] };
    expect(dm.toArray()[0][1]).toBeInstanceOf(B);
    const rNum = bigmath.range(1, 3) as { toArray(): unknown[] };
    expect(rNum.toArray()).toEqual([1, 2]);

    // log2 non-power-of-2 and large power-of-2
    expect(String(bigmath.log2(Big(3)))).toMatch(/^1\.5849625/);
    expect(String(bigmath.log2(Big(0.5)))).toBe('-1');

    // Additional bitwise shift edge cases
    expect(String(bigmath.leftShift(Big(2), Big(-1)))).toBe('NaN');
    expect(String(bigmath.leftShift(inf, Big(2)))).toBe('Infinity');
    expect(String(bigmath.leftShift(inf, Infinity))).toBe('NaN');
    expect(String(bigmath.leftShift(ninf, Big(-1)))).toBe('NaN');
    expect(String(bigmath.rightArithShift(inf, Big(2)))).toBe('Infinity');
    expect(String(bigmath.rightArithShift(ninf, inf))).toBe('-1');
    expect(String(bigmath.bitNot(Big(5)))).toBe('-6');
    expect(bigmath.bitAnd(5, 3)).toBe(1);
    expect(bigmath.bitOr(5, 2)).toBe(7);
    expect(bigmath.bitXor(5, 3)).toBe(6);

    // BigNumber fromJSON, toNumber, Symbol.toPrimitive
    const parsed = B.fromJSON({ value: '12.5' });
    expect(parsed.toString()).toBe('12.5');
    expect(Number(parsed)).toBe(12.5);
    expect(`${parsed}`).toBe('12.5');
    expect(B.config().precision).toBeGreaterThan(0);

    // Additional SparseMatrix + BigNumber + error-parity branches
    const sp2 = new bigmath.SparseMatrix([
      [Big(1), Big(0)],
      [Big(0), Big(2)],
    ] as unknown as number[][]) as {
      toArray(): unknown[][];
      valueOf(): unknown[][];
      forEach(cb: (v: unknown) => void): void;
      resize(size: number[], defaultValue?: unknown): { toArray(): unknown[][] };
      subset(index: unknown): unknown;
    };
    const seen: unknown[] = [];
    sp2.forEach((v) => seen.push(v));
    expect(seen.length).toBeGreaterThan(0);
    expect(sp2.valueOf()[0][0]).toBeInstanceOf(B);
    expect(sp2.resize([2, 2]).toArray()[0][0]).toBeInstanceOf(B);
    expect(sp2.subset(bigmath.index(0, 0))).toBeInstanceOf(B);

    // Unit and Complex with BigNumber normalization
    const u = bigmath.unit(Big(5), 'cm') as { value: unknown };
    expect(u.value).toBeInstanceOf(B);
    expect((bigmath.abs as (x: unknown) => unknown)(u)).toBeDefined();
    expect(() => (bigmath.bitNot as (x: unknown) => unknown)(1.5)).toThrow(
      'Integer expected in function bitNot'
    );
    expect(() => (bigmath.bignumber as (...a: unknown[]) => unknown)(1, 2)).toThrow(TypeError);
    expect(bigmath.bignumber()).toEqual(Big(0));
    expect(bigmath.bignumber(123n)).toEqual(Big(123));
    expect(bigmath.bignumber([1, 2])).toEqual([Big(1), Big(2)]);
    expect(
      (bigmath.bignumber(bigmath.matrix([1, 2])) as { toArray(): unknown[] }).toArray()
    ).toEqual([Big(1), Big(2)]);
  });

  it('covers mixed-bound range, log2 edge cases, and zeta across numeric types', () => {
    const m = create(all, { precision: 20 });
    const big = create(all, { number: 'BigNumber', precision: 20 });
    const B = big.BigNumber;

    // Mixed BigNumber + number bounds in range
    const r = (big.range as (a: unknown, b: unknown) => { toArray(): unknown[] })(
      big.bignumber(1),
      4
    );
    expect(r.toArray()).toEqual([new B(1), new B(2), new B(3)]);

    // log2 edge cases on BigNumber
    expect(big.log2(big.bignumber(1))).toEqual(new B(0));
    expect(big.log2(big.bignumber(3))).toBeInstanceOf(B);
    expect(big.log2(big.bignumber(8))).toEqual(new B(3));

    // zeta on number, negative number (reflection formula), and BigNumber
    expect(m.zeta(2) as number).toBeCloseTo((Math.PI * Math.PI) / 6, 10);
    expect(m.zeta(-20) as number).toBeCloseTo(0, 10);
    expect(Number(String(big.zeta(big.bignumber(2))))).toBeCloseTo((Math.PI * Math.PI) / 6, 6);
  });

  it('matches math.BigNumber identity across instance functions and { number: "BigNumber" }', () => {
    const big = create(all, { number: 'BigNumber', precision: 20 });
    const B = big.BigNumber;
    const Big = big.bignumber;

    // Exact constructor identity: math.bignumber(1).constructor === math.BigNumber
    assert.strictEqual(Big(1).constructor, B);
    assert.strictEqual(new B(1).constructor, B);
    expect(Big(1)).toBeInstanceOf(B);

    // InstanceBigNumber returned by hypot, numeric, identity, ones
    assert.deepStrictEqual(big.hypot(Big(3), Big(4)), Big(5));
    assert.deepStrictEqual(big.numeric('12.5', 'BigNumber'), Big('12.5'));
    assert.deepStrictEqual(
      big.identity(Big(2)),
      big.matrix([
        [Big(1), Big(0)],
        [Big(0), Big(1)],
      ])
    );
    assert.deepStrictEqual(big.ones(Big(2)), big.matrix([Big(1), Big(1)]));

    // max/min with { number: 'BigNumber' } on numeric strings
    assert.deepStrictEqual(big.max('10', '2'), Big(10));
    assert.deepStrictEqual(big.min('10', '2'), Big(2));

    // atan2 mixed number/boolean + BigNumber, csch, acsch, cos
    assert.deepStrictEqual(big.atan2(1, Big(1)), Big('0.78539816339744830962'));
    assert.deepStrictEqual(big.atan2(Big(1), true), Big('0.78539816339744830962'));
    assert.deepStrictEqual(big.csch(Big(1)), Big('0.85091812823932154512'));
    assert.deepStrictEqual(String(big.acsch(Big(0))), 'Infinity');
    assert.deepStrictEqual(big.acsch(big.csch(Big(2))), Big(2));

    // rotate, rotationMatrix, and sign on Unit with Fraction/Complex
    const rot = big.rotate([Big(1), Big(0)], Big(0)) as unknown[];
    expect(rot[0]).toBeInstanceOf(B);
    const rm = big.rotationMatrix(Big(0)) as { toArray(): unknown[][] };
    expect(rm.toArray()[0][0]).toBeInstanceOf(B);
    assert.deepStrictEqual(big.sign(big.unit(big.fraction(5), 'cm')), big.fraction(1));
    assert.deepStrictEqual(big.sign(big.unit(big.complex(3, 4), 'mi')), big.complex(0.6, 0.8));

    // Sibling instance isolation
    const a = create(all, { number: 'BigNumber', precision: 20 });
    const b = create(all, { number: 'BigNumber', precision: 7 });
    expect(String(b.bignumber(1).div(3))).toBe('0.3333333');
    expect(String(a.bignumber(1).div(3)).length).toBeGreaterThan(15);
  });
});
