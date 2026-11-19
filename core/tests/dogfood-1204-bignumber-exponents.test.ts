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
    expect(() => BigNumber.config({ maxExponent: 2 ** 53 - 2 ** 31 + 1 })).toThrow(
      /9007197107257344/
    );
    expect(() => BigNumber.config({ toExpPos: 2 ** 53 })).toThrow(RangeError);
    expect(() => BigNumber.config({ minExponent: 1 })).toThrow(RangeError);
    expect(() => BigNumber.config({ minExponent: -(2 ** 53 - 2 ** 31) - 1 })).toThrow(RangeError);
    // The limit itself is accepted.
    BigNumber.config({ maxExponent: 2 ** 53 - 2 ** 31, minExponent: -(2 ** 53 - 2 ** 31) });
    // A rejected call changes nothing.
    BigNumber.config({ maxExponent: 1e15, minExponent: -1e15 });
    expect(() => BigNumber.config({ maxExponent: 1.5 })).toThrow(RangeError);
    expect(() => BigNumber.config({ minExponent: 1 })).toThrow(RangeError);
    expect(() => BigNumber.config({ minExponent: NaN })).toThrow(RangeError);
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

  it('is exact at a configured bound of 1e15', () => {
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

describe('#1204: the bounds apply to a result, not to the inner steps of a function', () => {
  const functions: [string, (x: BigNumber) => BigNumber, string][] = [
    ['exp', (x) => x.exp(), '10'],
    ['exp', (x) => x.exp(), '-10'],
    ['expm1', (x) => x.expm1(), '0.5'],
    ['ln', (x) => x.ln(), '2'],
    ['log10', (x) => x.log10(), '2'],
    ['log1p', (x) => x.log1p(), '0.5'],
    ['sin', (x) => x.sin(), '1'],
    ['cos', (x) => x.cos(), '1'],
    ['tan', (x) => x.tan(), '1'],
    ['asin', (x) => x.asin(), '0.5'],
    ['acos', (x) => x.acos(), '0.5'],
    ['atan', (x) => x.atan(), '0.5'],
    ['sinh', (x) => x.sinh(), '1'],
    ['tanh', (x) => x.tanh(), '0.5'],
    ['pow 0.5', (x) => x.pow(bn('0.5')), '2'],
    ['sqrt', (x) => x.sqrt(), '2'],
    ['cbrt', (x) => x.cbrt(), '2'],
  ];

  it.each(functions)('%s gives the same digits with bounds of +-5 (case %#)', (_name, f, arg) => {
    const expected = f(bn(arg)).toString();
    BigNumber.config({ maxExponent: 5, minExponent: -5 });
    expect(f(bn(arg)).toString()).toBe(expected);
  });

  it('still applies the bounds to the result of a function', () => {
    const inRange = bn('1000').pow(bn('1.5')).toString();
    expect(inRange.slice(0, 20)).toBe('31622.77660168379331');
    BigNumber.config({ maxExponent: 5, minExponent: -5 });
    expect(bn('14').exp().toString()).toBe('Infinity'); // 1.2e6
    expect(bn('-14').exp().toString()).toBe('0'); // 8.3e-7
    expect(bn('0.000001').sin().toString()).toBe('0');
    expect(bn('1000').pow(2).toString()).toBe('Infinity');
    expect(bn('1000').pow(bn('1.5')).toString()).toBe(inRange);
  });

  it('keeps an integer power that is in range when the bounds are not symmetric', () => {
    BigNumber.config({ maxExponent: 5, minExponent: -100 });
    // The inner product 1000^3 is above maxExponent; the result 1e-9 is in range.
    expect(bn('1000').pow(-3).toString()).toBe('0.000000001');
    expect(bn('1000').pow(3).toString()).toBe('Infinity');
  });

  it('keeps a hypot that is in range when a square is not', () => {
    BigNumber.config({ maxExponent: 100, minExponent: -100 });
    expect(bn('3e-60').hypot(bn('4e-60')).toExponential()).toBe('5e-60');
    expect(bn('3e60').hypot(bn('4e60')).toExponential()).toBe('5e+60');
    expect(bn('3e100').hypot(bn('4e100')).toExponential()).toBe('5e+100');
    expect(bn('6e100').hypot(bn('8e100')).toString()).toBe('Infinity');
  });

  it('does not keep a constant that a bound changed', () => {
    BigNumber.config({ minExponent: 0, precision: 61 });
    expect(BigNumber.ln2At().toString()).toBe('0'); // order -1 is below minExponent 0
    BigNumber.config({ minExponent: -5 });
    expect(BigNumber.ln2At().toString().slice(0, 12)).toBe('0.6931471805');
  });
});

describe('#1204: a function whose inner square is above the limit, with the default bounds', () => {
  it('keeps a hypot whose squares are out of range', () => {
    expect(bn('3e5000000000000000').hypot(bn('4e5000000000000000')).toExponential()).toBe(
      '5e+5000000000000000'
    );
    expect(bn('3e-5000000000000000').hypot(bn('-4e-5000000000000000')).toExponential()).toBe(
      '5e-5000000000000000'
    );
    expect(bn('3e9007000000000000').hypot(bn('4e9007000000000000')).toExponential()).toBe(
      '5e+9007000000000000'
    );
    expect(bn('6e9007000000000000').hypot(bn('8e9007000000000000')).toString()).toBe('Infinity');
    expect(bn('3e-9007000000000000').hypot(bn('4e-9007000000000000')).toExponential()).toBe(
      '5e-9007000000000000'
    );
    expect(bn('0').hypot(bn('-4e5000000000000000')).toExponential()).toBe('4e+5000000000000000');
    expect(bn('3').hypot(bn('4')).toString()).toBe('5');
    expect(bn('0').hypot(bn('0')).toString()).toBe('0');
    expect(bn('1').hypot(bn('1')).toString()).toBe(bn('2').sqrt().toString());
  });

  it('gives ln(2x), not NaN, for the asinh of a value whose square is out of range', () => {
    // 5e15 * ln(10) + ln(2)
    const expected = '1.15129254649702291132371378333671304552376289';
    expect(bn('1e5000000000000000').asinh().toExponential().startsWith(expected)).toBe(true);
    expect(
      bn('-1e5000000000000000')
        .asinh()
        .toExponential()
        .startsWith('-' + expected)
    ).toBe(true);
    expect(bn('1e5000000000000000').asinh().toExponential().endsWith('e+16')).toBe(true);
  });
});

describe('#1255 BigNumber.hypotN', () => {
  it('shifts the exponent exactly and rounds the root once', () => {
    BigNumber.config({ precision: 20 });
    try {
      const x = new BigNumber('368908340768.57994560571');
      const y = new BigNumber('3.0302e-19');
      expect(BigNumber.hypotN([x, y]).toString()).toBe('368908340768.57994561');
      expect(x.hypot(y).toString()).toBe('368908340768.57994561');
    } finally {
      BigNumber.resetConfig();
    }
  });
  it('takes any number of values', () => {
    const v = ['2e9000000000000000', '3e9000000000000000', '6e9000000000000000'].map(
      (s) => new BigNumber(s)
    );
    expect(BigNumber.hypotN(v).toString()).toBe('7e+9000000000000000');
    expect(BigNumber.hypotN([]).toString()).toBe('0');
    expect(BigNumber.hypotN([new BigNumber(1), BigNumber.fromNumber(NaN)]).isNaN()).toBe(true);
    expect(BigNumber.hypotN([BigNumber.fromNumber(-Infinity)]).toString()).toBe('Infinity');
  });
});
