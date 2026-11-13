/**
 * #921: what `Unit.value` holds.
 *
 * The contract is the one mathjs has: `value` is the magnitude in SI base units (radians
 * for an angle, metres for a length), whatever unit the quantity shows. An offset
 * temperature unit keeps its zero point: `new Unit(0, 'degC').value` is 0, and kelvin is
 * `toNumeric('K')`. The number in the shown unit is `toNumeric()`, and `toNumeric('deg')`
 * is the number in a named unit. The tests pin that contract, and run the samples of the
 * README against it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Unit } from '../src/index.js';

const close = (actual: unknown, expected: number, digits = 12): void => {
  expect(Number(actual)).toBeCloseTo(expected, digits);
};

describe('Unit.value is the SI magnitude (#921)', () => {
  it('holds radians for an angle written in degrees', () => {
    const angle = new Unit(180, 'deg');
    close(angle.value, Math.PI);
    expect(String(angle)).toBe('180 deg');
  });

  it('holds SI for other units too', () => {
    expect(new Unit(5, 'km').value).toBe(5000);
    expect(new Unit(100, 'cm').value).toBe(1);
    close(new Unit(100, 'km/h').to('m/s').value, 27.77777777777778);
  });

  it('keeps the zero point of an offset temperature unit out of value', () => {
    expect(new Unit(0, 'degC').value).toBe(0);
    expect(new Unit(100, 'degC').value).toBe(100);
    close(new Unit(32, 'degF').value, (32 * 5) / 9);
    close(new Unit(0, 'degC').toNumeric('K'), 273.15);
    close(new Unit(32, 'degF').toNumeric('degC'), 0);
    expect(new Unit(0, 'degC').to('K').value).toBe(273.15);
  });

  it('keeps the SI value after a conversion back to the written unit', () => {
    const roundTrip = new Unit(180, 'deg').to('rad').to('deg');
    close(roundTrip.value, Math.PI);
    expect(String(roundTrip)).toBe('180 deg');
  });

  it('gives the number in the shown unit through toNumeric()', () => {
    expect(new Unit(180, 'deg').toNumeric()).toBe(180);
    expect(new Unit(5, 'km').toNumeric()).toBe(5);
    close(new Unit(180, 'deg').to('rad').to('deg').toNumeric(), 180);
  });

  it('gives the number in a named unit through toNumeric(unit)', () => {
    expect(new Unit(180, 'deg').toNumeric('deg')).toBe(180);
    close(new Unit(180, 'deg').toNumeric('rad'), Math.PI);
    close(new Unit(1, 'rad').toNumeric('deg'), 180 / Math.PI);
    close(new Unit(5, 'km').toNumeric('m'), 5000);
  });

  it('gives the shown number in toJSON().value', () => {
    expect(new Unit(180, 'deg').toJSON().value).toBe(180);
  });
});

describe('the samples of the units README run as written (#921)', () => {
  const readme = readFileSync(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf8');
  const samples = [...readme.matchAll(/^(new Unit\(.+\)[^;]*);\s*\/\/\s*(-?[\d.]+)/gm)].map(
    (m) => ({
      expression: m[1],
      expected: Number.parseFloat(m[2]),
    })
  );

  it('has the .value sample and the display-number sample', () => {
    expect(samples.length).toBeGreaterThanOrEqual(2);
  });

  it.each(samples)('$expression is $expected', ({ expression, expected }) => {
    const result = new Function('Unit', `return ${expression};`)(Unit) as unknown;
    close(result, expected, 6);
  });

  it('shows toNumeric in its samples and never the deprecated toNumber', () => {
    const fence = '`'.repeat(3);
    const blocks = readme.split(fence).filter((_, i) => i % 2 === 1);
    const code = blocks.filter((b) => b.startsWith('ts')).join('\n');
    expect(code).toMatch(/toNumeric\(/);
    expect(code).not.toMatch(/toNumber\(/);
    expect(readme).toMatch(/deprecated/);
  });
});
