/**
 * #355 review follow-ups:
 * - one registry of named irrationals drives parsing, arithmetic, rounding and formatting
 * - scale expressions accept parenthesized groups and whitespace
 * - the bit-length normalization shift rounds like the decimal parser at every magnitude
 * - Unit.prototype.exactScale is memoized per unit list
 */
import { describe, it, expect } from 'vitest';
import {
  NAMED_IRRATIONALS,
  UNIT_EXACT_SCALE,
  PI_EXACT_SCALE,
  LN2_EXACT_SCALE,
  namedIrrationalScale,
  irrationalPower,
  isRationalScale,
  decimalExactScale,
  ratioExactScale,
  multiplyExactScales,
  divideExactScales,
  powerExactScale,
  exactScalesEqual,
  exactScaleToNumber,
  formatExactScale,
  readScaleExpression,
  type ExactScale,
} from '../../src/types/unit/exact-scale';
import { Unit } from '../../src/types/unit';

const known: Record<string, ExactScale> = {
  lbf: ratioExactScale(45359237n * 980665n, 10n ** 13n),
  inch: ratioExactScale(254n, 10000n),
};
const resolve = (name: string) => known[name];

describe('named-irrational registry', () => {
  it('lists pi and ln2, and each entry is the scale of its name', () => {
    expect(Object.keys(NAMED_IRRATIONALS).sort()).toEqual(['ln2', 'pi']);
    expect(PI_EXACT_SCALE).toEqual(namedIrrationalScale('pi'));
    expect(LN2_EXACT_SCALE).toEqual(namedIrrationalScale('ln2'));
    for (const name of Object.keys(NAMED_IRRATIONALS) as (keyof typeof NAMED_IRRATIONALS)[]) {
      expect(readScaleExpression(name)).toEqual({ num: 1n, den: 1n, irrationals: { [name]: 1 } });
    }
  });

  it('rounds each registered constant to the built-in double', () => {
    expect(exactScaleToNumber(PI_EXACT_SCALE)).toBe(Math.PI);
    expect(exactScaleToNumber(LN2_EXACT_SCALE)).toBe(Math.LN2);
    expect(exactScaleToNumber(powerExactScale(PI_EXACT_SCALE, -1))).toBe(1 / Math.PI);
  });

  it('keeps powers by name and drops a power that cancels', () => {
    const s = readScaleExpression('pi^2*ln2/pi');
    expect(s.irrationals).toEqual({ pi: 1, ln2: 1 });
    expect(irrationalPower(s, 'pi')).toBe(1);
    expect(irrationalPower(UNIT_EXACT_SCALE, 'ln2')).toBe(0);
    const cancel = divideExactScales(PI_EXACT_SCALE, PI_EXACT_SCALE);
    expect(cancel.irrationals).toEqual({});
    expect(isRationalScale(cancel)).toBe(true);
    expect(exactScalesEqual(cancel, UNIT_EXACT_SCALE)).toBe(true);
    expect(formatExactScale(multiplyExactScales(ratioExactScale(3, 2), s, PI_EXACT_SCALE))).toBe(
      '3/2*pi^2*ln2'
    );
  });
});

describe('scale expressions: parentheses', () => {
  it('reads a parenthesized denominator like the single-solidus form', () => {
    const grouped = readScaleExpression('6/(2*3)');
    expect(grouped).toEqual(ratioExactScale(1));
    expect(grouped).toEqual(readScaleExpression('6/2*3'));
    expect(readScaleExpression('lbf/(inch*inch)', resolve)).toEqual(
      readScaleExpression('lbf/inch^2', resolve)
    );
    expect(readScaleExpression('1/(2*pi)')).toEqual({
      num: 1n,
      den: 2n,
      irrationals: { pi: -1 },
    });
  });

  it('nests groups and raises a group to a power', () => {
    expect(readScaleExpression('(1/2)^-1')).toEqual(ratioExactScale(2));
    expect(readScaleExpression('((2*3))^2/(4/(2))')).toEqual(ratioExactScale(18));
    expect(readScaleExpression('(6/2)*3')).toEqual(ratioExactScale(9));
  });

  it('rejects unbalanced or empty groups', () => {
    for (const bad of ['(2*3', '2*3)', '()', '2*()', '(2)(3)', '2/', '*2', '2^']) {
      expect(() => readScaleExpression(bad), bad).toThrow(RangeError);
    }
  });
});

