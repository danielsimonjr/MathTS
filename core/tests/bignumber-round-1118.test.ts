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
