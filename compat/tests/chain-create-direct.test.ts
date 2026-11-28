import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { createChain } from '../src/chain-create.js';

describe('chain-create direct coverage (#1575)', () => {
  it('exercises proxies, import forwarding, and chain entry points', () => {
    const math = create(all);
    const imports: string[] = [];
    const { chain, Chain } = createChain(math as Record<string, unknown>, {
      on: ((name: string, cb: (n: string) => void) => {
        math.on(name, cb as never);
        return math;
      }) as typeof math.on,
      format: (value) => `fmt:${String(value)}`,
    });
    math.on('import', (n: unknown) => {
      if (typeof n === 'string') imports.push(n);
    });
    const custom = math.factory('chainCov', [], () => (x: unknown) => x);
    math.import({ chainCov: custom });
    expect(imports).toContain('chainCov');
    expect(chain(2).add(1).done()).toBe(3);
    expect(chain(chain(4)).done()).toBe(4);
    expect(new Chain(5).multiply(2).done()).toBe(10);
    expect(String(chain(6))).toContain('fmt:');
    expect(Chain.fromJSON({ value: 9 }).done()).toBe(9);
    expect(() => (Chain as unknown as (v: unknown) => unknown)(1)).toThrow(/new operator/);
    expect((chain(1) as Record<string, unknown>).nope).toBeUndefined();
    expect(chain(2).chainCov(3).done()).toBe(2);
  });
});
