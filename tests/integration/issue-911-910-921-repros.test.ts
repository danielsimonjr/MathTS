import { describe, it, expect } from 'vitest';
import {
  multiply,
  propagateUncertainty,
  electronMass,
  speedOfLight,
} from '@danielsimonjr/mathts-functions';
import { Unit } from '@danielsimonjr/mathts-units';

/**
 * The reproductions of #911, #910 and #921, written as a user of the published packages
 * writes them (imports by package name).
 */
const mul = multiply as unknown as (a: unknown, b: unknown) => unknown;

describe('#911 multiply(Unit, number[])', () => {
  it('scales a number array by a Unit, as the issue expects', () => {
    expect(String(mul(2, new Unit(3, 'ohm')))).toBe('6 ohm');
    const scaled = mul(new Unit(2, 'm'), [1, 2, 3]) as unknown[];
    expect(scaled.map(String)).toEqual(['2 m', '4 m', '6 m']);
  });

  it('matches the per-element workaround of the issue', () => {
    const workaround = [1, 2, 3].map((x) => String(mul(x, new Unit(2, 'm'))));
    expect((mul(new Unit(2, 'm'), [1, 2, 3]) as unknown[]).map(String)).toEqual(workaround);
  });
});

describe('#910 propagateUncertainty with CODATA constants', () => {
  it('gives sigma(E) = c^2 sigma(m) for E = m c^2 with the constants as inputs', () => {
    const c = 299792458;
    const sigmaMass = (electronMass as unknown as { uncertainty: number }).uncertainty;
    const result = propagateUncertainty('m * c^2', { m: electronMass, c: speedOfLight });
    expect(result.value / (Number(electronMass.value) * c * c)).toBeCloseTo(1, 12);
    expect(result.sigma / (c * c * sigmaMass)).toBeCloseTo(1, 12);
  });

  it('names the expected call shape when a constant is passed as the values record', () => {
    expect(() => propagateUncertainty((v) => v.m, electronMass as never)).toThrow(
      /values must be an object/
    );
  });
});

describe('#921 Unit.value and toNumeric', () => {
  it('holds radians in value and the shown number in toNumeric', () => {
    const angle = new Unit(180, 'deg');
    expect(Number(angle.value)).toBeCloseTo(Math.PI, 12);
    expect(angle.toNumeric()).toBe(180);
    expect(angle.toNumeric('deg')).toBe(180);
    expect(Number(angle.toNumeric('rad'))).toBeCloseTo(Math.PI, 12);
  });

  it('keeps the zero point of an offset unit out of value', () => {
    expect(new Unit(0, 'degC').value).toBe(0);
    expect(Number(new Unit(0, 'degC').toNumeric('K'))).toBeCloseTo(273.15, 12);
  });
});
