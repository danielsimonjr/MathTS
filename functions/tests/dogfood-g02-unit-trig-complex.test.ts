/**
 * Dogfood relay G02 — angle units in typed trig; Complex × Unit multiply (#727, #823, #834).
 *
 * mathjs 13.2.3 oracle (issues): sin(90 deg)=1, cos(180 deg)=−1,
 * multiply(complex(0,1), unit('2 ohm')) → 2i ohm.
 */
import { describe, it, expect } from 'vitest';
import {
  sin,
  cos,
  tan,
  csc,
  sec,
  cot,
  asin,
  acos,
  atan,
  sinh,
  cosh,
  tanh,
  multiply,
  divide,
  evaluate,
} from '@danielsimonjr/mathts-functions';
/** Re-export package surface (#834) — same impl as typed/trigonometry. */
import { sin as tsin, cos as tcos } from '../../trigonometry/src/index.js';
import {
  Unit,
  Complex,
  Fraction,
  BigNumber,
  isComplex,
  type UnitInstance,
} from '@danielsimonjr/mathts-core';
import { create, all } from '@danielsimonjr/mathts-compat';
import { DimensionError } from '@danielsimonjr/mathts-core/internal';

/** Verified against mathjs@13.2.3 (2026-11-11). */
const MATHJS_ORACLE = {
  sin90deg: 1,
  cos180deg: -1,
  multiplyImagOhm: '(2i) ohm',
  multiplyImagFarad: '(i) uF',
} as const;

describe('G02 #834 — typed sin(Unit)', () => {
  it('sin(new Unit(90, "deg")) === 1 (mathjs oracle)', () => {
    expect(sin(new Unit(90, 'deg'))).toBe(MATHJS_ORACLE.sin90deg);
    expect(tsin(new Unit(90, 'deg'))).toBe(MATHJS_ORACLE.sin90deg);
  });
});

describe('G02 #727 — evaluate trig on angle units', () => {
  const mt = create(all) as unknown as { evaluate: (expr: string) => unknown };

  it('evaluate("sin(90 deg)") === 1 (mathjs oracle)', () => {
    expect(mt.evaluate('sin(90 deg)')).toBe(MATHJS_ORACLE.sin90deg);
    expect(evaluate('sin(90 deg)')).toBe(MATHJS_ORACLE.sin90deg);
  });

  it('evaluate("cos(180 deg)") === -1 (mathjs oracle)', () => {
    expect(mt.evaluate('cos(180 deg)')).toBe(MATHJS_ORACLE.cos180deg);
    expect(evaluate('cos(180 deg)')).toBe(MATHJS_ORACLE.cos180deg);
  });
});

describe('G02 #823 — multiply(Complex, Unit)', () => {
  it('multiply(complex(0,1), new Unit(2, "ohm")) matches mathjs string', () => {
    const z = multiply(new Complex(0, 1), new Unit(2, 'ohm'));
    expect(String(z)).toBe(MATHJS_ORACLE.multiplyImagOhm);
  });

  it('multiply(new Complex(0, 1), new Unit(1e-6, "F"))', () => {
    const z = multiply(new Complex(0, 1), new Unit(1e-6, 'F'));
    expect(String(z)).toBe(MATHJS_ORACLE.multiplyImagFarad);
  });

  it('multiply(Unit, Complex) is symmetric for impedances', () => {
    const a = multiply(new Unit(2, 'ohm'), new Complex(0, 1));
    const b = multiply(new Complex(0, 1), new Unit(2, 'ohm'));
    expect(String(a)).toBe(String(b));
  });

  it('numeric multiply(2, new Unit(3, "ohm")) still works (#823 repro)', () => {
    expect(String(multiply(2, new Unit(3, 'ohm')))).toBe('6 ohm');
  });

  it('returns a Unit whose value is complex', () => {
    const z = multiply(new Complex(0, 1), new Unit(1, 'F'));
    expect(z).toBeInstanceOf(Unit);
    const zu = z as UnitInstance;
    expect(isComplex(zu.value)).toBe(true);
    const val = zu.value as Complex;
    expect(val.re).toBe(0);
    expect(val.im).toBe(1);
  });
});

describe('G02 — non-angle Unit in sin throws DimensionError', () => {
  it('sin(5 m) is rejected', () => {
    expect(() => sin(new Unit(5, 'm'))).toThrow(DimensionError);
    expect(() => sin(new Unit(5, 'm'))).toThrow(/Unit in function sin is no angle/);
  });

  it('cos/tan/csc name the function in the dimension error', () => {
    expect(() => cos(new Unit(1, 'kg'))).toThrow(/Unit in function cos is no angle/);
    expect(() => tan(new Unit(1, 'Hz'))).toThrow(/Unit in function tan is no angle/);
    expect(() => csc(new Unit(1, 's'))).toThrow(/Unit in function csc is no angle/);
  });
});

/**
 * Angle-unit probes. mathjs@13.2.3 oracles (2026-11-11).
 * `new Unit(n, name)` keeps an exact SI scale, so a gradian/degree whose
 * float product is one ulp off π (mathjs and `evaluate`) can differ in the
 * last bit of a near-zero sine. The kernel is Math.sin of the unit's own
 * SI value; the expression parser matches mathjs.
 */
