/**
 * Dogfood relay G23 — exact repros for #811 #825 #812 #828 #827.
 */
import { describe, it, expect } from 'vitest';
import {
  Unit,
  isUnit,
  unitReadingSearchSteps,
  MAX_UNIT_STRING_LENGTH,
} from '@danielsimonjr/mathts-core';
import type { UnitInstance } from '@danielsimonjr/mathts-core';

function asUnit(value: unknown): UnitInstance {
  if (!isUnit(value)) throw new TypeError('expected Unit');
  return value as UnitInstance;
}
import {
  gravitationConstant,
  electronMass,
  speedOfLight,
  elementaryCharge,
  planckConstant,
  fineStructure,
  rydberg,
} from '../src/factories/index.js';
import { evaluate, physicsScope } from '../src/factories/evaluate.js';

describe('G23 dogfood (#811 Unit.parse DoS)', () => {
  it('rejects over-long unit strings without superlinear factor search', () => {
    const stepsBefore = unitReadingSearchSteps();
    const long = 'm'.repeat(10_000);
    expect(() => new Unit(1, long)).toThrow(/not found/);
    const stepsAfter = unitReadingSearchSteps();
    expect(stepsAfter - stepsBefore).toBeLessThan(500);
  });

  it('enforces MAX_UNIT_STRING_LENGTH on Unit.parse', () => {
    const tooLong = 'm'.repeat(MAX_UNIT_STRING_LENGTH + 1);
    expect(() => Unit.parse(tooLong)).toThrow(/maximum length/);
  });

  it('scales search steps roughly linearly with invalid token length (generous bound)', () => {
    const measure = (n: number) => {
      const before = unitReadingSearchSteps();
      try {
        new Unit(1, 'x'.repeat(n));
      } catch {
        /* expected */
      }
      return unitReadingSearchSteps() - before;
    };
    const s2 = measure(2000);
    const s4 = measure(4000);
    expect(s4).toBeLessThan(s2 * 8 + 50);
  });

  it('miss-path time grows roughly linearly in the token length', () => {
    const median = (n: number): number => {
      const token = 'm'.repeat(n);
      const samples: number[] = [];
      for (let i = 0; i < 7; i++) {
        const t0 = performance.now();
        Unit.isValuelessUnit(token);
        samples.push(performance.now() - t0);
      }
      samples.sort((a, b) => a - b);
      return samples[3];
    };
    // Warm the unit index, then compare 4× length. A quadratic suffix scan is about 16×.
    median(2000);
    const t2 = median(2000);
    const t8 = median(8000);
    expect(t8).toBeLessThan(t2 * 4 + 1);
    expect(() => Unit.parse('m'.repeat(MAX_UNIT_STRING_LENGTH + 1))).toThrow(
      `Unit string exceeds maximum length of ${MAX_UNIT_STRING_LENGTH}`
    );
  });
});

describe('G23 dogfood (#825 dB / dBm / Np)', () => {
  it('parses decibel and neper units; B remains byte', () => {
    expect(String(new Unit(10, 'dB'))).toMatch(/10\s*dB/);
    expect(String(new Unit(1, 'dBm'))).toMatch(/dBm/);
    expect(String(new Unit(1, 'Np'))).toMatch(/Np/);
    expect(new Unit(10, 'dB').value).toBeCloseTo(10, 10);
    expect(new Unit(3, 'dB').toNumber()).toBeCloseTo(3, 10);
    expect(new Unit(1, 'B').toNumber('bit')).toBe(8);
    // Power quantity: 0 dBm is 1 mW. Field quantity: 1 Np is 20/ln(10) dB.
    expect(new Unit(0, 'dBm').toNumber('mW')).toBeCloseTo(1, 12);
    expect(new Unit(0, 'dBm').value).toBeCloseTo(1e-3, 15);
    expect(new Unit(1, 'Np').to('dB').toNumber()).toBeCloseTo(20 / Math.LN10, 12);
    expect(String(new Unit(1, 'dB'))).toBe('1 dB');
  });
});

describe('G23 dogfood (#812 Unit.value SI vs display)', () => {
  it('documents SI .value and .toNumber(deg) for angles', () => {
    const u = new Unit(180, 'deg');
    expect(u.value).toBeCloseTo(Math.PI, 12);
    expect(u.toNumber('deg')).toBeCloseTo(180, 12);
    expect(String(u)).toBe('180 deg');
    expect(new Unit(1, 'km').to('m').value).toBe(1000);
  });
});

describe('G23 dogfood (#828 physics scope)', () => {
  it('keeps e as Euler and binds charge on e0 and G on physicsScope', () => {
    expect(evaluate('e')).toBeCloseTo(Math.E);
    const scope = physicsScope();
    expect(evaluate('e', scope)).toBeCloseTo(Math.E);
    expect(asUnit(evaluate('e0', scope)).toSI().toString()).toBe(
      elementaryCharge.toSI().toString()
    );
    expect(asUnit(evaluate('G', scope)).toSI().toString()).toBe(
      gravitationConstant.toSI().toString()
    );
    expect(asUnit(evaluate('G', undefined)).formatUnits()).toBe('G');
    expect(asUnit(evaluate('G', scope)).toNumber()).toBeCloseTo(gravitationConstant.toNumber(), 12);
    expect(evaluate('pi', scope)).toBeCloseTo(Math.PI);
    expect(evaluate('sin(0)', scope)).toBe(0);
    expect(evaluate('i', scope)).toEqual(evaluate('i'));
  });
});

describe('G23 dogfood (#827 CODATA uncertainties)', () => {
  it('attaches absolute uncertainties on measured CODATA Unit constants', () => {
    expect(electronMass.uncertainty).toBeCloseTo(2.8e-40, 45);
    expect(electronMass.unc).toBeCloseTo(2.8e-40, 45);
    expect(gravitationConstant.uncertainty).toBeCloseTo(1.5e-15, 18);
    expect(gravitationConstant.unc).toBe(1.5e-15);
    expect(speedOfLight.unc).toBe(0);
    expect(planckConstant.unc).toBe(0);
    expect(elementaryCharge.unc).toBe(0);
    expect(rydberg.unc).toBe(1.2e-5);
    const alpha = fineStructure as unknown as { unc: number };
    expect(Number(fineStructure)).toBeCloseTo(7.2973525643e-3, 16);
    expect(alpha.unc).toBe(1.1e-12);
  });
});
