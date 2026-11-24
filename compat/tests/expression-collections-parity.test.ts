import { describe, expect, it } from 'vitest';
import { all as oracleAll, create as createOracle } from 'mathjs';
import { all, create } from '../src/index.js';

describe('compat expression collections', () => {
  it('uses one scope for a nested array of input expressions', () => {
    const math = create(all);
    const oracle = createOracle(oracleAll);
    const actualScope = new Map<string, unknown>([['x', 5]]);
    const oracleScope = new Map<string, unknown>([['x', 5]]);
    const expressions = ['y = x + 1', ['y = y + 2', 'x + y']];
    expect(math.evaluate(expressions, actualScope, { unsafe: true })).toEqual(
      oracle.evaluate(expressions, oracleScope)
    );
    expect(actualScope).toEqual(oracleScope);
  });

  it('keeps nested compiled outputs and binds the compiled functions to the instance', () => {
    const math = create(all, { number: 'BigNumber', precision: 23 });
    const oracle = createOracle(oracleAll, { number: 'BigNumber', precision: 23 });
    const expressions = ['x + 1', ['PI']];
    const result = math.compile(expressions);
    const expected = oracle.compile(expressions);
    expect(Array.isArray(result[1])).toBe(true);
    const actualPi = Array.isArray(result[1]) ? result[1][0] : result[1];
    const expectedPi = Array.isArray(expected[1]) ? expected[1][0] : expected[1];
    if (Array.isArray(actualPi)) throw new Error('Expected a compiled expression');
    expect(String(actualPi.evaluate())).toBe(String(expectedPi.evaluate()));

    const [first, second] = math.compileExpr(['x = 4', '2 * x'], { unsafe: true });
    const sharedScope = new Map<string, unknown>();
    expect(String(first.evaluate(sharedScope))).toBe('4');
    expect(String(second.evaluate(sharedScope))).toBe('8');
  });

  it('preserves the shape of expression matrices in evaluate and compile', () => {
    const math = create(all);
    const oracle = createOracle(oracleAll);
    const expressions = [['x + 1'], ['2 * x']];
    const scope = { x: 3 };
    const actual = math.matrix(expressions);
    // The oracle accepts string matrices and maps compile over them at runtime.
    const expected = oracle.matrix(expressions as unknown as number[][]);

    const evaluated = math.evaluate(actual, scope);
    expect(evaluated.size()).toEqual(expected.size());
    expect(evaluated.toArray()).toEqual(oracle.evaluate(expected, scope).toArray());

    const compiled = math.compile(actual);
    expect(compiled.size()).toEqual(expected.size());
    const reference = oracle.compile(expected) as unknown as typeof compiled;
    const run = (item: unknown) =>
      (item as { evaluate(scope: Record<string, unknown>): unknown }).evaluate(scope);
    expect(compiled.map(run).toArray()).toEqual(reference.map(run).toArray());
    expect(math.evaluate([])).toEqual(oracle.evaluate([]));
  });

  it('reports invalid collection entries as a TypeError', () => {
    const math = create(all);
    const invalid = math.matrix([['1'], [2]]);
    expect(() => math.evaluate(invalid)).toThrow(TypeError);
    expect(() => math.compile(invalid)).toThrow(TypeError);
  });

  it('resolves the instance version in evaluated, compiled, and parsed expressions', () => {
    const math = create(all);
    const oracle = createOracle(oracleAll);
    expect(oracle.evaluate('version')).toBe(oracle.version);
    expect(math.evaluate('version')).toBe(math.version);
    expect(math.compile('version').evaluate()).toBe(math.version);
    expect(math.parser().evaluate('version')).toBe(math.version);
    expect(math.evaluate('version', { version: 'from scope' })).toBe('from scope');
  });
});