describe('G02 — angle units rad/deg/grad/cycle on forward trig', () => {
  const near = (actual: unknown, expected: number) => {
    expect(actual).toBeCloseTo(expected, 12);
  };

  it('sin of rad, deg, grad, and cycle', () => {
    expect(sin(new Unit(Math.PI / 2, 'rad'))).toBe(1);
    expect(sin(new Unit(90, 'deg'))).toBe(1);
    expect(sin(new Unit(0.25, 'cycle'))).toBe(1);
    // Exact SI of 200 grad is π; Math.sin(π) is the positive residual.
    expect(sin(new Unit(200, 'grad'))).toBe(Math.sin(Math.PI));
    // The expression reads 200 grad through the exact route (#955), so it equals the exact-π case
    // above: 1.2246467991473532e-16, which is closer to sin(π) = 0 than the former
    // -3.216245299353273e-16 float product.
    expect(evaluate('sin(200 grad)')).toBe(Math.sin(Math.PI));
    expect(evaluate('sin(0.25 cycle)')).toBe(1);
    expect(evaluate('cos(0.5 cycle)')).toBe(-1);
  });

  it('cos/tan/csc/sec/cot on degree units', () => {
    expect(cos(new Unit(180, 'deg'))).toBe(-1);
    expect(tcos(new Unit(0, 'deg'))).toBe(1);
    near(tan(new Unit(45, 'deg')), 1);
    expect(csc(new Unit(90, 'deg'))).toBe(1);
    expect(sec(new Unit(0, 'deg'))).toBe(1);
    near(cot(new Unit(45, 'deg')), 1);
    expect(evaluate('tan(45 deg)')).toBeCloseTo(1, 12);
  });

  it('complex-valued angle unit uses the complex kernel', () => {
    // mathjs sin(unit(i*π/2, rad)) === 2.3012989023072947i
    const z = sin(new Unit(new Complex(0, Math.PI / 2), 'rad'));
    expect(isComplex(z)).toBe(true);
    expect((z as unknown as Complex).re).toBeCloseTo(0, 12);
    expect((z as unknown as Complex).im).toBeCloseTo(2.3012989023072947, 12);
  });
});

describe('G02 — inverse and hyperbolic reject Unit (mathjs 13 has no Unit signature)', () => {
  it('asin/acos/atan and sinh/cosh/tanh throw on Unit and keep plain numbers', () => {
    const angle = new Unit(0, 'deg');
    for (const fn of [asin, acos, atan, sinh, cosh, tanh]) {
      expect(() => fn(angle)).toThrow(/Unexpected type of argument/);
    }
    expect(asin(0.5)).toBeCloseTo(0.5235987755982989, 12);
    expect(acos(0)).toBeCloseTo(Math.PI / 2, 12);
    expect(atan(1)).toBeCloseTo(Math.PI / 4, 12);
    expect(sinh(0.5)).toBeCloseTo(0.5210953054937474, 12);
    expect(cosh(0)).toBe(1);
    expect(tanh(0)).toBe(0);
    expect(sin(Math.PI / 2)).toBe(1);
    expect(cos(0)).toBe(1);
  });
});

describe('G02 — divide Complex×Unit both orders, real scalars stay real', () => {
  it('divide(i, 2 ohm) and divide(2 ohm, i) match mathjs strings', () => {
    expect(String(divide(new Complex(0, 1), new Unit(2, 'ohm')))).toBe('(0.5i) S');
    expect(String(divide(new Unit(2, 'ohm'), new Complex(0, 1)))).toBe('(-2i) ohm');
  });

  it('divide(1, 2 ohm) stays a real 0.5 S (not a zero-imaginary Complex)', () => {
    const z = divide(1, new Unit(2, 'ohm')) as UnitInstance;
    expect(String(z)).toBe('0.5 S');
    expect(typeof z.value).toBe('number');
    expect(z.value).toBe(0.5);
  });

  it('Fraction and BigNumber × Unit do not collapse to Complex', () => {
    const mf = multiply(new Fraction(1, 2), new Unit(4, 'm')) as UnitInstance;
    expect(isComplex(mf.value)).toBe(false);
    expect(mf.value).toBeInstanceOf(Fraction);
    const mb = multiply(BigNumber.fromNumber(2), new Unit(3, 'm')) as UnitInstance;
    expect(isComplex(mb.value)).toBe(false);
    expect(mb.value).toBeInstanceOf(BigNumber);
    const df = divide(new Fraction(1, 2), new Unit(4, 'ohm')) as UnitInstance;
    expect(isComplex(df.value)).toBe(false);
    expect(String(df)).toBe('1/8 S');
  });

  it('1 / (jωC) is a real-coefficient complex admittance', () => {
    const jwC = multiply(multiply(new Complex(0, 1), 2 * Math.PI * 60), new Unit(1e-6, 'F'));
    const y = divide(1, jwC) as UnitInstance;
    expect(y).toBeInstanceOf(Unit);
    expect(isComplex(y.value)).toBe(true);
    const v = y.value as Complex;
    expect(v.re).toBeCloseTo(0, 8);
    expect(v.im).toBeLessThan(0);
  });
});
