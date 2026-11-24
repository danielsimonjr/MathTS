import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import * as compat from '../src/index.js';

describe('MathJS constant factory bundles', () => {
  it.each([
    'e',
    'E',
    'pi',
    'PI',
    'tau',
    'phi',
    'LN2',
    'LN10',
    'LOG2E',
    'LOG10E',
    'SQRT1_2',
    'SQRT2',
    'Infinity',
    'NaN',
    'false',
    'true',
    'null',
    'i',
  ])('matches dependency metadata and selected values for %s', (name) => {
    const bundleName = name + 'Dependencies';
    const actualBundle = Reflect.get(compat, bundleName) as Record<string, unknown>;
    const upstreamBundle = Reflect.get(oracle, bundleName) as Parameters<typeof oracle.create>[0];
    expect(Object.keys(actualBundle)).toEqual(Object.keys(upstreamBundle));
    const factoryName = Object.keys(actualBundle).find((key) => key.startsWith('create'))!;
    const actualFactory = Reflect.get(actualBundle, factoryName) as {
      dependencies: string[];
      meta: unknown;
    };
    const expectedFactory = Reflect.get(
      upstreamBundle,
      factoryName
    ) as unknown as typeof actualFactory;
    expect(actualFactory.dependencies).toEqual(expectedFactory.dependencies);
    expect(actualFactory.meta).toEqual(expectedFactory.meta);
    const options = { number: 'BigNumber', precision: 28 } as const;
    const actual = compat.create({ [bundleName]: actualBundle }, options);
    const upstream = oracle.create(
      { [bundleName]: upstreamBundle } as typeof upstreamBundle,
      options
    );
    expect(String(Reflect.get(actual, name))).toBe(String(Reflect.get(upstream, name)));
  });

  it('matches the golden-ratio rounding of a full configured instance', () => {
    const settings = { number: 'BigNumber', precision: 28 } as const;
    const math = compat.create(compat.all, settings);
    const upstream = oracle.create(oracle.all, settings);
    expect(String(math.phi)).toBe(String(upstream.phi));
    expect(String(math.evaluate('phi'))).toBe(String(upstream.phi));
  });

  it('recreates a configured factory constant when precision changes', () => {
    const math = compat.create(
      { piDependencies: compat.piDependencies },
      { number: 'BigNumber', precision: 24 }
    );
    expect(String(math.pi)).toBe('3.14159265358979323846264');
    math.config({ precision: 12 });
    expect(String(math.pi)).toBe('3.14159265359');
  });
});
