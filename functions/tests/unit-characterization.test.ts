import { describe, it, expect } from 'vitest';

import { unit, splitUnit, speedOfLight } from '../src/index.js';

/**
 * Phase 0 characterization net for the Unit MERGE (docs/superpowers/plans/
 * 2026-07-03-unit-merge.md). The mathjs-derived `Unit` (what `unit()` returns) has
 * rich features — parser, unit systems, `toSI`/`simplify`, `splitUnit`, angle/bit
 * dimensions, physical constants — that carry only THIN direct test coverage. These
 * oracles pin the CURRENT behavior so the merge (relocating this class into `core`)
 * cannot silently drop a capability. They are exact-string/number characterizations,
 * not aspirational specs — if the merge changes a value here, that is a decision to
 * make consciously, not by accident.
 */

const U = unit as (
  a: unknown,
  b?: unknown
) => {
  toString(): string;
  toNumeric(u?: string): number;
  to(u: string): { toString(): string; toNumeric(u?: string): number };
  simplify(): { toString(): string };
  toSI(): { toString(): string };
};

describe('Unit merge characterization — parsing & value', () => {
  it('parses compound and prefixed unit strings', () => {
    expect(U('5 km/h').toString()).toBe('5 km / h');
    expect(U('4e2 cm/s^2').toString()).toContain('cm');
    expect(U(2, 'km').toNumeric('m')).toBe(2000);
  });

  it('converts across units (incl. imperial + temperature)', () => {
    expect(U(1, 'm').to('ft').toString()).toBe('3.280839895013123 ft');
    expect(U(2, 'inch').to('cm').toString()).toBe('5.08 cm');
    expect(U('20 degC').to('K').toString()).toBe('293.15 K');
    expect(U(36, 'km/h').to('m/s').toString()).toBe('10 m / s');
  });
});

describe('Unit merge characterization — angle & bit dimensions (core Unit lacks these)', () => {
  it('angle: 90 deg → rad', () => {
    expect(U('90 deg').to('rad').toString()).toBe('1.5707963267948966 rad');
  });
  it('information: 1 byte → 8 bit', () => {
    expect(U('1 byte').to('bit').toString()).toBe('8 bit');
  });
});

describe('Unit merge characterization — simplify / toSI / splitUnit', () => {
  it('toSI expands to base SI units', () => {
    expect(U('1 N').toSI().toString()).toBe('1 (kg m) / s^2');
  });
  it('simplify keeps a already-simple unit', () => {
    expect(U('5 km/h').simplify().toString()).toBe('5 km / h');
  });
  it('splitUnit distributes a magnitude across parts', () => {
    const parts = (splitUnit as (u: unknown, p: string[]) => { toString(): string }[])(
      U(1.5, 'm'),
      ['m', 'cm']
    );
    expect(parts.map((p) => p.toString())).toEqual(['1 m', '50 cm']);
  });
});

describe('Unit merge characterization — physical constants', () => {
  it('speedOfLight is a Unit of 2.99792458e8 m/s', () => {
    expect((speedOfLight as { toString(): string }).toString()).toBe('2.99792458e+8 m / s');
  });
});
