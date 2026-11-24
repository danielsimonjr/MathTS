import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import { all, config, create, evaluate, pickRandom, random, randomInt } from '../src/index.js';

describe('named compatibility defaults', () => {
  it('exposes the standard defaults and rejects updates to the global config', () => {
    const upstreamConfig = Reflect.get(oracle, 'config') as typeof config;
    expect(config()).toEqual(upstreamConfig());
    expect(config.MATRIX_OPTIONS).toEqual(upstreamConfig.MATRIX_OPTIONS);
    expect(config.NUMBER_OPTIONS).toEqual(upstreamConfig.NUMBER_OPTIONS);
    expect(() => config({ matrix: 'Array' })).toThrow(/global config is readonly/i);
    create(all).config({ matrix: 'Array' });
    expect(Array.isArray(evaluate('[1, 2]'))).toBe(false);
  });

  it('provides named RNG functions with MathJS argument conventions', () => {
    expect(randomInt(1)).toBe(oracle.randomInt(1));
    expect(pickRandom(['one'])).toBe(oracle.pickRandom(['one']));
    expect(random([0])).toEqual(oracle.random([0]));
    const value = random(10, 11) as number;
    expect(value).toBeGreaterThanOrEqual(10);
    expect(value).toBeLessThan(11);
  });
});
