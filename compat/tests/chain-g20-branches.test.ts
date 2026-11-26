import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { chainTypedFromInstance } from '../src/chain-create.js';

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
    const ChainCtor = math.Chain;
    const c = new ChainCtor(math.chain(2));
    expect(c.type).toBe('Chain');
    expect(c.done()).toBe(2);
    const revived = ChainCtor.fromJSON({ value: 7 });
    expect(revived.done()).toBe(7);
    const bareCall = ChainCtor as unknown as (value?: unknown) => unknown;
    expect(() => bareCall(3)).toThrow(/Constructor must be called with the new operator/);
  });
});
