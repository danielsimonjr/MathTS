import { afterEach, describe, expect, it } from 'vitest';
import { Chain, create, all } from '../src/index.js';

describe('#1783 Chain inherits prototype properties', () => {
  const math = create(all);
  const protoKey = '__mathts_chain_inherited_test__';

  afterEach(() => {
    Reflect.deleteProperty(Object.prototype, protoKey);
  });

  it('does not mask Object.prototype properties on new Chain()', () => {
    Object.defineProperty(Object.prototype, protoKey, {
      value: 'inherited-value',
      configurable: true,
      writable: true,
      enumerable: false,
    });

    const chain = new Chain();
    expect(chain[protoKey as keyof typeof chain]).toBe('inherited-value');
    expect(Object.hasOwn(chain, protoKey)).toBe(false);
  });

  it('does not mask Object.prototype properties on math.chain()', () => {
    Object.defineProperty(Object.prototype, protoKey, {
      value: 'chain-factory',
      configurable: true,
      writable: true,
      enumerable: false,
    });

    const chain = math.chain(1);
    expect((chain as Record<string, unknown>)[protoKey]).toBe('chain-factory');
    expect(Object.hasOwn(chain, protoKey)).toBe(false);
  });
});
