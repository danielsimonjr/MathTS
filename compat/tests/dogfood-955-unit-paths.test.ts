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
