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
import { format as formatBigNumber } from '../src/bignumber-formatter.js';

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

  it('the issue cases: a 128-digit square and a lost small addend', () => {
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

  it('mod and compare of two values with the same large exponent build no long string', () => {
    // A string of 9e8 zeros is longer than the longest string of V8.
    const a = bn('7e900000000');
    const b = bn('3e900000000');
    expect(a.mod(b).toExponential()).toBe('1e+900000000');
    expect(a.compareTo(b)).toBe(1);
    expect(b.compareTo(a)).toBe(-1);
    expect(a.equals(bn('7e900000000'))).toBe(true);
    expect(bn('1.23').compareTo(bn('1.2301'))).toBe(-1);
    expect(bn('12301e-4').compareTo(bn('123e-2'))).toBe(1);
    expect(bn('-5e30').compareTo(bn('-49e29'))).toBe(-1);
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

describe('#1118 methods that added or multiplied a held value', () => {
  it('log1p keeps an argument that 1 + x loses (oracle: mpmath)', () => {
    const cases: [number, string, string][] = [
      [20, '1e-40', '1e-40'],
      [20, '1e-25', '1e-25'],
      [20, '-1e-25', '-1e-25'],
      [20, '3.7e-22', '3.7e-22'],
      [20, '1e-10', '0.000000000099999999995'],
      [20, '0.001', '0.00099950033308353316681'],
      [20, '0.3', '0.26236426446749105204'],
      [20, '-0.3', '-0.35667494393873237891'],
      [20, '0.49', '0.39877611995736777296'],
      [20, '-0.49', '-0.67334455326376559639'],
      [20, '0.5', '0.40546510810816438198'],
      [20, '-0.75', '-1.3862943611198906188'],
      [20, '3', '1.3862943611198906188'],
      [
        64,
        '1e-40',
        '0.00000000000000000000000000000000000000009999999999999999999999999999999999999999500000000000000000000000',
      ],
      [
        64,
        '-1e-25',
        '-0.0000000000000000000000001000000000000000000000000050000000000000000000000003333333333333',
      ],
      [
        64,
        '3.7e-22',
        '0.0000000000000000000003699999999999999999999315500000000000000000168843333333333333333',
      ],
      [64, '0.3', '0.2623642644674910520354959868809543972041664561314341403857176097'],
      [64, '-0.49', '-0.6733445532637655963912030545730761749665094068490517130347237304'],
    ];
    for (const [precision, x, expected] of cases) {
      BigNumber.config({ precision });
      expect(bn(x).log1p().toString(), `log1p(${x}) at ${precision}`).toBe(bn(expected).toString());
    }
  });

  it('asinh, acosh, atanh, acos and asin keep a result near 0 and an argument near 1 (oracle: mpmath)', () => {
    type Method = 'asinh' | 'acosh' | 'atanh' | 'acos' | 'asin';
    const cases: [number, Method, string, string][] = [
      [20, 'asinh', '1e-40', '0.00000000000000000000000000000000000000010000000000000000000'],
      [20, 'asinh', '-1e-40', '-0.00000000000000000000000000000000000000010000000000000000000'],
      [20, 'asinh', '-1e25', '-58.257774505411087410'],
      [20, 'asinh', '0.3', '0.29567304756342243910'],
      [20, 'asinh', '-12345678901234567890123.456', '-51.560740248744602919'],
      [20, 'acosh', '1.000000000000000000000001', '0.0000000000014142135623730950488'],
      [20, 'acosh', '1', '0.0'],
      [20, 'acosh', '3', '1.7627471740390860505'],
      [20, 'acosh', '1e25', '58.257774505411087410'],
      [20, 'atanh', '1e-40', '0.00000000000000000000000000000000000000010000000000000000000'],
      [20, 'atanh', '-1e-25', '-0.00000000000000000000000010000000000000000000'],
      [20, 'atanh', '0.3', '0.30951960420311171547'],
      [20, 'atanh', '-0.999999999999999999999999', '-27.977594706208520863'],
      [20, 'acos', '0.999999999999999999999999', '0.0000000000014142135623730950488'],
      [20, 'acos', '-0.999999999999999999999999', '3.1415926535883790249'],
      [20, 'acos', '0.3', '1.2661036727794991113'],
      [20, 'acos', '-0.75', '2.4188584057763776273'],
      [20, 'acos', '1', '0.0'],
      [20, 'acos', '-1', '3.1415926535897932385'],
      [20, 'acos', '0.5', '1.0471975511965977462'],
      [20, 'asin', '0.99999999999999999999999999999999999', '1.5707963267948966148'],
      [20, 'asin', '-0.999999999999999999999999', '-1.5707963267934824057'],
      [20, 'asin', '0.3', '0.30469265401539750797'],
      [
        64,
        'asinh',
        '1e-40',
        '0.0000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000',
      ],
      [
        64,
        'asinh',
        '-1e-40',
        '-0.0000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000',
      ],
      [64, 'asinh', '-1e25', '-58.25777450541108740986701848856728175810303735007958215495387753'],
      [64, 'asinh', '0.3', '0.2956730475634224391027105297335170824513810118353705780864738127'],
      [
        64,
        'asinh',
        '-12345678901234567890123.456',
        '-51.56074024874460291886804577109281244235695591700991458364706427',
      ],
      [
        64,
        'acosh',
        '1.000000000000000000000001',
        '0.000000000001414213562373095048801688606358567880811751141902914238872801019',
      ],
      [64, 'acosh', '1', '0.0'],
      [64, 'acosh', '3', '1.762747174039086050465218649959584618056320656523270821506591217'],
      [64, 'acosh', '1e25', '58.25777450541108740986701848856728175810303735007957715495387753'],
      [
        64,
        'atanh',
        '1e-40',
        '0.0000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000',
      ],
      [
        64,
        'atanh',
        '-1e-25',
        '-0.0000000000000000000000001000000000000000000000000000000000000000000000000003333333333333',
      ],
      [64, 'atanh', '0.3', '0.3095196042031117154740673490610694375840916075891729639798276804'],
      [
        64,
        'atanh',
        '-0.999999999999999999999999',
        '-27.97759470620852086292451326694145877525096793072534083946027482',
      ],
      [
        64,
        'acos',
        '0.999999999999999999999999',
        '0.000000000001414213562373095048801688842060828276327592608851034940489147448',
      ],
      [
        64,
        'acos',
        '-0.999999999999999999999999',
        '3.141592653588379024900270288230701195355108571098778228366093557',
      ],
      [64, 'acos', '0.3', '1.266103672779499111259318730412222275144024667980776523094494347'],
      [64, 'acos', '-0.75', '2.418858405776377627284266030638169522171950912950665553348190460'],
      [64, 'acos', '1', '0.0'],
      [64, 'acos', '-1', '3.141592653589793238462643383279502884197169399375105820974944592'],
      [64, 'acos', '0.5', '1.047197551196597746154214461093167628065723133125035273658314864'],
      [
        64,
        'asin',
        '0.99999999999999999999999999999999999',
        '1.570796326794896614759185736640172049280237362225000435879455614',
      ],
      [
        64,
        'asin',
        '-0.999999999999999999999999',
        '-1.570796326793482405668948596590949753256523871411225317878621261',
      ],
      [64, 'asin', '0.3', '0.3046926540153975079720029612275291669545600317067763873929779487'],
    ];
    for (const [precision, method, x, expected] of cases) {
      BigNumber.config({ precision });
      expect(bn(x)[method]().toString(), `${method}(${x}) at ${precision}`).toBe(
        bn(expected).toString()
      );
    }
  });

  it('the engineering notation keeps every digit of a value longer than the precision', () => {
    BigNumber.config({ precision: 20 });
    const long = bn('9876543210987654321098765');
    expect(formatBigNumber(long, { notation: 'engineering' })).toBe(
      '9.876543210987654321098765e+24'
    );
    expect(formatBigNumber(long, { notation: 'engineering', precision: 25 })).toBe(
      '9.876543210987654321098765e+24'
    );
    expect(formatBigNumber(bn('12400'), { notation: 'engineering' })).toBe('12.4e+3');
    expect(formatBigNumber(bn('-0.00012345'), { notation: 'engineering' })).toBe('-123.45e-6');
    expect(formatBigNumber(bn('100000'), { notation: 'engineering', precision: 4 })).toBe(
      '100.0e+3'
    );
    expect(formatBigNumber(bn('0'), { notation: 'engineering' })).toBe('0e+0');
  });
});
