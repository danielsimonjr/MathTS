/**
 * #1204: BigNumber exponents.
 *
 * 1. `toString` and `valueOf` expanded the exponent into zeros. `valueOf` now reads the order of
 *    the value, and `toString` writes exponential notation outside `toExpNeg` / `toExpPos`.
 * 2. `minExponent` / `maxExponent` were declared and never read. A value whose order is above
 *    `maxExponent` is +-Infinity. A value whose order is below `minExponent` is 0 (decimal.js).
 * 3. An exponent sum above 2^53 was rounded. The default bounds are +-9.007e15, below 2^53, so
 *    every in-range exponent is exact and a larger sum overflows or underflows.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { BigNumber } from '../src/types/bignumber.js';

const bn = (s: string): BigNumber => BigNumber.parse(s);

afterEach(() => BigNumber.resetConfig());

describe('#1204 item 1: valueOf reads the order, not a string', () => {
  it.each([
    ['1e100000000', Infinity],
    ['-1e100000000', -Infinity],
    ['1e-100000000', 0],
    ['1.5e300', 1.5e300],
    ['1e308', 1e308],
    ['1.7976931348623157e308', 1.7976931348623157e308],
    ['1e309', Infinity],
    ['5e-324', 5e-324],
    ['1e-400', 0],
    ['123.456', 123.456],
    ['1e25', 1e25],
  ])('valueOf(%s) = %s', (s, expected) => {
    expect(bn(s).valueOf()).toBe(expected);
  });

  it('gives Infinity and 0 for the parsed exponent 9e15', () => {
    expect(bn('1e9000000000000000').valueOf()).toBe(Infinity);
    expect(bn('-1e9000000000000000').valueOf()).toBe(-Infinity);
    expect(bn('1e-9000000000000000').valueOf()).toBe(0);
  });
});

describe('#1204 item 1: toString switches to exponential notation', () => {
  it('writes a huge exponent in a short string', () => {
    expect(bn('1e100000000').toString()).toBe('1e+100000000');
    expect(bn('-1.5e100000000').toString()).toBe('-1.5e+100000000');
    expect(bn('1.5e-100000000').toString()).toBe('1.5e-100000000');
  });

  it('keeps fixed-point output below the default range', () => {
    expect(bn('1e25').toString()).toBe('1' + '0'.repeat(25));
    expect(bn('1e-25').toString()).toBe('0.' + '0'.repeat(24) + '1');
    expect(bn('0.000001').toString()).toBe('0.000001');
    expect(bn('123.456').toString()).toBe('123.456');
    expect(bn('1e999999').toString()).toHaveLength(1_000_000);
  });

  it('switches at the default bounds, as decimal.js does at its own bounds', () => {
    expect(bn('1e1000000').toString()).toBe('1e+1000000');
    expect(bn('1e-1000000').toString()).toBe('1e-1000000');
    expect(bn('1e-999999').toString()).toHaveLength(1_000_001);
  });

  it('follows toExpPos and toExpNeg', () => {
    BigNumber.config({ toExpPos: 21, toExpNeg: -7 });
    expect(bn('1e21').toString()).toBe('1e+21');
    expect(bn('1e20').toString()).toBe('1' + '0'.repeat(20));
    expect(bn('1.5e-7').toString()).toBe('1.5e-7');
    expect(bn('1e-6').toString()).toBe('0.000001');
    BigNumber.resetConfig();
    expect(bn('1e21').toString()).toBe('1' + '0'.repeat(21));
  });

  it('round-trips through parse and toJSON', () => {
    const x = bn('-3.25e100000000');
    expect(BigNumber.parse(x.toString()).toString()).toBe(x.toString());
    expect(x.toJSON().value).toBe('-3.25e+100000000');
    expect(BigNumber.fromJSON(x.toJSON()).toString()).toBe(x.toString());
  });

  it('keeps toFixed as the explicit fixed-point notation', () => {
    expect(bn('1e30').toFixed()).toBe('1' + '0'.repeat(30));
  });
});

describe('#1204 item 2: minExponent and maxExponent are enforced', () => {
  it('keeps the default bounds at +-9.007e15, so an order of 2e9 stays finite', () => {
    expect(BigNumber.config().maxExponent).toBe(9.007e15);
    expect(BigNumber.config().minExponent).toBe(-9.007e15);
    expect(bn('1e2000000000').toString()).toBe('1e+2000000000');
    expect(bn('-2.5e2000000000').isFinite()).toBe(true);
    expect(bn('1e-2000000000').isZero()).toBe(false);
    expect(bn('1e1000000000').multiply(bn('1e1000000000')).toString()).toBe('1e+2000000000');
    expect(bn('1e9007000000000000').isFinite()).toBe(true);
    expect(bn('1e9007000000000001').toString()).toBe('Infinity');
    expect(bn('1e-9007000000000000').isZero()).toBe(false);
    expect(bn('1e-9007000000000001').toString()).toBe('0');
  });

  it('overflows to Infinity and underflows to 0 at a bound of 1e9', () => {
    BigNumber.config({ maxExponent: 1e9, minExponent: -1e9 });
    expect(bn('1e2000000000').toString()).toBe('Infinity');
    expect(bn('-1e2000000000').toString()).toBe('-Infinity');
    expect(bn('1e-2000000000').toString()).toBe('0');
    expect(bn('1e1000000000').toString()).toBe('1e+1000000000');
    expect(bn('9.9e1000000000').isFinite()).toBe(true);
    expect(bn('1e-1000000000').toString()).toBe('1e-1000000000');
    expect(bn('1e1000000001').isFinite()).toBe(false);
    expect(bn('1e-1000000001').isZero()).toBe(true);
  });

  it('follows a changed maxExponent and minExponent', () => {
    BigNumber.config({ maxExponent: 100, minExponent: -100 });
    expect(bn('1e100').isFinite()).toBe(true);
    expect(bn('1e101').toString()).toBe('Infinity');
    expect(bn('1e-100').isZero()).toBe(false);
    expect(bn('1e-101').isZero()).toBe(true);
    expect(bn('1e-101').toString()).toBe('0');
  });

  it('applies the bounds to every operation that changes the exponent', () => {
    BigNumber.config({ maxExponent: 1e9, minExponent: -1e9 });
    const big = bn('1e999999999');
    const small = bn('1e-999999999');
    expect(big.multiply(big).toString()).toBe('Infinity');
    expect(big.negate().multiply(big).toString()).toBe('-Infinity');
    expect(small.multiply(small).toString()).toBe('0');
    expect(bn('9e1000000000').add(bn('9e1000000000')).toString()).toBe('Infinity');
    expect(big.divide(small).toString()).toBe('Infinity');
    expect(small.divide(big).toString()).toBe('0');
    expect(bn('1e500000000').pow(3).toString()).toBe('Infinity');
    expect(bn('1e500000000').pow(-3).toString()).toBe('0');
    expect(bn('1e-500000000').pow(3).toString()).toBe('0');
    expect(bn('1e999999999').multiply(bn('100')).toString()).toBe('Infinity');
    expect(bn('1e999999999').multiply(bn('10')).toString()).toBe('1e+1000000000');
  });

  it('rejects a config bound that is not an integer in range', () => {
    expect(() => BigNumber.config({ maxExponent: 1.5 })).toThrow(RangeError);
    expect(() => BigNumber.config({ maxExponent: -1 })).toThrow(RangeError);
    expect(() => BigNumber.config({ maxExponent: 9.007e15 + 1 })).toThrow(/9007000000000000/);
    expect(() => BigNumber.config({ toExpPos: 9.1e15 })).toThrow(RangeError);
    expect(() => BigNumber.config({ minExponent: 1 })).toThrow(RangeError);
    expect(() => BigNumber.config({ minExponent: -9.007e15 - 1 })).toThrow(RangeError);
    BigNumber.config({ maxExponent: 9.007e15, minExponent: -9.007e15 });
    BigNumber.config({ maxExponent: 1e15, minExponent: -1e15 });
    expect(() => BigNumber.config({ minExponent: NaN })).toThrow(RangeError);
    // A rejected call changes nothing.
    expect(BigNumber.config().maxExponent).toBe(1e15);
    expect(BigNumber.config().minExponent).toBe(-1e15);
  });

  it('keeps the RangeError for an exponent text above 2^53 - 1', () => {
    expect(() => bn('1e9007199254740993')).toThrow(RangeError);
  });
});

describe('#1204 item 3: exponent sums are exact', () => {
  it('gives Infinity, not a rounded exponent, for 3e4503599627370497 cubed', () => {
    const x = bn('3e4503599627370497');
    expect(x.toExponential()).toBe('3e+4503599627370497');
    expect(x.multiply(x).multiply(x).toString()).toBe('Infinity');
    expect(x.multiply(x).multiply(x).cbrt().toExponential()).toBe('Infinity');
  });

  it('overflows or underflows when an exponent sum is above 2^53', () => {
    const big = bn('1e5000000000000000');
    const small = bn('1e-5000000000000000');
    expect(big.multiply(big).toString()).toBe('Infinity');
    expect(big.negate().multiply(big).toString()).toBe('-Infinity');
    expect(small.multiply(small).toString()).toBe('0');
    expect(big.divide(small).toString()).toBe('Infinity');
    expect(small.divide(big).toString()).toBe('0');
    expect(big.multiply(small).toString()).toBe('1');
  });

  it('is exact at the largest allowed bound', () => {
    BigNumber.config({ maxExponent: 1e15, minExponent: -1e15 });
    const x = bn('3e333333333333333');
    const cube = x.multiply(x).multiply(x);
    expect(cube.toExponential()).toBe('2.7e+1000000000000000');
    expect(cube.cbrt().toExponential()).toBe('3e+333333333333333');
    // 2e15 + 1 is above the bound, and the sum is an exact integer, so it overflows.
    const y = bn('1e600000000000000');
    expect(y.multiply(y).toString()).toBe('Infinity');
    expect(y.multiply(bn('1e399999999999999')).toExponential()).toBe('1e+999999999999999');
    expect(y.multiply(bn('1e400000000000001')).toString()).toBe('Infinity');
    const z = bn('1e-600000000000000');
    expect(z.multiply(z).toString()).toBe('0');
  });

  it('keeps the cbrt of a cube exact below the default bound', () => {
    const x = bn('3e300000000');
    expect(x.multiply(x).multiply(x).cbrt().toExponential()).toBe('3e+300000000');
  });
});
