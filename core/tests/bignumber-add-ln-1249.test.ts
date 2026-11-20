/**
 * #1249: BigNumber `add`, `subtract`, `ln`, `log10` and a fractional `pow` took time in
 * proportion to the exponent (or threw) for a value of a large order.
 *
 * Oracles: mpmath 1.3.0 (every constant below has 64 significant digits), and, for `add`, an exact
 * bigint sum that the test rounds in each rounding mode.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { BigNumber, type RoundingMode } from '../src/types/bignumber.js';

const bn = (s: string): BigNumber => BigNumber.parse(s);
/** Both sides go through the same formatter, so `1e+5` and `100000` compare as equal values. */
const eq = (actual: BigNumber, literal: string): void =>
  expect(String(actual)).toBe(String(bn(literal)));

afterEach(() => BigNumber.resetConfig());

describe('#1249 add and subtract with a large exponent gap', () => {
  it('1e100000000 + 1 returns the left operand', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 64 });
    expect(String(bn('1e100000000').add(bn('1')))).toBe('1e+100000000');
    expect(String(bn('1').add(bn('1e100000000')))).toBe('1e+100000000');
  });

  it('1e2000000000 + 1 does not throw', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 64 });
    expect(String(bn('1e2000000000').add(bn('1')))).toBe('1e+2000000000');
    expect(String(bn('1e2000000000').subtract(bn('1e-2000000000')))).toBe('1e+2000000000');
  });

  it('1e100000000 - 1 rounds like the exact difference', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 64, rounding: 'halfUp' });
    expect(String(bn('1e100000000').subtract(bn('1')))).toBe('1e+100000000');
    BigNumber.config({ precision: 64, rounding: 'down' });
    eq(bn('1e100000000').subtract(bn('1')), `9.${'9'.repeat(63)}e99999999`);
  });

  it('1e1000000 - 1 with rounding down gives 64 nines', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 64, rounding: 'down' });
    const r = bn('1e1000000').subtract(bn('1'));
    expect(r.e).toBe(999999);
    eq(r, `9.${'9'.repeat(63)}e999999`);
  });

  it('a sum at the exponent bound stays finite', () => {
    BigNumber.config({ precision: 64 });
    expect(String(bn('1e9007000000000000').add(bn('1e-9007000000000000')))).toBe(
      '1e+9007000000000000'
    );
  });

  // Rounding mode: 1 +- 1e-30 at precision 20 (gap 30). Exact closed forms.
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
  const ONE_PLUS = '1.0000000000000000001';
  const ONE_MINUS = '0.99999999999999999999';
  // [mode, 1 + 1e-30, 1 - 1e-30, -1 - 1e-30, -1 + 1e-30]
  const EXPECTED: Record<string, [string, string, string, string]> = {
    up: [ONE_PLUS, '1', `-${ONE_PLUS}`, '-1'],
    down: ['1', ONE_MINUS, '-1', `-${ONE_MINUS}`],
    ceil: [ONE_PLUS, '1', '-1', `-${ONE_MINUS}`],
    floor: ['1', ONE_MINUS, `-${ONE_PLUS}`, '-1'],
    halfUp: ['1', '1', '-1', '-1'],
    halfDown: ['1', '1', '-1', '-1'],
    halfEven: ['1', '1', '-1', '-1'],
    halfCeil: ['1', '1', '-1', '-1'],
    halfFloor: ['1', '1', '-1', '-1'],
  };
  it.each(MODES)('1 +- 1e-30 at precision 20 in mode %s', (mode) => {
    BigNumber.config({ precision: 20, rounding: mode });
    const [plus, minus, negPlus, negMinus] = EXPECTED[mode];
    expect(String(bn('1').add(bn('1e-30')))).toBe(String(bn(plus)));
    expect(String(bn('1').subtract(bn('1e-30')))).toBe(String(bn(minus)));
    expect(String(bn('-1').subtract(bn('1e-30')))).toBe(String(bn(negPlus)));
    expect(String(bn('-1').add(bn('1e-30')))).toBe(String(bn(negMinus)));
    // The small operand first, and a gap far above the precision, give the same results.
    expect(String(bn('1e-30').add(bn('1')))).toBe(String(bn(plus)));
    expect(String(bn('1').add(bn('1e-300000')))).toBe(String(bn(plus)));
    expect(String(bn('1').subtract(bn('1e-300000')))).toBe(String(bn(minus)));
  });

  // An exact oracle: the sum as a bigint, rounded in the mode.
  type Parts = { sign: 1 | -1; coef: bigint; exp: number };
  const text = (p: Parts): string => `${p.sign < 0 ? '-' : ''}${p.coef}e${p.exp}`;
  function exactRounded(a: Parts, b: Parts, precision: number, mode: RoundingMode): string {
    const minExp = Math.min(a.exp, b.exp);
    const total =
      BigInt(a.sign) * a.coef * 10n ** BigInt(a.exp - minExp) +
      BigInt(b.sign) * b.coef * 10n ** BigInt(b.exp - minExp);
    if (total === 0n) return '0';
    const negative = total < 0n;
    const magnitude = negative ? -total : total;
    const digits = magnitude.toString().length;
    if (digits <= precision) return text({ sign: negative ? -1 : 1, coef: magnitude, exp: minExp });
    const drop = digits - precision;
    const divisor = 10n ** BigInt(drop);
    let quotient = magnitude / divisor;
    const remainder = magnitude % divisor;
    const half = divisor / 2n;
    const tie = remainder === half;
    const above = remainder > half;
    const inexact = remainder > 0n;
    let up: boolean;
    switch (mode) {
      case 'up':
        up = inexact;
        break;
      case 'down':
        up = false;
        break;
      case 'ceil':
        up = inexact && !negative;
        break;
      case 'floor':
        up = inexact && negative;
        break;
      case 'halfUp':
        up = above || tie;
        break;
      case 'halfDown':
        up = above;
        break;
      case 'halfEven':
        up = above || (tie && quotient % 2n === 1n);
        break;
      case 'halfCeil':
        up = above || (tie && !negative);
        break;
      default:
        up = above || (tie && negative);
    }
    if (up) quotient += 1n;
    return text({ sign: negative ? -1 : 1, coef: quotient, exp: minExp + drop });
  }

  it('matches an exact bigint sum in every mode, for gaps from 0 to 120', () => {
    let seed = 20260515;
    const next = (n: number): number => {
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
      return seed % n;
    };
    const randomCoef = (digits: number): bigint => {
      let s = String(1 + next(9));
      for (let i = 1; i < digits; i++) s += String(next(10));
      return BigInt(s);
    };
    let checked = 0;
    for (const precision of [5, 20]) {
      for (const mode of MODES) {
        BigNumber.config({ precision, rounding: mode });
        for (let i = 0; i < 60; i++) {
          const exponent = next(11) - 5;
          const a: Parts = {
            sign: next(2) === 0 ? 1 : -1,
            coef: randomCoef(1 + next(30)),
            exp: exponent,
          };
          // A gap of 0 to 120 digits between the two exponents, in either direction.
          const gap = next(121) * (next(2) === 0 ? 1 : -1);
          const b: Parts = {
            sign: next(2) === 0 ? 1 : -1,
            coef: randomCoef(1 + next(30)),
            exp: exponent + gap,
          };
          const expected = exactRounded(a, b, precision, mode);
          const actual = bn(text(a)).add(bn(text(b)));
          expect(String(actual), `${text(a)} + ${text(b)} p${precision} ${mode}`).toBe(
            String(bn(expected))
          );
          checked++;
        }
      }
    }
    expect(checked).toBe(1080);
  });
});

