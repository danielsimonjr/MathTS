/**
 * #1118: add and multiply gave every digit of the exact result, so a product grew to twice the
 * configured precision, and a long loop grew without bound. Each arithmetic result now rounds to
 * `config.precision` with the configured rounding mode, as decimal.js does.
 *
 * Oracle: Python `decimal` (ROUND_HALF_UP). mathjs 15.2.0 agrees with it on every case.
 * Fixture rows: [operation, precision, a, b, expected].
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { BigNumber } from '../src/types/bignumber.js';

type Row = [string, number, string, string, string];
const rows = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./fixtures/bignumber-round-1118.json', import.meta.url)),
    'utf8'
  )
) as Row[];

const bn = (v: string): BigNumber => BigNumber.parse(v);
const sigDigits = (x: BigNumber): number =>
  x.abs().toExponential().replace(/e.*/, '').replace('.', '').length;

afterEach(() => {
  BigNumber.resetConfig();
});

function run(op: string, a: BigNumber, b: BigNumber): BigNumber {
  switch (op) {
    case 'add':
      return a.add(b);
    case 'subtract':
      return a.subtract(b);
    case 'multiply':
      return a.multiply(b);
    case 'divide':
      return a.divide(b);
    case 'square':
      return a.multiply(a);
    case 'sqrt':
      return a.sqrt();
    case 'pow':
      return a.pow(Number(b.toString()));
    default:
      throw new Error(op);
  }
}

describe('#1118 results round to the configured precision (oracle: Python decimal)', () => {
  for (const precision of [20, 64, 500]) {
    it(`matches the oracle at precision ${precision}`, () => {
      BigNumber.config({ precision });
      const own = rows.filter((r) => r[1] === precision);
      expect(own.length).toBeGreaterThan(20);
      for (const [op, , a, b, expected] of own) {
        const result = run(op, bn(a), b === '' ? bn('0') : bn(b));
        expect(result.toString(), `${op}(${a}, ${b}) at ${precision}`).toBe(
          bn(expected).toString()
        );
        expect(sigDigits(result)).toBeLessThanOrEqual(precision);
      }
    });
  }

  it('the issue cases: a 130-digit square and a lost small addend', () => {
    BigNumber.config({ precision: 64 });
    const x = bn('9'.repeat(64));
    expect(sigDigits(x.multiply(x))).toBeLessThanOrEqual(64);
    BigNumber.config({ precision: 20 });
    expect(bn('1').add(bn('1e-30')).toString()).toBe('1');
    expect(bn('1').subtract(bn('1e-30')).toString()).toBe('1');
  });

  it('adding zero or multiplying by one rounds a long operand, as decimal.js does', () => {
    BigNumber.config({ precision: 5 });
    const long = bn('1.234567891');
    expect(long.add(bn('0')).toString()).toBe('1.2346');
    expect(bn('0').add(long).toString()).toBe('1.2346');
    expect(long.multiply(bn('1')).toString()).toBe('1.2346');
  });

  it('uses the configured rounding mode', () => {
    BigNumber.config({ precision: 3, rounding: 'down' });
    expect(bn('1.2349').add(bn('0.0001')).toString()).toBe('1.23');
    BigNumber.config({ precision: 3, rounding: 'up' });
    expect(bn('1.231').add(bn('0.0001')).toString()).toBe('1.24');
    BigNumber.config({ precision: 3, rounding: 'halfEven' });
    expect(bn('1.225').multiply(bn('1')).toString()).toBe('1.22');
    expect(bn('1.235').multiply(bn('1')).toString()).toBe('1.24');
  });

  it('negate and abs keep every digit, and the constructor does not round', () => {
    BigNumber.config({ precision: 5 });
    expect(bn('-1.234567891').negate().toString()).toBe('1.234567891');
    expect(bn('-1.234567891').abs().toString()).toBe('1.234567891');
    expect(bn('1.234567891').toString()).toBe('1.234567891');
  });

  it('an exact result inside the precision is unchanged', () => {
    BigNumber.config({ precision: 20 });
    expect(bn('0.1').add(bn('0.2')).toString()).toBe('0.3');
    expect(bn('12345').multiply(bn('6789')).toString()).toBe('83810205');
  });

  it('a repeated product stays within the precision (the solveODE growth)', () => {
    BigNumber.config({ precision: 64 });
    let x = bn('1.0000000000000000000000000000000000000000000000000000000000000001');
    for (let i = 0; i < 9; i++) x = x.multiply(x).add(bn('1e-9'));
    expect(sigDigits(x)).toBeLessThanOrEqual(64);
  });
});

