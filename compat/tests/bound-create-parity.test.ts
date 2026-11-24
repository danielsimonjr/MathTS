import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import { all, create, factory } from '../src/index.js';

describe('compat create factory inputs and instance options', () => {
  it('creates sibling instances with fresh defaults and an independent configuration', () => {
    const actual = create(all, { number: 'BigNumber', precision: 21 });
    const original = oracle.create(oracle.all, { number: 'BigNumber', precision: 21 });
    const createOriginal = original.create as unknown as (options?: { matrix: 'Array' }) => {
      config(): { precision?: number; number?: string };
      evaluate(expression: string): unknown;
    };
    expect(actual.create().config().precision).toBe(createOriginal().config().precision);
    expect(actual.create().config().number).toBe(createOriginal().config().number);
    const child = actual.create({ matrix: 'Array' });
    expect(child.evaluate('[1, 2]')).toEqual(
      createOriginal({ matrix: 'Array' }).evaluate('[1, 2]')
    );
    expect(actual.config().number).toBe('BigNumber');
  });

  it('keeps the explicit factory and configuration form', () => {
    const actual = create(all);
    const sibling = actual.create({ answer: () => 42 }, { number: 'Fraction' });
    expect(Reflect.get(sibling, 'answer')()).toBe(42);
    expect(sibling.config().number).toBe('Fraction');
    const custom = create({ answer: () => 42 });
    expect(Reflect.get(custom.create(), 'answer')()).toBe(42);
  });

  it('accepts arrays of MathJS-style factories', () => {
    const answer = factory('answer', [], () => 42);
    const selected = create([answer]);
    expect(Reflect.get(selected, 'answer')).toBe(42);
    expect(Reflect.get(selected, 'sin')).toBeUndefined();
  });
});
