import { expect, it } from 'vitest';
import * as reference from 'mathjs';
import * as compat from '../src/index.js';

it('uses the mathjs token classes for operators, identifiers and quoted strings', () => {
  const instance = compat.create(compat.all);
  const selected = compat.create({ parseDependencies: compat.parseDependencies });
  function outcome(read: () => unknown) {
    try {
      return ['value', String(read())];
    } catch (error) {
      return ['error', (error as Error).name];
    }
  }

  const scope = { '𝟙': 5, '×': 3, '÷': 4 };
  for (const text of [
    '√9',
    '∛8',
    '∜16',
    '2·3',
    '2⋅3',
    '2×3',
    '8÷2',
    '4−3',
    '𝟙',
    '×',
    '÷',
    '"√×𝟙"',
  ]) {
    const parsed = outcome(() => reference.parse(text).toString());
    const evaluated = outcome(() => reference.evaluate(text, scope));
    for (const api of [compat, instance]) {
      expect(
        outcome(() => api.parse(text).toString()),
        text
      ).toEqual(parsed);
      expect(
        outcome(() => api.evaluate(text, scope)),
        text
      ).toEqual(evaluated);
      expect(
        outcome(() => api.compile(text).evaluate(scope)),
        text
      ).toEqual(evaluated);
    }
    expect(
      outcome(() => selected.parse(text).toString()),
      text
    ).toEqual(parsed);
  }
  expect(compat.parse.isValidLatinOrGreek('×')).toBe(true);
  expect(instance.parse.isValidMathSymbol('𝟙'[0], '𝟙'[1])).toBe(true);
});
