import { describe, expect, it } from 'vitest';
import { all as oracleAll, create as createOracle } from 'mathjs';
import { all, create } from '../src/index.js';

describe('mathjs instance-local seeded streams', () => {
  it('keeps each instance and operation independent across direct and evaluated calls', () => {
    const a = create(all, { randomSeed: 'test' });
    const b = create(all, { randomSeed: 'test' });
    const oracle = createOracle(oracleAll, { randomSeed: 'test' });

    const first = oracle.random();
    expect(a.random()).toBe(first);
    expect(b.evaluate('random()')).toBe(first);
    const integer = oracle.randomInt(100);
    expect(a.evaluate('randomInt(100)')).toBe(integer);
    expect(b.randomInt(100)).toBe(integer);
    const choice = oracle.pickRandom([5, 6, 7]);
    expect(a.pickRandom([5, 6, 7])).toBe(choice);
    expect(b.compile('pickRandom([5, 6, 7])').evaluate()).toBe(choice);
    const second = oracle.random();
    expect(a.compile('random()').evaluate()).toBe(second);
    expect(b.random()).toBe(second);
  });

  it('matches mathjs for fractional and empty random array dimensions', () => {
    const math = create(all, { randomSeed: 'arrays' });
    const oracle = createOracle(oracleAll, { randomSeed: 'arrays' });
    expect(math.random([2.5])).toEqual(oracle.random([2.5]));
    expect(math.random([2, -1])).toEqual(oracle.random([2, -1]));
    expect(math.random([])).toEqual(oracle.random([]));
    expect(() => math.random([Infinity, -1])).toThrow(RangeError);
  });

  it('restarts on a seed change and retains custom imported RNG methods', () => {
    const math = create(all, { randomSeed: 'first' });
    const compiled = math.compile('random()');
    const oracle = createOracle(oracleAll, { randomSeed: 'second' });
    math.config({ randomSeed: 'second' });
    expect(compiled.evaluate()).toBe(oracle.random());
    expect(math.random([2, 2])).toEqual(oracle.random([2, 2]));
    math.import({ random: () => 42 }, { override: true });
    expect(math.evaluate('random()')).toBe(42);
  });
});