describe('#1118 mod is exact, and the digit count has no decimal string', () => {
  it('mod with a dividend longer than the precision gives the exact remainder', () => {
    BigNumber.config({ precision: 20 });
    // Python: 987654321098765432109876 % 123456789012345. A rounded q * b gave 111116623219876.
    expect(bn('987654321098765432109876').mod(bn('123456789012345')).toString()).toBe(
      '111116623221036'
    );
    expect(bn('-987654321098765432109876').mod(bn('123456789012345')).toString()).toBe(
      '-111116623221036'
    );
    expect(bn('987654321098765432109876').mod(bn('-123456789012345')).toString()).toBe(
      '111116623221036'
    );
  });

  it('mod does not round a remainder that is longer than the precision', () => {
    BigNumber.config({ precision: 20 });
    // Python: a % b. The Euclidean algorithm on the pair gives math.gcd(a, b) == 987654321987.
    const a = bn('987654321987000000115555555672479');
    const b = bn('9876543219906543209913519');
    expect(a.mod(b).toString()).toBe('9872888899030746865585998');
    let x = a;
    let y = b;
    while (!y.isZero()) [x, y] = [y, x.mod(y)];
    expect(x.toString()).toBe('987654321987');
    expect(b.mod(a).toString()).toBe('9876543219906543209913519');
  });

  it('mod keeps the usual cases: fractions, a smaller dividend, a zero remainder', () => {
    BigNumber.config({ precision: 20 });
    expect(bn('5.5').mod(bn('0.2')).toString()).toBe('0.1');
    expect(bn('-7').mod(bn('3')).toString()).toBe('-1');
    expect(bn('2').mod(bn('7')).toString()).toBe('2');
    expect(bn('1200').mod(bn('0.25')).toString()).toBe('0');
    expect(bn('1234.5').mod(bn('1e2')).toString()).toBe('34.5');
    expect(bn('0.007').mod(bn('200')).toString()).toBe('0.007');
  });

  it('mod with a large exponent gap builds no large power of ten', () => {
    BigNumber.config({ precision: 20 });
    // Python: pow(10, 1000000, 7) == 4 and (3 * pow(10, 123456789, 97)) % 97 == 56.
    expect(bn('1e1000000').mod(bn('7')).toString()).toBe('4');
    expect(bn('3e123456789').mod(bn('97')).toString()).toBe('56');
    expect(bn('7').mod(bn('1e1000000')).toString()).toBe('7');
  });

  it('rounds correctly at each power-of-ten boundary of the coefficient', () => {
    BigNumber.config({ precision: 5 });
    for (const digits of [5, 6, 7, 16, 17, 19, 20, 38, 39, 77, 78, 154, 155, 309, 617, 2100]) {
      const nines = '9'.repeat(digits); // 10^digits - 1
      const power = '1' + '0'.repeat(digits); // 10^digits
      const expectedNines = digits <= 5 ? nines : '1' + '0'.repeat(digits);
      expect(bn(nines).add(bn('0')).toString(), `nines ${digits}`).toBe(expectedNines);
      expect(bn(power).add(bn('1')).toString(), `power + 1 ${digits}`).toBe(power);
      // 12345|49...9 rounds down and 12345|50...0 rounds up, whatever the length of the tail.
      expect(
        bn('12345' + '4' + '9'.repeat(digits))
          .multiply(bn('1'))
          .toString()
      ).toBe('12345' + '0'.repeat(digits + 1));
      expect(
        bn('12345' + '5' + '0'.repeat(digits - 1) + '1')
          .multiply(bn('1'))
          .toString()
      ).toBe('12346' + '0'.repeat(digits + 1));
    }
  });

  it('a precision above the power-of-ten cache rounds correctly', () => {
    BigNumber.config({ precision: 3000 });
    const x = bn('1.' + '3'.repeat(2999));
    expect(sigDigits(x.multiply(x))).toBe(3000);
    expect(x.add(bn('1e-3500')).toString()).toBe(x.toString());
  });
});