describe('scale expressions: whitespace', () => {
  it('ignores spaces around operators, powers and groups', () => {
    expect(readScaleExpression(' 2 * 3 / 4 ')).toEqual(ratioExactScale(3, 2));
    expect(readScaleExpression('lbf / inch ^ 2', resolve)).toEqual(
      readScaleExpression('lbf/inch^2', resolve)
    );
    expect(readScaleExpression('1 / ( 2 * pi )')).toEqual(readScaleExpression('1/(2*pi)'));
    expect(readScaleExpression('\t648000 * 2 /pi\n')).toEqual(readScaleExpression('648000*2/pi'));
  });

  it('does not read juxtaposition as a product', () => {
    expect(() => readScaleExpression('2 3')).toThrow(RangeError);
    expect(() => readScaleExpression('lbf inch', resolve)).toThrow(RangeError);
  });
});

describe('bit-length normalization shift', () => {
  it('rounds a decimal like Number() does across the whole double range', () => {
    // Number(text) is correctly rounded, so it is an independent reference.
    const failures: string[] = [];
    let seed = 12345;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
    for (let e = -330; e <= 310; e += 1) {
      for (let k = 0; k < 4; k++) {
        const digits = String(next()) + String(next()).padStart(10, '0');
        const text = `${digits.slice(0, 1)}.${digits.slice(1)}e${e}`;
        const got = exactScaleToNumber(decimalExactScale(text)!);
        if (!Object.is(got, Number(text))) failures.push(`${text}: ${got} vs ${Number(text)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('handles exact powers of two at the window edges', () => {
    for (const k of [-1074, -1023, -1022, -1, 0, 1, 52, 53, 1023]) {
      const s = k >= 0 ? ratioExactScale(2n ** BigInt(k)) : ratioExactScale(1n, 2n ** BigInt(-k));
      expect(exactScaleToNumber(s), `2^${k}`).toBe(2 ** k);
    }
  });
});

describe('Unit.prototype.exactScale memo', () => {
  it('returns the same scale object for the same unit list', () => {
    const a = new Unit(1, 'psi').exactScale();
    const b = new Unit(2, 'psi').exactScale();
    expect(a).not.toBeNull();
    expect(b).toBe(a);
    expect(Unit.exactScale('kg*m/s^2')).toBe(Unit.exactScale('kg*m/s^2'));
  });

  it('tells unit lists apart by prefix and power', () => {
    expect(Unit.exactScale('km')).toEqual(ratioExactScale(1000));
    expect(Unit.exactScale('m')).toEqual(ratioExactScale(1));
    expect(Unit.exactScale('m^2')).toEqual(ratioExactScale(1));
    expect(Unit.exactScale('km^2')).toEqual(ratioExactScale(1000000));
    expect(Unit.exactScale('km^-1')).toEqual(ratioExactScale(1, 1000));
  });

  it('keeps conversions fast: 20000 psi to Pa conversions within a generous budget', () => {
    const run = () => {
      let sum = 0;
      for (let i = 1; i <= 20000; i++) sum += new Unit(i, 'psi').toNumber('Pa');
      return sum;
    };
    run(); // warm up
    const start = performance.now();
    const sum = run();
    const ms = performance.now() - start;
    expect(sum).toBeGreaterThan(0);
    // About 0.17 s on a laptop (0.65 s before the unit-list memo and identity rounding, 0.07 s
    // before #346). The budget is loose so a slow runner does not flake.
    expect(ms).toBeLessThan(4000);
  });
});
