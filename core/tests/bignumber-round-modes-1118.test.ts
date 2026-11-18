/**
 * #1118: every rounding mode, exact ties, carries (9.95 -> 10, 99.5 -> 100), integer powers up to
 * an exponent of 10^6, negative exponents and the exact mod, at precisions 5, 20 and 64.
 *
 * Oracle: Python `decimal` with the matching rounding mode (halfCeil and halfFloor map to
 * ROUND_HALF_UP or ROUND_HALF_DOWN by the sign of the value).
 * Fixture rows: [operation, precision, mode, a, b, expected]. For `pow`, b is the exponent.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { BigNumber } from '../src/types/bignumber.js';
import type { RoundingMode } from '../src/types/bignumber.js';

type Row = [string, number, RoundingMode, string, string, string];
const rows = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./fixtures/bignumber-round-modes-1118.json', import.meta.url)),
    'utf8'
  )
) as Row[];

const MODES: RoundingMode[] = [
  'up',
  'down',
  'ceil',
  'floor',
  'halfUp',
  'halfDown',
  'halfEven',
  'halfCeil',
  'halfFloor',
];

const bn = (v: string): BigNumber => BigNumber.parse(v);

afterEach(() => {
  BigNumber.resetConfig();
});

function run(op: string, a: BigNumber, b: BigNumber): BigNumber {
  switch (op) {
    case 'add':
      return a.add(b);
    case 'sub':
      return a.subtract(b);
    case 'mul':
      return a.multiply(b);
    case 'mod':
      return a.mod(b);
    case 'pow':
      return a.pow(Number(b.toString()));
    default:
      throw new Error(op);
  }
}

describe('#1118 each rounding mode matches the oracle', () => {
  for (const mode of MODES) {
    it(`mode ${mode}: add, subtract, multiply, ties, carries, pow and mod`, () => {
      const own = rows.filter((r) => r[2] === mode);
      expect(own.length).toBeGreaterThan(40);
      // The fixture has negative values for each mode.
      expect(own.some((r) => r[3].startsWith('-'))).toBe(true);
      for (const [op, precision, , a, b, expected] of own) {
        BigNumber.config({ precision, rounding: mode });
        const result = run(op, bn(a), bn(b));
        // A rounded result is a fixed point: adding zero twice changes nothing.
        const again = result.add(0).add(0);
        BigNumber.config({ precision: 100000 });
        const label = `${op}(${a}, ${b}) at ${precision} ${mode}`;
        expect(result.equals(bn(expected)), `${label}: ${result.toString()}`).toBe(true);
        expect(again.equals(result), `${label}: add(0).add(0)`).toBe(true);
      }
    });
  }

  it('the fixture holds ties and carries for every precision', () => {
    // A tie row is an add of zero to a value with one digit more than the precision, ending in 5.
    const ties = rows.filter((r) => r[0] === 'add' && r[4] === '0');
    expect(ties.length).toBeGreaterThan(30);
    expect(new Set(ties.map((r) => r[1]))).toEqual(new Set([5, 20, 64]));
  });
});

describe('#1118 explicit ties, carries and powers', () => {
  it('a tie rounds by the mode, with the sign', () => {
    const cases: [RoundingMode, string, string][] = [
      ['halfUp', '1.25', '1.3'],
      ['halfUp', '-1.25', '-1.3'],
      ['halfDown', '1.25', '1.2'],
      ['halfDown', '-1.25', '-1.2'],
      ['halfEven', '1.25', '1.2'],
      ['halfEven', '1.35', '1.4'],
      ['halfEven', '-1.25', '-1.2'],
      ['halfCeil', '1.25', '1.3'],
      ['halfCeil', '-1.25', '-1.2'],
      ['halfFloor', '1.25', '1.2'],
      ['halfFloor', '-1.25', '-1.3'],
      ['up', '1.21', '1.3'],
      ['up', '-1.21', '-1.3'],
      ['down', '1.29', '1.2'],
      ['down', '-1.29', '-1.2'],
      ['ceil', '1.21', '1.3'],
      ['ceil', '-1.29', '-1.2'],
      ['floor', '1.29', '1.2'],
      ['floor', '-1.21', '-1.3'],
    ];
    for (const [mode, value, expected] of cases) {
      BigNumber.config({ precision: 2, rounding: mode });
      expect(bn(value).add(0).toString(), `${mode} ${value}`).toBe(expected);
    }
  });

  it('a carry adds a digit: 9.95 -> 10 and 99.5 -> 100', () => {
    BigNumber.config({ precision: 2, rounding: 'halfUp' });
    expect(bn('9.95').add(0).toString()).toBe('10');
    BigNumber.config({ precision: 2, rounding: 'halfUp' });
    expect(bn('99.5').add(0).toString()).toBe('100');
    BigNumber.config({ precision: 3, rounding: 'up' });
    expect(bn('-99.91').add(0).toString()).toBe('-100');
  });

  it('pow with an exponent of 10^6 and a negative exponent (oracle: Python decimal)', () => {
    BigNumber.config({ precision: 20, rounding: 'halfUp' });
    expect(bn('1.0000001').pow(1e6).toString()).toBe('1.1051709125497934166');
    BigNumber.config({ precision: 64, rounding: 'halfEven' });
    expect(bn('1.0000001').pow(1e6).toString()).toBe(
      '1.105170912549793416638382709346716159349066282923124249822239698'
    );
    BigNumber.config({ precision: 20, rounding: 'ceil' });
    expect(bn('-1.0000003').pow(1000001).toString()).toBe('-1.3498591517899943282');
    BigNumber.config({ precision: 20, rounding: 'down' });
    expect(bn('3.7').pow(-7).toString()).toBe('0.00010533869446181869591');
    BigNumber.config({ precision: 20, rounding: 'up' });
    expect(bn('-3.7').pow(-7).toString()).toBe('-0.00010533869446181869592');
  });

  it('add(0).add(0) of a long value rounds once and then holds', () => {
    BigNumber.config({ precision: 20, rounding: 'halfUp' });
    const once = bn('1.23456789012345678901234567').add(0);
    expect(once.toString()).toBe('1.234567890123456789');
    expect(once.add(0).add(0).toString()).toBe(once.toString());
  });

  it('a precision of 1e9 or Infinity does not build its power of ten', () => {
    for (const precision of [1e9, Infinity]) {
      BigNumber.config({ precision });
      expect(bn('5').add(1).toString()).toBe('6');
      expect(bn('123456789012345678901234567890').multiply(3).toString()).toBe(
        '370370367037037036703703703670'
      );
    }
  });
});
