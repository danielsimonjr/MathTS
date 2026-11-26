import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { chainTypedFromInstance } from '../src/chain.js';

describe('G20 chain implementation branches (#1575)', () => {
  it('chainTypedFromInstance rejects non-typed values', () => {
    expect(chainTypedFromInstance(null)).toBeUndefined();
    expect(chainTypedFromInstance({})).toBeUndefined();
  });

  it('import registers new chain methods via the instance on listener', () => {
    const math = create(all);
    const calls: string[] = [];
    math.on('import', (name: unknown) => {
      if (typeof name === 'string') calls.push(name);
    });
    const custom = math.factory('customChain', [], () => (x: unknown) => x);
    math.import({ customChain: custom });
    expect(calls).toContain('customChain');
    expect(typeof math.chain(1).customChain).toBe('function');
    expect(math.chain(5).customChain().done()).toBe(5);
  });

  it('Chain constructor, fromJSON, and nested chain unwrap values', () => {
    const math = create(all);
    const Chain = math.Chain as new (value?: unknown) => {
      done(): unknown;
      type: string;
    } & { fromJSON: (json: { value: unknown }) => { done(): unknown } };
    const c = new Chain(math.chain(2));
    expect(c.type).toBe('Chain');
    expect(c.done()).toBe(2);
    const revived = Chain.fromJSON({ value: 7 });
    expect(revived.done()).toBe(7);
    expect(() => (Chain as unknown as (v: unknown) => unknown)(3)).toThrow(
      /Constructor must be called with 'new'/
    );
  });
});
