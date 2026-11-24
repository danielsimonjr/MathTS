import { describe, expect, it } from 'vitest';
import { create as createOracle } from 'mathjs';
import { all, create } from '../src/index.js';

describe('compat factory bundles', () => {
  it('loads nested factories by their declared names and resolves dependencies', () => {
    const math = create(all);
    const initial = math.factory('initial', [], () => 7);
    const answer = math.factory(
      'answer',
      ['initial'],
      ({ initial }) =>
        () =>
          initial * 6
    );
    const bundle = { group: { createInitial: initial, createAnswer: answer } };
    const actual = create(bundle) as unknown as Record<string, unknown>;
    const expected = createOracle(
      bundle as Parameters<typeof createOracle>[0]
    ) as unknown as Record<string, unknown>;

    expect((actual.answer as () => number)()).toBe((expected.answer as () => number)());
    expect(actual.initial).toBe(expected.initial);
    expect(actual.createAnswer).toBeUndefined();
    expect(actual.sin).toBeUndefined();
  });

  it('preserves the namespace form for raw custom functions', () => {
    const answer = () => 42;
    const math = create({ answer }) as unknown as { answer(): number; sin(x: number): number };
    expect(math.answer()).toBe(42);
    expect(math.sin(0)).toBe(0);
  });
});