describe('#1249 ln, log10 and a fractional pow reduce by the decimal exponent', () => {
  // [argument, ln(argument)] at precision 64 (mpmath).
  const LN_TABLE: [string, string][] = [
    ['1e100000', '2.302585092994045684017991454684364207601101488628772976033327901e+5'],
    ['1e1000000', '2.302585092994045684017991454684364207601101488628772976033327901e+6'],
    ['1e-100000', '-2.302585092994045684017991454684364207601101488628772976033327901e+5'],
    ['1e9007000000000000', '2.073938393259736947595004903234206841786312110807935819513218440e+16'],
    ['3.5e100000', '2.302597620623730637697948335890584057632717104474725192092671288e+5'],
    ['2.5e-777', '-1.788192326524499341416795833077982978234605755444648339910103811e+3'],
    ['9e100000', '2.302607065239819046211819359589102658115194438439929431022362595e+5'],
    ['1.0000001e5000', '1.151292546507022841508995760675512937134084077631053156111901921e+4'],
    [
      '1.23456789123456789e12345687',
      '2.842699505969140409423958541820955512267010182204815587971746792e+7',
    ],
    ['3.1622776601683795e0', '1.151292546497022895135610310143191781363373714829386966355943878'],
    ['3.1622776601683793e0', '1.151292546497022831890057106775606501407631937520595290027155371'],
    ['3.1622776601683794e3', '8.059047825479159915566808072512492264188807292061288552453552210'],
    ['3.1622776601683795e3', '8.059047825479159947189584674196284404166678180715705894455927581'],
    [
      '3.1622776601683793e16',
      '3.799265403440175377617792038172543382302525575558096290656040179e+1',
    ],
    [
      '9.99e-9007000000000000',
      '-2.073938393259736717436545637187991790001464867778349555478590103e+16',
    ],
    [
      '1e-9007000000000000',
      '-2.073938393259736947595004903234206841786312110807935819513218440e+16',
    ],
    ['7e9007000000000000', '2.073938393259737142186019808765537352321586455125908783221691399e+16'],
    ['1.5e-5', '-1.110746035686206403811194415795747190143351701968137068255262518e+1'],
    ['0.5', '-6.931471805599453094172321214581765680755001343602552541206800095e-1'],
    ['0.31622776601683794', '-1.151292546497022820505157746224964566215598662453803351679759394'],
    ['0.31622776601683793', '-1.151292546497022852127934347908757706193469551108177686006172530'],
  ];

  it.each(LN_TABLE)('ln(%s) matches mpmath at precision 64', { timeout: 10000 }, (x, expected) => {
    BigNumber.config({ precision: 64 });
    eq(bn(x).ln(), expected);
  });

  it('ln(1e100000) is 100000 * ln 10', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 64 });
    eq(
      bn('1e100000').ln(),
      bn('100000').multiply(BigNumber.ln10At(70)).roundToPrecision(64).toString()
    );
  });

  it('log10(1e100000) is exactly 100000', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 64 });
    expect(String(bn('1e100000').log10())).toBe('100000');
    expect(String(bn('1e-100000').log10())).toBe('-100000');
  });

  it('4e100000 ^ 0.5 is 2e50000', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 64 });
    eq(bn('4e100000').pow(bn('0.5')), '2e50000');
  });

  it('ln of a value near 1 keeps the value of the series (regression)', () => {
    BigNumber.config({ precision: 64 });
    eq(
      bn('0.9999999999').ln(),
      '-0.0000000001000000000050000000003333333333583333333353333333335000000000143'
    );
    eq(bn('3.2').ln(), '1.163150809805680863068169152606518632776399183172503294570072146');
    eq(bn('0.31').ln(), '-1.171182981502945122106818584826371204752264046776953980309937729');
  });

  it('ln stays correct at precision 20 and 200 for a large exponent', { timeout: 10000 }, () => {
    BigNumber.config({ precision: 20 });
    eq(bn('1e100000').ln(), '230258.50929940456840');
    BigNumber.config({ precision: 200 });
    const ln10 = BigNumber.ln10At(210);
    eq(bn('1e100000').ln(), ln10.multiply(bn('100000')).roundToPrecision(200).toString());
  });
});
