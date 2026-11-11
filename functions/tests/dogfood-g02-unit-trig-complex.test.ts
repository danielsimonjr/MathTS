/**
 * Dogfood relay G02 — angle units in typed trig; Complex × Unit multiply (#727, #823, #834).
 *
 * mathjs 13.2.3 oracle (issues): sin(90 deg)=1, cos(180 deg)=−1,
 * multiply(complex(0,1), unit('2 ohm')) → 2i ohm.
 */
import { describe, it, expect } from 'vitest';
import { sin, multiply, evaluate } from '@danielsimonjr/mathts-functions';
/** Re-export package surface (#834) — same impl as typed/trigonometry. */
import { sin as tsin } from '../../trigonometry/src/index.js';
import { Unit, Complex, isComplex, type UnitInstance } from '@danielsimonjr/mathts-core';
import { create, all } from '@danielsimonjr/mathts-compat';

/** Verified against mathjs@13.2.3 in /tmp/mj-oracle (2026-11-11). */
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
    expect(() => sin(new Unit(5, 'm'))).toThrow(/no angle/);
  });
});
