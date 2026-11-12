import { describe, it, expect } from 'vitest';
import { create, all } from '@danielsimonjr/mathts-compat';
import { createParse } from '@danielsimonjr/mathts-parser';
import { EXPRESSION_SCOPE_OMIT } from '@danielsimonjr/mathts-expression';

/**
 * The nodes that `createParse(create(all))` builds resolve names against the
 * caller's scope. That scope must hide the same denylisted names that
 * `math.evaluate` hides, or a parsed expression escapes the sandbox.
 */
describe('#924 createParse(create(all)) keeps the expression sandbox', () => {
  it('import({zz: 1}) throws and does not change the instance', () => {
    const math = create(all) as unknown as Record<string, unknown>;
    const evaluate = math.evaluate as (expr: string) => unknown;
    expect(() => evaluate('import({zz: 1})')).toThrow(/import/);
    const node = createParse(math)('import({zz: 1})');
    expect(() => node.compile().evaluate({})).toThrow(/Undefined function import/);
    expect(math.zz).toBeUndefined();
  });

  it('exports a non-empty denylist', () => {
    expect([...EXPRESSION_SCOPE_OMIT].length).toBeGreaterThan(10);
  });

  it.each([...(EXPRESSION_SCOPE_OMIT ?? [])])('%s("x") cannot be called', (fn) => {
    const math = create(all) as unknown as Record<string, unknown>;
    const evaluate = math.evaluate as (expr: string) => unknown;
    expect(() => evaluate(`${fn}("x")`)).toThrow();
    const node = createParse(math)(`${fn}("x")`);
    expect(() => node.compile().evaluate({})).toThrow(new RegExp(`Undefined function ${fn}`));
  });

  it.each([...(EXPRESSION_SCOPE_OMIT ?? [])])('symbol %s is undefined', (fn) => {
    const math = create(all) as unknown as Record<string, unknown>;
    const node = createParse(math)(fn);
    expect(() => node.compile().evaluate({})).toThrow(/Undefined symbol/);
  });
});

describe('#924 createParse reads a compat config accessor', () => {
  it('0.1 is a BigNumber when the instance is configured for BigNumber', () => {
    const math = create(all, { number: 'BigNumber' }) as unknown as Record<string, unknown>;
    const viaInstance = (math.parse as (s: string) => { value: unknown })('0.1').value;
    const viaFactory = (createParse(math)('0.1') as unknown as { value: unknown }).value;
    expect((viaInstance as { isBigNumber?: boolean }).isBigNumber).toBe(true);
    expect((viaFactory as { isBigNumber?: boolean }).isBigNumber).toBe(true);
  });
});
