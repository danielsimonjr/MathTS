/**
 * #1166 (items 3 and 4): `sinh` lost a small argument, and `expm1`, `sinh`, `cosh` and `tanh`
 * threw at |x| = 1e10.
 *
 * Oracle: mpmath 1.3.0 (every constant below has 64 significant digits).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { BigNumber } from '../src/types/bignumber.js';

const bn = (s: string): BigNumber => BigNumber.parse(s);
/** Both sides go through the same formatter, so `1e+5` and `100000` compare as equal values. */
const eq = (actual: BigNumber, literal: string): void =>
  expect(String(actual)).toBe(String(bn(literal)));

afterEach(() => BigNumber.resetConfig());

describe('#1166 item 3: sinh keeps a small argument', () => {
  it('sinh(1e-40) at precision 20 is 1e-40', () => {
    BigNumber.config({ precision: 20 });
    expect(String(bn('1e-40').sinh())).toBe(String(bn('1e-40')));
    expect(String(bn('-1e-40').sinh())).toBe(String(bn('-1e-40')));
  });

  it('sinh(1e-25) at precision 64 is x + x^3/6', () => {
    BigNumber.config({ precision: 64 });
    eq(bn('1e-25').sinh(), '1.000000000000000000000000000000000000000000000000001666666666667e-25');
  });

  it.each([
    ['1', '1.175201193643801456882381850595600815155717981334095870229565413'],
    ['0.5', '0.5210953054937473616224256264114915591059289826114805279460935765'],
    ['-2.5', '-6.050204481039787321450323638350403187672481834523862331357319966'],
    ['30', '5343237290762.231073495234278582585980811374478157366378217922021'],
  ])('sinh(%s) at precision 64 matches mpmath', (x, expected) => {
    BigNumber.config({ precision: 64 });
    eq(bn(x).sinh(), expected);
  });
});

describe('#1166 item 4: exp, expm1, sinh, cosh and tanh at |x| = 1e10', () => {
  const EXP_1E10 = '1.077750607958564910214246295912757827559029169416328757618192236e+4342944819';
  const EXP_M1E10 = '9.278584420324872578073142298930222893663101549832739561350487254e-4342944820';
  const SINH_1E10 = '5.388753039792824551071231479563789137795145847081643788090961182e+4342944818';

  it('exp(1e10) and exp(-1e10) return finite values', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 64 });
    eq(bn('1e10').exp(), EXP_1E10);
    eq(bn('-1e10').exp(), EXP_M1E10);
  });

  it('expm1(-1e10) is -1 and expm1(1e10) is exp(1e10)', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 64 });
    expect(String(bn('-1e10').expm1())).toBe('-1');
    eq(bn('1e10').expm1(), EXP_1E10);
  });

  it('tanh(+-1e10) is +-1', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 64 });
    expect(String(bn('1e10').tanh())).toBe('1');
    expect(String(bn('-1e10').tanh())).toBe('-1');
  });

  it('sinh(+-1e10) and cosh(+-1e10) are exp(1e10) / 2', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 64 });
    eq(bn('1e10').sinh(), SINH_1E10);
    eq(bn('-1e10').sinh(), `-${SINH_1E10}`);
    eq(bn('1e10').cosh(), SINH_1E10);
    eq(bn('-1e10').cosh(), SINH_1E10);
  });

  it('sinh, cosh and tanh of mid-size and small arguments match mpmath', () => {
    BigNumber.config({ precision: 64 });
    eq(bn('1e-30').cosh(), '1.000000000000000000000000000000000000000000000000000000000000500');
    eq(bn('1e-30').tanh(), '9.999999999999999999999999999999999999999999999999999999999996667e-31');
    eq(bn('0.3').tanh(), '0.2913126124515909058182212728237659281535968049176121744143124196');
    eq(bn('0.7').expm1(), '1.013752707470476521624549388583065270017542394145867311568989301');
    eq(bn('-3').expm1(), '-0.9502129316321360570206575843499382233683004078115767844323722724');
  });

  it('a bound that the user sets still applies to the result', () => {
    BigNumber.config({ precision: 64, maxExponent: 1000 });
    expect(String(bn('1e10').sinh())).toBe('Infinity');
    expect(String(bn('-1e10').sinh())).toBe('-Infinity');
    expect(String(bn('-1e10').expm1())).toBe('-1');
  });

  it('sinh, cosh, tanh and expm1 of an argument beyond the exponent range', () => {
    BigNumber.config({ precision: 64 });
    for (const x of ['1e17', '2.1e16', '1e30', '1e5000000000000000']) {
      expect(String(bn(x).sinh())).toBe('Infinity');
      expect(String(bn(`-${x}`).sinh())).toBe('-Infinity');
      expect(String(bn(x).cosh())).toBe('Infinity');
      expect(String(bn(`-${x}`).cosh())).toBe('Infinity');
      expect(String(bn(x).tanh())).toBe('1');
      expect(String(bn(`-${x}`).tanh())).toBe('-1');
      expect(String(bn(x).expm1())).toBe('Infinity');
      expect(String(bn(`-${x}`).expm1())).toBe('-1');
    }
  });
});
