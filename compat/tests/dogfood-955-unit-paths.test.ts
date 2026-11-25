import { describe, expect, it } from 'vitest';
import * as reference from 'mathjs';
import * as compat from '../src/index.js';

describe('mathjs unit normalization and formatting', () => {
  const instance = compat.create(compat.all);
  const selected = compat.create({ unitDependencies: compat.unitDependencies });

  it.each([
    [0.75, 'inch'],
    [1, 'ft'],
    [2.54, 'cm'],
    [60, 'mile/hour'],
    [2.54, 'inch^2'],
    [0.125, 'kg m/s^2'],
  ] as const)('stores and prints %s %s like mathjs', (value, units) => {
    const text = value + ' ' + units;
    const expected = reference.unit(value, units);
    for (const result of [
      instance.unit(value, units),
      compat.unit(value, units),
      selected.unit(value, units),
      new instance.Unit(value, units),
      JSON.parse(JSON.stringify(instance.unit(value, units)), instance.reviver),
    ]) {
      expect(result.value).toBe(expected.value);
      expect(result.toString()).toBe(expected.toString());
    }
    const evaluated = reference.evaluate(text);
    for (const result of [instance.evaluate(text), instance.parse(text).evaluate()]) {
      expect((result as reference.Unit).value).toBe(evaluated.value);
      expect(String(result)).toBe(String(evaluated));
    }
  });
});

it('keeps custom unit names local to the instance that registered them', () => {
  const first = compat.create(compat.all);
  const sibling = first.create();
  first.createUnit('customParityLength', '2 m');
  expect(first.unit(3, 'customParityLength').toNumber('m')).toBe(6);
  expect(String(first.evaluate('3 customParityLength to m'))).toBe('6 m');
  expect(() => sibling.unit(1, 'customParityLength')).toThrow();
  const json = JSON.stringify(first.unit(2, 'customParityLength'));
  expect(JSON.parse(json, first.reviver).toNumber('m')).toBe(4);
  expect(() => JSON.parse(json, sibling.reviver)).toThrow();
});
