/**
 * A fractional `pow` of a value with a large decimal exponent: `exp(y * ln(x))` has an argument
 * of 10 or more integer digits, and `exp` turns the absolute error of its argument into the
 * relative error of the result. The working precision then needs one more digit for each integer
 * digit of the argument (#1249: `ln` returns for such a value, so `pow` now reaches this).
 *
 * Oracle: mpmath 1.3.0, rounded half up to the precision.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BigNumber } from '../src/types/bignumber.js';

const bn = (s: string): BigNumber => BigNumber.parse(s);

afterEach(() => BigNumber.resetConfig());

describe('fractional pow of a value with a large exponent keeps the digits', () => {
  const CASES: [number, string, string, string][] = [
    [
      64,
      '69790e-3991967149447945',
      '0.25',
      '9.140044276901660462099423116256776810053646838950018988168495871e-997991787361986',
    ],
    [
      64,
      '3.0581532691118572e752278612527',
      '1.5',
      '1.691176251999734465503471723990275281376283885743903104661412299e+1128417918791',
    ],
    [5, '30591568829593406e-4430484303406974', '1.5', '5.3506e-6645726455110437'],
    // A base near 1 has a small ln: the order of the base gives no bound, the product does.
    [
      64,
      '1.0000000000000000000000000000808',
      '513000000000000000000000000000000.5',
      '4.786220279271150051417573987309039177330253294617417672277479348e+18001',
    ],
    [20, '5e-596132025849', '1.5', '3.5355339059327376220e-894198038773'],
  ];
  it.each(CASES)(
    'precision %i: (%s) ^ %s',
    { timeout: 10000 },
    (precision, base, exponent, expected) => {
      BigNumber.config({ precision });
      expect(String(bn(base).pow(bn(exponent)))).toBe(String(bn(expected)));
    }
  );
});

describe('fractional pow: the extra digits cost no second ln and have a limit', () => {
  const lnCalls = (base: string, exponent: string): [number, string] => {
    const spy = vi.spyOn(BigNumber.prototype, 'ln');
    try {
      const result = String(bn(base).pow(bn(exponent)));
      return [spy.mock.calls.length, result];
    } finally {
      spy.mockRestore();
    }
  };

  it('an ordinary power takes the digit count from the orders: one ln', () => {
    BigNumber.config({ precision: 64 });
    expect(lnCalls('10', '2.5')).toEqual([
      1,
      '316.2277660168379331998893544432718533719555139325216826857504853',
    ]);
    expect(lnCalls('69790e-3991967149447945', '0.25')[0]).toBe(1);
  });

  it('an exponent with 5001 integer digits gives Infinity or 0 at the usual precision', () => {
    BigNumber.config({ precision: 64 });
    const huge = '1' + '0'.repeat(5000) + '.5';
    // The precision at each ln call: no work at a precision of thousands of digits, because the
    // argument of exp is outside its range.
    const seen: number[] = [];
    const ln = BigNumber.prototype.ln;
    const spy = vi.spyOn(BigNumber.prototype, 'ln').mockImplementation(function (this: BigNumber) {
      seen.push(BigNumber.precision);
      return ln.call(this);
    });
    try {
      expect(String(bn('2').pow(bn(huge)))).toBe('Infinity');
      expect(String(bn('2').pow(bn('-' + huge)))).toBe('0');
      expect(String(bn('0.5').pow(bn(huge)))).toBe('0');
    } finally {
      spy.mockRestore();
    }
    expect(seen.length).toBeGreaterThan(0);
    expect(Math.max(...seen)).toBeLessThan(100);
  });
});
